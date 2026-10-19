const {app, BrowserWindow, ipcMain, net, protocol, screen, session, shell} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const {pathToFileURL} = require("node:url");
// Keep the existing profile, device identity and pending gifts across the rebrand.
app.setPath('userData', path.join(app.getPath('appData'), 'client'));
app.setName('Emberhall');
const smokeTest = process.argv.includes('--smoke-test');
if (smokeTest) app.setPath('userData', fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'legion-smoke-')));
require('./electron/telemetry').initializeTelemetry(app);

const {getPlatformLanguage, getPlatformAuth, showGamepadTextInput, getControllerType, shutdownPlatform, getSteamLaunchParam} = require("./electron/platform");
const {PACKAGED_APP_URL, PACKAGED_APP_SCHEME, resolveAppPath} = require("./electron/protocol");
const {PACKAGED_CSP, isSafeExternalURL, isTrustedSender} = require("./electron/security");
const {readDisplayMode, writeDisplayMode, isFullscreenShortcut, displayWindowOptions, revealWindow} = require("./electron/display");

const isDev = process.env.NODE_ENV !== "production" && !app.isPackaged;
let mainWindow;
let sessionRecorder;
// Only the manual Steam/Itch release workflow stamps this package marker.
const storeReplayBuild = app.isPackaged && require('./package.json').replayChannel === 'store';
const recordReplays = storeReplayBuild && !smokeTest && !process.env.CI && !process.env.GITHUB_ACTIONS;
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();
const {giftFromArguments, createGiftQueue} = require('./electron/gifts');
const gifts = hasSingleInstanceLock ? createGiftQueue(path.join(app.getPath('userData'), 'pending-gifts.json'), () => {
  mainWindow?.webContents.send('gift-available');
}) : null;
gifts?.add(giftFromArguments(process.argv));
const {communityFromArguments, createCommunityInvite} = require('./electron/communities');
const communityInvite = hasSingleInstanceLock ? createCommunityInvite(() => {
  mainWindow?.webContents.send('community-invite-available');
}) : null;
communityInvite?.add(communityFromArguments(process.argv));
let giftPoll;

protocol.registerSchemesAsPrivileged([PACKAGED_APP_SCHEME]);

// Keep the Steam overlay disabled on every platform. Do not enable its Electron
// GPU overrides or repaint timer; Steam SDK services initialize independently.

function trustedIPC(event) {
  return event.sender === mainWindow?.webContents && isTrustedSender(event.senderFrame?.url || "", isDev);
}

function loadSteamworks() {
  return require(app.isPackaged ? path.join(process.resourcesPath, "steamworks.js") : "steamworks.js");
}

function registerIPC() {
  ipcMain.handle('get-pending-gift', event => {
    if (!trustedIPC(event)) throw new Error('Untrusted IPC sender');
    return gifts.peek();
  });
  ipcMain.handle('acknowledge-gift', (event, token) => {
    if (!trustedIPC(event)) throw new Error('Untrusted IPC sender');
    gifts.acknowledge(token);
  });
  ipcMain.handle('get-pending-community', event => {
    if (!trustedIPC(event)) throw new Error('Untrusted IPC sender');
    return communityInvite.peek();
  });
  ipcMain.handle('acknowledge-community', (event, code) => {
    if (!trustedIPC(event)) throw new Error('Untrusted IPC sender');
    communityInvite.acknowledge(code);
  });
  ipcMain.handle('set-language', (event, code) => {
    if (!trustedIPC(event)) throw new Error('Untrusted IPC sender');
    return require('./electron/localization').setLanguage(code);
  });
  ipcMain.handle("is-fullscreen", event => trustedIPC(event) ? mainWindow.isFullScreen() : false);
  ipcMain.handle("toggle-fullscreen", event => {
    if (!trustedIPC(event)) throw new Error("Untrusted IPC sender");
    // macOS animates the switch, so report the requested mode rather than the current one.
    const fullscreen = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(fullscreen);
    return fullscreen;
  });
  ipcMain.handle("quit-app", event => {
    if (!trustedIPC(event)) throw new Error("Untrusted IPC sender");
    app.quit();
  });
  ipcMain.handle("get-platform-auth", event => {
    if (!trustedIPC(event)) throw new Error("Untrusted IPC sender");
    if (smokeTest) return null;
    return getPlatformAuth(process.env, loadSteamworks);
  });
  ipcMain.handle("show-gamepad-text-input", (event, options) => {
    if (!trustedIPC(event)) throw new Error("Untrusted IPC sender");
    return showGamepadTextInput(options);
  });
  ipcMain.handle("get-controller-type", event => {
    if (!trustedIPC(event)) throw new Error("Untrusted IPC sender");
    return getControllerType();
  });
}

