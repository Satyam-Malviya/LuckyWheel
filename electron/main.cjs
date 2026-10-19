const fs = require('fs');
const path = require('path');
const debugLogPath = path.join(__dirname, '../main_debug.log');
function logDebug(msg) {
  try {
    fs.appendFileSync(debugLogPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}
logDebug('main.cjs starting... ELECTRON_RUN_AS_NODE=' + process.env.ELECTRON_RUN_AS_NODE);
process.on('uncaughtException', (err) => {
  logDebug('UNCAUGHT EXCEPTION: ' + (err && err.stack ? err.stack : err));
});
process.on('unhandledRejection', (err) => {
  logDebug('UNHANDLED REJECTION: ' + (err && err.stack ? err.stack : err));
});

const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  clipboard,
  globalShortcut,
  screen,
  Tray,
  Menu,
  nativeImage,
} = require('electron');
const os = require('os');
const http = require('http');
const { exec, spawn } = require('child_process');
const { processFiles, checkFfmpeg, generateWifiQrForFile } = require('./converter.cjs');

// Ensure clean writable cache directory on Windows
try {
  app.setPath('userData', path.join(os.tmpdir(), 'luckywheel-studio-data'));
} catch {}

let mainWindow = null;
let overlayWindow = null;
let overlayCursorTimer = null;
let lastCursorDip = { x: -1, y: -1 };
let tray = null;
let isQuitting = false;
let watcherProcess = null;
let sharedFilesMap = new Map();
let shareServerPort = null;

const OVERLAY_W = 840;
const OVERLAY_H = 540;

// Start lightweight local LAN HTTP server for "Share to Phone via Wi-Fi QR"
function startLocalShareServer() {
  const server = http.createServer((req, res) => {
    const token = (req.url || '').replace(/^\//, '').split('?')[0];
    const filePath = sharedFilesMap.get(token);
    if (!filePath || !fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('LuckyWheel: File link expired or not found.');
      return;
    }
    const stat = fs.statSync(filePath);
    const fileName = encodeURIComponent(path.basename(filePath));
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    fs.createReadStream(filePath).pipe(res);
  });

  server.listen(0, '0.0.0.0', () => {
    shareServerPort = server.address().port;
  });
}

function getLocalLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

// Query currently selected files in Windows File Explorer/Desktop OR macOS Finder/Desktop
function getWindowsExplorerSelectedFiles() {
  return new Promise((resolve) => {
    if (process.platform === 'darwin') {
      const osaScript = `
        tell application "Finder"
          set sel to selection
          set outPaths to ""
          repeat with i in sel
            set outPaths to outPaths & (POSIX path of (i as alias)) & linefeed
          end repeat
          return outPaths
        end tell
      `;
      exec(
        `osascript -e '${osaScript.replace(/'/g, "'\\''")}'`,
        { timeout: 2500 },
        (err, stdout) => {
          if (err || !stdout) return resolve([]);
          const paths = stdout
            .split(/\r?\n/)
            .map((s) => s.trim().replace(/\/$/, ''))
            .filter(Boolean);
          resolve(paths);
        }
      );
      return;
    }

    if (process.platform !== 'win32') return resolve([]);
    const psScript = `
      $shell = New-Object -ComObject Shell.Application;
      $paths = @();
      try {
        $h = 0;
        $d = $shell.Windows().FindWindowSW(0, 0, 8, [ref]$h, 1);
        if ($null -ne $d) {
          foreach ($item in $d.Document.SelectedItems()) {
            if ($item.Path) { $paths += [string]$item.Path }
          }
        }
      } catch {}
      if ($paths.Count -eq 0) {
        foreach ($win in $shell.Windows()) {
          try {
            $sel = $win.Document.SelectedItems();
            foreach ($item in $sel) {
              if ($item.Path) { $paths += [string]$item.Path }
            }
            if ($paths.Count -gt 0) { break }
          } catch {}
        }
      }
      ($paths | Select-Object -Unique) | ConvertTo-Json -Compress
    `;
    exec(
      `powershell -NoProfile -NonInteractive -Command "${psScript.replace(/\r?\n/g, ' ')}"`,
      { timeout: 2500, windowsHide: true },
      (err, stdout) => {
        if (err || !stdout || !stdout.trim()) return resolve([]);
        try {
          const parsed = JSON.parse(stdout.trim());
          const arr = Array.isArray(parsed) ? parsed : [parsed];
          resolve(arr.filter(Boolean));
        } catch {
          resolve([]);
        }
      }
    );
  });
}

function bringWindowToFront(win) {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  win.moveTop();
  win.setAlwaysOnTop(true, 'screen-saver');
  setTimeout(() => {
    if (!win.isDestroyed()) {
      win.setAlwaysOnTop(false);
    }
  }, 1500);
}

function createSystemTray() {
  try {
    const iconPath = path.join(__dirname, '../public/assets/icons/jpg.png');
    const distIconPath = path.join(__dirname, '../dist/assets/icons/jpg.png');
    const resolvedIcon = fs.existsSync(distIconPath) ? distIconPath : iconPath;
    const trayImg = fs.existsSync(resolvedIcon)
      ? nativeImage.createFromPath(resolvedIcon).resize({ width: 16, height: 16 })
      : nativeImage.createEmpty();

    tray = new Tray(trayImg);
    tray.setToolTip('LuckyWheel — Running in Background (Select file in Explorer/Desktop & press Shift)');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'LuckyWheel Background Engine (Active ✓)',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Open LuckyWheel Dashboard',
        click: () => {
          if (mainWindow) bringWindowToFront(mainWindow);
        },
      },
      {
        label: 'Summon Radial Wheel at Cursor (Alt+Space)',
        click: async () => {
          const files = await getWindowsExplorerSelectedFiles();
          const pt = screen.getCursorScreenPoint();
          showOverlayAtDipPoint(pt.x, pt.y, 'conversions', files, false);
        },
      },
      { type: 'separator' },
      {
        label: 'Quit LuckyWheel Completely',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) mainWindow.hide();
        else bringWindowToFront(mainWindow);
      }
    });
  } catch (e) {
    logDebug('Tray creation error: ' + e.message);
  }
}

