import {h} from 'preact';
import '../providers/AuthProvider.style.css';

export function CombatRecovery() {
  return <main className="session-screen session-screen--error">
    <section className="session-status" role="alert">
      <p className="session-status__eyebrow">Game interrupted</p>
      <h1>Let’s get you back to the arena</h1>
      <p className="session-status__message">Legion couldn’t keep running. Reload to reconnect if your match is still in progress.</p>
      <button className="session-status__retry" type="button" onClick={() => location.reload()}>Reload game</button>
      <p className="session-status__hint">If this keeps happening, restart Legion and close other apps to free up memory.</p>
    </section>
  </main>;
}
