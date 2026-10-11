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
  }
  await js(`window.dispatchEvent(new CustomEvent('legion:desktop-action', {detail: {action: 'menu-up', source: 'gamepad'}}))`);
  await js(`window.dispatchEvent(new CustomEvent('legion:desktop-action', {detail: {action: 'confirm', source: 'gamepad'}}))`);
  await js(`window.dispatchEvent(new CustomEvent('legion:desktop-action', {detail: {action: 'menu-down', source: 'gamepad'}}))`);
  win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'Return'});
  win.webContents.sendInputEvent({type: 'keyUp', keyCode: 'Return'});
  await waitFor('!document.querySelector(".team-reveal-overlay")');
  await waitFor('Boolean(document.querySelector(".tutorial-intro[open]"))');
  assert.equal(timingChecks.get('timing-first').acks, 0, 'The briefing must hold combat readiness regardless of the tips preference');
  for (let step = 0; step < 3; step++) {
    await js(`document.querySelectorAll('.tutorial-intro-steps button')[${step}].click()`);
    await waitFor('Array.from(document.querySelectorAll(".tutorial-intro img")).every(image => image.complete && image.naturalWidth > 0)');
    assert.equal(timingChecks.get('timing-first').acks, 0, 'Changing briefing steps must not start the timer');
    await shot(`briefing-${step}`);
  }
  await js('document.querySelector(".tutorial-intro-back").click()');
  win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'Z'});
  win.webContents.sendInputEvent({type: 'keyUp', keyCode: 'Z'});
  assert.equal(timingChecks.get('timing-first').acks, 0, 'Combat shortcuts must not escape the briefing');
  await js('document.querySelector(".tutorial-intro-skip").click()');
  await waitFor(() => timingChecks.get('timing-first').acks === 1);

  // Saved opt-out is reflected when the opening is shown again.
  await win.loadURL(`app://legion/game/timing-first?socketURL=${encodeURIComponent(sinkURL)}`);
  await waitFor('Boolean(document.querySelector(".team-reveal-tips input"))');
  await js('document.querySelector(".team-reveal-tips input").click()');
  await js('document.querySelector(".team-reveal-play-button").click()');
  await waitFor('Boolean(document.querySelector(".tutorial-intro[open]"))');
  assert.equal(timingChecks.get('timing-first').acks, 0, 'The briefing must hold combat readiness regardless of the tips preference');
  await js('document.querySelector(".tutorial-intro-skip").click()');
  await waitFor(() => timingChecks.get('timing-first').acks === 1);
  await win.loadURL('app://legion/game/guide-local');
  await waitFor('Boolean(combatCheck.arena?.gameInitialized)');
  await js('combatCheck.events.emit("combatTipsVisibility", true); combatCheck.arena.refreshTutorial()');
  await waitFor('Boolean(document.querySelector(".combat-coach-panel"))');
  await shot('960-130-coach');
  await js('document.querySelector(".combat-coach-close").click()');
  await waitFor('Boolean(document.querySelector(".combat-coach-reopen"))');
  await js('document.querySelector(".combat-coach-reopen").click()');
  await waitFor('Boolean(document.querySelector(".combat-coach-panel"))');
  win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'Z'});
  win.webContents.sendInputEvent({type: 'keyUp', keyCode: 'Z'});
  await waitFor('combatCheck.arena.selectedPlayer.pendingSpell === 0');
  await shot('960-130-targeting');
  console.log(`${locale}: party, saved tips preference, keyboard start, ready acknowledgement, and in-battle toggle pass`);
};
