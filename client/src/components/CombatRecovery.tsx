import {h} from 'preact';
import '../providers/AuthProvider.style.css';

export function CombatRecovery({error}: {error?: unknown}) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const graphicsFailed = /webgl|combat renderer|canvas context/i.test(message);
  const loadingFailed = /loading timed out/i.test(message);
  return <main className="session-screen session-screen--error">
    <section className="session-status" role="alert">
      <p className="session-status__eyebrow">Game interrupted</p>
      <h1>{graphicsFailed ? 'Unable to start game graphics' : loadingFailed ? 'The game couldn’t finish loading' : 'Let’s get you back to the arena'}</h1>
      <p className="session-status__message">{graphicsFailed
        ? 'Legion couldn’t start or keep its graphics renderer running. Loading has stopped. Try reloading the game.'
        : loadingFailed
          ? 'Loading took too long and has stopped. Check your connection, then reload to reconnect if your match is still in progress.'
          : 'Legion couldn’t keep running. Reload to reconnect if your match is still in progress.'}</p>
      <button className="session-status__retry" type="button" onClick={() => location.reload()}>Reload game</button>
      {graphicsFailed && <p className="session-status__hint">If reloading doesn’t help, restart Legion, close other games or apps, and update your graphics driver. Make sure Steam or Itch has installed the latest Legion update.</p>}
    </section>
  </main>;
}
