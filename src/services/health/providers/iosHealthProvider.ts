import { Capacitor } from '@capacitor/core';
import { Health } from '@awesome-cordova-plugins/health';
import type { HealthProvider } from '../types';

export class IOSHealthProvider implements HealthProvider {
  source = 'apple_health' as const;
  label = 'Apple Health';

  isSupported(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      return await Health.isAvailable();
    } catch {
      return false;
    }
  }

  async requestAuthorization(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      await Health.requestAuthorization([{ read: ['steps'], write: [] }]);
      return true;
    } catch {
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
        limit: 1000,
      });
      const items = Array.isArray(result) ? result : [result];
      return Math.floor(items.reduce((sum, item: any) => sum + (Number(item?.value) || 0), 0));
    } catch {
      return 0;
    }
  }
}
