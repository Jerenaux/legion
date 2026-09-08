// Real renderer + local account/battle fixtures; no production credentials or writes.
// Run with Node to build, then Electron to capture/check the app:// packaged routes.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const client = path.resolve(__dirname, '../..');

if (!process.versions.electron) {
  const webpack = require('webpack');
  const {spawnSync} = require('node:child_process');
  process.chdir(client);
  process.env.NODE_ENV = 'production';
  process.env.BUILD_TARGET = 'electron';
  for (const key of ['API_URL', 'GAME_SERVER_URL', 'MATCHMAKER_URL']) process.env[key] = 'app://legion/__fixture';
  delete process.env.SENTRY_AUTH_TOKEN;
  const config = require('../../webpack.config');
  config.mode = 'production';
  config.devtool = false;
  config.output.path = fs.mkdtempSync(path.join(os.tmpdir(), 'legion-guide-'));
  config.plugins.push(new webpack.NormalModuleReplacementPlugin(/providers\/(AuthProvider|PlayerProvider)$/, resource => {
    resource.request = path.join(__dirname, resource.request.endsWith('AuthProvider') ? 'auth.tsx' : 'fixtures.tsx');
  }));
  config.plugins.push(new webpack.NormalModuleReplacementPlugin(/apiService$/, path.join(__dirname, 'fixtures.tsx')));
  if (process.argv.includes('--images')) {
    // The guide itself is not captured here; allow its screenshots to be regenerated from scratch.
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(/@assets\/guide\/.+\.jpg$/, path.join(client, 'public/guide.png')));
  }
  webpack(config, (error, stats) => {
    if (error || stats.hasErrors()) {
      console.error(error || stats.toString({all: false, errors: true}));
      process.exitCode = 1;
      return;
    }
    console.log('Guide fixture build:', config.output.path);
    const result = spawnSync(require('electron'), [__filename, config.output.path, ...process.argv.slice(2)], {stdio: 'inherit'});
    process.exitCode = result.status ?? 1;
  });
} else {
  const {app, BrowserWindow, protocol, net, session} = require('electron');
  const {pathToFileURL} = require('node:url');
  const {PACKAGED_APP_URL, PACKAGED_APP_SCHEME, resolveAppPath} = require('../../electron/protocol');
  const dist = process.argv[2];
  app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'legion-guide-profile-')));
  protocol.registerSchemesAsPrivileged([PACKAGED_APP_SCHEME]);
  app.whenReady().then(async () => {
    // Fail closed: neither telemetry nor the game can reach any external service.
    session.defaultSession.webRequest.onBeforeRequest({urls: ['https://*/*', 'http://*/*', 'wss://*/*', 'ws://*/*']}, (_details, done) => done({cancel: true}));
    protocol.handle('app', request => {
      if (new URL(request.url).pathname === '/__fixture') return Response.json({});
      let target = resolveAppPath(dist, request.url);
      if (!fs.existsSync(target)) target = path.join(dist, 'index.html');
      return net.fetch(pathToFileURL(target).toString());
    });
    const win = new BrowserWindow({width: 1600, height: 900, useContentSize: true, show: false,
      webPreferences: {contextIsolation: true, sandbox: true, backgroundThrottling: false}});
    win.webContents.setAudioMuted(true);
    const rendererErrors = [];
    win.webContents.on('console-message', event => {
      if (event.level === 'error') {rendererErrors.push(event.message); console.log('Renderer:', event.message);}
    });
    const js = code => win.webContents.executeJavaScript(code);
    const waitFor = async expression => {
      for (let i = 0; i < 100; i++) {
        if (await js(expression)) return;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      console.log('Visible text:', await js('document.body.innerText'));
      fs.writeFileSync(path.join(dist, 'failure.png'), (await win.webContents.capturePage()).toPNG());
      throw new Error(`Timed out: ${expression}`);
    };
    const ready = async () => {
      await js('document.fonts.ready');
      await js('Promise.all(Array.from(document.images).filter(image => image.loading !== "lazy" || image.complete).map(image => image.decode().catch(() => {})))');
      await new Promise(resolve => setTimeout(resolve, 700));
    };
    const capture = async (name, rect) => {
      assert(rect.width > 0 && rect.height > 0 && rect.y >= 0 && rect.y + rect.height <= 900, `Invalid crop: ${JSON.stringify(rect)}`);
      const shot = await win.webContents.capturePage(rect);
      const output = path.join(client, 'public/guide', `${name}.jpg`);
      fs.mkdirSync(path.dirname(output), {recursive: true});
      fs.writeFileSync(output, shot.resize({width: rect.width}).toJPEG(88));
      console.log('Captured', name, rect);
    };
    try {
      if (process.argv.includes('--images')) {
        await win.loadURL(`${PACKAGED_APP_URL}game/guide-local`);
        await waitFor('Boolean(document.querySelector(".player_bar_action"))');
        await ready();
        fs.writeFileSync(path.join(dist, 'battle-full.png'), (await win.webContents.capturePage()).toPNG());
        await capture('battle', {x: 340, y: 290, width: 840, height: 405});
        await capture('actions', {x: 400, y: 790, width: 960, height: 110});
        await capture('turn-order', {x: 570, y: 730, width: 460, height: 90});
        await win.loadURL(`${PACKAGED_APP_URL}team/guide-2`);
        await waitFor('document.body.innerText.includes("Ember")');
        await ready();
        await capture('loadout', {x: 270, y: 328, width: 1045, height: 428});
      } else {
        await win.loadURL(`${PACKAGED_APP_URL}?loading`);
        await waitFor('Boolean(document.querySelector(".title-screen"))');
        assert.equal(await js('document.querySelector(".title-screen-content").getAttribute("aria-busy")'), 'true');
        assert.match(await js('document.querySelector(".title-screen-loading").innerText'), /Loading your game/);
        assert.equal(await js('document.querySelectorAll(".title-screen-button").length'), 0);
        win.webContents.debugger.attach('1.3');
        await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'no-preference'}]});
        for (const [width, height] of [[1280, 720], [800, 600]]) {
          win.setContentSize(width, height);
          await ready();
          assert(await js(`(() => {const r = document.querySelector('.title-screen-loading').getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.x >= 0 && r.right <= innerWidth && r.y >= 0 && r.bottom <= innerHeight;
          })()`), 'Title loading status must remain visible');
          assert.notEqual(await js('getComputedStyle(document.querySelector(".title-screen-loading .spinner")).animationName'), 'none');
          fs.writeFileSync(path.join(dist, `title-loading-${width}.png`), (await win.webContents.capturePage()).toPNG());
        }
        await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
        assert.equal(await js('getComputedStyle(document.querySelector(".title-screen-loading .spinner")).animationName'), 'none');
        await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {features: []});
        win.webContents.debugger.detach();
        await js('titleLoadingCheck.finish()');
        await waitFor('Boolean(document.querySelector(".title-screen-button--play"))');
        assert.equal(await js('document.querySelector(".title-screen-loading")'), null);
        assert.equal(await js('document.querySelector(".title-screen-content").getAttribute("aria-busy")'), 'false');
        assert.equal(await js('document.querySelectorAll(".title-screen-button").length'), 2);
        console.log('Title loading spinner, text, reduced motion, and transition to Play/Wishlist pass');
        await js('document.querySelector(".title-screen-button--play").click()');
        await waitFor('Boolean(document.querySelector("[data-playmode=practice]"))');
        await js('document.querySelector(".expand_btn_trigger").click()');
        await waitFor('document.querySelector(".expand_btn_trigger").getAttribute("aria-expanded") === "true"');
        await js(`document.querySelector('.dropdown-content a[href="/guide"]').click()`);
        await waitFor('Boolean(document.querySelector("#guide-title"))');
        await js('document.querySelectorAll(".guide-page img").forEach(image => {image.loading = "eager";})');
        assert.equal(await js('location.pathname'), '/guide');
        assert.equal(await js('document.querySelector(".expand_btn_trigger").getAttribute("aria-expanded")'), 'false');
        assert.equal(await js('document.querySelectorAll(".guide-eyebrow, .guide-index-note").length'), 0, 'Guide should not have decorative subtitles or taglines');
        assert.doesNotMatch(await js('document.querySelector(".guide-page").innerText'), /tutorial|introductory match|your first match|read at your pace|learn the rest in the arena/i, 'Guide is a between-matches reference, not a tutorial walkthrough');
        assert.doesNotMatch(await js('document.querySelector(".guide-page").innerText'), /If the server rejects|Removing one opponent|Finish the match before returning/);
        for (const mode of ['Casual', 'Ranked']) {
          const description = await js(`Array.from(document.querySelectorAll('.guide-page dt')).find(item => item.textContent === '${mode}').nextElementSibling.textContent`);
          assert.match(description, /^Play against other players/);
          assert.doesNotMatch(description, /AI opponent/);
        }
        console.log('Packaged title → Play → burger menu → Guide passes');

        for (const [width, height] of [[1280, 720], [960, 540], [800, 600], [1920, 1080]]) {
          win.setContentSize(width, height);
          await ready();
          const layout = await js(`(() => {const guide = document.querySelector('.guide-page'); return {
            height: guide.clientHeight, scrolls: guide.scrollHeight > guide.clientHeight,
            overflows: guide.scrollWidth > guide.clientWidth,
            offscreen: guide.getBoundingClientRect().bottom > innerHeight + 1,
          };})()`);
          assert(layout.height > 200 && layout.scrolls && !layout.overflows && !layout.offscreen, JSON.stringify(layout));
          assert(await js('parseFloat(getComputedStyle(document.querySelector(".guide-intro > p:last-of-type")).fontSize) >= 16'), 'Guide body text must remain readable despite global game CSS');
          for (const id of ['first-match', 'combat', 'magic', 'team', 'progression', 'controls']) {
            await js(`document.querySelector('.guide-index a[href="#${id}"]').click()`);
            assert.equal(await js('location.pathname'), '/guide');
            assert.equal(await js('document.activeElement.id'), id);
            assert(await js(`(() => {const r = document.querySelector('#${id}').getBoundingClientRect(); return r.y >= 0 && r.bottom <= innerHeight;})()`));
          }
          await ready();
          assert(await js('Array.from(document.querySelectorAll(".guide-page img")).every(image => image.complete && image.naturalWidth > 0)'), 'Guide screenshot missing');
          await js('document.querySelector(".guide-page").scrollTop = 0');
          await ready();
          fs.writeFileSync(path.join(dist, `guide-${width}.png`), (await win.webContents.capturePage()).toPNG());
          console.log(`Guide chapters, crops and scroll layout pass at ${width}×${height}`);
        }
        win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'ESC'});
        win.webContents.sendInputEvent({type: 'keyUp', keyCode: 'ESC'});
        await waitFor('location.pathname === "/play" && Boolean(document.querySelector("[data-playmode=practice]"))');
        await win.loadURL(`${PACKAGED_APP_URL}guide`);
        await waitFor('Boolean(document.querySelector("#guide-title"))');
        await js('document.querySelector(".guide-finish").click()');
        await waitFor('location.pathname === "/play" && Boolean(document.querySelector("[data-playmode=practice]"))');
        console.log('Escape, direct packaged /guide load, and return to Play pass');

        // Model a player's click so the later match-found sound has browser audio permission.
        await win.webContents.executeJavaScript('document.querySelector("[data-playmode=casual]").click()', true);
        await waitFor('Boolean(document.querySelector(".queue-count-number"))');
        const queuePath = await js('location.pathname');
        for (const [width, height] of [[1280, 720], [960, 540], [800, 600], [600, 600], [1920, 1080]]) {
          win.setContentSize(width, height);
          await ready();
          assert(await js(`(() => {const card = document.querySelector('.queue-guide-card'); const r = card.getBoundingClientRect();
            return r.x >= 0 && r.right <= innerWidth && r.y >= 0 && r.bottom <= innerHeight && card.scrollWidth <= card.clientWidth;
          })()`), 'Queue guide card must fit the window');
          fs.writeFileSync(path.join(dist, `queue-guide-${width}.png`), (await win.webContents.capturePage()).toPNG());
          await js('document.querySelector(".queue-guide-card").focus(); document.querySelector(".queue-guide-card").click()');
          await waitFor('Boolean(document.querySelector("#guide-title"))');
          assert.equal(await js('document.activeElement.id'), 'guide-title');
          assert.equal(await js('location.pathname'), queuePath);
          assert.equal(await js('queueCheck.joins'), 1);
          assert.equal(await js('queueCheck.leaves'), 0, 'Opening the guide must not leave matchmaking');
          await js('document.querySelector(\'.guide-index a[href="#combat"]\').click()');
          assert.equal(await js('document.activeElement.id'), 'combat');
          await js('queueCheck.socket.emit("queueCount", {count: 13})');
          win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'ESC'});
          win.webContents.sendInputEvent({type: 'keyUp', keyCode: 'ESC'});
          await waitFor('Boolean(document.querySelector(".queue-guide-card"))');
          assert(await js('document.activeElement.matches(".queue-guide-card")'), 'Closing the guide restores focus to its card');
          assert.equal(await js('document.querySelector(".queue-count-number").textContent.trim()'), '13');
          console.log(`Queue guide card, chapter jump, Escape and preserved matchmaking pass at ${width}×${height}`);
        }
        await js('document.querySelector(".queue-guide-card").click()');
        await waitFor('Boolean(document.querySelector("#guide-title"))');
        await js('document.querySelector(".guide-finish").click()');
        await waitFor('Boolean(document.querySelector(".queue-guide-card"))');
        assert.equal(await js('queueCheck.leaves'), 0);
        await js('document.querySelector(".queue-guide-card").click()');
        await waitFor('Boolean(document.querySelector("#guide-title"))');
        await js('queueCheck.socket.emit("matchFound", {gameId: "guide-local"})');
        await waitFor('Boolean(document.querySelector(".player_bar_action"))');
        assert.equal(await js('location.pathname'), '/game/guide-local');
        assert.equal(await js('queueCheck.leaves'), 1);
        assert.equal(await js('queueCheck.socket.listenerCount("matchFound")'), 0);
        console.log('A match found while reading the guide opens combat and cleans up the queue');
        await ready();
        await js(`(() => {
          const {arena} = window.combatCheck;
          for (const event of ['spell', 'move', 'passTurn']) arena.socket.on(event, () => window.combatCheck.sent.push(event));
        })()`);
        win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'Z'});
        win.webContents.sendInputEvent({type: 'keyUp', keyCode: 'Z'});
        await waitFor('document.querySelector(".player_bar_pass_turn").disabled');
        await js('combatCheck.arena.handleTileClick(0, 0)');
        assert.deepEqual(await js('combatCheck.sent'), [], 'Out-of-range click sent a spell');
        await js('combatCheck.arena.handleTileClick(9, 8)');
        await waitFor('!document.querySelector(".player_bar_pass_turn").disabled');
        await js('combatCheck.arena.eventHandlers.get("actionRejected")({...combatCheck.arena.turnee})');
        await waitFor('!document.querySelector(".player_bar_pass_turn").disabled');
        assert.equal(await js('combatCheck.arena.selectedPlayer.pendingSpell'), null);
        await js('combatCheck.arena.handleTileClick(6, 7)');
        await js('combatCheck.arena.eventHandlers.get("actionRejected")({...combatCheck.arena.turnee})');
        await js('document.querySelector(".player_bar_pass_turn").click()');
        assert.deepEqual(await js('combatCheck.sent'), ['spell', 'move', 'passTurn']);
        console.log('Combat Z → invalid target → valid target → server rejection → move/pass controls pass');
      }
      assert.deepEqual(rendererErrors, [], 'Renderer errors during guide smoke test');
    } finally {
      win.destroy();
      app.quit();
    }
  }).catch(error => {console.error(error); app.exit(1);});
}
