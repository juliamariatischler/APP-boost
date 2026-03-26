import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.boostschule',
  appName: 'BoostSchule',
  webDir: 'dist',
  plugins: {
    HealthKit: {
      permissions: {
        read: ['steps', 'distance']
      }
    }
  }
};

export default config;
