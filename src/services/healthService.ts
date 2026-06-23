import { getPlatformRuntime } from './platform/runtime';
import { createHealthProvider } from './health/providerFactory';

export interface StepData {
  steps: number;
  date: Date;
}

export class HealthService {
  private static get provider() {
    return createHealthProvider();
  }

  static isNativeIOS(): boolean {
    return getPlatformRuntime().platform === 'ios';
  }

  static isNativeAndroid(): boolean {
    return getPlatformRuntime().platform === 'android';
  }

  static isAppleHealthSupported(): boolean {
    return this.provider.source === 'apple_health';
  }

  static isGoogleFitSupported(): boolean {
    return this.provider.source === 'health_connect';
  }

  static isHealthPlatformSupported(): boolean {
    return this.provider.source !== 'none';
  }

  static getHealthSourceLabel(): string {
    if (this.isNativeAndroid()) {
      return 'Schrittzähler';
    }

    return this.provider.label;
  }

  static getHealthConnectionLabel(): string {
    if (this.isNativeAndroid()) {
      return 'Schrittzähler aktivieren';
    }

    return 'Health-Daten verbinden';
  }

  static getHealthSetupDescription(): string {
    if (this.isNativeAndroid()) {
      return 'BOOST zaehlt deine Schritte ueber den Schrittzaehler deines Geraets. Erlaube den Zugriff auf koerperliche Aktivitaet.';
    }

    if (this.isNativeIOS()) {
      return 'Verbinde Apple Health, damit echte Schritte automatisch in BOOST landen.';
    }

    return 'Health-Sync ist in der mobilen App verfuegbar.';
  }

  static getHealthPermissionHelp(): string {
    if (this.isNativeAndroid()) {
      return 'Erlaube BOOST in den Einstellungen den Zugriff auf koerperliche Aktivitaet, damit Schritte gezaehlt werden.';
    }

    return 'Bitte erlaube den Zugriff in den Einstellungen.';
  }

  static async getNoStepDataHelp(): Promise<string> {
    if (this.isNativeAndroid()) {
      return 'Der Schrittzaehler hat heute noch keine Schritte erfasst. Trage dein Telefon bei dir und erlaube BOOST den Zugriff auf koerperliche Aktivitaet.';
    }

    return 'Es wurden noch keine Schritte fuer heute gefunden.';
  }

  static getPlatformLabel(): string {
    switch (this.provider.platform) {
      case 'ios':
        return 'iOS';
      case 'android':
        return 'Android';
      default:
        return 'Web';
    }
  }

  static async requestAuthorization(): Promise<boolean> {
    if (!this.isHealthPlatformSupported()) {
      return false;
    }

    return this.provider.requestAuthorization();
  }

  static async connectAppleHealth(): Promise<boolean> {
    if (!this.isAppleHealthSupported()) {
      return false;
    }

    return this.connectHealthData();
  }

  static async connectHealthData(): Promise<boolean> {
    if (!this.isHealthPlatformSupported()) {
      return false;
    }

    return this.provider.requestAuthorization();
  }

  static async getTodaySteps(): Promise<number> {
    if (!this.isHealthPlatformSupported()) {
      return 0;
    }

    return this.provider.getTodaySteps();
  }

  static async isAvailable(): Promise<boolean> {
    if (!this.isHealthPlatformSupported()) {
      return false;
    }

    return this.provider.isAvailable();
  }

  static async openHealthSettings(): Promise<void> {
    return this.provider.openHealthSettings?.();
  }
}
