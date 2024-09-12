import { createContext } from 'preact';
import firebase from 'firebase/compat/app';
import firebaseConfig from '@legion/shared/firebaseConfig';
import 'firebase/compat/auth';
import { firebaseAuth } from '../services/firebaseService'; 

// Initialize Firebase only once
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

export type SignInCallback = () => void;

interface AuthContextType {
    user: firebase.User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    firebaseAuth: typeof firebaseAuth;
    signInAsGuest: () => Promise<firebase.User | null>;
    initFirebaseUI: (container: HTMLElement) => void;
    resetUI: () => void;
    addSignInCallback: (callback: SignInCallback) => void;
    removeSignInCallback: (callback: SignInCallback) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    firebaseAuth,
    signInAsGuest: async () => {
        throw new Error('signInAsGuest not implemented');
    },
    initFirebaseUI: () => {
        throw new Error('initFirebaseUI not implemented');
    },
    resetUI: () => {
        throw new Error('resetUI not implemented');
    },
    addSignInCallback: () => {
        throw new Error('addSignInCallback not implemented');
    },
    removeSignInCallback: () => {
        throw new Error('removeSignInCallback not implemented');
    },
    logout: () => {
        throw new Error('logout not implemented');
    },
});

export default AuthContext;