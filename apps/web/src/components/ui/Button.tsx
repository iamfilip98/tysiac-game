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
      'relative inline-flex items-center justify-center font-medium transition-all duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-table-950 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
      primary:
        'bg-gradient-to-r from-gold-500 to-gold-600 text-table-950 hover:from-gold-400 hover:to-gold-500 focus:ring-gold-500 shadow-lg hover:shadow-glow',
      secondary:
        'bg-table-800/80 text-white border border-table-600 hover:bg-table-700 focus:ring-table-500',
      ghost:
        'bg-transparent text-white hover:bg-white/10 focus:ring-white/50',
      danger:
        'bg-red-600 text-white hover:bg-red-500 focus:ring-red-500',
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
          glow && 'btn-glow',
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
