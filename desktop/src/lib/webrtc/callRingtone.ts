/**
 * Procedural ring / ringback tones via Web Audio (no asset files).
 * - incoming: classic dual-burst ringtone
 * - outgoing: softer ringback while waiting for answer
 */
export type RingtoneMode = 'incoming' | 'outgoing';

export class CallRingtone {
  private ctx: AudioContext | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private mode: RingtoneMode | null = null;
  private gain: GainNode | null = null;

  private ensureCtx() {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0.18;
      this.gain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private beep(freqs: number[], durationMs: number, volume = 0.18) {
    const ctx = this.ensureCtx();
    if (ctx.state === 'suspended') void ctx.resume();
    if (!this.gain) return;
    this.gain.gain.setValueAtTime(volume, ctx.currentTime);

    const stopAt = ctx.currentTime + durationMs / 1000;
    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, stopAt);
      osc.connect(g);
      g.connect(this.gain);
      osc.start(ctx.currentTime);
      osc.stop(stopAt + 0.02);
    }
  }

  private playIncomingBurst() {
    // Two short rings, pause, repeat (phone-like)
    this.beep([880, 1175], 380, 0.2);
    window.setTimeout(() => this.beep([880, 1175], 380, 0.2), 450);
  }

  private playOutgoingBurst() {
    // Softer single ringback tone
    this.beep([440, 480], 900, 0.12);
  }

  start(mode: RingtoneMode) {
    if (this.mode === mode) return;
    this.stop();
    this.mode = mode;
    void this.ensureCtx().resume().catch(() => undefined);

    if (mode === 'incoming') {
      this.playIncomingBurst();
      this.intervalId = setInterval(() => this.playIncomingBurst(), 2200);
    } else {
      this.playOutgoingBurst();
      this.intervalId = setInterval(() => this.playOutgoingBurst(), 3000);
    }
  }

  stop() {
    if (this.intervalId != null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.mode = null;
    if (this.gain && this.ctx) {
      try {
        this.gain.gain.setValueAtTime(0, this.ctx.currentTime);
      } catch {
        /* ignore */
      }
    }
  }

  dispose() {
    this.stop();
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.gain = null;
  }
}
