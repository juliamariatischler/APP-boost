import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'at.boostschule.app',
  appName: 'BoostSchule',
  webDir: 'dist',
  server: {
    url: 'https://www.boostschule.at',
    cleartext: false
  },
  plugins: {
    HealthKit: {
      permissions: {
        read: ['steps', 'distance']
      }
    }
  }
};

export default config;
