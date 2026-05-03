export type HealthSource = 'apple_health' | 'health_connect' | 'none';

export interface HealthProvider {
  source: HealthSource;
  label: string;
  platform: 'ios' | 'android' | 'web';
  isSupported(): boolean;
  isAvailable(): Promise<boolean>;
  requestAuthorization(): Promise<boolean>;
  getTodaySteps(): Promise<number>;
}
