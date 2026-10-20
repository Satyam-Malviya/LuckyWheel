import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';
import { WheelPetalItem, WheelMode, WheelTheme, FeatureCardItem } from '../data/catalog';
import { MotionGraphicPreview } from './MotionGraphicPreview';
import { soundEngine } from '../utils/sound';

interface RadialWheelProps {
  items: WheelPetalItem[];
  mode: WheelMode;
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
  onTriggerItem: (
    item: WheelPetalItem,
    presetValue?: string | number,
    extraOptions?: Record<string, any>
  ) => void;
  onSwitchMode?: (mode: WheelMode) => void;
  theme?: WheelTheme;
  size?: number;
  fileCount?: number;
  sourceLabel?: string;
  /**
   * Reports the centered sub-options card state so the parent (which hit-tests the cursor itself)
   * can stop switching petals while the cursor is over the card or the card is locked.
   */
  onSubMenuStateChange?: (state: SubMenuState | null) => void;
}

export interface SubMenuState {
  locked: boolean;
  halfW: number;
  halfH: number;
}

// Exact mathematical proportions from the Reel's radial fan wheel
const M = {
  inner: 48 * 0.8 * 1.1 + 8 * 0.8,      // 48.64
  outer: 166 * 0.8 * 0.9,               // 119.52
  backdrop: 166 * 0.8 * 0.9 + 8 * 0.8,  // 125.92
  gap: 5 * 0.8,                         // 4.0
  corner: 28 * 0.8 * 0.9,               // 20.16
  labelInner: 50 * 0.8,                 // 40.0
};

export function getAngle(index: number, total: number): number {
  return (total === 3 ? Math.PI : Math.PI / 2) - (Math.PI * 2 * index) / total;
}

function polar(radius: number, angle: number): [number, number] {
  return [Math.cos(angle) * radius, -Math.sin(angle) * radius];
}

/**
 * Instantaneous O(1) mathematical angle hit-test from wheel center (dx, dy).
 * Strictly clamped to the petal ring (48px..124px) so moving into the Center Hub (<48px)
 * or outside (>124px) NEVER switches to another petal!
 */
export function getPetalIndexAtOffset(dx: number, dy: number, total: number): number | null {
  if (total <= 0) return null;
  const dist = Math.hypot(dx, dy);
  if (dist < 47 || dist > 124) return null;
  if (total === 1) return 0;

  const pointerAngle = Math.atan2(-dy, dx);
  const sectorStep = (Math.PI * 2) / total;
  let bestIndex = 0;
  let bestDiff = Infinity;

  for (let idx = 0; idx < total; idx++) {
    const a = getAngle(idx, total);
    const diff = Math.abs(Math.atan2(Math.sin(pointerAngle - a), Math.cos(pointerAngle - a)));
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = idx;
    }
  }
  return bestDiff <= sectorStep / 2 + 0.05 ? bestIndex : null;
}

export function buildPetalPath(index: number, total: number): string {
  const a = getAngle(index, total);
  const n = (Math.PI * 2) / total;
  const l = a - n / 2;
  const s = a + n / 2;
  const r = (J: number) => Math.asin(Math.min(0.95, M.gap / 2 / Math.max(J, M.gap / 2 + 0.01)));
  const d = l + r(M.outer);
  const i = s - r(M.outer);
  const c = l + r(M.inner);
  const g = s - r(M.inner);
  const f = Math.min(0.15, (i - d) * 0.24);
  const u = Math.min(0.18, (g - c) * 0.18);
  const v = M.inner / Math.max(0.01, Math.cos(u));
  const y = v + M.inner * Math.tan(u);
  const O = M.outer - M.corner;
  const w = (J: number, Oe: number) =>
    polar(J, Oe)
      .map((Be) => Be.toFixed(4))
      .join(' ');

  return `M ${w(y, l + r(y))} L ${w(O, l + r(O))} Q ${w(M.outer, d)} ${w(M.outer, d + f)} A ${M.outer} ${M.outer} 0 ${
    i - f - d - f > Math.PI ? 1 : 0
  } 0 ${w(M.outer, i - f)} Q ${w(M.outer, i)} ${w(O, s - r(O))} L ${w(y, s - r(y))} Q ${w(v, s - r(v))} ${w(
    M.inner,
    g - u
  )} A ${M.inner} ${M.inner} 0 ${g - u - c - u > Math.PI ? 1 : 0} 1 ${w(M.inner, c + u)} Q ${w(v, l + r(v))} ${w(
    y,
    l + r(y)
  )} Z`;
}

function getFormatIconSrc(id: string): string {
  const f = id.toLowerCase();
  if (['jpg', 'jpeg'].includes(f)) return './assets/icons/jpg.png';
  if (['png', 'webp', 'avif', 'svg', 'bmp', 'ico', 'tiff'].includes(f)) return './assets/icons/png.png';
  if (f === 'heic') return './assets/icons/heic.png';
  if (['mp3', 'wav', 'flac', 'm4a', 'ogg', 'opus', 'aac'].includes(f)) return './assets/icons/mp3.png';
  if (f === 'mov') return './assets/icons/mov.png';
  if (['mp4', 'mkv', 'webm', 'avi', 'gif'].includes(f)) return './assets/icons/mp4.png';
  if (f === 'pdf') return './assets/icons/pdf.png';
  if (['docx', 'doc', 'md', 'pptx', 'xlsx'].includes(f)) return './assets/icons/docx.png';
  if (['txt', 'srt', 'vtt', 'json', 'csv'].includes(f)) return './assets/icons/txt.png';
  return './assets/icons/zip.png';
}

