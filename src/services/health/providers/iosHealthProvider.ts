import { Capacitor, registerPlugin } from '@capacitor/core';
import { Health } from '@awesome-cordova-plugins/health';
import type { HealthProvider } from '../types';

type HealthKitAvailabilityResponse = {
  available?: boolean;
  isAvailable?: boolean;
};

type HealthKitAuthorizationPayload = {
  read?: string[];
  write?: string[];
};

type HealthKitQueryPayload = {
  startDate: string;
  endDate: string;
  dataType: 'steps';
};

type HealthKitPlugin = {
  isAvailable?: () => Promise<HealthKitAvailabilityResponse | boolean>;
  requestAuthorization?: (payload: HealthKitAuthorizationPayload) => Promise<unknown>;
  query?: (payload: HealthKitQueryPayload) => Promise<Array<{ value?: number }> | { value?: number }>;
};

const HealthKit = registerPlugin<HealthKitPlugin>('HealthKit');

const normalizeStepQueryResult = (result: unknown): number => {
  if (!result) return 0;

  if (Array.isArray(result)) {
    return Math.floor(result.reduce((sum: number, item: any) => sum + (Number(item?.value) || 0), 0));
  }

  if (typeof result === 'object' && result !== null && 'value' in result) {
    return Math.floor(Number((result as { value?: number }).value) || 0);
  }

  return 0;
};

export class IOSHealthProvider implements HealthProvider {
  source = 'apple_health' as const;
  label = 'Apple Health';

  isSupported(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      if (typeof HealthKit.isAvailable === 'function') {
        const availability = await HealthKit.isAvailable();
        if (typeof availability === 'boolean') return availability;
        if (availability && typeof availability === 'object') {
          if (typeof availability.available === 'boolean') return availability.available;
          if (typeof availability.isAvailable === 'boolean') return availability.isAvailable;
        }
      }

      return await Health.isAvailable();
    } catch (error) {
      console.error('iOS health availability check failed:', error);
      return false;
    }
  }

  async requestAuthorization(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      if (typeof HealthKit.requestAuthorization === 'function') {
        await HealthKit.requestAuthorization({
          read: ['steps'],
          write: []
        });
        return true;
      }

      await Health.requestAuthorization([
        {
          read: ['steps'],
          write: []
        }
      ]);
      return true;
    } catch (error) {
      console.error('iOS health authorization failed:', error);
      return false;
    }
  }

  async getTodaySteps(): Promise<number> {
    if (!this.isSupported()) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    try {
      if (typeof HealthKit.query === 'function') {
        const result = await HealthKit.query({
          startDate: today.toISOString(),
          endDate: now.toISOString(),
          dataType: 'steps'
        });

        return normalizeStepQueryResult(result);
      }

      const result = await Health.query({
        startDate: today,
        endDate: now,
        dataType: 'steps',
        limit: 1000
      });

      return normalizeStepQueryResult(result);
    } catch (error) {
      console.error('iOS step query failed:', error);
      return 0;
    }
  }
}