function registerAppProtocol() {
  const distPath = path.join(__dirname, "dist");
  protocol.handle("app", request => {
    let filePath = resolveAppPath(distPath, request.url);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) filePath = path.join(distPath, "index.html");
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function createWindow() {
  const steamLanguage = smokeTest ? null : getPlatformLanguage(process.env, loadSteamworks);
  // Hidden smoke tests stay windowed; players get the mode they last chose (fullscreen at first).
  const startFullscreen = !smokeTest && readDisplayMode(app.getPath("userData")).fullscreen;
  // Start at the maximized size so the first paint already fills the screen.
  const {x, y, width, height} = screen.getPrimaryDisplay().workArea;
  mainWindow = new BrowserWindow({
    x, y, width, height,
    show: false,
    ...displayWindowOptions(startFullscreen),
    autoHideMenuBar: !isDev,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: isDev,
      webSecurity: true,
      additionalArguments: [
        ...(app.isPackaged ? ['--legion-packaged'] : []),
        ...(recordReplays ? ['--legion-replay'] : []),
        ...(steamLanguage ? [`--legion-steam-language=${steamLanguage}`] : []),
        ...(smokeTest ? ['--legion-smoke-test'] : []),
      ],
    },
  });
  if (recordReplays) {
    try {
      sessionRecorder = require('@jerenaux/replay/electron').installReplay(mainWindow, {
        game: 'legion',
        endpoint: 'https://europe-west1-games-analytics-jr.cloudfunctions.net/replayIngest',
        outbox: path.join(app.getPath('userData'), 'replay', 'outbox'),
        isTrustedURL: url => isTrustedSender(url, isDev),
        metadata: {game_version: app.getVersion(), channel: process.env.ITCHIO_API_KEY ? 'itch' : (process.env.SteamAppId || process.env.SteamGameId) ? 'steam' : 'store', debug_build: false},
        onError: (error, operation) => require('@sentry/electron/main').captureException(error, {
          tags: {subsystem: 'replay', operation},
        }),
      });
    } catch (error) { require('@sentry/electron/main').captureException(error); }
  }
  const localization = require('./electron/localization');
  localization.useSystemLanguages([steamLanguage, ...app.getPreferredSystemLanguages()]);
  require('./electron/recovery').installRendererRecovery(mainWindow, localization.t);

  if (smokeTest) {
    mainWindow.webContents.setAudioMuted(true);
    setTimeout(() => {console.error('Packaged startup or quit timed out'); app.exit(1);}, 20000);
    mainWindow.webContents.once('did-finish-load', async () => {
      try {
        let recovered = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          recovered = await mainWindow.webContents.executeJavaScript('Boolean(document.querySelector(".session-status__retry") && window.electronAPI?.smokeTest)');
          if (recovered) break;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!recovered || mainWindow.webContents.getURL() !== PACKAGED_APP_URL) throw new Error('Packaged offline recovery screen missing');
        console.log('Packaged offline recovery screen loaded; requesting quit through preload');
        // Defer the IPC call so this evaluation returns before Electron destroys its renderer.
        await mainWindow.webContents.executeJavaScript('setTimeout(() => { void window.electronAPI.quitApp(); }, 0); true');
      } catch (error) {console.error(error); app.exit(1);}
    });
  }

  // Persist the final replay segment before close, even if the renderer is unresponsive.
  // Upload can retry from disk next launch; Sentry retains its bounded renderer flush.
  let telemetryFlushed = smokeTest;
  mainWindow.on('close', event => {
    if (telemetryFlushed) return;
    telemetryFlushed = true;
    event.preventDefault();
    void sessionRecorder?.stop().catch(() => {});
    const window = mainWindow;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      ipcMain.removeListener('telemetry-flushed', onReply);
      if (!window.isDestroyed()) window.close();
    };
    const onReply = replyEvent => { if (replyEvent.sender === window.webContents) finish(); };
    ipcMain.on('telemetry-flushed', onReply);
    setTimeout(finish, 1500);
    window.hide();
    window.webContents.send('telemetry-flush');
  });

  mainWindow.webContents.setWindowOpenHandler(({url}) => {
    if (isSafeExternalURL(url)) shell.openExternal(url);
    return {action: "deny"};
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedSender(url, isDev)) event.preventDefault();
  });
  mainWindow.once("ready-to-show", () => {
    if (!mainWindow) return;
    if (smokeTest) {
      mainWindow.maximize();
      return;
    }
    revealWindow(mainWindow, startFullscreen);
  });
  // Every route (shortcut, Settings, the macOS window button) is remembered for the next launch.
  mainWindow.on("enter-full-screen", () => { if (!smokeTest) writeDisplayMode(app.getPath("userData"), {fullscreen: true}); });
  mainWindow.on("leave-full-screen", () => {
    if (smokeTest || !mainWindow) return;
    writeDisplayMode(app.getPath("userData"), {fullscreen: false});
    mainWindow.maximize();
  });
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (!isFullscreenShortcut(input)) return;
    // Also stops the default menu's accelerator from toggling a second time.
    event.preventDefault();
    mainWindow?.setFullScreen(!mainWindow.isFullScreen());
  });
  mainWindow.on("closed", () => { mainWindow = undefined; });

  if (isDev) {
    mainWindow.loadURL("http://localhost:8080/");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(PACKAGED_APP_URL);
  }
}

