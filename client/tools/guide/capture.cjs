// Real renderer + local account/battle fixtures; no production credentials or writes.
// Run with Node to build, then Electron to capture/check the app:// packaged routes.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const client = path.resolve(__dirname, '../..');
const locale = process.argv.find(arg => arg.startsWith('--locale='))?.slice(9) || 'en';
const localization = process.argv.includes('--localization');
const towerUnlock = process.argv.includes('--tower-unlock');
const giftsCheck = process.argv.includes('--gifts');
const rosterImages = process.argv.includes('--roster-images');
const tutorial = process.argv.includes('--tutorial');
assert(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale), 'Invalid locale');

if (!process.versions.electron) {
  const webpack = require('webpack');
  const {spawnSync} = require('node:child_process');
  process.chdir(client);
  process.env.NODE_ENV = 'production';
  process.env.BUILD_TARGET = 'electron';
  // Exercise store Replay against the loopback sink, never production ingestion.
  delete process.env.SENTRY_REPLAY_ENABLED;
  for (const key of ['API_URL', 'GAME_SERVER_URL', 'MATCHMAKER_URL']) process.env[key] = 'app://legion/__fixture';
  delete process.env.SENTRY_AUTH_TOKEN;
  const config = require('../../webpack.config');
  // Test-only opt-in: production webpack still refuses local/CI non-store builds.
  const defines = config.plugins.find(plugin => plugin.definitions?.['process.env.SENTRY_REPLAY_ENABLED']);
  defines.definitions['process.env.SENTRY_REPLAY_ENABLED'] = JSON.stringify(process.argv.includes('--replay-off') ? '' : 'true');
  config.mode = 'production';
  config.devtool = 'hidden-source-map';
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
  const {app, BrowserWindow, protocol, net, session, ipcMain} = require('electron');
  const giftQueue = require('../../electron/gifts').createGiftQueue(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'legion-gift-check-')), 'pending.json'), () => {});
  ipcMain.handle('get-pending-gift', () => giftQueue.peek());
  ipcMain.handle('acknowledge-gift', (_event, token) => giftQueue.acknowledge(token));
  ipcMain.handle('set-language', () => true);
  ipcMain.handle('is-fullscreen', () => false);
  ipcMain.handle('toggle-fullscreen', () => false);
  if ((process.env.CI && process.platform === 'linux') || process.argv.includes('--software-webgl')) {
    // Hosted runners have no GPU. These switches apply only to the fixture harness, never releases.
    app.commandLine.appendSwitch('use-angle', 'swiftshader');
    app.commandLine.appendSwitch('enable-unsafe-swiftshader');
  }
  // Keep cleanup from triggering Electron's implicit zero-exit before a failed assertion is reported.
  app.on('window-all-closed', () => {});
  const deadline = setTimeout(() => {
    console.error('Packaged stability smoke test exceeded fifteen minutes');
    app.exit(1);
  }, 15 * 60 * 1000);
  deadline.unref();
  const {pathToFileURL} = require('node:url');
  const {PACKAGED_APP_URL, PACKAGED_APP_SCHEME, resolveAppPath} = require('../../electron/protocol');
  const {PACKAGED_CSP} = require('../../electron/security');
  const dist = process.argv[2];
  app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'legion-guide-profile-')));
  const inheritedDumps = path.join(app.getPath('userData'), 'foreign-crashpad');
  const foreignDumps = ['reports', 'completed'].map(folder => {
    fs.mkdirSync(path.join(inheritedDumps, folder), {recursive: true});
    const file = path.join(inheritedDumps, folder, 'foreign.dmp');
    fs.writeFileSync(file, 'Not a Legion crash; must not be read or deleted');
    return file;
  });
  app.setPath('crashDumps', inheritedDumps);
  // Exercise the real production SDK and preload, but ingest exclusively on loopback.
  const Sentry = require('@sentry/electron/main');
  const envelopes = [];
  const replayEvents = [];
  const sink = require('node:http').createServer(async (request, response) => {
    // Also serve the exact store fixture bundle as a local browser preview.
    if (request.method === 'GET') {
      let target = resolveAppPath(dist, `${PACKAGED_APP_URL}${request.url.slice(1)}`);
      if (!fs.existsSync(target)) target = path.join(dist, 'index.html');
      const file = await net.fetch(pathToFileURL(target).toString());
      response.writeHead(file.status, Object.fromEntries(file.headers));
      response.end(Buffer.from(await file.arrayBuffer()));
      return;
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    let body = Buffer.concat(chunks);
    if (request.headers['content-encoding'] === 'gzip') body = require('node:zlib').gunzipSync(body);
    envelopes.push(body.toString());
    if (request.url.includes('/envelope/')) {
      const {parseEnvelope} = require('@sentry/core');
      for (const [header, payload] of parseEnvelope(body)[1]) {
        if (header.type !== 'replay_recording') continue;
        const recording = Buffer.from(payload);
        const data = recording.subarray(recording.indexOf(10) + 1);
        replayEvents.push(...JSON.parse(data[0] === 91 ? data.toString() : require('node:zlib').inflateSync(data).toString()));
      }
    }
    response.writeHead(200, {'Content-Type': 'application/json'});
    response.end('{}');
  }).listen(0);
  const sinkURL = `http://127.0.0.1:${sink.address().port}`;
  const {Server} = require('../../../server/node_modules/socket.io');
  const sockets = new Server(sink, {cors: {origin: true}});
  const timingChecks = new Map();
  sockets.use((socket, next) => socket.handshake.auth.gameId === 'socket-auth'
    ? next(new Error('Authentication failed')) : next());
  sockets.on('connection', socket => {
    socket.on('fixture-ready', snapshot => {
      const scenario = socket.handshake.auth.gameId;
      if (scenario.startsWith('timing-')) {
        const resume = scenario === 'timing-resume';
        snapshot.general = {...snapshot.general, reconnect: true, combatStarted: resume, readyToken: socket.id};
        snapshot.player.player.completedGames = scenario === 'timing-first' || resume ? 0 : 12;
        snapshot.turnee = resume ? {...snapshot.turnee, timeLeft: 4} : {turnDuration: 7, timeLeft: 0, turnNumber: 0};
        const timing = {acks: 0, waiting: 0, sentAt: Date.now(), readyAt: 0};
        timingChecks.set(scenario, timing);
        socket.on('tutorialWaiting', token => {
          assert.equal(scenario, 'timing-first');
          assert.equal(token, socket.id);
          assert.equal(timing.acks, 0, 'Onboarding renewals must stop once combat starts');
          timing.waiting++;
        });
        socket.on('arenaReady', token => {
          assert.equal(token, socket.id);
          timing.acks++;
          timing.readyAt = Date.now();
          socket.emit('turnee', {num: 3, team: 1, turnDuration: 7, timeLeft: resume ? 4 : 7, turnNumber: resume ? 8 : 1});
        });
        socket.emit('queueData', snapshot.queue);
        socket.emit('gameStatus', snapshot);
        socket.emit('score', {teamId: 1, score: 0}); // Harmless backlog must not skip the intro.
        return;
      }
      if (scenario === 'socket-timeout') return;
      if (scenario === 'socket-invalid') snapshot.player.team = null;
      // Old recordings omit enemy mana: keep one caster without it to check compatibility.
      if (scenario === 'socket-valid' || scenario === 'socket-replay') {
        delete snapshot.opponent.team[1].mp;
        delete snapshot.opponent.team[1].maxMP;
      }
      if (scenario === 'socket-replay') {
        socket.emit('replayData', {messages: [
          {event: 'gameStatus', data: snapshot, timestamp: 0},
          {event: 'queueData', data: snapshot.queue, timestamp: 10},
          {event: 'turnee', data: snapshot.turnee, timestamp: 20},
          {event: 'manachange', data: {team: 2, num: 3, mp: 12}, timestamp: 30},
        ]});
      } else {
        socket.emit('queueData', snapshot.queue); // Deliberately before the snapshot and preload completion.
        socket.emit('gameStatus', snapshot);
        socket.emit('turnee', snapshot.turnee);
      }
      socket.on('mana-change', data => socket.emit('manachange', data));
      socket.on('legacy-mana-change', data => socket.emit('mpchange', data));
      socket.on('late-assets', () => {
        socket.emit('addCharacter', {team: 2, character: {...snapshot.opponent.team[0], portrait: 'mil1_3', x: 11, y: 7}});
        socket.emit('cast', {team: 2, num: 4, id: 8}); // Enemy Ice III, absent from the local team's loadout.
        socket.emit('localanimation', {fromX: 11, fromY: 7, toX: 4, toY: 4, id: 8, isKill: false});
        socket.emit('endcast', {team: 2, num: 4});
      });
      socket.on('spell-cycle', id => {
        socket.emit('cast', {team: 2, num: 4, id});
        socket.emit('localanimation', {fromX: 11, fromY: 7, toX: 4, toY: 4, id, isKill: false});
        socket.emit('endcast', {team: 2, num: 4});
        socket.emit('turnee', {...snapshot.turnee, turnNumber: 100 + id});
      });
      socket.on('item-effect', effect => socket.emit('useitem', {team: 2, num: 4, ...effect}));
    });
  });
  let assetFault;
  const originalInit = Sentry.init;
  Sentry.init = options => originalInit({...options, dsn: `${sinkURL.replace('http://', 'http://test@')}/1`, environment: 'test', onFatalError: () => {}});
  require('../../electron/telemetry').initializeTelemetry(app);
  assert.equal(app.getPath('crashDumps'), path.join(app.getPath('userData'), 'legion-crashpad'));
  Sentry.init = originalInit;
  protocol.registerSchemesAsPrivileged([PACKAGED_APP_SCHEME]);
  app.whenReady().then(async () => {
    const logrocket = await require('./logrocket.cjs').installLogRocketSink(session.defaultSession);
    // Fail closed: the recorder is served from memory, and its uploads are intercepted locally.
    session.defaultSession.webRequest.onBeforeRequest({urls: ['https://*/*', 'http://*/*', 'wss://*/*', 'ws://*/*']}, (details, done) => done({cancel: !details.url.startsWith(`${sinkURL}/`) && !details.url.startsWith(`${sinkURL.replace('http:', 'ws:')}/`) && !logrocket.allows(details.url)}));
    session.defaultSession.webRequest.onHeadersReceived((details, done) => done({
      responseHeaders: {...details.responseHeaders, 'Content-Security-Policy': [PACKAGED_CSP.replace("connect-src 'self'", `connect-src 'self' ${sinkURL} ${sinkURL.replace('http:', 'ws:')}`)],
        'Document-Policy': ['include-js-call-stacks-in-crash-reports']},
    }));
    protocol.handle('app', request => {
      const pathname = new URL(request.url).pathname;
      if (assetFault === 'bundle' && pathname === '/bundle.js') return new Response('Unavailable', {status: 404});
      if (assetFault === 'boot-error' && pathname === '/bundle.js') return new Response('throw new Error("Expected startup test failure");', {headers: {'Content-Type': 'text/javascript'}});
      if (assetFault === 'audio' && pathname.endsWith('.wav')) return new Response('Unavailable', {status: 404});
      if (new URL(request.url).pathname === '/__fixture') return Response.json({});
      let target = resolveAppPath(dist, request.url);
      if (!fs.existsSync(target)) target = path.join(dist, 'index.html');
      return net.fetch(pathToFileURL(target).toString());
    });
    const win = new BrowserWindow({width: 1600, height: 900, useContentSize: true, show: false,
      webPreferences: {contextIsolation: true, sandbox: true, backgroundThrottling: false,
        preload: path.join(client, 'preload.js'), additionalArguments: ['--legion-packaged']}});
    win.webContents.setAudioMuted(true);
    const rendererErrors = [];
    win.webContents.on('console-message', event => {
      if (event.level === 'error' && !event.message.includes('telemetry-smoke-') && !event.message.includes('https://blocked.invalid/__csp_probe__.js')) {rendererErrors.push(event.message); console.log('Renderer:', event.message);}
    });
    const js = code => win.webContents.executeJavaScript(code).catch(error => {
      throw new Error(`Renderer check failed: ${code.slice(0, 160)}`, {cause: error});
    });
    const effectsReady = `combatCheck.spellEffects.every(({vfx, charge}) => [vfx, charge].filter(Boolean)
      .every(key => combatCheck.arena.textures.exists(key) && combatCheck.arena.anims.exists(key))) &&
      combatCheck.itemEffects.every(({animation, sfx}) => combatCheck.arena.anims.exists(animation) && combatCheck.arena.cache.audio.exists(sfx))`;
    const waitFor = async expression => {
      for (let i = 0; i < 300; i++) {
        if (typeof expression === 'function' ? expression() : await js(expression)) return;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      console.log('Captured exceptions:', envelopes.flatMap(body => body.split('\n').flatMap(line => {try {return JSON.parse(line).exception?.values || [];} catch {return [];}})));
      console.log('Visible text:', await js('document.body.innerText'));
      console.log('Combat readiness:', await js(`(() => {
        const arena = window.combatCheck?.arena;
        return {hidden: document.hidden, portrait: matchMedia('(orientation: portrait)').matches,
          initialized: arena?.gameInitialized, entrances: arena?.pendingEntrances,
          awaitingReady: Boolean(arena?.readyToken), connected: arena?.socket?.connected,
          frame: arena?.game?.loop?.frame, queued: arena?.eventsQueue?.length,
          units: arena ? [...arena.gridMap.values()].map(unit => ({
            animation: unit.sprite?.anims?.currentAnim?.key, playing: unit.sprite?.anims?.isPlaying,
            frame: unit.sprite?.anims?.currentFrame?.index,
          })) : []};
      })()`));
      fs.writeFileSync(path.join(dist, 'failure.png'), (await win.webContents.capturePage()).toPNG());
      throw new Error(`Timed out: ${expression}`);
    };
    const ready = async () => {
      await js('document.fonts.ready.then(() => true)');
      await js('Promise.all(Array.from(document.images).filter(image => image.loading !== "lazy" || image.complete).map(image => image.decode().catch(() => {})))');
      await new Promise(resolve => setTimeout(resolve, 700));
    };
    const capture = async (name, rect) => {
      assert(rect.width > 0 && rect.height > 0 && rect.y >= 0 && rect.y + rect.height <= 900, `Invalid crop: ${JSON.stringify(rect)}`);
      const shot = await win.webContents.capturePage(rect);
      const output = locale === 'en' ? path.join(client, 'public/guide', `${name}.jpg`) : path.join(client, 'locales', locale, 'assets/guide', `${name}.jpg`);
      fs.mkdirSync(path.dirname(output), {recursive: true});
      fs.writeFileSync(output, shot.resize({width: rect.width}).toJPEG(88));
      console.log('Captured', name, rect);
    };
    try {
      if (locale !== 'en' || localization) {
        await win.loadURL(PACKAGED_APP_URL);
        await js(`localStorage.setItem('legion.language', ${JSON.stringify(locale)})`);
      }
      if (!process.argv.includes('--images') && !process.argv.includes('--text-size') && !process.argv.includes('--hover') && !process.argv.includes('--tower-images') && !process.argv.includes('--dock') && !localization && !towerUnlock && !rosterImages && !tutorial && !giftsCheck) {
        for (const [name, url, preload, additionalArguments] of [
          ['browser preview of store bundle', sinkURL, undefined, []],
          ['Electron HTTP preview', sinkURL, path.join(client, 'preload.js'), ['--legion-packaged']],
          ['missing preload', PACKAGED_APP_URL, undefined, []],
          ['unpackaged Electron', PACKAGED_APP_URL, path.join(client, 'preload.js'), []],
          ['packaged smoke check', PACKAGED_APP_URL, path.join(client, 'preload.js'), ['--legion-packaged', '--legion-smoke-test']],
        ]) {
          const preview = new BrowserWindow({show: false, webPreferences: {
            contextIsolation: true, sandbox: true, preload, additionalArguments,
          }});
          preview.webContents.setAudioMuted(true);
          try {
            await preview.loadURL(url);
            assert.deepEqual(await preview.webContents.executeJavaScript('replayCheck.status()'),
              {replay: false, canvas: false, rate: 0}, `${name} must not install recorders or sample sessions`);
            assert.equal(await preview.webContents.executeJavaScript('Boolean(window.LogRocket)'), false, `${name} must not load LogRocket`);
            await preview.webContents.executeJavaScript('replayCheck.flush()');
          } finally { preview.destroy(); }
        }
        assert.equal(logrocket.uploads.length, 0, 'Excluded runtimes must not send LogRocket recordings');
        assert.equal(replayEvents.length, 0, 'Excluded runtimes must not send Replay frames');
        assert(envelopes.every(body => !body.includes('"type":"replay_event"')), 'Excluded runtimes must not send Replay events');
        console.log('Browser/HTTP previews, missing preload, unpackaged Electron and smoke checks cannot record');
      }
      if (tutorial) {
        await require('./tutorial.cjs')({win, js, waitFor, ready, output: dist, locale, sinkURL, timingChecks});
        assert.deepEqual(rendererErrors, []);
      } else if (process.argv.includes('--hover')) {
        await require('./hover.cjs')({win, js, waitFor, ready, output: dist});
        assert.deepEqual(rendererErrors, []);
      } else if (process.argv.includes('--text-size')) {
        await require('./text-size.cjs')({win, js, waitFor, ready,
          output: process.env.TEXT_SIZE_SCREENSHOTS || path.join(dist, 'text-size'),
          baseline: process.argv.includes('--baseline')});
        assert.deepEqual(rendererErrors, []);
      } else if (process.argv.includes('--replay-off')) {
        await win.loadURL(`${PACKAGED_APP_URL}game/guide-local`);
        await waitFor('Boolean(document.querySelector("#scene canvas"))');
        await new Promise(resolve => setTimeout(resolve, 1200));
        assert.equal(await js('Boolean(window.LogRocket)'), false, 'Local combat must not initialize LogRocket');
        assert.equal(await js('replayCheck.id()'), undefined, 'Local combat must not start a Replay session');
        assert.deepEqual(await js('replayCheck.status()'), {replay: false, canvas: false, rate: 0});
        assert.equal(logrocket.uploads.length, 0, 'Excluded runtimes must not send LogRocket recordings');
        assert.equal(replayEvents.length, 0, 'Local combat must not send Replay frames');
        assert(envelopes.every(body => !body.includes('"type":"replay_event"')), 'Local combat must not send Replay events');
        console.log('Locally packaged combat runs without Replay capture');
      } else if (process.argv.includes('--dock')) {
        win.show();
        await win.loadURL(`${PACKAGED_APP_URL}game/guide-local`);
        await waitFor('Boolean(document.querySelector(".player_bar_action"))');
        await ready();
        await require('./command-dock.cjs')({js, waitFor, ready, win, dist});
      } else if (process.argv.includes('--tower-images')) {
        // Visual review only: keep every Tower state in the same packaged renderer.
        for (const [width, height] of [[1600, 900], [1280, 720], [800, 600]]) {
          win.setContentSize(width, height);
          await win.loadURL(`${PACKAGED_APP_URL}play`);
          await waitFor('Boolean(document.querySelector("[data-playmode=tower]"))');
          await ready();
          await js('Array.from(document.querySelectorAll("button")).find(el => el.textContent.trim() === "Dismiss")?.click()');
          await js('document.querySelector(".playModesRow").scrollIntoView({block: "end"})'); await ready();
          fs.writeFileSync(path.join(dist, `tower-play-${width}.png`), (await win.webContents.capturePage()).toPNG());
          await win.loadURL(`${PACKAGED_APP_URL}tower`);
          await waitFor('Boolean(document.querySelector(".tower-primary"))');
          await ready();
          fs.writeFileSync(path.join(dist, `tower-prep-${width}.png`), (await win.webContents.capturePage()).toPNG());
        }
        win.setContentSize(1280, 720);
        await js('towerCheck.progress.highestClear=1; towerCheck.save()');
        await win.loadURL(`${PACKAGED_APP_URL}tower`);
        await waitFor('Boolean(document.querySelector(".tower-primary"))');
        await js('document.querySelector("input[value=control]").click()'); await ready();
        fs.writeFileSync(path.join(dist, 'tower-control.png'), (await win.webContents.capturePage()).toPNG());
        await win.loadURL(`${PACKAGED_APP_URL}tower`);
        await waitFor('Boolean(document.querySelector(".tower-primary"))');
        win.setContentSize(1600, 900);
        await js('document.querySelector(".tower-primary").click()');
        await waitFor('Boolean(document.querySelector(".tower-choices"))');
        await ready();
        await capture('tower', {x: 0, y: 60, width: 1600, height: 840});
        for (const [width, height] of [[1600, 900], [1280, 720], [800, 600]]) {
          win.setContentSize(width, height); await ready();
          fs.writeFileSync(path.join(dist, `tower-route-${width}.png`), (await win.webContents.capturePage()).toPNG());
        }
        win.setContentSize(1280, 720);
        await js('towerCheck.progress.run.phase="battle"; towerCheck.progress.run.path=["gate"]; towerCheck.win()');
        await win.loadURL(`${PACKAGED_APP_URL}tower`);
        await waitFor('Boolean(document.querySelector(".tower-choices"))'); await ready();
        fs.writeFileSync(path.join(dist, 'tower-upgrades.png'), (await win.webContents.capturePage()).toPNG());
        for (const [name, state] of [
          ['spell-upgrades', 'run.phase="choice"; run.offers=["rest","supplies","ice","frostcraft"]; run.squad[2].character.skills=[0,3,10]'],
          ['late-route', 'run.phase="ready"; run.floor=4; run.upgrades=["guard","satchel","swift"]; run.squad[0].hp=42; run.squad[1].mp=15; run.squad[2].character.inventory=[1,1,1,1]'],
          ['warden', 'run.phase="ready"; run.floor=5'],
          ['resume', 'run.phase="battle"; run.floor=5; run.path[5]="warden"; run.gameId="guide-local"'],
        ]) {
          await js(`{const run=towerCheck.progress.run; ${state}; towerCheck.save()}`);
          await win.loadURL(`${PACKAGED_APP_URL}tower`);
          await waitFor('Boolean(document.querySelector(".tower-unit"))'); await ready();
          fs.writeFileSync(path.join(dist, `tower-${name}.png`), (await win.webContents.capturePage()).toPNG());
        }
        for (const phase of ['won', 'lost']) {
          await js(`towerCheck.progress.run.phase=${JSON.stringify(phase)}; towerCheck.progress.run.floor=${phase === "won" ? 6 : 3}; towerCheck.progress.highestClear=1; towerCheck.save()`);
          await win.loadURL(`${PACKAGED_APP_URL}tower`);
          await waitFor('Boolean(document.querySelector(".tower-primary"))'); await ready();
          fs.writeFileSync(path.join(dist, `tower-${phase}.png`), (await win.webContents.capturePage()).toPNG());
        }
        await win.loadURL(`${PACKAGED_APP_URL}game/tower-embers`);
        await waitFor('combatCheck.arena.gameInitialized && Boolean(document.querySelector(".tower-combat-banner"))');
        await ready();
        fs.writeFileSync(path.join(dist, 'tower-embers.png'), (await win.webContents.capturePage()).toPNG());
      } else if (giftsCheck) {
        await require('./gifts.cjs')({win, js, waitFor, ready, output: dist, locale, giftQueue});
      } else if (towerUnlock) {
        await require('./tower-unlock.cjs')({win, js, waitFor, ready, output: dist, locale});
      } else if (rosterImages) {
        await require('./roster.cjs')({win, js, waitFor, ready, output: dist, locale, capture});
      } else if (localization) {
        await require(process.argv.includes('--live-localization') ? '../localization/live.cjs' : '../localization/smoke.cjs')({win, js, waitFor, ready, output: dist, locale});
      } else if (process.argv.includes('--images')) {
        await win.loadURL(`${PACKAGED_APP_URL}game/guide-local`);
        await waitFor('Boolean(document.querySelector(".player_bar_action"))');
        await ready();
        fs.writeFileSync(path.join(dist, 'battle-full.png'), (await win.webContents.capturePage()).toPNG());
        await capture('battle', {x: 340, y: 290, width: 840, height: 405});
        for (const [name, rect] of [
          ['combat-roster', {x: 8, y: 120, width: 290, height: 265}],
          ['combat-timeline', {x: 570, y: 720, width: 460, height: 100}],
        ]) {
          fs.writeFileSync(path.join(dist, `${name}.png`), (await win.webContents.capturePage(rect)).toPNG());
        }
        win.setContentSize(1280, 720);
        await ready();
        fs.writeFileSync(path.join(dist, 'battle-1280.png'), (await win.webContents.capturePage()).toPNG());
        win.setContentSize(1600, 900);
        await ready();
        await js('combatCheck.arena.inspectBattlefieldCharacter(combatCheck.arena.getPlayer(2, 3))');
        await ready();
        await capture('inspection', {x: 870, y: 485, width: 390, height: 255});
        fs.writeFileSync(path.join(dist, 'combat-inspection.png'), (await win.webContents.capturePage()).toPNG());
        win.setContentSize(1280, 720);
        await ready();
        fs.writeFileSync(path.join(dist, 'combat-inspection-1280.png'), (await win.webContents.capturePage()).toPNG());
        win.setContentSize(1600, 900);
        await js('combatCheck.arena.clearCharacterHover()');
        await ready();
        await capture('actions', {x: 400, y: 800, width: 800, height: 100});
        // Translated labels and the protruding class crests must fit inside the crop.
        await capture('turn-order', await js(`(() => {
          const bounds = Array.from(document.querySelectorAll('.turn_order_label, .timeline_portrait_container, .timeline_class_indicator')).map(element => element.getBoundingClientRect());
          const x = Math.floor(Math.min(...bounds.map(r => r.left))) - 8;
          const y = Math.floor(Math.min(...bounds.map(r => r.top))) - 8;
          return {x, y, width: Math.ceil(Math.max(...bounds.map(r => r.right))) - x + 8, height: Math.ceil(Math.max(...bounds.map(r => r.bottom))) - y + 8};
        })()`));
        await js('combatCheck.arena.selectedPlayer.setInventory([]); combatCheck.arena.selectedPlayer.setSpells([9]); combatCheck.arena.refreshBox()');
        await ready();
        fs.writeFileSync(path.join(dist, 'dock-empty-items.png'), (await win.webContents.capturePage()).toPNG());
        await js('window.dockPreviewTurn = {...combatCheck.arena.turnee}; combatCheck.arena.processTurnee({...dockPreviewTurn, num: 1}); combatCheck.arena.selectedPlayer.setInventory([0, 1, 8, 10, 11]); combatCheck.arena.refreshBox()');
        await ready();
        fs.writeFileSync(path.join(dist, 'dock-warrior.png'), (await win.webContents.capturePage()).toPNG());
        // Review empty inventory with every class, including wrapped text and enlarged UI.
        for (const [width, height, scale] of [[1600, 900, 100], [1280, 720, 130], [960, 540, 100]]) {
          win.setContentSize(width, height);
          await js(`document.documentElement.style.fontSize = '${scale}%'`);
          for (const [name, num, spells] of [['warrior', 1, []], ['white-mage', 2, [9, 10, 11, 12]], ['black-mage', 3, [0, 3, 6, 1, 4]]]) {
            await js(`combatCheck.arena.processTurnee({...dockPreviewTurn, num: ${num}}); combatCheck.arena.selectedPlayer.setInventory([]); combatCheck.arena.selectedPlayer.setSpells(${JSON.stringify(spells)}); combatCheck.arena.refreshBox()`);
            await ready();
            fs.writeFileSync(path.join(dist, `dock-empty-${name}-${width}-${scale}.png`),
              (await win.webContents.capturePage({x: 0, y: height - 180, width, height: 180})).toPNG());
          }
        }
        win.setContentSize(1600, 900);
        await js('document.documentElement.style.fontSize = "100%"');
        await js('combatCheck.arena.processTurnee(dockPreviewTurn); combatCheck.resync()');
        await ready();
        // Manual visual review: compact, full-loadout and enemy-turn states.
        for (const [width, height, scale] of [[1280, 720, 100], [1280, 720, 130], [960, 540, 100]]) {
          win.setContentSize(width, height);
          await js(`document.documentElement.style.fontSize = '${scale}%'`);
          await ready();
          fs.writeFileSync(path.join(dist, `dock-${width}-${scale}.png`), (await win.webContents.capturePage()).toPNG());
        }
        win.setContentSize(1280, 720);
        await js('document.documentElement.style.fontSize = "100%"; combatCheck.arena.selectedPlayer.useSkill(0)');
        await ready();
        fs.writeFileSync(path.join(dist, 'dock-targeting.png'), (await win.webContents.capturePage()).toPNG());
        await js('combatCheck.arena.selectedPlayer.cancelSkill(); combatCheck.arena.selectedPlayer.statuses.Mute = 3; combatCheck.arena.refreshBox()');
        await ready();
        fs.writeFileSync(path.join(dist, 'dock-silenced.png'), (await win.webContents.capturePage()).toPNG());
        await js('combatCheck.arena.selectedPlayer.statuses.Mute = 0');
        win.setContentSize(1600, 900);
        await js('document.documentElement.style.fontSize = "100%"; combatCheck.arena.selectedPlayer.setSpells([0, 3, 6, 1, 2]); combatCheck.arena.selectedPlayer.setInventory([0, 1, 8, 10, 11]); combatCheck.arena.refreshBox()');
        await ready();
        fs.writeFileSync(path.join(dist, 'dock-full-loadout.png'), (await win.webContents.capturePage()).toPNG());
        win.show();
        win.focus();
        for (const type of ['spells', 'consumables']) {
          await ready();
          await js(`document.querySelector('#player_hud_${type}').focus()`);
          await ready();
          fs.writeFileSync(path.join(dist, `dock-${type}-tooltip.png`), (await win.webContents.capturePage()).toPNG());
          await js('document.activeElement.blur()');
        }
        await js('combatCheck.arena.processTurnee({...combatCheck.arena.turnee, team: 2, num: 1, turnNumber: 9})');
        await ready();
        fs.writeFileSync(path.join(dist, 'dock-enemy.png'), (await win.webContents.capturePage()).toPNG());
        await require('./roster.cjs').captureLoadout({win, js, waitFor, ready, capture});
        await win.loadURL(`${PACKAGED_APP_URL}tower`);
        await waitFor('Boolean(document.querySelector(".tower-primary"))');
        await js('document.querySelector(".tower-primary").click()');
        await waitFor('Boolean(document.querySelector(".tower-choices"))');
        await ready();
        await capture('tower', {x: 0, y: 60, width: 1600, height: 840});
      } else {
        await require('./tower-unlock.cjs')({win, js, waitFor, ready, output: dist, locale});
        await win.loadURL(`${PACKAGED_APP_URL}play`);
        await waitFor('Boolean(document.querySelector("[data-playmode=tower]"))');
        await js('document.querySelector("[data-playmode=tower]").click()');
        await waitFor('Boolean(document.querySelector(".tower-primary"))');
        await js('document.querySelector(".tower-primary").click()');
        await waitFor('document.querySelectorAll(".tower-choice").length === 2');
        assert.equal(await js('document.querySelectorAll(".tower-unit").length'), 3);
        for (const width of [1280, 1600]) {
          win.setContentSize(width, 900);
          await ready();
          fs.writeFileSync(path.join(dist, `tower-${width}.png`), (await win.webContents.capturePage()).toPNG());
          assert(await js('document.querySelector(".tower-page").scrollWidth <= document.querySelector(".tower-page").clientWidth'), 'Tower must not scroll horizontally');
        }
        await js('document.querySelector(".tower-choice").click()');
        await waitFor('combatCheck.arena.gameInitialized && Boolean(document.querySelector(".tower-combat-banner"))');
        assert.equal(await js('Boolean(document.querySelector(".circular_timer"))'), false);
        assert.equal(await js('combatCheck.arena.getPlayer(1, 3).spells.find(spell => spell.id === 6).cost'), 15);
        assert.equal(await js('combatCheck.arena.towerWarningMarkers.length'), 2);
        assert.match(await js('document.querySelector(".tower-combat-banner").textContent'), /6/);
        fs.writeFileSync(path.join(dist, 'tower-boss.png'), (await win.webContents.capturePage()).toPNG());
        await js('towerCheck.win(); combatCheck.arena.socket.emit("towerEnd", {saved: true})');
        await waitFor('document.querySelectorAll(".tower-choice").length === 4');
        await ready();
        fs.writeFileSync(path.join(dist, 'tower-upgrades.png'), (await win.webContents.capturePage()).toPNG());
        await js('document.querySelector(".tower-choice").focus()');
        win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'Return'});
        win.webContents.sendInputEvent({type: 'keyUp', keyCode: 'Return'});
        await waitFor('document.querySelectorAll(".tower-choice").length === 2');
        await win.loadURL(`${PACKAGED_APP_URL}tower`);
        await waitFor('document.querySelectorAll(".tower-choice").length === 2');
        assert.match(await js('document.querySelector(".tower-progress").innerText'), /1\s*\/\s*6/);
        await js('towerCheck.fail = true; document.querySelector(".tower-choice").click()');
        await waitFor('Boolean(document.querySelector(".tower-error"))');
        assert.equal(await js('document.querySelector(".tower-choice").disabled'), true);
        await js('towerCheck.fail = false; document.querySelector(".tower-error button").click()');
        await waitFor('!document.querySelector(".tower-error") && !document.querySelector(".tower-choice").disabled');
        console.log('Tower entry, choices, keyboard controls, saved progress, untimed combat, boss warnings, and recovery pass');
        await require('./hover.cjs')({win, js, waitFor, ready, output: dist});
        await require('./roster.cjs')({win, js, waitFor, ready, output: dist, locale});
        await win.loadURL(`${PACKAGED_APP_URL}?loading`);
        await waitFor('Boolean(document.querySelector(".title-screen"))');
        await waitFor('routeAudio.some(audio => audio.loop && audio.currentTime > 0)');
        await waitFor('Boolean(replayCheck.id())');
        assert.deepEqual(await js('replayCheck.status()'), {replay: true, canvas: true, rate: 1});
        assert.equal(await js(`new Promise(resolve => {
          document.addEventListener('securitypolicyviolation', event => {
            if (event.blockedURI === 'https://blocked.invalid/__csp_probe__.js') resolve(event.effectiveDirective);
          });
          const script = document.createElement('script');
          script.src = 'https://blocked.invalid/__csp_probe__.js';
          document.head.appendChild(script);
          setTimeout(() => resolve('No CSP violation'), 2000);
        })`), 'script-src-elem', 'Unrelated remote scripts must still be blocked by CSP, not just the test network filter');
        await ready();
        await js(`(async () => {
          const marker = document.createElement('div');
          marker.textContent = 'visible-replay-text';
          const input = document.createElement('input');
          input.value = 'visible-replay-input';
          marker.appendChild(input);
          const password = document.createElement('input');
          password.type = 'password';
          password.value = 'private-replay-password';
          marker.appendChild(password);
          const image = document.createElement('img');
          image.src = '/guide.png?replay-smoke-media';
          marker.appendChild(image);
          document.body.appendChild(marker);
          await fetch('/__fixture?token=private-replay-query', {method: 'POST',
            headers: {Authorization: 'private-replay-header'}, body: 'private-replay-body'});
        })()`);
        const expectedVersion = `v${require('../../package.json').version}`;
        assert.equal(await js('document.querySelector(".title-screen-version")?.textContent'), expectedVersion);
        assert.equal(await js('document.querySelector(".title-screen-content").getAttribute("aria-busy")'), 'true');
        assert.equal(await js('Boolean(document.querySelector(".title-screen-loading"))'), true);
        assert.equal(await js('document.querySelectorAll(".title-screen-button").length'), 0);
        win.webContents.debugger.attach('1.3');
        await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'no-preference'}]});
        for (const [width, height] of [[1280, 720], [800, 600]]) {
          win.setContentSize(width, height);
          await ready();
          assert(await js(`(() => {const r = document.querySelector('.title-screen-loading').getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.x >= 0 && r.right <= innerWidth && r.y >= 0 && r.bottom <= innerHeight;
          })()`), 'Title loading status must remain visible');
          assert(await js(`(() => {const r = document.querySelector('.title-screen-version').getBoundingClientRect();
            return r.width > 0 && r.height > 0 && innerWidth - r.right === 16 && innerHeight - r.bottom === 16;
          })()`), 'Title version must remain inset at the bottom right');
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
        assert.equal(await js('document.querySelector(".title-screen-version").textContent'), expectedVersion);
        console.log('Title loading spinner, text, reduced motion, and transition to Play/Wishlist pass');
        await js('document.querySelector(".title-screen-button--play").click()');
        await waitFor('Boolean(document.querySelector("[data-playmode=practice]"))');
        await waitFor('routeAudio.filter(audio => audio.loop).length === 2 && routeAudio.filter(audio => audio.loop).at(-1).currentTime > 0');
        assert(await js('routeAudio[0].paused && !routeAudio[0].getAttribute("src")'), 'Title must stop before menus play');
        assert.deepEqual(await js('musicOverlaps'), [], 'Title and menu music must not overlap');
        console.log('Packaged title and menu MP3 playback and fade handoff pass');
        await js('document.querySelector(".expand_btn_trigger").click()');
        await waitFor('document.querySelector(".expand_btn_trigger").getAttribute("aria-expanded") === "true"');
        await js('document.querySelector("[data-report-problem]").click()');
        await waitFor('Boolean(document.querySelector("#sentry-feedback")?.shadowRoot?.querySelector("textarea"))');
        assert.equal(await js('document.querySelector("#sentry-feedback").shadowRoot.querySelectorAll("input:not([type=hidden])").length'), 0);
        assert.equal(await js('Array.from(document.querySelector("#sentry-feedback").shadowRoot.querySelectorAll("input[type=hidden]")).every(input => !input.value)'), true);
        await js(`(() => {
          const root = document.querySelector('#sentry-feedback').shadowRoot;
          const message = root.querySelector('textarea');
          message.value = 'telemetry-smoke-player-report';
          message.dispatchEvent(new Event('input', {bubbles: true}));
          root.querySelector('form').requestSubmit();
        })()`);
        await waitFor('!document.querySelector("#sentry-feedback")?.shadowRoot?.querySelector("dialog[open]")');
        process.emit('uncaughtException', new Error('telemetry-smoke-main'));
        await js(`console.error(new Error('telemetry-smoke-console')); setTimeout(() => {throw new Error('telemetry-smoke-renderer');}, 0); setTimeout(() => {void Promise.reject(new Error('telemetry-smoke-rejection'));}, 20);`);
        const telemetryDeadline = Date.now() + 10000;
        const expectedReports = ['player-report', 'main', 'console', 'renderer', 'rejection'];
        while (!expectedReports.every(kind => envelopes.some(body => body.includes(`telemetry-smoke-${kind}`)))) {
          assert(Date.now() < telemetryDeadline, `Missing Sentry reports: ${expectedReports.filter(kind => !envelopes.some(body => body.includes('telemetry-smoke-' + kind))).join(', ')}`);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        assert(envelopes.some(body => body.includes(`legion@${require('../../package.json').version}`)), 'Events must identify the shipped product version');
        console.log('Real Electron main/renderer errors, rejection, console error, and player feedback reach the local Sentry sink');
        await js('document.querySelector(".expand_btn_trigger").click()');
        await js(`document.querySelector('.dropdown-content a[href="/guide"]').click()`);
        await waitFor('Boolean(document.querySelector("#guide-title"))');
        await js('document.querySelectorAll(".guide-page img").forEach(image => {image.loading = "eager";})');
        assert.equal(await js('location.pathname'), '/guide');
        assert.equal(await js('document.querySelector(".expand_btn_trigger").getAttribute("aria-expanded")'), 'false');
        assert.equal(await js('document.querySelectorAll(".guide-eyebrow, .guide-index-note").length'), 0, 'Guide should not have decorative subtitles or taglines');
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

        win.setContentSize(1280, 720);
        await win.loadURL(`${PACKAGED_APP_URL}rank`);
        await waitFor('Boolean(document.querySelector(".rank-load-error"))');
        assert.equal(await js('document.querySelector(".rank-content").getAttribute("aria-busy")'), 'false');
        assert.equal(await js('document.querySelectorAll(".rank-content .ghost").length'), 0);
        assert.equal(await js('document.querySelector(".rank-load-error").getAttribute("role")'), 'alert');
        await ready();
        fs.writeFileSync(path.join(dist, 'rank-recovery.png'), (await win.webContents.capturePage()).toPNG());
        await js('rankCheck.fail = false; document.querySelector(".rank-load-error button").focus()');
        win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'ENTER'});
        win.webContents.sendInputEvent({type: 'keyUp', keyCode: 'ENTER'});
        await waitFor('Boolean(document.querySelector(".rank-table"))');
        assert.equal(await js('Boolean(document.querySelector(".rank-load-error"))'), false);
        await js('rankCheck.fail = true; document.querySelectorAll(".rank-tab-container button")[1].click()');
        await waitFor('Boolean(document.querySelector(".rank-load-error"))');
        await js('rankCheck.fail = false; document.querySelectorAll(".rank-tab-container button")[2].click()');
        await waitFor('Boolean(document.querySelector(".rank-table"))');
        assert.equal(await js('Boolean(document.querySelector(".rank-load-error"))'), false);
        await win.loadURL(`${PACKAGED_APP_URL}play`);
        await waitFor('Boolean(document.querySelector("[data-playmode=practice]"))');
        console.log('Rank failure removes loading placeholders; keyboard Retry and league switching recover');

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
        assert.equal(await js('routeAudio.filter(audio => audio.loop).length'), 1, 'Menu navigation must keep one music instance');
        await js('queueCheck.socket.emit("matchFound", {gameId: "guide-local"})');
        await waitFor('Boolean(document.querySelector(".player_bar_action"))');
        assert.equal(await js('location.pathname'), '/game/guide-local');
        assert.equal(await js('queueCheck.leaves'), 1);
        assert.equal(await js('queueCheck.socket.listenerCount("matchFound")'), 0);
        await waitFor('Boolean(combatCheck.arena.musicManager.currentSound)');
        assert(await js('routeAudio.filter(audio => audio.loop).every(audio => audio.paused)'), 'Menu music must stop before combat music');
        assert.deepEqual(await js('musicOverlaps'), [], 'Menu and combat music must not overlap');
        console.log('A match found while reading the guide opens combat, cleans up the queue, and hands off music');
        await js(`combatCheck.events.emit('combatTipsVisibility', true); combatCheck.arena.refreshTutorial()`);
        await waitFor('Boolean(document.querySelector(".combat-coach"))');
        for (const [width, height] of [[1280, 720], [960, 540], [800, 600], [600, 600], [1920, 1080]]) {
          win.setContentSize(width, height);
          await ready();
          const spellTutorialLayout = await js(`(() => {
            const dialogue = document.querySelector('.combat-coach').getBoundingClientRect();
            const spells = document.querySelector('#player_hud_spells').getBoundingClientRect();
            return {
              dialogue: {left: dialogue.left, top: dialogue.top, right: dialogue.right, bottom: dialogue.bottom},
              spells: {left: spells.left, top: spells.top, right: spells.right, bottom: spells.bottom},
              overlaps: dialogue.left < spells.right && dialogue.right > spells.left && dialogue.top < spells.bottom && dialogue.bottom > spells.top,
              offscreen: dialogue.left < 0 || dialogue.top < 0 || dialogue.right > innerWidth || dialogue.bottom > innerHeight,
            };
          })()`);
          fs.writeFileSync(path.join(dist, `tutorial-spell-tooltip-${width}.png`), (await win.webContents.capturePage()).toPNG());
          assert.equal(spellTutorialLayout.overlaps || spellTutorialLayout.offscreen, false,
            `Spell tutorial obscures controls or leaves the viewport at ${width}×${height}: ${JSON.stringify(spellTutorialLayout)}`);
          console.log(`Spell tutorial remains visible and clear of its controls at ${width}×${height}`);
        }
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

        await waitFor('combatCheck.arena.cache.audio.has("bgm_loop_1")');
        const musicTracks = await win.webContents.executeJavaScript(`(async () => {
          const {arena} = combatCheck;
          const music = arena.musicManager;
          music.currentSound.stop();
          music.currentSound.removeAllListeners();
          music.intensity = music.desiredIntensity = 1;
          music.playingIntensity = music.loopsPlayed = 0;
          const originalRate = arena.sound.rate;
          const originalPauseOnBlur = arena.sound.pauseOnBlur;
          arena.sound.pauseOnBlur = false;
          arena.sound.setRate(8); // Keep real audio completion events, but make this smoke test fast.
          await arena.sound.context.resume();
          const tracks = [];
          const complete = () => new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Music did not complete naturally')), 5000);
            music.currentSound.once('complete', () => {
              clearTimeout(timeout);
              tracks.push(music.currentSound.key);
              resolve();
            });
          });
          try {
            music.playNext();
            tracks.push(music.currentSound.key);
            for (let i = 0; i < 2; i++) await complete();
            music.updateMusicIntensity(0.5);
            await complete();
            return tracks;
          } finally {
            music.playEnd();
            arena.sound.setRate(originalRate);
            arena.sound.pauseOnBlur = originalPauseOnBlur;
          }
        })()`, true);
        assert.deepEqual(musicTracks, ['bgm_loop_1', 'bgm_loop_1', 'bgm_loop_2', 'bgm_loop_7']);
        console.log('Muted Phaser audio: two natural plays → next track → health-driven jump passes');
        assert(await js('replayCheck.id()'), 'Production sessions must start Sentry Replay without an error');
        await js('replayCheck.flush()');
        const replayDeadline = Date.now() + 10000;
        while (!replayEvents.some(event => event.type === 3 && event.data.source === 9)) {
          assert(Date.now() < replayDeadline, 'Sentry must deliver canvas frames to the loopback sink');
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        assert(replayEvents.some(event => event.type === 2), 'Sentry must deliver the surrounding DOM');
        const recordedDOM = JSON.stringify(replayEvents);
        for (const visible of ['visible-replay-text', 'visible-replay-input', 'guide.png?replay-smoke-media']) {
          assert(recordedDOM.includes(visible), `Replay must show ${visible}`);
        }
        assert.deepEqual(replayEvents.filter(event => JSON.stringify(event).includes('private-replay-')), [], 'Replay must not upload passwords or private network data');
        const frames = replayEvents.filter(event => event.type === 3 && event.data.source === 9);
        const encodedFrame = frames.flatMap(event => event.data.commands ?? [])
          .filter(command => command.property === 'drawImage').at(-1)?.args[0].args[0];
        assert(encodedFrame?.data[0].base64, 'Canvas recording must contain encoded pixels');
        assert(await js(`(async () => {
          const image = new Image();
          image.src = ${JSON.stringify(`data:${encodedFrame.type};base64,${encodedFrame.data[0].base64}`)};
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 32;
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0, 32, 32);
          return new Set(new Uint32Array(context.getImageData(0, 0, 32, 32).data.buffer)).size > 20;
        })()`), 'Recorded combat pixels must not be blank');
        console.log(`Sentry Replay: visible DOM, inputs, media, and ${frames.length} canvas updates delivered; passwords and network data scrubbed`);
        await require('./logrocket-check.cjs')({logrocket, js, waitFor});
        const cleanup = await js(`(() => {
          window.previousGame = combatCheck.arena.game;
          const player = combatCheck.arena.selectedPlayer;
          player.speechBubble.setText('Pending layout during teardown');
          player.animationSprite.destroy();
          try { combatCheck.close(); return null; } catch (error) { return error.message; }
        })()`);
        console.log('Repeated-match cleanup result:', cleanup);
        await js('combatCheck.route("/play")');
        await waitFor('!previousGame.loop.running');
        assert.equal(cleanup, null, 'Already-destroyed sprites must not prevent leaving a match');
        assert.equal(await js('previousGame.loop.running'), false, 'Unmount must stop the engine, not only its scene');
        assert.equal(await js('document.querySelectorAll("[data-logrocket-canvas]").length'), 0, 'Teardown must remove replay snapshots');
        assert.equal(await js('Object.keys(previousGame.textures.list).length'), 0);
        for (const exit of ['normal', 'loading', 'animation', 'sleeping', 'context-loss', 'canvas', 'canvas-throws']) {
          if (exit.startsWith('canvas')) await js(`(() => {
            const original = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function(type, ...args) {
              if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
                if (${exit === 'canvas-throws'}) throw new Error('Cannot create WebGL context, aborting.');
                return null;
              }
              return original.call(this, type, ...args);
            };
          })()`);
          await js(`combatCheck.route('/game/stability-${exit}')`);
          if (exit !== 'loading') {
            await waitFor('Boolean(document.querySelector(".player_bar_action"))');
            await ready();
            assert.equal(await js('document.querySelectorAll("#scene canvas").length'), 1);
            assert.equal(await js('combatCheck.events.listenerCount("passTurn")'), 1, 'Old matches must not receive new actions');
            assert(await js('combatCheck.arena.game.loop.running'));
            const rendererType = await js('combatCheck.arena.game.config.renderType');
            assert(exit.startsWith('canvas') ? rendererType === 1 : [1, 2].includes(rendererType));
            const textures = await js(`Object.values(combatCheck.arena.textures.list).flatMap(t => t.source).reduce((bytes, s) => bytes + s.width*s.height*4, 0)`);
            assert(textures < 200 * 1024 * 1024, 'Combat decoded texture budget exceeded');
            console.log(`${exit}: decoded texture storage ${(textures/1024/1024).toFixed(0)} MiB`);
            if (exit.startsWith('canvas')) assert(await js(`(() => {
              let passed = false;
              combatCheck.arena.socket.once('passTurn', () => {passed = true;});
              document.querySelector('.player_bar_pass_turn').click();
              return passed;
            })()`), 'Software rendering must preserve combat controls');
          } else {
            await waitFor('Boolean(document.querySelector("#scene canvas"))');
          }
          await js('void (window.previousGame = combatCheck.arena.game)');
          await js(`(() => {
            window.staleHighlights = 0;
            combatCheck.arena.gridMap.set('0,0', {onPointerOver() {staleHighlights++;}, onPointerOut() {staleHighlights++;}});
          })()`);
          if (exit === 'sleeping') await js('void combatCheck.arena.game.loop.sleep()');
          if (exit === 'animation') await js(`combatCheck.arena.processLocalAnimation({fromX: 5, fromY: 7, toX: 9, toY: 8, id: 0, isKill: false})`);
          if (exit === 'context-loss') {
            await js('combatCheck.arena.game.canvas.dispatchEvent(new Event("webglcontextlost", {cancelable: true}))');
            await waitFor('Boolean(document.querySelector(".session-status__retry"))');
            assert.equal(await js('Boolean(document.querySelector(".session-status__retry"))'), true);
            assert(await js('Boolean(document.querySelector(".session-status h1").textContent.trim())'));
          } else if (exit !== 'loading') await js('combatCheck.close()');
          await js('combatCheck.route("/play")');
          await waitFor('!previousGame.loop.running');
          await waitFor('Object.keys(previousGame.textures.list).length === 0');
          assert.equal(await js('Object.keys(previousGame.textures.list).length'), 0);
          assert.equal(await js('document.querySelectorAll("#scene canvas").length'), 0);
          await js(`['characterInSpellRadius', 'characterOutOfSpellRadius'].forEach(type => window.dispatchEvent(new CustomEvent(type, {detail: {x: 0, y: 0}})))`);
          assert.equal(await js('staleHighlights'), 0, 'Disposed arenas must not receive targeting events');
          await ready();
          console.log(`Repeated match: ${exit} teardown passes`);
        }
      }
      assert.deepEqual(rendererErrors, [], 'Renderer errors during guide smoke test');
      if (!process.argv.includes('--images') && !process.argv.includes('--tower-images') && !process.argv.includes('--text-size') && !process.argv.includes('--dock') && !process.argv.includes('--hover') && !localization && !towerUnlock && !rosterImages && !tutorial && !giftsCheck) {
        // Hidden CI windows stop receiving compositor frames on Windows/Linux.
        // Show the remaining combat checks on CI's isolated desktop, at a size
        // that fits its display. Keep oversized layout captures and local runs hidden.
        win.setContentSize(1280, 720);
        if (process.env.CI) win.show();
        for (const scenario of ['timing-first', 'timing-next', 'timing-resume', 'timing-hidden', 'timing-entrance', 'timing-portrait']) {
          if (scenario === 'timing-portrait') win.setContentSize(600, 900);
          await win.loadURL(`${PACKAGED_APP_URL}game/${scenario}?socketURL=${encodeURIComponent(sinkURL)}`);
          if (scenario === 'timing-first') {
            await waitFor('Boolean(document.querySelector(".team-reveal-overlay"))');
            await waitFor(() => timingChecks.get(scenario).waiting > 0);
            assert.equal(timingChecks.get(scenario).acks, 0, 'Champion reveal must not start combat');
            assert.equal(await js('document.querySelectorAll(".team-reveal-champion").length'), 3);
            await waitFor('Boolean(document.querySelector(".team-reveal-play-button"))');
            timingChecks.get(scenario).sentAt = Date.now();
            await js('document.querySelector(".team-reveal-play-button").click()');
            assert.equal(timingChecks.get(scenario).acks, 0, 'Play must wait for the arena intro to finish');
            await waitFor('Boolean(document.querySelector(".tutorial-intro[open]"))');
            assert.equal(timingChecks.get(scenario).acks, 0, 'The illustrated briefing must hold combat readiness');
            // Keep reading until the next real post-render renewal, without changing
            // the clock used by Phaser and the renderer freeze detector.
            const waiting = timingChecks.get(scenario).waiting;
            await waitFor(() => timingChecks.get(scenario).waiting > waiting);
            await js('document.querySelector(".tutorial-intro-skip").click()');
          }
          if (scenario === 'timing-hidden') {
            await waitFor('combatCheck.arena.gameInitialized');
            assert.equal(timingChecks.get(scenario).acks, 0, 'A hidden arena must not start combat');
            await js("void Object.defineProperty(document, 'hidden', {configurable: true, value: false})");
          }
          if (scenario === 'timing-entrance' || scenario === 'timing-portrait') {
            await waitFor('combatCheck.arena.gameInitialized');
            assert.equal(timingChecks.get(scenario).acks, 0, 'Incomplete entrances or an orientation overlay must not start combat');
            if (scenario === 'timing-entrance') await js('combatCheck.arena.tweens.timeScale = 1');
            else win.setContentSize(1280, 720);
          }
          await waitFor(`combatCheck.arena.gameInitialized && combatCheck.arena.readyToken === null && combatCheck.arena.turnee?.num === 3 && combatCheck.arena.turnee.turnNumber === ${scenario === 'timing-resume' ? 8 : 1} && combatCheck.arena.eventsQueue.length === 0`);
          // Resumed snapshots already contain the turn; wait for the emitted token to reach the server.
          await waitFor(() => timingChecks.get(scenario).acks > 0);
          assert.equal(timingChecks.get(scenario).acks, 1, 'Exactly one readiness acknowledgement per snapshot');
          assert(await js(effectsReady), 'Both teams’ spell effects and every item effect must be ready before combat');
          assert.equal(await js('Boolean(document.querySelector(".team-reveal-overlay"))'), false, 'A running first match must not reveal champions again');
          assert.equal(await js('combatCheck.arena.turnee.timeLeft'), scenario === 'timing-resume' ? 4 : 7);
          if (scenario !== 'timing-resume') {
            assert(timingChecks.get(scenario).readyAt - timingChecks.get(scenario).sentAt >= 2900, 'Fresh matches must play the intro even with buffered messages');
          }
          assert.equal(await js('Boolean(document.querySelector(".match-ready-status"))'), false);
          console.log(`${scenario}: rendered readiness, full opening turn, and reconnect reveal behavior pass`);
        }
        for (const scenario of ['socket-valid', 'socket-replay', 'socket-invalid', 'socket-auth', 'socket-timeout']) {
          await win.loadURL(`${PACKAGED_APP_URL}${scenario === 'socket-replay' ? 'replay' : 'game'}/${scenario}?socketURL=${encodeURIComponent(sinkURL)}`);
          if (scenario !== 'socket-valid' && scenario !== 'socket-replay') {
            // Allow the real production 30-second deadline to expire for the missing-snapshot case.
            if (scenario === 'socket-timeout') {
              // Software-rendered CI takes longer to preload. The snapshot deadline starts after it.
              await waitFor('Boolean(document.querySelector(".waiting-container"))');
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
            await waitFor('Boolean(document.querySelector(".session-status__retry"))');
            assert.equal(await js('document.querySelectorAll("#scene canvas").length'), 0);
            if (scenario === 'socket-timeout') assert(await js('Boolean(document.querySelector(".session-status h1").textContent.trim())'));
            console.log(`${scenario}: actionable recovery, no abandoned canvas`);
            continue;
          }
          await waitFor('combatCheck.arena.gameInitialized && combatCheck.arena.eventsQueue.length === 0');
          assert.equal(await js('combatCheck.arena.socket.connected'), true);
          assert.equal(await js('combatCheck.arena.teamsMap.size'), 2);
          if (scenario === 'socket-replay') assert.equal(await js('combatCheck.arena.isReplay'), true);
          const memory = await js(`({textures: Object.values(combatCheck.arena.textures.list).flatMap(t => t.source).reduce((n, s) => n+s.width*s.height*4, 0),
            audio: Object.values(combatCheck.arena.cache.audio.entries.entries).reduce((n, b) => n+b.length*b.numberOfChannels*4, 0)})`);
          // This socket fixture deliberately equips the opponent with the entire spell catalog.
          assert(memory.textures < 400 * 1048576 && memory.audio < 35 * 1048576, 'Decoded texture/audio budget exceeded');
          console.log('Live-socket decoded memory (MiB):', {textures: Math.round(memory.textures / 1048576), audio: Math.round(memory.audio / 1048576)});
          assert(await js(effectsReady), 'Opponent spells and all consumable effects must be preloaded');
          await waitFor(`combatCheck.arena.getPlayer(2, 3).mp === ${scenario === 'socket-replay' ? 12 : 32}`);
          assert(await js('combatCheck.arena.getPlayer(2, 3).MPBar.visible'), 'Enemy caster mana bar must be visible');
          assert(await js('combatCheck.arena.getPlayer(2, 2).MPBar === undefined'), 'Old snapshots must not invent enemy mana');
          assert.equal(await js('combatCheck.arena.getPlayer(2, 1).MPBar.visible'), false, 'Non-caster arena bars stay hidden');
          await js('combatCheck.arena.socket.emit("mana-change", {team: 2, num: 3, mp: 7}) && undefined');
          await waitFor('combatCheck.arena.getPlayer(2, 3).mp === 7 && combatCheck.arena.eventsQueue.length === 0');
          assert.equal(await js('combatCheck.arena.getPlayer(1, 3).mp'), 32, 'Enemy updates must not change the matching allied slot');
          assert.equal(await js('combatCheck.arena.getPlayer(2, 3).MPBar.list[2].scaleX'), 7 / 40);
          await waitFor('Array.from(document.querySelectorAll(".overview_right .char_stats_mp")).at(-1)?.style.width === "17.5%"');
          await js('combatCheck.arena.socket.emit("mana-change", {team: 2, num: 3, mp: 27}) && undefined');
          await waitFor('combatCheck.arena.getPlayer(2, 3).mp === 27');
          assert.equal(await js('combatCheck.arena.getPlayer(2, 3).MPBar.list[2].scaleX'), 27 / 40);
          await js('combatCheck.arena.socket.emit("legacy-mana-change", {num: 3, mp: 22}) && undefined');
          await waitFor('combatCheck.arena.getPlayer(1, 3).mp === 22');
          assert.equal(await js('combatCheck.arena.getPlayer(2, 3).mp'), 27);
          console.log(`${scenario}: enemy mana, restoration, HUD bars, and legacy own-team updates pass`);

          await js('combatCheck.arena.socket.emit("late-assets") && undefined');
          await waitFor('combatCheck.arena.teamsMap.get(2).members.length === 4 && combatCheck.arena.eventsQueue.length === 0');
          assert.equal(await js('combatCheck.arena.textures.exists("ice_3") && combatCheck.arena.anims.exists("charged_ice_2")'), true);
          await ready();
          assert.equal(await js('Boolean(document.querySelector(".session-status__retry"))'), false);
          assert.deepEqual(rendererErrors, [], 'Live and replay socket events must not produce renderer errors');
          console.log('Real socket buffering, summoned sprite and preloaded enemy spell pass');
          await js('combatCheck.assetLoads = []; combatCheck.arena.load.on("addfile", (key, type) => combatCheck.assetLoads.push({key, type})); undefined');
          for (const {id, vfx} of await js('combatCheck.spellEffects')) {
            await js(`combatCheck.arena.socket.emit('spell-cycle', ${id}) && undefined`);
            await waitFor(`combatCheck.arena.turnee?.turnNumber === ${100 + id} && combatCheck.arena.eventsQueue.length === 0`);
            assert(await js(`(() => {const player = combatCheck.arena.getPlayer(2, 4);
              return !player.casting && !player.chargeSprite && !player.animationSprite.visible;
            })()`), 'Spell completion must stop casting and remove charge graphics');
            // Let the actual effect animation and its delayed callbacks run before the next spell.
            await waitFor(`combatCheck.arena.localAnimationSprite.anims.currentAnim?.key === ${JSON.stringify(vfx)} && !combatCheck.arena.localAnimationSprite.anims.isPlaying`);
            assert.equal(await js('Boolean(document.querySelector(".session-status__retry"))'), false);
          }
          const itemEffects = await js('combatCheck.itemEffects');
          for (const effect of new Map(itemEffects.map(effect => [effect.animation + effect.sfx, effect])).values()) {
            await js(`combatCheck.arena.socket.emit('item-effect', ${JSON.stringify(effect)}) && undefined`);
            await waitFor(`combatCheck.arena.getPlayer(2, 4).animationSprite.anims.currentAnim?.key === ${JSON.stringify(effect.animation)} && !combatCheck.arena.getPlayer(2, 4).animationSprite.anims.isPlaying`);
          }
          // Music independently prefetches its next track during combat.
          assert.deepEqual(await js('combatCheck.assetLoads.filter(({key, type}) => !(type === "audio" && key.startsWith("bgm_")))'), [],
            'Spells and items must not load graphics or sound effects during combat');
          assert.deepEqual(rendererErrors, [], 'Every spell must complete and advance to the next turn');
          console.log(`${scenario}: all spell effects, item effects, cast completion, and subsequent turns pass without asset loads`);
        }
        for (const fault of ['audio', 'bundle', 'boot-error']) {
          assetFault = fault;
          await session.defaultSession.clearCache();
          if (fault === 'audio') {
            await win.loadURL(`${PACKAGED_APP_URL}game/missing-assets`);
            await waitFor('Boolean(document.querySelector(".session-status__retry"))');
          }
          else {
            // A new renderer cannot reuse the previous page's compiled bundle from memory.
            const bootWindow = new BrowserWindow({show: false, webPreferences: {contextIsolation: true, sandbox: true}});
            bootWindow.webContents.setAudioMuted(true);
            try {
              await bootWindow.loadURL(`${PACKAGED_APP_URL}?fault=${fault}`);
              assert.equal(await bootWindow.webContents.executeJavaScript('getComputedStyle(document.getElementById("startup-recovery")).display'), 'grid');
              assert(await bootWindow.webContents.executeJavaScript('Boolean(document.querySelector("#startup-recovery button"))'));
            } finally { bootWindow.destroy(); }
          }
          console.log(`${fault}: visible recovery without relying on successful startup`);
        }
        assetFault = undefined;
        await win.loadURL(`${PACKAGED_APP_URL}play`);
        // A hidden test window intentionally does not arm the SDK visibility watchdog.
        // Enable its real main-process watcher explicitly, then block the actual renderer.
        const beforeFreeze = envelopes.length;
        Sentry.getClient().getIntegrationByName('RendererEventLoopBlock')
          .createRendererEventLoopBlockStatusHandler()({status: 'visible', config: {
            anrThreshold: 10000, pollInterval: 1000, captureStackTrace: true,
          }}, win.webContents);
        await js('stabilityFreeze()');
        await Sentry.flush(2000);
        const {parseEnvelope} = require('@sentry/core');
        const anr = envelopes.slice(beforeFreeze).flatMap(body => {
          try { return parseEnvelope(new TextEncoder().encode(body))[1].filter(([header]) => header.type === 'event').map(([, event]) => event); }
          catch { return []; }
        }).find(event => event.exception?.values?.some(value => value.type === 'ApplicationNotResponding'));
        assert(anr, 'Real renderer freezes must reach Sentry');
        assert.equal(anr.dist, process.platform, 'Freeze reports and uploaded maps must use the same platform dist');
        const frames = anr.exception.values.flatMap(value => value.stacktrace?.frames ?? []);
        const map = new (require('node:module').SourceMap)(JSON.parse(fs.readFileSync(path.join(dist, 'bundle.js.map'), 'utf8')));
        assert(frames.some(frame => frame.filename === 'app://legion/bundle.js' &&
          map.findEntry(frame.lineno - 1, frame.colno - 1).originalSource?.endsWith('/tools/guide/fixtures.tsx')),
          `Native ANR frames must map back to TypeScript: ${JSON.stringify(frames)}`);
        console.log('Real native renderer ANR stack maps back to its original TypeScript');

        // Restore a fresh WebGL document after the forced Canvas fallback, then crash in combat.
        await win.loadURL(`${PACKAGED_APP_URL}game/crash-recovery`);
        await waitFor('Boolean(document.querySelector(".player_bar_action"))');
        const resynced = new Promise(resolve => win.webContents.once('did-finish-load', resolve));
        await js('setTimeout(() => combatCheck.resync(), 0)');
        await resynced;
        await waitFor('Boolean(document.querySelector(".player_bar_action"))');
        assert.equal(await js('combatCheck.events.listenerCount("passTurn")'), 1);
        assert.equal(await js('combatCheck.arena.teamsMap.size'), 2);
        assert.equal(win.webContents.getURL(), `${PACKAGED_APP_URL}game/crash-recovery`);
        console.log('Server resynchronization rejoins without duplicate units or controls');
        const {dialog} = require('electron');
        const showMessageBox = dialog.showMessageBox;
        let recoveryPrompted = false;
        dialog.showMessageBox = async (_window, options) => {
          assert(options.buttons.length > 0);
          recoveryPrompted = true;
          return {response: 0};
        };
        require('../../electron/recovery').installRendererRecovery(win);
        const crashed = new Promise(resolve => win.webContents.once('render-process-gone', (_event, details) => resolve(details.reason)));
        const reloaded = new Promise(resolve => win.webContents.once('did-finish-load', resolve));
        win.webContents.debugger.attach('1.3');
        void win.webContents.debugger.sendCommand('Page.crash').catch(() => {});
        assert.equal(await crashed, 'crashed');
        await reloaded;
        await waitFor('Boolean(document.querySelector(".player_bar_action"))');
        dialog.showMessageBox = showMessageBox;
        assert(recoveryPrompted);
        assert.equal(win.webContents.getURL(), `${PACKAGED_APP_URL}game/crash-recovery`);
        await Sentry.flush(2000);
        assert(envelopes.some(body => body.includes("process exited with 'crashed'")), 'Native renderer exits must be reported');
        console.log('Native renderer crash reporting and same-match recovery pass');
        await js('titleLoadingCheck.fail()');
        await waitFor('Boolean(document.querySelector(".session-status__retry"))');
        assert.equal(await js('Boolean(document.querySelector(".session-status__retry"))'), true);
        await win.loadURL(`${PACKAGED_APP_URL}play`);
        await ready();
        await js(`(() => {
          HTMLCanvasElement.prototype.getContext = () => null;
          const link = document.createElement('a');
          link.href = '/game/renderer-unavailable';
          document.body.appendChild(link);
          link.click();
        })()`);
        await waitFor('Boolean(document.querySelector(".session-status__retry"))');
        assert.equal(await js('Boolean(document.querySelector(".session-status__retry"))'), true);
        assert(await js('Boolean(document.querySelector(".session-status h1").textContent.trim())'));
        assert.equal(await js('Boolean(document.querySelector(".loading-div, .waiting-container, #scene canvas"))'), false);
        await ready();
        fs.writeFileSync(path.join(dist, 'graphics-recovery.png'), (await win.webContents.capturePage()).toPNG());
        await win.loadURL(`${PACKAGED_APP_URL}game/runtime-graphics-failure`);
        await waitFor('combatCheck.arena.gameInitialized');
        await js(`window.dispatchEvent(new ErrorEvent('error', {message: 'Cannot create WebGL context, aborting.'}))`);
        await waitFor('Boolean(document.querySelector(".session-status__retry"))');
        assert(await js('Boolean(document.querySelector(".session-status h1").textContent.trim())'));
        assert.equal(await js('Boolean(document.querySelector(".loading-div, .waiting-container, #scene canvas"))'), false);
        console.log('Render exceptions and unavailable graphics show recovery rather than a blank page');
        assert(foreignDumps.every(file => fs.existsSync(file)), 'Never scan/delete foreign crash dumps');
        console.log('Native crash storage isolation passes');
      }
    } finally {
      win.destroy();
      await Sentry.close(2000);
      sink.closeAllConnections();
      sink.close();
    }
  }).then(() => app.quit()).catch(error => {console.error(error); app.exit(1);});
}
