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
  ipcMain.handle('get-platform-auth', () => mode === 'credential'
    ? new Promise(resolve => { releaseCredential = resolve; }) : null);
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
    for (const scenario of ['success', 'unavailable', 'credential', 'exchange', 'body', 'firebase']) {
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
      window.webContents.on('console-message', event => logs.push(event.message));
      let loads = 0;
      window.webContents.on('did-finish-load', () => loads++);
      const started = Date.now();
      await window.loadURL(PACKAGED_APP_URL);
      if (scenario !== 'success') {
        await waitFor(() => read('!!document.querySelector(".session-status__retry")'), `${scenario} recovery`, 35000);
        if (scenario !== 'unavailable') {
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
        }
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
      await waitFor(() => read(`document.querySelector('#authenticated')?.dataset.user === ${JSON.stringify(currentUser)}`), `${scenario} authentication`);
      assert.equal(loads, scenario === 'success' || scenario === 'unavailable' ? 1 : 2, `${scenario}: retry reload behavior`);
      assert.equal(failures.length, 0, failures.join('\n'));
      console.log(`PASS startup ${scenario}${scenario === 'success' ? '' : ' → retry'}`);
      window.destroy();
      window = null;
    }
  })().then(() => 0, async error => {
    console.error(error);
    console.error(rendererLogs.join('\n'));
    if (window && !window.isDestroyed()) {
      fs.writeFileSync(path.join(temp, 'failure.png'), (await window.webContents.capturePage()).toPNG());
      console.error(`Failure screenshot: ${path.join(temp, 'failure.png')}`);
    }
    return 1;
  }).then(code => {
    window?.destroy();
    server.closeAllConnections();
    server.close();
    app.exit(code);
  });
}
