import { Capacitor } from '@capacitor/core';

export interface StepData {
  steps: number;
  date: Date;
}

// Mock implementation for web development - real implementation needs native build
export class HealthService {
  static async requestAuthorization(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      console.log('Health Kit ist nur auf nativen Plattformen verfügbar');
      return false;
    }
    
    try {
      // This will work when app is built as native iOS app
      // @ts-ignore - Health plugin will be available in native build
      if (window.plugins && window.plugins.healthkit) {
        // @ts-ignore
        return new Promise((resolve) => {
          // @ts-ignore
          window.plugins.healthkit.requestAuthorization({
            readTypes: ['HKQuantityTypeIdentifierStepCount']
          }, () => resolve(true), () => resolve(false));
        });
      }
      return false;
    } catch (error) {
      console.error('Health authorization error:', error);
      return false;
    }
  }

  static async getTodaySteps(): Promise<number> {
    if (!Capacitor.isNativePlatform()) {
      // Mock data for web development
      return Math.floor(Math.random() * 5000) + 1000;
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // @ts-ignore - Health plugin will be available in native build
      if (window.plugins && window.plugins.healthkit) {
        return new Promise((resolve) => {
          // @ts-ignore
          window.plugins.healthkit.querySampleType({
            sampleType: 'HKQuantityTypeIdentifierStepCount',
            startDate: today,
            endDate: new Date(),
            unit: 'count'
          }, (data: any) => {
            const totalSteps = data.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
            resolve(totalSteps);
          }, () => resolve(0));
        });
      }
      return 0;
    } catch (error) {
      console.error('Error fetching steps:', error);
      return 0;
    }
  }

  static async isAvailable(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      // Return true for web to allow testing the UI
      return true;
    }
    
    try {
      // @ts-ignore
      return !!(window.plugins && window.plugins.healthkit);
    } catch (error) {
      console.error('Health availability check error:', error);
      return false;
    }
  }
}
