import type { HealthProvider } from '../types';

export class WebHealthProvider implements HealthProvider {
  source = 'none' as const;
  label = 'Keine Health-Daten';
  platform = 'web' as const;

  isSupported(): boolean {
    return false;
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
