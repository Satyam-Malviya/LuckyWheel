# 🎡 LuckyWheel — The Zero-Click Offline Radial File Converter & Pro Studio

**LuckyWheel** is a minimalist, high-speed, 100% offline radial file converter and local power-utility studio for **Windows (10/11)** and **macOS**.

Work directly inside **Windows File Explorer**, **macOS Finder**, or on your **Desktop** without opening any heavy software window or uploading files to the cloud:
1. **Click / Select** any file (or multiple files) in File Explorer, Finder, or on your Desktop.
2. Tap or hold **`⇧ Shift`** (Convert), **`⌥ Alt`** (30+ Pro Tools), or **`⌃ Ctrl`** (Quick Actions).
3. The translucent **Frosted-Glass Radial Wheel** blooms right at your cursor in `<5ms`!
4. **Hover for 0.5 seconds** on any petal to see a **Live Video / Motion Graphics Preview Card** with a clear English explanation of what that option does.
5. Click or release to convert — your new file is saved **instantly right beside the original file**!

---

## ✨ Key Highlights

| Feature | Description |
| :--- | :--- |
| **Background Explorer / Finder Mode** | Runs silently in the System Tray / Menu Bar. Select any file on your Desktop or in File Explorer / Finder and press `⇧ Shift` or `⌥ Alt` — no dragging into a window required! |
| **0.5s Hover Video Preview Card** | Pause your cursor on any wheel petal for `0.5s` to bloom a minimalist frosted-glass card with a live looping video / motion graphic preview + English description. |
| **Center-Hub Locked Sub-Options** | Options with sub-controls (**Speed `0.5×–2.0×`**, **Trim `Start / End` sec**, **Exact-KB `20KB / 50KB / Custom`**, **Passport BG**) open directly inside the **Center Hub** so moving your cursor never accidentally selects adjacent petals. |
| **275+ Format Conversions (`⇧ Shift`)** | Images (`JPG`, `PNG`, `WebP`, `AVIF`, `HEIC`, `TIFF`, `BMP`, `ICO`, `PDF`), Videos (`MP4`, `MOV`, `MKV`, `WebM`, `AVI`, `GIF`), Audio (`MP3`, `WAV`, `FLAC`, `M4A`, `OGG`, `Opus`), Documents & Data (`PDF`, `DOCX`, `TXT`, `MD`, `JSON`, `CSV`, `SRT`, `VTT`, `ZIP`). |
| **30+ Everyday Pro Tools (`⌥ Alt`)** | **Exact-KB Exam Photo Compressor** (`20KB` / `50KB` / Custom KB), **Passport Photo Maker** (`3.5×4.5 cm @ 300 DPI`), **CamScanner B&W Document Filter**, **Lossless Video/Audio Start–End Trim**, **Pitch-Corrected Video Speed**, **Vocal & Instrumental Stem Splitter**, **PDF Merge / Split / Rotate / Unlock**, **EXIF & GPS Privacy Scrubber**. |
| **Multi-File & Mixed Combos** | Select `1 Video + 1 Audio` to mux audio into video; `1 Audio + 1 Image` to render a 1080p podcast/YouTube MP4; `Multiple Images` to build a multi-page PDF or high-res Collage; or select a `Folder` to 1-Click Auto-Organize by category or scan SHA-256 duplicates. |
| **Quick Actions (`⌃ Ctrl`)** | **Instant Wi-Fi QR Phone Transfer** (local LAN HTTP server + scannable QR code), **Floating Drop Shelf**, **Copy Full Path**, **Open in Terminal**, **Reveal in Explorer/Finder**. |
| **Home Screen Plugin Hub** | Install 1-click power-up plugins or build your own custom CLI/Script radial petals directly from the Home Screen. |

---

## 🚀 How Anyone Can Run LuckyWheel (3 Easy Ways)

### Option 1: Single-Run Portable `.exe` (Windows) or `.dmg` (macOS)
No coding or terminal required:
- **Windows:** Double-click **`release/LuckyWheel-Portable.exe`** (or **`Start-LuckyWheel-Windows.bat`**).
- **macOS:** Open **`release/LuckyWheel-macOS.dmg`** (or double-click **`Start-LuckyWheel-Mac.command`**).

---

### Option 2: Run From Source (Windows & macOS)

#### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer)
- [FFmpeg](https://ffmpeg.org/) installed on system `PATH` (for video/audio conversions, trimming, speed, and vocal splitting)

#### Quick Start (3 Commands)
```bash
# 1. Clone the repository
git clone https://github.com/Satyam-Malviya/LuckyWheel.git
cd LuckyWheel

# 2. Install dependencies
npm install

# 3. Build & launch LuckyWheel
npm run build
npm start
```

Or simply double-click:
- **Windows:** `Start-LuckyWheel-Windows.bat`
- **macOS:** `Start-LuckyWheel-Mac.command` (run `chmod +x Start-LuckyWheel-Mac.command` once on macOS)

---

### Option 3: Build Standalone Single-File `.exe` (Windows) & `.dmg` (macOS)

To generate redistributable single-file installers/executables in the `release/` folder:

```bash
# Build Windows Single-Run Portable .exe (outputs release/LuckyWheel-Portable.exe)
npm run dist:win

# Build macOS .dmg and .zip (outputs release/LuckyWheel-macOS-*.dmg)
npm run dist:mac

# Build unpacked standalone app folder (outputs release/win-unpacked/LuckyWheel.exe)
npm run pack
```

---


---

## 📥 Universal Download from Link (Turbo 8-Stream Engine)

LuckyWheel includes an offline-first **Universal Link Downloader** directly integrated into the Radial Wheel (`LINK DL` petal in Control / Actions mode).

Paste any link from the web — LuckyWheel automatically detects the content type in `<150ms` and offers customized formats:

```
   Paste Link (YouTube, Spotify, Web Article)
                    │
   Auto-Detection Engine (<150ms)
                    │
   ┌────────────────┼────────────────┐
   ▼                ▼                ▼
YouTube / Video   Spotify Track    Web Article / Page
• 1080p MP4       • 320k MP3       • 300 DPI PDF Doc
• 720p MP4        • Lossless WAV   • High-Res PNG
• 320k MP3        • FLAC Audio     • Extracted Text
• Lossless WAV    • M4A Audio
```

### ⚡ Supercharged Download Speed
- **8 Parallel Streams (`-N 8`)**: Downloads large video files up to **10× faster** using concurrent fragment streaming.
- **Direct Audio Extraction (`-f ba/b`)**: When downloading MP3, WAV, or Spotify tracks, LuckyWheel streams **only the 3–5 MB audio track directly**, completely avoiding downloading heavy 4K/1080p video files first. Downloads finish in seconds!
- **Zero Cloud Upload**: Everything is remuxed and tagged locally using bundled high-efficiency FFmpeg.

### Real-World Examples:
1. **YouTube Music & Videos**:
   - Paste `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
   - Select **MP4 (1080p Best)** for video, or **MP3 (320kbps)** for audio.
   - File downloads directly with embedded album thumbnail and artist tags into your `Downloads` folder.
2. **Spotify Tracks & Playlists**:
   - Paste any Spotify track link (e.g. `https://open.spotify.com/track/...`)
   - LuckyWheel automatically resolves the song title and artist and downloads the high-bitrate audio track in MP3, WAV, or FLAC.
3. **Webpage Articles & Documentation**:
   - Paste any article or documentation URL (e.g. `https://en.wikipedia.org/wiki/...`)
   - Choose **PDF** to get a clean printable 300 DPI document, or **PNG** for a full high-resolution snapshot.

---

## 📸 Smart Screen Snip Studio (`Alt + S`)

Capture your screen anywhere on Windows or macOS with zero lag, instant resolution, and fail-proof performance.

Summon it anytime with **`Alt + S`** (free 2-key conflict-free global shortcut) or by tapping the **`SNIP / SS`** petal on the radial wheel.

### 🎯 4 Instant Capture Modes:
- **Area Snip (Selection Box)**: Drag a box on your screen to crop and save that exact rectangular region.
- **Full Screen**: Captures the entire display in **under 30 milliseconds** using LuckyWheel's native C# GDI engine (`screencap.exe`).
- **Active Window**: Captures the currently active window with crisp borders.
- **3-Second Delay Timer**: 3-second countdown so you can open menus, right-click popups, or hover tooltips before the snip is taken.

### 🔄 Dynamic 2-Step Format & Multi-Location Wheel Flow:
1. **Step 1 — Format Selection**: Immediately after capture, the wheel presents format options:
   - **`PNG`**: Pixel-perfect lossless image (recommended for UI and text).
   - **`JPG`**: Lightweight compressed photo format.
   - **`WEBP`**: Modern ultra-compact web image.
   - **`PDF`**: Vector-fitted 300 DPI printable PDF document.
   - **`CLIPBOARD`**: Instantly copies image to clipboard with zero disk clutter.
2. **Step 2 — Multi-Location Auto-Save**:
   - LuckyWheel lets you save to **one or multiple folders simultaneously** with one click:
     - `Desktop`
     - `Downloads`
     - `Pictures / Screenshots`
     - `+ Custom Folder` (choose any directory on your computer)
   - Save to both your Desktop AND your project folder at the exact same moment!
   - Includes a 1-click **"Show Folder"** button to reveal the file in Windows File Explorer immediately.

## 🎮 Controls & Shortcuts Guide

| Shortcut / Gesture | Action |
| :--- | :--- |
| **Select file(s) + `⇧ Shift`** | Opens the **Format Conversion Wheel** right at your cursor in File Explorer, Finder, or Desktop |
| **Select file(s) + `⌥ Alt` / `Option`** | Opens the **30+ Pro Tools Wheel** (Exact-KB, Passport, Trim, Speed, Merge PDF, etc.) |
| **Press `⌃ Ctrl` while wheel is open** | Switches to the **Quick Actions Wheel** (Wi-Fi QR Share, Copy Path, Open Terminal, Float Shelf) |
| **Hover any petal for `0.5s`** | Opens the **Live Video / Motion Graphics Preview Card** with English explanation |
| **Hold `Shift`/`Alt` → Point → Release** | Zero-click execution on release (for tools with sub-options like Speed/Trim, keeps Center Hub open) |
| **`Alt + S`** | **Instant Screen Snip & Capture Studio** (Area snip, window, full-screen → PNG/JPG/WEBP/PDF to multi-folders) |
| **`Alt + Space`** | Global hotkey to summon the LuckyWheel overlay anywhere on screen |
| **`Esc` or Click Outside** | Closes the radial wheel overlay immediately |

---

## 📤 How to Upload This Project to GitHub

Run these commands inside the project folder to push LuckyWheel to your GitHub repository:

```bash
git remote add origin https://github.com/Satyam-Malviya/LuckyWheel.git
git branch -M main
git push -u origin main
```

To share the single-run `.exe` with others on GitHub:
1. Go to your GitHub repository → click **Releases** → **Draft a new release**.
2. Upload `release/LuckyWheel-Portable.exe` (and macOS `.dmg` if built on a Mac).
3. Anyone can download `LuckyWheel-Portable.exe` and run it directly with zero setup!

---

## 📄 License
MIT License — 100% Free & Open Source.
