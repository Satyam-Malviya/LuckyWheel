const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawn, execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

/**
 * Locate yt-dlp binary across bundled resources and system paths
 */
function getYtDlpPath() {
  const candidates = [
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'bin', 'yt-dlp.exe') : null,
    process.resourcesPath ? path.join(process.resourcesPath, 'bin', 'yt-dlp.exe') : null,
    process.resourcesPath ? path.join(process.resourcesPath, 'bin', 'yt-dlp') : null,
    path.join(__dirname, 'bin', 'yt-dlp.exe').replace('app.asar', 'app.asar.unpacked'),
    path.join(__dirname, 'bin', 'yt-dlp.exe'),
    path.join(__dirname, 'bin', 'yt-dlp'),
    path.join(__dirname, '..', 'electron', 'bin', 'yt-dlp.exe'),
    path.join(__dirname, '..', 'bin', 'yt-dlp.exe'),
    path.join(process.env.APPDATA || '', 'LuckyWheel', 'bin', 'yt-dlp.exe'),
  ];

  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return 'yt-dlp';
}

async function ensureYtDlpAvailable(onProgress = () => {}) {
  const p = getYtDlpPath();
  if (p !== 'yt-dlp' && fs.existsSync(p)) return p;

  const appDataTarget = path.join(process.env.APPDATA || '', 'LuckyWheel', 'bin', 'yt-dlp.exe');
  if (fs.existsSync(appDataTarget)) return appDataTarget;

  try {
    onProgress(5, 'Downloading media engine (yt-dlp)...');
    const targetDir = path.dirname(appDataTarget);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(appDataTarget);
      https.get('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return https.get(res.headers.location, (res2) => {
            res2.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
          }).on('error', reject);
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', reject);
    });

    if (fs.existsSync(appDataTarget)) return appDataTarget;
  } catch {}

  return 'yt-dlp';
}

/**
 * Locate FFmpeg binary for remuxing and audio extraction
 */
function getFfmpegPath() {
  const candidates = [
    process.resourcesPath ? path.join(process.resourcesPath, 'bin', 'ffmpeg.exe') : null,
    process.resourcesPath ? path.join(process.resourcesPath, 'bin', 'ffmpeg') : null,
    path.join(__dirname, 'bin', 'ffmpeg.exe'),
    path.join(__dirname, 'bin', 'ffmpeg'),
    path.join(__dirname, '..', 'electron', 'bin', 'ffmpeg.exe'),
    path.join(__dirname, '..', 'bin', 'ffmpeg.exe'),
  ];

  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return 'ffmpeg';
}

/**
 * Simple HTTPS GET JSON fetcher with timeout
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 6000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchJson(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
  });
}

/**
 * Fetch HTML Title from any web page in <300ms
 */
function fetchWebpageTitle(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchWebpageTitle(res.headers.location));
      }
      let html = '';
      res.on('data', (chunk) => {
        html += chunk.toString();
        // Stop once <title> is found to save memory and time
        const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (match) {
          req.destroy();
          resolve(match[1].trim());
        }
        if (html.length > 50000) {
          req.destroy();
          resolve('');
        }
      });
      res.on('end', () => {
        const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        resolve(match ? match[1].trim() : '');
      });
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => {
      req.destroy();
      resolve('');
    });
  });
}

/**
 * Analyze any URL and detect its media category, metadata, and available formats
 */
