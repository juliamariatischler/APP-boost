import { Capacitor } from '@capacitor/core';
import { Health } from '@awesome-cordova-plugins/health';

export interface StepData {
  steps: number;
  date: Date;
}

export class HealthService {
  static async requestAuthorization(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      console.log('Health Kit ist nur auf nativen Plattformen verfügbar');
      return true; // Return true for web to test UI
    }
    
    try {
      await Health.requestAuthorization([
        {
          read: ['steps'],
          write: []
        }
      ]);
      return true;
    } catch (error) {
      console.error('Health authorization error:', error);
      return false;
    }
  }

  static async getTodaySteps(): Promise<number> {
    if (!Capacitor.isNativePlatform()) {
      // Consistent test data for web development
      console.log('Web-Modus: Zeige Test-Daten. Für echte Daten auf iPhone testen.');
      return 2456; // Consistent test value
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const now = new Date();
      
      const result = await Health.query({
        startDate: today,
        endDate: now,
        dataType: 'steps',
        limit: 1000
      });

      if (result && Array.isArray(result)) {
        const totalSteps = result.reduce((sum: number, item: any) => {
          return sum + (item.value || 0);
        }, 0);
        return Math.floor(totalSteps);
      }
      
      return 0;
    } catch (error) {
      console.error('Error fetching steps:', error);
      return 0;
    }
  }

  static async isAvailable(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return true; // Return true for web to allow testing the UI
    }
    
    try {
      const available = await Health.isAvailable();
      return available;
    } catch (error) {
      console.error('Health availability check error:', error);
      return false;
    }
  }
}
