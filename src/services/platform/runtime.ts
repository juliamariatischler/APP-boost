import { Capacitor } from '@capacitor/core';

export type NativePlatform = 'ios' | 'android' | 'web';

export interface PlatformRuntime {
  isNative: boolean;
  platform: NativePlatform;
}

export const getPlatformRuntime = (): PlatformRuntime => {
  const isNative = Capacitor.isNativePlatform();

  if (!isNative) {
    return {
      isNative: false,
      platform: 'web',
    };
  }

  const platform = Capacitor.getPlatform();

  if (platform === 'ios' || platform === 'android') {
    return {
      isNative: true,
      platform,
    };
  }

  return {
    isNative: false,
    platform: 'web',
  };
};
