const assert = require('node:assert/strict');
module.exports = async ({logrocket, js}) => {
  const deadline = Date.now() + 60000;
  let recorded;
  do {
    recorded = Buffer.concat(logrocket.uploads).toString('utf8');
    if (recorded.includes('visible-replay-input') && recorded.includes('data:image/webp;base64,')) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  } while (Date.now() < deadline);
  for (const value of ['visible-replay-text', 'visible-replay-input', 'data:image/webp;base64,']) {
    assert(recorded.includes(value), `LogRocket must upload ${value} to the local sink`);
  }
  assert(!recorded.includes('private-replay-'), 'LogRocket must redact passwords and private network data');
  // Players must not see stale snapshots through the transparent canvas (motion trails),
  // while replays must: the hiding attribute stays live-only.
  assert.equal(await js(`(images => images.length > 0 && images.every(image => getComputedStyle(image).visibility === 'hidden'))([...document.querySelectorAll('[data-logrocket-canvas]')])`), true,
    'Combat snapshots must be invisible to the player');
  assert(!/data-replay-only[\s\S]{1,4}\["live"\]/.test(recorded), 'Recorded snapshots must not carry the live-only hiding attribute');
  const pixels = Array.from(recorded.matchAll(/data:image\/webp;base64,[A-Za-z0-9+/=]+/g), match => match[0]).slice(-10);
  assert(pixels.length, 'LogRocket uploads must include encoded combat pixels');
  assert(await js(`(async () => {
    for (const source of ${JSON.stringify(pixels)}) {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, 32, 32);
    if (new Set(new Uint32Array(context.getImageData(0, 0, 32, 32).data.buffer)).size > 20) return true;
    }
    return false;
  })()`), 'LogRocket combat snapshots must contain nonblank pixels');
  console.log('LogRocket: visible DOM, ordinary inputs and combat snapshots delivered locally; passwords and network data scrubbed');
};
