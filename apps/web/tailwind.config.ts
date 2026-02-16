import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Card table — driven by CSS variables so themes can swap them
        table: {
          50: 'rgb(var(--table-50) / <alpha-value>)',
          100: 'rgb(var(--table-100) / <alpha-value>)',
          200: 'rgb(var(--table-200) / <alpha-value>)',
          300: 'rgb(var(--table-300) / <alpha-value>)',
          400: 'rgb(var(--table-400) / <alpha-value>)',
          500: 'rgb(var(--table-500) / <alpha-value>)',
          600: 'rgb(var(--table-600) / <alpha-value>)',
          700: 'rgb(var(--table-700) / <alpha-value>)',
          800: 'rgb(var(--table-800) / <alpha-value>)',
          900: 'rgb(var(--table-900) / <alpha-value>)',
          950: 'rgb(var(--table-950) / <alpha-value>)',
        },
        // Gold accents (theme-independent)
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'electric': 'electric 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'card-deal': 'cardDeal 0.5s ease-out',
        'card-play': 'cardPlay 0.3s ease-out',
      },
      keyframes: {
        electric: {
          '0%, 100%': {
            opacity: '1',
            filter: 'brightness(1)',
          },
          '50%': {
            opacity: '0.8',
            filter: 'brightness(1.3)',
          },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        cardDeal: {
          '0%': { transform: 'translateY(-100px) scale(0.8)', opacity: '0' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        cardPlay: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(ellipse at center, var(--tw-gradient-stops))',
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
        'glow': '0 0 20px rgba(251, 191, 36, 0.4)',
        'glow-green': '0 0 20px rgba(34, 197, 94, 0.4)',
        'glow-gold': '0 0 20px rgba(251, 191, 36, 0.15)',
        'panel': '0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2)',
      },
    },
  },
  plugins: [],
};

export default config;
