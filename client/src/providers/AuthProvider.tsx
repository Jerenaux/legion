import { h, Component } from 'preact';
import AuthContext from '../contexts/AuthContext';
import { firebaseAuth } from '../services/firebaseService';
import firebase from 'firebase/compat/app';
import AuthUIService from '../services/AuthUIService';
import { successToast, errorToast } from '../components/utils';
import { SignInCallback } from '../contexts/AuthContext';
import { apiFetch } from '../services/apiService';

class AuthProvider extends Component {
    state = {
        user: null,
        isAuthenticated: false,
        isLoading: true,
        utmSource: null,
    };

    unregisterAuthObserver: () => void;
    signInCallbacks: Set<SignInCallback> = new Set();

    componentDidMount() {
        this.unregisterAuthObserver = firebaseAuth.onAuthStateChanged(
            (user) => {
                // console.log(`Auth state changed: ${user ? 'logged in' : 'logged out'}`);
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
            
            if (this.state.utmSource && credentials.user) {
                apiFetch('setUtmSource', {
                    method: 'POST',
                    body: {
                        utmSource: this.state.utmSource
                    }
                });
            }
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
        if (this.state.utmSource && authResult.user) {
            try {
                apiFetch('setUtmSource', {
                    method: 'POST',
                    body: {
                        utmSource: this.state.utmSource
                    }
                });
            } catch (error) {
                console.error("Error saving UTM source:", error);
            }
        }
        
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

    setUtmSource = async (utmSource: string): Promise<void> => {
        this.setState({ utmSource });
        
        if (this.state.user) {
            try {
                apiFetch('setUtmSource', {
                    method: 'POST',
                    body: {
                        utmSource
                    }
                });
            } catch (error) {
                console.error("Error saving UTM source:", error);
            }
        }
    };

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
                setUtmSource: this.setUtmSource,
            }}>
                {!this.state.isLoading && children}
            </AuthContext.Provider>
        );
    }
}

export default AuthProvider;