import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agentes.zamtools',
  appName: 'ZamTools',
  webDir: 'public',
  server: {
    url: 'https://yanweb.builders/',
    cleartext: true,
    allowNavigation: [
      'accounts.google.com',
      '*.clerk.accounts.dev',
      'clerk.yanweb.builders',
      '*.yanweb.builders'
    ]
  }
};

export default config;
