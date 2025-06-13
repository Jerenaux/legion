const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

// Enable proper storage for Firebase Auth
app.commandLine.appendSwitch('enable-features', 'ElectronCookies');
app.commandLine.appendSwitch('disable-site-isolation-trials');
// Additional switches for Firebase Auth persistence
app.commandLine.appendSwitch('enable-experimental-web-platform-features');
app.commandLine.appendSwitch('enable-local-storage');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Enable proper storage for Firebase Auth
      webSecurity: true,
      allowRunningInsecureContent: false,
      // Enable cookies and storage
      partition: 'persist:main',
      // Additional settings for Firebase Auth
      sandbox: false,
      // Enable DOM storage and indexedDB for Firebase persistence
      enableRemoteModule: false,
      // Ensure storage APIs are available
      experimentalFeatures: true
    },
    // Remove menu bar in production
    autoHideMenuBar: !isDev
  });

  // Load the app
  if (isDev) {
    // In development, load from webpack dev server
    // The webpack dev server is configured to proxy requests to the Docker services
    mainWindow.loadURL('http://localhost:8080');
    
    // Open DevTools in development
    mainWindow.webContents.openDevTools();

    // Handle webpack dev server connection errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load:', errorCode, errorDescription);
      if (errorCode === -102) {
        console.log('Waiting for webpack dev server to start...');
        setTimeout(() => {
          mainWindow.loadURL('http://localhost:8080');
        }, 1000);
      }
    });
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // Log any console messages from the renderer process
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log('Renderer Console:', message);
  });
}

// Wait for webpack dev server to be ready
if (isDev) {
  try {
    const waitOn = require('wait-on');
    const opts = {
      resources: ['http://localhost:8080'],
      timeout: 30000,
    };

    waitOn(opts)
      .then(() => {
        createWindow();
      })
      .catch((err) => {
        console.error('Error waiting for webpack dev server:', err);
        app.quit();
      });
  } catch (err) {
    console.log('wait-on not available in production, starting app directly');
    app.whenReady().then(createWindow);
  }
} else {
  app.whenReady().then(createWindow);
}

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}); 