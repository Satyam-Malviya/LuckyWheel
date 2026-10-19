# 🎡 LuckyWheel — Zero-Click Radial File Converter & Pro Studio

<div align="center">

[![Release](https://img.shields.io/github/v/release/Satyam-Malviya/LuckyWheel?style=for-the-badge&color=ff5200)](https://github.com/Satyam-Malviya/LuckyWheel/releases/tag/v1.0.0)
[![Direct Download](https://img.shields.io/badge/Download_Portable_.exe-Single--Click_Run-brightgreen?style=for-the-badge&logo=windows)](https://github.com/Satyam-Malviya/LuckyWheel/releases/download/v1.0.0/LuckyWheel-Portable.exe)
[![Platform](https://img.shields.io/badge/Platform-Windows_%7C_macOS-blue?style=for-the-badge)](https://github.com/Satyam-Malviya/LuckyWheel)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

<br/>

**The zero-click, 100% offline radial file converter and local power-utility studio for Windows & macOS.**  
*Inspired by Tangerine — completely offline, zero cloud uploads, zero wait times.*

<br/>

<!-- Hyperframes Motion Graphics Animation -->
<img src="./public/assets/luckywheel-motion.gif" width="760" alt="LuckyWheel Motion Graphics Showcase" style="border-radius: 16px; box-shadow: 0 12px 36px rgba(0,0,0,0.3);" />

</div>

---

## ⚡ 1-Click Fast Start (No Setup / No Node.js Required!)

> [!IMPORTANT]
> **You do NOT need to install Node.js, Git, or run any terminal commands.**  
> Anyone can download the single `.exe` file and start using LuckyWheel immediately!

### 📥 Step-by-Step Quick Guide:

1. **Download the App:**
   - ⬇️ **[Click here to download `LuckyWheel-Portable.exe` (v1.0.0)](https://github.com/Satyam-Malviya/LuckyWheel/releases/download/v1.0.0/LuckyWheel-Portable.exe)** *(Direct 1-Click Download, ~81 MB)*
   - *(Optional: If you prefer an unpacked zip folder, download **[LuckyWheel-Windows-v1.0.0.zip](https://github.com/Satyam-Malviya/LuckyWheel/releases/download/v1.0.0/LuckyWheel-Windows-v1.0.0.zip)**).*

2. **Run with 1 Click:**
   - Double-click **`LuckyWheel-Portable.exe`**.
   - LuckyWheel starts instantly and runs silently in your background System Tray (bottom-right near your clock).

3. **Convert Anywhere in File Explorer:**
   - Open any folder in **Windows File Explorer** or on your **Desktop**.
   - Click/Select any file (e.g., photo, video, PDF, audio).
   - Press **`Shift`** on your keyboard — the **Radial Wheel blooms right at your mouse cursor** in `<5ms`!
   - Hover over any petal to see a **Live Video Preview Card** with an English explanation.
   - Click to convert — your new file is saved **instantly in the exact same folder**!

<div align="center">
  <br/>
  <img src="./public/assets/luckywheel-showcase.gif" width="680" alt="LuckyWheel In Action" style="border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.25);" />
  <p><em>Radial wheel blooming at cursor over Windows File Explorer with live dwell video preview card.</em></p>
</div>

---

## 🎮 Master Controls & Shortcuts

| Shortcut | What It Does |
| :--- | :--- |
| **Select file(s) + `⇧ Shift`** | Blooms the **Format Conversion Wheel** (Convert images, videos, audio, PDFs, docs) |
| **Select file(s) + `⌥ Alt` / `Option`** | Blooms the **30+ Pro Tools Wheel** (Passport photo, Exam KB compressor, Video trim, Speed, Vocal splitter) |
| **Press `⌃ Ctrl` while wheel is open** | Switches to the **Quick Actions Wheel** (Wi-Fi QR transfer to phone, Copy path, Terminal) |
| **Hover any petal for `0.5s`** | Opens the floating **Dwell Video Preview Card** explaining the exact operation in English |
| **`Alt + Space`** | Global hotkey to summon the LuckyWheel overlay anywhere on screen |
| **`Esc` or Click Outside** | Closes the wheel immediately |

---

## 🌟 Core Features & Pro Tools

### 1. 🎯 Center-Hub Sub-Options (Zero Mis-clicks)
When selecting tools with sub-controls (like **Passport Background**, **Video Speed**, **Video Trim**, or **Exact KB Compressor**), the sub-options panel opens **dead-center inside the wheel hub**. Moving your mouse into the center card locks the tool and never accidentally triggers neighboring petals!
- **Passport Photo Maker:** 1-click presets for `White BG`, `Studio Blue`, `Light Grey` @ 300 DPI passport crop.
- **Exact-KB Exam Compressor:** 1-click compress to `20 KB`, `50 KB`, `100 KB`, or enter custom target size.
- **Video & Audio Trimmer:** Enter start/end seconds or click quick buttons `0–5s`, `0–15s`, `0–30s`.
- **Speed Control:** Pitch-corrected playback `0.5×`, `1.25×`, `1.5×`, `2.0×`.

### 2. 📱 Phone Wi-Fi QR Share
Need a file from your PC on your smartphone?
1. Select the file and press **`Ctrl`** -> Click **Wi-Fi QR**.
2. Scan the on-screen QR code with your iPhone or Android camera.
3. The file downloads directly over your local Wi-Fi network at blazing gigabit speeds without cables or cloud uploads!

### 3. 🎨 275+ Supported Formats
- **Images:** `PNG`, `JPG`, `WebP`, `AVIF`, `HEIC`, `TIFF`, `BMP`, `ICO`, `SVG`
- **Videos:** `MP4`, `MOV`, `MKV`, `WebM`, `AVI`, `GIF`
- **Audio:** `MP3`, `WAV`, `FLAC`, `M4A`, `OGG`, `Opus`
- **Documents:** `PDF`, `DOCX`, `TXT`, `MD`, `CSV`, `JSON`, `ZIP`

---

## 🍎 macOS Setup (For Mac Users)

1. Download or clone this repository to your Mac.
2. Double-click **`Start-LuckyWheel-Mac.command`** (or run `chmod +x Start-LuckyWheel-Mac.command` once in Terminal).
3. Select any file in **macOS Finder** or Desktop, tap **`Shift`** or **`Option`** to summon the wheel!

---

## 🛠️ For Developers (Run From Source)

If you want to edit the React / Electron source code:

```bash
# 1. Clone the repository
git clone https://github.com/Satyam-Malviya/LuckyWheel.git
cd LuckyWheel

# 2. Install dependencies
npm install

# 3. Build & Run
npm run build
npm start
```

### 📦 Build Your Own Executables:
```bash
# Build standalone Windows Portable .exe (outputs release/LuckyWheel-Portable.exe)
npm run dist:win

# Build macOS .dmg / .zip
npm run dist:mac
```

---

## 📄 License
MIT License — 100% Free, Offline, and Open Source. Created by [Satyam Malviya](https://github.com/Satyam-Malviya).
