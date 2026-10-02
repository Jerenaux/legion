// Exercise real DOM/Phaser pointer routing, not a mocked hover state.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({win, js, waitFor, ready, output}) => {
  await win.loadURL('app://legion/game/guide-local');
  await waitFor('combatCheck.arena.gameInitialized && Boolean(document.querySelector(".timeline_character"))');
  win.showInactive();
  win.webContents.debugger.attach('1.3');
  // Exercise browser input without depending on which desktop app has OS focus.
  await win.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', {enabled: true});
  await ready();
  const move = async point => {
    await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent', {type: 'mouseMoved', x: Math.round(point.x), y: Math.round(point.y)});
    await ready();
  };
  const domPoint = selector => js(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; })()`);
  const fieldPoint = (team, num) => js(`(() => {
    const a = combatCheck.arena, p = a.getPlayer(${team}, ${num}), c = a.cameras.main, r = a.game.canvas.getBoundingClientRect();
    return {x: r.left + (c.x + (p.x - c.worldView.x) * c.zoom) * r.width / a.scale.gameSize.width,
      y: r.top + (c.y + (p.y + 15 - c.worldView.y) * c.zoom) * r.height / a.scale.gameSize.height};
  })()`);
  const expectHover = async (team, num) => {
    await waitFor(`document.querySelectorAll('[data-character="${team}-${num}"][data-inspected="true"]').length === 2 && Boolean(document.querySelector('#character-hover-card'))`);
    assert.equal(await js('document.querySelectorAll("[data-inspected=true]").length'), 2, 'Only the matching team and slot highlight');
    assert.equal(await js(`combatCheck.arena.getPlayer(${team}, ${num}).glowFx.color`), 0xffd785);
    assert.equal(await js(`combatCheck.arena.getPlayer(${team}, ${num}).glowFx.active`), true);
  };
  const clear = async () => {
    await js('document.activeElement?.blur()');
    await move({x: 600, y: 100});
    await waitFor('!document.querySelector("#character-hover-card") && !document.querySelector("[data-inspected=true]")');
  };
  await move({x: 600, y: 100});
  for (const [selector, team, num] of [
    ['.overview [data-character="1-1"]', 1, 1],
    ['.overview [data-character="2-1"]', 2, 1],
    ['.turn_timeline [data-character="2-3"]', 2, 3],
  ]) {
    await move(await domPoint(selector));
    await expectHover(team, num);
    await clear();
  }
  await move(await fieldPoint(2, 3));
  await expectHover(2, 3);
  assert(await js('document.querySelector("#character-hover-card").textContent.includes("Black Mage")'));
  await js(`(() => {const p = combatCheck.arena.getPlayer(2, 3);
    p.statuses = {...p.statuses, Poison: 3, Haste: -1}; p.setMP(17); p.setHP(70); })()`);
  await waitFor('document.querySelector("#character-hover-card").textContent.includes("17 / 40")');
  await waitFor('document.querySelector("#character-hover-card").textContent.includes("70 / 80")');
  assert(await js('document.querySelector("#character-hover-card").textContent.includes("Poison3")'));
  assert(await js('document.querySelector("#character-hover-card").textContent.includes("Haste∞")'));
  assert.equal(await js('getComputedStyle(document.querySelector("#character-hover-card")).pointerEvents'), 'none');
  await waitFor('!combatCheck.arena.getPlayer(2, 3).hurtTween.isPlaying()');
  await ready();
  fs.writeFileSync(path.join(output, 'combat-hover.png'), (await win.webContents.capturePage()).toPNG());
  await clear();
  assert.equal(await js('combatCheck.arena.getPlayer(2, 3).glowFx.active'), false);
  assert.equal(await js('combatCheck.arena.getPlayer(1, 3).glowFx.active'), true, 'Clearing inspection preserves selected unit');

  // Area targeting highlights multiple sprites without opening inspection cards.
  await js(`window.dispatchEvent(new CustomEvent('characterInSpellRadius', {detail: {x: 8, y: 4}}))`);
  assert.equal(await js('combatCheck.arena.getPlayer(2, 1).glowFx.active'), true);
  assert.equal(await js('Boolean(document.querySelector("#character-hover-card"))'), false);
  await move(await domPoint('.overview [data-character="2-1"]'));
  await expectHover(2, 1);
  await clear();
  assert.equal(await js('combatCheck.arena.getPlayer(2, 1).glowFx.active'), true, 'Inspection preserves area target highlight');
  await js(`window.dispatchEvent(new CustomEvent('characterOutOfSpellRadius', {detail: {x: 8, y: 4}}))`);
  assert.equal(await js('combatCheck.arena.getPlayer(2, 1).glowFx.active'), false);

  for (const [width, height] of [[1280, 720], [800, 600]]) {
    win.setContentSize(width, height);
    await ready();
    await move(await fieldPoint(2, 3));
    await expectHover(2, 3);
    await ready();
    assert(await js(`(() => {const r = document.querySelector('#character-hover-card').getBoundingClientRect();
      return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
    })()`), 'Card stays inside compact/letterboxed viewport');
    fs.writeFileSync(path.join(output, `combat-hover-${width}.png`), (await win.webContents.capturePage()).toPNG());
    await clear();
    await js('document.querySelector(\'.turn_timeline [data-character="2-3"]\').focus()');
    await expectHover(2, 3);
    await ready();
    assert(await js(`(() => {const r = document.querySelector('#character-hover-card').getBoundingClientRect(); return r.bottom <= innerHeight; })()`));
    await js('combatCheck.arena.getPlayer(2, 3).setHP(0)');
    await waitFor('!document.querySelector("#character-hover-card")');
    await js('combatCheck.arena.getPlayer(2, 3).setHP(80)');
    await clear();
  }
  win.setContentSize(1600, 900);
  await ready();
  await move(await domPoint('.overview [data-character="1-1"]'));
  await expectHover(1, 1);
  await js('window.dispatchEvent(new Event("blur"))');
  await waitFor('!document.querySelector("#character-hover-card")');
  await clear();
  // Clicking a hovered sprite still casts at that unit's tile, matching the preview.
  await js(`(() => {const a = combatCheck.arena;
    a.socket.once('spell', data => combatCheck.hoverSpell = data);
    const highlight = a.hexGridManager.highlightSpellRadius;
    combatCheck.restoreHighlight = () => {a.hexGridManager.highlightSpellRadius = highlight;};
    a.hexGridManager.highlightSpellRadius = function (...args) {combatCheck.hoverArea = args.slice(0, 2); return highlight.apply(this, args);};
    a.getPlayer(1, 3).onLetterKey('Z');
  })()`);
  const target = await fieldPoint(2, 3);
  await move(target);
  await expectHover(2, 3);
  assert.deepEqual(await js('combatCheck.hoverArea'), [9, 8]);
  for (const type of ['mousePressed', 'mouseReleased']) await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent', {type, x: Math.round(target.x), y: Math.round(target.y), button: 'left', clickCount: 1});
  await waitFor('Boolean(combatCheck.hoverSpell)');
  assert.deepEqual(await js('combatCheck.hoverSpell'), {x: 9, y: 8, index: 0, targetTeam: 2, target: 3});
  await js('combatCheck.restoreHighlight()');
  await clear();
  await win.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', {enabled: false});
  win.webContents.debugger.detach();
  console.log('Combat inspection: native pointer routing on all three surfaces, team identity, live resources/statuses, focus, target/selection preservation, death/blur cleanup and viewport placement pass');
};
