'use client';

import { usePreferencesStore } from '@tysiac/game-logic';

class SoundManager {
  private ctx: AudioContext | null = null;
  private busyUntil = 0;
  private currentPriority = 0;

  private getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  get muted() {
    return !usePreferencesStore.getState().soundEnabled;
  }

  /** Returns true if the sound can play (no higher-priority sound active) and claims the slot */
  private canPlay(priority: number, durationMs: number): boolean {
    const now = Date.now();
    if (now < this.busyUntil && priority < this.currentPriority) {
      return false; // Higher-priority sound still playing
    }
    this.busyUntil = now + durationMs;
    this.currentPriority = priority;
    return true;
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
    if (this.muted) return;
    const ctx = this.getCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  private playChord(frequencies: number[], duration: number, type: OscillatorType = 'sine', volume = 0.1) {
    frequencies.forEach(f => this.playTone(f, duration, type, volume));
  }

  /** Short percussive click for playing a card */
  cardPlay() {
    if (this.muted) return;
    if (!this.canPlay(1, 50)) return;
    const ctx = this.getCtx();
    if (!ctx) return;

    // White noise burst for card "snap"
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    // Bandpass to make it sound more like a card
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 1;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  /** Gentle notification for your turn */
  yourTurn() {
    if (!this.canPlay(2, 320)) return;
    this.playTone(880, 0.15, 'sine', 0.12);
    setTimeout(() => this.playTone(1100, 0.2, 'sine', 0.12), 120);
  }

  /** Quick upward blip for bidding */
  bid() {
    if (!this.canPlay(1, 100)) return;
    this.playTone(660, 0.1, 'triangle', 0.1);
  }

  /** Satisfying sweep for winning a trick */
  trickWon() {
    if (!this.canPlay(3, 400)) return;
    this.playTone(523, 0.15, 'triangle', 0.1);
    setTimeout(() => this.playTone(659, 0.15, 'triangle', 0.1), 100);
    setTimeout(() => this.playTone(784, 0.2, 'triangle', 0.1), 200);
  }

  /** Royal fanfare for declaring a marriage */
  marriage() {
    if (!this.canPlay(4, 800)) return;
    this.playChord([523, 659, 784], 0.4, 'sine', 0.08);
    setTimeout(() => this.playChord([587, 740, 880], 0.5, 'sine', 0.08), 300);
  }

  /** Resolution chord for round end */
  roundEnd() {
    if (!this.canPlay(6, 600)) return;
    this.playChord([440, 554, 659], 0.6, 'triangle', 0.08);
  }

  /** Victory fanfare for game win */
  gameWin() {
    if (!this.canPlay(7, 1400)) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.3, 'sine', 0.12), i * 150);
    });
    setTimeout(() => this.playChord([1047, 1319, 1568], 0.8, 'sine', 0.1), 600);
  }

  /** Special dramatic chord for wykladana */
  wykladana() {
    if (!this.canPlay(5, 1050)) return;
    this.playChord([392, 494, 587], 0.3, 'sine', 0.1);
    setTimeout(() => this.playChord([523, 659, 784, 1047], 0.8, 'sine', 0.1), 250);
  }
}

export const soundManager = new SoundManager();
