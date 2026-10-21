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
const { detectUrl, downloadWithYtDlp, downloadDirectFile } = require('./downloader.cjs');
const { captureScreen, cropImage, stitchFrames, saveScreenshot, getSystemDirectories } = require('./screenshot.cjs');

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

let snipWindow = null;

async function showSnipStudioWindow() {
  if (snipWindow && !snipWindow.isDestroyed()) {
    snipWindow.show();
    snipWindow.focus();
    return;
  }

  // Freeze current desktop before opening snip studio
  let bgFilePath = '';
  try {
    const snap = await captureScreen('screen');
    if (snap && snap.success && snap.filePath) {
      bgFilePath = snap.filePath;
    }
  } catch (e) {
    logDebug('Error capturing screen for snip bg: ' + (e?.message || e));
  }

  const primaryDisp = screen.getPrimaryDisplay();
  const bounds = primaryDisp.bounds;

  snipWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  const resolvedDir = lastActiveExplorerDir || app.getPath('desktop');
  const prodIndex = path.join(__dirname, '../dist/index.html');
  const queryStr = `snip=1&dir=${encodeURIComponent(resolvedDir)}&bg=${encodeURIComponent(bgFilePath)}`;

  if (fs.existsSync(prodIndex)) {
    snipWindow.loadFile(prodIndex, { query: { snip: '1', dir: resolvedDir, bg: bgFilePath } });
  } else {
    snipWindow.loadURL(`http://localhost:5173/?${queryStr}`);
  }

  snipWindow.on('closed', () => {
    snipWindow = null;
  });
}

let watcherProcess = null;
let lastActiveExplorerDir = '';
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
      Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class FgWinCheck {
        [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder lpClassName, int nMaxCount);
      }
