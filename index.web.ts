import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

// Skia's web module reads global.CanvasKit at import time, so App (and anything
// importing @shopify/react-native-skia) must only be loaded after CanvasKit is ready.
LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }).then(async () => {
  const { default: App } = await import('./App');
  registerRootComponent(App);
});
