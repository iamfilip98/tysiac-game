interface JackFaceProps {
  color: 'red' | 'black';
}

export function JackFace({ color }: JackFaceProps) {
  const fill = color === 'red' ? '#DC2626' : '#1F2937';
  const accent = color === 'red' ? '#B91C1C' : '#111827';
  const gold = '#DAA520';
  const skin = '#F5DEB3';
  const hair = color === 'red' ? '#C8A04A' : '#4A3728';
  const hatColor = fill;

  return (
    <svg
      viewBox="0 0 60 80"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ width: '100%', height: '100%' }}
    >
      {/* Tunic / body */}
      <path
        d="M14 48 L19 42 L41 42 L46 48 L52 80 L8 80 Z"
        fill={fill}
      />
      {/* Tunic collar / V-neck */}
      <path
        d="M23 42 L30 50 L37 42"
        fill="none"
        stroke={gold}
        strokeWidth="1.2"
      />
      {/* Tunic belt */}
      <rect x="14" y="56" width="32" height="3" rx="1" fill={gold} opacity="0.6" />
      {/* Belt buckle */}
      <rect x="27" y="55.5" width="6" height="4" rx="1" fill={gold} />

      {/* Neck */}
      <rect x="26" y="36" width="8" height="8" rx="2" fill={skin} />

      {/* Hair behind */}
      <path
        d="M18 18 Q18 32 20 38 L24 34 L24 20 Z"
        fill={hair}
      />
      <path
        d="M42 18 Q42 32 40 38 L36 34 L36 20 Z"
        fill={hair}
      />

      {/* Face */}
      <ellipse cx="30" cy="28" rx="10" ry="12" fill={skin} />

      {/* Hair fringe */}
      <path
        d="M20 20 Q22 15 30 14 Q38 15 40 20 L38 22 Q34 18 30 17 Q26 18 22 22 Z"
        fill={hair}
      />

      {/* Eyes */}
      <ellipse cx="25.5" cy="27" rx="1.6" ry="1.2" fill={accent} />
      <ellipse cx="34.5" cy="27" rx="1.6" ry="1.2" fill={accent} />

      {/* Eyebrows */}
      <path d="M23 24.5 L28 24" fill="none" stroke={accent} strokeWidth="0.7" />
      <path d="M32 24 L37 24.5" fill="none" stroke={accent} strokeWidth="0.7" />

      {/* Nose */}
      <path d="M30 28.5 L28.5 32 L31.5 32" fill="none" stroke={accent} strokeWidth="0.5" />

      {/* Slight smile */}
      <path d="M27 34 Q30 36 33 34" fill="none" stroke={accent} strokeWidth="0.6" />

      {/* Hat brim */}
      <ellipse cx="30" cy="17" rx="16" ry="3" fill={hatColor} />

      {/* Hat body */}
      <path
        d="M16 17 Q15 8 22 4 Q30 1 38 4 Q45 8 44 17"
        fill={hatColor}
      />

      {/* Hat band */}
      <path
        d="M16 17 Q30 14 44 17"
        fill="none"
        stroke={gold}
        strokeWidth="1.5"
      />

      {/* Feather */}
      <path
        d="M40 14 Q48 6 50 0 Q46 5 44 4 Q48 2 49 -1 Q44 6 40 8"
        fill={color === 'red' ? '#E74C3C' : '#6B7280'}
        opacity="0.8"
      />
      {/* Feather quill */}
      <path
        d="M40 14 Q46 4 50 0"
        fill="none"
        stroke={color === 'red' ? '#B91C1C' : '#4B5563'}
        strokeWidth="0.5"
      />

      {/* Hat jewel */}
      <circle cx="30" cy="15.5" r="1.5" fill={gold} />

      {/* Shoulder pads */}
      <path d="M14 48 Q10 46 12 42 L19 42 Z" fill={accent} opacity="0.5" />
      <path d="M46 48 Q50 46 48 42 L41 42 Z" fill={accent} opacity="0.5" />

      {/* Tunic sleeve cuffs */}
      <rect x="8" y="62" width="8" height="2" rx="1" fill={gold} opacity="0.5" />
      <rect x="44" y="62" width="8" height="2" rx="1" fill={gold} opacity="0.5" />
    </svg>
  );
}
