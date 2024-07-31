import { h, render } from 'preact';

import 'shepherd.js/dist/css/shepherd.css';
import './style/style.css';
import App from './app';

render(<App />, document.getElementById('root'));

export default App;
