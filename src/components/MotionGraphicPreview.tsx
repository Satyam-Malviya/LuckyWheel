import React from 'react';
import { motion } from 'framer-motion';
import { FeatureCardItem } from '../data/catalog';

interface MotionGraphicPreviewProps {
  type: FeatureCardItem['motionType'];
  accentColor?: string;
  compact?: boolean;
}

/**
 * Minimalist Apple / Tangerine Bento Illustration & Motion Graphics Engine
 * Clean, airy visual previews using real high-res file icons and smooth motion
 */
export const MotionGraphicPreview: React.FC<MotionGraphicPreviewProps> = ({
  type,
  compact = false,
}) => {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-[16px] bg-[#f8f9f8] border border-[#eceeed] flex items-center justify-center select-none ${
        compact ? 'h-[155px]' : 'h-[195px]'
      }`}
    >
      {/* 1. EXACT KB / COMPRESSION FLOW */}
      {type === 'exact-kb' && (
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <img src="./assets/icons/photo-thumbnail.png" alt="" className="w-[72px] h-[72px] object-contain drop-shadow-sm" />
            <span className="text-[10px] text-[#8a959b] mt-1.5 font-medium">2,400 KB</span>
          </div>
          <motion.span
            animate={{ x: [0, 5, 0] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            className="text-xl text-[#a9b6b9]"
          >
            →
          </motion.span>
          <motion.div
            animate={{ scale: [0.96, 1.03, 0.96] }}
            transition={{ duration: 2.2, repeat: Infinity }}
            className="flex flex-col items-center"
          >
            <img src="./assets/icons/photo-thumbnail.png" alt="" className="w-[54px] h-[54px] object-contain drop-shadow-sm" />
            <span className="mt-1.5 px-2 py-0.5 rounded-full bg-[#fff0e4] text-[#ff5200] text-[10px] font-semibold">
              44.8 KB ✓
            </span>
          </motion.div>
        </div>
      )}

      {/* 2. PASSPORT PHOTO / CROP FRAME */}
      {type === 'passport-photo' && (
        <div className="flex flex-col items-center gap-2">
          <div className="relative w-[148px] h-[104px] border border-[#84999d] p-1.5 bg-white shadow-sm">
            <img
              src="./assets/icons/photo-martin.png"
              alt=""
              className="w-full h-full object-cover rounded-[3px]"
            />
            <i className="absolute -left-1 -top-1 w-2 h-2 bg-white border border-[#84999d]" />
            <i className="absolute -right-1 -top-1 w-2 h-2 bg-white border border-[#84999d]" />
            <i className="absolute -left-1 -bottom-1 w-2 h-2 bg-white border border-[#84999d]" />
            <i className="absolute -right-1 -bottom-1 w-2 h-2 bg-white border border-[#84999d]" />
            <motion.div
              animate={{ top: ['12%', '84%', '12%'] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute left-1 right-1 h-[1.5px] bg-[#ff5200]/75"
            />
          </div>
          <span className="text-[10px] text-[#8a959b] font-medium">3.5 × 4.5 cm · 300 DPI</span>
        </div>
      )}

      {/* 3. AI BACKGROUND & STUDIO FRAME */}
      {type === 'bg-remove' && (
        <div className="flex flex-col items-center gap-3">
          <motion.div
            animate={{
              background: [
                'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
                'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
                'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
              ],
            }}
            transition={{ duration: 4, repeat: Infinity }}
            className="w-[156px] h-[106px] p-2.5 rounded-[14px] shadow-sm border border-black/5 flex items-center justify-center"
          >
            <img
              src="./assets/icons/photo-johannes.png"
              alt=""
              className="w-full h-full object-cover rounded-[9px] shadow-md"
            />
          </motion.div>
        </div>
      )}

      {/* 4. DOCUMENT SCANNER / METADATA SHEET */}
      {(type === 'doc-scanner' || type === 'metadata-scrub') && (
        <motion.div
          animate={{ y: [-2, 2, -2] }}
          transition={{ duration: 2.8, repeat: Infinity }}
          className="w-[156px] p-3 rounded-[12px] bg-white border border-[#e2e8e0] shadow-[0_5px_14px_rgba(52,75,43,0.05)] space-y-1.5"
        >
          <img src="./assets/icons/pdf.png" alt="" className="w-11 h-11 mx-auto mb-1 object-contain" />
          {['Location', 'Camera', 'Author'].map((tag) => (
            <div
              key={tag}
              className="flex items-center justify-between text-[10px] text-[#9aa397] border-t border-[#e6ece2] pt-1"
            >
              <span>{tag}</span>
              <span className="text-[#ff5200] font-medium">Removed</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* 5. VIDEO TIMELINE TRIM */}
      {type === 'video-trim' && (
        <div className="flex flex-col items-center gap-3">
          <img src="./assets/icons/mov.png" alt="" className="w-12 h-12 object-contain" />
          <div className="relative flex items-center w-[186px] h-[46px] gap-1 px-2 py-1 border border-[#b5b9b5] rounded-[6px] bg-white overflow-hidden">
            {[
              './assets/icons/photo-thumbnail.png',
              './assets/icons/photo-martin.png',
              './assets/icons/photo-johannes.png',
              './assets/icons/photo-thumbnail.png',
            ].map((src, i) => (
              <img key={i} src={src} alt="" className="w-1/4 h-full object-cover rounded-[2px] opacity-80" />
            ))}
            <motion.div
              animate={{ left: ['8%', '18%', '8%'], right: ['12%', '20%', '12%'] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-0 bottom-0 border-x-[4px] border-y-[1.5px] border-[#ff5200] bg-[#ff5200]/10 rounded-[4px]"
            />
          </div>
        </div>
      )}

      {/* 6. VIDEO SPEED */}
      {type === 'video-speed' && (
        <div className="flex flex-col items-center gap-3">
          <img src="./assets/icons/mov.png" alt="" className="w-14 h-14 object-contain" />
          <div className="flex items-center gap-3 text-xs text-[#8a959b]">
            <span>0.5×</span>
            <motion.strong
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              className="px-3 py-1 rounded-[7px] bg-white border border-[#e5e7e4] text-[#282b29] font-semibold shadow-sm"
            >
              2.0×
            </motion.strong>
            <span>1.5×</span>
          </div>
        </div>
      )}

      {/* 7. VIDEO JOIN / MULTI-CLIP */}
      {(type === 'video-join' || type === 'combo-video-audio') && (
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {(type === 'combo-video-audio'
              ? ['./assets/icons/mov.png', './assets/icons/mp3.png']
              : ['./assets/icons/mov.png', './assets/icons/mp4.png']
            ).map((ic, idx) => (
              <motion.div
                key={idx}
                animate={{ y: [0, idx % 2 === 0 ? -3 : 3, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex flex-col items-center"
              >
                <img src={ic} alt="" className="w-11 h-12 object-contain" />
              </motion.div>
            ))}
          </div>
          <span className="text-lg text-[#a9b6b9]">→</span>
          <img src="./assets/icons/mp4.png" alt="" className="w-13 h-14 object-contain drop-shadow-sm" />
        </div>
      )}

      {/* 8. AUDIO WAVEFORM & VOCAL SPLITTER */}
      {(type === 'audio-waveform' || type === 'vocal-split') && (
        <div className="flex flex-col items-center gap-2.5">
          <div className="flex items-center justify-center w-[200px] h-[76px] px-3 rounded-[12px] bg-[#181918] overflow-hidden gap-[3px]">
            {Array.from({ length: 28 }).map((_, i) => (
              <motion.span
                key={i}
                animate={{
                  height: [
                    `${14 + Math.abs(Math.sin(i * 1.5)) * 42}px`,
                    `${22 + Math.abs(Math.cos(i * 1.2)) * 46}px`,
                    `${14 + Math.abs(Math.sin(i * 1.5)) * 42}px`,
                  ],
                }}
                transition={{ duration: 1.1 + (i % 3) * 0.2, repeat: Infinity }}
                className="w-[3px] rounded-full bg-[#ff5200]"
              />
            ))}
          </div>
          {type === 'vocal-split' && (
            <span className="text-[10px] font-medium text-[#767d78]">Vocals + Instrumental Stems</span>
          )}
        </div>
      )}

      {/* 9. PDF MERGE & ORGANIZE */}
      {(type === 'pdf-merge' || type === 'pdf-organize') && (
        <div className="flex items-center gap-1.5 pt-2">
          {[1, 2, 3].map((n, idx) => (
            <motion.div
              key={n}
              animate={{ y: idx === 1 ? [-6, 2, -6] : [4, -2, 4] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="flex flex-col items-center"
            >
              <img src="./assets/icons/pdf.png" alt="" className="w-14 h-16 object-contain" />
              <span className="text-[9px] text-[#a99b90] mt-1">0{n}</span>
            </motion.div>
          ))}
        </div>
      )}

      {/* 10. COLLAGE GRID */}
      {type === 'collage-grid' && (
        <div className="w-[162px] h-[112px] grid grid-cols-2 grid-rows-2 gap-1 p-1.5 bg-white rounded-[8px] shadow-[0_3px_10px_rgba(0,0,0,0.07)]">
          <img
            src="./assets/icons/photo-thumbnail.png"
            alt=""
            className="row-span-2 w-full h-full object-cover rounded-[4px]"
          />
          <img
            src="./assets/icons/photo-martin.png"
            alt=""
            className="w-full h-full object-cover rounded-[4px]"
          />
          <img
            src="./assets/icons/photo-johannes.png"
            alt=""
            className="w-full h-full object-cover rounded-[4px]"
          />
        </div>
      )}

      {/* 11. FOLDER ORGANIZE / ARCHIVE / BULK RENAME / WIFI QR */}
      {(type === 'folder-organize' ||
        type === 'bulk-rename' ||
        type === 'wifi-qr' ||
        type === 'radial-bloom') && (
        <div className="flex items-center gap-3">
          <img
            src={type === 'folder-organize' ? './assets/icons/folder.png' : './assets/icons/zip.png'}
            alt=""
            className="w-14 h-14 object-contain"
          />
          <span className="text-lg text-[#a9b6b9]">→</span>
          <div className="relative w-24 h-16 flex items-center">
            <img src="./assets/icons/pdf.png" alt="" className="w-11 h-12 object-contain absolute left-0 top-0" />
            <img src="./assets/icons/jpg.png" alt="" className="w-11 h-12 object-contain absolute left-5 top-2" />
            <img src="./assets/icons/mov.png" alt="" className="w-11 h-12 object-contain absolute left-10 top-4" />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Clean Minimalist Video Showreel Banner (Plays the actual crisp radial wheel demo video!)
 */
export const HeroMotionShowreel: React.FC = () => {
  return (
    <div className="max-w-[960px] mx-auto space-y-6">
      {/* Actual Seamless Demo Video from Reel */}
      <div className="rounded-[24px] bg-white border border-[#e6e6e6] p-6 sm:p-10 shadow-[0_12px_40px_rgba(40,43,41,0.04)] text-center space-y-6">
        <div className="max-w-xl mx-auto space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#ff5200]">
            Watch LuckyWheel in Action
          </span>
          <h2 className="text-2xl sm:text-3xl font-medium tracking-[-1.2px] text-[#282b29]">
            Convert and edit files right where they are.
          </h2>
          <p className="text-sm text-[#767d78]">
            Drag a file, tap <kbd className="px-1.5 py-0.5 rounded bg-[#f7f8f4] border border-[#dadfd6] text-xs">⇧ Shift</kbd> to convert,{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-[#f7f8f4] border border-[#dadfd6] text-xs">⌥ Alt</kbd> for editing tools, or{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-[#f7f8f4] border border-[#dadfd6] text-xs">⌃ Ctrl</kbd> for quick actions.
          </p>
        </div>

        <div className="max-w-[540px] mx-auto overflow-hidden rounded-2xl">
          <video
            src="./assets/demo.mp4"
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-auto block mx-auto mix-blend-multiply"
          />
        </div>

        {/* 3 Minimalist Stat Pillars (just like Tangerine's .tool-stats) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div className="rounded-[18px] bg-[#fafafa] border border-[#eceeed] p-6 text-center">
            <strong className="block text-[#ff5200] text-5xl font-medium tracking-[-3px] leading-none mb-2">
              275
            </strong>
            <h3 className="text-base font-medium text-[#282b29]">Conversion options</h3>
            <p className="text-xs text-[#828782] mt-1">
              Across images, video, audio, PDFs, documents, and archives.
            </p>
          </div>

          <div className="rounded-[18px] bg-[#fafafa] border border-[#eceeed] p-6 text-center">
            <strong className="block text-[#ff5200] text-5xl font-medium tracking-[-3px] leading-none mb-2">
              30+
            </strong>
            <h3 className="text-base font-medium text-[#282b29]">Advanced file tools</h3>
            <p className="text-xs text-[#828782] mt-1">
              Exact-KB exam resize, AI cutout, vocal split, trim, merge & more.
            </p>
          </div>

          <div className="rounded-[18px] bg-[#fafafa] border border-[#eceeed] p-6 text-center">
            <strong className="block text-[#ff5200] text-5xl font-medium tracking-[-3px] leading-none mb-2">
              100%
            </strong>
            <h3 className="text-base font-medium text-[#282b29]">Local & offline</h3>
            <p className="text-xs text-[#828782] mt-1">
              Files never leave your PC. Instant processing with zero uploads.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
