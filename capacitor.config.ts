import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agentes.zamtools',
  appName: 'ZamTools',
  webDir: 'public',
  bundledWebRuntime: false,
  server: {
    url: 'https://yanweb.builders/',
    cleartext: true
  }
};

export default config;
