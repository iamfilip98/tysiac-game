'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { SignIn, SignUp } from '@clerk/nextjs';
import { Button } from '@/components/ui/Button';

interface AuthGateProps {
  onPlayAsGuest: () => void;
}

export function AuthGate({ onPlayAsGuest }: AuthGateProps) {
  const [mode, setMode] = useState<'choice' | 'login' | 'register'>('choice');

  if (mode === 'login') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <SignIn
          routing="hash"
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'bg-transparent shadow-none border-0 p-0',
              headerTitle: 'text-white',
              headerSubtitle: 'text-white/60',
              formFieldLabel: 'text-white/80',
              formFieldInput: 'bg-white/10 border-white/20 text-white placeholder:text-white/40',
              formButtonPrimary: 'bg-gold-500 hover:bg-gold-600 text-black font-semibold',
              footerActionLink: 'text-gold-400 hover:text-gold-300',
              identityPreviewEditButton: 'text-gold-400',
              formFieldAction: 'text-gold-400',
              footerAction: 'text-white/50',
              dividerLine: 'bg-white/10',
              dividerText: 'text-white/40',
              socialButtonsBlockButton: 'bg-white/10 border-white/20 text-white hover:bg-white/20',
              socialButtonsBlockButtonText: 'text-white',
            },
          }}
        />
        <button
          onClick={() => setMode('choice')}
          className="mt-3 w-full text-center text-sm text-white/40 hover:text-white/60"
        >
          Back
        </button>
      </motion.div>
    );
  }

  if (mode === 'register') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <SignUp
          routing="hash"
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'bg-transparent shadow-none border-0 p-0',
              headerTitle: 'text-white',
              headerSubtitle: 'text-white/60',
              formFieldLabel: 'text-white/80',
              formFieldInput: 'bg-white/10 border-white/20 text-white placeholder:text-white/40',
              formButtonPrimary: 'bg-gold-500 hover:bg-gold-600 text-black font-semibold',
              footerActionLink: 'text-gold-400 hover:text-gold-300',
              identityPreviewEditButton: 'text-gold-400',
              formFieldAction: 'text-gold-400',
              footerAction: 'text-white/50',
              dividerLine: 'bg-white/10',
              dividerText: 'text-white/40',
              socialButtonsBlockButton: 'bg-white/10 border-white/20 text-white hover:bg-white/20',
              socialButtonsBlockButtonText: 'text-white',
            },
          }}
        />
        <button
          onClick={() => setMode('choice')}
          className="mt-3 w-full text-center text-sm text-white/40 hover:text-white/60"
        >
          Back
        </button>
      </motion.div>
    );
  }

  // Choice mode — default view
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-sm space-y-3"
    >
      <Button
        variant="primary"
        className="w-full py-3 text-base"
        onClick={onPlayAsGuest}
        glow
      >
        Play as Guest
      </Button>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-xs text-white/40 uppercase tracking-wider">or</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <div className="flex gap-3">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => setMode('login')}
        >
          Log In
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => setMode('register')}
        >
          Register
        </Button>
      </div>

      <p className="text-center text-xs text-white/30">
        Register to track stats and keep your name across devices
      </p>
    </motion.div>
  );
}
