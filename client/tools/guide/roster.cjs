const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({win, js, waitFor, ready, output, locale, capture}) => {
  for (const page of ['team', 'play']) {
    for (const [games, size] of [[0, 3], [11, 3], [12, 3], [12, 5], [12, 6]]) {
      await win.loadURL(`app://legion/${page}?games=${games}&roster=${size}`);
      await waitFor('Boolean(document.querySelector(".roster-heading"))');
      assert.equal(await js('document.querySelectorAll(".roster-character").length'), size);
      assert.equal(await js('document.querySelectorAll(".roster-slot").length'), size < 6 ? 1 : 0);
      assert.equal(await js('Boolean(document.querySelector(".roster-slot--available"))'), games >= 12 && size < 6);
      assert.equal(await js('document.querySelector(".roster-unlock progress")?.value'), games < 12 ? games : undefined);
      assert.equal(await js('document.querySelectorAll(".roster-capacity-marks .is-filled").length'), size);
      if (games === 11) assert((await js('document.querySelector(".roster-unlock-label strong").textContent')).includes('1'));
      if (games < 12) assert.equal(await js('document.querySelectorAll(".rosterContainer a").length'), 0);
      if (size === 6) assert.equal(await js('Boolean(document.querySelector(".roster-unlock"))'), false);
    }
  }
  await win.loadURL('app://legion/team?games=12');
  await waitFor('Boolean(document.querySelector(".roster-slot--available"))');
  await js('document.querySelector(".roster-character").focus()');
  win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'Return'});
  win.webContents.sendInputEvent({type: 'keyUp', keyCode: 'Return'});
  await waitFor('location.pathname === "/team/guide-0"');
  assert.equal(await js('document.querySelector(".roster-character[aria-pressed=true]").dataset.characterId'), 'guide-0');
  assert.equal(await js('document.querySelector(".team-content-card-container").dataset.class'), 'WARRIOR');
  await js('document.querySelector(".roster-slot--available").click()');
  assert.equal(await js('location.pathname'), '/shop/characters');
  console.log(`${locale}: roster selection, keyboard activation, capacity, recruitment progress and Shop navigation pass`);

  if (!capture) return;
  await js("localStorage.setItem('displayed_popups', JSON.stringify(Array.from({length:100}, (_, i) => i)))");
  await captureLoadout({win, js, waitFor, ready, capture});
  for (const [width, height, textSize] of [[1280,720,100], [960,540,100], [1280,720,130]]) {
    win.setContentSize(width,height);
    await js(`localStorage.setItem('gameSettings', JSON.stringify({textSize:${textSize},musicVolume:0,sfxVolume:0}))`);
    for (const route of ['team?games=11', 'team?games=12&roster=6', 'play?games=5']) {
      await win.loadURL(`app://legion/${route}`);
      await waitFor('Boolean(document.querySelector(".roster-character"))');
      await ready();
      fs.writeFileSync(path.join(output, `${locale}-roster-${route.includes('roster=6') ? 'full' : route.split('/')[0].split('?')[0]}-${width}-${textSize}.png`), (await win.webContents.capturePage()).toPNG());
    }
  }
};

async function captureLoadout({win, js, waitFor, ready, capture}) {
  win.setContentSize(1600, 900);
  await win.loadURL('app://legion/team?games=5');
  await waitFor('Boolean(document.querySelector(".roster-character"))');
  await js('document.querySelector("[data-character-id=guide-2]").click()');
  await waitFor('Boolean(document.querySelector(".team-content-card-container"))');
  await ready();
  const crop = await js(`(() => {
    const boxes = [...document.querySelectorAll('.rosterContainer, .character-inventory-container > *, .team-level')].map(element => element.getBoundingClientRect());
    const left = Math.max(0, Math.floor(Math.min(...boxes.map(box => box.left))) - 4);
    const top = Math.max(0, Math.floor(Math.min(...boxes.map(box => box.top))) - 4);
    return {x: left, y: top, width: Math.ceil(Math.max(...boxes.map(box => box.right))) - left + 4, height: Math.ceil(Math.max(...boxes.map(box => box.bottom))) - top + 4};
  })()`);
  await capture('loadout', crop);
}
module.exports.captureLoadout = captureLoadout;
