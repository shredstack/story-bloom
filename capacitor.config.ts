import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const isProduction = process.env.NODE_ENV === 'production';

// Allow pointing at a LAN dev server for on-device testing:
//   CAPACITOR_SERVER_URL=http://192.168.1.50:3000 npx cap sync ios
const serverUrl =
  process.env.CAPACITOR_SERVER_URL || 'https://story-bloom.shredstack.net';

const config: CapacitorConfig = {
  appId: 'com.shredstack.storybloom', // reverse-DNS; matches FuelRx's com.shredstack.* — STABLE FOREVER
  appName: 'StoryBloom',
  webDir: 'out', // minimal offline-fallback only (see scripts/build-mobile.sh)

  server: {
    url: serverUrl,
    cleartext: !isProduction, // allow http:// only for LAN dev
    // iOS allows the hosted https origin to set/read cookies normally
  },

  ios: {
    contentInset: 'never', // we manage safe areas via CSS; want edge-to-edge games
    preferredContentMode: 'mobile',
    backgroundColor: '#ffffff', // app is a light near-white theme — white avoids a dark flash
    allowsLinkPreview: false, // no long-press link preview for kids
    scrollEnabled: true,
  },

  android: {
    backgroundColor: '#ffffff',
    allowMixedContent: !isProduction,
    captureInput: true,
    webContentsDebuggingEnabled: !isProduction,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false, // we hide it from JS once the app is ready
      backgroundColor: '#ffffff', // matches the app's near-white background
      androidSplashResourceName: 'splash',
      splashImmersive: true, // splash hides system bars too
    },
    StatusBar: {
      style: 'light', // Capacitor Style.Light = DARK text/icons, for our LIGHT background
      backgroundColor: '#ffffff',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: KeyboardResize.Body,
      resizeOnFullScreen: true,
    },
  },
};

export default config;