function stopOverlayCursorPolling() {
  if (overlayCursorTimer) {
    clearInterval(overlayCursorTimer);
    overlayCursorTimer = null;
  }
}

function startOverlayCursorPolling() {
  stopOverlayCursorPolling();
  // 60FPS native C++ cursor tracking while overlay is visible
  overlayCursorTimer = setInterval(() => {
    if (!overlayWindow || overlayWindow.isDestroyed() || !overlayWindow.isVisible()) {
      stopOverlayCursorPolling();
      return;
    }
    const pt = screen.getCursorScreenPoint();
    if (pt.x !== lastCursorDip.x || pt.y !== lastCursorDip.y) {
      lastCursorDip = { x: pt.x, y: pt.y };
      overlayWindow.webContents.send('overlay:event', {
        type: 'move',
        dipX: pt.x,
        dipY: pt.y,
      });
    }
  }, 16);
}

function hideOverlayWindow() {
  stopOverlayCursorPolling();
  if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
    overlayWindow.hide();
  }
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    title: 'LuckyWheelOverlayWindow',
    width: OVERLAY_W,
    height: OVERLAY_H,
    transparent: true,
    frame: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    acceptFirstMouse: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Prevent HTML <title> from overwriting "LuckyWheelOverlayWindow"
  overlayWindow.on('page-title-updated', (e) => {
    e.preventDefault();
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const prodIndex = path.join(__dirname, '../dist/index.html');
  if (fs.existsSync(prodIndex)) {
    overlayWindow.loadFile(prodIndex, { query: { overlay: '1' } });
  } else {
    overlayWindow.loadURL('http://localhost:5173/?overlay=1');
  }
}

function showOverlayAtDipPoint(dipX, dipY, mode, files, dragging = false) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const bounds = {
    x: Math.round(dipX - OVERLAY_W / 2),
    y: Math.round(dipY - OVERLAY_H / 2),
    width: OVERLAY_W,
    height: OVERLAY_H,
  };
  overlayWindow.setBounds(bounds, false);
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  // Use showInactive so File Explorer / Desktop NEVER loses selection focus and the wheel blooms in <5ms!
  overlayWindow.showInactive();

  lastCursorDip = { x: dipX, y: dipY };
  overlayWindow.webContents.send('overlay:event', {
    type: 'show',
    mode: mode || 'conversions',
    centerDipX: dipX,
    centerDipY: dipY,
    files: files && files.length ? files : [],
    isDragging: !!dragging,
  });

  startOverlayCursorPolling();
}