"@;
      $fg = [FgWinCheck]::GetForegroundWindow();
      $sb = New-Object System.Text.StringBuilder 128;
      [void][FgWinCheck]::GetClassName($fg, $sb, 128);
      $cls = $sb.ToString();
      $shell = New-Object -ComObject Shell.Application;
      $paths = @();

      if ($cls -eq "Progman" -or $cls -eq "WorkerW") {
        try {
          $h = 0;
          $d = $shell.Windows().FindWindowSW(0, 0, 8, [ref]$h, 1);
          if ($null -ne $d) {
            foreach ($item in $d.Document.SelectedItems()) {
              if ($item.Path) { $paths += [string]$item.Path }
            }
          }
        } catch {}
      } elseif ($cls -eq "CabinetWClass" -or $cls -eq "ExploreWClass") {
        $fgHwnd = $fg.ToInt64();
        foreach ($win in $shell.Windows()) {
          try {
            if ([int64]$win.HWND -eq $fgHwnd) {
              $sel = $win.Document.SelectedItems();
              foreach ($item in $sel) {
                if ($item.Path) { $paths += [string]$item.Path }
              }
              if ($paths.Count -gt 0) { break }
            }
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

function showOverlayAtDipPoint(dipX, dipY, mode, files, dragging = false, currentDir = '') {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const bounds = {
    x: Math.round(dipX - OVERLAY_W / 2),
    y: Math.round(dipY - OVERLAY_H / 2),
    width: OVERLAY_W,
    height: OVERLAY_H,
  };
  overlayWindow.setBounds(bounds, false);
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.showInactive();

  const resolvedDir = currentDir || lastActiveExplorerDir || app.getPath('desktop');

  lastCursorDip = { x: dipX, y: dipY };
  overlayWindow.webContents.send('overlay:event', {
    type: 'show',
    mode: mode || 'conversions',
    centerDipX: dipX,
    centerDipY: dipY,
    files: files && files.length ? files : [],
    currentDir: resolvedDir,
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

          if (ev.currentDir && fs.existsSync(ev.currentDir)) {
            lastActiveExplorerDir = ev.currentDir;
          } else if (ev.files && ev.files.length > 0 && fs.existsSync(ev.files[0])) {
            try {
              lastActiveExplorerDir = fs.statSync(ev.files[0]).isDirectory()
                ? ev.files[0]
                : path.dirname(ev.files[0]);
            } catch {}
          }

          if (ev.type === 'keydown') {
            if (!isVisible) {
              if (ev.key === 'Shift' || ev.key === 'Alt' || ev.key === 'Ctrl') {
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
                    !!ev.isDragging,
                    lastActiveExplorerDir
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

  // Settings persistence for Custom Screenshot Shortcuts & Preferences
  const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
  let userSettings = { screenshotShortcut: 'Alt+S' };
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      userSettings = { ...userSettings, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) };
    }
  } catch {}

  const saveSettings = () => {
    try {
      fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(userSettings, null, 2), 'utf8');
    } catch {}
  };

  const activeScreenshotShortcuts = new Set();

  const triggerScreenCaptureStudio = () => {
    logDebug('Global shortcut triggered Screen Capture Studio!');
    showSnipStudioWindow();
  };

  const registerScreenshotHotkeys = (preferredShortcut) => {
    for (const sc of activeScreenshotShortcuts) {
      try { globalShortcut.unregister(sc); } catch {}
    }
    activeScreenshotShortcuts.clear();

    const candidates = [
      preferredShortcut || userSettings.screenshotShortcut || 'Alt+S',
      'Alt+S',
      'CommandOrControl+Alt+S',
      'Alt+Shift+S',
    ];

    for (const sc of candidates) {
      if (!sc) continue;
      try {
        if (!globalShortcut.isRegistered(sc)) {
          const ok = globalShortcut.register(sc, triggerScreenCaptureStudio);
          if (ok) activeScreenshotShortcuts.add(sc);
        } else {
          activeScreenshotShortcuts.add(sc);
        }
      } catch (e) {
        logDebug(`Could not register ${sc}: ${e.message}`);
      }
    }
  };

  registerScreenshotHotkeys(userSettings.screenshotShortcut);

  ipcMain.handle('settings:getShortcut', async () => {
    return { screenshotShortcut: userSettings.screenshotShortcut || 'Alt+S' };
  });

  ipcMain.handle('settings:setShortcut', async (_e, newShortcut) => {
    if (!newShortcut || typeof newShortcut !== 'string') {
      return { success: false, message: 'Invalid shortcut string' };
    }
    try {
      userSettings.screenshotShortcut = newShortcut.trim();
      saveSettings();
      registerScreenshotHotkeys(userSettings.screenshotShortcut);
      return { success: true, shortcut: userSettings.screenshotShortcut };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
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


async function captureWebpageDirect({ url, format, outputDir, title }) {
  if (!outputDir || !fs.existsSync(outputDir)) {
    outputDir = app.getPath('downloads');
  }
  const cleanTitle = (title || 'webpage')
    .replace(/[\\/:*?"<>|]/g, '_')
    .slice(0, 80);

  const captureWin = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    webPreferences: {
      offscreen: true,
      images: true,
    },
  });

  try {
    await captureWin.loadURL(url, { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1200));

    if (format === 'pdf') {
      const pdfData = await captureWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
      });
      const dest = path.join(outputDir, `${cleanTitle}.pdf`);
      fs.writeFileSync(dest, pdfData);
      return { success: true, filePath: dest, message: `Saved PDF: ${path.basename(dest)}` };
    }

    if (format === 'png') {
      const image = await captureWin.webContents.capturePage();
      const dest = path.join(outputDir, `${cleanTitle}.png`);
      fs.writeFileSync(dest, image.toPNG());
      return { success: true, filePath: dest, message: `Saved Screenshot: ${path.basename(dest)}` };
    }

    if (format === 'txt') {
      const text = await captureWin.webContents.executeJavaScript('document.body.innerText');
      const dest = path.join(outputDir, `${cleanTitle}.txt`);
      fs.writeFileSync(dest, text, 'utf8');
      return { success: true, filePath: dest, message: `Saved Text: ${path.basename(dest)}` };
    }

    throw new Error('Unsupported webpage format');
  } finally {
    captureWin.destroy();
  }
}

ipcMain.handle('link:detect', async (_e, url) => {
  try {
    const res = await detectUrl(url);
    return {
      ...res,
      meta: res,
    };
  } catch (err) {
    return { success: false, message: err.message || 'Detection failed' };
  }
});

ipcMain.handle('link:download', async (_e, payload) => {
  const { url, type, outputDir, title, author } = payload || {};
  const format = payload?.format || payload?.formatId || payload?.ext || 'mp4-best';
  let resolvedDir = '';
  if (outputDir && fs.existsSync(outputDir)) {
    try {
      resolvedDir = fs.statSync(outputDir).isDirectory() ? outputDir : path.dirname(outputDir);
    } catch {}
  }
  if (!resolvedDir && lastActiveExplorerDir && fs.existsSync(lastActiveExplorerDir)) {
    resolvedDir = lastActiveExplorerDir;
  }
  if (!resolvedDir) {
    resolvedDir = app.getPath('downloads');
  }

  const onProgress = (percent, statusText) => {
    overlayWindow?.webContents.send('link:progress', { percent, statusText });
    mainWindow?.webContents.send('link:progress', { percent, statusText });
  };

  try {
    logDebug(`link:download start: url=${url}, type=${type}, format=${format}, dir=${resolvedDir}`);
    if (type === 'webpage') {
      onProgress(30, 'Rendering webpage in background...');
      const res = await captureWebpageDirect({ url, format, outputDir: resolvedDir, title });
      onProgress(100, 'Webpage saved!');
      logDebug(`link:download webpage success: ${res?.filePath}`);
      return res;
    }

    if (type === 'spotify') {
      const query = `ytsearch1:"${title} ${author || ''}"`;
      const res = await downloadWithYtDlp({ query, format, outputDir: resolvedDir }, onProgress);
      logDebug(`link:download spotify success: ${res?.filePath}`);
      return res;
    }

    if (type === 'direct_media') {
      const res = await downloadDirectFile({ url, outputDir: resolvedDir, filename: title }, onProgress);
      logDebug(`link:download direct success: ${res?.filePath}`);
      return res;
    }

    // Default: youtube / social
    const res = await downloadWithYtDlp({ query: url, format, outputDir: resolvedDir }, onProgress);
    logDebug(`link:download youtube/social success: ${res?.filePath}`);
    return res;
  } catch (err) {
    logDebug(`link:download error: ${err.message}`);
    return { success: false, message: err.message || 'Download failed' };
  }
});

// ==========================================

async function captureScrollableWebpage({ url, outputDir = null, title = '' }) {
  const resolvedDir = outputDir && fs.existsSync(outputDir)
    ? (fs.statSync(outputDir).isDirectory() ? outputDir : path.dirname(outputDir))
    : (lastActiveExplorerDir || app.getPath('desktop'));

  const cleanTitle = (title || 'webpage_' + Date.now()).replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);

  const captureWin = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    webPreferences: {
      offscreen: true,
      images: true,
    },
  });

  try {
    await captureWin.loadURL(url, { timeout: 25000 });
    await new Promise((r) => setTimeout(r, 1600));

    const fullHeight = await captureWin.webContents.executeJavaScript(`
      Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight,
        900
      )
    `);

    const targetHeight = Math.min(Math.max(fullHeight, 900), 20000);
    captureWin.setSize(1440, targetHeight);
    await new Promise((r) => setTimeout(r, 800));

    const tempDir = app.getPath('temp');
    const outPngPath = path.join(tempDir, `LuckyWheel_scroll_${Date.now()}.png`);

    const image = await captureWin.webContents.capturePage({
      x: 0,
      y: 0,
      width: 1440,
      height: targetHeight,
    });

    fs.writeFileSync(outPngPath, image.toPNG());

    return {
      success: true,
      filePath: outPngPath,
      width: 1440,
      height: targetHeight,
      previewDataUrl: image.resize({ width: 320 }).toDataURL(),
      message: `Full page captured (${1440}×${targetHeight}px)`,
    };
  } catch (err) {
    logDebug('captureScrollableWebpage error: ' + err.message);
    return { success: false, message: err.message || 'Webpage scroll capture failed' };
  } finally {
    captureWin.destroy();
  }
}

// Native Screen Capture & Snip Studio IPC
// ==========================================
ipcMain.handle('screenshot:capture', async (_e, payload) => {
  const { mode = 'screen', region = null, delayMs = 0, maxScrolls = 25 } = payload || {};
  try {
    const isSnipVisible = snipWindow && !snipWindow.isDestroyed() && snipWindow.isVisible();
    const isOverlayVisible = overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible();

    if (isSnipVisible) snipWindow.hide();
    if (isOverlayVisible) overlayWindow.hide();

    await new Promise((r) => setTimeout(r, Math.max(90, delayMs)));

    const res = await captureScreen(mode, region, { maxScrolls });

    if (isSnipVisible && snipWindow && !snipWindow.isDestroyed()) {
      snipWindow.show();
      snipWindow.focus();
    }

    return res;
  } catch (err) {
    logDebug('screenshot:capture error: ' + err.message);
    if (snipWindow && !snipWindow.isDestroyed()) snipWindow.show();
    return { success: false, message: err.message || 'Capture failed' };
  }
});

ipcMain.handle('screenshot:stitch', async (_e, payload) => {
  const { framePaths = [] } = payload || {};
  try {
    return await stitchFrames(framePaths);
  } catch (err) {
    logDebug('screenshot:stitch error: ' + err.message);
    return { success: false, message: err.message || 'Stitching failed' };
  }
});

ipcMain.handle('screenshot:captureWebpage', async (_e, payload) => {
  const { url, outputDir } = payload || {};
  return await captureScrollableWebpage({ url, outputDir });
});

ipcMain.on('snip:open', () => {
  showSnipStudioWindow();
});

ipcMain.on('snip:close', () => {
  if (snipWindow && !snipWindow.isDestroyed()) {
    snipWindow.close();
    snipWindow = null;
  }
});

ipcMain.handle('screenshot:crop', async (_e, payload) => {
  const { sourcePath, rect } = payload || {};
  return cropImage(sourcePath, rect);
});

ipcMain.handle('screenshot:save', async (_e, payload) => {
  try {
    const res = await saveScreenshot(payload);
    return res;
  } catch (err) {
    logDebug('screenshot:save error: ' + err.message);
    return { success: false, message: err.message || 'Save failed' };
  }
});

ipcMain.handle('system:directories', async () => {
  try {
    return getSystemDirectories();
  } catch (err) {
    return {
      desktop: app.getPath('desktop'),
      downloads: app.getPath('downloads'),
      pictures: app.getPath('pictures'),
      documents: app.getPath('documents'),
    };
  }
});

ipcMain.handle('dialog:pickDirectory', async () => {
  const win = mainWindow && mainWindow.isVisible() ? mainWindow : overlayWindow;
  const res = await dialog.showOpenDialog(win, {
    title: 'Select Destination Folder for Screenshots',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res && !res.canceled && res.filePaths && res.filePaths.length > 0) {
    return res.filePaths[0];
  }
  return null;
});
