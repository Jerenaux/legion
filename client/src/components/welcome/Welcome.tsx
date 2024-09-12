import { h, Component, Fragment } from 'preact';
import AuthContext from '../../contexts/AuthContext';
import './Welcome.style.css';
import logoBig from '@assets/logobig.png';

interface WelcomeProps {
  onHide: () => void;
}

interface WelcomeState {
  showLoginOptions: boolean;
}

class Welcome extends Component<WelcomeProps, WelcomeState> {
  static contextType = AuthContext;

  state: WelcomeState = {
    showLoginOptions: false,
  };

  private firebaseUIContainer: HTMLDivElement | null = null;

  componentDidMount() {
    this.context.addSignInCallback(this.handleSignInSuccess);
  }

  componentWillUnmount() {
    this.context.removeSignInCallback(this.handleSignInSuccess);
  }
  
  handleSignInSuccess = () => {
    this.props.onHide();
  };

  showLoginOptions = (): void => {
    this.setState({ showLoginOptions: true }, () => {
      if (this.firebaseUIContainer) {
        this.context.initFirebaseUI(this.firebaseUIContainer);
      }
    });
  };

  clearLoginOptions = (): void => {
    this.context.resetUI();
    this.setState({ showLoginOptions: false });
  };

  handleExplore = (): void => {
    this.props.onHide();
  };

  render() {
    const { showLoginOptions } = this.state;

    return (
      <div className="welcome-overlay">
        <div className="welcome-dialog">
          <img src={logoBig} alt="Logo" className="welcome-logo" />
          <div className="dialog-content">
            <h1 className="welcome-text">Welcome to Legion!</h1>
            {!showLoginOptions ? (
              <Fragment>
                <div className="login-header">
                  Play freely without an account, or create one at any time to save your progress!
                </div>
                <div className="login-buttons">
                  <button className="sign-up-btn" onClick={this.showLoginOptions}>Sign Up</button>
                  <button className="explore-btn" onClick={this.handleExplore}>Keep exploring</button>
                </div>
              </Fragment>
            ) : (
              <Fragment>
                <div className="login-header">
                  Choose your sign up method
                </div>
                <div ref={(ref) => this.firebaseUIContainer = ref} id="firebaseui-auth-container"></div>
                <button className="back-button" onClick={this.clearLoginOptions}>Back</button>
              </Fragment>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default Welcome;