async function detectUrl(rawUrl) {
  let url = (rawUrl || '').trim();
  if (!url) throw new Error('No URL provided');
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();

  // 1. YouTube & Shorts
  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    let title = 'YouTube Video';
    let author = '';
    let thumbnail = '';
    try {
      const oembed = await fetchJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      title = oembed.title || title;
      author = oembed.author_name || '';
      thumbnail = oembed.thumbnail_url || '';
    } catch {}

    return {
      success: true,
      url,
      type: 'youtube',
      category: 'YouTube Video / Audio',
      title,
      author,
      thumbnail,
      formats: [
        { id: 'mp4-best', label: 'MP4 (Best)', ext: 'mp4', badge: '1080p+', desc: 'Max quality video with sound' },
        { id: 'mp4-720', label: 'MP4 (720p)', ext: 'mp4', badge: 'HD', desc: 'Fast, compact 720p video' },
        { id: 'mp3', label: 'MP3 (Audio)', ext: 'mp3', badge: '320K', desc: 'High-quality MP3 audio track' },
        { id: 'wav', label: 'WAV', ext: 'wav', badge: 'LOSSLESS', desc: 'Uncompressed studio audio' },
        { id: 'm4a', label: 'M4A', ext: 'm4a', badge: 'AAC', desc: 'Apple/AAC compressed audio' },
      ],
    };
  }

  // 2. Spotify Track / Album / Playlist
  if (hostname.includes('spotify.com')) {
    let title = 'Spotify Music';
    let author = '';
    let thumbnail = '';
    try {
      const oembed = await fetchJson(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
      title = oembed.title || title;
      author = oembed.author_name || '';
      thumbnail = oembed.thumbnail_url || '';
    } catch {}

    return {
      success: true,
      url,
      type: 'spotify',
      category: 'Spotify Music Track',
      title,
      author,
      thumbnail,
      formats: [
        { id: 'mp3', label: 'MP3 (320k)', ext: 'mp3', badge: '320K', desc: 'High quality MP3 audio' },
        { id: 'wav', label: 'WAV', ext: 'wav', badge: 'LOSSLESS', desc: 'Pure uncompressed studio audio' },
        { id: 'flac', label: 'FLAC', ext: 'flac', badge: 'HI-FI', desc: 'Lossless FLAC track' },
        { id: 'm4a', label: 'M4A', ext: 'm4a', badge: 'AAC', desc: 'Crystal clear AAC audio' },
      ],
    };
  }

  // 3. Social Media & Video Streams (Instagram, Twitter/X, TikTok, Reddit, Vimeo, SoundCloud, Facebook)
  if (
    hostname.includes('instagram.com') ||
    hostname.includes('twitter.com') ||
    hostname.includes('x.com') ||
    hostname.includes('tiktok.com') ||
    hostname.includes('reddit.com') ||
    hostname.includes('vimeo.com') ||
    hostname.includes('soundcloud.com') ||
    hostname.includes('facebook.com') ||
    hostname.includes('fb.watch') ||
    hostname.includes('threads.net')
  ) {
    const siteName = hostname.split('.').slice(-2, -1)[0].toUpperCase();
    return {
      success: true,
      url,
      type: 'social',
      category: `${siteName} Media`,
      title: `${siteName} Clip / Media`,
      author: '',
      thumbnail: '',
      formats: [
        { id: 'mp4-best', label: 'MP4 Video', ext: 'mp4', badge: 'BEST', desc: 'Download highest quality video' },
        { id: 'mp3', label: 'MP3 Audio', ext: 'mp3', badge: '320K', desc: 'Extract audio track only' },
        { id: 'wav', label: 'WAV Audio', ext: 'wav', badge: 'STUDIO', desc: 'Extract uncompressed audio' },
      ],
    };
  }

  // 4. Direct Media / File Downloads (.mp4, .mp3, .pdf, .zip, .png, etc.)
  const directMatch = pathname.match(/\.([a-z0-9]{2,5})$/i);
  if (directMatch) {
    const ext = directMatch[1].toLowerCase();
    const fileName = path.basename(pathname);
    const isVid = ['mp4', 'mkv', 'mov', 'webm', 'avi'].includes(ext);
    const isAud = ['mp3', 'wav', 'flac', 'm4a', 'ogg'].includes(ext);
    const isImg = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif'].includes(ext);

    const formats = [{ id: 'direct', label: `Download .${ext.toUpperCase()}`, ext, badge: 'FILE', desc: 'Download direct file' }];
    if (isVid) {
      formats.push({ id: 'mp3', label: 'Extract MP3', ext: 'mp3', badge: 'AUDIO', desc: 'Convert to MP3 audio' });
    }
    if (isImg) {
      formats.push({ id: 'png', label: 'Convert to PNG', ext: 'png', badge: 'IMG', desc: 'Convert image to PNG' });
      formats.push({ id: 'pdf', label: 'Convert to PDF', ext: 'pdf', badge: 'DOC', desc: 'Wrap image into PDF' });
    }

    return {
      success: true,
      url,
      type: 'direct_media',
      category: 'Direct Download Link',
      title: decodeURIComponent(fileName),
      author: hostname,
      thumbnail: '',
      formats,
    };
  }

  // 5. Standard Webpage / Article (Capture to PDF, PNG Screenshot, Text)
  let pageTitle = await fetchWebpageTitle(url);
  if (!pageTitle) pageTitle = hostname;

  return {
    success: true,
    url,
    type: 'webpage',
    category: 'Webpage / Article',
    title: pageTitle,
    author: hostname,
    thumbnail: '',
    formats: [
      { id: 'pdf', label: 'Save as PDF', ext: 'pdf', badge: '300 DPI', desc: 'Clean printable PDF document' },
      { id: 'png', label: 'Save as PNG', ext: 'png', badge: 'IMAGE', desc: 'Full high-res screenshot' },
      { id: 'txt', label: 'Extract Text', ext: 'txt', badge: 'PLAIN', desc: 'Clean article text' },
    ],
  };
}

/**
 * Execute media download using yt-dlp + FFmpeg
 */
