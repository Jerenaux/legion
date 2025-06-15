import { h, render } from 'preact';

import 'shepherd.js/dist/css/shepherd.css';
import "toastify-js/src/toastify.css"
import './style/style.css';
import App from './app';

try {
  render(<App />, document.getElementById('root'));
  // console.log('React index.tsx: App rendered successfully');
} catch (error) {
  console.error('React index.tsx: Error rendering app:', error);
}

export default App;
