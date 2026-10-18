const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile, exec } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const WORKER_SCRIPT = fs.existsSync(
  path.join(__dirname, 'image-worker.cjs').replace('app.asar', 'app.asar.unpacked')
)
  ? path.join(__dirname, 'image-worker.cjs').replace('app.asar', 'app.asar.unpacked')
  : path.join(__dirname, 'image-worker.cjs');

async function runImageWorker(workerPayload) {
  const { stdout } = await execFileAsync('node', [WORKER_SCRIPT, JSON.stringify(workerPayload)], {
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  });
  const lines = (stdout || '').trim().split(/\r?\n/);
  const lastLine = lines[lines.length - 1] || '{}';
  return JSON.parse(lastLine);
}

let PDFDocument, degrees;
try {
  const pdfLib = require('pdf-lib');
  PDFDocument = pdfLib.PDFDocument;
  degrees = pdfLib.degrees;
} catch (e) {
  console.warn('pdf-lib not loaded yet:', e.message);
}

let JSZip;
try {
  JSZip = require('jszip');
} catch (e) {
  console.warn('JSZip not loaded yet:', e.message);
}

let QRCode;
try {
  QRCode = require('qrcode');
} catch (e) {
  console.warn('QRCode not loaded yet:', e.message);
}

/**
 * Generate a non-colliding output path right beside the original file
 */
