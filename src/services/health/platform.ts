import { getPlatformRuntime, type NativePlatform } from '../platform/runtime';
import type { HealthSource } from './types';

export interface HealthPlatformContext {
  platform: NativePlatform;
  source: HealthSource;
  label: string;
  isSupported: boolean;
}

const unsupportedContext: HealthPlatformContext = {
  platform: 'web',
  source: 'none',
  label: 'Keine Health-Daten',
  isSupported: false,
};

export const getHealthPlatformContext = (): HealthPlatformContext => {
  const runtime = getPlatformRuntime();

  if (!runtime.isNative) {
    return unsupportedContext;
  }

  if (runtime.platform === 'ios') {
    return {
      platform: 'ios',
      source: 'apple_health',
      label: 'Apple Health',
      isSupported: true,
    };
  }

  // Android: Schrittzähler-Feature wurde entfernt (Kinder-App-Policy).
  // Kein Health-/Sensor-Zugriff mehr → wie Web behandeln.
  if (runtime.platform === 'android') {
    return {
      ...unsupportedContext,
      platform: 'android',
    };
  }

  return unsupportedContext;
};
