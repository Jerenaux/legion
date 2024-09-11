import firebase from 'firebase/compat/app';
import * as firebaseui from 'firebaseui';
import 'firebaseui/dist/firebaseui.css';
import 'firebase/compat/auth';
import { route } from 'preact-router';
import { successToast, errorToast } from '../components/utils';

class AuthUIService {
  private firebaseUI: firebaseui.auth.AuthUI | null = null;

  initFirebaseUI(container: HTMLElement, onSignInSuccess: (authResult: any) => void): void {
    const uiConfig: firebaseui.auth.Config = {
      autoUpgradeAnonymousUsers: true,
      signInFlow: 'popup',
      signInSuccessUrl: '/play',
      signInOptions: [
        firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        firebase.auth.EmailAuthProvider.PROVIDER_ID,
      ],
      callbacks: {
        signInSuccessWithAuthResult: (authResult: any) => {
          onSignInSuccess(authResult);
          return false; // Prevent FirebaseUI from redirecting
        },
        signInFailure: (error: any) => {
          console.error("Sign-in error:", error);
          errorToast("An error occurred during sign-in. Please try again.");
        }
      }
    };

    try {
      this.firebaseUI = new firebaseui.auth.AuthUI(firebase.auth());
      this.firebaseUI.start(container, uiConfig);
    } catch (error) {
      console.error('Error initializing Firebase UI: ', error);
    }
  }

  resetUI(): void {
    if (this.firebaseUI) {
      this.firebaseUI.reset();
    }
  }
}

export default new AuthUIService();