function getDetailedEnglishExplanation(item: WheelPetalItem, mode: WheelMode): {
  title: string;
  tag: string;
  explanation: string;
  motionType?: FeatureCardItem['motionType'];
} {
  const id = item.id;
  if (mode === 'conversions') {
    const map: Record<string, { tag: string; explanation: string }> = {
      png: {
        tag: 'Lossless · Alpha',
        explanation: 'Converts your image into a crisp, lossless PNG with full transparency support right beside the original file.',
      },
      jpg: {
        tag: 'Universal · Compact',
        explanation: 'Exports a high-compatibility JPEG image with balanced file size, ready for any website, portal, or device.',
      },
      webp: {
        tag: 'Modern Web · -65% Size',
        explanation: 'Compresses your image into next-gen WebP format for ultra-fast loading while preserving sharp visual detail.',
      },
      avif: {
        tag: 'HDR · Ultra Compact',
        explanation: 'Encodes your photo into AVIF for maximum space savings and rich color depth without blocky artifacts.',
      },
      pdf: {
        tag: '300 DPI · Print Ready',
        explanation: 'Converts your selected image or document into a clean, standalone PDF document in the exact same folder.',
      },
      mp4: {
        tag: 'H.264 · Universal Video',
        explanation: 'Transcodes your video into universally playable MP4 format with smooth playback on every device and browser.',
      },
      mov: {
        tag: 'Apple QuickTime · Pro',
        explanation: 'Saves your video in high-bitrate QuickTime MOV container for seamless editing and macOS/iOS playback.',
      },
      gif: {
        tag: 'Looping Animation',
        explanation: 'Turns your video clip into a smooth, auto-looping animated GIF with optimized color palette.',
      },
      mp3: {
        tag: '320kbps · Pure Audio',
        explanation: 'Extracts or converts the audio track into a universal MP3 file right in the same folder.',
      },
      wav: {
        tag: 'Uncompressed Studio PCM',
        explanation: 'Exports studio-grade uncompressed WAV audio for zero-loss editing in DAWs and video timelines.',
      },
      flac: {
        tag: 'Lossless Archival Audio',
        explanation: 'Compresses audio losslessly into FLAC—bit-for-bit identical to studio master at half the size.',
      },
      docx: {
        tag: 'Editable Word Document',
        explanation: 'Converts your file into an editable Microsoft Word (.docx) document preserving layout and text.',
      },
      txt: {
        tag: 'Clean Plain Text',
        explanation: 'Extracts clean, unformatted plain text or subtitle transcript into a lightweight .txt file.',
      },
      csv: {
        tag: 'Spreadsheet Table',
        explanation: 'Transforms structured JSON or tabular data into a clean comma-separated CSV file for Excel & Sheets.',
      },
      json: {
        tag: 'Structured Developer Data',
        explanation: 'Parses spreadsheet rows and columns into clean, properly formatted JSON objects.',
      },
      zip: {
        tag: 'Compressed Archive',
        explanation: 'Packages your selected file(s) into a standard deflated .zip archive in one instant step.',
      },
    };
    const match = map[id.toLowerCase()];
    return {
      title: `Convert to ${item.label}`,
      tag: match?.tag || 'Instant Local Conversion',
      explanation:
        match?.explanation ||
        `Instantly converts your selected file into .${item.label.toLowerCase()} format locally on your PC and saves it right next to the original.`,
    };
  }

  const toolMap: Record<
    string,
    { title: string; tag: string; explanation: string; motionType: FeatureCardItem['motionType'] }
  > = {
    exactKb: {
      title: 'Exact-KB Exam Compressor',
      tag: '20 KB · 50 KB · 100 KB',
      explanation:
        'Uses binary-search encoding to hit your exact kilobyte limit (like <50KB for exam & ID forms) without making the photo blurry.',
      motionType: 'exact-kb',
    },
    compress: {
      title: 'Smart Lossless Shrink',
      tag: 'Up to 75% Smaller',
      explanation:
        'Reduces file size dramatically while preserving visual sharpness and resolution, saving the optimized copy beside the original.',
      motionType: 'exact-kb',
    },
    passportPhoto: {
      title: 'Passport & ID Studio',
      tag: '3.5 × 4.5 cm · 300 DPI',
      explanation:
        'Automatically crops and centers your portrait to official 3.5×4.5 cm passport dimensions at 300 DPI with a clean studio backdrop.',
      motionType: 'passport-photo',
    },
    frameImage: {
      title: 'AI Studio Backdrop & Frame',
      tag: 'Aesthetic Padding',
      explanation:
        'Wraps your screenshot or portrait in a clean, balanced studio frame so it stands out on social media or presentations.',
      motionType: 'bg-remove',
    },
    cropImage: {
      title: 'Smart Aspect Crop',
      tag: '1:1 · 16:9 · 4:5',
      explanation:
        'Crops your image around the subject center into a balanced square or social aspect ratio without opening an editor.',
      motionType: 'passport-photo',
    },
    editImage: {
      title: 'One-Tap Photo Enhance',
      tag: 'Clarity + Vibrance',
      explanation:
        'Balances exposure, micro-contrast, and natural color vibrance with subtle optical sharpening in one instant step.',
      motionType: 'bg-remove',
    },
    redactImage: {
      title: 'Privacy Blur & Redact',
      tag: 'Gaussian Privacy Shield',
      explanation:
        'Applies a deep optical privacy blur so sensitive screenshots or documents can be shared safely.',
      motionType: 'doc-scanner',
    },
    docScanner: {
      title: 'CamScanner Document Filter',
      tag: 'Crisp B&W Contrast',
      explanation:
        'Turns phone photos of paper notes, receipts, or IDs into a high-contrast, shadow-free scanned document.',
      motionType: 'doc-scanner',
    },
    removeMetadata: {
      title: 'EXIF & GPS Privacy Scrubber',
      tag: '100% Trace Removal',
      explanation:
        'Strips hidden GPS coordinates, camera serial numbers, and author metadata from your photo or PDF before sharing.',
      motionType: 'metadata-scrub',
    },
    trimVideo: {
      title: 'Lossless Video & Audio Trim',
      tag: 'Start / End Cut',
      explanation:
        'Cuts the selected start-to-end segment instantaneously using stream-copy so there is zero quality loss and zero wait time.',
      motionType: 'video-trim',
    },
    changeVideoSpeed: {
      title: 'Time-Warp Speed Control',
      tag: '0.5× Slow · 2.0× Fast',
      explanation:
        'Speeds up or slows down your video while automatically pitch-correcting the audio track so voices never sound robotic.',
      motionType: 'video-speed',
    },
    muteVideo: {
      title: 'Instant Audio Strip (Mute)',
      tag: 'Silent MP4/MOV Copy',
      explanation:
        'Removes the audio track from your video in milliseconds without re-encoding a single video frame.',
      motionType: 'video-trim',
    },
    videoSnapshots: {
      title: 'High-Res Frame Grabber',
      tag: 'Full Resolution PNG',
      explanation:
        'Extracts crystal-clear still PNG frames directly from your video file into the same folder.',
      motionType: 'collage-grid',
    },
    joinVideos: {
      title: 'Multi-Clip Video Stitcher',
      tag: 'Seamless Concat',
      explanation:
        'Joins multiple selected video clips end-to-end into a single continuous MP4 movie.',
      motionType: 'video-join',
    },
    vocalSplitter: {
      title: 'Vocal & Instrumental Splitter',
      tag: 'Karaoke & Stems',
      explanation:
        'Isolates vocals and extracts the instrumental backing track locally using phase-cancellation audio processing.',
      motionType: 'vocal-split',
    },
    normalizeAudio: {
      title: 'Broadcast Loudness Normalizer',
      tag: '-16 LUFS Studio Level',
      explanation:
        'Balances quiet and loud sections to professional podcast/YouTube loudness standards (-16 LUFS).',
      motionType: 'audio-waveform',
    },
    audioToVideo: {
      title: 'Waveform Video Generator',
      tag: '1080p MP4 Visualizer',
      explanation:
        'Renders your audio track into a sleek MP4 video with a live animated frequency waveform.',
      motionType: 'audio-waveform',
    },
    mergePDF: {
      title: 'Instant Multi-PDF Merger',
      tag: 'Combine Pages',
      explanation:
        'Combines all selected PDF documents in order into one clean, unified PDF file right in your folder.',
      motionType: 'pdf-merge',
    },
    splitPDF: {
      title: 'PDF Page Extractor',
      tag: '1 File Per Page',
      explanation:
        'Splits a multi-page PDF document into individual numbered PDF pages inside a new subfolder.',
      motionType: 'pdf-organize',
    },
    organizePDF: {
      title: 'Rotate & Clean PDF Pages',
      tag: '90° Page Orientation',
      explanation:
        'Fixes sideways scanned PDF pages and optimizes internal PDF streams in one click.',
      motionType: 'pdf-organize',
    },
    unlockPDF: {
      title: 'PDF Restriction Remover',
      tag: 'Enable Copy & Print',
      explanation:
        'Saves a clean, unrestricted copy of your PDF so you can freely print, highlight, and copy text.',
      motionType: 'metadata-scrub',
    },
    createPDF: {
      title: 'Images to Multi-Page PDF',
      tag: 'Combine Photos to PDF',
      explanation:
        'Stacks all selected images into a single, neatly formatted multi-page PDF document.',
      motionType: 'pdf-merge',
    },
    createCollage: {
      title: 'High-Res Photo Grid Collage',
      tag: 'Auto Masonry Layout',
      explanation:
        'Arranges multiple selected photos into a balanced, high-resolution studio grid PNG.',
      motionType: 'collage-grid',
    },
    bulkRename: {
      title: 'Smart Batch File Renamer',
      tag: 'Clean Numbered Sequence',
      explanation:
        'Renames all selected files with a clean sequential pattern (e.g. LuckyWheel_01, 02...) while keeping extensions intact.',
      motionType: 'bulk-rename',
    },
    comboVideoAudio: {
      title: 'Mux Video + Audio Track',
      tag: 'Replace Video Sound',
      explanation:
        'Merges your selected video file and audio file together into a single synced MP4 movie.',
      motionType: 'combo-video-audio',
    },
    comboAudioImage: {
      title: 'Audio + Cover Art → MP4',
      tag: 'YouTube / Podcast Ready',
      explanation:
        'Combines your selected image and audio track into a 1080p MP4 video ready for YouTube or social sharing.',
      motionType: 'combo-video-audio',
    },
    organizeFolder: {
      title: '1-Click Folder Auto-Organizer',
      tag: 'Sort by Category',
      explanation:
        'Automatically sorts messy files inside the selected folder into neat Images, Videos, Documents, Audio, and Archives subfolders.',
      motionType: 'folder-organize',
    },
    findDuplicates: {
      title: 'SHA-256 Duplicate File Scanner',
      tag: 'Byte-Exact Match',
      explanation:
        'Scans the folder using cryptographic SHA-256 hashes to find exact duplicate files and generates a clean report.',
      motionType: 'folder-organize',
    },
    wifiQrShare: {
      title: 'Instant Wi-Fi QR Phone Transfer',
      tag: 'Local LAN · Zero Cloud',
      explanation:
        'Generates a scannable Wi-Fi QR code so your phone can download this file immediately over local Wi-Fi.',
      motionType: 'wifi-qr',
    },
    floatShelf: {
      title: 'Pin to Floating Drop Shelf',
      tag: 'Keep Within Reach',
      explanation:
        'Pins the selected file(s) to LuckyWheel’s floating corner shelf so you can collect files from different folders.',
      motionType: 'radial-bloom',
    },
    copyPath: {
      title: 'Copy Full System Path',
      tag: 'Clipboard Utility',
      explanation:
        'Copies the exact Windows/macOS file path of the selected file(s) directly to your system clipboard.',
      motionType: 'doc-scanner',
    },
    openTerminal: {
      title: 'Open Folder in Terminal',
      tag: 'Developer Quick Action',
      explanation:
        'Opens a Terminal / Command Prompt window directly inside this file’s parent directory.',
      motionType: 'radial-bloom',
    },
    revealExplorer: {
      title: 'Reveal File in Folder',
      tag: 'Highlight in Explorer/Finder',
      explanation:
        'Opens File Explorer / Finder and highlights the exact file location on disk.',
      motionType: 'folder-organize',
    },
  };

  const found = toolMap[id];
  if (found) return found;

  return {
    title: item.fullName || item.label,
    tag: mode === 'tools' ? 'Pro Local Tool' : 'Quick Action',
    explanation:
      item.description ||
      `Executes ${item.fullName || item.label} locally on your selected file(s) and saves the result right beside the original.`,
    motionType: 'radial-bloom',
  };
}

