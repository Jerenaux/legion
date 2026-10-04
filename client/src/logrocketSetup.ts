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
const frames = new WeakMap<HTMLCanvasElement, {image: HTMLImageElement; buffer: HTMLCanvasElement; time: number}>();
export function captureLogRocketFrame(canvas: HTMLCanvasElement) {
  if (!logRocket || document.hidden || !canvas.parentElement || !canvas.width || !canvas.height) return;
  const now = performance.now();
  let frame = frames.get(canvas);
  if (frame && now - frame.time < 500) return;
  try {
    if (!frame) {
      const image = document.createElement('img');
      image.dataset.logrocketCanvas = '';
      image.dataset.sentryBlock = '';
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      image.style.cssText = 'position:absolute;pointer-events:none;z-index:-1;';
      // Isolate the negative layer inside the existing scene, above its background.
      canvas.parentElement.style.isolation = 'isolate';
      canvas.parentElement.insertBefore(image, canvas);
      frame = {image, buffer: document.createElement('canvas'), time: now};
      frames.set(canvas, frame);
    }
    frame.time = now;
    frame.buffer.width = Math.min(960, canvas.width);
    frame.buffer.height = Math.round(frame.buffer.width * canvas.height / canvas.width);
    const context = frame.buffer.getContext('2d');
    if (!context) return;
    context.drawImage(canvas, 0, 0, frame.buffer.width, frame.buffer.height);
    Object.assign(frame.image.style, {
      left: `${canvas.offsetLeft}px`, top: `${canvas.offsetTop}px`,
      width: `${canvas.clientWidth}px`, height: `${canvas.clientHeight}px`,
    });
    const source = frame.buffer.toDataURL('image/webp', 0.7);
    // Idle arenas must not produce duplicate DOM mutations/uploads.
    if (frame.image.src !== source) frame.image.src = source;
  } catch { /* Recording failures must never interrupt combat. */ }
}

export function clearLogRocketFrame(canvas: HTMLCanvasElement) {
  frames.get(canvas)?.image.remove();
  frames.delete(canvas);
}
