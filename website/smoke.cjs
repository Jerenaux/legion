// Run with the installed Electron, hidden and muted; no external traffic or account access.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
if (!process.versions.electron) {
  require('./build.cjs');
  const result = require('node:child_process').spawnSync(require('../client/node_modules/electron'), [__filename, ...process.argv.slice(2)], {stdio: 'inherit'});
  process.exitCode = result.status ?? 1;
} else {
  const {app, BrowserWindow, session} = require('electron');
  const profile = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'legion-website-'));
  app.setPath('userData', profile);
  app.on('window-all-closed', () => {});
  const headers = Object.fromEntries(require('../firebase.json').hosting.headers[0].headers.map(header => [header.key, header.value]));
  const server = require('node:http').createServer((req, res) => {
    const file = path.resolve(__dirname, 'dist', '.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(path.resolve(__dirname, 'dist') + path.sep)) {
      res.writeHead(200, {...headers, 'Content-Type': 'text/html'}); res.end(fs.readFileSync(path.join(__dirname, 'dist/index.html'))); return;
    }
    const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(__dirname, 'dist/index.html');
    const mime = {'.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.otf': 'font/otf', '.ico': 'image/x-icon'};
    res.writeHead(200, {...headers, 'Content-Type': mime[path.extname(target)]}); res.end(fs.readFileSync(target));
  }).listen(0);
  app.whenReady().then(async () => {
    const url = process.argv[2] || `http://127.0.0.1:${server.address().port}`;
    const origin = new URL(url).origin;
    const remote = [];
    session.defaultSession.webRequest.onBeforeRequest((details, done) => {
      const external = /^https?:/.test(details.url) && new URL(details.url).origin !== origin;
      if (external) remote.push(details.url);
      done({cancel: external});
    });
    const win = new BrowserWindow({show: false, webPreferences: {sandbox: true, contextIsolation: true}});
    win.webContents.setAudioMuted(true);
    try {
      for (const route of ['/', '/game/0']) {
        await win.loadURL(url.replace(/\/$/, '') + route);
        for (const width of [1280, 375]) {
          win.setContentSize(width, 900);
          await win.webContents.executeJavaScript('document.fonts.ready');
          const state = await win.webContents.executeJavaScript(`({
            scripts: document.scripts.length,
            links: Array.from(document.querySelectorAll('a')).map(a => a.href),
            overflow: document.documentElement.scrollWidth > innerWidth,
            images: Array.from(document.images).filter(i => i.loading !== 'lazy').every(i => i.complete && i.naturalWidth > 0),
            title: document.querySelector('h1')?.textContent
          })`);
          assert.equal(state.scripts, 0);
          assert.equal(state.overflow, false, 'No horizontal overflow at ' + width);
          assert.equal(state.images, true);
          assert(state.title.includes('Classic RPG combat'));
          assert.equal(state.links.filter(link => link.startsWith('https://store.steampowered.com/app/3729580/Legion/')).length, 3);
          assert(state.links.includes('https://dikaryon.itch.io/legion'));
          if (route === '/') fs.writeFileSync(path.join(profile, `website-${width}.png`), (await win.webContents.capturePage()).toPNG());
        }
      }
      assert(remote.every(url => url.startsWith('https://www.youtube-nocookie.com/')), 'The landing page must not contact game/auth/telemetry services');
      console.log('Website desktop/mobile, legacy routes, assets, store links and no-backend checks pass; screenshots:', profile);
    } finally {win.destroy(); server.closeAllConnections(); server.close();}
  }).then(() => app.quit()).catch(error => {console.error(error); app.exit(1);});
}
