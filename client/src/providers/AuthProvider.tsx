import { h, Component } from 'preact';
import AuthContext from '../contexts/AuthContext';
import { firebaseAuth } from '../services/firebaseService';
import firebase from 'firebase/compat/app';
import AuthUIService from '../services/AuthUIService';
import { successToast, errorToast } from '../components/utils';
import { SignInCallback } from '../contexts/AuthContext';

class AuthProvider extends Component {
    state = {
        user: null,
        isAuthenticated: false,
        isLoading: true,
    };

    unregisterAuthObserver: () => void;
    signInCallbacks: Set<SignInCallback> = new Set();

    componentDidMount() {
        this.unregisterAuthObserver = firebaseAuth.onAuthStateChanged(
            (user) => {
                this.setState({
                    user,
                    isAuthenticated: !!user,
                    isLoading: false,
                });
            }
        );
    }

    componentWillUnmount() {
        this.unregisterAuthObserver();
    }

    signInAsGuest = async (): Promise<firebase.User | null> => {
        try {
            if (firebaseAuth.currentUser && firebaseAuth.currentUser.isAnonymous) {
                return firebaseAuth.currentUser;
            }
            const credentials = await firebaseAuth.signInAnonymously();
            return credentials.user;
        } catch (error) {
            console.error("Error signing in as guest:", error);
            throw error;
        }
    };

    initFirebaseUI = (container: HTMLElement): void => {
        AuthUIService.initFirebaseUI(container, this.onSignInSuccess);
    };

    onSignInSuccess = async (authResult: any): Promise<void> => {
        successToast("Sign-in successful!");
        this.notifySignInCallbacks();
    };

    resetUI = (): void => {
        AuthUIService.resetUI();
    };

    addSignInCallback = (callback: SignInCallback): void => {
        this.signInCallbacks.add(callback);
    };

    removeSignInCallback = (callback: SignInCallback): void => {
        this.signInCallbacks.delete(callback);
    };

    notifySignInCallbacks = (): void => {
        this.signInCallbacks.forEach(callback => callback());
    };

    logout = () => {
        firebaseAuth.signOut().then(() => {
            AuthUIService.destroyUI();
        }).catch((error) => {
            console.error('Error signing out: ', error);
        });
    }

    render({ children }) {
        return (
            <AuthContext.Provider value={{ 
                ...this.state, 
                firebaseAuth,
                signInAsGuest: this.signInAsGuest,
                initFirebaseUI: this.initFirebaseUI,
                resetUI: this.resetUI,
                addSignInCallback: this.addSignInCallback,
                removeSignInCallback: this.removeSignInCallback,
                logout: this.logout,
            }}>
                {!this.state.isLoading && children}
            </AuthContext.Provider>
        );
    }
}

export default AuthProvider;