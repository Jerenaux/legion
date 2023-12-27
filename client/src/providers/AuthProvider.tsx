import { h, Component } from 'preact';
import AuthContext from '../contexts/AuthContext';
import { firebaseAuth } from '../services/firebaseService'; 

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

    render({ children }) {
        return (
            <AuthContext.Provider value={{ ...this.state, firebaseAuth }}>
                {!this.state.isLoading && children}
            </AuthContext.Provider>
        );
    }
}

export default AuthProvider;
