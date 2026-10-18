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
git clone https://github.com/YOUR_USERNAME/luckywheel.git
cd luckywheel

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

## 🎮 Controls & Shortcuts Guide

| Shortcut / Gesture | Action |
| :--- | :--- |
| **Select file(s) + `⇧ Shift`** | Opens the **Format Conversion Wheel** right at your cursor in File Explorer, Finder, or Desktop |
| **Select file(s) + `⌥ Alt` / `Option`** | Opens the **30+ Pro Tools Wheel** (Exact-KB, Passport, Trim, Speed, Merge PDF, etc.) |
| **Press `⌃ Ctrl` while wheel is open** | Switches to the **Quick Actions Wheel** (Wi-Fi QR Share, Copy Path, Open Terminal, Float Shelf) |
| **Hover any petal for `0.5s`** | Opens the **Live Video / Motion Graphics Preview Card** with English explanation |
| **Hold `Shift`/`Alt` → Point → Release** | Zero-click execution on release (for tools with sub-options like Speed/Trim, keeps Center Hub open) |
| **`Alt + Space`** | Global hotkey to summon the LuckyWheel overlay anywhere on screen |
| **`Esc` or Click Outside** | Closes the radial wheel overlay immediately |

---

## 📤 How to Upload This Project to GitHub

Run these commands inside the project folder to push LuckyWheel to your GitHub repository:

```bash
git init
git add .
git commit -m "Initial release: LuckyWheel Zero-Click Radial File Converter & Pro Studio"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/luckywheel.git
git push -u origin main
```

To share the single-run `.exe` with others on GitHub:
1. Go to your GitHub repository → click **Releases** → **Draft a new release**.
2. Upload `release/LuckyWheel-Portable.exe` (and macOS `.dmg` if built on a Mac).
3. Anyone can download `LuckyWheel-Portable.exe` and run it directly with zero setup!

---

## 📄 License
MIT License — 100% Free & Open Source.
