import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'at.boostschule',
  appName: 'BoostSchule',
  webDir: 'dist',
  ios: {
    // Use automatic safe-area inset handling
    contentInset: 'automatic',
  },
  plugins: {
    HealthKit: {
      permissions: {
        read: ['steps', 'distance']
      }
    },
    SplashScreen: {
      // Hold native splash while JS bundle loads, then auto-hide
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
  },
};

export default config;
