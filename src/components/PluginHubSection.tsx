import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, Download, Sparkles, X } from 'lucide-react';
import { PluginItem, WheelPetalItem } from '../data/catalog';
import { MotionGraphicPreview } from './MotionGraphicPreview';
import { soundEngine } from '../utils/sound';

interface PluginHubSectionProps {
  plugins: PluginItem[];
  onTogglePlugin: (pluginId: string) => void;
  onInstallPlugin: (pluginId: string) => void;
  onAddCustomPetal: (petal: WheelPetalItem) => void;
  onTryPluginOnWheel: (petalId: string) => void;
  customPetals: WheelPetalItem[];
}

export const PluginHubSection: React.FC<PluginHubSectionProps> = ({
  plugins,
  onTogglePlugin,
  onInstallPlugin,
  onAddCustomPetal,
  onTryPluginOnWheel,
  customPetals,
}) => {
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customFullName, setCustomFullName] = useState('');
  const [customDesc, setCustomDesc] = useState('');

  const handlePluginAction = (plugin: PluginItem) => {
    if (plugin.installed) {
      soundEngine.playPetalTick(2, 8);
      onTogglePlugin(plugin.id);
      return;
    }
    setInstallingId(plugin.id);
    soundEngine.playWheelBloom('tools');
    setTimeout(() => {
      onInstallPlugin(plugin.id);
      setInstallingId(null);
      soundEngine.playDropConfirm();
    }, 900);
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customLabel.trim()) return;
    onAddCustomPetal({
      id: `custom_${Date.now()}`,
      label: customLabel.trim().toUpperCase().slice(0, 10),
      fullName: customFullName.trim() || customLabel,
      description: customDesc.trim() || 'Custom radial wheel action',
      icon: 'Terminal',
    });
    soundEngine.playDropConfirm();
    setShowCreateModal(false);
    setCustomLabel('');
    setCustomFullName('');
    setCustomDesc('');
  };

  return (
    <section id="home-plugin-hub" className="max-w-[1040px] mx-auto px-6 space-y-8">
      {/* Clean Minimalist Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#ff5200] mb-1.5">
            Power-Ups & Plugins
          </p>
          <h2 className="text-3xl font-medium tracking-[-1.2px] text-[#282b29]">
            Add superpowers to your wheel.
          </h2>
          <p className="text-sm text-[#767d78] mt-1">
            Toggle local AI modules, exact-KB resizers, or add your own custom actions directly from the Home screen.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            soundEngine.playPetalTick(3, 8);
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#282b29] hover:bg-black text-white text-xs font-medium transition-colors shadow-sm shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Custom Petal</span>
        </button>
      </div>

      {/* Custom Petals Strip */}
      {customPetals.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3.5 rounded-[16px] bg-white border border-[#e6e6e6]">
          <span className="text-xs font-medium text-[#767d78] mr-1">Custom Petals on Wheel:</span>
          {customPetals.map((cp) => (
            <span
              key={cp.id}
              className="px-3 py-1 rounded-full bg-[#fff0e4] text-[#d55223] text-xs font-semibold"
            >
              {cp.label} · {cp.fullName}
            </span>
          ))}
        </div>
      )}

      {/* Clean Minimalist Bento Grid of Plugins */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plugins.map((plugin) => {
          const isInstalling = installingId === plugin.id;
          return (
            <div
              key={plugin.id}
              className="rounded-[20px] bg-white border border-[#e6e6e6] hover:border-[#cfd2cf] transition-all overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div
                  className="p-2.5 pb-0 cursor-pointer"
                  onClick={() => onTryPluginOnWheel(plugin.petalId)}
                >
                  <MotionGraphicPreview type={plugin.motionType} compact />
                </div>

                <div className="p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#ff5200]">
                      {plugin.category}
                    </span>
                    <span className="text-[11px] text-[#828782]">{plugin.size}</span>
                  </div>
                  <h3 className="text-[17px] font-medium tracking-[-0.35px] text-[#282b29]">
                    {plugin.name}
                  </h3>
                  <p className="text-xs text-[#767d78] leading-relaxed">{plugin.tagline}</p>
                </div>
              </div>

              <div className="px-5 py-3.5 border-t border-[#f0f1ef] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onTryPluginOnWheel(plugin.petalId)}
                  className="text-xs font-semibold text-[#666d67] hover:text-[#282b29] transition-colors"
                >
                  Try on wheel <span className="text-[#ff5200]">↗</span>
                </button>

                <button
                  type="button"
                  disabled={isInstalling}
                  onClick={() => handlePluginAction(plugin)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isInstalling
                      ? 'bg-[#fff0e4] text-[#ff5200]'
                      : plugin.installed && plugin.enabled
                      ? 'bg-[#f2f4f2] text-[#282b29] hover:bg-[#e6e9e6]'
                      : 'bg-[#ff5200] text-white shadow-sm hover:opacity-95'
                  }`}
                >
                  {isInstalling ? (
                    <>
                      <Sparkles className="w-3 h-3 animate-spin" />
                      <span>Installing…</span>
                    </>
                  ) : plugin.installed && plugin.enabled ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#ff5200]" />
                      <span>Enabled</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3 h-3" />
                      <span>Enable</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Minimalist Custom Petal Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreateModal(false)}
            className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.form
              initial={{ scale: 0.94, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleCreateCustom}
              className="w-full max-w-md rounded-[24px] bg-white border border-[#e6e6e6] p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium tracking-[-0.4px] text-[#282b29]">
                  Add Custom Wheel Action
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-7 h-7 rounded-full bg-[#f4f4f4] flex items-center justify-center text-[#767d78] hover:text-black"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#565d57] mb-1">
                    Petal Label (Short)
                  </label>
                  <input
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="e.g. UPSCALE or SCRIPT"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#f8f9f8] border border-[#dfe2df] text-sm text-[#282b29] focus:outline-none focus:border-[#ff5200]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#565d57] mb-1">
                    Action Title
                  </label>
                  <input
                    type="text"
                    value={customFullName}
                    onChange={(e) => setCustomFullName(e.target.value)}
                    placeholder="e.g. Run Custom Python Script"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#f8f9f8] border border-[#dfe2df] text-sm text-[#282b29] focus:outline-none focus:border-[#ff5200]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#565d57] mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={customDesc}
                    onChange={(e) => setCustomDesc(e.target.value)}
                    placeholder="Processes dropped file with custom command"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#f8f9f8] border border-[#dfe2df] text-sm text-[#282b29] focus:outline-none focus:border-[#ff5200]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-full bg-[#f4f4f4] text-xs font-medium text-[#565d57]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#ff5200] text-white text-xs font-medium shadow-sm"
                >
                  Add to Wheel
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
