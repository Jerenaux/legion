const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({win, js, waitFor, ready, output, baseline}) => {
  fs.mkdirSync(output, {recursive: true});
  win.showInactive();
  const shot = async name => {
    await ready();
    fs.writeFileSync(path.join(output, `${name}.png`), (await win.webContents.capturePage()).toPNG());
  };
  const fits = async selector => {
    const failures = await js(`Array.from(document.querySelectorAll(${JSON.stringify(selector)})).filter(el => {
      const r = el.getBoundingClientRect();
      return r.width && r.height && (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1 || (!el.matches(".player_bar_pass_turn") && el.scrollWidth > el.clientWidth + 1));
    }).map(el => ({class: el.className, text: el.textContent, width: el.clientWidth, scroll: el.scrollWidth}))`);
    assert.deepEqual(failures, [], `${selector} must fit: ${JSON.stringify(failures)}`);
  };
  const openSP = async () => {
    await js('document.querySelector(".info-bar-plus").click()');
    await waitFor('Boolean(document.querySelector(".character-info-dialog-container"))');
  };
  const cancelSP = async () => {
    await js('document.querySelector(".dialog-decline").click()');
    await waitFor('!document.querySelector(".ReactModal__Content")');
  };
  const openSettings = async () => {
    await js('if (document.querySelector(".expand_btn_trigger").getAttribute("aria-expanded") !== "true") document.querySelector(".expand_btn_trigger").click()');
    await waitFor('Array.from(document.querySelectorAll("button")).some(el => el.textContent.trim() === "Settings")');
    await js('Array.from(document.querySelectorAll("button")).find(el => el.textContent.trim() === "Settings").click()');
    await waitFor('Boolean(document.querySelector("#text-size"))');
  };
  win.setContentSize(1280, 720);
  await win.loadURL('app://legion/team/guide-2');
  await waitFor('Boolean(document.querySelector(".info-bar-plus"))');
  await ready();
  await openSP();
  await shot('sp-dialog');
  await js('document.querySelector(".dialog-accept").click()');
  await waitFor('Boolean(document.querySelector(".dialog-SP-modal"))');
  await shot('sp-confirmation');
  await cancelSP();
  if (baseline) return;
  for (const [width, height] of [[1280, 720], [960, 540], [800, 600]]) {
    win.setContentSize(width, height);
    for (const size of [100, 115, 130]) {
      await openSettings();
      if (width === 1280 && size === 100) {
        await js(`document.querySelector('#text-size').focus(); window.dispatchEvent(new CustomEvent('legion:desktop-action', {detail: {action: 'menu-right', source: 'gamepad'}}))`);
        await waitFor(`JSON.parse(localStorage.getItem('gameSettings'))?.textSize === 115`);
        await js(`window.dispatchEvent(new CustomEvent('legion:desktop-action', {detail: {action: 'menu-left', source: 'gamepad'}}))`);
        await waitFor(`JSON.parse(localStorage.getItem('gameSettings'))?.textSize === 100`);
      }
      await js(`(() => {const select = document.querySelector('#text-size'); select.value = '${size}'; select.dispatchEvent(new Event('change', {bubbles: true}));})()`);
      await waitFor(`(JSON.parse(localStorage.getItem('gameSettings'))?.textSize ?? 100) === ${size}`);
      assert.equal(await js('getComputedStyle(document.documentElement).fontSize'), `${16 * size / 100}px`);
      await fits('.settings-modal-container, #text-size');
      assert(await js('document.querySelector(".setting_menu").scrollWidth <= document.querySelector(".setting_menu").clientWidth + 1'), 'Settings must not overflow horizontally');
      if (size === 130) await shot(`settings-${width}-130`);
      await js('document.querySelector(".setting_menu [data-desktop-cancel]").scrollIntoView({block: "nearest"})');
      await fits('.setting_menu [data-desktop-cancel]');
      await js('document.querySelector(".setting_menu [data-desktop-cancel]").click()');
      await waitFor('!document.querySelector("#text-size")');
      await openSP();
      await fits('.ReactModal__Content, .character-info-dialog-container, .character-info-dialog-control, .dialog-button-container button');
      const count = '.character-info-dialog-control-val';
      await js('document.querySelectorAll(".character-info-dialog-control-btn")[1].click()');
      await waitFor(`document.querySelector('${count}').textContent === '2'`);
      await js('document.querySelectorAll(".character-info-dialog-control-btn")[0].click()');
      await waitFor(`document.querySelector('${count}').textContent === '1'`);
      if (size === 130) await shot(`sp-dialog-${width}-130`);
      await js('document.querySelector(".dialog-accept").click()');
      await waitFor('Boolean(document.querySelector(".dialog-SP-modal"))');
      await fits('.ReactModal__Content, .dialog-SP-modal, .dialog-spell-modal-text, .dialog-button-container button');
      await cancelSP(); // Never submit permanent stat changes during layout checks.
    }
    for (const route of ['play', 'shop', 'shop/equipments', 'shop/spells', 'guide', 'game/guide-local']) {
      await win.loadURL(`app://legion/${route}`);
      await waitFor(route.startsWith('game') ? 'Boolean(document.querySelector(".player_bar_action"))' : 'Boolean(document.querySelector(".expand_btn_trigger"))');
      assert.equal(await js('getComputedStyle(document.documentElement).fontSize'), '20.8px', 'Text size survives reload');
      await shot(`${route.startsWith('game') ? 'game' : route.replace('/', '-')}-${width}-130`);
      if (route === 'guide') await fits('.guide-page');
      if (route.startsWith('shop')) assert(await js('document.querySelector(".shop-container").scrollWidth <= innerWidth'), 'Shop must reflow within the window');
      if (route.startsWith('game')) await fits('.player_bar_action, .player_bar_pass_turn, .player_bar_pass_turn span, .player_bar_stat_value, .player_bar_action_name');
    }
    await win.loadURL('app://legion/team/guide-2');
    await waitFor('Boolean(document.querySelector(".info-bar-plus"))');
  }
  // Refresh the guide's action-bar crop because the labels/buttons now reflow.
  win.setContentSize(1600, 900);
  await js(`localStorage.setItem('gameSettings', JSON.stringify({...JSON.parse(localStorage.getItem('gameSettings')), textSize: 100}))`);
  await win.loadURL('app://legion/game/guide-local');
  await waitFor('Boolean(document.querySelector(".player_bar_action"))');
  await ready();
  fs.writeFileSync(path.join(output, 'guide-actions.jpg'), (await win.webContents.capturePage({x: 400, y: 790, width: 960, height: 110})).toJPEG(88));
  console.log('Text size persistence, SP controls, confirmation and compact layouts pass');
};
