import React, { useState, useEffect, useRef } from 'react';
import {
  Crop,
  Monitor,
  AppWindow,
  Globe,
  Timer,
  Check,
  Clipboard,
  Folder,
  Download,
  RotateCcw,
  X,
  Loader2,
  FileText,
  Sparkles,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { soundEngine } from '../utils/sound';

export interface ScreenSnipStudioProps {
  currentDir?: string;
  onClose?: () => void;
  autoCaptureMode?: 'screen' | 'window' | 'region' | null;
  isStandaloneWindow?: boolean;
}

export interface CapturedSnip {
  filePath: string;
  previewDataUrl?: string;
  width?: number;
  height?: number;
  message?: string;
}

export const ScreenSnipStudio: React.FC<ScreenSnipStudioProps> = ({
  currentDir = '',
  onClose,
  autoCaptureMode = null,
  isStandaloneWindow = false,
}) => {
  const [step, setStep] = useState<'picker' | 'area_snipping' | 'webpage_input' | 'captured'>('picker');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [capturedSnip, setCapturedSnip] = useState<CapturedSnip | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<'png' | 'jpg' | 'webp' | 'pdf'>('png');
  const [destinations, setDestinations] = useState<string[]>([]);
  const [customDir, setCustomDir] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Webpage scroll capture URL
  const [webpageUrl, setWebpageUrl] = useState('');

  // Interactive Area Snip Drag State
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const [fullDesktopImgUrl, setFullDesktopImgUrl] = useState<string | null>(null);
  const fullDesktopPathRef = useRef<string | null>(null);

  const api = (window as unknown as { orbitAPI?: Record<string, any> }).orbitAPI;

  // Initialize destinations
  useEffect(() => {
    api?.getSystemDirectories?.().then((dirs: any) => {
      const list: string[] = [];
      if (currentDir) list.push(currentDir);
      if (dirs?.desktop && !list.includes(dirs.desktop)) list.push(dirs.desktop);
      if (dirs?.pictures && !list.includes(dirs.pictures)) list.push(dirs.pictures);
      setDestinations(list);
    }).catch(() => {});
  }, [currentDir]);

  // Check clipboard for auto-pasting URL in webpage capture
  useEffect(() => {
    api?.readClipboard?.().then((text: string) => {
      if (text && /^https?:\/\//i.test(text.trim())) {
        setWebpageUrl(text.trim());
      }
    }).catch(() => {});
  }, []);

  // Handle Capture Modes
  const handleCapture = async (mode: 'screen' | 'window', delayMs = 0) => {
    setIsCapturing(true);
    setStatusText(delayMs > 0 ? `Capturing in ${delayMs / 1000}s...` : 'Capturing pixel-perfect display...');
    setErrorMessage(null);
    try {
      const res = await api?.captureScreen?.({ mode, delayMs });
      if (res && res.success && res.filePath) {
        soundEngine.playDropConfirm();
        setCapturedSnip(res);
        setStep('captured');
      } else {
        setErrorMessage(res?.message || 'Screenshot failed. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Capture failed');
    } finally {
      setIsCapturing(false);
      setStatusText('');
    }
  };

  // Start Interactive Area Snip
  const startAreaSnip = async () => {
    setIsCapturing(true);
    setStatusText('Preparing full screen canvas...');
    setErrorMessage(null);
    try {
      // 1. Grab raw full screen bitmap first
      const res = await api?.captureScreen?.({ mode: 'screen', delayMs: 40 });
      if (res && res.success && res.filePath) {
        fullDesktopPathRef.current = res.filePath;
        setFullDesktopImgUrl(res.previewDataUrl || res.filePath);
        setStep('area_snipping');
      } else {
        setErrorMessage('Could not initialize area snip canvas.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Area snip error');
    } finally {
      setIsCapturing(false);
      setStatusText('');
    }
  };

  // Complete Area Snip Box Crop
  const finishAreaSnip = async (box: { x: number; y: number; w: number; h: number }) => {
    if (!fullDesktopPathRef.current || box.w < 10 || box.h < 10) {
      setStep('picker');
      return;
    }
    setIsCapturing(true);
    setStatusText('Cropping selected region...');
    try {
      const cropRes = await api?.captureScreen?.({
        mode: 'region',
        region: { x: box.x, y: box.y, width: box.w, height: box.h },
      });
      if (cropRes && cropRes.success) {
        soundEngine.playDropConfirm();
        setCapturedSnip(cropRes);
        setStep('captured');
      } else {
        // Fallback: use raw full desktop screenshot
        setCapturedSnip({ filePath: fullDesktopPathRef.current });
        setStep('captured');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to crop region');
      setStep('picker');
    } finally {
      setIsCapturing(false);
      setStatusText('');
    }
  };

  // Handle Full Scrollable Webpage Capture
  const handleScrollWebpageCapture = async () => {
    const url = webpageUrl.trim();
    if (!url) return;
    setIsCapturing(true);
    setStatusText('Loading and scrolling full webpage from top to bottom...');
    setErrorMessage(null);
    try {
      const res = await api?.captureWebpageScroll?.({
        url,
        outputDir: currentDir || destinations[0],
      });
      if (res && res.success && res.filePath) {
        soundEngine.playDropConfirm();
        setCapturedSnip(res);
        setStep('captured');
      } else {
        setErrorMessage(res?.message || 'Could not capture full scrollable page.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Webpage scroll capture error');
    } finally {
      setIsCapturing(false);
      setStatusText('');
    }
  };

  // Save Snip to Selected Destinations & Formats
  const handleSave = async (copyOnly = false) => {
    if (!capturedSnip?.filePath) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      if (copyOnly) {
        await api?.saveScreenshot?.({
          sourcePath: capturedSnip.filePath,
          format: 'clipboard',
          destinations: [],
        });
        soundEngine.playDropConfirm();
        setSaveSuccessMsg('Copied to Clipboard!');
      } else {
        const dests = [...destinations];
        if (customDir && !dests.includes(customDir)) dests.push(customDir);
        const res = await api?.saveScreenshot?.({
          sourcePath: capturedSnip.filePath,
          format: selectedFormat,
          destinations: dests,
        });
        soundEngine.playDropConfirm();
        setSaveSuccessMsg(res?.message || 'Screenshot saved successfully!');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save screenshot');
    } finally {
      setIsSaving(false);
    }
  };

  // Folder toggle helper
  const toggleDestination = (dirPath: string) => {
    setDestinations((prev) =>
      prev.includes(dirPath) ? prev.filter((d) => d !== dirPath) : [...prev, dirPath]
    );
  };

  // ==========================================
  // VIEW 1: Interactive Full-Screen Area Snip Overlay
  // ==========================================
  if (step === 'area_snipping') {
    const boxLeft = dragStart && dragCurrent ? Math.min(dragStart.x, dragCurrent.x) : 0;
    const boxTop = dragStart && dragCurrent ? Math.min(dragStart.y, dragCurrent.y) : 0;
    const boxWidth = dragStart && dragCurrent ? Math.abs(dragCurrent.x - dragStart.x) : 0;
    const boxHeight = dragStart && dragCurrent ? Math.abs(dragCurrent.y - dragStart.y) : 0;

    return (
      <div
        className="fixed inset-0 z-[99999] cursor-crosshair select-none bg-black/40 overflow-hidden"
        onMouseDown={(e) => {
          setDragStart({ x: e.clientX, y: e.clientY });
          setDragCurrent({ x: e.clientX, y: e.clientY });
        }}
        onMouseMove={(e) => {
          if (dragStart) {
            setDragCurrent({ x: e.clientX, y: e.clientY });
          }
        }}
        onMouseUp={() => {
          if (dragStart && dragCurrent && boxWidth > 15 && boxHeight > 15) {
            finishAreaSnip({ x: boxLeft, y: boxTop, w: boxWidth, h: boxHeight });
          } else {
            setDragStart(null);
            setDragCurrent(null);
          }
        }}
      >
        {/* Floating Instruction Badge */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/85 backdrop-blur-md text-white text-xs px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 border border-white/20 pointer-events-none">
          <Crop className="w-4 h-4 text-[#ff5200]" />
          <span>Click and drag to snip any area</span>
          <span className="text-white/50">|</span>
          <button
            type="button"
            onClick={() => setStep('picker')}
            className="text-white/80 hover:text-white underline font-semibold pointer-events-auto"
          >
            Cancel (Esc)
          </button>
        </div>

        {/* Selected Box Indicator */}
        {dragStart && dragCurrent && boxWidth > 2 && (
          <div
            className="absolute border-2 border-[#ff5200] bg-[#ff5200]/10 shadow-[0_0_0_99999px_rgba(0,0,0,0.45)] pointer-events-none rounded-sm transition-all"
            style={{
              left: `${boxLeft}px`,
              top: `${boxTop}px`,
              width: `${boxWidth}px`,
              height: `${boxHeight}px`,
            }}
          >
            <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-[#ff5200] text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow">
              {Math.round(boxWidth)} × {Math.round(boxHeight)} px
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: Captured Result & Multi-Format Destination Save Studio
  // ==========================================
  if (step === 'captured' && capturedSnip) {
    return (
      <div className="w-full max-w-xl mx-auto bg-white rounded-3xl border border-[#e6e8e5] shadow-xl p-6 space-y-5 animate-fade-in text-[#282b29]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f0f2f0] pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-base font-bold text-[#1e211f]">Screenshot Ready</h3>
            {capturedSnip.width && capturedSnip.height && (
              <span className="text-[11px] font-mono bg-black/5 px-2 py-0.5 rounded-md text-[#5d655f] font-semibold">
                {capturedSnip.width} × {capturedSnip.height} px
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setStep('picker');
              setCapturedSnip(null);
              setSaveSuccessMsg(null);
            }}
            className="text-xs text-[#5d655f] hover:text-[#ff5200] font-semibold flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retake Snip</span>
          </button>
        </div>

        {/* Thumbnail Preview */}
        {capturedSnip.previewDataUrl ? (
          <div className="w-full h-44 rounded-2xl bg-black/5 border border-black/10 flex items-center justify-center overflow-hidden p-2 relative group">
            <img
              src={capturedSnip.previewDataUrl}
              alt="Screenshot preview"
              className="max-h-full max-w-full rounded-xl object-contain shadow-sm"
            />
          </div>
        ) : (
          <div className="w-full py-6 rounded-2xl bg-[#f7f8f7] border border-black/5 flex flex-col items-center justify-center text-xs text-[#5d655f]">
            <Check className="w-6 h-6 text-emerald-500 mb-1" />
            <span className="font-semibold">Pixel-perfect screenshot captured!</span>
          </div>
        )}

        {/* 1. Format Selection Pills */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#5d655f] uppercase tracking-wider">
            1. Export Format:
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'png', label: 'PNG', badge: 'Lossless' },
              { id: 'jpg', label: 'JPG', badge: 'High Quality' },
              { id: 'webp', label: 'WEBP', badge: 'Compact' },
              { id: 'pdf', label: 'PDF', badge: 'Document' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFormat(f.id as any)}
                className={`py-2 px-2 rounded-xl text-center border font-bold transition-all text-xs flex flex-col items-center justify-center gap-0.5 ${
                  selectedFormat === f.id
                    ? 'bg-[#ff5200] text-white border-[#ff5200] shadow-sm'
                    : 'bg-[#f7f8f7] text-[#282b29] border-[#e2e6e2] hover:border-[#ff5200]'
                }`}
              >
                <span>{f.label}</span>
                <span className={`text-[9px] font-normal ${selectedFormat === f.id ? 'text-white/80' : 'text-[#767d78]'}`}>
                  {f.badge}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Destination Folders Checklist */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#5d655f] uppercase tracking-wider">
              2. Save Destinations (Multi-Select):
            </label>
            <button
              type="button"
              onClick={async () => {
                const picked = await api?.pickDirectory?.();
                if (picked) {
                  setCustomDir(picked);
                  if (!destinations.includes(picked)) {
                    setDestinations((prev) => [...prev, picked]);
                  }
                }
              }}
              className="text-[11px] text-[#ff5200] hover:underline font-bold flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Choose Another Folder</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {destinations.map((dir) => {
              const name = dir.split(/[\\/]/).pop() || dir;
              const isChecked = destinations.includes(dir);
              const isCurrent = currentDir && dir.toLowerCase() === currentDir.toLowerCase();
              return (
                <button
                  key={dir}
                  type="button"
                  onClick={() => toggleDestination(dir)}
                  className={`p-2 rounded-xl border text-left flex items-center gap-2 text-xs transition-colors ${
                    isChecked
                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900 font-semibold'
                      : 'bg-white border-[#e2e6e2] text-[#767d78] hover:border-black/20'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                    isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-[#ccd0cc]'
                  }`}>
                    {isChecked && <Check className="w-3 h-3" strokeWidth={3} />}
                  </div>
                  <div className="min-w-0 flex-1 truncate">
                    <span className="truncate block font-bold text-[#282b29]">{name}</span>
                    {isCurrent && <span className="text-[9.5px] text-[#ff5200] font-semibold block">Active Folder</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons & Feedback */}
        {saveSuccessMsg ? (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{saveSuccessMsg}</span>
            </span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-emerald-700 hover:underline text-[11px]"
              >
                Close Window ✕
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSave(false)}
              className="flex-1 py-3 px-4 rounded-2xl bg-[#ff5200] hover:bg-[#e04800] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>Save in Selected Folders (.{selectedFormat.toUpperCase()})</span>
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSave(true)}
              className="py-3 px-4 rounded-2xl bg-[#f4f5f4] hover:bg-black/10 text-[#282b29] text-xs font-bold transition-all flex items-center gap-1.5"
              title="Copy screenshot directly to system clipboard"
            >
              <Clipboard className="w-4 h-4 text-[#ff5200]" />
              <span>Copy Only</span>
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
            {errorMessage}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 3: Webpage Full Scrollable Capture Form
  // ==========================================
  if (step === 'webpage_input') {
    return (
      <div className="w-full max-w-xl mx-auto bg-white rounded-3xl border border-[#e6e8e5] shadow-xl p-6 space-y-4 text-[#282b29]">
        <div className="flex items-center justify-between border-b border-[#f0f2f0] pb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-[#ff5200]" />
            <h3 className="text-base font-bold text-[#1e211f]">Scrollable Webpage Capture</h3>
          </div>
          <button
            type="button"
            onClick={() => setStep('picker')}
            className="text-xs text-[#5d655f] hover:text-[#ff5200] font-semibold"
          >
            ← Back to Modes
          </button>
        </div>

        <p className="text-xs text-[#767d78] leading-relaxed">
          Captures the entire page from top to bottom — including sections that require scrolling. Renders locally in an off-screen engine.
        </p>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#5d655f] uppercase tracking-wider">
            Enter Webpage URL:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="url"
              placeholder="https://en.wikipedia.org/wiki/Special:Random"
              value={webpageUrl}
              onChange={(e) => setWebpageUrl(e.target.value)}
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#d6dad6] focus:border-[#ff5200] focus:ring-2 focus:ring-[#ff5200]/20 text-xs font-medium outline-hidden"
            />
            <button
              type="button"
              onClick={async () => {
                const clip = await api?.readClipboard?.();
                if (clip) setWebpageUrl(clip.trim());
              }}
              className="px-3 py-2.5 rounded-xl bg-[#f4f5f4] hover:bg-black/10 text-xs font-bold text-[#282b29]"
              title="Paste from Clipboard"
            >
              Paste
            </button>
          </div>
        </div>

        <button
          type="button"
          disabled={isCapturing || !webpageUrl.trim()}
          onClick={handleScrollWebpageCapture}
          className="w-full py-3 rounded-2xl bg-[#ff5200] hover:bg-[#e04800] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
        >
          {isCapturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span>{isCapturing ? 'Scrolling & Rendering Full Page...' : 'Capture Full Scrollable Webpage'}</span>
        </button>

        {errorMessage && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
            {errorMessage}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 4: Main Mode Picker (Area Snip, Full Screen, Window, Scrollable Webpage)
  // ==========================================
  return (
    <div className="w-full max-w-xl mx-auto bg-white rounded-3xl border border-[#e6e8e5] shadow-xl p-6 space-y-5 text-[#282b29]">
      {/* Studio Title Header */}
      <div className="flex items-center justify-between border-b border-[#f0f2f0] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#fff0e4] text-[#ff5200] flex items-center justify-center">
            <Crop className="w-4 h-4" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#1e211f] leading-tight">Screen Capture Studio</h3>
            <p className="text-[11px] text-[#767d78]">Pixel-perfect native snip &amp; multi-folder save</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 text-[#767d78] hover:text-[#282b29] transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isCapturing ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-[#ff5200] animate-spin" />
          <span className="text-sm font-bold text-[#1e211f]">{statusText || 'Capturing Display...'}</span>
          <span className="text-xs text-[#767d78]">Hiding studio window to capture clear pixels</span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Mode 1: Area Snip */}
            <button
              type="button"
              onClick={startAreaSnip}
              className="p-4 rounded-2xl bg-[#f7f8f7] hover:bg-[#ff5200] hover:text-white border border-[#e2e6e2] hover:border-[#ff5200] text-left transition-all group flex flex-col justify-between shadow-2xs"
            >
              <div className="flex items-center justify-between w-full mb-3">
                <div className="w-9 h-9 rounded-xl bg-white group-hover:bg-white/20 text-[#ff5200] group-hover:text-white flex items-center justify-center shadow-xs">
                  <Crop className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-black/5 group-hover:bg-white/20 text-[#5d655f] group-hover:text-white">
                  RECTANGLE
                </span>
              </div>
              <div>
                <div className="text-sm font-bold group-hover:text-white">Area Snip</div>
                <div className="text-[11px] text-[#767d78] group-hover:text-white/80 mt-0.5 leading-snug">
                  Click and drag to snip any box on your display
                </div>
              </div>
            </button>

            {/* Mode 2: Full Screen */}
            <button
              type="button"
              onClick={() => handleCapture('screen')}
              className="p-4 rounded-2xl bg-[#f7f8f7] hover:bg-[#ff5200] hover:text-white border border-[#e2e6e2] hover:border-[#ff5200] text-left transition-all group flex flex-col justify-between shadow-2xs"
            >
              <div className="flex items-center justify-between w-full mb-3">
                <div className="w-9 h-9 rounded-xl bg-white group-hover:bg-white/20 text-[#ff5200] group-hover:text-white flex items-center justify-center shadow-xs">
                  <Monitor className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-black/5 group-hover:bg-white/20 text-[#5d655f] group-hover:text-white">
                  DISPLAY
                </span>
              </div>
              <div>
                <div className="text-sm font-bold group-hover:text-white">Full Screen</div>
                <div className="text-[11px] text-[#767d78] group-hover:text-white/80 mt-0.5 leading-snug">
                  Snap the entire active monitor instantaneously
                </div>
              </div>
            </button>

            {/* Mode 3: Active Window */}
            <button
              type="button"
              onClick={() => handleCapture('window')}
              className="p-4 rounded-2xl bg-[#f7f8f7] hover:bg-[#ff5200] hover:text-white border border-[#e2e6e2] hover:border-[#ff5200] text-left transition-all group flex flex-col justify-between shadow-2xs"
            >
              <div className="flex items-center justify-between w-full mb-3">
                <div className="w-9 h-9 rounded-xl bg-white group-hover:bg-white/20 text-[#ff5200] group-hover:text-white flex items-center justify-center shadow-xs">
                  <AppWindow className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-black/5 group-hover:bg-white/20 text-[#5d655f] group-hover:text-white">
                  WINDOW
                </span>
              </div>
              <div>
                <div className="text-sm font-bold group-hover:text-white">Active Window</div>
                <div className="text-[11px] text-[#767d78] group-hover:text-white/80 mt-0.5 leading-snug">
                  Capture the focused application window
                </div>
              </div>
            </button>

            {/* Mode 4: Full Scrollable Webpage */}
            <button
              type="button"
              onClick={() => setStep('webpage_input')}
              className="p-4 rounded-2xl bg-[#f7f8f7] hover:bg-[#ff5200] hover:text-white border border-[#e2e6e2] hover:border-[#ff5200] text-left transition-all group flex flex-col justify-between shadow-2xs"
            >
              <div className="flex items-center justify-between w-full mb-3">
                <div className="w-9 h-9 rounded-xl bg-white group-hover:bg-white/20 text-[#ff5200] group-hover:text-white flex items-center justify-center shadow-xs">
                  <Globe className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-black/5 group-hover:bg-white/20 text-[#5d655f] group-hover:text-white">
                  SCROLL
                </span>
              </div>
              <div>
                <div className="text-sm font-bold group-hover:text-white">Scrollable Webpage</div>
                <div className="text-[11px] text-[#767d78] group-hover:text-white/80 mt-0.5 leading-snug">
                  Render &amp; capture entire page top to bottom
                </div>
              </div>
            </button>
          </div>

          {/* Quick Actions Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-[#f0f2f0] text-xs text-[#767d78]">
            <button
              type="button"
              onClick={() => handleCapture('screen', 3000)}
              className="hover:text-[#ff5200] font-semibold flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-black/5"
            >
              <Timer className="w-3.5 h-3.5 text-[#ff5200]" />
              <span>Take with 3-Second Timer</span>
            </button>

            <span className="text-[11px] font-mono">Press Esc to dismiss</span>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
          {errorMessage}
        </div>
      )}
    </div>
  );
};
