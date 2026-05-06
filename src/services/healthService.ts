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
    return this.provider.label;
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
}
