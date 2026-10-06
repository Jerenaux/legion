import './telemetry';
import {fontsReady} from './i18n';
import { h } from 'preact';
import { render } from 'preact';

import 'shepherd.js/dist/css/shepherd.css';
import "toastify-js/src/toastify.css"
import './style/style.css';
import App from './app';
import {applyDisplaySettings, loadGameSettings} from './settings';
import {loadKeyboardLayout} from './input/bindings';
import {CONTROLS_CHANGED_EVENT} from './input/actions';
import {ErrorBoundary} from '@sentry/react';
import {CombatRecovery} from './components/CombatRecovery';

async function start() {
try {
  await Promise.all([fontsReady, document.fonts.load('16px Kim')]);
  applyDisplaySettings(loadGameSettings());
  // Key hints show the player's own layout once the browser reports it.
  void loadKeyboardLayout().then(() => window.dispatchEvent(new Event(CONTROLS_CHANGED_EVENT)));
  render(<ErrorBoundary fallback={({error}) => <CombatRecovery error={error} />}><App /></ErrorBoundary>, document.getElementById('root'));
  // console.log('React index.tsx: App rendered successfully');
} catch (error) {
  console.error('React index.tsx: Error rendering app:', error);
  render(<CombatRecovery error={error} />, document.getElementById('root'));
}

}
void start();

export default App;
