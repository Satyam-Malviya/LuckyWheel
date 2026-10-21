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
  ChevronDown,
  Sliders,
  Hand,
  Play,
  Camera,
} from 'lucide-react';
import { soundEngine } from '../utils/sound';

export interface ScreenSnipStudioProps {
  currentDir?: string;
  initialBgPath?: string;
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
  initialBgPath = '',
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

  // Desktop Frozen Snapshot for True Windows Snipping Tool UX
  const [desktopBgUrl, setDesktopBgUrl] = useState<string>('');
  const fullDesktopPathRef = useRef<string | null>(null);

  // Long Screenshot Configuration & Modes
  const [showScrollMenu, setShowScrollMenu] = useState(false);
  const [scrollDepth, setScrollDepth] = useState<number>(15); // 5, 15, 30, 50
  const [isManualScrollMode, setIsManualScrollMode] = useState(false);
  const [isSectionSnapping, setIsSectionSnapping] = useState(false);
  const [manualFrames, setManualFrames] = useState<string[]>([]);
  const scrollDebounceRef = useRef<any>(null);

  // Drag selection state for Rectangular Snip
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);

  const api = (window as unknown as { orbitAPI?: Record<string, any> }).orbitAPI;

  const formatFileUrl = (p: string) => {
    if (!p) return '';
    if (p.startsWith('file://')) return p;
    return 'file:///' + p.replace(/\\/g, '/');
  };

  const handleClose = () => {
    if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    if (onClose) onClose();
    api?.closeSnipWindow?.();
  };

  // Keyboard shortcut listener: ESC to cancel, Space to snap section in manual scroll mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (isManualScrollMode) {
          cancelManualScroll();
        } else if (capturedSnip) {
          handleClose();
        } else {
          handleClose();
        }
      } else if (e.code === 'Space' && isManualScrollMode) {
        e.preventDefault();
        e.stopPropagation();
        snapManualSection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isManualScrollMode, capturedSnip]);

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

  // Load Initial Background Image or Capture Desktop Snapshot
  useEffect(() => {
    let isMounted = true;
    const searchParams = new URLSearchParams(window.location.search);
    const bgParam = initialBgPath || searchParams.get('bg') || '';

    if (bgParam) {
      fullDesktopPathRef.current = bgParam;
      setDesktopBgUrl(formatFileUrl(bgParam));
    } else {
      const initSnapshot = async () => {
        try {
          const res = await api?.captureScreen?.({ mode: 'screen', delayMs: 20 });
          if (isMounted && res && res.success && res.filePath) {
            fullDesktopPathRef.current = res.filePath;
            setDesktopBgUrl(formatFileUrl(res.filePath));
          }
        } catch {}
      };
      initSnapshot();
    }

    return () => { isMounted = false; };
  }, [initialBgPath]);

  // Perform Rectangular Crop
  const finishRectSnip = async (box: { x: number; y: number; w: number; h: number }) => {
    if (box.w < 15 || box.h < 15) return;
    setIsCapturing(true);
    setStatusText('Cropping selection...');
    try {
      const dpr = window.devicePixelRatio || 1;
      const physicalRect = {
        x: Math.round(box.x * dpr),
        y: Math.round(box.y * dpr),
        width: Math.round(box.w * dpr),
        height: Math.round(box.h * dpr),
      };

      let cropRes: any = null;
      if (fullDesktopPathRef.current && api?.cropScreenshot) {
        cropRes = await api.cropScreenshot({
          sourcePath: fullDesktopPathRef.current,
          rect: physicalRect,
        });
      } else {
        cropRes = await api?.captureScreen?.({
          mode: 'region',
          region: physicalRect,
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

  // Perform Long Screenshot (Auto-Scrolling with configurable depth)
  const handleAutoScrollCapture = async (depth: number) => {
    setShowScrollMenu(false);
    setIsCapturing(true);
    setStatusText(`Auto-scrolling active window (${depth} scrolls)...`);
    setErrorMessage(null);
    try {
      const res = await api?.captureScreen?.({ mode: 'scroll', maxScrolls: depth, delayMs: 80 });
      if (res && res.success && res.filePath) {
        soundEngine.playDropConfirm();
        setCapturedSnip(res);
        api?.saveScreenshot?.({
          sourcePath: res.filePath,
          format: 'clipboard',
          destinations: [],
        });
      } else {
        setErrorMessage(res?.message || 'Long screenshot failed. Ensure a scrollable window is active.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Scrolling capture error');
    } finally {
      setIsCapturing(false);
      setStatusText('');
    }
  };

  // Snap a single section cleanly (used on scroll pause or Space/button click)
  const snapManualSection = async () => {
    if (isSectionSnapping || isCapturing) return;
    setIsSectionSnapping(true);
    try {
      const frame = await api?.captureScreen?.({ mode: 'window', delayMs: 40 });
      if (frame && frame.success && frame.filePath) {
        soundEngine.playPetalTick(4, 8);
        setManualFrames((prev) => [...prev, frame.filePath]);
      }
    } catch {}
    finally {
      setIsSectionSnapping(false);
    }
  };

  // Manual Scroll Capture Mode ("User manual scroll kare")
  const startManualScrollMode = () => {
    setShowScrollMenu(false);
    setIsManualScrollMode(true);
    setManualFrames([]);
    setStatusText('Scroll freely. Snap sections as you scroll...');

    // Take initial snapshot
    api?.captureScreen?.({ mode: 'window', delayMs: 50 }).then((res: any) => {
      if (res && res.success && res.filePath) {
        setManualFrames([res.filePath]);
      }
    });
  };

  // Listen to wheel events on window during manual scroll mode:
  // When scrolling stops (550ms debounce), automatically capture next section!
  useEffect(() => {
    if (!isManualScrollMode) return;

    const handleWheel = () => {
      if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
      scrollDebounceRef.current = setTimeout(() => {
        snapManualSection();
      }, 550);
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      window.removeEventListener('wheel', handleWheel);
      if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    };
  }, [isManualScrollMode]);

  const finishManualScroll = async () => {
    if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    setIsCapturing(true);
    setStatusText('Stitching all scrolled frames into full image...');
    try {
      if (manualFrames.length === 0) {
        setIsManualScrollMode(false);
        setIsCapturing(false);
        return;
      }
      const res = await api?.stitchScreenshots?.({ framePaths: manualFrames });
      if (res && res.success && res.filePath) {
        soundEngine.playDropConfirm();
        setCapturedSnip(res);
        api?.saveScreenshot?.({
          sourcePath: res.filePath,
          format: 'clipboard',
          destinations: [],
        });
      } else {
        setErrorMessage(res?.message || 'Failed to stitch manual scroll frames.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Stitching error');
    } finally {
      setIsCapturing(false);
      setIsManualScrollMode(false);
      setManualFrames([]);
      setStatusText('');
    }
  };

  const cancelManualScroll = () => {
    if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    setIsManualScrollMode(false);
    setManualFrames([]);
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
  // VIEW 1: Manual Scrolling Mode Floating Bar
  // ==========================================
  if (isManualScrollMode) {
    return (
      <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-[#1e211f]/95 backdrop-blur-2xl border border-white/20 text-white shadow-[0_20px_60px_rgba(0,0,0,0.6)] rounded-2xl px-5 py-3 flex items-center gap-3.5 z-[9999999] cursor-default select-none animate-fade-in">
        <span className={`w-3 h-3 rounded-full ${isSectionSnapping ? 'bg-amber-400 animate-ping' : 'bg-emerald-500'}`} />
        <div className="text-xs font-semibold flex items-center gap-1.5">
          <span>Manual Scroll: Scroll & pause, or Snap</span>
          <span className="font-mono text-amber-300 font-bold bg-white/10 px-2 py-0.5 rounded">
            {manualFrames.length} {manualFrames.length === 1 ? 'section' : 'sections'}
          </span>
        </div>

        {/* Snap current section button */}
        <button
          type="button"
          disabled={isSectionSnapping || isCapturing}
          onClick={snapManualSection}
          className="px-3 py-1.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-white/10 shadow-xs"
          title="Snap section now (or press Space)"
        >
          {isSectionSnapping ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" /> : <Camera className="w-3.5 h-3.5 text-amber-300" />}
          <span>Snap (Space)</span>
        </button>

        {/* Finish & Stitch button */}
        <button
          type="button"
          disabled={isCapturing || manualFrames.length < 1}
          onClick={finishManualScroll}
          className="px-4 py-1.5 bg-[#ff5200] hover:bg-[#e04800] active:scale-95 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
        >
          {isCapturing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          <span>Finish & Stitch</span>
        </button>

        {/* Cancel button */}
        <button
          type="button"
          onClick={cancelManualScroll}
          className="p-1.5 rounded-xl hover:bg-white/15 text-white/70 hover:text-white transition-colors"
          title="Cancel (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: Captured Snip Result Card
  // ==========================================
  if (capturedSnip) {
    return (
      <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs select-none">
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
          <div className="w-full h-48 rounded-2xl bg-[#f4f5f4] border border-black/10 flex items-center justify-center overflow-hidden p-2 relative">
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
            <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
              {errorMessage}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: True Windows Snipping Tool (Win + Shift + S) Full-Screen Experience
  // ==========================================
  const boxLeft = dragStart && dragCurrent ? Math.min(dragStart.x, dragCurrent.x) : 0;
  const boxTop = dragStart && dragCurrent ? Math.min(dragStart.y, dragCurrent.y) : 0;
  const boxWidth = dragStart && dragCurrent ? Math.abs(dragCurrent.x - dragStart.x) : 0;
  const boxHeight = dragStart && dragCurrent ? Math.abs(dragCurrent.y - dragStart.y) : 0;

  return (
    <div
      className="fixed inset-0 z-[999999] cursor-crosshair select-none overflow-hidden touch-none"
      onContextMenu={(e) => {
        // Right-click instantly cancels any ongoing drag
        e.preventDefault();
        setDragStart(null);
        setDragCurrent(null);
      }}
      onPointerDown={(e) => {
        if (isCapturing) return;
        if ((e.target as HTMLElement).closest('.snipping-toolbar') || (e.target as HTMLElement).closest('.scroll-menu')) {
          return;
        }
        if (e.button !== 0) return; // Only primary left click initiates snip
        setShowScrollMenu(false);
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
        const clampedX = Math.max(0, Math.min(window.innerWidth, e.clientX));
        const clampedY = Math.max(0, Math.min(window.innerHeight, e.clientY));
        setDragStart({ x: clampedX, y: clampedY });
        setDragCurrent({ x: clampedX, y: clampedY });
      }}
      onPointerMove={(e) => {
        if (dragStart) {
          const clampedX = Math.max(0, Math.min(window.innerWidth, e.clientX));
          const clampedY = Math.max(0, Math.min(window.innerHeight, e.clientY));
          setDragCurrent({ x: clampedX, y: clampedY });
        }
      }}
      onPointerUp={(e) => {
        if (dragStart && dragCurrent) {
          try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
          const finalBox = {
            x: boxLeft,
            y: boxTop,
            w: boxWidth,
            h: boxHeight,
          };
          // Immediately reset drag state so selection rectangle NEVER stays stuck
          setDragStart(null);
          setDragCurrent(null);
          if (finalBox.w > 15 && finalBox.h > 15) {
            finishRectSnip(finalBox);
          }
        } else {
          setDragStart(null);
          setDragCurrent(null);
        }
      }}
    >
      {/* 0. Live Frozen Desktop Image (Ensures 100% clarity, zero gray screen!) */}
      {desktopBgUrl ? (
        <img
          src={desktopBgUrl}
          alt="Frozen Desktop Snapshot"
          className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none z-0"
          draggable={false}
        />
      ) : null}

      {/* 0.5. Dimming Layer: When not dragging, uniform gentle dark tint */}
      {!dragStart && (
        <div className="absolute inset-0 bg-black/35 pointer-events-none z-[1]" />
      )}

      {/* 1. Sleek Windows Snipping Tool Top Center Bar */}
      <div
        className="snipping-toolbar absolute top-5 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-xl border border-black/15 shadow-[0_16px_36px_rgba(0,0,0,0.22)] rounded-2xl p-1.5 flex items-center gap-1 z-[1000000] cursor-default"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tool 1: Rectangular Snip (Default box drag) */}
        <button
          type="button"
          onClick={() => {
            setActiveTool('rect');
            setShowScrollMenu(false);
          }}
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
            setShowScrollMenu(false);
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
            setShowScrollMenu(false);
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

        {/* Tool 4: Long Screenshot with Configurable Depth & Manual Scroll */}
        <div className="relative">
          <button
            type="button"
            disabled={isCapturing}
            onClick={() => setShowScrollMenu((prev) => !prev)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTool === 'scroll' || showScrollMenu
                ? 'bg-[#ff5200] text-white shadow-xs'
                : 'text-[#282b29] hover:bg-black/5'
            }`}
            title="Auto-scroll active window or scroll manually"
          >
            <Scroll className="w-4 h-4" />
            <span>Long Screenshot</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-80" />
          </button>

          {/* Long Screenshot Menu Popover */}
          {showScrollMenu && (
            <div
              className="scroll-menu absolute top-full mt-2 left-0 w-64 bg-white/98 backdrop-blur-xl border border-black/15 shadow-2xl rounded-2xl p-3 z-[1000001] space-y-2.5 text-[#282b29] animate-fade-in"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Option A: Auto-Scroll with Depth Options */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-[#5d655f] uppercase tracking-wider flex items-center gap-1">
                  <Play className="w-3 h-3 text-[#ff5200]" />
                  <span>Auto-Scroll Depth:</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { depth: 5, label: '5x (Short)' },
                    { depth: 15, label: '15x (Standard)' },
                    { depth: 30, label: '30x (Deep)' },
                    { depth: 50, label: '50x (Full Page)' },
                  ].map((opt) => (
                    <button
                      key={opt.depth}
                      type="button"
                      onClick={() => {
                        setScrollDepth(opt.depth);
                        handleAutoScrollCapture(opt.depth);
                      }}
                      className={`p-1.5 rounded-lg border text-xs font-semibold transition-all text-left flex items-center justify-between ${
                        scrollDepth === opt.depth
                          ? 'border-[#ff5200] bg-orange-50 text-[#ff5200]'
                          : 'border-[#e2e6e2] bg-[#f7f8f7] text-[#282b29] hover:border-black/20'
                      }`}
                    >
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="w-full h-[1px] bg-black/10" />

              {/* Option B: Manual Scroll (User scrolls themselves) */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={startManualScrollMode}
                  className="w-full p-2 rounded-xl bg-[#282b29] hover:bg-black text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs"
                >
                  <Hand className="w-4 h-4 text-[#ff5200]" />
                  <span>Manual Scroll (Scroll Yourself)</span>
                </button>
                <p className="text-[9.5px] text-[#767d78] text-center leading-tight">
                  Scroll window at your own pace, then click Finish & Stitch
                </p>
              </div>
            </div>
          )}
        </div>

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

      {/* Live Rectangular Selection Cutout Box (100% bright inside, dimmed outside) */}
      {dragStart && dragCurrent && boxWidth > 2 && (
        <div
          className="absolute border-2 border-[#ff5200] bg-transparent pointer-events-none rounded-xs z-[10]"
          style={{
            left: `${boxLeft}px`,
            top: `${boxTop}px`,
            width: `${boxWidth}px`,
            height: `${boxHeight}px`,
            boxShadow: '0 0 0 99999px rgba(0, 0, 0, 0.45)', // Cutout mask
          }}
        >
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-[#ff5200] text-white text-[10px] font-mono font-bold px-2.5 py-0.5 rounded shadow whitespace-nowrap">
            {Math.round(boxWidth * (window.devicePixelRatio || 1))} × {Math.round(boxHeight * (window.devicePixelRatio || 1))} px
          </div>
        </div>
      )}

      {/* Subtle Hint */}
      {!dragStart && !isCapturing && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-xs text-white/90 text-xs px-3.5 py-1.5 rounded-full pointer-events-none z-[5]">
          Click and drag to snip · Press <kbd className="font-mono bg-white/20 px-1 py-0.2 rounded font-bold">Esc</kbd> to cancel
        </div>
      )}
    </div>
  );
};
