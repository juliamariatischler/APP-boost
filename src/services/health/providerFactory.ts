import { Capacitor } from '@capacitor/core';
import type { HealthProvider } from './types';
import { IOSHealthProvider } from './providers/iosHealthProvider';
import { AndroidHealthProvider } from './providers/androidHealthProvider';
import { WebHealthProvider } from './providers/webHealthProvider';

export const createHealthProvider = (): HealthProvider => {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
    return new IOSHealthProvider();
  }

  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    return new AndroidHealthProvider();
  }

  return new WebHealthProvider();
};
