'use client';

// SoundManager singleton that handles game sound effects
// Uses Web Audio API for low-latency playback with graceful fallback

type SoundName =
  | 'cardPlace' | 'cardFlip' | 'bid' | 'pass'
  | 'trickWin' | 'roundWin' | 'gameWin'
  | 'turnNotification' | 'error' | 'emote';

class SoundManager {
  private static instance: SoundManager;
  private audioContext: AudioContext | null = null;
  private buffers: Map<SoundName, AudioBuffer> = new Map();
  private volume: number = 0.5;
  private muted: boolean = false;
  private initialized: boolean = false;

  // Sound file paths (user adds actual files later)
  private readonly soundPaths: Record<SoundName, string> = {
    cardPlace: '/sounds/card-place.mp3',
    cardFlip: '/sounds/card-flip.mp3',
    bid: '/sounds/bid.mp3',
    pass: '/sounds/pass.mp3',
    trickWin: '/sounds/trick-win.mp3',
    roundWin: '/sounds/round-win.mp3',
    gameWin: '/sounds/game-win.mp3',
    turnNotification: '/sounds/turn.mp3',
    error: '/sounds/error.mp3',
    emote: '/sounds/emote.mp3',
  };

  private constructor() {
    // Load settings from localStorage
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

  // Must be called after user interaction (click/tap)
  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Preload all sounds
      await Promise.allSettled(
        Object.entries(this.soundPaths).map(async ([name, path]) => {
          try {
            const response = await fetch(path);
            if (!response.ok) return; // File doesn't exist yet, that's OK
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
            this.buffers.set(name as SoundName, audioBuffer);
          } catch {
            // Silently skip missing sound files
          }
        })
      );
      this.initialized = true;
    } catch {
      // AudioContext not supported
    }
  }

  play(sound: SoundName): void {
    if (this.muted || !this.audioContext || !this.initialized) return;
    const buffer = this.buffers.get(sound);
    if (!buffer) return;

    try {
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();
      source.buffer = buffer;
      gainNode.gain.value = this.volume;
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      source.start(0);
    } catch {
      // Playback failed, ignore
    }
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
