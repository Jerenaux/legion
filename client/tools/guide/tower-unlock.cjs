const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({win, js, waitFor, ready, output, locale}) => {
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../../locales', locale, 'messages.json'), 'utf8'));
  // Ranked and the Tower share one locked phrasing: "Play N more games to unlock".
  const gamesToUnlock = count => catalog[`gamesToUnlock_${new Intl.PluralRules(locale).select(count)}`].replace('{{count}}', String(count));
  const capture = async name => fs.writeFileSync(path.join(output, `${locale}-tower-unlock-${name}.png`), (await win.webContents.capturePage()).toPNG());
  for (const [width, height, textSize] of [[1280, 720, 100], [960, 540, 100], [1280, 720, 130]]) {
    win.setContentSize(width, height);
    await win.loadURL('app://legion/play');
    await js(`localStorage.setItem('gameSettings', JSON.stringify({textSize:${textSize}, musicVolume:0, sfxVolume:0})); localStorage.setItem('displayed_popups', JSON.stringify(Array.from({length:100}, (_, i) => i))); localStorage.removeItem('tower-fixture')`);
    for (const games of [0, 5, 6]) {
      await win.loadURL(`app://legion/play?games=${games}`);
      await waitFor('Boolean(document.querySelector("[data-playmode=tower]"))');
      const locked = games < 6;
      assert.equal(await js('document.querySelector("[data-playmode=tower]").disabled'), locked);
      if (locked) {
        const text = await js('document.querySelector("[data-playmode=tower]").textContent');
        assert(text.includes(gamesToUnlock(6 - games)), 'Locked card must show the games left, worded like Ranked');
        await js('document.querySelector("[data-playmode=tower]").click()');
        assert.equal(await js('location.pathname'), '/play', 'Locked card must not navigate');
        await js('document.querySelector("[data-playmode=tower]").scrollIntoView({block:"center"})');
        await ready();
        await capture(`card-${games}-${width}-${textSize}`);
        assert(await js('document.querySelector("[data-playmode=tower]").scrollHeight <= document.querySelector("[data-playmode=tower]").clientHeight + 2'), 'Locked card content must fit');
      } else {
        await js('document.querySelector("[data-playmode=tower]").click()');
        await waitFor('Boolean(document.querySelector(".tower-introduction"))');
        assert.equal(await js('location.pathname'), '/tower');
      }
    }
    await win.loadURL('app://legion/tower?games=5');
    await waitFor('Boolean(document.querySelector(".tower-locked"))');
    assert.deepEqual(await js('towerCheck.requests'), [], 'Locked direct route must not load/start an expedition');
    assert((await js('document.querySelector(".tower-locked").textContent')).includes(gamesToUnlock(1)), 'Locked Tower page must use the shared unlock wording');
    assert.equal(await js('Boolean(document.querySelector("button.tower-primary"))'), false);
    await ready(); await capture(`direct-${width}-${textSize}`);
    await win.loadURL('app://legion/tower?games=6');
    await waitFor('Boolean(document.querySelector(".tower-introduction"))');
    await ready(); await capture(`intro-${width}-${textSize}`);
    assert.equal(await js('document.querySelector(".tower-introduction").textContent'), catalog['Lead a temporary squad. Your roster stays untouched. HP, MP and supplies carry between floors; turns have no time limit.']);
    assert(await js('document.querySelector(".tower-page").scrollWidth <= document.querySelector(".tower-page").clientWidth'), 'Tower guidance must fit horizontally');
    await js('document.querySelector(".tower-primary").click()');
    await waitFor('Boolean(document.querySelector(".tower-choice"))');
    assert.equal(await js('Boolean(document.querySelector(".tower-introduction"))'), false, 'Entry explanation must not repeat after starting');
    await js('towerCheck.progress.run.phase="battle"; towerCheck.progress.run.path=["gate"]; towerCheck.win()');
    await win.loadURL('app://legion/tower?games=6');
    await waitFor('Boolean(document.querySelector(".tower-introduction"))');
    await ready(); await capture(`choice-${width}-${textSize}`);
    assert.equal(await js('document.querySelector(".tower-introduction").textContent'), catalog['Choose one preparation for this expedition. Restore your squad, refill supplies or learn a spell before the next floor.']);
    await js('document.querySelector(".tower-choice").click()');
    await waitFor('!document.querySelector(".tower-introduction")');
  }
  // Exercise the real combined milestone popup when player data finishes loading.
  await js("localStorage.setItem('displayed_popups', JSON.stringify(Array.from({length:100}, (_, i) => i).filter(i => i !== 15)))");
  await win.loadURL('app://legion/play?games=6&loading');
  await js('titleLoadingCheck.finish()');
  await waitFor('Boolean(document.querySelector(".unlocked-feature"))');
  assert((await js('document.querySelector(".unlocked-feature").textContent')).includes(catalog['Cinder Tower & more spells']));
  await ready(); await capture('announcement');
  await js('document.querySelector(".unlocked-feature-button.secondary").click()');
  await waitFor('!document.querySelector(".unlocked-feature")');
  await win.loadURL('app://legion/play?games=6&loading');
  await js('titleLoadingCheck.finish()'); await ready();
  assert.equal(await js('Boolean(document.querySelector(".unlocked-feature"))'), false, 'Dismissed unlock announcement must not repeat');
  await js('localStorage.removeItem("tower-fixture"); localStorage.removeItem("displayed_popups"); localStorage.setItem("gameSettings", JSON.stringify({textSize:100,musicVolume:0,sfxVolume:0}))');
  win.setContentSize(1600, 900);
  console.log(`${locale}: Tower unlock boundary, direct route, one-time announcement and staged guidance pass`);
};