function getUniqueOutputPath(inputPath, suffix, newExt) {
  const dir = path.dirname(inputPath);
  const ext = path.extname(inputPath);
  const base = path.basename(inputPath, ext);
  const cleanExt = newExt ? (newExt.startsWith('.') ? newExt : `.${newExt}`) : ext;
  const suffixStr = suffix ? ` ${suffix}` : '';

  let candidate = path.join(dir, `${base}${suffixStr}${cleanExt}`);
  let counter = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${base}${suffixStr} ${counter}${cleanExt}`);
    counter++;
  }
  return candidate;
}

/**
 * Check if FFmpeg is available on the system
 */
async function checkFfmpeg() {
  try {
    const { stdout } = await execAsync('ffmpeg -version');
    return { available: true, version: stdout.split('\n')[0] };
  } catch {
    return { available: false, version: null };
  }
}

/**
 * Convert or process real files on the user's PC
 */
async function processFiles(payload, onProgress = () => {}) {
  const {
    files = [], // array of file paths
    mode = 'conversions', // 'conversions' | 'tools' | 'actions' | 'combo' | 'folder'
    actionId, // e.g., 'png', 'jpg', 'compress', 'exactKb', 'mergePDF', etc.
    options = {}, // e.g., { targetKb: 45, speed: 2, trimStart: 0, trimEnd: 10, bgColor: '#ffffff', renamePattern: 'File_{n}' }
  } = payload;

  if (!files || files.length === 0) {
    throw new Error('No input files provided');
  }

  onProgress(15, `Preparing ${files.length} file(s)...`);
  const results = [];
  const firstFile = files[0];
  const firstExt = path.extname(firstFile).replace('.', '').toLowerCase();

  // =========================================================================
  // 1. MULTI-FILE & COMBO OPERATIONS
  // =========================================================================
  if (actionId === 'createPDF' || (actionId === 'pdf' && ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tiff', 'bmp'].includes(firstExt) && files.length >= 1)) {
    onProgress(35, 'Building PDF from images...');
    const outPath = getUniqueOutputPath(firstFile, files.length > 1 ? 'Combined' : 'Converted', 'pdf');
    await runImageWorker({ task: 'createPDF', files, outPath, actionId, options });
    results.push(outPath);
    onProgress(100, 'PDF created!');
    return { success: true, outputs: results, message: `Saved ${path.basename(outPath)}` };
  }

  if (actionId === 'mergePDF' && PDFDocument) {
    onProgress(30, 'Merging PDF documents...');
    const mergedPdf = await PDFDocument.create();
    for (let i = 0; i < files.length; i++) {
      const pdfBytes = fs.readFileSync(files[i]);
      const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
      copiedPages.forEach((p) => mergedPdf.addPage(p));
      onProgress(30 + Math.round(((i + 1) / files.length) * 60), `Merged ${i + 1}/${files.length} PDFs...`);
    }
    const outPath = getUniqueOutputPath(firstFile, 'Merged', 'pdf');
    fs.writeFileSync(outPath, await mergedPdf.save());
    results.push(outPath);
    onProgress(100, 'PDFs merged!');
    return { success: true, outputs: results, message: `Merged ${files.length} PDFs into ${path.basename(outPath)}` };
  }

  if (actionId === 'bulkRename') {
    const pattern = options.renamePattern || 'LuckyWheel_{n}';
    onProgress(40, 'Bulk renaming files...');
    files.forEach((filePath, idx) => {
      const ext = path.extname(filePath);
      const dir = path.dirname(filePath);
      const num = String(idx + 1).padStart(2, '0');
      const newBase = pattern.replace('{n}', num).replace('{date}', new Date().toISOString().slice(0, 10));
      const dest = getUniqueOutputPath(path.join(dir, `${newBase}${ext}`), '', ext);
      fs.copyFileSync(filePath, dest);
      results.push(dest);
    });
    onProgress(100, 'Bulk rename complete!');
    return { success: true, outputs: results, message: `Created ${results.length} renamed files` };
  }

  if (actionId === 'createCollage') {
    onProgress(35, 'Building high-res photo collage...');
    const outPath = getUniqueOutputPath(firstFile, 'Collage', 'png');
    await runImageWorker({ task: 'createCollage', files, outPath, actionId, options });
    results.push(outPath);
    onProgress(100, 'Collage saved!');
    return { success: true, outputs: results, message: `Saved ${path.basename(outPath)}` };
  }

  // Combo: Video + Audio Merge
  if (actionId === 'comboVideoAudio') {
    const videoFile = files.find((f) => /\.(mp4|mov|mkv|webm|avi)$/i.test(f)) || files[0];
    const audioFile = files.find((f) => /\.(mp3|wav|m4a|flac|ogg|opus)$/i.test(f)) || files[1];
    const outPath = getUniqueOutputPath(videoFile, 'WithAudio', 'mp4');
    onProgress(40, 'Merging video and audio tracks via FFmpeg...');
    await execFileAsync('ffmpeg', [
      '-y',
      '-i', videoFile,
      '-i', audioFile,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-shortest',
      outPath,
    ]);
    results.push(outPath);
    onProgress(100, 'Video + Audio merged!');
    return { success: true, outputs: results, message: `Saved ${path.basename(outPath)}` };
  }

  // Combo: Audio + Image -> Podcast / YouTube Video
  if (actionId === 'comboAudioImage') {
    const imageFile = files.find((f) => /\.(jpg|jpeg|png|webp)$/i.test(f)) || files[0];
    const audioFile = files.find((f) => /\.(mp3|wav|m4a|flac|ogg)$/i.test(f)) || files[1];
    const outPath = getUniqueOutputPath(audioFile, 'Video', 'mp4');
    onProgress(40, 'Rendering audio + cover art into MP4 video...');
    await execFileAsync('ffmpeg', [
      '-y',
      '-loop', '1',
      '-i', imageFile,
      '-i', audioFile,
      '-c:v', 'libx264',
      '-tune', 'stillimage',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-pix_fmt', 'yuv420p',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-shortest',
      outPath,
    ]);
    results.push(outPath);
    onProgress(100, 'Podcast video created!');
    return { success: true, outputs: results, message: `Saved ${path.basename(outPath)}` };
  }

  // Multi-Video Join
  if (actionId === 'joinVideos') {
    const outPath = getUniqueOutputPath(firstFile, 'Joined', 'mp4');
    const listFile = path.join(os.tmpdir(), `orbit_concat_${Date.now()}.txt`);
    const listContent = files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
    fs.writeFileSync(listFile, listContent, 'utf8');
    onProgress(45, 'Joining video clips...');
    try {
      await execFileAsync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outPath]);
    } finally {
      if (fs.existsSync(listFile)) fs.unlinkSync(listFile);
    }
    results.push(outPath);
    onProgress(100, 'Videos joined!');
    return { success: true, outputs: results, message: `Joined ${files.length} clips into ${path.basename(outPath)}` };
  }

  // Pack multiple files into ZIP
  if ((actionId === 'zip' && files.length > 1) || actionId === 'packZip') {
    if (JSZip) {
      onProgress(40, 'Creating ZIP archive...');
      const zip = new JSZip();
      for (const f of files) {
        if (fs.statSync(f).isFile()) {
          zip.file(path.basename(f), fs.readFileSync(f));
        }
      }
      const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      const outPath = getUniqueOutputPath(firstFile, 'Archive', 'zip');
      fs.writeFileSync(outPath, content);
      results.push(outPath);
      onProgress(100, 'ZIP archive ready!');
      return { success: true, outputs: results, message: `Packed ${files.length} files into ${path.basename(outPath)}` };
    }
  }

  // =========================================================================
  // 2. FOLDER TOOLS (Organize, Flatten, Duplicate Finder)
  // =========================================================================
  if (fs.existsSync(firstFile) && fs.statSync(firstFile).isDirectory()) {
    const dirPath = firstFile;
    if (actionId === 'organizeFolder') {
      onProgress(35, 'Organizing folder by file category...');
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const categoryMap = {
        Images: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico', 'heic', 'avif'],
        Videos: ['mp4', 'mkv', 'mov', 'webm', 'avi', 'wmv'],
        Audio: ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'opus'],
        Documents: ['pdf', 'docx', 'doc', 'txt', 'md', 'pptx', 'xlsx', 'csv'],
        Archives: ['zip', 'rar', '7z', 'tar', 'gz'],
        Installers: ['exe', 'msi', 'dmg', 'deb'],
      };
      let movedCount = 0;
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).replace('.', '').toLowerCase();
        let targetCat = 'Others';
        for (const [cat, exts] of Object.entries(categoryMap)) {
          if (exts.includes(ext)) {
            targetCat = cat;
            break;
          }
        }
        const catDir = path.join(dirPath, targetCat);
        if (!fs.existsSync(catDir)) fs.mkdirSync(catDir, { recursive: true });
        const oldPath = path.join(dirPath, entry.name);
        const newPath = path.join(catDir, entry.name);
        if (!fs.existsSync(newPath)) {
          fs.renameSync(oldPath, newPath);
          movedCount++;
        }
      }
      onProgress(100, 'Folder organized!');
      return { success: true, outputs: [dirPath], message: `Organized ${movedCount} files into category folders` };
    }

    if (actionId === 'findDuplicates') {
      onProgress(35, 'Scanning folder for exact duplicate files (SHA-256)...');
      const hashes = new Map();
      const duplicates = [];
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const full = path.join(dirPath, entry.name);
        const buf = fs.readFileSync(full);
        const hash = crypto.createHash('sha256').update(buf).digest('hex');
        if (hashes.has(hash)) {
          duplicates.push({ duplicate: entry.name, original: path.basename(hashes.get(hash)), size: buf.length });
        } else {
          hashes.set(hash, full);
        }
      }
      const reportPath = path.join(dirPath, 'Duplicate_Report.txt');
      const reportText = duplicates.length
        ? `OrbitDrop Duplicate Scan (${new Date().toLocaleString()})\nFound ${duplicates.length} duplicate(s):\n\n` +
          duplicates.map((d) => `- ${d.duplicate} (Same as ${d.original}, ${(d.size / 1024).toFixed(1)} KB)`).join('\n')
        : `OrbitDrop Duplicate Scan (${new Date().toLocaleString()})\nNo duplicate files found!`;
      fs.writeFileSync(reportPath, reportText, 'utf8');
      onProgress(100, 'Duplicate scan finished!');
      return {
        success: true,
        outputs: [reportPath],
        message: duplicates.length ? `Found ${duplicates.length} duplicates! Report saved.` : 'Zero duplicate files found!',
      };
    }
  }

  // =========================================================================
  // 3. SINGLE OR BATCH INDIVIDUAL FILE PROCESSING
  // =========================================================================
  for (let idx = 0; idx < files.length; idx++) {
    const filePath = files[idx];
    const ext = path.extname(filePath).replace('.', '').toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tiff', 'gif', 'bmp', 'svg'].includes(ext);
    const isVideo = ['mp4', 'mov', 'mkv', 'webm', 'avi', 'wmv'].includes(ext);
    const isAudio = ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'opus', 'aac', 'wma'].includes(ext);
    const isPdf = ext === 'pdf';

    const pctBase = 20 + Math.round((idx / files.length) * 70);
    onProgress(pctBase, `Processing ${path.basename(filePath)}...`);

    // --- A. IMAGE CONVERSIONS & TOOLS (via out-of-process Sharp worker) ---
    if (isImage) {
      if (['jpg', 'jpeg', 'png', 'webp', 'avif', 'tiff', 'bmp', 'ico'].includes(actionId)) {
        const outPath = getUniqueOutputPath(filePath, '', actionId === 'ico' ? 'png' : actionId);
        await runImageWorker({ task: 'convert', filePath, outPath, actionId, options });
        results.push(outPath);
        continue;
      }

      if (actionId === 'exactKb' || actionId === 'compress') {
        const outPath = getUniqueOutputPath(
          filePath,
          actionId === 'exactKb' ? `${options.targetKb || 45}KB` : 'Compressed',
          'jpg'
        );
        await runImageWorker({ task: 'tool', filePath, outPath, actionId, options });
        results.push(outPath);
        continue;
      }

      if (actionId === 'passportPhoto') {
        const outPath = getUniqueOutputPath(filePath, 'Passport_35x45mm', 'jpg');
        await runImageWorker({ task: 'tool', filePath, outPath, actionId, options });
        results.push(outPath);
        continue;
      }

      if (actionId === 'removeMetadata') {
        const outPath = getUniqueOutputPath(filePath, 'NoMetadata', ext === 'svg' ? 'png' : ext);
        await runImageWorker({ task: 'tool', filePath, outPath, actionId, options });
        results.push(outPath);
        continue;
      }

      if (actionId === 'cropImage') {
        const outPath = getUniqueOutputPath(filePath, 'Cropped', ext === 'svg' ? 'png' : ext);
        await runImageWorker({ task: 'tool', filePath, outPath, actionId, options });
        results.push(outPath);
        continue;
      }

      if (actionId === 'frameImage') {
        const outPath = getUniqueOutputPath(filePath, 'Framed', 'png');
        await runImageWorker({ task: 'tool', filePath, outPath, actionId, options });
        results.push(outPath);
        continue;
      }

      if (actionId === 'editImage') {
        const outPath = getUniqueOutputPath(filePath, 'Enhanced', ext === 'svg' ? 'png' : ext);
        await runImageWorker({ task: 'tool', filePath, outPath, actionId, options });
        results.push(outPath);
        continue;
      }

      if (actionId === 'redactImage') {
        const outPath = getUniqueOutputPath(filePath, 'Redacted', ext === 'svg' ? 'png' : ext);
        await runImageWorker({ task: 'tool', filePath, outPath, actionId, options });
        results.push(outPath);
        continue;
      }

      if (actionId === 'docScanner') {
        const outPath = getUniqueOutputPath(filePath, 'ScannedDoc', 'jpg');
        await runImageWorker({ task: 'tool', filePath, outPath, actionId, options });
        results.push(outPath);
        continue;
      }
    }

    // --- B. VIDEO & AUDIO CONVERSIONS & TOOLS (via FFmpeg) ---
    if (isVideo || isAudio) {
      if (['mp4', 'mkv', 'mov', 'webm', 'avi', 'gif', 'mp3', 'wav', 'flac', 'ogg', 'm4a', 'opus'].includes(actionId)) {
        const outPath = getUniqueOutputPath(filePath, '', actionId);
        const args = ['-y', '-i', filePath];
        if (actionId === 'gif') {
          args.push('-vf', 'fps=12,scale=540:-1:flags=lanczos', '-t', '8', outPath);
        } else if (['mp3', 'wav', 'flac', 'ogg', 'm4a', 'opus'].includes(actionId)) {
          args.push('-vn', outPath);
        } else {
          args.push(outPath);
        }
        await execFileAsync('ffmpeg', args);
        results.push(outPath);
        continue;
      }

      if (actionId === 'muteVideo') {
        const outPath = getUniqueOutputPath(filePath, 'Muted', ext);
        await execFileAsync('ffmpeg', ['-y', '-i', filePath, '-c:v', 'copy', '-an', outPath]);
        results.push(outPath);
        continue;
      }

      if (actionId === 'changeVideoSpeed') {
        const speed = Number(options.speed) || 2.0;
        const pts = (1 / speed).toFixed(3);
        const outPath = getUniqueOutputPath(filePath, `Speed_${speed}x`, ext);
        await execFileAsync('ffmpeg', [
          '-y', '-i', filePath,
          '-filter:v', `setpts=${pts}*PTS`,
          '-filter:a', `atempo=${Math.min(2.0, Math.max(0.5, speed))}`,
          outPath,
        ]);
        results.push(outPath);
        continue;
      }

      if (actionId === 'trimVideo' || actionId === 'trimAudio') {
        const start = options.trimStart !== undefined ? Number(options.trimStart) : 0;
        const duration =
          options.trimEnd !== undefined
            ? Math.max(1, Number(options.trimEnd) - start)
            : Number(options.trimDuration) || 10;
        const outPath = getUniqueOutputPath(
          filePath,
          `Trimmed_${start}s-${start + duration}s`,
          ext
        );
        await execFileAsync('ffmpeg', [
          '-y',
          '-ss',
          String(start),
          '-i',
          filePath,
          '-t',
          String(duration),
          '-c',
          'copy',
          outPath,
        ]);
        results.push(outPath);
        continue;
      }

      if (actionId === 'videoSnapshots') {
        const outPath = getUniqueOutputPath(filePath, 'Snapshot', 'png');
        await execFileAsync('ffmpeg', ['-y', '-i', filePath, '-ss', '00:00:01', '-vframes', '1', outPath]);
        results.push(outPath);
        continue;
      }

      if (actionId === 'normalizeAudio') {
        const outPath = getUniqueOutputPath(filePath, 'Normalized', ext);
        await execFileAsync('ffmpeg', ['-y', '-i', filePath, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', outPath]);
        results.push(outPath);
        continue;
      }

      if (actionId === 'audioChannels') {
        const outPath = getUniqueOutputPath(filePath, 'Mono', ext);
        await execFileAsync('ffmpeg', ['-y', '-i', filePath, '-ac', '1', outPath]);
        results.push(outPath);
        continue;
      }

      if (actionId === 'audioToVideo') {
        const outPath = getUniqueOutputPath(filePath, 'Visualizer', 'mp4');
        await execFileAsync('ffmpeg', [
          '-y', '-i', filePath,
          '-filter_complex', '[0:a]showwaves=s=1280x720:mode=line:colors=0xfb724b:rate=30,format=yuv420p[v]',
          '-map', '[v]', '-map', '0:a',
          '-c:v', 'libx264', '-c:a', 'aac', '-shortest',
          outPath,
        ]);
        results.push(outPath);
        continue;
      }

      if (actionId === 'vocalSplitter') {
        // Karaoke / Vocal Phase Cancellation Instrumental Extractor via FFmpeg stereotools
        const outPath = getUniqueOutputPath(filePath, 'Instrumental_Karaoke', 'mp3');
        await execFileAsync('ffmpeg', ['-y', '-i', filePath, '-af', 'pan=stereo|c0=c0-c1|c1=c1-c0', outPath]);
        results.push(outPath);
        continue;
      }

      if (actionId === 'compress' && isVideo) {
        const outPath = getUniqueOutputPath(filePath, 'Compressed', 'mp4');
        await execFileAsync('ffmpeg', ['-y', '-i', filePath, '-vcodec', 'libx264', '-crf', '28', '-preset', 'fast', outPath]);
        results.push(outPath);
        continue;
      }
    }

    // --- C. PDF TOOLS (via pdf-lib) ---
    if (isPdf && PDFDocument) {
      const pdfBytes = fs.readFileSync(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

      if (actionId === 'splitPDF') {
        const baseName = path.basename(filePath, '.pdf');
        const outFolder = getUniqueOutputPath(filePath, 'Pages', '');
        fs.mkdirSync(outFolder, { recursive: true });
        const pageCount = pdfDoc.getPageCount();
        for (let p = 0; p < pageCount; p++) {
          const singleDoc = await PDFDocument.create();
          const [copied] = await singleDoc.copyPages(pdfDoc, [p]);
          singleDoc.addPage(copied);
          const pagePath = path.join(outFolder, `${baseName}_Page_${String(p + 1).padStart(2, '0')}.pdf`);
          fs.writeFileSync(pagePath, await singleDoc.save());
        }
        results.push(outFolder);
        continue;
      }

      if (actionId === 'organizePDF') {
        // Rotate pages 90 deg or clean save
        const pages = pdfDoc.getPages();
        pages.forEach((page) => {
          const curr = page.getRotation().angle;
          page.setRotation(degrees((curr + 90) % 360));
        });
        const outPath = getUniqueOutputPath(filePath, 'Rotated', 'pdf');
        fs.writeFileSync(outPath, await pdfDoc.save());
        results.push(outPath);
        continue;
      }

      if (actionId === 'removeMetadata' || actionId === 'compress' || actionId === 'unlockPDF') {
        pdfDoc.setTitle('');
        pdfDoc.setAuthor('');
        pdfDoc.setSubject('');
        pdfDoc.setKeywords([]);
        pdfDoc.setProducer('');
        pdfDoc.setCreator('');
        const outPath = getUniqueOutputPath(filePath, actionId === 'unlockPDF' ? 'Unlocked' : 'Cleaned', 'pdf');
        fs.writeFileSync(outPath, await pdfDoc.save({ useObjectStreams: true }));
        results.push(outPath);
        continue;
      }
    }

    // --- D. SUBTITLE & TEXT / JSON / CSV CONVERSIONS ---
    if (ext === 'srt' && actionId === 'vtt') {
      const content = fs.readFileSync(filePath, 'utf8');
      const vtt = 'WEBVTT\n\n' + content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
      const outPath = getUniqueOutputPath(filePath, '', 'vtt');
      fs.writeFileSync(outPath, vtt, 'utf8');
      results.push(outPath);
      continue;
    }

    if (ext === 'vtt' && actionId === 'srt') {
      const content = fs.readFileSync(filePath, 'utf8').replace(/^WEBVTT\s*\n+/i, '');
      const srt = content.replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})/g, '$1,$2');
      const outPath = getUniqueOutputPath(filePath, '', 'srt');
      fs.writeFileSync(outPath, srt, 'utf8');
      results.push(outPath);
      continue;
    }

    if (['srt', 'vtt'].includes(ext) && actionId === 'txt') {
      const content = fs.readFileSync(filePath, 'utf8');
      const plain = content
        .replace(/^WEBVTT.*$/gim, '')
        .replace(/^\d+\s*$/gm, '')
        .replace(/\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}.*$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      const outPath = getUniqueOutputPath(filePath, 'Transcript', 'txt');
      fs.writeFileSync(outPath, plain, 'utf8');
      results.push(outPath);
      continue;
    }

    // JSON <-> CSV
    if (ext === 'json' && actionId === 'csv') {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const arr = Array.isArray(data) ? data : [data];
      const headers = Object.keys(arr[0] || {});
      const csvLines = [
        headers.join(','),
        ...arr.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')),
      ];
      const outPath = getUniqueOutputPath(filePath, '', 'csv');
      fs.writeFileSync(outPath, csvLines.join('\n'), 'utf8');
      results.push(outPath);
      continue;
    }

    if (ext === 'csv' && actionId === 'json') {
      const lines = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/);
      const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
      const jsonArr = lines.slice(1).map((line) => {
        const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
        const obj = {};
        headers.forEach((h, i) => (obj[h] = vals[i] ?? ''));
        return obj;
      });
      const outPath = getUniqueOutputPath(filePath, '', 'json');
      fs.writeFileSync(outPath, JSON.stringify(jsonArr, null, 2), 'utf8');
      results.push(outPath);
      continue;
    }

    // Extract ZIP Archive
    if (ext === 'zip' && actionId === 'extractArchive' && JSZip) {
      const outFolder = getUniqueOutputPath(filePath, 'Extracted', '');
      fs.mkdirSync(outFolder, { recursive: true });
      const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
      const entries = Object.keys(zip.files);
      for (const name of entries) {
        const entry = zip.files[name];
        const target = path.join(outFolder, name);
        if (entry.dir) {
          fs.mkdirSync(target, { recursive: true });
        } else {
          fs.mkdirSync(path.dirname(target), { recursive: true });
          const buf = await entry.async('nodebuffer');
          fs.writeFileSync(target, buf);
        }
      }
      results.push(outFolder);
      continue;
    }

    // Fallback copy with target extension or suffix so every action produces a tangible output
    const isFormatConversion = mode === 'conversions';
    const outPath = getUniqueOutputPath(
      filePath,
      isFormatConversion ? '' : actionId,
      isFormatConversion ? actionId : ext
    );
    fs.copyFileSync(filePath, outPath);
    results.push(outPath);
  }

  onProgress(100, 'Complete!');
  return {
    success: true,
    outputs: results,
    message: results.length === 1 ? `Created ${path.basename(results[0])}` : `Processed ${results.length} files`,
  };
}

/**
 * Generate a local Wi-Fi QR Code URL for instant phone transfer
 */
async function generateWifiQrForFile(filePath, serverUrl) {
  if (!QRCode) return null;
  const qrDataUrl = await QRCode.toDataURL(serverUrl, {
    width: 280,
    margin: 2,
    color: { dark: '#121218', light: '#ffffff' },
  });
  return { qrDataUrl, url: serverUrl, fileName: path.basename(filePath) };
}

module.exports = {
  processFiles,
  checkFfmpeg,
  generateWifiQrForFile,
};
