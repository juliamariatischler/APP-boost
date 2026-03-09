import { Capacitor, registerPlugin } from '@capacitor/core';
import { Health } from '@awesome-cordova-plugins/health';

export interface StepData {
  steps: number;
  date: Date;
}

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

export class HealthService {
  static isNativeIOS(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  }

  static isAppleHealthSupported(): boolean {
    return this.isNativeIOS();
  }

  private static async requestAuthorizationWithHealthKit(): Promise<boolean> {
    try {
      if (typeof HealthKit.requestAuthorization !== 'function') return false;
      await HealthKit.requestAuthorization({
        read: ['steps'],
        write: []
      });
      return true;
    } catch (error) {
      console.warn('HealthKit authorization fallback to Cordova plugin:', error);
      return false;
    }
  }

  static async requestAuthorization(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      console.log('Health Kit ist nur auf nativen Plattformen verfügbar');
      return true; // Return true for web to test UI
    }
    
    try {
      const healthKitAuthorized = await this.requestAuthorizationWithHealthKit();
      if (healthKitAuthorized) return true;

      await Health.requestAuthorization([
        {
          read: ['steps'],
          write: []
        }
      ]);
      return true;
    } catch (error) {
      console.error('Health authorization error:', error);
      return false;
    }
  }

  static async connectAppleHealth(): Promise<boolean> {
    if (!this.isAppleHealthSupported()) {
      return false;
    }

    const available = await this.isAvailable();
    if (!available) {
      return false;
    }

    return this.requestAuthorization();
  }

  private static normalizeStepQueryResult(result: unknown): number {
    if (!result) return 0;
    if (Array.isArray(result)) {
      return Math.floor(
        result.reduce((sum: number, item: any) => sum + (Number(item?.value) || 0), 0)
      );
    }

    if (typeof result === 'object' && result !== null && 'value' in result) {
      return Math.floor(Number((result as { value?: number }).value) || 0);
    }

    return 0;
  }

  private static async getTodayStepsWithHealthKit(today: Date, now: Date): Promise<number | null> {
    try {
      if (typeof HealthKit.query !== 'function') return null;

      const result = await HealthKit.query({
        startDate: today.toISOString(),
        endDate: now.toISOString(),
        dataType: 'steps'
      });

      return this.normalizeStepQueryResult(result);
    } catch (error) {
      console.warn('HealthKit query fallback to Cordova plugin:', error);
      return null;
    }
  }

  static async getTodaySteps(): Promise<number> {
    if (!Capacitor.isNativePlatform()) {
      // Consistent test data for web development
      console.log('Web-Modus: Zeige Test-Daten. Für echte Daten auf iPhone testen.');
      return 2456; // Consistent test value
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const now = new Date();

      const healthKitSteps = await this.getTodayStepsWithHealthKit(today, now);
      if (healthKitSteps !== null) {
        return healthKitSteps;
      }
      
      const result = await Health.query({
        startDate: today,
        endDate: now,
        dataType: 'steps',
        limit: 1000
      });

      if (result && Array.isArray(result)) {
        const totalSteps = result.reduce((sum: number, item: any) => {
          return sum + (item.value || 0);
        }, 0);
        return Math.floor(totalSteps);
      }
      
      return 0;
    } catch (error) {
      console.error('Error fetching steps:', error);
      return 0;
    }
  }

  static async isAvailable(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return true; // Return true for web to allow testing the UI
    }
    
    try {
      if (typeof HealthKit.isAvailable === 'function') {
        const healthKitAvailable = await HealthKit.isAvailable();
        if (typeof healthKitAvailable === 'boolean') {
          return healthKitAvailable;
        }
        if (typeof healthKitAvailable === 'object' && healthKitAvailable !== null) {
          if (typeof healthKitAvailable.available === 'boolean') {
            return healthKitAvailable.available;
          }
          if (typeof healthKitAvailable.isAvailable === 'boolean') {
            return healthKitAvailable.isAvailable;
          }
        }
      }

      const available = await Health.isAvailable();
      return available;
    } catch (error) {
      console.error('Health availability check error:', error);
      return false;
    }
  }
}