export const RadialWheel: React.FC<RadialWheelProps> = ({
  items,
  mode,
  selectedIndex,
  onSelectIndex,
  onTriggerItem,
  onSwitchMode,
  theme,
  size = 272,
  sourceLabel,
  onSubMenuStateChange,
}) => {
  const safeItems = items.slice(0, 9);
  const total = Math.max(1, safeItems.length);
  const isAdvanced = mode !== 'conversions';
  const accentColor = theme?.accentHex || '#ff5200';
  const uniqueGradId = `glass-fill-${mode}-${total}`;

  // No sticky lock: the parent simply ignores cursor movement while it's over the card.
  // "Back" dismisses the card for the current petal; hovering another petal brings it back.
  const [dismissedIdx, setDismissedIdx] = useState<number | null>(null);
  const [hoveringSubMenu, setHoveringSubMenu] = useState<boolean>(false);

  // Custom Trim Start & End state (in seconds)
  const [trimStartSec, setTrimStartSec] = useState<string>('0');
  const [trimEndSec, setTrimEndSec] = useState<string>('10');
  // Custom KB input for Exact-KB Compressor
  const [customKbVal, setCustomKbVal] = useState<string>('45');

  const effectiveIdx = selectedIndex;
  const activeItem = effectiveIdx !== null ? safeItems[effectiveIdx] : safeItems[0] || null;

  // Moving to a different petal clears any previous "Back"
  useEffect(() => {
    if (dismissedIdx !== null && selectedIndex !== dismissedIdx) setDismissedIdx(null);
  }, [selectedIndex, dismissedIdx]);

  // Reset when wheel mode changes
  useEffect(() => {
    setDismissedIdx(null);
    setHoveringSubMenu(false);
  }, [mode]);

  // Dwell timer: show the minimalistic video/motion preview card after ~550ms of hovering on a petal!
  const [previewItem, setPreviewItem] = useState<WheelPetalItem | null>(null);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

  useEffect(() => {
    setPreviewItem(null);
    setPreviewIdx(null);
    if (effectiveIdx === null || !safeItems[effectiveIdx]) return;

    const target = safeItems[effectiveIdx];
    const timer = window.setTimeout(() => {
      setPreviewItem(target);
      setPreviewIdx(effectiveIdx);
    }, 520);

    return () => window.clearTimeout(timer);
  }, [effectiveIdx, mode, safeItems.length]);

  const renderIcon = (iconName: string, isHovered: boolean) => {
    const IconComp =
      (Icons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>)[iconName] ||
      Icons.Sparkles;
    return (
      <IconComp
        className={`w-[17px] h-[17px] ${isHovered ? 'text-white' : 'text-[#1c1e1f]'}`}
        strokeWidth={2}
      />
    );
  };

  const previewMeta = previewItem ? getDetailedEnglishExplanation(previewItem, mode) : null;
  const placeCardOnLeft =
    previewIdx !== null && total > 2 && Math.cos(getAngle(previewIdx, total)) > 0.35;

  const hasSubOptions = !!(
    effectiveIdx !== null &&
    effectiveIdx !== dismissedIdx &&
    activeItem &&
    (activeItem.presets || activeItem.id === 'trimVideo' || activeItem.id === 'downloadLink')
  );

  // Measure the centered sub-options card and tell the parent, so cursor hit-testing
  // (done in the parent from native cursor polling) never switches petals underneath it.
  const subCardRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!onSubMenuStateChange) return;
    if (!hasSubOptions) {
      onSubMenuStateChange(null);
      return;
    }
    const el = subCardRef.current;
    const fallbackH = activeItem?.id === 'trimVideo' ? 150 : activeItem?.id === 'exactKb' ? 112 : 96;
    const w = el?.offsetWidth || 158;
    const h = el?.offsetHeight || fallbackH;
    // +8px padding so the cursor can sit on the card edge safely
    onSubMenuStateChange({ locked: false, halfW: w / 2 + 8, halfH: h / 2 + 8 });
  }, [hasSubOptions, activeItem?.id, onSubMenuStateChange]);

  useEffect(() => () => onSubMenuStateChange?.(null), [onSubMenuStateChange]);

  return (
    <motion.div
      initial={{ scale: 0.65, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.72, opacity: 0 }}
      transition={{ duration: 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="relative select-none flex items-center justify-center will-change-transform"
      style={{ width: size, height: size }}
    >
      {/* Authentic Frosted Glass Ring Mask */}
      <div className="fan-glass-ring" />

      {/* SVG Curved Petals */}
      <svg
        viewBox="-136 -136 272 272"
        width={size}
        height={size}
        className="relative z-10 overflow-visible"
        style={{ filter: 'drop-shadow(0 6px 14px rgba(38, 52, 56, 0.16))' }}
      >
        <defs>
          <radialGradient id={uniqueGradId}>
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.88" />
            <stop offset="68%" stopColor="#f3f6f7" stopOpacity="0.68" />
            <stop offset="100%" stopColor="#f4f6f6" stopOpacity="0.82" />
          </radialGradient>
        </defs>

        {safeItems.map((item, idx) => {
          const isHovered = effectiveIdx === idx;
          const labelR = M.labelInner + (M.outer - M.labelInner) * 0.56;
          const [lx, ly] = polar(labelR, getAngle(idx, total));
          const pathData =
            total === 1
              ? 'M 0 -119.5 A 119.5 119.5 0 1 1 -0.01 -119.5 L -0.01 -48.6 A 48.6 48.6 0 1 0 0 -48.6 Z'
              : buildPetalPath(idx, total);

          return (
            <g
              key={item.id + idx}
              className="cursor-pointer"
              onPointerEnter={() => {
                // Only block while the pointer is actually on the centered sub-options card
                if (hoveringSubMenu) return;
                if (selectedIndex !== idx) {
                  soundEngine.playPetalTick(idx, total);
                  onSelectIndex(idx);
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                // Petals with sub-options (Speed, Trim, Exact KB, Passport...) just open their card
                if (item.presets || item.id === 'trimVideo' || item.id === 'downloadLink') {
                  soundEngine.playPetalTick(idx, total);
                  setDismissedIdx(null);
                  onSelectIndex(idx);
                  return;
                }
                soundEngine.playDropConfirm();
                onTriggerItem(item);
              }}
            >
              <path
                d={pathData}
                fill={isHovered ? accentColor : `url(#${uniqueGradId})`}
                stroke={isHovered ? 'rgba(194, 101, 52, 0.45)' : 'rgba(93, 102, 102, 0.22)'}
                strokeWidth="0.75"
              />

              {/* Petal Icon & Label */}
              {isAdvanced && (
                <foreignObject x={lx - 9} y={ly - 16.5} width="18" height="18" className="pointer-events-none">
                  <div className="w-full h-full flex items-center justify-center">
                    {renderIcon(item.icon, isHovered)}
                  </div>
                </foreignObject>
              )}

              <text
                x={lx}
                y={isAdvanced ? ly + 10.5 : ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={isHovered ? '#ffffff' : '#111314'}
                className="pointer-events-none select-none"
                style={{
                  fontWeight: 600,
                  fontSize: isAdvanced ? '8.5px' : total > 6 ? '12px' : '13.5px',
                  letterSpacing: isAdvanced ? '0.25px' : '0.35px',
                  fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
                }}
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Center Hub: Either shows the Sub-Options Interactive Hub (never crosses other petals!) or the Center Capsule */}
      <AnimatePresence mode="wait">
        {hasSubOptions && activeItem ? (
          <div
            key={`sub-${activeItem.id}`}
            className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
          >
          <motion.div
            ref={subCardRef}
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.88 }}
            transition={{ duration: 0.12 }}
            onPointerEnter={() => setHoveringSubMenu(true)}
            onPointerLeave={() => setHoveringSubMenu(false)}
            onClick={(e) => e.stopPropagation()}
            className={`pointer-events-auto rounded-[22px] ${activeItem.id === 'downloadLink' ? 'w-[218px]' : 'w-[158px]'} bg-white backdrop-blur-2xl border border-black/15 p-2.5 shadow-[0_12px_32px_rgba(24,32,36,0.22)] flex flex-col items-center gap-1.5`}
          >
            <div className="w-full flex items-center justify-between gap-1 px-0.5">
              <button
                type="button"
                onClick={() => {
                  setDismissedIdx(effectiveIdx);
                  setHoveringSubMenu(false);
                }}
                className="shrink-0 flex items-center gap-0.5 text-[9.5px] font-semibold text-[#5d655f] hover:text-black px-1.5 py-0.5 rounded-md bg-black/5 hover:bg-black/10 transition-colors"
                title="Close options and pick another petal"
              >
                ← Back
              </button>
              <span className="text-[10px] font-bold text-[#ff5200] uppercase tracking-wider truncate">
                {activeItem.label}
              </span>
            </div>

            {/* Special Start / End Time inputs for Trim Video / Audio */}
            {activeItem.id === 'downloadLink' ? (
              <div className="w-full space-y-2">
                {isDownloading ? (
                  <div className="w-full py-2 px-1 flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 text-[#ff5200]">
                      <Icons.Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span className="text-[11px] font-bold">Downloading...</span>
                    </div>
                    <div className="w-full bg-black/10 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-[#ff5200] h-full transition-all duration-300 rounded-full"
                        style={{ width: `${Math.min(100, Math.max(5, downloadProgress.percent))}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between w-full text-[9px] text-[#5d655f] font-medium px-0.5">
                      <span className="truncate max-w-[130px]">{downloadProgress.statusText || 'Processing media...'}</span>
                      <span className="font-bold text-[#1e211f]">{Math.round(downloadProgress.percent)}%</span>
                    </div>
                  </div>
                ) : downloadResult ? (
                  <div className="w-full py-1.5 px-0.5 flex flex-col items-center gap-2 text-center">
                    {downloadResult.success ? (
                      <>
                        <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <Icons.Check className="w-4 h-4" strokeWidth={2.5} />
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-emerald-700">Download Complete!</div>
                          <div className="text-[9px] text-[#5d655f] truncate max-w-[190px] mt-0.5 font-medium">
                            {downloadResult.filePath ? downloadResult.filePath.split(/[\\/]/).pop() : 'Saved to Downloads'}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1 w-full mt-1">
                          {downloadResult.filePath && (
                            <button
                              type="button"
                              onClick={() => {
                                const api = (window as unknown as { orbitAPI?: Record<string, any> }).orbitAPI;
                                api?.revealInExplorer?.(downloadResult.filePath);
                              }}
                              className="py-1 px-1.5 rounded-lg bg-[#ff5200] text-white text-[9.5px] font-semibold hover:bg-[#e04800] transition-colors flex items-center justify-center gap-1"
                            >
                              <Icons.FolderOpen className="w-3 h-3" />
                              Show in Folder
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleResetLink}
                            className={`py-1 px-1.5 rounded-lg bg-[#f4f5f4] text-[#282b29] text-[9.5px] font-semibold hover:bg-black/10 transition-colors flex items-center justify-center gap-1 ${
                              !downloadResult.filePath ? 'col-span-2' : ''
                            }`}
                          >
                            <Icons.Plus className="w-3 h-3" />
                            New Link
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                          <Icons.AlertCircle className="w-4 h-4" />
                        </div>
                        <div className="text-[10px] font-bold text-rose-700">Download Failed</div>
                        <div className="text-[8.5px] text-[#767d78] leading-tight max-h-12 overflow-y-auto px-1">
                          {downloadResult.message || 'An error occurred during download'}
                        </div>
                        <button
                          type="button"
                          onClick={handleResetLink}
                          className="w-full py-1 rounded-lg bg-[#f4f5f4] text-[#282b29] text-[9.5px] font-semibold hover:bg-black/10"
                        >
                          Try Another Link
                        </button>
                      </>
                    )}
                  </div>
                ) : linkMeta ? (
                  <div className="w-full space-y-1.5">
                    <div className="flex items-center gap-1.5 bg-[#f7f8f7] p-1.5 rounded-xl border border-black/5">
                      {linkMeta.thumbnail ? (
                        <img
                          src={linkMeta.thumbnail}
                          alt=""
                          className="w-8 h-8 rounded-lg object-cover border border-black/10 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-[#fff0e4] text-[#ff5200] flex items-center justify-center shrink-0">
                          {linkMeta.type === 'youtube' ? (
                            <Icons.Video className="w-4 h-4" />
                          ) : linkMeta.type === 'spotify' ? (
                            <Icons.Music className="w-4 h-4" />
                          ) : linkMeta.type === 'webpage' ? (
                            <Icons.Globe className="w-4 h-4" />
                          ) : (
                            <Icons.FileText className="w-4 h-4" />
                          )}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[8px] font-semibold text-[#ff5200] uppercase tracking-wider truncate">
                          {linkMeta.category}
                        </div>
                        <div className="text-[10px] font-bold text-[#1e211f] truncate leading-tight" title={linkMeta.title}>
                          {linkMeta.title}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1 w-full max-h-[135px] overflow-y-auto pr-0.5">
                      {linkMeta.formats.map((fmt) => (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() => handleStartDownload(fmt)}
                          className="flex items-center justify-between p-1.5 rounded-lg bg-[#f4f5f4] hover:bg-[#ff5200] hover:text-white text-[#282b29] transition-all group text-left"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-[9.5px] font-bold truncate leading-tight group-hover:text-white">
                              {fmt.label}
                            </span>
                            <span className="text-[7.5px] text-[#767d78] group-hover:text-white/80 uppercase">
                              .{fmt.ext}
                            </span>
                          </div>
                          <span className="text-[7.5px] font-extrabold px-1 py-0.5 rounded bg-black/5 group-hover:bg-white/20 group-hover:text-white text-[#5d655f] shrink-0">
                            {fmt.badge}
                          </span>
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleResetLink}
                      className="w-full text-center text-[9px] text-[#767d78] hover:text-[#ff5200] py-0.5 font-medium transition-colors"
                    >
                      ← Change Link
                    </button>
                  </div>
                ) : (
                  <div className="w-full space-y-1.5">
                    <div className="relative w-full">
                      <input
                        type="text"
                        value={urlInput}
                        onChange={(e) => {
                          setUrlInput(e.target.value);
                          if (detectError) setDetectError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleDetect();
                        }}
                        placeholder="Paste URL (YT, Spotify, Web...)"
                        autoFocus
                        className="w-full pl-2 pr-14 py-1.5 rounded-xl bg-[#f4f5f4] border border-black/10 text-[10.5px] font-medium text-[#1e211f] placeholder:text-[#9ea49f] focus:outline-none focus:border-[#ff5200] transition-colors"
                      />
                      <button
                        type="button"
                        onClick={handlePaste}
                        className="absolute right-1 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md bg-white border border-black/10 hover:border-[#ff5200] text-[8.5px] font-bold text-[#5d655f] hover:text-[#ff5200] flex items-center gap-0.5 shadow-2xs transition-colors"
                        title="Paste from clipboard"
                      >
                        <Icons.Clipboard className="w-2.5 h-2.5" />
                        Paste
                      </button>
                    </div>

                    {detectError && (
                      <div className="text-[8.5px] text-rose-600 bg-rose-50 px-2 py-1 rounded-lg font-medium leading-tight text-center">
                        {detectError}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={isDetecting || !urlInput.trim()}
                      onClick={() => handleDetect()}
                      className="w-full py-1.5 rounded-xl bg-[#ff5200] hover:bg-[#e04800] disabled:opacity-40 text-white text-[10px] font-bold shadow-sm transition-all flex items-center justify-center gap-1.5"
                    >
                      {isDetecting ? (
                        <>
                          <Icons.Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Detecting Formats...</span>
                        </>
                      ) : (
                        <>
                          <Icons.Sparkles className="w-3.5 h-3.5" />
                          <span>Analyze & Download</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : activeItem.id === 'trimVideo' ? (
              <div className="w-full space-y-1.5">
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <label className="flex flex-col bg-[#f4f5f4] rounded-lg px-2 py-1 border border-black/5">
                    <span className="text-[8.5px] text-[#767d78] font-medium">Start (sec)</span>
                    <input
                      type="number"
                      min={0}
                      value={trimStartSec}
                      onChange={(e) => setTrimStartSec(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-transparent font-bold text-[#1e211f] focus:outline-none text-[11px]"
                    />
                  </label>
                  <label className="flex flex-col bg-[#f4f5f4] rounded-lg px-2 py-1 border border-black/5">
                    <span className="text-[8.5px] text-[#767d78] font-medium">End (sec)</span>
                    <input
                      type="number"
                      min={1}
                      value={trimEndSec}
                      onChange={(e) => setTrimEndSec(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-transparent font-bold text-[#1e211f] focus:outline-none text-[11px]"
                    />
                  </label>
                </div>
                <div className="flex items-center justify-center gap-1 w-full">
                  {[
                    { label: '0–5s', s: 0, d: 5 },
                    { label: '0–15s', s: 0, d: 15 },
                    { label: '0–30s', s: 0, d: 30 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        soundEngine.playDropConfirm();
                        onTriggerItem(activeItem, p.d, { trimStart: p.s, trimDuration: p.d });
                      }}
                      className="flex-1 py-1 rounded-lg bg-[#f4f5f4] hover:bg-[#fff0e4] hover:text-[#ff5200] text-[9.5px] font-semibold text-[#282b29] transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const s = Math.max(0, Number(trimStartSec) || 0);
                    const eSec = Math.max(s + 1, Number(trimEndSec) || s + 10);
                    soundEngine.playDropConfirm();
                    onTriggerItem(activeItem, eSec - s, {
                      trimStart: s,
                      trimEnd: eSec,
                      trimDuration: eSec - s,
                    });
                  }}
                  className="w-full py-1.5 rounded-xl bg-[#ff5200] hover:bg-[#e04800] text-white text-[10.5px] font-semibold shadow-sm transition-colors"
                >
                  Trim {trimStartSec}s → {trimEndSec}s
                </button>
              </div>
            ) : activeItem.id === 'exactKb' ? (
              <div className="w-full space-y-1.5">
                <div className="grid grid-cols-3 gap-1 w-full">
                  {activeItem.presets?.map((preset) => (
                    <button
                      key={String(preset.value)}
                      type="button"
                      onClick={() => {
                        soundEngine.playDropConfirm();
                        onTriggerItem(activeItem, preset.value);
                      }}
                      className="py-1 rounded-lg bg-[#f4f5f4] hover:bg-[#ff5200] hover:text-white text-[10px] font-semibold text-[#282b29] transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={10}
                    max={2000}
                    value={customKbVal}
                    onChange={(e) => setCustomKbVal(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-16 px-2 py-1 rounded-lg bg-[#f4f5f4] border border-black/5 text-[10.5px] font-bold text-[#1e211f] focus:outline-none"
                    placeholder="KB"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playDropConfirm();
                      onTriggerItem(activeItem, Number(customKbVal) || 45);
                    }}
                    className="flex-1 py-1 rounded-lg bg-[#ff5200] text-white text-[10px] font-semibold"
                  >
                     Make {customKbVal} KB
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1 w-full">
                {activeItem.presets?.map((preset) => (
                  <button
                    key={String(preset.value)}
                    type="button"
                    onClick={() => {
                      soundEngine.playDropConfirm();
                      onTriggerItem(activeItem, preset.value);
                    }}
                    className="py-1.5 px-1 rounded-xl bg-[#f4f5f4] hover:bg-[#ff5200] hover:text-white text-[10.5px] font-semibold text-[#282b29] transition-colors text-center"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
          </div>
        ) : (
          activeItem && (
            <div
              key="center-pill"
              className={`fan-center-pill absolute z-20 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center w-[78px] rounded-[24px] px-1.5 py-1 text-center pointer-events-none ${
                isAdvanced
                  ? 'min-h-[36px] text-[8.5px] font-semibold tracking-[0.2px]'
                  : 'min-h-[32px] text-[12px] font-semibold tracking-[0.35px]'
              } text-[#111314] leading-tight`}
            >
              <span>{activeItem.label}</span>
              {sourceLabel && (
                <span className="text-[8px] font-normal text-[#596557] truncate max-w-[68px] mt-0.5">
                  {sourceLabel}
                </span>
              )}
            </div>
          )
        )}
      </AnimatePresence>

      {/* 0.52s Dwell Hover Video & Motion Graphics Preview Card */}
      <AnimatePresence>
        {previewItem && previewMeta && (
          <motion.div
            key={previewItem.id}
            initial={{ opacity: 0, scale: 0.92, x: placeCardOnLeft ? 10 : -10, y: '-50%' }}
            animate={{ opacity: 1, scale: 1, x: 0, y: '-50%' }}
            exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.08 } }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute top-1/2 z-40 w-[238px] rounded-[22px] bg-white/95 backdrop-blur-2xl border border-[#e2e6e2] p-3 shadow-[0_18px_48px_rgba(30,42,48,0.18)] pointer-events-none ${
              placeCardOnLeft ? 'right-[calc(100%+14px)]' : 'left-[calc(100%+14px)]'
            }`}
          >
            {/* Top Motion Graphics / Video Stage */}
            {mode === 'conversions' ? (
              <div className="relative w-full h-[116px] rounded-[14px] bg-[#f7f8f7] border border-[#ebedeb] overflow-hidden flex flex-col items-center justify-center gap-2">
                <video
                  src="./assets/demo.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover opacity-[0.14] mix-blend-multiply pointer-events-none"
                />
                <div className="relative z-10 flex items-center gap-3">
                  <motion.div
                    animate={{ x: [0, 3, 0], scale: [0.96, 1, 0.96] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                    className="flex flex-col items-center"
                  >
                    <img
                      src="./assets/icons/photo-thumbnail.png"
                      alt=""
                      className="w-11 h-11 object-contain drop-shadow-sm"
                    />
                    <span className="text-[9px] font-medium text-[#767d78] mt-0.5 truncate max-w-[56px]">
                      {sourceLabel || 'Source'}
                    </span>
                  </motion.div>

                  <div className="flex flex-col items-center">
                    <motion.div
                      animate={{ x: [-3, 4, -3], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      className="px-2 py-0.5 rounded-full bg-[#fff0e4] text-[#ff5200] text-[10px] font-bold"
                    >
                      →
                    </motion.div>
                  </div>

                  <motion.div
                    animate={{ scale: [0.95, 1.06, 0.95] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                    className="flex flex-col items-center"
                  >
                    <img
                      src={getFormatIconSrc(previewItem.id)}
                      alt=""
                      className="w-11 h-11 object-contain drop-shadow-md"
                    />
                    <span className="mt-0.5 px-1.5 py-0.2 rounded bg-[#ff5200] text-white text-[9px] font-bold uppercase">
                      .{previewItem.label}
                    </span>
                  </motion.div>
                </div>
              </div>
            ) : (
              <div className="w-full overflow-hidden rounded-[14px]">
                <MotionGraphicPreview
                  type={previewMeta.motionType || 'radial-bloom'}
                  compact
                />
              </div>
            )}

            {/* Bottom English Explanation */}
            <div className="mt-2.5 px-1 space-y-1 text-left">
              <div className="flex items-center justify-between gap-1.5">
                <h4 className="text-[12.5px] font-semibold tracking-[-0.2px] text-[#1e211f] truncate">
                  {previewMeta.title}
                </h4>
                <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-[#fff0e4] text-[#d55223] text-[9px] font-semibold">
                  {previewMeta.tag}
                </span>
              </div>
              <p className="text-[11px] leading-[1.42] text-[#636b64] font-normal">
                {previewMeta.explanation}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimalist Floating Wheel Prompt above the Wheel */}
      {onSwitchMode && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute -top-12 z-30 flex items-center gap-3 px-3.5 py-2 rounded-xl bg-white/90 backdrop-blur-md border border-white/95 shadow-md text-[11px] text-[#596557] whitespace-nowrap"
        >
          {(
            [
              { id: 'conversions', kbd: '⇧', label: 'Convert' },
              { id: 'tools', kbd: '⌥', label: 'Tools' },
              { id: 'actions', kbd: '⌃', label: 'Actions' },
            ] as { id: WheelMode; kbd: string; label: string }[]
          ).map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  soundEngine.playWheelBloom(m.id);
                  onSwitchMode(m.id);
                }}
                className={`flex items-center gap-1 transition-colors ${
                  active ? 'text-[#ff5200] font-bold' : 'hover:text-[#282b29]'
                }`}
              >
                <kbd
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                    active
                      ? 'bg-[#fff0e4] border-[#efc8ac] text-[#d55223]'
                      : 'bg-[#f7f8f4] border-[#dadfd6] text-[#50594f]'
                  }`}
                >
                  {m.kbd}
                </kbd>
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};
