interface KingFaceProps {
  color: 'red' | 'black';
}

export function KingFace({ color }: KingFaceProps) {
  const fill = color === 'red' ? '#DC2626' : '#1F2937';
  const accent = color === 'red' ? '#B91C1C' : '#111827';
  const gold = '#DAA520';
  const goldLight = '#F5D060';
  const skin = '#F5DEB3';

  return (
    <svg
      viewBox="0 0 60 80"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ width: '100%', height: '100%' }}
    >
      {/* Robe / body */}
      <path
        d="M10 52 L15 44 L45 44 L50 52 L54 80 L6 80 Z"
        fill={fill}
      />
      {/* Robe collar */}
      <path
        d="M20 44 L30 50 L40 44"
        fill="none"
        stroke={gold}
        strokeWidth="1.5"
      />
      {/* Robe center stripe */}
      <rect x="28" y="50" width="4" height="30" fill={gold} opacity="0.6" />

      {/* Neck */}
      <rect x="26" y="38" width="8" height="8" rx="2" fill={skin} />

      {/* Face */}
      <ellipse cx="30" cy="30" rx="11" ry="13" fill={skin} />

      {/* Eyes */}
      <ellipse cx="25" cy="28" rx="1.8" ry="1.2" fill={accent} />
      <ellipse cx="35" cy="28" rx="1.8" ry="1.2" fill={accent} />

      {/* Eyebrows */}
      <path d="M22 25.5 L28 25" fill="none" stroke={accent} strokeWidth="0.8" />
      <path d="M32 25 L38 25.5" fill="none" stroke={accent} strokeWidth="0.8" />

      {/* Nose */}
      <path d="M30 29 L28.5 33 L31.5 33" fill="none" stroke={accent} strokeWidth="0.6" />

      {/* Mouth */}
      <path d="M26 35.5 Q30 37.5 34 35.5" fill="none" stroke={accent} strokeWidth="0.7" />

      {/* Beard */}
      <path
        d="M19 32 Q19 42 30 44 Q41 42 41 32"
        fill="none"
        stroke={accent}
        strokeWidth="1"
      />
      <path
        d="M21 34 Q21 41 30 43 Q39 41 39 34"
        fill={accent}
        opacity="0.25"
      />
      {/* Beard lines */}
      <path d="M25 36 Q27 41 30 43" fill="none" stroke={accent} strokeWidth="0.4" opacity="0.5" />
      <path d="M35 36 Q33 41 30 43" fill="none" stroke={accent} strokeWidth="0.4" opacity="0.5" />

      {/* Crown base */}
      <rect x="18" y="16" width="24" height="5" rx="1" fill={gold} />

      {/* Crown points */}
      <polygon points="18,16 15,16 20,6" fill={gold} />
      <polygon points="26,16 30,4 34,16" fill={gold} />
      <polygon points="42,16 45,16 40,6" fill={gold} />

      {/* Crown jewels */}
      <circle cx="17.5" cy="11" r="1.5" fill={fill} />
      <circle cx="30" cy="8" r="2" fill={fill} />
      <circle cx="42.5" cy="11" r="1.5" fill={fill} />

      {/* Crown highlight */}
      <rect x="19" y="17" width="22" height="1.5" fill={goldLight} opacity="0.5" />

      {/* Shoulder epaulettes */}
      <ellipse cx="14" cy="48" rx="5" ry="3" fill={gold} opacity="0.7" />
      <ellipse cx="46" cy="48" rx="5" ry="3" fill={gold} opacity="0.7" />
    </svg>
  );
}
