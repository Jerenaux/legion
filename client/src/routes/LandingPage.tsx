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

    firebaseUIContainer = null;
    firebaseUI = null;

    showLoginOptions = () => {
        this.setState({ showLoginOptions: true }, this.initFirebaseUI);
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

        if (this.firebaseUIContainer) {
            try {
                this.firebaseUI = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(firebase.auth());
                this.firebaseUI.start(this.firebaseUIContainer, uiConfig);
            } catch (error) {
                console.error('Error initializing Firebase UI: ', error);
            }
        }
    };

    clearFirebaseUI = () => {
        if (this.firebaseUI) {
            this.firebaseUI.reset();
        }
        this.setState({ showLoginOptions: false });
    };

    render() {
        const { showLoginOptions } = this.state;

        return (
            <div className="landingPage">
                <div className="login-dialog">
                    <img src="logobig.png" alt="Logo" className="logo" />
                    {!showLoginOptions ? (
                        <div>
                            <div className="login-header"><br/><br/><br/>
                                <p>Assemble your team and become the strongest of the arena!</p>
                            </div>
                            <div className="login-buttons">
                                <button className="get-started" onClick={() => route('/tutorial')}>Get Started</button>
                                <button className="already-account" onClick={this.showLoginOptions}>Already have an account?</button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="login-header"><br/><br/><br/>
                                <p>Choose your sign in/up method</p>
                            </div>
                            <div ref={(ref) => this.firebaseUIContainer = ref} id="firebaseui-auth-container"></div>
                            <button className="back-button" onClick={this.clearFirebaseUI}>Back</button>
                        </div>
                    )}
                </div>
            </div>
        );
    }
}


export default LandingPage;