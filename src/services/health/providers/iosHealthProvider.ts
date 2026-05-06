import { Health } from '@awesome-cordova-plugins/health';
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
      return await Health.isAvailable();
    } catch (error) {
      console.error('iOS HealthKit availability check failed:', error);
      return false;
    }
  }

  async requestAuthorization(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      await (Health as any).requestAuthorization({ read: ['steps'], write: [] });
      return true;
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
      const aggregated = await Health.queryAggregated({
        startDate: today,
        endDate: now,
        dataType: 'steps',
      });
      const aggregatedSteps = normalizeSteps(aggregated);
      if (aggregatedSteps > 0) return aggregatedSteps;

      const result = await Health.query({
        startDate: today,
        endDate: now,
        dataType: 'steps',
        limit: 1000,
      });
      return normalizeSteps(result);
    } catch (error) {
      console.error('iOS HealthKit step query failed:', error);
      return 0;
    }
  }
}
