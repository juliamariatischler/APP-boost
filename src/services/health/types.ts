export type HealthSource = 'apple_health' | 'health_connect' | 'none';

export interface StepDiagnostics {
  todaySteps: number;
  recentSteps: number;
  recentSources: string[];
}

export interface HealthProvider {
  source: HealthSource;
  label: string;
  platform: 'ios' | 'android' | 'web';
  isSupported(): boolean;
  isAvailable(): Promise<boolean>;
  requestAuthorization(): Promise<boolean>;
  getTodaySteps(): Promise<number>;
  getStepDiagnostics?(): Promise<StepDiagnostics>;
  openHealthSettings?(): Promise<void>;
}
