// Functional checks for persistent commands, using the real arena and HUD.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({js, waitFor, ready, win, dist}) => {
  const fire = '#player_hud_spells';
  await js(`(() => {
    const {arena} = combatCheck;
    window.dockTurn = {...arena.turnee};
    window.dockCommands = [];
    ['spell', 'useitem', 'passTurn'].forEach(event => arena.socket.on(event, () => dockCommands.push(event)));
  })()`);
  await js(`document.querySelector('${fire}').click()`);
  await waitFor('document.querySelector(".player_bar_turn_label").textContent.includes("Fire · Select a target")');
  assert.equal(await js('document.querySelector(".player_bar_mana meter").value'), 22);
  assert.equal(await js('document.querySelector(".player_bar_pass_turn").disabled'), true);
  await js('combatCheck.arena.selectedPlayer.cancelSkill()');
  await js('combatCheck.arena.processTurnee({...dockTurn, team: 2, num: 1, turnNumber: 9})');
  await waitFor('document.querySelector(".player_bar_turn_label").textContent.includes("Enemy turn · Viewing Ember")');
  assert.equal(await js('document.querySelectorAll("button.player_bar_action").length'), 4);
  await js(`document.querySelector('${fire}').click(); document.querySelector('#player_hud_consumables').click(); document.querySelector('.player_bar_pass_turn').click()`);
  assert.deepEqual(await js('dockCommands'), [], 'Inspecting commands during an enemy turn must not send actions');
  win.show();
  win.focus();
  await js(`document.querySelector('${fire}').focus()`);
  await waitFor('document.querySelector("#combat-action-details .item-preview-name")?.textContent === "Fire"');
  await ready();
  fs.writeFileSync(path.join(dist, 'dock-enemy-tooltip.png'), (await win.webContents.capturePage()).toPNG());
  await js('document.activeElement.blur()');
  await js('combatCheck.arena.getPlayer(1, 3).setHP(55)');
  await waitFor('document.querySelector(".player_bar_stat meter").value === 55');
  await js('combatCheck.arena.processTurnee({...dockTurn, turnNumber: 10})');
  await waitFor('document.querySelector(".player_bar_container").dataset.active === "true"');
  await js('combatCheck.arena.selectedPlayer.mp = 0; combatCheck.arena.refreshBox()');
  await waitFor(`document.querySelector('${fire}').getAttribute('aria-label').includes('Not enough MP')`);
  await js(`document.querySelector('${fire}').click()`);
  assert.equal(await js('combatCheck.arena.selectedPlayer.pendingSpell'), null);
  await js("combatCheck.arena.selectedPlayer.mp = 32; combatCheck.arena.selectedPlayer.statuses.Mute = 3; combatCheck.arena.refreshBox()");
  await waitFor(`document.querySelector('${fire}').getAttribute('aria-label').includes('Silenced')`);
  assert.equal(await js('document.querySelectorAll("button[data-tooltip-item-type=spells]").length'), 2);
  await js("combatCheck.arena.selectedPlayer.statuses.Mute = 0; combatCheck.arena.refreshBox()");
  await js('combatCheck.arena.selectOwnUnit(combatCheck.arena.getPlayer(1, 2))');
  await waitFor('document.querySelector(".player_bar_container").dataset.active === "false"');
  await js(`document.querySelector('${fire}').click()`);
  await js("combatCheck.arena.selectedPlayer.onLetterKey('Z')");
  assert.equal(await js('combatCheck.arena.selectedPlayer.pendingSpell'), null, 'An inspected ally cannot act out of turn');
  await js('combatCheck.arena.selectTurnee()');
  await waitFor('document.querySelector(".player_bar_container").dataset.active === "true"');
  await js(`document.querySelector('${fire}').focus()`);
  win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'Return'});
  win.webContents.sendInputEvent({type: 'keyUp', keyCode: 'Return'});
  await waitFor('combatCheck.arena.selectedPlayer.pendingSpell === 0');
  await js('combatCheck.arena.selectedPlayer.cancelSkill(); document.activeElement.blur()');
  await js('combatCheck.arena.selectedPlayer.setSpells([0, 3, 6, 1, 2]); combatCheck.arena.selectedPlayer.setInventory([0, 1, 10]); combatCheck.arena.refreshBox()');
  // Captures are reviewed manually, not used as appearance assertions.
  for (const [width, height, scale] of [[1600, 900, 100], [1280, 720, 100], [1280, 720, 130], [960, 540, 100]]) {
    win.setContentSize(width, height);
    await js(`document.documentElement.style.fontSize = '${scale}%'`);
    await ready();
    fs.writeFileSync(path.join(dist, `dock-${width}-${scale}.png`), (await win.webContents.capturePage()).toPNG());
  }
  await js('document.documentElement.style.fontSize = "100%"; combatCheck.resync()');
  await waitFor('document.querySelectorAll("button.player_bar_action").length === 4');
  assert.equal(await js('document.querySelector(".player_bar_stat meter").value'), 80, 'Reconnect must replace the retained character');
  console.log('Command dock: targeting, mana preview, enemy-turn guards, live stats, silence, inspection, keyboard and reconnect pass');
};
