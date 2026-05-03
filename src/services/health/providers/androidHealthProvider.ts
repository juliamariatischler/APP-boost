import { Health } from '@awesome-cordova-plugins/health';
import { getHealthPlatformContext } from '../platform';
import type { HealthProvider } from '../types';

const normalizeSteps = (result: unknown): number => {
  if (!Array.isArray(result)) return 0;

  return Math.floor(
    result.reduce((sum: number, item: any) => {
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
      return await Health.isAvailable();
    } catch (error) {
      console.error('Android health availability check failed:', error);
      return false;
    }
  }

  async requestAuthorization(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      await Health.requestAuthorization([
        {
          read: ['steps'],
          write: []
        }
      ]);
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
      const result = await Health.query({
        startDate: today,
        endDate: now,
        dataType: 'steps',
        limit: 1000
      });

      return normalizeSteps(result);
    } catch (error) {
      console.error('Android step query failed:', error);
      return 0;
    }
  }
}
