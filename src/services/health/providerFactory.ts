import type { HealthProvider } from './types';
import { getHealthPlatformContext } from './platform';
import { IOSHealthProvider } from './providers/iosHealthProvider';
import { AndroidHealthProvider } from './providers/androidHealthProvider';
import { WebHealthProvider } from './providers/webHealthProvider';

const providersBySource = {
  apple_health: new IOSHealthProvider(),
  health_connect: new AndroidHealthProvider(),
  none: new WebHealthProvider(),
} satisfies Record<string, HealthProvider>;

export const createHealthProvider = (): HealthProvider => {
  const context = getHealthPlatformContext();
  return providersBySource[context.source];
};
