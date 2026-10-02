// Headless verification of the playable local practice preview.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
if (!process.versions.electron) {
  const result = require('node:child_process').spawnSync(require('electron'), [__filename], {stdio: 'inherit'});
  if (result.error || result.signal) console.error(result.error || `Electron exited with ${result.signal}`);
  process.exitCode = result.status ?? 1;
} else {
  const {app, BrowserWindow} = require('electron');
  app.on('window-all-closed', () => {});
  app.setPath('userData', fs.mkdtempSync('/tmp/legion-practice-check-profile-'));
  app.whenReady().then(async () => {
    const win = new BrowserWindow({show: false, width: 1280, height: 720, useContentSize: true,
      webPreferences: {backgroundThrottling: false}});
    win.webContents.setAudioMuted(true);
    const errors = [];
    win.webContents.on('console-message', (_event, level, message) => { if (level >= 3) errors.push(message); });
    const js = expression => win.webContents.executeJavaScript(expression, true);
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const wait = async expression => {
      const until = Date.now() + 30000;
      while (Date.now() < until) { if (await js(expression)) return; await pause(100); }
      throw new Error(`Timed out: ${expression}\n${errors.join('\n')}`);
    };
    const out = path.resolve(__dirname, '../../../build/guided-practice');
    fs.mkdirSync(out, {recursive: true});
    try {
      await win.loadURL('http://127.0.0.1:8082/game/practice-preview');
      await js(`Object.defineProperty(document, 'hidden', {configurable: true, value: false}); document.dispatchEvent(new Event('visibilitychange'));`);
      await wait('document.querySelectorAll(".team-reveal-wrapper").length === 3');
      await js('document.querySelectorAll(".team-reveal-wrapper").forEach(button => button.click())');
      await wait('Boolean(document.querySelector(".team-reveal-play-button"))');
      await pause(900);
      fs.writeFileSync(path.join(out, 'introduction.png'), (await win.webContents.capturePage()).toPNG());
      await js('document.querySelector(".team-reveal-play-button").click()');
      await wait('Boolean(document.querySelector(".combat-coach-instruction"))');
      await wait('combatCheck.arena.turnee?.team === combatCheck.arena.playerTeamId');
      await pause(500);
      for (const [width, height, scale] of [[1280,720,1], [800,600,1.3], [600,600,1.3]]) {
        win.setContentSize(width, height);
        await js(`document.documentElement.style.fontSize = '${scale * 100}%'; document.documentElement.style.setProperty('--text-scale', '${scale}')`);
        await pause(400);
        const layout = await js(`(() => {
          const coach = document.querySelector('.combat-coach').getBoundingClientRect();
          const bar = document.querySelector('.player_bar_container').getBoundingClientRect();
          return {inside: coach.left >= 0 && coach.top >= 0 && coach.right <= innerWidth && coach.bottom <= innerHeight,
            overlaps: coach.left < bar.right && coach.right > bar.left && coach.top < bar.bottom && coach.bottom > bar.top};
        })()`);
        assert(layout.inside && !layout.overlaps, JSON.stringify(layout));
        fs.writeFileSync(path.join(out, `combat-${width}.png`), (await win.webContents.capturePage()).toPNG());
      }
      win.setContentSize(1280,720);
      await js(`document.documentElement.style.fontSize = '100%'; document.documentElement.style.setProperty('--text-scale', '1')`);
      await js('document.querySelector(".combat-coach button").click()');
      await wait('!document.querySelector(".combat-coach-instruction")');
      await js('document.querySelector(".combat-coach button").click()');
      await wait('Boolean(document.querySelector(".combat-coach-instruction"))');
      await js(`(() => {
        const a = combatCheck.arena, active = a.selectedPlayer;
        const other = a.teamsMap.get(a.playerTeamId).getMembers().find(p => p !== active);
        a.selectOwnUnit(other);
        a.handleTileClick(active.gridX, active.gridY);
        if (a.selectedPlayer !== active) throw new Error('Click did not restore the active character');
      })()`);
      await js('combatCheck.arena.handleTileClick(100, 100)');
      await wait('document.querySelector(".combat-action-feedback")?.textContent.includes("Outside movement range")');
      const initialTurn = await js('combatCheck.arena.turnee.turnNumber');
      assert.equal(await js('combatCheck.arena.turnee.turnNumber'), initialTurn);
      await js(`(() => {
        const a = combatCheck.arena, p = a.selectedPlayer;
        for (let x = 0; x < 14; x++) for (let y = 0; y < 12; y++) {
          if (a.isFree(x,y) && p.canMoveTo(x,y) && a.hexGridManager.isValidCell(p.gridX,p.gridY,x,y,a.isFree.bind(a))) {
            a.handleTileClick(x,y); return;
          }
        }
        throw new Error('No valid move available');
      })()`);
      await wait('document.querySelector(".combat-coach")?.dataset.learned === "1"');
      for (let i = 0; i < 12; i++) {
        await wait('combatCheck.arena.turnee?.team === combatCheck.arena.playerTeamId');
        const mage = await js('combatCheck.arena.selectedPlayer.spells.length > 0');
        if (mage) break;
        const turn = await js('combatCheck.arena.turnee.turnNumber');
        await js('combatCheck.arena.socket.emit("passTurn")');
        await wait(`combatCheck.arena.turnee.turnNumber > ${turn}`);
      }
      assert.equal(await js('combatCheck.arena.selectedPlayer.class'), 2, 'Black Mage acts after Warrior');
      await js('combatCheck.arena.selectedPlayer.useSkill(0)');
      await wait('document.querySelector(".combat-coach-instruction strong")?.textContent.startsWith("Aim ")');
      fs.writeFileSync(path.join(out, 'spell-targeting.png'), (await win.webContents.capturePage()).toPNG());
      await js('combatCheck.arena.handleTileClick(100,100)');
      await wait('document.querySelector(".combat-action-feedback")?.textContent.includes("highlighted target")');
      assert.equal(await js('combatCheck.arena.selectedPlayer.pendingSpell'), 0);
      await js("combatCheck.arena.handleDesktopAction(new CustomEvent('legion:desktop-action', {detail: {action: 'cancel', source: 'keyboard'}}))");
      await wait('combatCheck.arena.selectedPlayer.pendingSpell === null');
      assert.equal(await js('document.querySelector(".player_bar_pass_turn").disabled'), false);
      await js('combatCheck.arena.selectedPlayer.useSkill(0)');
      await js(`(() => {
        const a = combatCheck.arena, p = a.selectedPlayer, spell = p.spells[0];
        for (const target of a.gridMap.values()) {
          if (!target.isPlayer && a.validateTarget(target.gridX,target.gridY,spell)) { a.handleTileClick(target.gridX,target.gridY); return; }
        }
        throw new Error('No spell target in range');
      })()`);
      await wait('document.querySelector(".combat-coach")?.dataset.learned === "2"');
      await wait('combatCheck.arena.selectedPlayer?.class === 1 && combatCheck.arena.turnee?.team === combatCheck.arena.playerTeamId');
      await js('combatCheck.arena.socket.emit("passTurn")');
      await wait('combatCheck.arena.turnee?.team !== combatCheck.arena.playerTeamId');
      await wait('!document.querySelector(".combat-coach")');
      await wait('combatCheck.arena.turnee?.team === combatCheck.arena.playerTeamId');
      await wait('Boolean(document.querySelector(".combat-coach"))');
      assert.equal(errors.length, 0, errors.join('\n'));
      console.log(`Playable practice, invalid clicks, accepted movement/spell progress, cancel, hide/reopen, and responsive layout passed. Screenshots: ${out}`);
      win.destroy();
      app.exit(0);
    } catch (error) {
      console.error(error);
      fs.writeFileSync(path.join(out, 'failure.png'), (await win.webContents.capturePage()).toPNG());
      win.destroy(); app.exit(1);
    }
  });
}
