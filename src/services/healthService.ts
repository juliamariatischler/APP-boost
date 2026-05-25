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

  private static isLikelySamsungDevice(): boolean {
    if (typeof navigator === 'undefined') return false;

    const userAgent = navigator.userAgent || '';
    return /samsung|sm-|samsm|galaxy/i.test(userAgent);
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
    if (this.isNativeAndroid() && this.isLikelySamsungDevice()) {
      return 'Samsung Health';
    }

    return this.provider.label;
  }

  static getHealthConnectionLabel(): string {
    if (this.isNativeAndroid() && this.isLikelySamsungDevice()) {
      return 'Samsung Health verbinden';
    }

    return 'Health-Daten verbinden';
  }

  static getHealthSetupDescription(): string {
    if (this.isNativeAndroid() && this.isLikelySamsungDevice()) {
      return 'BOOST liest deine Samsung-Schritte ueber Health Connect. Erlaube Samsung Health dort, Schritte zu teilen.';
    }

    if (this.isNativeAndroid()) {
      return 'BOOST liest deine Schritte ueber Health Connect. Erlaube dort den Zugriff auf Schritte.';
    }

    if (this.isNativeIOS()) {
      return 'Verbinde Apple Health, damit echte Schritte automatisch in BOOST landen.';
    }

    return 'Health-Sync ist in der mobilen App verfuegbar.';
  }

  static getHealthPermissionHelp(): string {
    if (this.isNativeAndroid() && this.isLikelySamsungDevice()) {
      return 'Oeffne Samsung Health und erlaube dort Health Connect. Danach BOOST erneut verbinden.';
    }

    if (this.isNativeAndroid()) {
      return 'Oeffne Health Connect und erlaube BOOST den Zugriff auf Schritte.';
    }

    return 'Bitte erlaube den Zugriff in den Einstellungen.';
  }

  static async getNoStepDataHelp(): Promise<string> {
    const diagnostics = await this.provider.getStepDiagnostics?.().catch((error) => {
      console.error('Health step diagnostics failed:', error);
      return null;
    });

    if (diagnostics && this.isNativeAndroid()) {
      if (diagnostics.recentSteps === 0) {
        return 'BOOST darf lesen, aber Health Connect hat keine Schrittdaten. Oeffne Health Connect und pruefe unter Schritte, ob dort Schritte angezeigt werden.';
      }

      const sources = diagnostics.recentSources.length > 0
        ? ` Quellen: ${diagnostics.recentSources.join(', ')}.`
        : '';
      return `Health Connect hat ${diagnostics.recentSteps.toLocaleString('de-DE')} Schritte in den letzten 7 Tagen, aber heute 0.${sources}`;
    }

    if (this.isNativeAndroid() && this.isLikelySamsungDevice()) {
      return 'Samsung Health zeigt Schritte, aber Health Connect noch nicht. Oeffne Samsung Health und erlaube das Teilen von Schritten mit Health Connect.';
    }

    if (this.isNativeAndroid()) {
      return 'Health Connect hat noch keine Schritte fuer heute. Pruefe, ob deine Schritt-App Schritte an Health Connect sendet.';
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

  static async openHealthConnectStore(): Promise<void> {
    return this.provider.openHealthConnectStore?.();
  }

  static async openHealthSettings(): Promise<void> {
    return this.provider.openHealthSettings?.();
  }
}
