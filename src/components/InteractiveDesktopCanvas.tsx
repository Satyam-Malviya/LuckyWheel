import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FolderOpen,
  CheckCircle2,
  Sparkles,
  QrCode,
  X,
} from 'lucide-react';
import {
  WheelMode,
  WheelPetalItem,
  WheelTheme,
  getWheelPetals,
} from '../data/catalog';
import { RadialWheel, getPetalIndexAtOffset, type SubMenuState } from './RadialWheel';
import { soundEngine } from '../utils/sound';

export interface PlaygroundFileItem {
  id: string;
  name: string;
  format: string;
  x: number;
  y: number;
  iconSrc: string;
  realPath?: string;
  isCreatedOutput?: boolean;
}

interface InteractiveDesktopCanvasProps {
  theme: WheelTheme;
  customPetals: WheelPetalItem[];
  onPinToShelf: (files: PlaygroundFileItem[]) => void;
  externalTriggerPetalId?: string | null;
  onClearExternalTrigger?: () => void;
}

const INITIAL_SCENE_FILES: PlaygroundFileItem[] = [
  { id: 'landscape', name: 'landscape.jpg', format: 'jpg', x: 26, y: 34, iconSrc: './assets/icons/photo-thumbnail.png' },
  { id: 'mixtape', name: 'mixtape.mp3', format: 'mp3', x: 63, y: 28, iconSrc: './assets/icons/mp3.png' },
  { id: 'weekend', name: 'weekend.mov', format: 'mov', x: 77, y: 48, iconSrc: './assets/icons/mov.png' },
  { id: 'notes', name: 'field-notes.pdf', format: 'pdf', x: 45, y: 46, iconSrc: './assets/icons/pdf.png' },
  { id: 'figures', name: 'figures.png', format: 'png', x: 18, y: 62, iconSrc: './assets/icons/photo-martin.png' },
  { id: 'holiday', name: 'holiday.heic', format: 'heic', x: 60, y: 66, iconSrc: './assets/icons/photo-johannes.png' },
  { id: 'project', name: 'little-project.zip', format: 'zip', x: 34, y: 72, iconSrc: './assets/icons/zip.png' },
  { id: 'downloads', name: 'Downloads', format: 'folder', x: 82, y: 72, iconSrc: './assets/icons/folder.png' },
];

export function getIconForFormat(format: string): string {
  const f = format.toLowerCase();
  if (['jpg', 'jpeg'].includes(f)) return './assets/icons/jpg.png';
  if (['png', 'webp', 'avif', 'svg'].includes(f)) return './assets/icons/png.png';
  if (f === 'heic') return './assets/icons/heic.png';
  if (['mp3', 'wav', 'flac', 'm4a', 'ogg'].includes(f)) return './assets/icons/mp3.png';
  if (['mov'].includes(f)) return './assets/icons/mov.png';
  if (['mp4', 'mkv', 'webm', 'avi', 'gif'].includes(f)) return './assets/icons/mp4.png';
  if (f === 'pdf') return './assets/icons/pdf.png';
  if (['docx', 'doc', 'md'].includes(f)) return './assets/icons/docx.png';
  if (['txt', 'srt', 'vtt', 'json', 'csv'].includes(f)) return './assets/icons/txt.png';
  if (f === 'folder') return './assets/icons/folder.png';
  return './assets/icons/zip.png';
}

