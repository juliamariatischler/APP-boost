import {
  getAndroidSensorStepsToday,
  isAndroidStepCounterSupported,
  requestAndroidStepPermission,
} from '../nativeStepCounter';
import { getHealthPlatformContext } from '../platform';
import type { HealthProvider, StepDiagnostics } from '../types';

/**
 * Android step provider backed by the on-device hardware step counter
 * (Sensor.TYPE_STEP_COUNTER via ACTIVITY_RECOGNITION). No Health Connect.
 */
export class AndroidHealthProvider implements HealthProvider {
  source = 'health_connect' as const;
  label = 'Schrittzähler';
  platform = 'android' as const;

  isSupported(): boolean {
    return getHealthPlatformContext().source === this.source;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      return await isAndroidStepCounterSupported();
    } catch (error) {
      console.error('Android step counter availability check failed:', error);
      return false;
    }
  }

  async requestAuthorization(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      return await requestAndroidStepPermission();
    } catch (error) {
      console.error('Android step permission request failed:', error);
      return false;
    }
  }

  async openHealthSettings(): Promise<void> {
    // No external app needed for the on-device sensor; nothing to open.
  }

  async getTodaySteps(): Promise<number> {
    if (!this.isSupported()) return 0;

    try {
      const steps = await getAndroidSensorStepsToday();
      return steps && steps > 0 ? steps : 0;
    } catch (error) {
      console.error('Android step query failed:', error);
      return 0;
    }
  }

  async getStepDiagnostics(): Promise<StepDiagnostics> {
    const todaySteps = await this.getTodaySteps();

    return {
      todaySteps,
      recentSteps: todaySteps,
      recentSources: ['Geräte-Sensor'],
    };
  }
}
