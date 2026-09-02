import {Component, ComponentType, h} from "preact";
import AuthContext from "../contexts/AuthContext";

interface WithAuthProps {
  path: string;
  matches?: {id?: string};
}

const withAuth = <P extends object>(WrappedComponent: ComponentType<P>) => class extends Component<P & WithAuthProps> {
  static contextType = AuthContext;

  render() {
    return this.context.isAuthenticated ? <WrappedComponent {...this.props} /> : null;
  }
};

export default withAuth;
