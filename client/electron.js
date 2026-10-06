const {app, BrowserWindow, ipcMain, net, protocol, session, shell} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const {pathToFileURL} = require("node:url");
const smokeTest = process.argv.includes('--smoke-test');
if (smokeTest) app.setPath('userData', fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'legion-smoke-')));
require('./electron/telemetry').initializeTelemetry(app);

const {getPlatformLanguage, getPlatformAuth, showGamepadTextInput, getControllerType, shutdownPlatform} = require("./electron/platform");
const {PACKAGED_APP_URL, PACKAGED_APP_SCHEME, resolveAppPath} = require("./electron/protocol");
const {PACKAGED_CSP, isSafeExternalURL, isTrustedSender} = require("./electron/security");
const {readDisplayMode, writeDisplayMode, isFullscreenShortcut, displayWindowOptions} = require("./electron/display");

const isDev = process.env.NODE_ENV !== "production" && !app.isPackaged;
let mainWindow;
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

protocol.registerSchemesAsPrivileged([PACKAGED_APP_SCHEME]);

// When Steam launches the game, enable its overlay so Shift+Tab and Steam's screenshot key
// (F12 by default, saved and uploadable from the Steam library) work. This must run before
// the app is ready; it is skipped for Itch, direct launches and smoke tests.
if (!smokeTest && hasSingleInstanceLock && (process.env.SteamAppId || process.env.SteamGameId)) {
  try {
    loadSteamworks().electronEnableSteamOverlay();
  } catch (error) {
    console.error("Steam overlay unavailable:", error);
  }
}

function trustedIPC(event) {
  return event.sender === mainWindow?.webContents && isTrustedSender(event.senderFrame?.url || "", isDev);
}

function loadSteamworks() {
  return require(app.isPackaged ? path.join(process.resourcesPath, "steamworks.js") : "steamworks.js");
}

function registerIPC() {
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
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
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
        ...(steamLanguage ? [`--legion-steam-language=${steamLanguage}`] : []),
        ...(smokeTest ? ['--legion-smoke-test'] : []),
      ],
    },
  });
  const localization = require('./electron/localization');
  localization.useSystemLanguages([steamLanguage, ...app.getPreferredSystemLanguages()]);
  require('./electron/recovery').installRendererRecovery(mainWindow, localization.t);

  if (smokeTest) {
    mainWindow.webContents.setAudioMuted(true);
    const timeout = setTimeout(() => {console.error('Packaged startup timed out'); app.exit(1);}, 20000);
    mainWindow.webContents.once('did-finish-load', async () => {
      try {
        let recovered = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          recovered = await mainWindow.webContents.executeJavaScript('Boolean(document.querySelector(".session-status__retry") && window.electronAPI?.smokeTest)');
          if (recovered) break;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!recovered || mainWindow.webContents.getURL() !== PACKAGED_APP_URL) throw new Error('Packaged offline recovery screen missing');
        clearTimeout(timeout);
        console.log('Packaged offline recovery screen loaded; closing normally');
        mainWindow.close();
      } catch (error) {console.error(error); app.exit(1);}
    });
  }

  mainWindow.webContents.setWindowOpenHandler(({url}) => {
    if (isSafeExternalURL(url)) shell.openExternal(url);
    return {action: "deny"};
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedSender(url, isDev)) event.preventDefault();
  });
  mainWindow.once("ready-to-show", () => {
    if (!mainWindow) return;
    mainWindow.maximize();
    if (smokeTest) return;
    mainWindow.show();
    if (startFullscreen && !mainWindow.isFullScreen()) mainWindow.setFullScreen(true);
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
});

app.on("second-instance", () => {
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
app.on("before-quit", shutdownPlatform);
