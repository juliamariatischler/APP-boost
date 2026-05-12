import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'at.boostschule',
  appName: 'BoostSchule',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
  },
  plugins: {
    HealthKit: {
      permissions: {
        read: ['steps', 'distance']
      }
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#f8f5f1',
      showSpinner: false,
    },
  },
};

export default config;
