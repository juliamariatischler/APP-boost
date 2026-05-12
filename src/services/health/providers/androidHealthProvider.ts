import { callCordovaHealth } from '../cordovaHealth';
import { getHealthPlatformContext } from '../platform';
import type { HealthProvider } from '../types';

const normalizeSteps = (result: unknown): number => {
  const items = Array.isArray(result) ? result : [result];

  return Math.floor(
    items.reduce((sum: number, item: any) => {
      return sum + (Number(item?.value) || 0);
    }, 0)
  );
};

export class AndroidHealthProvider implements HealthProvider {
  source = 'health_connect' as const;
  label = 'Health Connect';
  platform = 'android' as const;

  isSupported(): boolean {
    return getHealthPlatformContext().source === this.source;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      return await callCordovaHealth<boolean>('isAvailable');
    } catch (error) {
      console.error('Android health availability check failed:', error);
      return false;
    }
  }

  async requestAuthorization(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      await callCordovaHealth('requestAuthorization', { read: ['steps'], write: [] });
      return true;
    } catch (error) {
      console.error('Android health authorization failed:', error);
      return false;
    }
  }

  async getTodaySteps(): Promise<number> {
    if (!this.isSupported()) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    try {
      const aggregated = await callCordovaHealth('queryAggregated', {
        startDate: today,
        endDate: now,
        dataType: 'steps',
      });
      console.log('Android Health Connect aggregated steps result:', aggregated);
      const aggregatedSteps = normalizeSteps(aggregated);
      if (aggregatedSteps > 0) return aggregatedSteps;

      const result = await callCordovaHealth('query', {
        startDate: today,
        endDate: now,
        dataType: 'steps',
        limit: 1000
      });

      console.log('Android Health Connect raw steps result:', result);
      return normalizeSteps(result);
    } catch (error) {
      console.error('Android step query failed:', error);
      return 0;
    }
  }
}
