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

  if (runtime.platform === 'android') {
    return {
      platform: 'android',
      source: 'health_connect',
      label: 'Schrittzähler',
      isSupported: true,
    };
  }

  return unsupportedContext;
};
