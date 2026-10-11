const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({win, js, waitFor, ready, output, locale}) => {
  const capture = async name => fs.writeFileSync(path.join(output, `${locale}-${name}.png`), (await win.webContents.capturePage()).toPNG());
  const readyPage = async (route, selector, name) => {
    await win.loadURL(`app://legion/${route}`);
    if (route === 'rank') {
      await waitFor('Boolean(document.querySelector(".rank-load-error"))');
      await js('rankCheck.fail = false; document.querySelector(".rank-load-error button").click()');
    }
    await waitFor(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
    await ready();
    await capture(name);
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
      if (route === 'rank' && await js('document.querySelector(".rank-table-container").scrollWidth > document.querySelector(".rank-table-container").clientWidth')) {
        await js('document.querySelector(".rank-table-container").focus()');
        win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'Right'});
        win.webContents.sendInputEvent({type: 'keyUp', keyCode: 'Right'});
        await waitFor('document.querySelector(".rank-table-container").scrollLeft > 0');
        await js('document.querySelector(".rank-table-container").scrollLeft = 0');
      }
    }
    await readyPage('game/guide-local', '.player_bar_action', `combat-${width}-${textSize}`);
    await js('document.querySelector("[data-game-menu]").click()');
    await js('document.querySelector(".game_setting").click()');
    await ready();
    await capture(`settings-${width}-${textSize}`);
  }
  win.setContentSize(1280, 720);
  await js("localStorage.setItem('gameSettings', JSON.stringify({textSize: 100, musicVolume: 0, sfxVolume: 0}))");
  await readyPage('shop/characters', '.shop-character-card-slot', 'recruits');
  await js('document.querySelector(".shop-character-card-slot").click()');
  await ready();
  await capture('recruit-spell');
  await readyPage('tower', '.tower-primary', 'tower-preparation');
  await js('document.querySelector(".tower-primary").click()');
  await waitFor('Boolean(document.querySelector(".tower-choices"))');
  await ready();
  await capture('tower-route');
  await js('towerCheck.progress.run.phase="battle"; towerCheck.progress.run.path=["gate"]; towerCheck.win()');
  await win.loadURL('app://legion/tower');
  await waitFor('Boolean(document.querySelector(".tower-choices"))');
  await ready();
  await capture('tower-upgrades');
  await readyPage('game/guide-local', '.player_bar_action', 'combat');
  await js('void combatCheck.arena.displayGEN(0)');
  await new Promise(resolve => setTimeout(resolve, 1400));
  await capture('announcement');
  for (const isWinner of [true, false]) {
    await js(`combatCheck.events.emit('gameEnd', {isWinner: ${isWinner}, xp: 120, gold: 240, grade: 'A', chests: [], characters: [], key: 'silver'})`);
    await waitFor('Boolean(document.querySelector(".endgame"))');
    await ready();
    await capture(isWinner ? 'victory' : 'defeat');
  }
  if (locale === 'en') {
    await require('./live.cjs')({win, js, waitFor, ready, output});
  }
  console.log(`${locale}: menus, profile, rank, guide, large text, fonts, combat, settings, artwork and rich-text escaping pass`);
};
