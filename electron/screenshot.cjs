const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { app, clipboard, nativeImage } = require('electron');

/**
 * Locate screencap.exe binary across bundled resources and local paths
 */
function getScreenCapBinary() {
  const candidates = [
    process.resourcesPath ? path.join(process.resourcesPath, 'bin', 'screencap.exe') : null,
    path.join(__dirname, 'bin', 'screencap.exe').replace('app.asar', 'app.asar.unpacked'),
    path.join(__dirname, 'bin', 'screencap.exe'),
    path.join(__dirname, '..', 'electron', 'bin', 'screencap.exe'),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }

  // Self-healing: On-the-fly native C# compile with built-in Windows csc.exe
  const localTarget = path.join(__dirname, 'bin', 'screencap.exe');
  const src = path.join(__dirname, 'bin', 'ScreenCap.cs');
  const csc = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
  if (fs.existsSync(src) && fs.existsSync(csc)) {
    try {
      const { execFileSync } = require('child_process');
      const binDir = path.dirname(localTarget);
      if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
      execFileSync(csc, ['/nologo', '/optimize+', '/target:winexe', `/out:${localTarget}`, src], { windowsHide: true });
      if (fs.existsSync(localTarget)) return localTarget;
    } catch {}
  }

  return null;
}

/**
 * Capture screen, active window, or custom region
 * @param {'screen' | 'window' | 'region'} mode
 * @param {{ x?: number, y?: number, width?: number, height?: number }} [region]
 */
function captureScreen(mode = 'screen', region = null) {
  return new Promise((resolve, reject) => {
    const bin = getScreenCapBinary();
    if (!bin) {
      return reject(new Error('Screen capture binary (screencap.exe) not found'));
    }

    const tempDir = app?.getPath?.('temp') || os.tmpdir();
    const outPath = path.join(tempDir, `LuckyWheel_cap_${Date.now()}.png`);

    const args = [mode, outPath];
    if (mode === 'region' && region) {
      args.push(
        String(Math.round(region.x || 0)),
        String(Math.round(region.y || 0)),
        String(Math.round(region.width || 100)),
        String(Math.round(region.height || 100))
      );
    }

    const child = spawn(bin, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(outPath)) {
        try {
          const stat = fs.statSync(outPath);
          if (stat.size > 0) {
            const img = nativeImage.createFromPath(outPath);
            const sz = img.getSize();
            // Create a small preview dataUrl for instant UI rendering
            const previewDataUrl = img.resize({ width: 320 }).toDataURL();
            return resolve({
              success: true,
              filePath: outPath,
              width: sz.width,
              height: sz.height,
              previewDataUrl,
            });
          }
        } catch (e) {
          return reject(e);
        }
      }
      reject(new Error(`Screenshot capture failed (exit code ${code}): ${stderr || stdout}`));
    });

    child.on('error', reject);
  });
}

/**
 * Save captured image to one or multiple destination folders with selected format
 * @param {{
 *   sourcePath: string,
 *   format: 'png' | 'jpg' | 'webp' | 'pdf' | 'clipboard',
 *   destinations: string[],
 *   customName?: string
 * }} options
 */
async function saveScreenshot({ sourcePath, format = 'png', destinations = [], customName = '' }) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error('Screenshot source file does not exist');
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const baseName = customName.trim() || `Screenshot_${stamp}`;
  const savedPaths = [];

  // 1. Copy to Clipboard
  if (format === 'clipboard') {
    const img = nativeImage.createFromPath(sourcePath);
    clipboard.writeImage(img);
    return {
      success: true,
      copiedToClipboard: true,
      message: 'Screenshot copied to clipboard!',
    };
  }

  // Ensure sharp or native fallback
  let sharp = null;
  try {
    sharp = require('sharp');
  } catch {}

  const ext = format === 'pdf' ? 'pdf' : format === 'jpg' ? 'jpg' : format === 'webp' ? 'webp' : 'png';

  // Read image buffer
  const imgBuffer = fs.readFileSync(sourcePath);

  for (const destDir of destinations) {
    if (!destDir) continue;
    try {
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const targetPath = path.join(destDir, `${baseName}.${ext}`);

      if (format === 'png') {
        fs.writeFileSync(targetPath, imgBuffer);
      } else if (format === 'jpg') {
        if (sharp) {
          await sharp(imgBuffer).jpeg({ quality: 92 }).toFile(targetPath);
        } else {
          fs.writeFileSync(targetPath, imgBuffer);
        }
      } else if (format === 'webp') {
        if (sharp) {
          await sharp(imgBuffer).webp({ quality: 90 }).toFile(targetPath);
        } else {
          fs.writeFileSync(targetPath, imgBuffer);
        }
      } else if (format === 'pdf') {
        // Embed screenshot in a 300 DPI PDF document using pdf-lib
        try {
          const { PDFDocument } = require('pdf-lib');
          const pdfDoc = await PDFDocument.create();
          const embeddedImage = await pdfDoc.embedPng(imgBuffer);
          const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
          page.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width: embeddedImage.width,
            height: embeddedImage.height,
          });
          const pdfBytes = await pdfDoc.save();
          fs.writeFileSync(targetPath, Buffer.from(pdfBytes));
        } catch (pdfErr) {
          console.warn('PDF export fallback:', pdfErr.message);
          fs.writeFileSync(targetPath, imgBuffer);
        }
      }

      savedPaths.push(targetPath);
    } catch (err) {
      console.warn(`Failed to save to ${destDir}:`, err.message);
    }
  }

  // Also copy to clipboard for convenience
  try {
    const img = nativeImage.createFromPath(sourcePath);
    clipboard.writeImage(img);
  } catch {}

  return {
    success: savedPaths.length > 0,
    savedPaths,
    count: savedPaths.length,
    message:
      savedPaths.length > 1
        ? `Saved screenshot to ${savedPaths.length} folders & clipboard!`
        : savedPaths.length === 1
        ? `Saved screenshot to ${path.basename(path.dirname(savedPaths[0]))} & clipboard!`
        : 'Screenshot saved to clipboard',
  };
}

/**
 * Get standard system directories for multi-destination saving
 */
function getSystemDirectories() {
  const home = os.homedir();
  const pictures = app?.getPath?.('pictures') || path.join(home, 'Pictures');
  const screenshotsDir = path.join(pictures, 'Screenshots');
  return {
    desktop: app?.getPath?.('desktop') || path.join(home, 'Desktop'),
    downloads: app?.getPath?.('downloads') || path.join(home, 'Downloads'),
    pictures: fs.existsSync(screenshotsDir) ? screenshotsDir : pictures,
    documents: app?.getPath?.('documents') || path.join(home, 'Documents'),
  };
}

function cropImage(sourcePath, { x, y, width, height }) {
  const tempDir = app?.getPath?.('temp') || os.tmpdir();
  const outPath = path.join(tempDir, `LuckyWheel_crop_${Date.now()}.png`);
  const img = nativeImage.createFromPath(sourcePath);
  const cropped = img.crop({
    x: Math.max(0, Math.round(x)),
    y: Math.max(0, Math.round(y)),
    width: Math.max(10, Math.round(width)),
    height: Math.max(10, Math.round(height)),
  });
  fs.writeFileSync(outPath, cropped.toPNG());
  const sz = cropped.getSize();
  return {
    success: true,
    filePath: outPath,
    width: sz.width,
    height: sz.height,
    previewDataUrl: cropped.resize({ width: 360 }).toDataURL(),
  };
}

module.exports = {
  captureScreen,
  cropImage,
  saveScreenshot,
  getSystemDirectories,
};
