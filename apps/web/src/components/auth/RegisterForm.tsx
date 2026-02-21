'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface RegisterFormProps {
  onRegister: (email: string, password: string, displayName: string) => Promise<void>;
  onSwitchToLogin: () => void;
  isLoading: boolean;
  error: string | null;
}

export function RegisterForm({ onRegister, onSwitchToLogin, isLoading, error }: RegisterFormProps) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    onRegister(email.trim(), password, displayName.trim());
  };

  const displayError = localError || error;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="register-name"
        label="Display Name"
        placeholder="Enter your name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        maxLength={20}
        required
        autoComplete="username"
      />

      <Input
        id="register-email"
        label="Email"
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />

      <Input
        id="register-password"
        label="Password"
        type="password"
        placeholder="Min. 6 characters"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={6}
        required
        autoComplete="new-password"
      />

      <Input
        id="register-confirm"
        label="Confirm Password"
        type="password"
        placeholder="Repeat password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        autoComplete="new-password"
      />

      {displayError && (
        <p className="text-sm text-red-400">{displayError}</p>
      )}

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isLoading || !displayName.trim() || !email.trim() || !password || !confirmPassword}
        glow
      >
        {isLoading ? 'Creating account...' : 'Create Account'}
      </Button>

      <p className="text-center text-sm text-white/50">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-gold-400 hover:text-gold-300 underline"
        >
          Log In
        </button>
      </p>
    </form>
  );
}
