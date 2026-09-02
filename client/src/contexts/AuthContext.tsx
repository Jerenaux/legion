import {createContext} from "preact";
import firebase from "firebase/compat/app";

interface AuthContextType {
    user: firebase.User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    retrySession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    retrySession: async () => undefined,
});

export default AuthContext;
