import {t} from '../i18n/core';
import { h } from 'preact';
import {Component, ComponentChildren, } from "preact";
import firebase from "firebase/compat/app";

import AuthContext from "../contexts/AuthContext";
import {firebaseAuth} from "../services/firebaseService";
import {exchangePlatformCredential, getPlatformCredential} from "../services/platformSession";
import {getElectronAPI} from "../utils/electronUtils";
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
  state: State = {user: null, isLoading: true, error: null};
  private unsubscribe?: firebase.Unsubscribe;
  private authenticating = false;
  private sessionReady = false;
  private sessionTimedOut = false;
  private sessionController?: AbortController;
  private sessionTimeout?: ReturnType<typeof setTimeout>;

  componentDidMount() {
    this.unsubscribe = firebaseAuth.onAuthStateChanged(user => {
      this.setState({user});
      if (this.sessionReady && user) this.setState({isLoading: false, error: null});
      else if (this.sessionReady) this.startSession();
    });
    // Revalidate the platform each launch: a cached Firebase user may belong to
    // another Steam account (or a previous direct build). Gifts must follow the
    // account actually launching the game.
    void this.startSession();
  }

  componentWillUnmount() {
    this.unsubscribe?.();
    clearTimeout(this.sessionTimeout);
    this.sessionController?.abort();
  }

  startSession = async () => {
    // Firebase sign-in cannot be cancelled. Reload before retrying a timed-out
    // attempt so its late result cannot overwrite the next platform's session.
    if (this.sessionTimedOut) {
      window.location.reload();
      return;
    }
    if (this.authenticating) return;
    this.authenticating = true;
    this.sessionReady = false;
    this.setState({isLoading: true, error: null});
    const controller = new AbortController();
    this.sessionController = controller;
    let stage = "platform credential";
    try {
      if (!process.env.API_URL) throw new Error("API_URL is not configured");
      const user = await Promise.race([
        (async () => {
          const credential = await getPlatformCredential(
            getElectronAPI(), localStorage, () => globalThis.crypto.randomUUID(),
          );
          controller.signal.throwIfAborted();
          stage = "platform exchange";
          const customToken = await exchangePlatformCredential(process.env.API_URL, credential, fetch, controller.signal);
          controller.signal.throwIfAborted();
          stage = "Firebase sign-in";
          return (await firebaseAuth.signInWithCustomToken(customToken)).user;
        })(),
        new Promise<never>((_resolve, reject) => {
          this.sessionTimeout = setTimeout(() => {
            this.sessionTimedOut = true;
            reject(new Error(`Desktop session timed out during ${stage}`));
            controller.abort();
          }, 30000);
        }),
      ]);
      if (controller.signal.aborted) return;
      this.sessionReady = true;
      this.setState({user, isLoading: false, error: null});
    } catch (error) {
      if (controller.signal.aborted && !this.sessionTimedOut) return;
      console.error(`Desktop session failed during ${stage}:`, error);
      this.setState({
        isLoading: false,
        error: t("We couldn't reach Emberhall's services. Check your connection, then try again."),
      });
    } finally {
      clearTimeout(this.sessionTimeout);
      this.authenticating = false;
    }
  };

  render() {
    const {user, isLoading, error} = this.state;
    if (isLoading) {
      return (
        <main className="session-screen">
          <section className="session-status" aria-live="polite" aria-busy="true">
            <img className="session-status__logo" src={logo} alt={t("Emberhall")} />
            <p className="session-status__eyebrow">{t("Connecting")}</p>
            <h1>{t("Preparing your arena")}</h1>
            <p className="session-status__message">{t("Securing your session…")}</p>
            <div className="session-status__progress" aria-hidden="true"><span /></div>
          </section>
        </main>
      );
    }
    if (error || !user) {
      return (
        <main className="session-screen session-screen--error">
          <section className="session-status" role="alert">
            <img className="session-status__logo" src={logo} alt={t("Emberhall")} />
            <div className="session-status__error-mark" aria-hidden="true">!</div>
            <p className="session-status__eyebrow">{t("Connection interrupted")}</p>
            <h1>{t("The arena is out of reach")}</h1>
            <p className="session-status__message">{error || t("Your Emberhall session could not be started.")}</p>
            <button className="session-status__retry" type="button" onClick={this.startSession}>{t("Try again")}</button>
            <p className="session-status__hint">{t("Press Enter or controller A to retry")}</p>
          </section>
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
