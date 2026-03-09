import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.bd7a35c3bf0d4b5aa07c0391956b3e90',
  appName: 'lovable-school-stars',
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
