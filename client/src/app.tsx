import { h, Component } from 'preact';
import { Route, Router, RouterOnChangeArgs } from 'preact-router';
import { PlayerContext } from './contexts/PlayerContext';

import AuthProvider from './providers/AuthProvider';
import PlayerProvider from './providers/PlayerProvider';
import HomePage from './routes/HomePage';
import GamePage from './routes/GamePage';
import LandingPage from './routes/LandingPage';
import withAuth from './components/withAuth';
import withNoAuth from './components/withNoAuth';

const AuthenticatedHomePage = withAuth(HomePage);
const AuthenticatedGamePage = withAuth(GamePage);

interface AppState {
	currentUrl: string;
}

class App extends Component<{}, AppState> {
    state: AppState = {
        currentUrl: '/'
    };

    handleRoute = (e: RouterOnChangeArgs) => {
        this.setState({ currentUrl: e.url });
    };

    render() {
        return (
            <AuthProvider>
                <PlayerProvider>
                    <PlayerContext.Consumer>
                        {({ refreshPlayerData }) => (
                            <Router onChange={(e: RouterOnChangeArgs) => {
                                this.handleRoute(e);
                                refreshPlayerData();
                            }}>
                                <Route path="/" component={withNoAuth(LandingPage)} />
                                <Route path="/game/:id" component={AuthenticatedGamePage} />
                                <Route path="/play" component={AuthenticatedHomePage} />
                                <Route path="/team/:id?" component={AuthenticatedHomePage} />
                                <Route path="/shop/:id?" component={AuthenticatedHomePage} />
                                <Route path="/rank" component={AuthenticatedHomePage} />
                                <Route path="/queue/:mode" component={AuthenticatedHomePage} />
                                <Route default component={AuthenticatedHomePage} />
                            </Router>
                        )}
                    </PlayerContext.Consumer>
                </PlayerProvider>
            </AuthProvider>
        );
    }
}

App.contextType = PlayerContext;

export default App;