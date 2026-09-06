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
import {actionFromKeyboard, DESKTOP_ACTION_EVENT, DesktopAction, dispatchDesktopAction} from './input/actions';
import {startGamepadInput} from './input/gamepad';
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
    stopGamepadInput = () => undefined;
    state: AppState = {
        currentUrl: '/',
        currentMainRoute: '/'
    };

    componentDidMount() {
        document.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener(DESKTOP_ACTION_EVENT, this.handleDesktopAction as EventListener);
        this.stopGamepadInput = startGamepadInput(action => dispatchDesktopAction(action, 'gamepad'));
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener(DESKTOP_ACTION_EVENT, this.handleDesktopAction as EventListener);
        this.stopGamepadInput();
    }

    handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target?.matches?.('input, textarea, select, [contenteditable="true"]');
      const action = actionFromKeyboard(event);
      if (!action || (typing && action !== 'cancel') || (event.code === 'Tab' && this.state.currentMainRoute !== 'game')) return;
      event.preventDefault();
      dispatchDesktopAction(action, 'keyboard');
    };

    focusMenu = (direction: -1 | 1) => {
      const elements = Array.from(document.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter(element => element.getClientRects().length > 0);
      if (!elements.length) return;
      const current = elements.indexOf(document.activeElement as HTMLElement);
      elements[(current + direction + elements.length) % elements.length].focus();
    };

    showGamepadKeyboard = async (input: HTMLInputElement | HTMLTextAreaElement) => {
      const value = await getElectronAPI()?.showGamepadTextInput?.({
        description: input.getAttribute('aria-label') || input.placeholder || 'Enter text',
        maxCharacters: input.maxLength > 0 ? input.maxLength : 256,
        existingText: input.value,
        password: input instanceof HTMLInputElement && input.type === 'password',
        multiline: input instanceof HTMLTextAreaElement,
      });
      if (typeof value === 'string') {
        input.value = value;
        input.dispatchEvent(new Event('input', {bubbles: true}));
      }
    };

    handleDesktopAction = async (event: CustomEvent<{action: DesktopAction; source: string}>) => {
      const {action, source} = event.detail;
      if (action === 'menu-up' || action === 'menu-left') return this.focusMenu(-1);
      if (action === 'menu-down' || action === 'menu-right') return this.focusMenu(1);
      if (action === 'end-turn') return document.querySelector<HTMLButtonElement>('.player_bar_pass_turn:not([disabled])')?.click();
      if (action === 'pause') return document.querySelector<HTMLElement>('[data-game-menu]')?.click();
      if (action === 'confirm') {
        const active = document.activeElement as HTMLElement;
        if (source === 'gamepad' && active?.matches('input:not([type="range"]):not([type="checkbox"]), textarea')) {
          return this.showGamepadKeyboard(active as HTMLInputElement | HTMLTextAreaElement);
        }
        return active?.click();
      }
      if (action === 'cancel') {
        const cancel = Array.from(document.querySelectorAll<HTMLElement>('[data-desktop-cancel]'))
          .find(element => element.getClientRects().length > 0);
        if (cancel) return cancel.click();
        if (isElectron()) {
          const electronAPI = getElectronAPI();
          try {
            if (await electronAPI?.isFullscreen?.()) await electronAPI.toggleFullscreen();
          } catch (error) {
            console.error('App: Error leaving fullscreen:', error);
          }
        }
      }
    };

    warmUpMatchmaker = () => {
        try {
            fetch(`${process.env.MATCHMAKER_URL}`);
        } catch (_err) {
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

    shouldComponentUpdate(_nextProps: {}, nextState: AppState) {
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
