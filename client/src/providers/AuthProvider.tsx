import { h, Component } from 'preact';
import AuthContext from '../contexts/AuthContext';
import { firebaseAuth } from '../services/firebaseService';
import firebase from 'firebase/compat/app';

class AuthProvider extends Component {
    state = {
        user: null,
        isAuthenticated: false,
        isLoading: true,
    };

    unregisterAuthObserver: () => void;

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
        console.trace();
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

    render({ children }) {
        return (
            <AuthContext.Provider value={{ 
                ...this.state, 
                firebaseAuth,
                signInAsGuest: this.signInAsGuest
            }}>
                {!this.state.isLoading && children}
            </AuthContext.Provider>
        );
    }
}

export default AuthProvider;