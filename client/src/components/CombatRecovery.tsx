import {t} from '../i18n/core';
import {h} from 'preact';
import '../providers/AuthProvider.style.css';

export function CombatRecovery({error}: {error?: unknown}) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const graphicsFailed = /webgl|combat renderer|canvas context/i.test(message);
  const loadingFailed = /loading timed out/i.test(message);
  return <main className="session-screen session-screen--error">
    <section className="session-status" role="alert">
      <p className="session-status__eyebrow">{t("Game interrupted")}</p>
      <h1>{graphicsFailed ? t("Unable to start game graphics") : loadingFailed ? t("The game couldn’t finish loading") : t("Let’s get you back to the arena")}</h1>
      <p className="session-status__message">{graphicsFailed
        ? t("Emberhall couldn’t start or keep its graphics renderer running. Loading has stopped. Try reloading the game.")
        : loadingFailed
          ? t("Loading took too long and has stopped. Check your connection, then reload to reconnect if your match is still in progress.")
          : t("Emberhall couldn’t keep running. Reload to reconnect if your match is still in progress.")}</p>
      <button className="session-status__retry" type="button" onClick={() => location.reload()}>{t("Reload game")}</button>
      {graphicsFailed && <p className="session-status__hint">{t("If reloading doesn’t help, restart Emberhall, close other games or apps, and update your graphics driver. Make sure Steam or Itch has installed the latest Emberhall update.")}</p>}
    </section>
  </main>;
}
