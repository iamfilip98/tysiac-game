interface QueenFaceProps {
  color: 'red' | 'black';
}

export function QueenFace({ color }: QueenFaceProps) {
  const fill = color === 'red' ? '#DC2626' : '#1F2937';
  const accent = color === 'red' ? '#B91C1C' : '#111827';
  const gold = '#DAA520';
  const goldLight = '#F5D060';
  const skin = '#F5DEB3';
  const hair = color === 'red' ? '#8B4513' : '#2D1B0E';

  return (
    <svg
      viewBox="0 0 60 80"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ width: '100%', height: '100%' }}
    >
      {/* Dress / body */}
      <path
        d="M12 48 L18 42 L42 42 L48 48 L56 80 L4 80 Z"
        fill={fill}
      />
      {/* Dress neckline */}
      <path
        d="M22 42 Q30 48 38 42"
        fill={skin}
      />
      {/* Dress decoration */}
      <path
        d="M20 55 Q30 58 40 55"
        fill="none"
        stroke={gold}
        strokeWidth="1"
        opacity="0.7"
      />
      <path
        d="M16 65 Q30 69 44 65"
        fill="none"
        stroke={gold}
        strokeWidth="1"
        opacity="0.5"
      />

      {/* Neck */}
      <rect x="27" y="36" width="6" height="7" rx="2" fill={skin} />

      {/* Hair behind face */}
      <ellipse cx="30" cy="24" rx="15" ry="16" fill={hair} />

      {/* Hair flowing sides */}
      <path
        d="M15 24 Q12 35 14 46 Q15 42 17 38 Q16 30 18 24"
        fill={hair}
      />
      <path
        d="M45 24 Q48 35 46 46 Q45 42 43 38 Q44 30 42 24"
        fill={hair}
      />

      {/* Face */}
      <ellipse cx="30" cy="28" rx="10" ry="12" fill={skin} />

      {/* Eyes */}
      <ellipse cx="25.5" cy="26" rx="1.6" ry="1.3" fill={accent} />
      <ellipse cx="34.5" cy="26" rx="1.6" ry="1.3" fill={accent} />

      {/* Eyelashes */}
      <path d="M23.5 24.5 Q25.5 23.5 27.5 24.5" fill="none" stroke={accent} strokeWidth="0.5" />
      <path d="M32.5 24.5 Q34.5 23.5 36.5 24.5" fill="none" stroke={accent} strokeWidth="0.5" />

      {/* Nose */}
      <path d="M30 27 L29 31 L31 31" fill="none" stroke={accent} strokeWidth="0.5" />

      {/* Lips */}
      <path d="M26.5 33 Q30 35.5 33.5 33" fill={color === 'red' ? '#E74C3C' : '#C0392B'} opacity="0.7" />
      <path d="M26.5 33 Q30 31.5 33.5 33" fill={color === 'red' ? '#E74C3C' : '#C0392B'} opacity="0.5" />

      {/* Blush */}
      <circle cx="22" cy="31" r="2.5" fill="#FFB6C1" opacity="0.3" />
      <circle cx="38" cy="31" r="2.5" fill="#FFB6C1" opacity="0.3" />

      {/* Crown base */}
      <rect x="20" y="13" width="20" height="4" rx="1" fill={gold} />

      {/* Crown arches */}
      <path d="M20,13 Q23,7 26,13" fill={gold} />
      <path d="M26,13 Q30,5 34,13" fill={gold} />
      <path d="M34,13 Q37,7 40,13" fill={gold} />

      {/* Crown jewels */}
      <circle cx="23" cy="9" r="1.2" fill={fill} />
      <circle cx="30" cy="7" r="1.5" fill={fill} />
      <circle cx="37" cy="9" r="1.2" fill={fill} />

      {/* Crown highlight */}
      <rect x="21" y="14" width="18" height="1.2" fill={goldLight} opacity="0.5" />

      {/* Necklace */}
      <path
        d="M23 40 Q30 43 37 40"
        fill="none"
        stroke={gold}
        strokeWidth="1"
      />
      <circle cx="30" cy="42.5" r="1.5" fill={gold} />
    </svg>
  );
}
