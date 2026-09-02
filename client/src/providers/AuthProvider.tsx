import {Component, ComponentChildren, h} from "preact";
import firebase from "firebase/compat/app";

import AuthContext from "../contexts/AuthContext";
import {firebaseAuth} from "../services/firebaseService";
import {exchangePlatformCredential, getPlatformCredential} from "../services/platformSession";
import {getElectronAPI} from "../utils/electronUtils";

interface Props {
  children: ComponentChildren;
}

interface State {
  user: firebase.User | null;
  isLoading: boolean;
  error: string | null;
}

export default class AuthProvider extends Component<Props, State> {
  state: State = {user: null, isLoading: true, error: null};
  private unsubscribe?: firebase.Unsubscribe;
  private authenticating = false;

  componentDidMount() {
    this.unsubscribe = firebaseAuth.onAuthStateChanged(user => {
      this.setState({user});
      if (user) this.setState({isLoading: false, error: null});
      else this.startSession();
    });
  }

  componentWillUnmount() {
    this.unsubscribe?.();
  }

  startSession = async () => {
    if (this.authenticating) return;
    this.authenticating = true;
    this.setState({isLoading: true, error: null});
    try {
      if (!process.env.API_URL) throw new Error("API_URL is not configured");
      const credential = await getPlatformCredential(
        getElectronAPI(),
        localStorage,
        () => globalThis.crypto.randomUUID(),
      );
      const customToken = await exchangePlatformCredential(process.env.API_URL, credential);
      await firebaseAuth.signInWithCustomToken(customToken);
    } catch (error) {
      console.error("Desktop session failed:", error);
      this.setState({isLoading: false, error: "Could not start your Legion session."});
    } finally {
      this.authenticating = false;
    }
  };

  render() {
    const {user, isLoading, error} = this.state;
    if (isLoading) return <main className="session-screen">Starting Legion…</main>;
    if (error || !user) {
      return (
        <main className="session-screen">
          <p>{error || "No active Legion session."}</p>
          <button onClick={this.startSession}>Retry</button>
        </main>
      );
    }

    return (
      <AuthContext.Provider value={{user, isAuthenticated: true, isLoading: false, retrySession: this.startSession}}>
        {this.props.children}
      </AuthContext.Provider>
    );
  }
}
