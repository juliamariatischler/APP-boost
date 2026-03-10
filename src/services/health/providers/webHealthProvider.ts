import type { HealthProvider } from '../types';

export class WebHealthProvider implements HealthProvider {
  source = 'none' as const;
  label = 'Keine Health-Daten';

  isSupported(): boolean {
    return true;
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async requestAuthorization(): Promise<boolean> {
    return false;
  }

  async getTodaySteps(): Promise<number> {
    return 0;
  }
}
