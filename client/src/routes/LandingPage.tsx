import { h, Component } from 'preact';
import AuthContext from '../contexts/AuthContext';
import { route } from 'preact-router';

import firebase from 'firebase/compat/app'
import * as firebaseui from 'firebaseui'
import 'firebaseui/dist/firebaseui.css'
import 'firebase/compat/auth';

class LandingPage extends Component {
    static contextType = AuthContext;

    state = {
        showLoginOptions: false,
    };

    showLoginOptions = () => {
        this.setState({ showLoginOptions: true });
        this.initFirebaseUI();
    };

    initFirebaseUI = () => {
        const uiConfig = {
            signInFlow: 'popup',
            signInSuccessUrl: '/play',
            signInOptions: [
                firebase.auth.GoogleAuthProvider.PROVIDER_ID,
                firebase.auth.EmailAuthProvider.PROVIDER_ID,
            ],
        };

        try {
            const ui = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(firebase.auth());
            ui.start('#firebaseui-auth-container', uiConfig);
        } catch (error) {
            console.error('Error initializing Firebase UI: ', error);
        }
    }

    render() {
        const { showLoginOptions } = this.state;

        return (
            <div className="landingPage">
                {!showLoginOptions ? (
                    <div>
                        <button onClick={() => route('/tutorial')}>Proceed to Tutorial</button>
                        <button onClick={this.showLoginOptions}>Skip and Log In</button>
                    </div>
                ) : (
                    <div id="firebaseui-auth-container"></div>
                )}
            </div>
        );
    }
}

export default LandingPage;