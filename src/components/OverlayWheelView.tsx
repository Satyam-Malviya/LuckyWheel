import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle2, Sparkles, QrCode, X } from 'lucide-react';
import {
  WheelMode,
  WheelPetalItem,
  WHEEL_THEMES,
  getWheelPetals,
} from '../data/catalog';
import { RadialWheel, getPetalIndexAtOffset, type SubMenuState } from './RadialWheel';
import { soundEngine } from '../utils/sound';

interface OverlayEventPayload {
  type: 'show' | 'mode' | 'move' | 'keyrelease' | 'mouseup' | 'mousedown' | 'hide';
  mode?: WheelMode;
  x?: number;
  y?: number;
  dipX?: number;
  dipY?: number;
  centerDipX?: number;
  centerDipY?: number;
  files?: string[];
  isDragging?: boolean;
}

export const OverlayWheelView: React.FC = () => {
  const [files, setFiles] = useState<string[]>([]);
  const [mode, setMode] = useState<WheelMode>('conversions');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [busyText, setBusyText] = useState<string | null>(null);
  const [doneText, setDoneText] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<{
    fileName: string;
    url: string;
    qrDataUrl?: string;
  } | null>(null);

  const centerDipRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointerMovedRef = useRef<boolean>(false);
  const showTimestampRef = useRef<number>(0);
  const isExecutingRef = useRef<boolean>(false);
  const subMenuRef = useRef<SubMenuState | null>(null);
  const handleSubMenuState = useCallback((s: SubMenuState | null) => {
    subMenuRef.current = s;
  }, []);
  // Bumped on every 'show' so the wheel remounts fresh (clears any locked sub-menu)
  const [showCount, setShowCount] = useState(0);

  const activeFormats = files.map((fp) => {
    const base = fp.split(/[\\/]/).pop() || '';
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.slice(dot + 1).toLowerCase() : 'folder';
  });

  const petals = getWheelPetals(
    activeFormats.length > 0 ? activeFormats : ['jpg'],
    mode,
    []
  ).slice(0, 9);

  const primaryFileName = files[0] ? files[0].split(/[\\/]/).pop() : '';

  const hideOverlayNow = useCallback(() => {
    const api = (window as unknown as { orbitAPI?: Record<string, any> }).orbitAPI;
    setHoveredIdx(null);
    setBusyText(null);
    setDoneText(null);
    setQrModal(null);
    isExecutingRef.current = false;
    subMenuRef.current = null;
    api?.hideOverlay?.();
  }, []);

  const executePetal = useCallback(
    async (
      item: WheelPetalItem,
      presetValue?: string | number,
      extraOptions?: Record<string, any>
    ) => {
      if (isExecutingRef.current || (!files.length && item.id !== 'downloadLink' && item.id !== 'screenCapture')) return;
      isExecutingRef.current = true;

      const api = (window as unknown as { orbitAPI?: Record<string, any> }).orbitAPI;
      const primary = files[0];

      if (item.id === 'downloadLink' || item.id === 'screenCapture') {
        isExecutingRef.current = false;
        return;
      }

      if (item.id === 'copyPath') {
        await api?.copyToClipboard?.(files.join('\n'));
        soundEngine.playDropConfirm();
        setDoneText('Copied path!');
        setTimeout(hideOverlayNow, 650);
        return;
      }

      if (item.id === 'openTerminal') {
        await api?.openInTerminal?.(primary);
        soundEngine.playDropConfirm();
        hideOverlayNow();
        return;
      }

      if (item.id === 'revealExplorer') {
        await api?.revealInExplorer?.(primary);
        soundEngine.playDropConfirm();
        hideOverlayNow();
        return;
      }

      if (item.id === 'wifiQrShare') {
        const qrInfo = await api?.createWifiShare?.(primary);
        if (qrInfo) {
          isExecutingRef.current = false;
          setQrModal(qrInfo);
          return;
        }
      }

      setBusyText(`Making ${item.label}…`);
      const options: Record<string, any> = { ...(extraOptions || {}) };
      if (item.id === 'exactKb') options.targetKb = Number(presetValue) || 45;
      if (item.id === 'changeVideoSpeed') options.speed = Number(presetValue) || 2.0;
      if (item.id === 'trimVideo' && !options.trimDuration) {
        options.trimDuration = Number(presetValue) || 10;
      }
      if (item.id === 'passportPhoto') options.bgColor = String(presetValue || '#ffffff');
      if (item.id === 'bulkRename') options.renamePattern = String(presetValue || 'LuckyWheel_{n}');

      try {
        const res = await api?.processFiles?.({
          files,
          mode,
          actionId: item.id,
          options,
        });

        soundEngine.playDropConfirm();
        setBusyText(null);
        setDoneText(res?.message || `Saved ${item.label}!`);
        setTimeout(() => {
          hideOverlayNow();
        }, 800);
      } catch (err: any) {
        setBusyText(null);
        setDoneText(err?.message || 'Action failed');
        setTimeout(() => {
          hideOverlayNow();
        }, 1200);
      } finally {
        isExecutingRef.current = false;
      }
    },
    [files, mode, hideOverlayNow]
  );

  // Listen to native Windows/macOS watcher + 60FPS main-process cursor events
  useEffect(() => {
    const api = (window as unknown as { orbitAPI?: Record<string, any> }).orbitAPI;
    if (!api?.onOverlayEvent) return;

    const unsub = api.onOverlayEvent((ev: OverlayEventPayload) => {
      if (ev.type === 'show') {
        isExecutingRef.current = false;
        pointerMovedRef.current = false;
        showTimestampRef.current = performance.now();
        setBusyText(null);
        setDoneText(null);
        setQrModal(null);
        // Always reset files to current event files to prevent carrying over stale files
        setFiles(Array.isArray(ev.files) ? ev.files : []);
        const nextMode = ev.mode || 'conversions';
        setMode(nextMode);
        setHoveredIdx(null);
        subMenuRef.current = null;
        setShowCount((c) => c + 1);
        if (typeof ev.centerDipX === 'number' && typeof ev.centerDipY === 'number') {
          centerDipRef.current = { x: ev.centerDipX, y: ev.centerDipY };
        }
        soundEngine.playWheelBloom(nextMode);
        return;
      }

      if (ev.type === 'mode' && ev.mode) {
        setMode(ev.mode);
        setHoveredIdx(null);
        soundEngine.playWheelBloom(ev.mode);
        return;
      }

      if (ev.type === 'move' && typeof ev.dipX === 'number' && typeof ev.dipY === 'number') {
        const dx = ev.dipX - centerDipRef.current.x;
        const dy = ev.dipY - centerDipRef.current.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 20) {
          pointerMovedRef.current = true;
        }
        // Sub-options card is open (e.g. LINK DL, Trim, Exact KB):
        // Lock the active petal completely so cursor navigation into the center card never switches petals!
        const sub = subMenuRef.current;
        if (sub) {
          return;
        }
        // Only update hoveredIdx when cursor is inside the petal ring (47..124px)!
        const hitIdx = getPetalIndexAtOffset(dx, dy, petals.length);
        if (hitIdx !== null) {
          setHoveredIdx((prev) => {
            if (prev !== hitIdx) {
              soundEngine.playPetalTick(hitIdx, petals.length);
            }
            return hitIdx;
          });
        }
        return;
      }

      if (ev.type === 'mousedown' && typeof ev.dipX === 'number' && typeof ev.dipY === 'number') {
        const dx = ev.dipX - centerDipRef.current.x;
        const dy = ev.dipY - centerDipRef.current.y;
        const dist = Math.hypot(dx, dy);
        // Don't close if clicking inside the center sub-options card
        const sub = subMenuRef.current;
        if (sub && Math.abs(dx) <= sub.halfW && Math.abs(dy) <= sub.halfH) {
          return;
        }
        // Only close overlay when clicking outside the wheel & mode bar
        if (dist > 220 && !qrModal) {
          hideOverlayNow();
        }
        return;
      }

      if (ev.type === 'keyrelease' || ev.type === 'mouseup') {
        if (subMenuRef.current) return;
        const elapsed = performance.now() - showTimestampRef.current;
        if (
          elapsed > 110 &&
          pointerMovedRef.current &&
          hoveredIdx !== null &&
          petals[hoveredIdx]
        ) {
          const targetPetal = petals[hoveredIdx];
          // If the petal has sub-options (Speed, Trim, Exact KB, Passport, Rename, Link DL, Screen Snip),
          // keep the wheel open on release so the user can choose their sub-option in the Center Hub!
          if (
            targetPetal.presets ||
            targetPetal.id === 'trimVideo' ||
            targetPetal.id === 'downloadLink' ||
            targetPetal.id === 'screenCapture'
          ) {
            return;
          }
          executePetal(targetPetal);
        }
        return;
      }

      if (ev.type === 'hide') {
        hideOverlayNow();
      }
    });

    const unsubSs = api?.onScreenshotTrigger?.(() => {
      setMode('actions');
      const actionPetals = getWheelPetals(['folder'], 'actions', []);
      const idx = actionPetals.findIndex((p) => p.id === 'screenCapture');
      if (idx !== -1) {
        setHoveredIdx(idx);
      }
    });

    return () => {
      unsub?.();
      unsubSs?.();
    };
  }, [petals, hoveredIdx, qrModal, executePetal, hideOverlayNow]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'Escape') {
        hideOverlayNow();
      } else if (e.key === 'Shift') {
        setMode('conversions');
        soundEngine.playWheelBloom('conversions');
      } else if (e.key === 'Alt' || e.key === 'Meta') {
        e.preventDefault();
        setMode('tools');
        soundEngine.playWheelBloom('tools');
      } else if (e.key === 'Control') {
        setMode('actions');
        soundEngine.playWheelBloom('actions');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hideOverlayNow]);

  return (
    <div
      onClick={hideOverlayNow}
      onContextMenu={(e) => {
        e.preventDefault();
        hideOverlayNow();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        pointerMovedRef.current = true;
        const sub = subMenuRef.current;
        if (sub && (sub.locked || (Math.abs(dx) <= sub.halfW && Math.abs(dy) <= sub.halfH))) return;
        const hitIdx = getPetalIndexAtOffset(dx, dy, petals.length);
        if (hitIdx !== null && hitIdx !== hoveredIdx) {
          soundEngine.playPetalTick(hitIdx, petals.length);
          setHoveredIdx(hitIdx);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (hoveredIdx !== null && petals[hoveredIdx]) {
          const targetPetal = petals[hoveredIdx];
          if (!targetPetal.presets && targetPetal.id !== 'trimVideo' && targetPetal.id !== 'downloadLink') {
            executePetal(targetPetal);
          }
        } else {
          hideOverlayNow();
        }
      }}
      className="w-screen h-screen overflow-hidden flex items-center justify-center select-none"
      style={{ background: 'transparent' }}
    >
      {busyText || doneText ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-white/95 backdrop-blur-2xl border border-black/10 shadow-2xl text-xs font-semibold text-[#282b29]"
        >
          {busyText ? (
            <>
              <Sparkles className="w-4 h-4 text-[#ff5200] animate-spin" />
              <span>{busyText}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-[#ff5200]" />
              <span>{doneText}</span>
            </>
          )}
        </div>
      ) : qrModal ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-72 rounded-[24px] bg-white/95 backdrop-blur-2xl border border-black/10 p-5 text-center space-y-3 shadow-2xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#ff5200]">Phone Wi-Fi Transfer</span>
            <button
              type="button"
              onClick={hideOverlayNow}
              className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center text-[#767d78] hover:text-black"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mx-auto w-40 h-40 rounded-2xl bg-[#f4f4f4] p-2.5 flex items-center justify-center">
            {qrModal.qrDataUrl ? (
              <img src={qrModal.qrDataUrl} alt="QR" className="w-full h-full rounded-lg" />
            ) : (
              <QrCode className="w-28 h-28 text-[#282b29]" />
            )}
          </div>
          <p className="text-xs font-medium text-[#282b29] truncate">{qrModal.fileName}</p>
        </div>
      ) : (
        <div onClick={(e) => e.stopPropagation()}>
          <RadialWheel
            key={showCount}
            onSubMenuStateChange={handleSubMenuState}
            items={petals}
            mode={mode}
            selectedIndex={hoveredIdx}
            onSelectIndex={setHoveredIdx}
            onTriggerItem={executePetal}
            onSwitchMode={(m) => {
              setMode(m);
              setHoveredIdx(null);
            }}
            theme={{ ...WHEEL_THEMES[0], accentHex: '#ff5200' }}
            size={272}
            fileCount={files.length}
            sourceLabel={
              files.length > 1 ? `${files.length} files` : primaryFileName
            }
          />
        </div>
      )}
    </div>
  );
};