async function downloadWithYtDlp({ query, format, outputDir }, onProgress = () => {}) {
  const ytDlp = await ensureYtDlpAvailable(onProgress);
  const ffmpeg = getFfmpegPath();

  return new Promise((resolve, reject) => {

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outTemplate = path.join(outputDir, '%(title).120B [%(id)s].%(ext)s');
    const args = [
      '--no-playlist',
      '--windows-filenames',
      '--progress',
      '--newline',
      '-N',
      '16', // 16 concurrent connection streams for maximum broadband saturation
      '--concurrent-fragments',
      '16',
      '--http-chunk-size',
      '10M', // 10MB chunk prevents YouTube rate limiting / buffering lag
      '--buffer-size',
      '1024K', // 1MB buffer for blazing fast disk I/O
      '--extractor-args',
      'youtube:player_client=android,web', // Bypasses YouTube client throttling!
      '--no-check-certificates',
      '--no-mtime',
      '-o',
      outTemplate,
    ];

    if (ffmpeg && fs.existsSync(ffmpeg)) {
      args.push('--ffmpeg-location', path.dirname(ffmpeg));
    }

    if (format === 'mp3') {
      args.push('-f', 'bestaudio/ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '0', '--embed-thumbnail');
    } else if (format === 'wav') {
      args.push('-f', 'bestaudio/ba/b', '-x', '--audio-format', 'wav');
    } else if (format === 'm4a') {
      args.push('-f', 'bestaudio/ba/b', '-x', '--audio-format', 'm4a');
    } else if (format === 'flac') {
      args.push('-f', 'bestaudio/ba/b', '-x', '--audio-format', 'flac');
    } else if (format === 'mp4-720') {
      args.push(
        '-f',
        'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best',
        '--merge-output-format',
        'mp4'
      );
    } else {
      // mp4-best
      args.push(
        '-f',
        'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best',
        '--merge-output-format',
        'mp4'
      );
    }

    args.push(query);

    onProgress(10, 'Initializing download stream...');
    const child = spawn(ytDlp, args, { windowsHide: true });

    let lastDestination = null;
    let stdoutBuffer = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdoutBuffer += text;

      // Extract destination file path if present
      const destMatch = text.match(/Destination:\s*(.+)/i) || text.match(/Merging formats into "([^"]+)"/i);
      if (destMatch && destMatch[1]) {
        lastDestination = destMatch[1].trim();
      }

      // Extract percentage: [download]  45.2% of ~ 15.00MiB
      const pctMatch = text.match(/\[download\]\s+(\d+(?:\.\d+)?)%/i);
      if (pctMatch) {
        const pct = Math.min(96, Math.max(10, Math.round(parseFloat(pctMatch[1]))));
        onProgress(pct, `Downloading: ${pct}%`);
      } else if (text.includes('[ExtractAudio]')) {
        onProgress(95, 'Extracting audio via FFmpeg...');
      } else if (text.includes('[Merger]')) {
        onProgress(95, 'Remuxing video & audio via FFmpeg...');
      }
    });

    child.stderr.on('data', (d) => {
      const errText = d.toString();
      if (errText.includes('ERROR:')) {
        console.error('[yt-dlp error]', errText);
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        onProgress(100, 'Download complete!');
        // Find newest file in output directory matching downloaded title if lastDestination wasn't explicitly captured
        let resolvedFile = lastDestination;
        if (!resolvedFile || !fs.existsSync(resolvedFile)) {
          try {
            const files = fs.readdirSync(outputDir).map((f) => ({
              name: f,
              time: fs.statSync(path.join(outputDir, f)).mtimeMs,
            }));
            files.sort((a, b) => b.time - a.time);
            if (files.length > 0) {
              resolvedFile = path.join(outputDir, files[0].name);
            }
          } catch {}
        }
        resolve({ success: true, filePath: resolvedFile || outputDir });
      } else {
        reject(new Error(`Download failed with exit code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Direct file download via streaming HTTP/HTTPS
 */
function downloadDirectFile({ url, outputDir, filename }, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const safeName = (filename || path.basename(new URL(url).pathname) || `download_${Date.now()}`)
      .replace(/[\\/:*?"<>|]/g, '_');
    const destPath = path.join(outputDir, safeName);
    const file = fs.createWriteStream(destPath);
    const client = url.startsWith('https') ? https : http;

    onProgress(15, `Downloading ${safeName}...`);

    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        return resolve(downloadDirectFile({ url: res.headers.location, outputDir, filename }, onProgress));
      }

      if (res.statusCode !== 200) {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        return reject(new Error(`HTTP ${res.statusCode} error`));
      }

      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (totalBytes > 0) {
          const pct = Math.min(99, Math.round((downloaded / totalBytes) * 100));
          onProgress(pct, `Downloading: ${pct}%`);
        }
      });

      res.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          onProgress(100, 'Download complete!');
          resolve({ success: true, filePath: destPath });
        });
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

module.exports = {
  getYtDlpPath,
  getFfmpegPath,
  detectUrl,
  downloadWithYtDlp,
  downloadDirectFile,
};
