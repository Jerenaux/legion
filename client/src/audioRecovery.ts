import {addBreadcrumb, captureMessage} from '@sentry/react';
import {DESKTOP_ACTION_EVENT} from './input/actions';
import {loadGameSettings} from './settings';

type AudioSource = 'route-music' | 'hearth' | 'combat' | 'ui-sfx';
const reported = new Set<string>();

export function reportAudioFailure(source: AudioSource, operation: string, error: unknown, details: Record<string, unknown> = {}) {
  const reason = error instanceof Error ? error.name : 'Error';
  const key = `${source}:${operation}:${reason}`;
  if (reported.has(key)) return;
  reported.add(key);
  const {musicVolume, musicMuted, sfxVolume, sfxMuted} = loadGameSettings();
  const data = {source, operation, reason, ...details, musicVolume, musicMuted, sfxVolume, sfxMuted,
    visible: !document.hidden, focused: document.hasFocus()};
  addBreadcrumb({category: 'audio', message: 'Audio operation failed', data});
  // Autoplay restrictions and interrupted play requests are expected, not application errors.
  if (reason !== 'NotAllowedError' && reason !== 'AbortError') {
    captureMessage('Audio operation failed', {level: 'warning', fingerprint: ['audio', source, operation, reason], tags: {'audio.source': source, 'audio.operation': operation}, contexts: {audio: data}});
  }
}

/** Background audio must not be restarted by a hidden window's controller polling. */
export function onAudioRecovery(recover: () => void) {
  const attempt = () => { if (!document.hidden && document.hasFocus()) recover(); };
  const controller = (event: CustomEvent<{source: string}>) => { if (event.detail.source === 'gamepad') attempt(); };
  window.addEventListener('focus', attempt);
  document.addEventListener('visibilitychange', attempt);
  document.addEventListener('pointerdown', attempt);
  document.addEventListener('keydown', attempt);
  window.addEventListener(DESKTOP_ACTION_EVENT, controller as EventListener);
  return () => {
    window.removeEventListener('focus', attempt);
    document.removeEventListener('visibilitychange', attempt);
    document.removeEventListener('pointerdown', attempt);
    document.removeEventListener('keydown', attempt);
    window.removeEventListener(DESKTOP_ACTION_EVENT, controller as EventListener);
  };
}

export function watchAudioContext(context: AudioContext, source: 'hearth' | 'combat', onResumed = () => {}) {
  let disposed = false;
  let resuming = false;
  const originalResume = context.resume;
  // Phaser also resumes directly without catching failures; observe those promises without changing their result.
  const resume = () => {
    const attempt = originalResume.call(context);
    void attempt.catch(error => {
      if (!disposed) reportAudioFailure(source, 'resume', error, {state: context.state});
    });
    return attempt;
  };
  context.resume = resume;
  const recover = () => {
    const state: string = context.state;
    if (resuming || (state !== 'suspended' && state !== 'interrupted')) return;
    resuming = true;
    void context.resume().then(() => {
      if (!disposed && context.state === 'running') onResumed();
    }, () => {}).finally(() => { resuming = false; });
  };
  const stopRecovery = onAudioRecovery(recover);
  const onState = () => {
    addBreadcrumb({category: 'audio', message: 'Audio context state', data: {source, state: context.state, focused: document.hasFocus(), visible: !document.hidden}});
    if (context.state === 'closed') reportAudioFailure(source, 'unexpected-close', new Error(), {state: context.state});
    else if (!document.hidden && document.hasFocus()) recover();
  };
  context.addEventListener('statechange', onState);
  onState();
  return () => {
    disposed = true;
    if (context.resume === resume) context.resume = originalResume;
    stopRecovery();
    context.removeEventListener('statechange', onState);
  };
}
