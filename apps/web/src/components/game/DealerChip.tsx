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
      className={cn('w-5 h-5', className)}
      role="img"
      aria-label="Dealer"
    >
      <title>Dealer</title>

      {/* Outer ring - dark base */}
      <circle cx="32" cy="32" r="30" fill="#1a1a1a" stroke="#444" strokeWidth="2" />

      {/* Notch pattern - alternating red/white edge dashes */}
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (i * 360) / 16;
        const rad = (angle * Math.PI) / 180;
        const x1 = 32 + 26 * Math.cos(rad);
        const y1 = 32 + 26 * Math.sin(rad);
        const x2 = 32 + 30 * Math.cos(rad);
        const y2 = 32 + 30 * Math.sin(rad);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={i % 2 === 0 ? '#dc2626' : '#ffffff'}
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      })}

      {/* Inner ring border */}
      <circle cx="32" cy="32" r="21" fill="none" stroke="#dc2626" strokeWidth="1.5" />

      {/* Inner face - dark */}
      <circle cx="32" cy="32" r="19" fill="#111" />

      {/* Center "D" letter - white for max contrast */}
      <text
        x="32"
        y="33"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        fontSize="22"
        fontWeight="bold"
        fontFamily="serif"
      >
        D
      </text>
    </svg>
  );
}
