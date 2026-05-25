import { Capacitor, registerPlugin } from '@capacitor/core';

interface DeviceStepCounterResult {
  supported?: boolean;
  permissionGranted?: boolean;
  value?: number;
  bootTime?: number;
  timedOut?: boolean;
}

const getBaselineKey = (dateKey: string) => `boost:android-step-counter-baseline:${dateKey}`;

const DeviceStepCounter = registerPlugin<{ getCurrentCounter(): Promise<DeviceStepCounterResult> }>('DeviceStepCounter');

export const getAndroidSensorStepsToday = async (): Promise<number | null> => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return null;
  }

  const result = await DeviceStepCounter.getCurrentCounter();
  console.log('Android device step counter raw result:', result);
  if (!result.supported || !result.permissionGranted) {
    return null;
  }

  const counter = Math.floor(Number(result.value) || 0);
  if (counter <= 0) {
    return 0;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = today.toISOString().slice(0, 10);
  const bootTime = Number(result.bootTime) || 0;

  if (bootTime >= today.getTime()) {
    return counter;
  }

  const baselineKey = getBaselineKey(todayKey);
  const existingBaseline = Number(window.localStorage.getItem(baselineKey));
  const baseline = Number.isFinite(existingBaseline) && existingBaseline > 0 && existingBaseline <= counter
    ? existingBaseline
    : counter;

  window.localStorage.setItem(baselineKey, String(baseline));
  return Math.max(0, counter - baseline);
};
