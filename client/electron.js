const {app, BrowserWindow, ipcMain, net, protocol, session, shell} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const {pathToFileURL} = require("node:url");
const smokeTest = process.argv.includes('--smoke-test');
if (smokeTest) app.setPath('userData', fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'legion-smoke-')));
require('./electron/telemetry').initializeTelemetry(app);

const {getPlatformAuth, showGamepadTextInput, getControllerType, shutdownPlatform} = require("./electron/platform");
const {PACKAGED_APP_URL, PACKAGED_APP_SCHEME, resolveAppPath} = require("./electron/protocol");
const {PACKAGED_CSP, isSafeExternalURL, isTrustedSender} = require("./electron/security");

const isDev = process.env.NODE_ENV !== "production" && !app.isPackaged;
let mainWindow;
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

protocol.registerSchemesAsPrivileged([PACKAGED_APP_SCHEME]);

function trustedIPC(event) {
  return event.sender === mainWindow?.webContents && isTrustedSender(event.senderFrame?.url || "", isDev);
}

function registerIPC() {
  ipcMain.handle("is-fullscreen", event => trustedIPC(event) ? mainWindow.isFullScreen() : false);
  ipcMain.handle("toggle-fullscreen", event => {
    if (!trustedIPC(event)) throw new Error("Untrusted IPC sender");
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
    return mainWindow.isFullScreen();
  });
  ipcMain.handle("get-platform-auth", event => {
    if (!trustedIPC(event)) throw new Error("Untrusted IPC sender");
    if (smokeTest) return null;
    const modulePath = app.isPackaged ? path.join(process.resourcesPath, "steamworks.js") : "steamworks.js";
    return getPlatformAuth(process.env, () => require(modulePath));
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
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    autoHideMenuBar: !isDev,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: isDev,
      webSecurity: true,
      additionalArguments: smokeTest ? ['--legion-smoke-test'] : [],
    },
  });

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
    if (!smokeTest) mainWindow.show();
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
