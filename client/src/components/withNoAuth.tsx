import { h, Component } from 'preact';
import { route } from 'preact-router';
import AuthContext from '../contexts/AuthContext';

const withNoAuth = (WrappedComponent) => {
    return class extends Component {
        static contextType = AuthContext;

        componentDidMount() {
            const { isAuthenticated } = this.context;
            if (isAuthenticated) {
                route('/play'); 
            }
        }

        componentDidUpdate() {
            const { isAuthenticated } = this.context;
            if (isAuthenticated) {
                route('/play'); 
            }
        }

        render(props) {
            return <WrappedComponent {...props} />;
        }
    };
};

export default withNoAuth;
