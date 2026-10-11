const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({win, js, waitFor, ready, output}) => {
  const locales = fs.readdirSync(path.join(__dirname, '../../locales')).filter(code => fs.existsSync(path.join(__dirname, '../../locales', code, 'locale.json')));
  const capture = async name => fs.writeFileSync(path.join(output, `live-${name}.png`), (await win.webContents.capturePage()).toPNG());
  const switchTo = async code => {
    await js(`window.livePicker = document.querySelector('.language-select select'); livePicker.focus(); livePicker.value=${JSON.stringify(code)}; livePicker.dispatchEvent(new Event('change', {bubbles:true}));`);
    await waitFor(`document.documentElement.lang === ${JSON.stringify(code)} && !document.querySelector('.language-select select').disabled`);
    await ready();
  };
  const openSettings = async () => {
    await js('document.querySelector(".expand_btn_trigger").click()');
    await waitFor('document.querySelector(".expand_btn_trigger").getAttribute("aria-expanded") === "true"');
    await js('Array.from(document.querySelectorAll(".dropdown-content button")).at(-1).click()');
    await waitFor('Boolean(document.querySelector(".setting_menu"))');
  };
  await win.loadURL('app://legion/');
  await waitFor('Boolean(document.querySelector(".title-screen-button"))');
  await js('window.liveDocument = document; true');
  win.setContentSize(960, 540);
  // Text size is read at startup, so prepare the compact/enlarged case before the live switches.
  await js("localStorage.setItem('gameSettings', JSON.stringify({textSize:130,musicVolume:0,sfxVolume:0}))");
  await win.loadURL('app://legion/');
  await waitFor('Boolean(document.querySelector(".title-screen-button"))');
  await js('window.liveDocument = document; true');
  for (const code of [...locales.filter(code => code !== 'en'), 'en']) {
    await switchTo(code);
    await capture(`title-${code}`);
  }
  win.setContentSize(1280, 720);
  await win.loadURL('app://legion/shop/equipment');
  await waitFor('Boolean(document.querySelector(".shop-content"))');
  await openSettings();
  await js('window.liveDocument = document; window.liveSettings = document.querySelector(".setting_menu"); window.liveTab = document.querySelector(".shop-content"); true');
  for (const code of ['pt-BR', 'ja', 'ru', 'en']) {
    await switchTo(code);
    await capture(`settings-${code}`);
  }
  await js('document.querySelector(".setting_menu [data-desktop-cancel]").click()');
  await js(`document.querySelector('.dropdown-content a[href="/guide"]').click()`);
  await waitFor('Boolean(document.querySelector(".guide-page"))');
  await openSettings();
  await switchTo('pt-BR');
  await js('document.querySelector(".setting_menu [data-desktop-cancel]").click()');
  await capture('guide-pt-BR');
  // Enter combat without a page load: freshly created Phaser text and result art must use the menu choice.
  await js('const link = document.createElement("a"); link.href="/game/guide-local"; document.body.append(link); link.click(); link.remove()');
  await waitFor('Boolean(document.querySelector(".player_bar_action"))');
  await js('combatCheck.events.emit("gameEnd", {isWinner:true,xp:120,gold:240,chests:[],characters:[],key:"silver"})');
  await waitFor('Boolean(document.querySelector(".endgame"))');
  await ready();
  await capture('victory-pt-BR');
  await win.loadURL('app://legion/');
  await waitFor('document.documentElement.lang === "pt-BR"');
  console.log(`Live language switching: all ${locales.length} locales, preserved document/focus/dialogs, fonts, menu/guide/result artwork and saved choice pass`);
};
