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
  const pixels = recorded.match(/data:image\/webp;base64,[A-Za-z0-9+/=]+/)?.[0];
  assert(pixels, 'LogRocket uploads must include encoded combat pixels');
  assert(await js(`(async () => {
    const image = new Image();
    image.src = ${JSON.stringify(pixels)};
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, 32, 32);
    return new Set(new Uint32Array(context.getImageData(0, 0, 32, 32).data.buffer)).size > 20;
  })()`), 'LogRocket combat snapshots must contain nonblank pixels');
  console.log('LogRocket: visible DOM, ordinary inputs and combat snapshots delivered locally; passwords and network data scrubbed');
};
