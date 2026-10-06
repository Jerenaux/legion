// Headless verification of the playable local practice preview.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
if (!process.versions.electron) {
  const result = require('node:child_process').spawnSync(require('electron'), [__filename, ...process.argv.slice(2)], {stdio: 'inherit'});
  if (result.error || result.signal) console.error(result.error || `Electron exited with ${result.signal}`);
  process.exitCode = result.status ?? 1;
} else {
  const locale = process.argv.find(arg => arg.startsWith('--locale='))?.slice('--locale='.length) || 'en';
  const localeRoot = path.resolve(__dirname, '../../locales');
  assert(fs.readdirSync(localeRoot).includes(locale), `Unknown locale: ${locale}`);
  const messages = JSON.parse(fs.readFileSync(path.join(localeRoot, locale, 'messages.json'), 'utf8'));
  const text = (key, values = {}) => (messages[key] || key).replace(/{{(\w+)}}/g, (_match, name) => String(values[name]));
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
    const out = path.resolve(__dirname, '../../../build/guided-practice', locale);
    const measurements = [];
    const sizes = [[1280, 720, 1], [960, 540, 1.3]];
    fs.mkdirSync(out, {recursive: true});
    const resize = async (width, height, scale) => {
      win.setContentSize(width, height);
      await js(`document.documentElement.style.fontSize = '${scale * 100}%'; document.documentElement.style.setProperty('--text-scale', '${scale}')`);
      await pause(400);
    };
    const screenshot = async name => {
      await pause(200); // Wait for the compositor after Preact updates and resized layouts.
      fs.writeFileSync(path.join(out, `${name}.png`), (await win.webContents.capturePage()).toPNG());
    };
    const checkLayout = async (kind, name) => {
      const layout = await js(`(() => {
        const intro = ${JSON.stringify(kind)} === 'introduction';
        const panel = document.querySelector(intro ? '.team-reveal-overlay' : '.combat-coach');
        const rect = panel.getBoundingClientRect();
        const bar = document.querySelector('.player_bar_container')?.getBoundingClientRect();
        const selectors = intro
          ? '.team-reveal-title, .team-reveal-champion, .team-reveal-role, .team-reveal-actions, .team-reveal-actions button, .team-reveal-actions p'
          : '.combat-coach-panel, .combat-coach-instruction, .combat-coach-instruction strong, .combat-coach-instruction p, .combat-action-feedback';
        const overflow = [...panel.querySelectorAll(selectors)].filter(element => element.clientWidth && element.clientHeight &&
          (element.scrollWidth > element.clientWidth + 1 ||
            (element.matches('.team-reveal-champion, .team-reveal-actions, .combat-coach-panel, .combat-action-feedback') && element.scrollHeight > element.clientHeight + 1)))
          .map(element => ({selector: element.className || element.tagName, text: element.textContent,
            width: element.clientWidth, scrollWidth: element.scrollWidth, height: element.clientHeight, scrollHeight: element.scrollHeight}));
        return {inside: rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1,
          overlaps: !intro && bar && rect.left < bar.right && rect.right > bar.left && rect.top < bar.bottom && rect.bottom > bar.top,
          overflow, width: panel.clientWidth, scrollWidth: panel.scrollWidth, height: panel.clientHeight, scrollHeight: panel.scrollHeight};
      })()`);
      measurements.push({name, ...layout});
      fs.writeFileSync(path.join(out, 'layout.json'), JSON.stringify(measurements, null, 2));
      await screenshot(name);
      assert(layout.inside && !layout.overlaps && !layout.overflow.length && layout.scrollWidth <= layout.width + 1,
        `${locale} ${name}: ${JSON.stringify(layout)}`);
      if (kind !== 'introduction') assert(layout.scrollHeight <= layout.height + 1, `${name}: panel content overflows`);
      // The introductory overlay intentionally scrolls on short screens; capture its reachable actions too.
      if (kind === 'introduction' && layout.scrollHeight > layout.height + 1) {
        await js("document.querySelector('.team-reveal-overlay').scrollTop = document.querySelector('.team-reveal-overlay').scrollHeight");
        await screenshot(`${name}-actions`);
        await js("document.querySelector('.team-reveal-overlay').scrollTop = 0");
      }
    };
    try {
      await win.loadURL('http://127.0.0.1:8082/');
      await js(`localStorage.setItem('legion.language', ${JSON.stringify(locale)})`);
      await win.loadURL('http://127.0.0.1:8082/game/practice-preview');
      await wait(`document.documentElement.lang === ${JSON.stringify(locale)}`);
      await js('document.fonts.ready.then(() => true)');
      await js(`Object.defineProperty(document, 'hidden', {configurable: true, value: false}); document.dispatchEvent(new Event('visibilitychange'));`);
      await wait('document.querySelectorAll(".team-reveal-champion").length === 3');
      await wait('Boolean(document.querySelector(".team-reveal-play-button"))');
      await pause(900);
      for (const size of sizes) {
        await resize(...size);
        await checkLayout('introduction', `introduction-${size[0]}`);
      }
      await resize(...sizes[0]);
      await js('document.querySelector(".team-reveal-play-button").click()');
      await wait('Boolean(document.querySelector(".tutorial-intro[open]"))');
      assert.equal(await js('combatCheck.arena.turnee.turnNumber'), 0);
      await js('document.querySelector(".tutorial-intro-skip").click()');
      await wait('Boolean(document.querySelector(".combat-coach-instruction"))');
      await wait('combatCheck.arena.turnee?.team === combatCheck.arena.playerTeamId');
      await pause(500);
      for (const size of sizes) {
        await resize(...size);
        await checkLayout('combat', `combat-${size[0]}`);
      }
      await resize(...sizes[0]);
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
      const initialTurn = await js('combatCheck.arena.turnee.turnNumber');
      await js('combatCheck.arena.handleTileClick(100, 100)');
      await wait(`document.querySelector(".combat-action-feedback")?.textContent === ${JSON.stringify(text('Outside movement range. Choose a blue tile.'))}`);
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
      await wait('combatCheck.arena.tutorialManager.stats.everMoved === true');
      await wait(`combatCheck.arena.turnee.turnNumber > ${initialTurn} && combatCheck.arena.turnee.team === combatCheck.arena.playerTeamId`);
      assert.equal(await js('combatCheck.arena.selectedPlayer.class'), 2, 'Black Mage acts after Warrior');
      await wait('document.querySelector(".gamehud")?.dataset.coachFocus === "spells"');
      await checkLayout('combat', 'spell-guidance');
      await js('combatCheck.arena.selectedPlayer.useSkill(0)');
      await wait('combatCheck.arena.selectedPlayer.pendingSpell === 0');
      assert.equal(await js('Boolean(document.querySelector(".combat-coach-instruction"))'), false);
      for (const size of sizes) {
        await resize(...size);
        await screenshot(`spell-targeting-${size[0]}`);
      }
      await resize(...sizes[0]);
      await js('combatCheck.arena.handleTileClick(100,100)');
      await wait(`document.querySelector(".combat-action-feedback")?.textContent === ${JSON.stringify(text('Choose a highlighted target in range.'))}`);
      for (const size of sizes) {
        await resize(...size);
        await checkLayout('combat', `invalid-target-${size[0]}`);
      }
      await resize(...sizes[0]);
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
      await wait('combatCheck.arena.tutorialManager.stats.everUsedSpell === true');
      await wait('combatCheck.arena.selectedPlayer?.class === 1 && combatCheck.arena.turnee?.team === combatCheck.arena.playerTeamId');
      assert.equal(await js('Boolean(document.querySelector(".combat-coach-instruction"))'), false, 'Healing needs no separate lesson after spell controls');
      await js('void combatCheck.arena.socket.emit("passTurn")');
      await wait('combatCheck.arena.turnee?.team !== combatCheck.arena.playerTeamId');
      await wait('!document.querySelector(".combat-coach")');
      await wait('combatCheck.arena.turnee?.team === combatCheck.arena.playerTeamId');
      assert.equal(errors.length, 0, errors.join('\n'));
      console.log(`${locale}: playable practice, invalid clicks, accepted movement/spell progress, cancel, hide/reopen, and responsive layout passed. Screenshots: ${out}`);
      win.destroy();
      app.exit(0);
    } catch (error) {
      console.error(error);
      if (errors.length) console.error(`Renderer errors (${locale}):\n${errors.join("\n")}`);
      fs.writeFileSync(path.join(out, 'failure.png'), (await win.webContents.capturePage()).toPNG());
      win.destroy(); app.exit(1);
    }
  });
}