function resolveBundledScript(fileName) {
  const unpacked = path.join(__dirname, fileName).replace('app.asar', 'app.asar.unpacked');
  if (fs.existsSync(unpacked)) return unpacked;
  return path.join(__dirname, fileName);
}

function startExplorerWatcher() {
  if (process.platform !== 'win32' && process.platform !== 'darwin') return;

  try {
    if (process.platform === 'win32') {
      const scriptPath = resolveBundledScript('explorer-watcher.ps1');
      if (!fs.existsSync(scriptPath)) return;
      watcherProcess = spawn(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
        { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
      );
    } else if (process.platform === 'darwin') {
      const scriptPath = resolveBundledScript('mac-watcher.jxa');
      if (!fs.existsSync(scriptPath)) return;
      watcherProcess = spawn('osascript', ['-l', 'JavaScript', scriptPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    }

    let buffer = '';
    watcherProcess.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('{')) continue;
        try {
          const ev = JSON.parse(trimmed);
          if (ev.type === 'ready') {
            logDebug(`Stateless watcher ready (${process.platform}) and watching Desktop & File Manager!`);
            continue;
          }

          if (ev.type === 'escape') {
            hideOverlayWindow();
            continue;
          }

          const cursorDip = screen.getCursorScreenPoint();
          const isVisible = !!(overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible());

          if (ev.type === 'keydown') {
            if (!isVisible) {
              if (ev.key === 'Shift' || ev.key === 'Alt') {
                const filesArr = Array.isArray(ev.files)
                  ? ev.files.filter(Boolean)
                  : ev.files
                  ? [ev.files]
                  : [];
                if (filesArr.length > 0) {
                  logDebug(`Overlay show triggered (${ev.mode}) for ${filesArr.length} file(s): ${filesArr[0]}`);
                  showOverlayAtDipPoint(
                    cursorDip.x,
                    cursorDip.y,
                    ev.mode || 'conversions',
                    filesArr,
                    !!ev.isDragging
                  );
                }
              }
            } else {
              // Overlay is already open -> switch wheel mode (Convert / Tools / Actions)
              overlayWindow.webContents.send('overlay:event', {
                type: 'mode',
                mode: ev.mode || 'conversions',
              });
            }
          } else if (isVisible) {
            if (ev.type === 'keyup') {
              overlayWindow.webContents.send('overlay:event', {
                type: 'keyrelease',
                key: ev.key,
                dipX: cursorDip.x,
                dipY: cursorDip.y,
              });
            } else if (ev.type === 'mouseup') {
              overlayWindow.webContents.send('overlay:event', {
                type: 'mouseup',
                dipX: cursorDip.x,
                dipY: cursorDip.y,
              });
            } else if (ev.type === 'mousedown') {
              overlayWindow.webContents.send('overlay:event', {
                type: 'mousedown',
                dipX: cursorDip.x,
                dipY: cursorDip.y,
              });
            }
          }
        } catch (err) {
          logDebug('Watcher JSON parse error: ' + err.message);
        }
      }
    });

    watcherProcess.stderr.on('data', (d) => {
      logDebug('Watcher stderr: ' + d.toString());
    });

    watcherProcess.on('exit', (code) => {
      logDebug('Watcher exited with code ' + code + '; restarting in 1s...');
      if (!isQuitting) {
        setTimeout(startExplorerWatcher, 1000);
      }
    });
  } catch (e) {
    logDebug('Failed to spawn explorer-watcher: ' + e.message);
  }
}

