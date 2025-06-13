const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

// Enable proper storage for Firebase Auth
app.commandLine.appendSwitch('enable-features', 'ElectronCookies');
app.commandLine.appendSwitch('disable-site-isolation-trials');
// Additional switches for Firebase Auth persistence
app.commandLine.appendSwitch('enable-experimental-web-platform-features');
app.commandLine.appendSwitch('enable-local-storage');

// Add http server for production builds
let server = null;

function startProductionServer() {
  const express = require('express');
  const expressApp = express();
  const port = 3000; // Use port 3000 which is commonly pre-authorized
  
  let staticPath;
  if (app.isPackaged) {
    staticPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'dist');
  } else {
    staticPath = path.join(__dirname, 'dist');
  }
  
  console.log('Serving static files from:', staticPath);
  
  expressApp.use(express.static(staticPath));
  
  // Handle SPA routing - serve index.html for all routes
  expressApp.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
  
  return new Promise((resolve, reject) => {
    server = expressApp.listen(port, 'localhost', (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`Production server running on http://localhost:${port}`);
        resolve(`http://localhost:${port}`);
      }
    });
  });
}

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
    // In production, serve files from local HTTP server
    startProductionServer()
      .then((serverUrl) => {
        console.log('Loading from server:', serverUrl);
        console.log('isDev:', isDev);
        console.log('isPackaged:', app.isPackaged);
        console.log('NODE_ENV:', process.env.NODE_ENV);
        
        // Temporarily open DevTools for debugging
        // mainWindow.webContents.openDevTools();
        
        mainWindow.loadURL(serverUrl).catch(err => {
          console.error('Failed to load URL:', err);
        });
      })
      .catch(err => {
        console.error('Failed to start production server:', err);
        app.quit();
      });
  }

  // Log any console messages from the renderer process
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log('Renderer Console:', message);
  });

  // Handle page load failures
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Page failed to load:', errorCode, errorDescription, validatedURL);
  });

  // Log when page finishes loading
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page finished loading successfully');
  });

  // Log when DOM is ready
  mainWindow.webContents.on('dom-ready', () => {
    console.log('DOM is ready');
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
  // Close the server when quitting
  if (server) {
    server.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Ensure server is closed when app quits
app.on('before-quit', () => {
  if (server) {
    server.close();
  }
}); 