import { h, Component } from 'preact';
import { route } from 'preact-router';
import AuthContext from '../contexts/AuthContext';

const withAuth = (WrappedComponent) => {
    return class extends Component {
        static contextType = AuthContext;

        componentDidMount() {
            console.log("#### MOUNTING WITHAUTH");
            const { isAuthenticated } = this.context;
            console.log(`Authenticated: ${isAuthenticated}`);
            if (!isAuthenticated) {
                // Redirect to landing page
                route('/'); 
            }
        }

        componentDidUpdate() {
            const { isAuthenticated } = this.context;
            console.log(`[updt] Authenticated: ${isAuthenticated}`);
            if (!isAuthenticated) {
                // Redirect to landing page
                route('/'); 
            }
        }

        render(props) {
            return <WrappedComponent {...props} />;
        }
    };
};

export default withAuth;
