const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Actual first-match routing and preference persistence, with screenshots for manual review.
module.exports = async ({win, js, waitFor, ready, output, locale, sinkURL, timingChecks}) => {
  const shot = async name => {
    await ready();
    fs.writeFileSync(path.join(output, `tutorial-${locale}-${name}.png`), (await win.webContents.capturePage()).toPNG());
  };
  await win.loadURL('app://legion/');
  for (const [width, height, size] of [[1280, 720, 100], [800, 600, 130], [960, 540, 130]]) {
    win.setContentSize(width, height);
    await js(`localStorage.setItem('gameSettings', JSON.stringify({...JSON.parse(localStorage.getItem('gameSettings')), textSize: ${size}}))`);
    await win.loadURL(`app://legion/game/timing-first?socketURL=${encodeURIComponent(sinkURL)}`);
    await waitFor('document.querySelectorAll(".team-reveal-champion").length === 3');
    await shot(`${width}-${size}-party`);
    assert.equal(timingChecks.get('timing-first').acks, 0, 'Viewing the party must not start the match');
    assert.deepEqual(await js(`Array.from(document.querySelectorAll('.team-reveal-champion, .team-reveal-title, .team-reveal-actions')).filter(el => {
      const r = el.getBoundingClientRect();
      return r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight || el.scrollWidth > el.clientWidth + 1;
    }).map(el => el.className)`), [], 'Party and battle controls must remain on screen at enlarged text sizes');
  }
  assert.equal(await js('document.activeElement.className'), 'team-reveal-play-button');
  await js(`window.dispatchEvent(new CustomEvent('legion:desktop-action', {detail: {action: 'menu-up', source: 'gamepad'}}))`);
  assert.equal(await js('document.activeElement.type'), 'checkbox');
  await js(`window.dispatchEvent(new CustomEvent('legion:desktop-action', {detail: {action: 'confirm', source: 'gamepad'}}))`);
  assert.equal(await js('document.querySelector(".team-reveal-tips input").checked'), false);
  await js(`window.dispatchEvent(new CustomEvent('legion:desktop-action', {detail: {action: 'menu-down', source: 'gamepad'}}))`);
  assert.equal(await js('document.activeElement.className'), 'team-reveal-play-button');
  win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'Return'});
  win.webContents.sendInputEvent({type: 'keyUp', keyCode: 'Return'});
  await waitFor('!document.querySelector(".team-reveal-overlay")');
  assert.equal(await js('localStorage.getItem("legion-combat-tips")'), 'hidden');
  await waitFor(() => timingChecks.get('timing-first').acks === 1);
  assert.equal(await js('Boolean(document.querySelector(".combat-coach-panel"))'), false, 'Unchecked tips stay hidden when combat starts');

  // Saved opt-out is reflected when the opening is shown again.
  await win.loadURL(`app://legion/game/timing-first?socketURL=${encodeURIComponent(sinkURL)}`);
  await waitFor('Boolean(document.querySelector(".team-reveal-tips input"))');
  assert.equal(await js('document.querySelector(".team-reveal-tips input").checked'), false);
  await js('document.querySelector(".team-reveal-tips input").click()');
  await waitFor('document.querySelector(".team-reveal-check").textContent === "✓"');
  await js('document.querySelector(".team-reveal-play-button").click()');
  await waitFor(() => timingChecks.get('timing-first').acks === 1);
  assert.equal(await js('localStorage.getItem("legion-combat-tips")'), 'shown');
  await win.loadURL('app://legion/game/guide-local');
  await waitFor('Boolean(combatCheck.arena?.gameInitialized)');
  await js('combatCheck.events.emit("combatTipsVisibility", true); combatCheck.arena.refreshTutorial()');
  await waitFor('Boolean(document.querySelector(".combat-coach-panel"))');
  await shot('960-130-coach');
  await js('document.querySelector(".combat-coach-close").click()');
  await waitFor('Boolean(document.querySelector(".combat-coach-reopen"))');
  assert.equal(await js('localStorage.getItem("legion-combat-tips")'), 'hidden');
  await js('document.querySelector(".combat-coach-reopen").click()');
  await waitFor('Boolean(document.querySelector(".combat-coach-panel"))');
  assert.equal(await js('localStorage.getItem("legion-combat-tips")'), 'shown');
  win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'Z'});
  win.webContents.sendInputEvent({type: 'keyUp', keyCode: 'Z'});
  await waitFor('Boolean(document.querySelector(".combat-coach-facts"))');
  await shot('960-130-targeting');
  console.log(`${locale}: party, saved tips preference, keyboard start, ready acknowledgement, and in-battle toggle pass`);
};
