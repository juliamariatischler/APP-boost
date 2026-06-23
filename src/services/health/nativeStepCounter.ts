import { Capacitor, registerPlugin } from '@capacitor/core';

interface DeviceStepCounterResult {
  supported?: boolean;
  permissionGranted?: boolean;
  value?: number;
  bootTime?: number;
  timedOut?: boolean;
}

const getBaselineKey = (dateKey: string) => `boost:android-step-counter-baseline:${dateKey}`;

const DeviceStepCounter = registerPlugin<{
  getCurrentCounter(): Promise<DeviceStepCounterResult>;
}>('DeviceStepCounter');

const isAndroidNative = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

/**
 * Reads the raw on-device step counter (Sensor.TYPE_STEP_COUNTER).
 * Triggers the ACTIVITY_RECOGNITION permission prompt on first call if needed.
 * Returns null when not on native Android.
 */
export const readAndroidStepCounter = async (): Promise<DeviceStepCounterResult | null> => {
  if (!isAndroidNative()) {
    return null;
  }

  try {
    const result = await DeviceStepCounter.getCurrentCounter();
    console.log('Android device step counter raw result:', result);
    return result;
  } catch (error) {
    console.error('readAndroidStepCounter failed:', error);
    return null;
  }
};

/** True when the device exposes a hardware step counter. */
export const isAndroidStepCounterSupported = async (): Promise<boolean> => {
  const result = await readAndroidStepCounter();
  return result?.supported === true;
};

/** Requests ACTIVITY_RECOGNITION and returns whether step access is granted. */
export const requestAndroidStepPermission = async (): Promise<boolean> => {
  const result = await readAndroidStepCounter();
  return result?.supported === true && result?.permissionGranted === true;
};

export const getAndroidSensorStepsToday = async (): Promise<number | null> => {
  const result = await readAndroidStepCounter();
  if (!result) {
    return null;
  }

  if (!result.supported || !result.permissionGranted) {
    return null;
  }

  if (result.timedOut && !result.value) {
    return null;
  }

  const counter = Math.floor(Number(result.value) || 0);
  if (counter <= 0) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = today.toISOString().slice(0, 10);
  const bootTime = Number(result.bootTime) || 0;

  if (bootTime >= today.getTime()) {
    return counter;
  }

  const baselineKey = getBaselineKey(todayKey);
  const stored = window.localStorage.getItem(baselineKey);
  const existingBaseline = stored !== null ? Number(stored) : null;

  if (existingBaseline !== null && Number.isFinite(existingBaseline) && existingBaseline > 0 && existingBaseline <= counter) {
    return Math.max(0, counter - existingBaseline);
  }

  window.localStorage.setItem(baselineKey, String(counter));
  return null;
};
