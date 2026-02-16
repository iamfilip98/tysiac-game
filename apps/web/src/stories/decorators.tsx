import React from 'react';
import { ToastProvider } from '@/components/ui/Toast';

/** Felt table background decorator for game components */
export function FeltDecorator({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-[400px] min-w-[600px] p-8 flex items-center justify-center felt-texture"
      style={{
        background: `radial-gradient(ellipse at center, var(--felt-glow), var(--felt-primary) 50%, var(--felt-secondary))`,
      }}
    >
      {children}
    </div>
  );
}

/** Small felt decorator for compact components */
export function FeltDecoratorCompact({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="p-6 flex items-center justify-center felt-texture rounded-xl"
      style={{
        background: `radial-gradient(ellipse at center, var(--felt-glow), var(--felt-primary) 50%, var(--felt-secondary))`,
      }}
    >
      {children}
    </div>
  );
}

/** Toast provider wrapper for stories that need toasts */
export function WithToasts({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
