import { h, Component, Fragment } from 'preact';
import firebase from 'firebase/compat/app';
import * as firebaseui from 'firebaseui';
import 'firebaseui/dist/firebaseui.css';
import 'firebase/compat/auth';
import './Welcome.style.css';
import logoBig from '@assets/logobig.png';
import { successToast, errorToast } from '../utils';

interface WelcomeProps {
  onHide: () => void;
}

interface WelcomeState {
  showLoginOptions: boolean;
}

class Welcome extends Component<WelcomeProps, WelcomeState> {
  state: WelcomeState = {
    showLoginOptions: false,
  };

  private firebaseUIContainer: HTMLDivElement | null = null;
  private firebaseUI: firebaseui.auth.AuthUI | null = null;
  private initialUser: firebase.User | null = null;

  componentDidMount() {
    // Store the initial user state
    this.initialUser = firebase.auth().currentUser;
    console.log(`Initial user state: ${this.initialUser?.isAnonymous ? 'anonymous' : 'signed in'}`);
  }

  showLoginOptions = (): void => {
    this.setState({ showLoginOptions: true }, this.initFirebaseUI);
  };

  initFirebaseUI = (): void => {
    const uiConfig: firebaseui.auth.Config = {
      signInFlow: 'popup',
      signInSuccessUrl: '/play',
      signInOptions: [
        firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        firebase.auth.EmailAuthProvider.PROVIDER_ID,
      ],
      callbacks: {
        signInSuccessWithAuthResult: this.onSignInSuccess
      }
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

  onSignInSuccess = (authResult: any, redirectUrl?: string): boolean => {
    console.log(`Processing sign in success, initial user was anonymous = ${this.initialUser?.isAnonymous}`);
    
    // Handle the sign-in process asynchronously
    this.handleSignInProcess(authResult).catch(error => {
      console.error("Error in sign-in process:", error);
      errorToast("An error occurred during sign-in. Please try again.");
    });

    // Hide the welcome component
    this.props.onHide();
    
    // Prevent FirebaseUI from redirecting
    return false;
  };

  handleSignInProcess = async (authResult: any): Promise<void> => {
    if (this.initialUser?.isAnonymous) {
      const credential = authResult.credential;
      
      try {
        const usercred = await this.initialUser.linkWithCredential(credential);
        const user = usercred.user;
        console.log("Anonymous account successfully upgraded", user);
        successToast("Account successfully created!");
      } catch (error: any) {
        console.error("Error upgrading anonymous account", error);
        
        if (error.code === 'auth/credential-already-in-use') {
          console.warn("Credential already in use. This might be due to emulator behavior.");
          try {
            await firebase.auth().signInWithCredential(credential);
            console.log("Signed in with existing credential");
            successToast("Signed in successfully!");
          } catch (signInError) {
            console.error("Error signing in with existing credential", signInError);
            errorToast("Error signing in. Please try again.");
          }
        } else {
          errorToast("Error creating account. Please try again.");
        }
      }
    } else {
      console.log("User signed in (not an upgrade from anonymous)");
      successToast("Sign-in successful!");
    }
    
    console.log("Sign-in process completed");
  };

  // New method to get anonymous user data
  getAnonymousUserData = async (anonymousUser: firebase.User): Promise<any> => {
    // Implement this method to retrieve the anonymous user's data
    // This could involve fetching data from Firestore or your backend
    // Return the data that needs to be merged
    return {};  // Placeholder
  };

  // New method to merge user data
  mergeUserData = async (anonymousUserData: any): Promise<void> => {
    // Implement this method to merge the anonymous user's data with the existing account
    // This could involve updating Firestore documents or your backend
    console.log("Merging user data:", anonymousUserData);
  };

  clearLoginOptions = (): void => {
    if (this.firebaseUI) {
      this.firebaseUI.reset();
    }
    this.setState({ showLoginOptions: false });
  };

  handleExplore = (): void => {
    this.props.onHide();
  };

  render() {
    const { showLoginOptions } = this.state;

    return (
      <div className="welcome-overlay">
        <div className="welcome-dialog">
          <img src={logoBig} alt="Logo" className="welcome-logo" />
          <div className="dialog-content">
            <h1 className="welcome-text">Welcome to Legion!</h1>
            {!showLoginOptions ? (
              <Fragment>
                <div className="login-header">
                  Play freely without an account, or create one at any time to save your progress.
                </div>
                <div className="login-buttons">
                  <button className="sign-up-btn" onClick={this.showLoginOptions}>Sign Up</button>
                  <button className="explore-btn" onClick={this.handleExplore}>Keep exploring</button>
                </div>
              </Fragment>
            ) : (
              <Fragment>
                <div className="login-header">
                  Choose your sign up method
                </div>
                <div ref={(ref) => this.firebaseUIContainer = ref} id="firebaseui-auth-container"></div>
                <button className="back-button" onClick={this.clearLoginOptions}>Back</button>
              </Fragment>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default Welcome;