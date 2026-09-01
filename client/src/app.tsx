import { h, Component } from 'preact';
import { Route, Router, RouterOnChangeArgs } from 'preact-router';
import { PlayerContext } from './contexts/PlayerContext';
import { isElectron, getElectronAPI } from './utils/electronUtils';

import AuthProvider from './providers/AuthProvider';
import PlayerProvider from './providers/PlayerProvider';
import HomePage from './routes/HomePage';
import GamePage from './routes/GamePage';
import Root from './routes/Root';
import withAuth from './components/withAuth';

import * as Sentry from "@sentry/react";
import { recordPageView } from './components/utils';
import { firebaseAuth } from './services/firebaseService';
import LogRocket from './logrocketSetup';
// Only initialize Sentry if not in development mode
if (process.env.NODE_ENV !== 'development') {
  Sentry.init({
    environment: process.env.NODE_ENV,
    dsn: "https://c3c72f4dedb26b85b58c0eb82feea9c1@o4508024644567040.ingest.de.sentry.io/4508024650268752",
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.captureConsoleIntegration({
        levels: ['error']
      })
    ],
    // Tracing
    tracesSampleRate: 0.1,
  });

  // Set up auth state listener to update Sentry user info
  firebaseAuth.onAuthStateChanged((user) => {
    if (user) {
      Sentry.setUser({ id: user.uid });
      LogRocket.identify(user.uid);
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

    componentDidMount() {
        
        if (isElectron()) {
            document.addEventListener('keydown', this.handleKeyDown);
        }
    }

    componentWillUnmount() {
        if (isElectron()) {
            document.removeEventListener('keydown', this.handleKeyDown);
        }
    }

    handleKeyDown = async (event: KeyboardEvent) => {
    //   console.log('App: Key pressed:', {
    //     key: event.key,
    //     keyCode: event.keyCode,
    //     code: event.code,
    //     target: (event.target as HTMLElement)?.tagName || 'unknown'
    //   });
      
      // Check if ESC key was pressed
      if (event.key === 'Escape' || event.keyCode === 27) {
        
        const electronAPI = getElectronAPI();
        
        if (electronAPI && electronAPI.isFullscreen && electronAPI.toggleFullscreen) {
          try {
            const isCurrentlyFullscreen = await electronAPI.isFullscreen();
            
            if (isCurrentlyFullscreen) {
              await electronAPI.toggleFullscreen();
            }
          } catch (error) {
            console.error('App: Error handling ESC key:', error);
          }
        }
      }
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
                                <Router onChange={(e: RouterOnChangeArgs) => this.handleRoute(e, refreshAllData, updateActiveCharacter)}>
                                    <Route path="/" component={Root} />
                                    <Route path="/game/:id" component={AuthenticatedGamePage} />
                                    <Route path="/replay/:id" component={AuthenticatedGamePage} />
                                    <Route path="/play" component={AuthenticatedHomePage} />
                                    <Route path="/team/:id?" component={AuthenticatedHomePage} />
                                    <Route path="/shop/:category?/:id?" component={AuthenticatedHomePage} />
                                    <Route path="/rank" component={AuthenticatedHomePage} />
                                    <Route path="/queue/:mode" component={AuthenticatedHomePage} />
                                    <Route path="/lobby/:id" component={AuthenticatedHomePage} />
                                    <Route path="/profile/:id?" component={AuthenticatedHomePage} />
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
