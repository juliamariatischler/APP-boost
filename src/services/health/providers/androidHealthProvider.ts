import { callCordovaHealth } from '../cordovaHealth';
import { getAndroidHealthConnectSteps, getAndroidSensorStepsToday } from '../nativeStepCounter';
import { getHealthPlatformContext } from '../platform';
import type { HealthProvider, StepDiagnostics } from '../types';

const normalizeSteps = (result: unknown): number => {
  const items = Array.isArray(result) ? result : [result];

  return Math.floor(
    items.reduce((sum: number, item: any) => {
      return sum + (Number(item?.value) || 0);
    }, 0)
  );
};

const extractSources = (result: unknown): string[] => {
  const items = Array.isArray(result) ? result : [result];
  const sources = items
    .map((item: any) => String(item?.sourceBundleId || '').trim())
    .filter(Boolean);

  return Array.from(new Set(sources));
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
      await callCordovaHealth('isAvailable');
      return true;
    } catch (error) {
      console.error('Android health availability check failed:', error);
      return false;
    }
  }

  async requestAuthorization(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      await callCordovaHealth('isAvailable');
      const authorized = await callCordovaHealth<boolean>('requestAuthorization', { read: ['steps'], write: [] });
      return authorized === true;
    } catch (error) {
      console.error('Android health authorization failed:', error);

      if (typeof error === 'string' && error.toLowerCase().includes('not installed')) {
        await this.openHealthConnectStore();
      }

      return false;
    }
  }

  async openHealthConnectStore(): Promise<void> {
    try {
      await callCordovaHealth('getHealthConnectFromStore');
    } catch (error) {
      console.error('Opening Health Connect store page failed:', error);
    }
  }

  async openHealthSettings(): Promise<void> {
    try {
      await callCordovaHealth('openHealthSettings');
    } catch (error) {
      console.error('Opening Health settings failed:', error);
    }
  }

  async getTodaySteps(): Promise<number> {
    if (!this.isSupported()) return 0;

    try {
      // 1. Direct HC SDK query via Capacitor plugin (most reliable, bypasses Cordova bridge)
      const todayRange = this.getTodayRange();
      const directHcSteps = await getAndroidHealthConnectSteps(todayRange.startDate.getTime(), todayRange.endDate.getTime());
      if (directHcSteps !== null && directHcSteps > 0) {
        console.log('Android Health Connect direct steps result:', directHcSteps);
        return directHcSteps;
      }

      // 2. Cordova bridge HC query (today)
      const healthConnectSteps = await this.queryStepsForRange(todayRange);
      if (healthConnectSteps > 0) return healthConnectSteps;

      // 3. Cordova bridge HC query (last 24h)
      const recentHealthConnectSteps = await this.queryStepsForRange(this.getLast24HoursRange());
      if (recentHealthConnectSteps > 0) {
        console.log('Android Health Connect last 24 hours fallback result:', recentHealthConnectSteps);
        return recentHealthConnectSteps;
      }

      // 4. Device sensor step counter
      const sensorSteps = await getAndroidSensorStepsToday();
      if (sensorSteps !== null) {
        console.log('Android device step counter fallback result:', sensorSteps);
        return sensorSteps;
      }

      return 0;
    } catch (error) {
      console.error('Android step query failed:', error);
      return 0;
    }
  }

  async getStepDiagnostics(): Promise<StepDiagnostics> {
    const todayRange = this.getTodayRange();
    const recentEnd = new Date(todayRange.endDate);
    const recentStart = new Date(todayRange.startDate);
    recentStart.setDate(recentStart.getDate() - 6);

    const todaySteps = await this.queryStepsForRange(todayRange);
    const recentRaw = await callCordovaHealth('query', {
      startDate: recentStart,
      endDate: recentEnd,
      dataType: 'steps',
      limit: 5000,
    });

    return {
      todaySteps,
      recentSteps: normalizeSteps(recentRaw),
      recentSources: extractSources(recentRaw),
    };
  }

  private getTodayRange() {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }

  private getLast24HoursRange() {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

    return { startDate, endDate };
  }

  private async queryStepsForRange(range: { startDate: Date; endDate: Date }): Promise<number> {
    const aggregated = await callCordovaHealth('queryAggregated', {
      startDate: range.startDate,
      endDate: range.endDate,
      dataType: 'steps',
    });
    console.log('Android Health Connect aggregated steps result:', aggregated);
    const aggregatedSteps = normalizeSteps(aggregated);
    if (aggregatedSteps > 0) return aggregatedSteps;

    const result = await callCordovaHealth('query', {
      startDate: range.startDate,
      endDate: range.endDate,
      dataType: 'steps',
      limit: 1000,
    });

    console.log('Android Health Connect raw steps result:', result);
    return normalizeSteps(result);
  }
}