if (hasSingleInstanceLock) app.whenReady().then(async () => {
  if (smokeTest) session.defaultSession.webRequest.onBeforeRequest(
    {urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*']},
    (_details, done) => done({cancel: true}),
  );
  registerIPC();
  registerAppProtocol();
  if (!isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => callback({
      responseHeaders: {...details.responseHeaders, "Content-Security-Policy": [PACKAGED_CSP],
        "Document-Policy": ["include-js-call-stacks-in-crash-reports"]},
    }));
  }

  if (isDev) {
    try {
      await require("wait-on")({resources: ["http://localhost:8080/"], timeout: 30000});
    } catch (error) {
      console.error("Webpack dev server did not start:", error);
      app.quit();
      return;
    }
  }
  createWindow();
  if (!smokeTest) {
    if (app.isPackaged) app.setAsDefaultProtocolClient('legion');
    let lastSteamToken;
    let lastSteamCommunity;
    const poll = () => {
      try {
        const root = app.isPackaged ? path.join(process.resourcesPath, 'steamworks.js') : path.dirname(require.resolve('steamworks.js'));
        const token = getSteamLaunchParam(root, 'gift');
        if (token !== lastSteamToken) { lastSteamToken = token; gifts.add(token); }
        const community = getSteamLaunchParam(root, 'community');
        if (community !== lastSteamCommunity) { lastSteamCommunity = community; communityInvite.add(community); }
      } catch {
        // Do not print launch arguments/tokens. Retry when Steam becomes available.
      }
    };
    poll();
    giftPoll = setInterval(poll, 1000);
  }
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  gifts?.add(giftFromArguments([url]));
  communityInvite?.add(communityFromArguments([url]));
  mainWindow?.focus();
});

app.on("second-instance", (_event, argv) => {
  gifts?.add(giftFromArguments(argv));
  communityInvite?.add(communityFromArguments(argv));
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.on("window-all-closed", () => {
  app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("before-quit", () => { clearInterval(giftPoll); shutdownPlatform(); });
