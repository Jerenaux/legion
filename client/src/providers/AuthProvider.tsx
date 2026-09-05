import { Component, ComponentChildren, h } from "preact";
import firebase from "firebase/compat/app";

import AuthContext from "../contexts/AuthContext";
import { firebaseAuth } from "../services/firebaseService";
import { exchangePlatformCredential, getPlatformCredential } from "../services/platformSession";
import { getElectronAPI } from "../utils/electronUtils";
import logo from "@assets/logo.png";
import "./AuthProvider.style.css";

interface Props {
  children: ComponentChildren;
}

interface State {
  user: firebase.User | null;
  isLoading: boolean;
  error: string | null;
}

export default class AuthProvider extends Component<Props, State> {
  state: State = { user: null, isLoading: true, error: null };
  private unsubscribe?: firebase.Unsubscribe;
  private authenticating = false;

  componentDidMount() {
    this.unsubscribe = firebaseAuth.onAuthStateChanged((user) => {
      this.setState({ user });
      if (user) this.setState({ isLoading: false, error: null });
      else this.startSession();
    });
  }

  componentWillUnmount() {
    this.unsubscribe?.();
  }

  startSession = async () => {
    if (this.authenticating) return;
    this.authenticating = true;
    this.setState({ isLoading: true, error: null });
    try {
      if (!process.env.API_URL) throw new Error("API_URL is not configured");
      const credential = await getPlatformCredential(getElectronAPI(), localStorage, () =>
        globalThis.crypto.randomUUID(),
      );
      const customToken = await exchangePlatformCredential(process.env.API_URL, credential);
      await firebaseAuth.signInWithCustomToken(customToken);
    } catch (error) {
      console.error("Desktop session failed:", error);
      this.setState({
        isLoading: false,
        error: "We couldn't reach Legion's services. Check your connection, then try again.",
      });
    } finally {
      this.authenticating = false;
    }
  };

  render() {
    const { user, isLoading, error } = this.state;
    if (isLoading) {
      return (
        <main className="session-screen">
          <section className="session-status" aria-live="polite" aria-busy="true">
            <img className="session-status__logo" src={logo} alt="Legion" />
            <p className="session-status__eyebrow">Connecting</p>
            <h1>Preparing your arena</h1>
            <p className="session-status__message">Securing your session…</p>
            <div className="session-status__progress" aria-hidden="true">
              <span />
            </div>
          </section>
        </main>
      );
    }
    if (error || !user) {
      return (
        <main className="session-screen session-screen--error">
          <section className="session-status" role="alert">
            <img className="session-status__logo" src={logo} alt="Legion" />
            <div className="session-status__error-mark" aria-hidden="true">
              !
            </div>
            <p className="session-status__eyebrow">Connection interrupted</p>
            <h1>The arena is out of reach</h1>
            <p className="session-status__message">{error || "Your Legion session could not be started."}</p>
            <button className="session-status__retry" type="button" autoFocus onClick={this.startSession}>
              Try again
            </button>
            <p className="session-status__hint">Press Enter or controller A to retry</p>
          </section>
        </main>
      );
    }

    return (
      <AuthContext.Provider value={{ user, isAuthenticated: true, isLoading: false, retrySession: this.startSession }}>
        {this.props.children}
      </AuthContext.Provider>
    );
  }
}
