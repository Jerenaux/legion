// LandingPage.tsx
import { h, Component } from 'preact';
// import firebase from 'firebase/compat/app';
// import * as firebaseui from 'firebaseui'
// import 'firebaseui/dist/firebaseui.css'

import Button from './Button';

class LandingPage extends Component {
  render() {
    return (
      <div className="landing-page">
        <img className="logo" src="assets/legionlogo.png" alt="Logo" />
        <Button label="PLAY" to="/play" />
      </div>
    );
  }
}

export default LandingPage;