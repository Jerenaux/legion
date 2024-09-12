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
        const initialUser = this.state.user;
        
        if (initialUser?.isAnonymous) {
            const credential = authResult.credential;
            
            try {
                const usercred = await initialUser.linkWithPopup(); 
                const user = usercred.user;
                console.log("Anonymous account successfully upgraded", user);
                successToast("Account successfully created!");
            } catch (error: any) {
                console.error("Error upgrading anonymous account", error);
                
                if (error.code === 'auth/credential-already-in-use') {
                    console.warn("Credential already in use.");
                    try {
                        await firebase.auth().signInWithCredential(credential);
                        // console.log("Signed in with existing credential");
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
            // successToast("Sign-in successful!");
        }
        
        // console.log("Sign-in process completed");
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