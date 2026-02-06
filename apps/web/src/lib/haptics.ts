'use client';

class HapticManager {
  private supported: boolean;

  constructor() {
    this.supported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  }

  light(): void {
    if (this.supported) navigator.vibrate(10);
  }

  medium(): void {
    if (this.supported) navigator.vibrate(25);
  }

  heavy(): void {
    if (this.supported) navigator.vibrate(50);
  }

  success(): void {
    if (this.supported) navigator.vibrate([10, 50, 20]);
  }

  error(): void {
    if (this.supported) navigator.vibrate([50, 30, 50]);
  }
}

export const haptics = new HapticManager();
