import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agentes.zamtools',
  appName: 'ZamTools',
  webDir: 'public',
  server: {
    url: 'https://yanweb.builders/',
    cleartext: true,
    errorPath: 'index.html',
    allowNavigation: [
      'accounts.google.com',
      '*.clerk.accounts.dev',
      'clerk.yanweb.builders',
      'yanweb.builders',
      'www.yanweb.builders',
      '*.yanweb.builders'
    ]
  },
  android: {
    overrideUserAgent: "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36"
  }
};

export default config;
