import { h, Component } from 'preact';
import AuthContext from '../contexts/AuthContext';
import './TitleScreen.style.css';
import logoBig from '@assets/logo.png';
import { route } from 'preact-router';


class TitleScreen extends Component<{}, { showLoginOptions: boolean }> {
  static contextType = AuthContext;
  playRoute: string = '/game/0';
  state = {
    showLoginOptions: false,
  };

  private firebaseUIContainer: HTMLDivElement | null = null;

  showLoginOptions = (): void => {
    this.setState({ showLoginOptions: true }, () => {
      if (this.firebaseUIContainer) {
        this.context.initFirebaseUI(
          this.firebaseUIContainer,
          (authResult) => this.context.handleAuthSuccess(authResult),
          true
        );
      }
    });
  };

  clearFirebaseUI = (): void => {
    this.context.resetUI();
    this.setState({ showLoginOptions: false });
  };

  componentWillUnmount(): void {
    this.context.resetUI();
  }

  renderLoginOptions = () => (
    <div>
      <div className="login-header">
        <p>Choose your sign in/up method</p>
      </div>
      <div ref={el => {(this.firebaseUIContainer = el)}} id="firebaseui-auth-container"></div>
      <button className="back-button" onClick={this.clearFirebaseUI}>Back</button>
    </div>
  );

  render() {
    return (
      <div className="title-screen">
        <div className="title-screen-content">
          <img src={logoBig} alt="Legion" className="logo-big" />
          {this.state.showLoginOptions ? (
            <div className="login-overlay">
              <div className="login-dialog">
                {this.renderLoginOptions()}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', marginTop: '2rem' }}>
              <button className="login-button" onClick={this.showLoginOptions}>Log in</button>
              <button className="cta-button-title-screen" onClick={() => route(this.playRoute)}>Play Now</button>
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default TitleScreen;
