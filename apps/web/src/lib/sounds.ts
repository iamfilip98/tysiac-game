'use client';

// SoundManager singleton using Web Audio API oscillator synthesis
// No external sound files needed — all sounds are generated programmatically

type SoundName =
  | 'cardPlace' | 'cardFlip' | 'bid' | 'pass'
  | 'trickWin' | 'roundWin' | 'gameWin'
  | 'turnNotification' | 'error' | 'emote';

class SoundManager {
  private static instance: SoundManager;
  private audioContext: AudioContext | null = null;
  private volume: number = 0.5;
  private muted: boolean = false;
  private initialized: boolean = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tysiac-sound-settings');
      if (saved) {
        try {
          const settings = JSON.parse(saved);
          this.volume = settings.volume ?? 0.5;
          this.muted = settings.muted ?? false;
        } catch {}
      }
    }
  }

  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.initialized = true;
    } catch {
      // AudioContext not supported
    }
  }

  private ensureContext(): AudioContext | null {
    if (!this.audioContext && typeof window !== 'undefined') {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.initialized = true;
      } catch {
        return null;
      }
    }
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  play(sound: SoundName): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      switch (sound) {
        case 'cardPlace': this.synthCardPlace(ctx); break;
        case 'cardFlip': this.synthCardFlip(ctx); break;
        case 'bid': this.synthBid(ctx); break;
        case 'pass': this.synthPass(ctx); break;
        case 'trickWin': this.synthTrickWin(ctx); break;
        case 'roundWin': this.synthRoundWin(ctx); break;
        case 'gameWin': this.synthGameWin(ctx); break;
        case 'turnNotification': this.synthTurn(ctx); break;
        case 'error': this.synthError(ctx); break;
        case 'emote': this.synthEmote(ctx); break;
      }
    } catch {
      // Playback failed
    }
  }

  // --- Sound synthesis methods ---

  private tone(ctx: AudioContext, freq: number, start: number, dur: number, vol: number, type: OscillatorType = 'sine') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol * this.volume, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + dur);
  }

  private noise(ctx: AudioContext, start: number, dur: number, vol: number) {
    const bufferSize = ctx.sampleRate * dur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    gain.gain.setValueAtTime(vol * this.volume, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(ctx.currentTime + start);
    source.stop(ctx.currentTime + start + dur);
  }

  private synthCardPlace(ctx: AudioContext) {
    // Short thud + high click
    this.noise(ctx, 0, 0.06, 0.15);
    this.tone(ctx, 800, 0, 0.04, 0.12, 'triangle');
  }

  private synthCardFlip(ctx: AudioContext) {
    // Quick swoosh
    this.noise(ctx, 0, 0.08, 0.1);
    this.tone(ctx, 1200, 0.01, 0.05, 0.08, 'triangle');
  }

  private synthBid(ctx: AudioContext) {
    // Rising two-note
    this.tone(ctx, 440, 0, 0.1, 0.15, 'triangle');
    this.tone(ctx, 554, 0.08, 0.12, 0.15, 'triangle');
  }

  private synthPass(ctx: AudioContext) {
    // Descending soft tone
    this.tone(ctx, 400, 0, 0.12, 0.1, 'sine');
    this.tone(ctx, 320, 0.08, 0.15, 0.08, 'sine');
  }

  private synthTrickWin(ctx: AudioContext) {
    // Bright ascending arpeggio
    this.tone(ctx, 523, 0, 0.12, 0.15, 'triangle');
    this.tone(ctx, 659, 0.08, 0.12, 0.15, 'triangle');
    this.tone(ctx, 784, 0.16, 0.15, 0.12, 'triangle');
  }

  private synthRoundWin(ctx: AudioContext) {
    // Fanfare
    this.tone(ctx, 523, 0, 0.15, 0.18, 'triangle');
    this.tone(ctx, 659, 0.1, 0.15, 0.18, 'triangle');
    this.tone(ctx, 784, 0.2, 0.15, 0.18, 'triangle');
    this.tone(ctx, 1047, 0.3, 0.25, 0.15, 'sine');
  }

  private synthGameWin(ctx: AudioContext) {
    // Triumphant fanfare
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((freq, i) => {
      this.tone(ctx, freq, i * 0.1, 0.18, 0.15, 'triangle');
    });
  }

  private synthTurn(ctx: AudioContext) {
    // Gentle ping
    this.tone(ctx, 880, 0, 0.08, 0.12, 'sine');
    this.tone(ctx, 1100, 0.04, 0.1, 0.08, 'sine');
  }

  private synthError(ctx: AudioContext) {
    // Low buzz
    this.tone(ctx, 200, 0, 0.15, 0.12, 'square');
    this.tone(ctx, 180, 0.1, 0.15, 0.1, 'square');
  }

  private synthEmote(ctx: AudioContext) {
    // Playful pop
    this.tone(ctx, 600, 0, 0.06, 0.12, 'sine');
    this.tone(ctx, 900, 0.04, 0.08, 0.1, 'triangle');
  }

  // Convenience methods
  playCardPlace() { this.play('cardPlace'); }
  playCardFlip() { this.play('cardFlip'); }
  playBid() { this.play('bid'); }
  playPass() { this.play('pass'); }
  playTrickWin() { this.play('trickWin'); }
  playRoundWin() { this.play('roundWin'); }
  playGameWin() { this.play('gameWin'); }
  playTurnNotification() { this.play('turnNotification'); }
  playError() { this.play('error'); }
  playEmote() { this.play('emote'); }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.saveSettings();
  }

  getVolume(): number { return this.volume; }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.saveSettings();
    return this.muted;
  }

  isMuted(): boolean { return this.muted; }

  private saveSettings(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tysiac-sound-settings', JSON.stringify({
        volume: this.volume,
        muted: this.muted,
      }));
    }
  }
}

export const soundManager = SoundManager.getInstance();
