import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.bd7a35c3bf0d4b5aa07c0391956b3e90',
  appName: 'lovable-school-stars',
  webDir: 'dist',
  server: {
    url: 'https://bd7a35c3-bf0d-4b5a-a07c-0391956b3e90.lovableproject.com?forceHideBadge=true',
    cleartext: true
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
