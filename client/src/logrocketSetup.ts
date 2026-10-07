import {telemetryConfig, logRocketOptions} from './telemetryConfig';

// One shared gate: LogRocket is a parallel recording, available if Sentry rejects its quota.
export const logRocket: typeof import('logrocket') | undefined = (() => {
  if (!telemetryConfig.sentryReplay) return undefined;
  try {
    const sdk: typeof import('logrocket') = require('logrocket');
    sdk.init('bpfssp/legion', logRocketOptions);
    return sdk;
  } catch { return undefined; }
})();

// The Web SDK records DOM, not WebGL. Put low-rate snapshots behind the live canvas;
// the transparent, unrecorded canvas reveals this image during DOM playback.
// Players must never see it: a stale frame showing through transparent pixels looks like
// motion trails. `data-replay-only` hides it live, and LogRocket drops that attribute
// (`hiddenAttributes`), so the hiding rule matches nothing in replays.
type Frame = {image: HTMLImageElement; buffer: HTMLCanvasElement; time: number; busy: boolean};
const frames = new WeakMap<HTMLCanvasElement, Frame>();
export const REPLAY_ONLY_ATTRIBUTE = 'data-replay-only';
let hidingRule: HTMLStyleElement | undefined;

function hideLiveSnapshots() {
  if (hidingRule?.isConnected) return;
  hidingRule = document.createElement('style');
  hidingRule.textContent = `img[${REPLAY_ONLY_ATTRIBUTE}="live"]{visibility:hidden!important}`;
  document.head.appendChild(hidingRule);
}

const encode = (buffer: HTMLCanvasElement) => new Promise<string>((resolve, reject) => {
  buffer.toBlob(blob => {
    if (!blob) return reject(new Error('Snapshot encoding failed'));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  }, 'image/webp', 0.7);
});

export function captureLogRocketFrame(canvas: HTMLCanvasElement) {
  if (!logRocket || document.hidden || !canvas.parentElement || !canvas.width || !canvas.height) return;
  const now = performance.now();
  let frame = frames.get(canvas);
  if (frame && (frame.busy || now - frame.time < 500)) return;
  try {
    if (!frame) {
      hideLiveSnapshots();
      const image = document.createElement('img');
      image.dataset.logrocketCanvas = '';
      image.dataset.sentryBlock = '';
      image.setAttribute(REPLAY_ONLY_ATTRIBUTE, 'live');
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      image.style.cssText = 'position:absolute;pointer-events:none;z-index:-1;';
      // Isolate the negative layer inside the existing scene, above its background.
      canvas.parentElement.style.isolation = 'isolate';
      canvas.parentElement.insertBefore(image, canvas);
      frame = {image, buffer: document.createElement('canvas'), time: now, busy: false};
      frames.set(canvas, frame);
    }
    const current = frame;
    current.time = now;
    current.busy = true;
    const width = Math.min(960, canvas.width);
    const height = Math.round(width * canvas.height / canvas.width);
    // Copy now, before WebGL clears the frame; resizing and encoding happen off the frame.
    createImageBitmap(canvas, {resizeWidth: width, resizeHeight: height, resizeQuality: 'low'})
      .then(bitmap => {
        current.buffer.width = width;
        current.buffer.height = height;
        current.buffer.getContext('2d')?.drawImage(bitmap, 0, 0);
        bitmap.close();
        return encode(current.buffer);
      })
      .then(source => {
        if (frames.get(canvas) !== current) return;
        Object.assign(current.image.style, {
          left: `${canvas.offsetLeft}px`, top: `${canvas.offsetTop}px`,
          width: `${canvas.clientWidth}px`, height: `${canvas.clientHeight}px`,
        });
        // Idle arenas must not produce duplicate DOM mutations/uploads.
        if (current.image.src !== source) current.image.src = source;
      })
      .catch(() => { /* Recording failures must never interrupt combat. */ })
      .finally(() => { current.busy = false; });
  } catch {
    if (frame) frame.busy = false;
  }
}

export function clearLogRocketFrame(canvas: HTMLCanvasElement) {
  frames.get(canvas)?.image.remove();
  frames.delete(canvas);
}
