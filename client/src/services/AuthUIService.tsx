import firebase from 'firebase/compat/app';
import * as firebaseui from 'firebaseui';
import 'firebaseui/dist/firebaseui.css';
import 'firebase/compat/auth';
import { successToast, errorToast } from '../components/utils';

class AuthUIService {
  private firebaseUI: firebaseui.auth.AuthUI | null = null;

  getUI(): firebaseui.auth.AuthUI {
    if (!this.firebaseUI) {
      try {
        this.firebaseUI = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(firebase.auth());
      } catch (error) {
        console.error('Error getting Firebase UI instance:', error);
        throw error;
      }
    }
    return this.firebaseUI;
  }

  initFirebaseUI(container: HTMLElement, onSignInSuccess: (authResult: any) => void): void {
    const uiConfig: firebaseui.auth.Config = {
      autoUpgradeAnonymousUsers: true,
      signInFlow: 'popup',
      signInSuccessUrl: '/play',
      signInOptions: [
        firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        {
            provider: firebase.auth.EmailAuthProvider.PROVIDER_ID,
            requireDisplayName: false
        },
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
      const ui = this.getUI();
      ui.start(container, uiConfig);
    } catch (error) {
      console.error('Error initializing Firebase UI: ', error);
      errorToast("An error occurred while initializing the sign-in interface. Please try again.");
    }
  }

  resetUI(): void {
    if (this.firebaseUI) {
      this.firebaseUI.reset();
    }
  }

  destroyUI(): void {
    if (this.firebaseUI) {
      this.firebaseUI.delete();
      this.firebaseUI = null;
    }
  }
}

export default new AuthUIService();