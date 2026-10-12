const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({win, js, waitFor, ready, output, locale, capture}) => {
  if (!capture) return;
  await js("localStorage.setItem('displayed_popups', JSON.stringify(Array.from({length:100}, (_, i) => i)))");
  await captureLoadout({win, js, waitFor, ready, capture});
  for (const [width, height, textSize] of [[1280,720,100], [960,540,100], [1280,720,130]]) {
    win.setContentSize(width,height);
    await js(`localStorage.setItem('gameSettings', JSON.stringify({textSize:${textSize},musicVolume:0,sfxVolume:0}))`);
    for (const route of ['team?games=11', 'team?games=12&roster=6', 'play?games=5']) {
      await win.loadURL(`app://legion/${route}`);
      await waitFor('Boolean(document.querySelector(".party-member"))');
      await ready();
      fs.writeFileSync(path.join(output, `${locale}-roster-${route.includes('roster=6') ? 'full' : route.split('/')[0].split('?')[0]}-${width}-${textSize}.png`), (await win.webContents.capturePage()).toPNG());
    }
  }
};

async function captureLoadout({win, js, waitFor, ready, capture}) {
  win.setContentSize(1600, 900);
  await win.loadURL('app://legion/team?games=5');
  await waitFor('Boolean(document.querySelector(".party-member"))');
  await js('document.querySelector("[data-character-id=guide-2]").click()');
  await waitFor('Boolean(document.querySelector(".team-content-card-container"))');
  await ready();
  const crop = await js(`(() => {
    const boxes = [...document.querySelectorAll('.party-hall, .character-inventory-container > *, .team-level')].map(element => element.getBoundingClientRect());
    const left = Math.max(0, Math.floor(Math.min(...boxes.map(box => box.left))) - 4);
    const top = Math.max(0, Math.floor(Math.min(...boxes.map(box => box.top))) - 4);
    return {x: left, y: top, width: Math.ceil(Math.max(...boxes.map(box => box.right))) - left + 4, height: Math.ceil(Math.max(...boxes.map(box => box.bottom))) - top + 4};
  })()`);
  await capture('loadout', crop);
}
module.exports.captureLoadout = captureLoadout;
