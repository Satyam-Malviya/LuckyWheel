import React, { useState, useEffect } from 'react';
import {
  FEATURE_SHOWCASE,
  WheelPetalItem,
  WheelTheme,
  getWheelPetals,
} from '../data/catalog';
import { RadialWheel } from './RadialWheel';
import { MotionGraphicPreview } from './MotionGraphicPreview';
import { soundEngine } from '../utils/sound';

interface WheelShowcaseSectionProps {
  theme: WheelTheme;
  customPetals: WheelPetalItem[];
  onTryFeatureOnPlayground: (toolId: string) => void;
}

const CATEGORIES = [
  { id: 'Images', label: 'Images', ext: ['jpg'], icon: './assets/icons/jpg.png' },
  { id: 'Video', label: 'Video', ext: ['mov'], icon: './assets/icons/mov.png' },
  { id: 'Audio', label: 'Audio', ext: ['mp3'], icon: './assets/icons/mp3.png' },
  { id: 'PDF', label: 'PDF & Docs', ext: ['pdf'], icon: './assets/icons/pdf.png' },
  { id: 'Multi-File Combos', label: 'Multi-File Combos', ext: ['mov', 'mp3'], icon: './assets/icons/zip.png' },
  { id: 'Folders & Actions', label: 'Folders & Actions', ext: ['folder'], icon: './assets/icons/folder.png' },
];

export const WheelShowcaseSection: React.FC<WheelShowcaseSectionProps> = ({
  theme,
  customPetals,
  onTryFeatureOnPlayground,
}) => {
  const [activeTab, setActiveTab] = useState('Images');
  const [convHover, setConvHover] = useState<number | null>(0);
  const [toolHover, setToolHover] = useState<number | null>(0);
  const [heldKey, setHeldKey] = useState<string | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => setHeldKey(e.key);
    const up = () => setHeldKey(null);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const currentTab = CATEGORIES.find((t) => t.id === activeTab) || CATEGORIES[0];
  const convPetals = getWheelPetals(currentTab.ext, 'conversions', customPetals);
  const toolPetals = getWheelPetals(currentTab.ext, 'tools', customPetals);
  const filteredCards = FEATURE_SHOWCASE.filter((c) => c.category === activeTab);

  return (
    <section id="wheel-encyclopedia" className="max-w-[1040px] mx-auto px-6 space-y-6">
      {/* Segmented File Category Bar (Just like Tangerine's .bento-tabs) */}
      <div className="flex flex-wrap justify-center w-fit max-w-full gap-1 p-1.5 mx-auto rounded-[16px] bg-[#ebebea]">
        {CATEGORIES.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                soundEngine.playPetalTick(1, 6);
                setActiveTab(tab.id);
                setConvHover(0);
                setToolHover(0);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-[11px] text-xs font-medium transition-all ${
                active
                  ? 'bg-white text-[#282b29] shadow-[0_1px_4px_rgba(0,0,0,0.06)]'
                  : 'text-[#767d78] hover:text-[#282b29]'
              }`}
            >
              <img src={tab.icon} alt="" className="w-5 h-5 object-contain" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Twin-Wheel Showcase Card (Just like Tangerine's .bento-shortcut) */}
      <div className="rounded-[22px] bg-white border border-[#e6e6e6] py-8 px-4 overflow-hidden">
        <h2 className="text-center text-3xl font-medium tracking-[-1.2px] text-[#282b29] mb-8">
          {currentTab.label} tools
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#e6e6e6]">
          {/* Left: Shift Convert Wheel */}
          <div className="flex flex-col items-center text-center py-4 px-4">
            <div className="mb-3">
              <div className={`tactile-keycap ${heldKey === 'Shift' ? 'is-active' : ''}`}>
                <span className="text-xl leading-none">⇧</span>
                <span>shift</span>
              </div>
            </div>
            <h3 className="text-xs font-medium text-[#757575] mb-4">Convert formats</h3>
            <RadialWheel
              items={convPetals}
              mode="conversions"
              selectedIndex={convHover}
              onSelectIndex={setConvHover}
              onTriggerItem={(item) => onTryFeatureOnPlayground(item.id)}
              theme={theme}
              size={272}
            />
            <p className="mt-4 text-xs text-[#6c797d] font-medium">
              {convHover !== null && convPetals[convHover]
                ? convPetals[convHover].fullName
                : 'Hover a format'}
            </p>
          </div>

          {/* Right: Alt File Tools Wheel */}
          <div className="flex flex-col items-center text-center py-4 px-4">
            <div className="mb-3">
              <div className={`tactile-keycap ${heldKey === 'Alt' ? 'is-active' : ''}`}>
                <span className="text-xl leading-none">⌥</span>
                <span>alt / win</span>
              </div>
            </div>
            <h3 className="text-xs font-medium text-[#757575] mb-4">File tools</h3>
            <RadialWheel
              items={toolPetals}
              mode="tools"
              selectedIndex={toolHover}
              onSelectIndex={setToolHover}
              onTriggerItem={(item) => onTryFeatureOnPlayground(item.id)}
              theme={theme}
              size={272}
            />
            <p className="mt-4 text-xs text-[#6c797d] font-medium">
              {toolHover !== null && toolPetals[toolHover]
                ? toolPetals[toolHover].fullName
                : 'Hover a tool'}
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-[#828782] mt-6 px-4">
          Start dragging, then tap a key. The wheel stays open until you drop.
        </p>
      </div>

      {/* Minimalist Bento Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filteredCards.map((card) => (
          <div
            key={card.id}
            onClick={() => onTryFeatureOnPlayground(card.toolId)}
            className="rounded-[20px] bg-white border border-[#e6e6e6] hover:border-[#cfd2cf] transition-all overflow-hidden flex flex-col justify-between cursor-pointer group"
          >
            <div>
              <div className="p-2.5 pb-0">
                <MotionGraphicPreview type={card.motionType} />
              </div>

              <div className="p-6 pt-4">
                {card.multiFile && (
                  <span className="inline-block px-2 py-0.5 mb-2 rounded-[5px] bg-[#f4f4f4] text-[#777] text-[10px] font-medium">
                    Multiple files
                  </span>
                )}
                <h3 className="text-[17px] font-medium tracking-[-0.4px] text-[#282b29]">
                  {card.title}
                </h3>
                <p className="text-xs text-[#777] leading-[1.75] mt-2">{card.description}</p>
              </div>
            </div>

            <div className="mx-6 mb-5 pt-3.5 border-t border-[#eeeeec] flex items-center justify-between text-[11px] font-semibold text-[#666d67] group-hover:text-[#282b29]">
              <span>Try on playground</span>
              <b className="text-[#ff5200] text-sm font-medium">↗</b>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
