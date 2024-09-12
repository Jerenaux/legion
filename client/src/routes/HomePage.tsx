import { h, Component } from 'preact';
import { Router, Route } from 'preact-router';
import AuthContext from '../contexts/AuthContext';
import { PlayerContext } from '../contexts/PlayerContext';

import PlayPage from '../components/PlayPage';
import TeamPage from '../components/TeamPage';
import ShopPage from '../components/ShopPage';
import RankPage from '../components/RankPage';
import Navbar from '../components/navbar/Navbar';
import QueuePage from '../components/QueuePage';

interface HomePageState {
  showLoginOptions: boolean;
}

class HomePage extends Component<{}, HomePageState> {
  static contextType = AuthContext;

  state: HomePageState = {
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
    this.setState({ showLoginOptions: false });
  };

  showLoginOptions = (): void => {
    this.setState({ showLoginOptions: true }, () => {
      if (this.firebaseUIContainer) {
        this.context.initFirebaseUI(this.firebaseUIContainer);
      }
    });
  };

  render() {
    const { user } = this.context;
    if (!user) return null;

    return (
      <PlayerContext.Consumer>
        {({ player, welcomeShown }) => (
          <div className="homePage">
            <Navbar user={user} playerData={player} logout={this.context.logout} />
            <div className="content">
              <div className="mainContent">
                <Router>
                  <Route path="/play" component={PlayPage} />
                  <Route path="/queue/:mode" component={QueuePage} />
                  <Route path="/team/:id?" component={TeamPage} />
                  <Route path="/shop/:id?" component={ShopPage} />
                  <Route path="/rank" component={RankPage} />
                </Router>
              </div>
            </div>
            {user.isAnonymous && welcomeShown && (
              <div className="anonymous-warning">
                You are playing as a guest. Sign up to save your progress!
                <button className="sign-up-btn-smol" onClick={this.showLoginOptions}>Sign up</button>
              </div>
            )}
            {this.state.showLoginOptions && (
              <div className="login-modal-overlay">
                <div className="login-modal-dialog">
                  <div className="dialog-content">
                    <h2>Sign Up</h2>
                    <div className="login-header">
                      Choose your sign up method
                    </div>
                    <div ref={(ref) => this.firebaseUIContainer = ref} id="firebaseui-auth-container"></div>
                    <button className="back-button" onClick={() => this.setState({ showLoginOptions: false })}>Close</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </PlayerContext.Consumer>
    );
  }
}

export default HomePage;