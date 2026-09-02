const {app, BrowserWindow, ipcMain, net, protocol, session, shell} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const {pathToFileURL} = require("node:url");

const {getPlatformAuth, showGamepadTextInput, getControllerType, shutdownPlatform} = require("./electron/platform");
const {resolveAppPath} = require("./electron/protocol");
const {isSafeExternalURL, isTrustedSender} = require("./electron/security");

const isDev = process.env.NODE_ENV !== "production" && !app.isPackaged;
let mainWindow;
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

protocol.registerSchemesAsPrivileged([{
  scheme: "app",
  privileges: {standard: true, secure: true, supportFetchAPI: true, corsEnabled: true},
}]);

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
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({url}) => {
    if (isSafeExternalURL(url)) shell.openExternal(url);
    return {action: "deny"};
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedSender(url, isDev)) event.preventDefault();
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });
  mainWindow.on("closed", () => { mainWindow = undefined; });

  if (isDev) {
    mainWindow.loadURL("http://localhost:8080/");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL("app://legion/index.html");
  }
}

if (hasSingleInstanceLock) app.whenReady().then(async () => {
  registerIPC();
  registerAppProtocol();
  if (!isDev) {
    const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' https: wss:; font-src 'self' data:; frame-src 'none'; object-src 'none'; base-uri 'self'";
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => callback({
      responseHeaders: {...details.responseHeaders, "Content-Security-Policy": [csp]},
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
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("before-quit", shutdownPlatform);
