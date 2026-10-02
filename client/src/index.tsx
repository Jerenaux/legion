import './telemetry';
import { h } from 'preact';
import { render } from 'preact';

import 'shepherd.js/dist/css/shepherd.css';
import "toastify-js/src/toastify.css"
import './style/style.css';
import App from './app';
import {applyTextSize, loadGameSettings} from './settings';
import {ErrorBoundary} from '@sentry/react';
import {CombatRecovery} from './components/CombatRecovery';

try {
  applyTextSize(loadGameSettings().textSize);
  render(<ErrorBoundary fallback={({error}) => <CombatRecovery error={error} />}><App /></ErrorBoundary>, document.getElementById('root'));
  // console.log('React index.tsx: App rendered successfully');
} catch (error) {
  console.error('React index.tsx: Error rendering app:', error);
  render(<CombatRecovery error={error} />, document.getElementById('root'));
}

export default App;
