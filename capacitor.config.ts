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
    // Se actualiza el User Agent a Chrome 129 para evitar Error 400/403 en OAuth de Google
    overrideUserAgent: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.70 Mobile Safari/537.36"
  }
};

export default config;
