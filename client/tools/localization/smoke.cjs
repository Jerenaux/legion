const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({win, js, waitFor, ready, output, locale}) => {
  const root = path.join(__dirname, '../../locales', locale);
  const metadata = JSON.parse(fs.readFileSync(path.join(root, 'locale.json'), 'utf8'));
  const capture = async name => fs.writeFileSync(path.join(output, `${locale}-${name}.png`), (await win.webContents.capturePage()).toPNG());
  const fits = async selectors => {
    const failures = await js(`Array.from(document.querySelectorAll(${JSON.stringify(selectors)})).filter(element => {
      const r = element.getBoundingClientRect();
      return r.width && (r.left < -2 || r.right > innerWidth + 2 || element.scrollWidth > element.clientWidth + 2);
    }).map(element => element.className)`);
    assert.deepEqual(failures, [], `${locale}: overflowing ${selectors}`);
  };
  const readyPage = async (route, selector, name) => {
    await win.loadURL(`app://legion/${route}`);
    if (route === 'rank') {
      await waitFor('Boolean(document.querySelector(".rank-load-error"))');
      await js('rankCheck.fail = false; document.querySelector(".rank-load-error button").click()');
    }
    await waitFor(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
    await ready();
    await capture(name);
    assert.equal(await js('document.documentElement.lang'), locale);
    const text = await js('document.body.textContent');
    assert(!text.includes('[object Object]') && !text.includes('{{'), 'Unresolved translated content');
    assert(await js('Array.from(document.images).filter(img => img.loading !== "lazy" && img.getAttribute("src")).every(img => img.complete && img.naturalWidth > 0)'), 'Missing localized image');
    if (metadata.fontFamily) assert(await js(`document.fonts.check(${JSON.stringify(`16px "${metadata.fontFamily}"`)})`), 'Bundled script font failed to load');
  };
  for (const [width, height, textSize] of [[1280, 720, 100], [960, 540, 100], [1280, 720, 130]]) {
    win.setContentSize(width, height);
    await js(`localStorage.setItem('gameSettings', JSON.stringify({textSize: ${textSize}, musicVolume: 0, sfxVolume: 0}))`);
    for (const [route, selector] of [
      ['', '.title-screen-button'],
      ['team?games=12', '.roster-heading'],
      ['shop/consumables', '.shop-content'],
      ['rank', '.season-card-container'],
      ['tower', '.tower-primary'],
      ['profile/guide-local-only', '.profile-join-date'],
      ['guide', '.guide-page'],
    ]) {
      await readyPage(route, selector, `${route.split(/[/?]/)[0] || 'title'}-${width}-${textSize}`);
      await fits('.rank-content, .highlights-container, .menu, .expand_btn, .shop-tabs-container, .roster-heading, .roster-slot, .language-select, .title-screen-button, .guide-page h1, .tower-primary, .tower-choices');
      if (route === 'rank' && await js('document.querySelector(".rank-table-container").scrollWidth > document.querySelector(".rank-table-container").clientWidth')) {
        await js('document.querySelector(".rank-table-container").focus()');
        win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'Right'});
        win.webContents.sendInputEvent({type: 'keyUp', keyCode: 'Right'});
        await waitFor('document.querySelector(".rank-table-container").scrollLeft > 0');
        await js('document.querySelector(".rank-table-container").scrollLeft = 0');
      }
    }
    await readyPage('game/guide-local', '.player_bar_action', `combat-${width}-${textSize}`);
    assert.equal(await js('document.querySelector("#scene canvas").width > 0'), true);
    await fits('.player_bar_action, .player_bar_pass_turn');
    await js('document.querySelector("[data-game-menu]").click()');
    await js('document.querySelector(".game_setting").click()');
    assert(await js('document.querySelector(".language-select select").disabled'));
    await fits('.setting_menu, .language-select, .setting_menu_btn');
    await ready();
    await capture(`settings-${width}-${textSize}`);
  }
  win.setContentSize(1280, 720);
  await js("localStorage.setItem('gameSettings', JSON.stringify({textSize: 100, musicVolume: 0, sfxVolume: 0}))");
  await readyPage('shop/characters', '.shop-character-card-slot', 'recruits');
  await js('document.querySelector(".shop-character-card-slot").click()');
  await ready();
  await capture('recruit-spell');
  assert(!(await js('document.querySelector(".shop-character-card-dialog-name").textContent')).includes('undefined'));
  await readyPage('tower', '.tower-primary', 'tower-preparation');
  await js('document.querySelector(".tower-primary").click()');
  await waitFor('Boolean(document.querySelector(".tower-choices"))');
  await ready();
  await capture('tower-route');
  await fits('.tower-choices, .tower-primary');
  await js('towerCheck.progress.run.phase="battle"; towerCheck.progress.run.path=["gate"]; towerCheck.win()');
  await win.loadURL('app://legion/tower');
  await waitFor('Boolean(document.querySelector(".tower-choices"))');
  await ready();
  await capture('tower-upgrades');
  const probe = await js('localizationProbe()');
  assert(probe.text.includes('<img src=x onerror=alert(1)>&"'));
  assert.equal(probe.images, 0);
  assert.equal(probe.strong, 1);
  await readyPage('game/guide-local', '.player_bar_action', 'combat');
  await js('void combatCheck.arena.displayGEN(0)');
  await new Promise(resolve => setTimeout(resolve, 1400));
  await capture('announcement');
  for (const isWinner of [true, false]) {
    await js(`combatCheck.events.emit('gameEnd', {isWinner: ${isWinner}, xp: 120, gold: 240, chests: [], characters: [], key: 'silver'})`);
    await waitFor('Boolean(document.querySelector(".endgame"))');
    await ready();
    assert(await js(`Boolean(document.querySelector('.defeat_title').textContent.trim() || document.querySelector('.defeat_title img')?.alt)`), 'Result title must render');
    await capture(isWinner ? 'victory' : 'defeat');
  }
  if (locale === 'en') {
    await require('./live.cjs')({win, js, waitFor, ready, output});
  }
  console.log(`${locale}: menus, profile, rank, guide, large text, fonts, combat, settings, artwork and rich-text escaping pass`);
};
