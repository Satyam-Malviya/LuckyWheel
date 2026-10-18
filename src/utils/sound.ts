// Authentic Tactile Sound Engine for LuckyWheel (uses actual highlight.wav + Web Audio)

class SoundEngine {
  private ctx: AudioContext | null = null;
  private highlightBuffer: AudioBuffer | null = null;
  private loadingPromise: Promise<void> | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private lastTickTime: number = 0;
  private lastBloomTime: number = 0;
  public enabled: boolean = true;

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx({ latencyHint: 'interactive' });
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && !this.highlightBuffer && !this.loadingPromise) {
      this.loadingPromise = fetch('./assets/highlight.wav')
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((buf) => (buf && this.ctx ? this.ctx.decodeAudioData(buf) : null))
        .then((decoded) => {
          if (decoded) this.highlightBuffer = decoded;
        })
        .catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Play the exact crisp highlight tick from the reel when hovering over radial petals.
   * Guarded with a 45ms cooldown and single-voice cutoff so it never buzzes or overlaps.
   */
  playPetalTick(index: number = 0, total: number = 8) {
    const nowMs = performance.now();
    if (nowMs - this.lastTickTime < 45) return;
    this.lastTickTime = nowMs;

    const ctx = this.getContext();
    if (!ctx) return;

    if (this.highlightBuffer) {
      try {
        if (this.activeSource) {
          try {
            this.activeSource.stop();
          } catch {}
          this.activeSource = null;
        }
        const src = ctx.createBufferSource();
        const gain = ctx.createGain();
        src.buffer = this.highlightBuffer;
        src.playbackRate.value = 0.96 + (index / Math.max(1, total)) * 0.08;
        gain.gain.value = 0.7;
        src.connect(gain);
        gain.connect(ctx.destination);
        this.activeSource = src;
        src.start(0);
        return;
      } catch {}
    }

    // Fallback Web Audio tick
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const baseFreq = 640 + (index / Math.max(1, total)) * 160;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.2, now + 0.022);
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.03);
    } catch {}
  }

  playWheelBloom(_mode?: string) {
    const nowMs = performance.now();
    if (nowMs - this.lastBloomTime < 220) return;
    this.lastBloomTime = nowMs;
    this.playPetalTick(2, 8);
  }

  playDropConfirm() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [587.33, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);
        gain.gain.setValueAtTime(0.055, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.16);
      });
    } catch {}
  }
}

export const soundEngine = new SoundEngine();
