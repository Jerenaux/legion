// Real AuthProvider, Firebase SDK, native preload/IPC and HTTP; external services stay on loopback.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const client = path.resolve(__dirname, '../..');

if (!process.versions.electron) {
  const result = require('node:child_process').spawnSync(require('electron'), [__filename], {stdio: 'inherit'});
  process.exitCode = result.status ?? 1;
} else {
  const {app, BrowserWindow, protocol, net, session, ipcMain} = require('electron');
  const {pathToFileURL} = require('node:url');
  const {PACKAGED_APP_URL, PACKAGED_APP_SCHEME, resolveAppPath} = require('../../electron/protocol');
  const {PACKAGED_CSP} = require('../../electron/security');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'legion-startup-'));
  app.setPath('userData', path.join(temp, 'profile'));
  protocol.registerSchemesAsPrivileged([PACKAGED_APP_SCHEME]);
  app.on('window-all-closed', () => {});
  const deadline = setTimeout(() => app.exit(1), 6 * 60 * 1000);
  deadline.unref();
  let window;
  let mode;
  let releaseCredential;
  let releaseSignIn;
  let exchanges = 0;
  let aborted = false;
  let currentUser = 'startup-player';
  const failures = [];
  let rendererLogs = [];
  ipcMain.handle('set-language', () => true);
  ipcMain.handle('get-platform-auth', () => {
    if (mode === 'steam-unavailable') return require('../../electron/platform').getPlatformAuth(
      {SteamAppId: '3996730'}, () => ({init() {throw new Error('External Steam client disconnected');}}));
    if (mode === 'steam-rejected' || mode === 'itch-rejected') {
      return {provider: mode.split('-')[0], credential: 'local-test-credential'};
    }
    return mode === 'credential' ? new Promise(resolve => { releaseCredential = resolve; }) : null;
  });
  const token = () => {
    const now = Math.floor(Date.now() / 1000);
    return ['{"alg":"none"}', JSON.stringify({sub: currentUser, user_id: currentUser,
      iat: now, exp: now + 3600, aud: 'legion-32c6d', iss: 'https://securetoken.google.com/legion-32c6d',
      firebase: {sign_in_provider: 'custom', identities: {}}})]
      .map(value => Buffer.from(value).toString('base64url')).join('.') + '.';
  };
  const server = require('node:http').createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', '*');
    response.setHeader('Content-Type', 'application/json');
    if (request.method === 'OPTIONS') { response.end(); return; }
    for await (const _chunk of request) { /* Drain real HTTP requests. */ }
    if (request.url === '/createPlatformSession') {
      exchanges++;
      if (mode === 'network-once' && exchanges === 1) { request.socket.destroy(); return; }
      if (mode === 'stall-once' && exchanges === 1) {
        response.on('close', () => { aborted = true; });
        return;
      }
      if (['503-once', '429-once'].includes(mode) && exchanges === 1) {
        response.writeHead(Number(mode.slice(0, 3))); response.end('{}'); return;
      }
      if (['rejected', 'steam-rejected', 'itch-rejected'].includes(mode)) { response.writeHead(401); response.end('{}'); return; }
      if (mode === 'exchange' || mode === 'body') {
        response.on('close', () => { aborted = true; });
        if (mode === 'body') { response.writeHead(200); response.write('{'); }
        return;
      }
      if (mode === 'unavailable') { response.writeHead(503); response.end('{}'); return; }
      // Start Firebase's own network deadline after the overall session deadline.
      if (mode === 'firebase') await new Promise(resolve => setTimeout(resolve, 2000));
      response.end(JSON.stringify({customToken: 'local-test-token'}));
    } else if (request.url.includes('accounts:signInWithCustomToken')) {
      const finish = () => response.end(JSON.stringify({idToken: token(), refreshToken: 'local-refresh',
        expiresIn: '3600', localId: currentUser}));
      if (mode === 'firebase') releaseSignIn = finish;
      else finish();
    } else if (request.url.includes('accounts:lookup')) {
      response.end(JSON.stringify({users: [{localId: currentUser, createdAt: '1', lastLoginAt: '1'}]}));
    } else {
      failures.push(`Unexpected HTTP request: ${request.url}`);
      response.writeHead(404); response.end('{}');
    }
  });
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const read = expression => window.webContents.executeJavaScript(expression);
  const waitFor = async (check, label, timeout = 10000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (await check()) return;
      await pause(100);
    }
    throw new Error(`Timed out waiting for ${label}`);
  };
  (async () => {
    await app.whenReady();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    process.chdir(client);
    Object.assign(process.env, {NODE_ENV: 'production', BUILD_TARGET: 'electron', API_URL: base,
      GAME_SERVER_URL: base, MATCHMAKER_URL: base, USE_FIREBASE_EMULATOR: 'true', FIREBASE_AUTH_EMULATOR_HOST: base});
    delete process.env.SENTRY_AUTH_TOKEN;
    const config = require('../../webpack.config');
    config.entry = path.join(__dirname, 'entry.tsx');
    config.mode = 'production';
    config.output.path = path.join(temp, 'dist');
    await new Promise((resolve, reject) => require('webpack')(config, (error, stats) => {
      if (error || stats.hasErrors()) reject(error || new Error(stats.toString({all: false, errors: true})));
      else resolve();
    }));
    const automatic = ['success', 'stall-once', 'network-once', '503-once', '429-once'];
    for (const scenario of [...automatic, 'rejected', 'steam-unavailable', 'steam-rejected', 'itch-rejected', 'unavailable', 'credential', 'exchange', 'body', 'firebase']) {
      mode = scenario;
      currentUser = 'startup-player';
      exchanges = 0;
      aborted = false;
      const logs = [];
      rendererLogs = logs;
      const isolated = session.fromPartition(`startup-${scenario}`);
      isolated.webRequest.onBeforeRequest((details, callback) => {
        const allowed = details.url.startsWith('app://legion/') || details.url.startsWith(`${base}/`);
        if (!allowed) failures.push(`External request blocked: ${details.url}`);
        callback({cancel: !allowed});
      });
      isolated.webRequest.onHeadersReceived((details, callback) => callback({responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [PACKAGED_CSP.replace("connect-src 'self'", `connect-src 'self' ${base}`)],
      }}));
      isolated.protocol.handle('app', request => net.fetch(pathToFileURL(resolveAppPath(config.output.path, request.url)).toString()));
      window = new BrowserWindow({show: false, webPreferences: {session: isolated, contextIsolation: true,
        nodeIntegration: false, backgroundThrottling: false, preload: path.join(client, 'preload.js'),
        additionalArguments: ['--legion-packaged']}});
      window.webContents.setAudioMuted(true);
      window.webContents.on('console-message', event => logs.push(event.message));
      let loads = 0;
      window.webContents.on('did-finish-load', () => loads++);
      const started = Date.now();
      await window.loadURL(PACKAGED_APP_URL);
      if (!automatic.includes(scenario)) {
        await waitFor(() => read('!!document.querySelector(".session-status__retry")'), `${scenario} recovery`, 35000);
        const expectedFailure = {
          'steam-unavailable': 'steam', 'steam-rejected': 'steam', 'itch-rejected': 'itch',
          rejected: 'service', unavailable: 'service', credential: 'unknown',
          exchange: 'network', body: 'network', firebase: 'network',
        }[scenario];
        assert.equal(await read('document.querySelector("[role=alert]").dataset.sessionFailure'), expectedFailure);
        const message = await read('document.querySelector(".session-status__message").textContent');
        assert(message.trim().length > 0 && !/undefined|\{\{|local-test-credential|External Steam client/.test(message));
        if (scenario === 'steam-unavailable') assert.equal(exchanges, 0, 'Native failure must not fall back to a device account');
        if (scenario.endsWith('-rejected')) assert.equal(exchanges, 1, 'Rejected store credentials must not retry');
        if (scenario === 'credential' || scenario === 'firebase') {
          assert(Date.now() - started >= 28000, `${scenario}: deadline fired after ${Date.now() - started}ms`);
          const stage = scenario === 'credential' ? 'platform credential' : scenario === 'firebase' ? 'Firebase sign-in' : 'platform exchange';
          assert(logs.some(log => log.includes(`timed out during ${stage}`)), `${scenario}: missing stage diagnostic`);
        }
        if (scenario === 'credential') {
          releaseCredential(null);
          await pause(300);
          assert.equal(exchanges, 0, 'Late native credential must not start an exchange');
        }
        if (scenario === 'exchange' || scenario === 'body') {
          await waitFor(() => aborted, 'HTTP cancellation');
          assert.equal(exchanges, 3, 'Stalled exchanges must have a bounded retry budget');
          assert(Date.now() - started >= 23000, 'Each stalled attempt needs its own deadline');
        }
        if (scenario === 'rejected') assert.equal(exchanges, 1, 'Invalid credentials must not retry');
        if (scenario === 'unavailable') assert.equal(exchanges, 3, 'Service errors must stop after three attempts');
        if (scenario === 'firebase') {
          assert(releaseSignIn, 'Real Firebase SDK must reach the HTTP boundary');
          releaseSignIn();
          await waitFor(() => read('document.documentElement.dataset.firebaseUser === "startup-player"'), 'late SDK completion');
        }
        assert.equal(await read('!!document.querySelector("#authenticated")'), false, 'Late result must not unlock children');
        mode = 'success';
        currentUser = 'retry-player';
        await read('document.querySelector(".session-status__retry").click()');
      }
      await waitFor(() => read(`document.querySelector('#authenticated')?.dataset.user === ${JSON.stringify(currentUser)}`), `${scenario} authentication`, 15000);
      if (automatic.includes(scenario)) {
        assert.equal(exchanges, scenario === 'success' ? 1 : 2, 'Transient failure must recover without player action');
        if (scenario === 'stall-once') assert(aborted, 'Timed-out request must be cancelled');
      }
      assert.equal(loads, scenario === 'credential' || scenario === 'firebase' ? 2 : 1, `${scenario}: retry reload behavior`);
      assert.equal(failures.length, 0, failures.join('\n'));
      console.log(`PASS startup ${scenario}${automatic.includes(scenario) ? '' : ' → retry'}`);
      window.destroy();
      window = null;
    }
  })().then(() => 0, error => {
    console.error(error);
    console.error(rendererLogs.join('\n'));
    return 1;
  }).then(code => {
    window?.destroy();
    server.closeAllConnections();
    server.close();
    app.exit(code);
  });
}
