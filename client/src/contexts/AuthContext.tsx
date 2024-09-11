import { createContext } from 'preact';
import firebase from 'firebase/compat/app';
import firebaseConfig from '@legion/shared/firebaseConfig';
import 'firebase/compat/auth';
import { firebaseAuth } from '../services/firebaseService'; 

// Initialize Firebase only once
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

interface AuthContextType {
    user: firebase.User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    firebaseAuth: typeof firebaseAuth;
    signInAsGuest: () => Promise<firebase.User | null>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    firebaseAuth,
    signInAsGuest: async () => {
        throw new Error('signInAsGuest not implemented');
    },
});

export default AuthContext;