import { h, Component } from 'preact';
import { route } from 'preact-router';
import AuthContext from '../contexts/AuthContext';
import logoBig from '@assets/logobig.png';

interface LandingPageState {
  showLoginOptions: boolean;
}

class LandingPage extends Component<{}, LandingPageState> {
  static contextType = AuthContext;

  state: LandingPageState = {
    showLoginOptions: false,
  };

  private firebaseUIContainer: HTMLDivElement | null = null;

  showLoginOptions = (): void => {
    this.setState({ showLoginOptions: true }, () => {
      if (this.firebaseUIContainer) {
        this.context.initFirebaseUI(this.firebaseUIContainer);
      }
    });
  };

  clearFirebaseUI = (): void => {
    this.context.resetUI();
    this.setState({ showLoginOptions: false });
  };

  renderInitialView = (): h.JSX.Element => (
    <div>
      <div className="login-header">
        <br/><br/><br/>
        <p>Assemble your team and become the strongest of the arena!</p>
      </div>
      <div className="login-buttons">
        <button className="get-started" onClick={() => route('/game/tutorial')}>Get Started</button>
        <button className="already-account" onClick={this.showLoginOptions}>Already have an account?</button>
      </div>
    </div>
  );

  renderLoginOptions = (): h.JSX.Element => (
    <div>
      <div className="login-header">
        <br/><br/><br/>
        <p>Choose your sign in/up method</p>
      </div>
      <div ref={(ref) => this.firebaseUIContainer = ref} id="firebaseui-auth-container"></div>
      <button className="back-button" onClick={this.clearFirebaseUI}>Back</button>
    </div>
  );

  render(): h.JSX.Element {
    const { showLoginOptions } = this.state;

    return (
      <div className="landingPage">
        <div className="login-dialog">
          <img src={logoBig} alt="Logo" className="logo" />
          {showLoginOptions ? this.renderLoginOptions() : this.renderInitialView()}
        </div>
      </div>
    );
  }
}

export default LandingPage;