function createMainWindow() {
  logDebug('createMainWindow() called');
  mainWindow = new BrowserWindow({
    title: 'LuckyWheel — Radial File Converter & Pro Studio',
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 680,
    frame: true,
    autoHideMenuBar: true,
    show: true,
    skipTaskbar: false,
    backgroundColor: '#f4f4f4',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.center();

  const devUrl = 'http://localhost:5173';
  const prodIndex = path.join(__dirname, '../dist/index.html');

  if (process.env.VITE_DEV === '1') {
    mainWindow.loadURL(devUrl).catch(() => {
      if (fs.existsSync(prodIndex)) mainWindow.loadFile(prodIndex);
    });
  } else if (fs.existsSync(prodIndex)) {
    mainWindow.loadFile(prodIndex);
  } else {
    mainWindow.loadURL(devUrl);
  }

  mainWindow.webContents.on('did-finish-load', () => {
    logDebug('did-finish-load fired! Bringing window to front.');
    bringWindowToFront(mainWindow);
  });

  // Keep running in the background when user closes the main window!
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

app.whenReady().then(() => {
  logDebug('app.whenReady() resolved');
  startLocalShareServer();
  createSystemTray();
  createOverlayWindow();
  createMainWindow();
  startExplorerWatcher();

  // Register Global Hotkey: Alt+Space to summon LuckyWheel Overlay right at the cursor!
  try {
    globalShortcut.register('Alt+Space', async () => {
      const selectedFiles = await getWindowsExplorerSelectedFiles();
      const cursor = screen.getCursorScreenPoint();
      showOverlayAtDipPoint(cursor.x, cursor.y, 'conversions', selectedFiles, false);
    });
  } catch (e) {
    console.warn('Global shortcut registration warning:', e.message);
  }
});

app.on('will-quit', () => {
  isQuitting = true;
  stopOverlayCursorPolling();
  globalShortcut.unregisterAll();
  if (watcherProcess) {
    try {
      watcherProcess.kill();
    } catch {}
  }
});

app.on('window-all-closed', () => {
  // Keep background daemon alive on Windows
});

// Window Controls
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow?.hide());
ipcMain.on('window:hideToTray', () => mainWindow?.hide());
ipcMain.on('overlay:hide', () => {
  hideOverlayWindow();
});

ipcMain.handle('window:toggleOverlay', async (_e, enable) => {
  if (!mainWindow) return false;
  mainWindow.setAlwaysOnTop(!!enable, 'screen-saver');
  return !!enable;
});

ipcMain.handle('dialog:pickFiles', async (_e, options = {}) => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: options.directory ? ['openDirectory'] : ['openFile', 'multiSelections'],
    title: options.title || 'Select Files for LuckyWheel Radial Wheel',
  });
  return res.canceled ? [] : res.filePaths;
});

ipcMain.handle('files:process', async (_e, payload) => {
  try {
    logDebug(`files:process start: action=${payload?.actionId}, mode=${payload?.mode}, filesCount=${payload?.files?.length}`);
    const res = await processFiles(payload, (progress, statusText) => {
      mainWindow?.webContents.send('files:progress', { progress, statusText });
      overlayWindow?.webContents.send('files:progress', { progress, statusText });
    });
    logDebug(`files:process success: ${res?.message}`);
    return res;
  } catch (err) {
    logDebug('files:process ERROR: ' + (err && err.stack ? err.stack : err));
    return {
      success: false,
      outputs: [],
      message: err.message || 'Processing failed',
    };
  }
});

ipcMain.handle('shell:reveal', async (_e, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

ipcMain.handle('shell:terminal', async (_e, filePath) => {
  if (!filePath) return false;
  const dir =
    fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()
      ? filePath
      : path.dirname(filePath);
  if (process.platform === 'win32') {
    exec(`start cmd.exe /K "cd /d "${dir}""`);
  } else if (process.platform === 'darwin') {
    exec(`open -a Terminal "${dir.replace(/"/g, '\\"')}"`);
  } else {
    shell.openPath(dir);
  }
  return true;
});

ipcMain.handle('clipboard:write', async (_e, text) => {
  clipboard.writeText(String(text || ''));
  return true;
});

ipcMain.handle('clipboard:read', async () => {
  const text = clipboard.readText() || '';
  const img = clipboard.readImage();
  const hasImage = !img.isEmpty();
  return {
    text,
    hasImage,
    imageDataUrl: hasImage ? img.toDataURL() : null,
  };
});

ipcMain.handle('share:wifiQr', async (_e, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const token = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  sharedFilesMap.set(token, filePath);
  const ip = getLocalLanIp();
  const url = `http://${ip}:${shareServerPort || 8080}/${token}`;
  return await generateWifiQrForFile(filePath, url);
});

ipcMain.handle('system:status', async () => {
  const ff = await checkFfmpeg();
  return {
    platform: process.platform,
    arch: process.arch,
    ffmpeg: ff.available,
    ffmpegVersion: ff.version,
    lanIp: getLocalLanIp(),
  };
});

ipcMain.handle('explorer:selection', async () => {
  return await getWindowsExplorerSelectedFiles();
});
