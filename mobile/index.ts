import { registerNotificationBackgroundTask } from './src/lib/push/backgroundTask';
import { registerRootComponent } from 'expo';

import App from './App';

// Categories + headless action handler must register before the UI tree mounts.
registerNotificationBackgroundTask();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
