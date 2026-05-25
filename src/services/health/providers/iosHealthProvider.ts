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

export class IOSHealthProvider implements HealthProvider {
  source = 'apple_health' as const;
  label = 'Apple Health';
  platform = 'ios' as const;

  isSupported(): boolean {
    return getHealthPlatformContext().source === this.source;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      return await callCordovaHealth<boolean>('isAvailable');
    } catch (error) {
      console.error('iOS HealthKit availability check failed:', error);
      return false;
    }
  }

  async requestAuthorization(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      const authorized = await callCordovaHealth<boolean>('requestAuthorization', { read: ['steps'], write: [] });
      return authorized !== false;
    } catch (error) {
      console.error('iOS HealthKit authorization failed:', error);
      return false;
    }
  }

  async getTodaySteps(): Promise<number> {
    if (!this.isSupported()) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();
    try {
      // queryAggregated needs bucket:'day' to return data correctly
      const aggregated = await callCordovaHealth('queryAggregated', {
        startDate: today,
        endDate: now,
        dataType: 'steps',
        bucket: 'day',
      });
      console.log('iOS HealthKit aggregated steps result:', aggregated);
      const aggregatedSteps = normalizeSteps(aggregated);
      if (aggregatedSteps > 0) return aggregatedSteps;

      // Fallback: raw samples, manual entries excluded
      const result = await callCordovaHealth('query', {
        startDate: today,
        endDate: now,
        dataType: 'steps',
        limit: 1000,
        filterOutUserInput: true,
      });
      console.log('iOS HealthKit raw steps result:', result);
      const rawSteps = normalizeSteps(result);
      if (rawSteps > 0) return rawSteps;

      // DEBUG: check if steps exist at all without filter (log only, not returned as points)
      const debug = await callCordovaHealth('query', {
        startDate: today,
        endDate: now,
        dataType: 'steps',
        limit: 1000,
      });
      console.log('iOS HealthKit DEBUG (unfiltered, not used for points):', debug, 'count:', normalizeSteps(debug));
      return 0;
    } catch (error) {
      console.error('iOS HealthKit step query failed:', error);
      return 0;
    }
  }
}
