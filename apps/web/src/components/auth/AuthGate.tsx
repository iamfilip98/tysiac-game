'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { Button } from '@/components/ui/Button';

interface AuthGateProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, displayName: string) => Promise<void>;
  onPlayAsGuest: () => void;
  isLoading: boolean;
  error: string | null;
}

export function AuthGate({ onLogin, onRegister, onPlayAsGuest, isLoading, error }: AuthGateProps) {
  const [mode, setMode] = useState<'choice' | 'login' | 'register'>('choice');

  if (mode === 'login') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="rounded-xl border border-gold-500/20 shadow-glow-gold">
          <div
            className="bg-gradient-to-b from-table-800/90 to-table-900/90 backdrop-blur-md p-6 rounded-xl"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
          >
            <h2 className="text-xl font-bold text-white mb-4">Log In</h2>
            <LoginForm
              onLogin={onLogin}
              onSwitchToRegister={() => setMode('register')}
              isLoading={isLoading}
              error={error}
            />
            <button
              onClick={() => setMode('choice')}
              className="mt-3 w-full text-center text-sm text-white/40 hover:text-white/60"
            >
              Back
            </button>
          </div>
        </div>
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
        <div className="rounded-xl border border-gold-500/20 shadow-glow-gold">
          <div
            className="bg-gradient-to-b from-table-800/90 to-table-900/90 backdrop-blur-md p-6 rounded-xl"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
          >
            <h2 className="text-xl font-bold text-white mb-4">Create Account</h2>
            <RegisterForm
              onRegister={onRegister}
              onSwitchToLogin={() => setMode('login')}
              isLoading={isLoading}
              error={error}
            />
            <button
              onClick={() => setMode('choice')}
              className="mt-3 w-full text-center text-sm text-white/40 hover:text-white/60"
            >
              Back
            </button>
          </div>
        </div>
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