export const InteractiveDesktopCanvas: React.FC<InteractiveDesktopCanvasProps> = ({
  theme,
  customPetals,
  onPinToShelf,
  externalTriggerPetalId,
  onClearExternalTrigger,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileNodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const cursorRef = useRef<{ x: number; y: number }>({ x: 420, y: 280 });
  const wheelPosRef = useRef<{ x: number; y: number }>({ x: 420, y: 280 });
  const dragStateRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const keyDownTimeRef = useRef<number>(0);
  const pointerMovedWhileWheelOpenRef = useRef<boolean>(false);

  const [files, setFiles] = useState<PlaygroundFileItem[]>(INITIAL_SCENE_FILES);
  const [selectedIds, setSelectedIds] = useState<string[]>(['landscape']);
  const [wheelOpen, setWheelOpen] = useState<boolean>(false);
  const [wheelPos, setWheelPos] = useState<{ x: number; y: number }>({ x: 420, y: 280 });
  const [wheelMode, setWheelMode] = useState<WheelMode>('conversions');
  const [hoveredPetalIdx, setHoveredPetalIdx] = useState<number | null>(null);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [isDraggingOverCanvas, setIsDraggingOverCanvas] = useState<boolean>(false);
  const subMenuRef = useRef<SubMenuState | null>(null);
  const handleSubMenuState = useCallback((s: SubMenuState | null) => {
    subMenuRef.current = s;
  }, []);

  const [toast, setToast] = useState<{
    busy: boolean;
    text: string;
    outputPath?: string;
  } | null>(null);

  const [qrModal, setQrModal] = useState<{
    fileName: string;
    url: string;
    qrDataUrl?: string;
  } | null>(null);

  const selectedFiles = files.filter((f) => selectedIds.includes(f.id));
  const activeFormats = selectedFiles.map((f) => f.format);
  const petals = getWheelPetals(activeFormats, wheelMode, customPetals).slice(0, 9);

  const handleTriggerPetal = useCallback(
    async (
      item: WheelPetalItem,
      presetValue?: string | number,
      extraOptions?: Record<string, any>
    ) => {
      setWheelOpen(false);
      setIsDraggingFile(false);
      setHoveredPetalIdx(null);
      if (!selectedFiles.length) return;

      const primary = selectedFiles[0];
      const api = (window as unknown as { orbitAPI?: Record<string, any> }).orbitAPI;

      if (item.id === 'floatShelf') {
        onPinToShelf(selectedFiles);
        setToast({ busy: false, text: `Pinned ${selectedFiles.length} file(s) to Floating Shelf` });
        setTimeout(() => setToast(null), 3000);
        return;
      }

      if (item.id === 'wifiQrShare') {
        if (primary.realPath && api?.createWifiShare) {
          const qrInfo = await api.createWifiShare(primary.realPath);
          if (qrInfo) {
            setQrModal(qrInfo);
            return;
          }
        }
        setQrModal({
          fileName: primary.name,
          url: `http://192.168.1.42:54120/share/${encodeURIComponent(primary.name)}`,
        });
        return;
      }

      if (item.id === 'copyPath') {
        const textToCopy = selectedFiles.map((f) => f.realPath || `~/Desktop/${f.name}`).join('\n');
        await api?.copyToClipboard?.(textToCopy);
        setToast({ busy: false, text: `Copied path to clipboard` });
        setTimeout(() => setToast(null), 2800);
        return;
      }

      if (item.id === 'openTerminal' && primary.realPath && api?.openInTerminal) {
        await api.openInTerminal(primary.realPath);
        return;
      }

      if (item.id === 'revealExplorer' && primary.realPath && api?.revealInExplorer) {
        await api.revealInExplorer(primary.realPath);
        return;
      }

      // Real PC File Execution
      const realPaths = selectedFiles.map((f) => f.realPath).filter(Boolean) as string[];
      if (realPaths.length > 0 && api?.processFiles) {
        setToast({ busy: true, text: `Making ${item.fullName}...` });
        const options: Record<string, any> = { ...(extraOptions || {}) };
        if (item.id === 'exactKb') options.targetKb = Number(presetValue) || 45;
        if (item.id === 'changeVideoSpeed') options.speed = Number(presetValue) || 2.0;
        if (item.id === 'trimVideo' && !options.trimDuration) {
          options.trimDuration = Number(presetValue) || 10;
        }
        if (item.id === 'passportPhoto') options.bgColor = String(presetValue || '#ffffff');
        if (item.id === 'bulkRename') options.renamePattern = String(presetValue || 'LuckyWheel_{n}');

        const res = await api.processFiles({
          files: realPaths,
          mode: wheelMode,
          actionId: item.id,
          options,
        });

        soundEngine.playDropConfirm();
        const firstOut = res.outputs?.[0];
        setToast({
          busy: false,
          text: res.message || 'Done — saved right beside original!',
          outputPath: firstOut,
        });
        return;
      }

      // Scenic Desktop Playground Instant Conversion
      const baseNoExt = primary.name.replace(/\.[^.]+$/, '');
      const outExt =
        wheelMode === 'conversions'
          ? item.id
          : item.id === 'createPDF' || item.id === 'mergePDF'
          ? 'pdf'
          : item.id === 'audioToVideo' || item.id === 'comboVideoAudio' || item.id === 'comboAudioImage'
          ? 'mp4'
          : item.id === 'createCollage' || item.id === 'videoSnapshots'
          ? 'png'
          : item.id === 'packZip'
          ? 'zip'
          : primary.format;

      const outName =
        wheelMode === 'conversions'
          ? `${baseNoExt}.${outExt}`
          : `${baseNoExt} ${item.label}${presetValue ? ` ${presetValue}` : ''}.${outExt}`;

      soundEngine.playDropConfirm();
      const newFile: PlaygroundFileItem = {
        id: `converted_${Date.now()}`,
        name: outName,
        format: outExt,
        x: Math.min(84, Math.max(16, primary.x + 10)),
        y: Math.min(76, Math.max(24, primary.y + 7)),
        iconSrc:
          ['jpg', 'png', 'webp', 'heic', 'avif'].includes(outExt) && primary.iconSrc.includes('photo-')
            ? primary.iconSrc
            : getIconForFormat(outExt),
        isCreatedOutput: true,
      };
      setFiles((prev) => [...prev, newFile]);
      setSelectedIds([newFile.id]);
      setToast({ busy: false, text: `${outName} — created instantly.` });
      setTimeout(() => setToast(null), 2800);
    },
    [selectedFiles, wheelMode, onPinToShelf]
  );

  // Keyboard listener for Shift / Alt / Ctrl with e.repeat guard (NO buzzing sound!)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      let nextMode: WheelMode | null = null;
      if (e.key === 'Shift') nextMode = 'conversions';
      else if (e.key === 'Alt' || e.key === 'Meta') nextMode = 'tools';
      else if (e.key === 'Control') nextMode = 'actions';
      else if (e.key === 'Escape' && wheelOpen) {
        setWheelOpen(false);
        setIsDraggingFile(false);
        setHoveredPetalIdx(null);
        return;
      }

      if (nextMode) {
        e.preventDefault();
        keyDownTimeRef.current = performance.now();
        pointerMovedWhileWheelOpenRef.current = false;
        soundEngine.playWheelBloom(nextMode);
        setWheelMode(nextMode);
        setHasInteracted(true);

        if (!wheelOpen) {
          const nextPos = {
            x: Math.min(Math.max(155, cursorRef.current.x), (containerRef.current?.clientWidth || 1000) - 155),
            y: Math.min(Math.max(155, cursorRef.current.y), (containerRef.current?.clientHeight || 640) - 155),
          };
          wheelPosRef.current = nextPos;
          setWheelPos(nextPos);
          setHoveredPetalIdx(null);
          setWheelOpen(true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!wheelOpen) return;
      if (['Shift', 'Alt', 'Meta', 'Control'].includes(e.key)) {
        const heldMs = performance.now() - keyDownTimeRef.current;
        if (heldMs > 160 && pointerMovedWhileWheelOpenRef.current && hoveredPetalIdx !== null && petals[hoveredPetalIdx]) {
          const target = petals[hoveredPetalIdx];
          // Keep wheel open if this option has sub-options (Speed, Trim, Exact KB, Passport, Rename)
          if (target.presets || target.id === 'trimVideo') return;
          handleTriggerPetal(target);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [wheelOpen, hoveredPetalIdx, petals, handleTriggerPetal]);

  // 120FPS Native Pointer Tracking
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        cursorRef.current = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
      }

      const drag = dragStateRef.current;
      if (drag && rect) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (!drag.moved && Math.hypot(dx, dy) > 4) {
          drag.moved = true;
          setHasInteracted(true);
          setIsDraggingFile(true);
        }
        if (drag.moved) {
          const el = fileNodeRefs.current[drag.id];
          if (el) {
            el.style.transform = `translate3d(calc(-50% + ${dx}px), calc(-50% + ${dy}px), 0)`;
          }
          if (!wheelOpen) {
            wheelPosRef.current = {
              x: Math.min(rect.width - 155, Math.max(155, e.clientX - rect.left)),
              y: Math.min(rect.height - 155, Math.max(155, e.clientY - rect.top)),
            };
          }
        }
      }

      // Instantaneous O(1) mathematical petal hit-testing when wheel is open
      if (wheelOpen && rect) {
        const relX = e.clientX - rect.left - wheelPosRef.current.x;
        const relY = e.clientY - rect.top - wheelPosRef.current.y;
        if (Math.hypot(relX, relY) > 18) {
          pointerMovedWhileWheelOpenRef.current = true;
        }
        const sub = subMenuRef.current;
        if (sub && (sub.locked || (Math.abs(relX) <= sub.halfW && Math.abs(relY) <= sub.halfH))) return;
        const hitIdx = getPetalIndexAtOffset(relX, relY, petals.length);
        // Only change hoveredPetalIdx when cursor is inside the petal ring (47..124px)!
        if (hitIdx !== null) {
          setHoveredPetalIdx((prev) => {
            if (prev !== hitIdx) {
              soundEngine.playPetalTick(hitIdx, petals.length);
            }
            return hitIdx;
          });
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const drag = dragStateRef.current;
      const rect = containerRef.current?.getBoundingClientRect();

      if (drag) {
        const el = fileNodeRefs.current[drag.id];
        if (el) {
          el.style.transform = 'translate3d(-50%, -50%, 0)';
        }

        if (wheelOpen && hoveredPetalIdx !== null && petals[hoveredPetalIdx]) {
          dragStateRef.current = null;
          setIsDraggingFile(false);
          const target = petals[hoveredPetalIdx];
          if (!target.presets && target.id !== 'trimVideo') {
            handleTriggerPetal(target);
          }
          return;
        }

        if (drag.moved && rect) {
          const dxPct = ((e.clientX - drag.startX) / rect.width) * 100;
          const dyPct = ((e.clientY - drag.startY) / rect.height) * 100;
          setFiles((prev) =>
            prev.map((f) =>
              f.id === drag.id
                ? {
                    ...f,
                    x: Math.min(90, Math.max(10, drag.origX + dxPct)),
                    y: Math.min(82, Math.max(18, drag.origY + dyPct)),
                  }
                : f
            )
          );
        }
        dragStateRef.current = null;
        setIsDraggingFile(false);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [wheelOpen, hoveredPetalIdx, petals, handleTriggerPetal]);

  // Listen to Electron Progress
  useEffect(() => {
    const api = (window as unknown as { orbitAPI?: Record<string, any> }).orbitAPI;
    if (!api) return;
    const unsubProgress = api.onProgress?.((data: { progress: number; statusText: string }) => {
      setToast((prev) => (prev ? { ...prev, text: data.statusText } : null));
    });
    return () => {
      unsubProgress?.();
    };
  }, []);

  useEffect(() => {
    if (externalTriggerPetalId) {
      setWheelMode('tools');
      setWheelOpen(true);
      setHasInteracted(true);
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const centerPos = { x: rect.width / 2, y: rect.height / 2 };
        wheelPosRef.current = centerPos;
        setWheelPos(centerPos);
      }
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onClearExternalTrigger?.();
    }
  }, [externalTriggerPetalId]);

  const importRealFilePaths = (filePaths: string[], autoOpen = true) => {
    if (!filePaths.length) return;
    const newItems: PlaygroundFileItem[] = filePaths.map((fp, i) => {
      const base = fp.split(/[\\/]/).pop() || 'file';
      const dotIdx = base.lastIndexOf('.');
      const ext = dotIdx > 0 ? base.slice(dotIdx + 1).toLowerCase() : 'folder';
      return {
        id: `real_${Date.now()}_${i}`,
        name: base,
        format: ext,
        x: Math.min(80, Math.max(20, 35 + (i * 14) % 45)),
        y: Math.min(72, Math.max(28, 45 + ((i * 11) % 25))),
        iconSrc: getIconForFormat(ext),
        realPath: fp,
      };
    });

    setFiles((prev) => [...prev, ...newItems]);
    setSelectedIds(newItems.map((n) => n.id));
    setHasInteracted(true);
    if (autoOpen) {
      soundEngine.playWheelBloom(newItems.length > 1 ? 'tools' : 'conversions');
      setWheelMode(newItems.length > 1 ? 'tools' : 'conversions');
      setWheelOpen(true);
    }
  };

  const handleBrowseRealFiles = async (directory = false) => {
    const api = (window as unknown as { orbitAPI?: Record<string, any> }).orbitAPI;
    if (api?.pickFiles) {
      const picked = await api.pickFiles({
        directory,
        title: directory ? 'Pick a Folder' : 'Pick Files for LuckyWheel',
      });
      if (picked && picked.length > 0) {
        importRealFilePaths(picked, true);
      }
    }
  };

  const handleDropRealFiles = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverCanvas(false);
    const api = (window as unknown as { orbitAPI?: Record<string, any> }).orbitAPI;
    const dropped = Array.from(e.dataTransfer.files);
    if (!dropped.length) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const nextPos = {
        x: Math.min(rect.width - 160, Math.max(160, e.clientX - rect.left)),
        y: Math.min(rect.height - 160, Math.max(160, e.clientY - rect.top)),
      };
      wheelPosRef.current = nextPos;
      setWheelPos(nextPos);
    }
    const paths = dropped.map((f) => api?.getPathForFile?.(f) || (f as any).path || f.name);
    importRealFilePaths(paths, true);
  };

  return (
    <div className="relative w-full">
      <div
        ref={containerRef}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOverCanvas(true);
        }}
        onDragLeave={() => setIsDraggingOverCanvas(false)}
        onDrop={handleDropRealFiles}
        onClick={() => {
          if (wheelOpen) {
            setWheelOpen(false);
            setHoveredPetalIdx(null);
          }
        }}
        className={`relative w-full h-[640px] overflow-hidden select-none transition-all ${
          isDraggingOverCanvas ? 'ring-4 ring-[#ff5200]/40' : ''
        }`}
        style={{ background: '#e2ecf0' }}
      >
        <img
          src="./assets/tree-sky.jpg"
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none select-none"
        />

        <div
          className="absolute top-0 left-0 right-0 h-36 pointer-events-none z-10"
          style={{
            background:
              'linear-gradient(#f4f4f4 0%, rgba(244,244,244,0.92) 14%, rgba(244,244,244,0.55) 45%, transparent 100%)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-44 pointer-events-none z-10"
          style={{
            background:
              'linear-gradient(to bottom, transparent 0%, rgba(244,244,244,0.55) 55%, rgba(244,244,244,0.95) 85%, #f4f4f4 100%)',
          }}
        />

        {!hasInteracted && (
          <div
            className="absolute z-20 pointer-events-none text-[#495447] font-handwriting text-[28px] leading-none text-center"
            style={{ left: 'calc(26% - 110px)', top: 'calc(34% - 140px)', width: 180 }}
          >
            <span className="block -rotate-6">Click or drag & tap Shift</span>
            <svg
              className="mt-1 overflow-visible fill-none stroke-current"
              width="180"
              height="110"
              viewBox="0 0 180 135"
              style={{ strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}
            >
              <path d="M133 10C140 45 76 71 22 94M22 94L29 79M22 94L39 94" />
            </svg>
          </div>
        )}

        {/* Floating "Tap Shift on your keyboard" 3D Keycap Prompt while dragging */}
        <AnimatePresence>
          {isDraggingFile && !wheelOpen && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08 }}
              style={{ left: wheelPosRef.current.x, top: Math.max(60, wheelPosRef.current.y - 115) }}
              className="absolute -translate-x-1/2 z-30 flex flex-col items-center gap-2.5 pointer-events-none"
            >
              <p className="text-xs font-medium text-[#42503f] bg-white/85 backdrop-blur-md px-3 py-1 rounded-full shadow-sm">
                Tap Shift on your keyboard
              </p>
              <div className="tactile-keycap animate-key-press">
                <span className="text-xl leading-none">⇧</span>
                <span>shift</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Minimalist Status Pill (Top Center) */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.1 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute top-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/95 backdrop-blur-xl border border-black/10 shadow-lg text-xs font-medium text-[#282b29]"
            >
              {toast.busy ? (
                <Sparkles className="w-3.5 h-3.5 text-[#ff5200] animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#ff5200]" />
              )}
              <span>{toast.text}</span>
              {toast.outputPath && (
                <button
                  type="button"
                  onClick={() => {
                    const api = (window as unknown as { orbitAPI?: Record<string, any> }).orbitAPI;
                    api?.revealInExplorer?.(toast.outputPath);
                  }}
                  className="ml-1 px-2.5 py-0.5 rounded-full bg-[#ff5200] text-white text-[11px] font-semibold"
                >
                  Reveal in Explorer
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Desktop Files on Scenic Stage (Zero-Lag Native Pointer Transforms) */}
        <div className="relative w-full max-w-[1200px] h-full mx-auto z-20">
          {files.map((file) => {
            const isSelected = selectedIds.includes(file.id);
            return (
              <div
                key={file.id}
                ref={(el) => {
                  fileNodeRefs.current[file.id] = el;
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setHasInteracted(true);
                  if (e.ctrlKey || e.metaKey) {
                    setSelectedIds((prev) =>
                      prev.includes(file.id)
                        ? prev.filter((id) => id !== file.id)
                        : [...prev, file.id]
                    );
                  } else if (!selectedIds.includes(file.id)) {
                    setSelectedIds([file.id]);
                  }

                  if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    const pos = {
                      x: Math.min(rect.width - 155, Math.max(155, e.clientX - rect.left)),
                      y: Math.min(rect.height - 155, Math.max(155, e.clientY - rect.top)),
                    };
                    cursorRef.current = pos;
                    if (!wheelOpen) {
                      wheelPosRef.current = pos;
                      setWheelPos(pos);
                    }
                  }

                  dragStateRef.current = {
                    id: file.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    origX: file.x,
                    origY: file.y,
                    moved: false,
                  };
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  soundEngine.playWheelBloom('conversions');
                  setWheelMode('conversions');
                  setWheelOpen(true);
                }}
                style={{
                  left: `${file.x}%`,
                  top: `${file.y}%`,
                  transform: 'translate3d(-50%, -50%, 0)',
                }}
                className="absolute w-[116px] py-1 flex flex-col items-center cursor-default select-none group will-change-transform"
              >
                <div
                  className={`w-[72px] h-[72px] rounded-[6px] flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-[#263a50]/18' : 'group-hover:bg-black/5'
                  }`}
                >
                  <img
                    src={file.iconSrc}
                    alt={file.name}
                    draggable={false}
                    className="w-16 h-16 object-contain pointer-events-none drop-shadow-sm"
                  />
                </div>
                <span
                  className={`mt-0.5 px-1.5 py-0.5 rounded-[4px] text-[12px] font-medium leading-[16px] max-w-[116px] truncate ${
                    isSelected
                      ? 'bg-[#0063d9] text-white shadow-none'
                      : 'text-white [text-shadow:0_1px_3px_rgba(36,50,61,0.85),0_0_1px_rgba(36,50,61,0.6)]'
                  }`}
                >
                  {file.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Minimalist Frosted Glass Floating Dock at Bottom of Scene */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-wrap items-center justify-center gap-2 px-3.5 py-2 rounded-2xl bg-white/85 backdrop-blur-2xl border border-white/95 shadow-[0_8px_32px_rgba(36,50,61,0.12)]"
        >
          <button
            type="button"
            onClick={() => {
              setHasInteracted(true);
              soundEngine.playWheelBloom('conversions');
              setWheelMode('conversions');
              setWheelOpen(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              wheelOpen && wheelMode === 'conversions'
                ? 'bg-[#ff5200] text-white shadow-sm'
                : 'bg-black/5 hover:bg-black/10 text-[#282b29]'
            }`}
          >
            <kbd className="text-[10px] opacity-80">⇧</kbd>
            <span>Convert</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setHasInteracted(true);
              soundEngine.playWheelBloom('tools');
              setWheelMode('tools');
              setWheelOpen(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              wheelOpen && wheelMode === 'tools'
                ? 'bg-[#ff5200] text-white shadow-sm'
                : 'bg-black/5 hover:bg-black/10 text-[#282b29]'
            }`}
          >
            <kbd className="text-[10px] opacity-80">⌥</kbd>
            <span>Tools</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setHasInteracted(true);
              soundEngine.playWheelBloom('actions');
              setWheelMode('actions');
              setWheelOpen(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              wheelOpen && wheelMode === 'actions'
                ? 'bg-[#ff5200] text-white shadow-sm'
                : 'bg-black/5 hover:bg-black/10 text-[#282b29]'
            }`}
          >
            <kbd className="text-[10px] opacity-80">⌃</kbd>
            <span>Actions</span>
          </button>

          <div className="h-4 w-[1px] bg-black/10 mx-1" />

          <button
            type="button"
            onClick={() => {
              setHasInteracted(true);
              soundEngine.playWheelBloom('combo');
              setSelectedIds(['weekend', 'mixtape']);
              setWheelMode('tools');
              setWheelOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-black/5 hover:bg-black/10 text-xs font-medium text-[#282b29] transition-colors"
            title="Select Video + Audio together to see Multi-File Combo Wheel"
          >
            ✦ Multi-File Combo ({selectedFiles.length})
          </button>

          <div className="h-4 w-[1px] bg-black/10 mx-1" />

          <button
            type="button"
            onClick={() => handleBrowseRealFiles(false)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#282b29] hover:bg-black text-white text-xs font-medium transition-colors shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Open PC Files</span>
          </button>

          <button
            type="button"
            onClick={() => handleBrowseRealFiles(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-black/5 hover:bg-black/10 text-xs font-medium text-[#282b29] transition-colors"
            title="Pick a Folder to Auto-Organize or Scan Duplicates"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Authentic Frosted Glass Radial Wheel Overlay */}
        <AnimatePresence>
          {wheelOpen && (
            <div
              style={{ left: wheelPos.x, top: wheelPos.y }}
              onClick={(e) => e.stopPropagation()}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-30"
            >
              <RadialWheel
                onSubMenuStateChange={handleSubMenuState}
                items={petals}
                mode={wheelMode}
                selectedIndex={hoveredPetalIdx}
                onSelectIndex={setHoveredPetalIdx}
                onTriggerItem={handleTriggerPetal}
                onSwitchMode={(m) => {
                  setWheelMode(m);
                  setHoveredPetalIdx(null);
                }}
                theme={theme}
                size={272}
                sourceLabel={selectedFiles[0]?.name}
              />
            </div>
          )}
        </AnimatePresence>

        {/* Minimalist Glass Wi-Fi QR Popover */}
        <AnimatePresence>
          {qrModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQrModal(null)}
              className="absolute inset-0 z-50 bg-black/25 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.92, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.92, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-xs rounded-[24px] bg-white/95 backdrop-blur-2xl border border-black/10 p-6 text-center space-y-4 shadow-2xl"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#ff5200]">Phone Wi-Fi Transfer</span>
                  <button
                    type="button"
                    onClick={() => setQrModal(null)}
                    className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center text-[#767d78] hover:text-black"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mx-auto w-44 h-44 rounded-2xl bg-[#f4f4f4] p-3 flex items-center justify-center">
                  {qrModal.qrDataUrl ? (
                    <img src={qrModal.qrDataUrl} alt="QR" className="w-full h-full rounded-lg" />
                  ) : (
                    <QrCode className="w-32 h-32 text-[#282b29]" />
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-[#282b29]">{qrModal.fileName}</h4>
                  <p className="text-xs text-[#767d78] mt-1">
                    Scan with your phone camera on the same Wi-Fi to download directly.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
