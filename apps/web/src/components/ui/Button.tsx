'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', glow = false, children, disabled, ...props }, ref) => {
    const baseStyles =
      'relative inline-flex items-center justify-center font-medium transition-all duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-table-950';

    // Disabled styles - more obviously grayed out
    const disabledStyles = disabled
      ? 'opacity-40 cursor-not-allowed pointer-events-none grayscale'
      : '';

    const variants = {
      primary: disabled
        ? 'bg-gray-600 text-gray-400 border border-transparent'
        : 'bg-gradient-to-r from-gold-500 to-gold-600 text-table-950 hover:from-gold-400 hover:to-gold-500 focus:ring-gold-500 shadow-lg hover:shadow-glow border border-transparent',
      secondary: disabled
        ? 'bg-table-900 text-white/30 border border-table-700'
        : 'bg-table-800/80 text-white border border-table-600 hover:bg-table-700 focus:ring-table-500',
      ghost: disabled
        ? 'bg-transparent text-white/30 border border-transparent'
        : 'bg-transparent text-white hover:bg-white/10 focus:ring-white/50 border border-transparent',
      danger: disabled
        ? 'bg-gray-600 text-gray-400 border border-transparent'
        : 'bg-red-600 text-white hover:bg-red-500 focus:ring-red-500 border border-transparent',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          disabledStyles,
          glow && !disabled && 'btn-glow',
          className
        )}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

// Motion-enhanced button
export const MotionButton = motion(Button);
