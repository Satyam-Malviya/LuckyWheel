import React, { useState, useEffect, useRef } from 'react';
import {
  Crop,
  Monitor,
  AppWindow,
  Scroll,
  Timer,
  Check,
  Clipboard,
  Folder,
  Download,
  RotateCcw,
  X,
  Loader2,
  Plus,
} from 'lucide-react';
import { soundEngine } from '../utils/sound';

export interface ScreenSnipStudioProps {
  currentDir?: string;
  onClose?: () => void;
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
  isStandaloneWindow = false,
}) => {
  const [activeTool, setActiveTool] = useState<'rect' | 'window' | 'screen' | 'scroll'>('rect');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [capturedSnip, setCapturedSnip] = useState<CapturedSnip | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<'png' | 'jpg' | 'webp' | 'pdf'>('png');
  const [destinations, setDestinations] = useState<string[]>([]);
  const [customDir, setCustomDir] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [delayTimer, setDelayTimer] = useState<number>(0);

  // Drag selection state for Rectangular Snip
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const fullDesktopPathRef = useRef<string | null>(null);

  const api = (window as unknown as { orbitAPI?: Record<string, any> }).orbitAPI;

  const handleClose = () => {
    if (onClose) onClose();
    api?.closeSnipWindow?.();
  };

  // Keyboard shortcut listener: ESC to cancel instantly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Capture full screen background bitmap on load for instant rectangular cropping
  useEffect(() => {
    let isMounted = true;
    const initSnapshot = async () => {
      try {
        const res = await api?.captureScreen?.({ mode: 'screen', delayMs: 40 });
        if (isMounted && res && res.success && res.filePath) {
          fullDesktopPathRef.current = res.filePath;
        }
      } catch {}
    };
    initSnapshot();
    return () => { isMounted = false; };
  }, []);

  // Perform Rectangular Crop
  const finishRectSnip = async (box: { x: number; y: number; w: number; h: number }) => {
    if (box.w < 15 || box.h < 15) {
      setDragStart(null);
      setDragCurrent(null);
      return;
    }
    setIsCapturing(true);
    setStatusText('Cropping selection...');
    try {
      let cropRes: any = null;
      if (fullDesktopPathRef.current && api?.cropScreenshot) {
        cropRes = await api.cropScreenshot({
          sourcePath: fullDesktopPathRef.current,
          rect: { x: box.x, y: box.y, width: box.w, height: box.h },
        });
      } else {
        cropRes = await api?.captureScreen?.({
          mode: 'region',
          region: { x: box.x, y: box.y, width: box.w, height: box.h },
        });
      }

      if (cropRes && cropRes.success) {
        soundEngine.playDropConfirm();
        setCapturedSnip(cropRes);
        // Auto-copy to clipboard immediately like Windows Snipping Tool
        api?.saveScreenshot?.({
          sourcePath: cropRes.filePath,
          format: 'clipboard',
          destinations: [],
        });
      } else {
        setErrorMessage('Failed to capture selected area.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error during crop');
    } finally {
      setIsCapturing(false);
      setStatusText('');
      setDragStart(null);
      setDragCurrent(null);
    }
  };

  // Perform Fullscreen or Active Window Snip
  const handleDirectCapture = async (mode: 'screen' | 'window', delayMs = 0) => {
    setIsCapturing(true);
    setStatusText(delayMs > 0 ? `Capturing in ${delayMs / 1000}s...` : 'Capturing...');
    setErrorMessage(null);
    try {
      const res = await api?.captureScreen?.({ mode, delayMs });
      if (res && res.success && res.filePath) {
        soundEngine.playDropConfirm();
        setCapturedSnip(res);
        api?.saveScreenshot?.({
          sourcePath: res.filePath,
          format: 'clipboard',
          destinations: [],
        });
      } else {
        setErrorMessage(res?.message || 'Capture failed');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Capture failed');
    } finally {
      setIsCapturing(false);
      setStatusText('');
    }
  };

  // Perform Long Screenshot (Auto-Scrolling Current Window)
  const handleScrollCapture = async () => {
    setIsCapturing(true);
    setStatusText('Auto-scrolling active window and stitching full page...');
    setErrorMessage(null);
    try {
      const res = await api?.captureScreen?.({ mode: 'scroll', delayMs: 80 });
      if (res && res.success && res.filePath) {
        soundEngine.playDropConfirm();
        setCapturedSnip(res);
        api?.saveScreenshot?.({
          sourcePath: res.filePath,
          format: 'clipboard',
          destinations: [],
        });
      } else {
        setErrorMessage(res?.message || 'Long scrolling screenshot failed. Ensure a scrollable window is active.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Scrolling capture error');
    } finally {
      setIsCapturing(false);
      setStatusText('');
    }
  };

  // Save Snip to Destinations
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
        setSaveSuccessMsg(res?.message || 'Screenshot saved!');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDestination = (dirPath: string) => {
    setDestinations((prev) =>
      prev.includes(dirPath) ? prev.filter((d) => d !== dirPath) : [...prev, dirPath]
    );
  };

  // ==========================================
  // VIEW: Captured Snip Result Card
  // ==========================================
  if (capturedSnip) {
    return (
      <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs select-none">
        <div className="w-full max-w-lg bg-white rounded-3xl border border-[#e2e6e2] shadow-2xl p-5 space-y-4 animate-fade-in text-[#282b29]">
          <div className="flex items-center justify-between border-b border-[#f0f2f0] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-sm font-bold text-[#1e211f]">Snip Captured</h3>
              {capturedSnip.width && capturedSnip.height && (
                <span className="text-[10px] font-mono bg-black/5 px-2 py-0.5 rounded text-[#5d655f] font-semibold">
                  {capturedSnip.width} × {capturedSnip.height} px
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCapturedSnip(null);
                  setSaveSuccessMsg(null);
                }}
                className="text-xs text-[#5d655f] hover:text-[#ff5200] font-semibold flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retake</span>
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="p-1 rounded-full hover:bg-black/5 text-[#767d78] hover:text-black"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Preview Image */}
          <div className="w-full h-44 rounded-2xl bg-[#f4f5f4] border border-black/10 flex items-center justify-center overflow-hidden p-2 relative">
            {capturedSnip.previewDataUrl ? (
              <img
                src={capturedSnip.previewDataUrl}
                alt="Snip preview"
                className="max-h-full max-w-full rounded-xl object-contain shadow-sm"
              />
            ) : (
              <div className="text-xs text-[#5d655f] flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Capture saved to clipboard!</span>
              </div>
            )}
          </div>

          {/* Format Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#5d655f] uppercase tracking-wider">
              Format:
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'png', label: 'PNG', badge: 'Lossless' },
                { id: 'jpg', label: 'JPG', badge: 'Compressed' },
                { id: 'webp', label: 'WEBP', badge: 'Web' },
                { id: 'pdf', label: 'PDF', badge: 'Doc' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFormat(f.id as any)}
                  className={`py-1.5 px-1 rounded-xl text-center border font-bold transition-all text-xs flex flex-col items-center justify-center ${
                    selectedFormat === f.id
                      ? 'bg-[#ff5200] text-white border-[#ff5200] shadow-xs'
                      : 'bg-[#f7f8f7] text-[#282b29] border-[#e2e6e2] hover:border-[#ff5200]'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`text-[8.5px] font-normal ${selectedFormat === f.id ? 'text-white/80' : 'text-[#767d78]'}`}>
                    {f.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Save Destinations */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-[#5d655f] uppercase tracking-wider">
                Save Folders:
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
                className="text-[10.5px] text-[#ff5200] hover:underline font-bold flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" />
                <span>Custom Folder</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {destinations.map((dir) => {
                const name = dir.split(/[\\/]/).pop() || dir;
                const isChecked = destinations.includes(dir);
                const isCurrent = currentDir && dir.toLowerCase() === currentDir.toLowerCase();
                return (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => toggleDestination(dir)}
                    className={`p-1.5 rounded-xl border text-left flex items-center gap-1.5 text-xs transition-colors ${
                      isChecked
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                        : 'bg-white border-[#e2e6e2] text-[#767d78] hover:border-black/20'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                      isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-[#ccd0cc]'
                    }`}>
                      {isChecked && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                    </div>
                    <span className="truncate flex-1 text-[11px] font-bold text-[#282b29]">{name}</span>
                    {isCurrent && <span className="text-[8px] text-[#ff5200] font-bold">Active</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          {saveSuccessMsg ? (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{saveSuccessMsg}</span>
              </span>
              <button
                type="button"
                onClick={handleClose}
                className="text-emerald-700 hover:underline text-[11px]"
              >
                Done ✕
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSave(false)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#ff5200] hover:bg-[#e04800] text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Save (.{selectedFormat.toUpperCase()})</span>
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSave(true)}
                className="py-2.5 px-3 rounded-xl bg-[#f4f5f4] hover:bg-black/10 text-[#282b29] text-xs font-bold transition-all flex items-center gap-1"
                title="Copied to clipboard already"
              >
                <Clipboard className="w-3.5 h-3.5 text-[#ff5200]" />
                <span>Copy</span>
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
              {errorMessage}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: Windows Snipping Tool (Win + Shift + S) Full-Screen Experience
  // ==========================================
  const boxLeft = dragStart && dragCurrent ? Math.min(dragStart.x, dragCurrent.x) : 0;
  const boxTop = dragStart && dragCurrent ? Math.min(dragStart.y, dragCurrent.y) : 0;
  const boxWidth = dragStart && dragCurrent ? Math.abs(dragCurrent.x - dragStart.x) : 0;
  const boxHeight = dragStart && dragCurrent ? Math.abs(dragCurrent.y - dragStart.y) : 0;

  return (
    <div
      className="fixed inset-0 z-[999999] cursor-crosshair select-none bg-black/25 overflow-hidden"
      onMouseDown={(e) => {
        // Prevent drag on toolbar clicks
        if ((e.target as HTMLElement).closest('.snipping-toolbar')) return;
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
          finishRectSnip({ x: boxLeft, y: boxTop, w: boxWidth, h: boxHeight });
        } else {
          setDragStart(null);
          setDragCurrent(null);
        }
      }}
    >
      {/* 1. Sleek Windows Snipping Tool Top Center Bar */}
      <div
        className="snipping-toolbar absolute top-5 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-xl border border-black/15 shadow-[0_16px_36px_rgba(0,0,0,0.22)] rounded-2xl p-1.5 flex items-center gap-1 z-[1000000] cursor-default"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tool 1: Rectangular Snip (Box Drag) */}
        <button
          type="button"
          onClick={() => setActiveTool('rect')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTool === 'rect'
              ? 'bg-[#ff5200] text-white shadow-xs'
              : 'text-[#282b29] hover:bg-black/5'
          }`}
          title="Rectangular Box Snip (Click & drag on screen)"
        >
          <Crop className="w-4 h-4" />
          <span>Rectangle</span>
        </button>

        {/* Tool 2: Active Window Snip */}
        <button
          type="button"
          disabled={isCapturing}
          onClick={() => {
            setActiveTool('window');
            handleDirectCapture('window', delayTimer);
          }}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTool === 'window'
              ? 'bg-[#ff5200] text-white shadow-xs'
              : 'text-[#282b29] hover:bg-black/5'
          }`}
          title="Snap Foreground Application Window"
        >
          <AppWindow className="w-4 h-4" />
          <span>Window</span>
        </button>

        {/* Tool 3: Full Screen Snip */}
        <button
          type="button"
          disabled={isCapturing}
          onClick={() => {
            setActiveTool('screen');
            handleDirectCapture('screen', delayTimer);
          }}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTool === 'screen'
              ? 'bg-[#ff5200] text-white shadow-xs'
              : 'text-[#282b29] hover:bg-black/5'
          }`}
          title="Snap Entire Display"
        >
          <Monitor className="w-4 h-4" />
          <span>Full Screen</span>
        </button>

        {/* Tool 4: Long Screenshot (Auto-Scrolling Current Window) */}
        <button
          type="button"
          disabled={isCapturing}
          onClick={() => {
            setActiveTool('scroll');
            handleScrollCapture();
          }}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTool === 'scroll'
              ? 'bg-[#ff5200] text-white shadow-xs'
              : 'text-[#282b29] hover:bg-black/5'
          }`}
          title="Auto-scroll active window and capture full page (No URL needed)"
        >
          <Scroll className="w-4 h-4 text-[#ff5200] group-hover:text-white" />
          <span>Long Screenshot</span>
        </button>

        {/* Divider */}
        <div className="w-[1px] h-5 bg-black/10 mx-1" />

        {/* Tool 5: Delay Timer */}
        <button
          type="button"
          onClick={() => setDelayTimer((prev) => (prev === 0 ? 3000 : 0))}
          className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
            delayTimer > 0
              ? 'bg-amber-100 text-amber-800 border border-amber-300'
              : 'text-[#5d655f] hover:bg-black/5'
          }`}
          title="Toggle 3s countdown delay"
        >
          <Timer className="w-4 h-4" />
          <span>{delayTimer > 0 ? '3s' : 'No delay'}</span>
        </button>

        {/* Tool 6: Cancel / Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="p-2 rounded-xl text-[#767d78] hover:text-black hover:bg-black/10 transition-colors ml-0.5"
          title="Close (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Loading Indicator */}
      {isCapturing && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-black/85 backdrop-blur-md text-white text-xs px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2.5 pointer-events-none z-[1000000]">
          <Loader2 className="w-4 h-4 text-[#ff5200] animate-spin" />
          <span className="font-semibold">{statusText || 'Capturing display...'}</span>
        </div>
      )}

      {/* Live Rectangular Selection Box */}
      {dragStart && dragCurrent && boxWidth > 2 && (
        <div
          className="absolute border-2 border-[#ff5200] bg-transparent shadow-[0_0_0_99999px_rgba(0,0,0,0.40)] pointer-events-none rounded-xs"
          style={{
            left: `${boxLeft}px`,
            top: `${boxTop}px`,
            width: `${boxWidth}px`,
            height: `${boxHeight}px`,
          }}
        >
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-[#ff5200] text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow">
            {Math.round(boxWidth)} × {Math.round(boxHeight)} px
          </div>
        </div>
      )}

      {/* Subtle Hint */}
      {!dragStart && !isCapturing && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-xs text-white/90 text-xs px-3.5 py-1.5 rounded-full pointer-events-none">
          Click and drag to snip · Press <kbd className="font-mono bg-white/20 px-1 py-0.2 rounded font-bold">Esc</kbd> to cancel
        </div>
      )}
    </div>
  );
};
