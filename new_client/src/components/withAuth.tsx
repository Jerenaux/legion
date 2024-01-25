import { h, Component } from 'preact';
import { route } from 'preact-router';
import AuthContext from '../contexts/AuthContext';

const withAuth = (WrappedComponent) => {
    return class extends Component {
        static contextType = AuthContext;

        componentDidMount() {
            const { isAuthenticated } = this.context;
            if (!isAuthenticated) {
                // Redirect to login or home page
                route('/login'); // Adjust as per your login route
            }
        }

        render(props) {
            return <WrappedComponent {...props} />;
        }
    };
};

export default withAuth;
