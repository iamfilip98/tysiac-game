'use client';

import { cn } from '@/lib/utils';

interface DealerChipProps {
  className?: string;
}

export function DealerChip({ className }: DealerChipProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-4 h-4 animate-[spin_8s_linear_infinite]', className)}
      role="img"
      aria-label="Dealer"
    >
      <title>Dealer</title>

      {/* Outer ring */}
      <circle cx="32" cy="32" r="30" fill="#b45309" stroke="#92400e" strokeWidth="2" />

      {/* Notch pattern - alternating edge dashes like a poker chip */}
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (i * 360) / 16;
        const rad = (angle * Math.PI) / 180;
        const x1 = 32 + 28 * Math.cos(rad);
        const y1 = 32 + 28 * Math.sin(rad);
        const x2 = 32 + 31 * Math.cos(rad);
        const y2 = 32 + 31 * Math.sin(rad);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={i % 2 === 0 ? '#fbbf24' : '#fef3c7'}
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      })}

      {/* Inner ring border */}
      <circle cx="32" cy="32" r="22" fill="none" stroke="#fbbf24" strokeWidth="1.5" />

      {/* Inner face */}
      <circle cx="32" cy="32" r="20" fill="#d97706" />

      {/* Inner decorative ring */}
      <circle cx="32" cy="32" r="15" fill="none" stroke="#fbbf24" strokeWidth="0.75" opacity="0.6" />

      {/* Center "D" letter */}
      <text
        x="32"
        y="32"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fef3c7"
        fontSize="20"
        fontWeight="bold"
        fontFamily="serif"
        style={{ animationDirection: 'reverse' }}
        className="animate-[spin_8s_linear_infinite] origin-center [animation-direction:reverse]"
      >
        D
      </text>
    </svg>
  );
}
