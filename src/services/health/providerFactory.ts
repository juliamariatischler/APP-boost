import type { HealthProvider } from './types';
import { getHealthPlatformContext } from './platform';
import { IOSHealthProvider } from './providers/iosHealthProvider';
import { WebHealthProvider } from './providers/webHealthProvider';

// Android-Schrittzähler wurde entfernt – nur iOS (Apple Health) und Web/none.
const providersBySource = {
  apple_health: new IOSHealthProvider(),
  health_connect: new WebHealthProvider(),
  none: new WebHealthProvider(),
} satisfies Record<string, HealthProvider>;

export const createHealthProvider = (): HealthProvider => {
  const context = getHealthPlatformContext();
  return providersBySource[context.source];
};
