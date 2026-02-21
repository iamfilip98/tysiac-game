'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onSwitchToRegister: () => void;
  isLoading: boolean;
  error: string | null;
}

export function LoginForm({ onLogin, onSwitchToRegister, isLoading, error }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() && password) {
      onLogin(email.trim(), password);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="login-email"
        label="Email"
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />

      <Input
        id="login-password"
        label="Password"
        type="password"
        placeholder="Enter password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
      />

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isLoading || !email.trim() || !password}
        glow
      >
        {isLoading ? 'Logging in...' : 'Log In'}
      </Button>

      <p className="text-center text-sm text-white/50">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="text-gold-400 hover:text-gold-300 underline"
        >
          Register
        </button>
      </p>
    </form>
  );
}
