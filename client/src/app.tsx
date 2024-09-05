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
    currentMainRoute: string;
}

class App extends Component<{}, AppState> {
    state: AppState = {
        currentUrl: '/',
        currentMainRoute: '/'
    };

    getMainRoute(url: string): string {
        const parts = url.split('/');
        return parts[1] || '/'; // Return the first part after the initial slash, or '/' if it's the root
    }

    handleRoute = (e: RouterOnChangeArgs, refreshPlayerData: () => void, updateActiveCharacter: (id: string | null) => void) => {
        const newMainRoute = this.getMainRoute(e.url);
        
        if (newMainRoute !== this.state.currentMainRoute) {
            refreshPlayerData();
        }

        if (newMainRoute === 'team') {
            const teamId = e.url.split('/')[2] || null;
            updateActiveCharacter(teamId);
        } else {
            updateActiveCharacter(null);
        }

        this.setState({ 
            currentUrl: e.url,
            currentMainRoute: newMainRoute
        });
    };

    render() {
        return (
            <AuthProvider>
                <PlayerProvider>
                    <PlayerContext.Consumer>
                        {({ refreshPlayerData, updateActiveCharacter }) => (
                            <Router onChange={(e: RouterOnChangeArgs) => this.handleRoute(e, refreshPlayerData, updateActiveCharacter)}>
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