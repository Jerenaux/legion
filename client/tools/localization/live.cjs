const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({win, js, waitFor, ready, output}) => {
  const locales = fs.readdirSync(path.join(__dirname, '../../locales')).filter(code => fs.existsSync(path.join(__dirname, '../../locales', code, 'locale.json')));
  const catalog = code => JSON.parse(fs.readFileSync(path.join(__dirname, '../../locales', code, 'messages.json'), 'utf8'));
  const capture = async name => fs.writeFileSync(path.join(output, `live-${name}.png`), (await win.webContents.capturePage()).toPNG());
  const switchTo = async code => {
    await js(`window.livePicker = document.querySelector('.language-select select'); livePicker.focus(); livePicker.value=${JSON.stringify(code)}; livePicker.dispatchEvent(new Event('change', {bubbles:true}));`);
    await waitFor(`document.documentElement.lang === ${JSON.stringify(code)} && !document.querySelector('.language-select select').disabled`);
    await ready();
    assert(await js('window.liveDocument === document && window.livePicker === document.querySelector(".language-select select")'), 'Switch reloaded or remounted the interface');
    assert(await js('document.activeElement === livePicker'), 'Switch lost keyboard focus');
    assert.equal(await js('localStorage.getItem("legion.language")'), code);
    assert(!(await js('document.body.textContent')).includes('{{'), 'Unresolved interpolation after language switch');
    const metadata = JSON.parse(fs.readFileSync(path.join(__dirname, '../../locales', code, 'locale.json'), 'utf8'));
    if (metadata.fontFamily) assert(await js(`document.fonts.check(${JSON.stringify(`16px "${metadata.fontFamily}"`)})`), 'Script font not ready');
    else assert.equal(await js('document.documentElement.style.getPropertyValue("--locale-font")'), '');
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
    assert.equal(await js('document.querySelector(".title-screen-button").textContent'), catalog(code).Play);
    assert(!(await js('Boolean(document.querySelector(".language-select button"))')), 'Obsolete Apply button');
    await capture(`title-${code}`);
  }
  win.setContentSize(1280, 720);
  await win.loadURL('app://legion/shop/equipment');
  await waitFor('Boolean(document.querySelector(".shop-content"))');
  await openSettings();
  await js('window.liveDocument = document; window.liveSettings = document.querySelector(".setting_menu"); window.liveTab = document.querySelector(".shop-content"); true');
  const englishArt = await js('document.querySelector(".menuItem").src');
  for (const code of ['pt-BR', 'ja', 'ru', 'en']) {
    await switchTo(code);
    assert(await js('liveSettings === document.querySelector(".setting_menu") && liveTab === document.querySelector(".shop-content")'), 'Open settings or shop state was reset');
    assert((await js('document.querySelector(".setting_menu").textContent')).includes(catalog(code)['Text size']));
    assert((await js('document.querySelector(".shop-tabs-container").textContent')).includes(catalog(code).Equipment));
    const art = await js('document.querySelector(".menuItem").src');
    if (code === 'en') assert.equal(art, englishArt);
    else assert.notEqual(art, englishArt, 'Navbar artwork did not update');
    await capture(`settings-${code}`);
  }
  await js('document.querySelector(".setting_menu [data-desktop-cancel]").click()');
  await js(`document.querySelector('.dropdown-content a[href="/guide"]').click()`);
  await waitFor('Boolean(document.querySelector(".guide-page"))');
  const englishGuide = await js('document.querySelector(".guide-page img").src');
  await openSettings();
  await switchTo('pt-BR');
  assert.notEqual(await js('document.querySelector(".guide-page img").src'), englishGuide, 'Guide screenshot stayed English');
  assert((await js('document.querySelector(".guide-index").textContent')).includes(catalog('pt-BR')['Matches & modes']));
  await js('document.querySelector(".setting_menu [data-desktop-cancel]").click()');
  await capture('guide-pt-BR');
  // Enter combat without a page load: freshly created Phaser text and result art must use the menu choice.
  await js('const link = document.createElement("a"); link.href="/game/guide-local"; document.body.append(link); link.click(); link.remove()');
  await waitFor('Boolean(document.querySelector(".player_bar_action"))');
  assert(await js('liveDocument === document'), 'Navigation unexpectedly reloaded the app');
  assert((await js('document.body.textContent')).includes(catalog('pt-BR')['Pass Turn']));
  await js('combatCheck.events.emit("gameEnd", {isWinner:true,xp:120,gold:240,chests:[],characters:[],key:"silver"})');
  await waitFor('Boolean(document.querySelector(".endgame"))');
  await ready();
  assert.equal(await js('document.querySelector(".defeat_title img").alt'), catalog('pt-BR')['Victory!']);
  await capture('victory-pt-BR');
  await win.loadURL('app://legion/');
  await waitFor('document.documentElement.lang === "pt-BR"');
  console.log(`Live language switching: all ${locales.length} locales, preserved document/focus/dialogs, fonts, menu/guide/result artwork and saved choice pass`);
};
