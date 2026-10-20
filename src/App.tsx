import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Keyboard,
  Volume2,
  VolumeX,
  Pin,
  Clipboard,
  Layers,
  CheckCircle2,
  Trash2,
  X,
  Camera,
  Link as LinkIcon,
  Monitor,
  AppWindow,
  Timer,
  Loader2,
  Download,
  Sparkles,
} from 'lucide-react';
import {
  INITIAL_PLUGINS,
  PluginItem,
  WHEEL_THEMES,
  WheelPetalItem,
  WheelTheme,
} from './data/catalog';
import { InteractiveDesktopCanvas, PlaygroundFileItem } from './components/InteractiveDesktopCanvas';
import { HeroMotionShowreel, MotionGraphicPreview } from './components/MotionGraphicPreview';
import { PluginHubSection } from './components/PluginHubSection';
import { WheelShowcaseSection } from './components/WheelShowcaseSection';
import { soundEngine } from './utils/sound';

export function App() {
  const [theme, setTheme] = useState<WheelTheme>({
    ...WHEEL_THEMES[0],
    accentHex: '#ff5200',
  });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [plugins, setPlugins] = useState<PluginItem[]>(INITIAL_PLUGINS);
  const [customPetals, setCustomPetals] = useState<WheelPetalItem[]>([]);
  const [externalTriggerPetalId, setExternalTriggerPetalId] = useState<string | null>(null);

  // Floating Drop Shelf
  const [shelfFiles, setShelfFiles] = useState<PlaygroundFileItem[]>([]);
  const [shelfExpanded, setShelfExpanded] = useState(false);

  // Clipboard Modal
  const [clipboardModal, setClipboardModal] = useState<{
    open: boolean;
    text: string;
    resultMsg?: string;
  }>({ open: false, text: '' });

  // Main Software Link Downloader State
  const [mainUrlInput, setMainUrlInput] = useState('');
  const [isMainUrlBusy, setIsMainUrlBusy] = useState(false);
  const [mainUrlProgressText, setMainUrlProgressText] = useState('');
  const [mainUrlResult, setMainUrlResult] = useState<{ success: boolean; message: string; filePath?: string } | null>(null);

  // Main Software Screen Snip State
  const [isMainSnipBusy, setIsMainSnipBusy] = useState(false);
  // Custom Global Screenshot Shortcut State
  const [customShortcut, setCustomShortcut] = useState('Alt+S');
  const [isSavingShortcut, setIsSavingShortcut] = useState(false);
  const [shortcutSaveMsg, setShortcutSaveMsg] = useState('');

  useEffect(() => {
    const api = (window as unknown as { orbitAPI?: Record<string, any> }).orbitAPI;
    api?.getScreenshotShortcut?.().then((res: any) => {
      if (res?.screenshotShortcut) setCustomShortcut(res.screenshotShortcut);
    }).catch(() => {});
  }, []);

  const handleUpdateShortcut = async (newKey: string) => {
    setIsSavingShortcut(true);
    setShortcutSaveMsg('');
    try {
      const api = (window as unknown as { orbitAPI?: Record<string, any> }).orbitAPI;
      const res = await api?.setScreenshotShortcut?.(newKey);
      if (res && res.success) {
        setCustomShortcut(newKey);
        setShortcutSaveMsg('Saved!');
        soundEngine.playDropConfirm();
      } else {
        setShortcutSaveMsg(res?.message || 'Failed');
      }
    } catch (e: any) {
      setShortcutSaveMsg(e?.message || 'Error');
    } finally {
      setIsSavingShortcut(false);
      setTimeout(() => setShortcutSaveMsg(''), 3000);
    }
  };

  const [mainSnipResult, setMainSnipResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleMainAppDownload = async () => {
    const url = mainUrlInput.trim();
    if (!url) return;
    setIsMainUrlBusy(true);
    setMainUrlProgressText('Analyzing link...');
    setMainUrlResult(null);
    try {
      const api = (window as unknown as { orbitAPI?: Record<string, any> }).orbitAPI;
      const detected = await api?.detectLink?.(url);
      const meta = detected?.meta || (detected?.formats ? detected : null);
      if (!meta || !meta.formats?.length) {
        setMainUrlResult({ success: false, message: 'Could not detect link formats. Please check the URL.' });
        setIsMainUrlBusy(false);
        return;
      }
      setMainUrlProgressText('Downloading 8-stream media...');
      const bestFmt = meta.formats[0];
      const res = await api?.downloadLink?.({
        url,
        type: meta.type,
        format: bestFmt.id,
        formatId: bestFmt.id,
        ext: bestFmt.ext,
        title: meta.title,
        author: meta.author,
      });
      if (res && res.success) {
        soundEngine.playDropConfirm();
        setMainUrlResult({
          success: true,
          message: `Saved: ${res.filePath ? res.filePath.split(/[\\/]/).pop() : 'Downloaded successfully!'}`,
          filePath: res.filePath,
        });
      } else {
        setMainUrlResult({ success: false, message: res?.message || 'Download failed.' });
      }
    } catch (err: any) {
      setMainUrlResult({ success: false, message: err?.message || 'Download failed.' });
    } finally {
      setIsMainUrlBusy(false);
    }
  };

  const handleMainAppCapture = async (mode: 'screen' | 'window' | 'region' = 'screen', delayMs = 0) => {
    setIsMainSnipBusy(true);
    setMainSnipResult(null);
    try {
      const api = (window as unknown as { orbitAPI?: Record<string, any> }).orbitAPI;
      const cap = await api?.captureScreen?.({ mode, delayMs });
      if (cap && cap.success && cap.filePath) {
        const dirs = await api?.getSystemDirectories?.();
        const dests = [dirs?.desktop, dirs?.pictures].filter(Boolean);
        const saveRes = await api?.saveScreenshot?.({
          sourcePath: cap.filePath,
          format: 'png',
          destinations: dests,
        });
        soundEngine.playDropConfirm();
        setMainSnipResult({
          success: true,
          message: saveRes?.message || 'Screenshot captured and saved to Desktop & Clipboard!',
        });
      } else {
        setMainSnipResult({ success: false, message: cap?.message || 'Capture cancelled or failed.' });
      }
    } catch (err: any) {
      setMainSnipResult({ success: false, message: err?.message || 'Capture failed.' });
    } finally {
      setIsMainSnipBusy(false);
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEngine.enabled = next;
    if (next) soundEngine.playPetalTick(3, 8);
  };

  const toggleAlwaysOnTop = async () => {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    const api = (window as unknown as { orbitAPI?: Record<string, any> }).orbitAPI;
    await api?.toggleOverlayMode?.(next);
    soundEngine.playPetalTick(2, 8);
  };

  const handleOpenClipboardWheel = async () => {
    soundEngine.playPetalTick(4, 8);
    const api = (window as unknown as { orbitAPI?: Record<string, any> }).orbitAPI;
    let clipText = 'https://www.instagram.com/reel/DeoFIQkBaHz/';
    if (api?.readClipboard) {
      const res = await api.readClipboard();
      if (res?.text) clipText = res.text;
    }
    setClipboardModal({ open: true, text: clipText });
  };

  const scrollTo = (id: string) => {
    soundEngine.playPetalTick(1, 6);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#f4f4f4] text-[#282b29] flex flex-col">
      {/* Minimalist Frosted Glass Header (Exact match to Tangerine's .site-header) */}
      <header className="sticky top-0 z-50 h-[68px] bg-[#f4f4f4]/90 backdrop-blur-xl border-b border-black/[0.04]">
        <div className="max-w-[1040px] h-full mx-auto px-6 flex items-center justify-between">
          {/* Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-2.5 text-[22px] font-semibold tracking-[-1px] text-[#282b29]"
          >
            <span
              className="w-7 h-7 rounded-full inline-flex items-center justify-center shadow-inner"
              style={{
                background: 'radial-gradient(circle at 30% 30%, #ff8a00, #ff5200 70%)',
              }}
            >
              <span className="w-2 h-2 rounded-full bg-white/90" />
            </span>
            <span>LuckyWheel</span>
          </a>

          {/* Minimalist Navigation & Controls */}
          <nav className="flex items-center gap-6 text-[13px]">
            <button
              type="button"
              onClick={() => scrollTo('home-plugin-hub')}
              className="text-[#767d78] hover:text-[#282b29] transition-colors hidden sm:inline"
            >
              Plugins
            </button>
            <button
              type="button"
              onClick={() => scrollTo('wheel-encyclopedia')}
              className="text-[#767d78] hover:text-[#282b29] transition-colors hidden sm:inline"
            >
              Features
            </button>
            <button
              type="button"
              onClick={() => scrollTo('supported-formats')}
              className="text-[#767d78] hover:text-[#282b29] transition-colors hidden md:inline"
            >
              Formats
            </button>

            <div className="flex items-center gap-1.5">
              {/* Accent Color Dots */}
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/80 border border-black/5 mr-1">
                {[
                  { hex: '#ff5200', name: 'Tangerine' },
                  { hex: '#0063d9', name: 'macOS Blue' },
                  { hex: '#10b981', name: 'Emerald' },
                  { hex: '#8b5cf6', name: 'Amethyst' },
                ].map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => {
                      setTheme({ ...theme, accentHex: c.hex });
                      soundEngine.playPetalTick(2, 6);
                    }}
                    title={c.name}
                    className={`w-3.5 h-3.5 rounded-full transition-transform ${
                      theme.accentHex === c.hex ? 'scale-125 ring-2 ring-black/20' : 'opacity-65 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playPetalTick(1, 6);
                  const api = (window as unknown as { orbitAPI?: Record<string, any> }).orbitAPI;
                  api?.minimizeToBackground?.();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#282b29] hover:bg-black text-white text-xs font-medium transition-colors shadow-sm"
                title="Hide this window and run LuckyWheel silently in the background on your Desktop & File Explorer"
              >
                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                <span>Run in Background</span>
              </button>

              <button
                type="button"
                onClick={() => handleMainAppCapture('screen')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#dfe2df] hover:border-[#ff5200] text-xs font-medium text-[#282b29] transition-colors shadow-sm"
                title="Capture Screenshot (Alt+S)"
              >
                <Camera className="w-3.5 h-3.5 text-[#06b6d4]" />
                <span className="hidden sm:inline">Snip</span>
                <kbd className="text-[9.5px] bg-black/5 px-1 py-0.2 rounded font-mono text-[#5d655f]">{customShortcut}</kbd>
              </button>

              <button
                type="button"
                onClick={() => scrollTo('new-features-spotlight')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#dfe2df] hover:border-[#ff5200] text-xs font-medium text-[#282b29] transition-colors shadow-sm"
                title="Universal Link Downloader"
              >
                <LinkIcon className="w-3.5 h-3.5 text-[#ff5200]" />
                <span className="hidden sm:inline">Link DL</span>
              </button>

              <button
                type="button"
                onClick={handleOpenClipboardWheel}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-[#dfe2df] hover:border-[#c8ccc8] text-xs font-medium text-[#282b29] transition-colors shadow-sm"
                title="Clipboard Wheel"
              >
                <Clipboard className="w-3.5 h-3.5 text-[#ff5200]" />
                <span>Clipboard</span>
              </button>

              <button
                type="button"
                onClick={toggleSound}
                className="p-2 rounded-full bg-white border border-[#dfe2df] text-[#565d57] hover:text-[#282b29] transition-colors"
                title={soundEnabled ? 'Mute UI Sounds' : 'Enable UI Sounds'}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={toggleAlwaysOnTop}
                className={`p-2 rounded-full border transition-colors ${
                  alwaysOnTop
                    ? 'bg-[#ff5200] border-[#ff5200] text-white'
                    : 'bg-white border-[#dfe2df] text-[#565d57] hover:text-[#282b29]'
                }`}
                title="Pin Window Always-On-Top"
              >
                <Pin className="w-3.5 h-3.5" />
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main id="top" className="flex-1 space-y-20 pb-24">
        {/* 1. Minimalist Hero Headline + Scenic Sky & Tree Playground */}
        <section className="pt-8">
          <div className="text-center max-w-2xl mx-auto px-6 pb-2 relative z-20">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#e2e6e2] shadow-sm text-xs font-medium text-[#282b29] mb-5">
              <span className="w-2 h-2 rounded-full bg-[#10b981]" />
              <span>Active in Background: Select any file on Desktop or File Explorer &amp; tap</span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#fff0e4] border border-[#efc8ac] text-[#d55223] font-semibold">⇧ Shift</kbd>
            </div>
            <h1 className="text-[44px] sm:text-[62px] font-medium leading-[1.06] tracking-[-3.2px] text-[#282b29]">
              The zero-click
              <br />
              offline file converter.
            </h1>
            <p className="mt-5 text-[14.5px] text-[#858a84]">
              Select or drag any file in File Explorer or Desktop, tap Shift, and pick your format. Hold hover for 0.5s on any petal to see a live video preview.
            </p>
            <p className="mt-2 text-[14px] text-[#596557] font-medium">
              Everything happens locally on your PC — no window needed.
            </p>
          </div>

          {/* Full-Bleed Scenic Sky & Tree Interactive Desktop */}
          <InteractiveDesktopCanvas
            theme={theme}
            customPetals={customPetals}
            onPinToShelf={(newFiles) => {
              setShelfFiles((prev) => {
                const existing = new Set(prev.map((f) => f.id));
                return [...prev, ...newFiles.filter((f) => !existing.has(f.id))];
              });
              setShelfExpanded(true);
            }}
            externalTriggerPetalId={externalTriggerPetalId}
            onClearExternalTrigger={() => setExternalTriggerPetalId(null)}
          />
        </section>

        {/* NEW FEATURE SPOTLIGHT: Universal Link Downloader & Smart Screen Snip Studio */}
        <section id="new-features-spotlight" className="max-w-[1040px] mx-auto px-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[#e6e8e5] pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fff0e4] text-[#ff5200] text-xs font-bold mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>NEW POWER FEATURES</span>
              </div>
              <h2 className="text-3xl font-medium tracking-[-1.2px] text-[#282b29]">
                Turbo Link Downloader &amp; Screen Snip Studio
              </h2>
              <p className="text-sm text-[#767d78] mt-1">
                Zero-upload offline privacy, 8-stream parallel speeds, and system-wide <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#dadfd6] text-xs font-bold">Alt + S</kbd> shortcut.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: Universal Turbo Link Downloader */}
            <div className="rounded-[24px] bg-white border border-[#e6e6e6] p-6 shadow-sm flex flex-col justify-between space-y-5">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-[#ff5200] uppercase tracking-wider flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>Universal Link Downloader</span>
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                    8× TURBO STREAM
                  </span>
                </div>
                <h3 className="text-xl font-medium text-[#282b29]">
                  YouTube, Spotify &amp; Web Articles
                </h3>
                <p className="text-xs text-[#767d78] mt-1 leading-relaxed">
                  Downloads directly into your active folder. 1080p MP4 videos, 320kbps MP3s (audio-stream direct), and 300 DPI vector PDFs.
                </p>

                <div className="my-4">
                  <MotionGraphicPreview type="link-download" compact={true} />
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-[#f0f0ee]">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={mainUrlInput}
                    onChange={(e) => setMainUrlInput(e.target.value)}
                    placeholder="Paste link (YouTube, Spotify, Web...)"
                    className="flex-1 px-3 py-2 rounded-xl bg-[#f4f5f4] border border-black/10 text-xs font-medium text-[#282b29] placeholder:text-[#9ea49f] focus:outline-none focus:border-[#ff5200]"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const api = (window as unknown as { orbitAPI?: Record<string, any> }).orbitAPI;
                      const text = await api?.readClipboard?.();
                      if (text) setMainUrlInput(typeof text === 'string' ? text : text.text || '');
                    }}
                    className="px-3 py-2 rounded-xl bg-[#f4f5f4] hover:bg-black/10 text-xs font-semibold text-[#5d655f] transition-colors"
                  >
                    Paste
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isMainUrlBusy || !mainUrlInput.trim()}
                  onClick={handleMainAppDownload}
                  className="w-full py-2.5 rounded-xl bg-[#ff5200] hover:bg-[#e04800] disabled:opacity-40 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  {isMainUrlBusy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{mainUrlProgressText || 'Downloading...'}</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Download in Active Folder</span>
                    </>
                  )}
                </button>

                {mainUrlResult && (
                  <div className={`p-2.5 rounded-xl text-xs font-medium ${mainUrlResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {mainUrlResult.message}
                    {mainUrlResult.filePath && (
                      <button
                        type="button"
                        onClick={() => {
                          const api = (window as unknown as { orbitAPI?: Record<string, any> }).orbitAPI;
                          api?.revealInExplorer?.(mainUrlResult.filePath!);
                        }}
                        className="block mt-1 text-[#ff5200] hover:underline font-bold"
                      >
                        Show File in Explorer →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Smart Screen Capture & Snip Studio */}
            <div className="rounded-[24px] bg-white border border-[#e6e6e6] p-6 shadow-sm flex flex-col justify-between space-y-5">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-[#06b6d4] uppercase tracking-wider flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Screen Capture Studio</span>
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-600 border border-cyan-200">
                    SHORTCUT: {customShortcut}
                  </span>
                </div>
                <h3 className="text-xl font-medium text-[#282b29]">
                  Area Snip, Active Window &amp; Fullscreen
                </h3>
                <p className="text-xs text-[#767d78] mt-1 leading-relaxed">
                  Ultra-fast &lt;30ms native capture. Save to PNG, JPG, WebP, or 300 DPI PDF, and write to multiple destination folders simultaneously.
                </p>

                <div className="my-4">
                  <MotionGraphicPreview type="screen-capture" compact={true} />
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-[#f0f0ee]">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={isMainSnipBusy}
                    onClick={() => handleMainAppCapture('screen')}
                    className="py-2.5 px-3 rounded-xl bg-[#f4f5f4] hover:bg-[#ff5200] hover:text-white text-[#282b29] text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 group shadow-2xs"
                  >
                    <Monitor className="w-4 h-4 text-[#ff5200] group-hover:text-white" />
                    <span>Full Screen</span>
                  </button>

                  <button
                    type="button"
                    disabled={isMainSnipBusy}
                    onClick={() => handleMainAppCapture('window')}
                    className="py-2.5 px-3 rounded-xl bg-[#f4f5f4] hover:bg-[#ff5200] hover:text-white text-[#282b29] text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 group shadow-2xs"
                  >
                    <AppWindow className="w-4 h-4 text-[#ff5200] group-hover:text-white" />
                    <span>Active Window</span>
                  </button>

                  <button
                    type="button"
                    disabled={isMainSnipBusy}
                    onClick={() => handleMainAppCapture('screen', 3000)}
                    className="py-2.5 px-3 rounded-xl bg-[#f4f5f4] hover:bg-[#ff5200] hover:text-white text-[#282b29] text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 group shadow-2xs"
                  >
                    <Timer className="w-4 h-4 text-[#ff5200] group-hover:text-white" />
                    <span>3s Timer</span>
                  </button>
                </div>

                {mainSnipResult && (
                  <div className={`p-2.5 rounded-xl text-xs font-medium ${mainSnipResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {mainSnipResult.message}
                  </div>
                )}

                {/* Custom Shortcut Assignment UI */}
                <div className="bg-[#f7f8f7] p-3 rounded-2xl border border-black/5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#282b29] flex items-center gap-1.5">
                      <Keyboard className="w-3.5 h-3.5 text-[#ff5200]" />
                      <span>Custom Shortcut Hotkey:</span>
                    </span>
                    {shortcutSaveMsg && (
                      <span className="text-[11px] font-bold text-emerald-600 animate-fade-in">{shortcutSaveMsg}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {['Alt+S', 'Ctrl+Alt+S', 'Alt+Shift+S', 'Alt+Q', 'F9', 'F10'].map((key) => (
                      <button
                        key={key}
                        type="button"
                        disabled={isSavingShortcut}
                        onClick={() => handleUpdateShortcut(key)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                          customShortcut === key
                            ? 'bg-[#ff5200] text-white shadow-sm ring-2 ring-[#ff5200]/30'
                            : 'bg-white border border-[#dfe2df] text-[#282b29] hover:border-[#ff5200]'
                        }`}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#767d78]">
                    Click any key combo above to assign custom shortcut across Windows.
                  </p>
                </div>


                <div className="flex items-center justify-between text-xs text-[#767d78] px-1">
                  <span>Press <kbd className="px-1.5 py-0.5 rounded bg-[#f4f5f4] border border-[#dadfd6] font-bold text-[#282b29]">Alt + S</kbd> anytime</span>
                  <span className="text-[#06b6d4] font-semibold">Multi-Location Save ✓</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Home Screen Power-Ups & Plugin Hub */}
        <PluginHubSection
          plugins={plugins}
          onTogglePlugin={(id) =>
            setPlugins((prev) =>
              prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
            )
          }
          onInstallPlugin={(id) =>
            setPlugins((prev) =>
              prev.map((p) => (p.id === id ? { ...p, installed: true, enabled: true } : p))
            )
          }
          onAddCustomPetal={(petal) => setCustomPetals((prev) => [...prev, petal])}
          onTryPluginOnWheel={(petalId) => setExternalTriggerPetalId(petalId)}
          customPetals={customPetals}
        />

        {/* 3. Seamless Demo Video & Key Stats */}
        <section className="px-6">
          <HeroMotionShowreel />
        </section>

        {/* 4. Interactive Twin-Wheel & Bento Feature Showcase */}
        <WheelShowcaseSection
          theme={theme}
          customPetals={customPetals}
          onTryFeatureOnPlayground={(toolId) => setExternalTriggerPetalId(toolId)}
        />

        {/* 5. Minimalist Supported Formats Table (Just like Tangerine's .formats) */}
        <section id="supported-formats" className="max-w-[1040px] mx-auto px-6 pt-12 border-t border-[#e6e8e5]">
          <h2 className="text-3xl font-medium tracking-[-1.2px] text-[#282b29] mb-8">
            Supported formats
          </h2>
          <div className="divide-y divide-[#e6e8e5]">
            {[
              { cat: 'Images', list: 'JPG · PNG · WebP · HEIC · TIFF · AVIF · BMP · ICO', note: 'PDF export · SVG input' },
              { cat: 'Audio', list: 'MP3 · M4A · WAV · FLAC · OGG · Opus · AIFF · WMA', note: 'Vocal Stem Isolation' },
              { cat: 'Video', list: 'MP4 · MOV · MKV · WebM · AVI · WMV · GIF', note: 'MP3 audio extraction' },
              { cat: 'PDF', list: 'PDF → DOCX · PPTX · XLSX · JPG · PNG · EPUB · TXT · MD', note: '300 DPI pages · Local OCR' },
              { cat: 'Documents & Data', list: 'DOCX · Markdown · TXT · JSON · CSV · XLSX · SRT · VTT', note: 'Instant table conversion' },
              { cat: 'Archives & Folders', list: 'ZIP · TAR · GZIP · RAR · Folder Auto-Sort', note: 'SHA-256 Duplicate Scan' },
            ].map((row) => (
              <div
                key={row.cat}
                className="py-5 grid grid-cols-1 sm:grid-cols-12 items-center gap-2 text-xs"
              >
                <h3 className="sm:col-span-3 font-semibold text-[#282b29] text-[13px]">{row.cat}</h3>
                <p className="sm:col-span-6 text-[#636d64] tracking-wide">{row.list}</p>
                <span className="sm:col-span-3 sm:text-right text-[11px] text-[#a0a69d]">{row.note}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Minimalist Frosted Glass Floating Drop Shelf */}
      <div className="fixed right-5 bottom-5 z-40">
        <AnimatePresence>
          {shelfExpanded ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              className="w-72 rounded-[22px] bg-white/95 backdrop-blur-2xl border border-[#d9dfda] p-5 shadow-[0_12px_45px_rgba(36,50,61,0.16)] space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#282b29]">
                  Floating Shelf ({shelfFiles.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShelfExpanded(false)}
                  className="w-6 h-6 rounded-full bg-[#e5e7e4] flex items-center justify-center text-[#565d57]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {shelfFiles.length === 0 ? (
                <p className="text-xs text-[#767d78] leading-relaxed py-2">
                  Hold <kbd className="px-1.5 py-0.5 rounded bg-[#f7f8f4] border border-[#dadfd6]">⌃ Ctrl</kbd> on any file and choose <strong>Float Pin</strong> to keep files within reach while you work.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {shelfFiles.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[#f4f4f4] text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <img src={f.iconSrc} alt="" className="w-5 h-5 object-contain" />
                        <span className="truncate text-[#282b29] font-medium">{f.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setShelfFiles((prev) => prev.filter((item) => item.id !== f.id))
                        }
                        className="text-[#828782] hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {shelfFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShelfExpanded(false);
                    setExternalTriggerPetalId('packZip');
                  }}
                  className="w-full py-2 rounded-xl bg-[#ff5200] text-white text-xs font-medium shadow-sm"
                >
                  Batch Convert All ({shelfFiles.length})
                </button>
              )}
            </motion.div>
          ) : (
            <button
              type="button"
              onClick={() => {
                soundEngine.playPetalTick(3, 6);
                setShelfExpanded(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/90 hover:bg-white backdrop-blur-xl border border-[#dfe2df] shadow-lg text-xs font-medium text-[#282b29] transition-all"
            >
              <Layers className="w-3.5 h-3.5 text-[#ff5200]" />
              <span>Float Shelf</span>
              {shelfFiles.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#ff5200] text-white text-[10px] font-bold">
                  {shelfFiles.length}
                </span>
              )}
            </button>
          )}
        </AnimatePresence>
      </div>

      {/* Minimalist Glass Clipboard Modal */}
      <AnimatePresence>
        {clipboardModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setClipboardModal({ open: false, text: '' })}
            className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.94, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-[24px] bg-white border border-[#e6e6e6] p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium tracking-[-0.4px] text-[#282b29]">
                  Clipboard Radial Actions
                </h3>
                <button
                  type="button"
                  onClick={() => setClipboardModal({ open: false, text: '' })}
                  className="w-7 h-7 rounded-full bg-[#f4f4f4] flex items-center justify-center text-[#767d78]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <textarea
                rows={3}
                value={clipboardModal.text}
                onChange={(e) => setClipboardModal({ ...clipboardModal, text: e.target.value })}
                placeholder="Paste any URL, JSON, or text..."
                className="w-full p-3 rounded-xl bg-[#f8f9f8] border border-[#dfe2df] text-xs font-mono text-[#282b29] focus:outline-none focus:border-[#ff5200]"
              />

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Generate QR Code', msg: 'Created QR Code PNG from clipboard!' },
                  { label: 'Save as .TXT / .MD', msg: 'Saved clipboard text to Desktop!' },
                  { label: 'Beautify JSON', msg: 'Formatted JSON & copied!' },
                  { label: 'Download Media URL', msg: 'Started offline media stream grabber!' },
                ].map((act) => (
                  <button
                    key={act.label}
                    type="button"
                    onClick={() => {
                      soundEngine.playDropConfirm();
                      setClipboardModal((prev) => ({ ...prev, resultMsg: act.msg }));
                    }}
                    className="p-3 rounded-xl bg-[#f8f9f8] hover:bg-[#fff0e4] border border-[#eceeed] hover:border-[#efc8ac] text-xs font-medium text-[#282b29] text-left transition-colors"
                  >
                    {act.label}
                  </button>
                ))}
              </div>

              {clipboardModal.resultMsg && (
                <div className="p-3 rounded-xl bg-[#f2f8f4] border border-[#cde5d4] flex items-center gap-2 text-xs font-medium text-[#2a6b3f]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{clipboardModal.resultMsg}</span>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimalist Footer */}
      <footer className="border-t border-[#e6e8e5] py-8">
        <div className="max-w-[1040px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#767d78]">
          <span className="font-semibold text-[#282b29]">LuckyWheel</span>
          <span>100% Local & Offline · Global Shortcut: Alt + Space</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
