import { h, Component } from 'preact';
import { Route, Router, RouterOnChangeArgs } from 'preact-router';
import { PlayerContext } from './contexts/PlayerContext';

import AuthProvider from './providers/AuthProvider';
import PlayerProvider from './providers/PlayerProvider';
import WalletContextProvider from './providers/WalletContextProvider';
import HomePage from './routes/HomePage';
import GamePage from './routes/GamePage';
import LandingPage from './routes/LandingPage';
import withAuth from './components/withAuth';
import withNoAuth from './components/withNoAuth';

import * as Sentry from "@sentry/react";
import { recordPageView } from './components/utils';
import { firebaseAuth } from './services/firebaseService';

// Only initialize Sentry if not in development mode
if (process.env.NODE_ENV !== 'development') {
  Sentry.init({
    environment: process.env.NODE_ENV,
    dsn: "https://c3c72f4dedb26b85b58c0eb82feea9c1@o4508024644567040.ingest.de.sentry.io/4508024650268752",
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
      Sentry.captureConsoleIntegration({
        levels: ['error']
      })
    ],
    // Tracing
    tracesSampleRate: 1.0,
    tracePropagationTargets: ["localhost", /^https:\/\/www\.play-legion\.io\//],
    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });

  // Set up auth state listener to update Sentry user info
  firebaseAuth.onAuthStateChanged((user) => {
    if (user) {
      Sentry.setUser({ id: user.uid });
    } else {
      Sentry.setUser(null);
    }
  });
}

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

    warmUpMatchmaker = () => {
        try {
            fetch(`${process.env.MATCHMAKER_URL}`);
        } catch (err) {
            // console.error('Error warming up matchmaker:', err);
        }
    }

    getMainRoute(url: string): string {
        const parts = url.split('/');
        return parts[1] || '/'; // Return the first part after the initial slash, or '/' if it's the root
    }

    handleRoute = (e: RouterOnChangeArgs, refreshAllData: () => void, updateActiveCharacter: (id: string | null) => void) => {
        const newMainRoute = this.getMainRoute(e.url);

        if (this.state.currentMainRoute === '/') {
            this.warmUpMatchmaker();
        }

        if (this.state.currentMainRoute === 'game' && newMainRoute !== 'game') {
            refreshAllData();
            this.warmUpMatchmaker();
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

        const user = firebaseAuth.currentUser;
        if (user) {
            recordPageView(e.url);
        }
    };

    shouldComponentUpdate(nextProps: {}, nextState: AppState) {
        return (
            this.state.currentUrl !== nextState.currentUrl ||
            this.state.currentMainRoute !== nextState.currentMainRoute
        );
    }

    render() {
        return (
            <AuthProvider>
                <PlayerProvider>
                    <PlayerContext.Consumer>
                        {({ refreshAllData, updateActiveCharacter }) => (
                            <WalletContextProvider>
                                <Router onChange={(e: RouterOnChangeArgs) => this.handleRoute(e, refreshAllData, updateActiveCharacter)}>
                                    <Route path="/" component={withNoAuth(LandingPage)} />
                                    <Route path="/game/:id" component={AuthenticatedGamePage} />
                                    <Route path="/replay/:id" component={AuthenticatedGamePage} />
                                    <Route path="/play" component={AuthenticatedHomePage} />
                                    <Route path="/team/:id?" component={AuthenticatedHomePage} />
                                    <Route path="/shop/:id?" component={AuthenticatedHomePage} />
                                    <Route path="/rank" component={AuthenticatedHomePage} />
                                    <Route path="/queue/:mode" component={AuthenticatedHomePage} />
                                    <Route path="/lobby/:id" component={AuthenticatedHomePage} />
                                    <Route path="/elysium" component={AuthenticatedHomePage} />
                                    <Route path="/profile/:id?" component={AuthenticatedHomePage} />
                                    <Route default component={AuthenticatedHomePage} />
                                </Router>
                            </WalletContextProvider>
                        )}
                    </PlayerContext.Consumer>
                </PlayerProvider>
            </AuthProvider>
        );
    }
}

App.contextType = PlayerContext;

export default App;
