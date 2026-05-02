import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'at.boostschule',
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
