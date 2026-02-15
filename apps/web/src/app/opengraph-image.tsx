import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Tysiąc - Polish Card Game';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a3a2a 0%, #0d2818 50%, #1a3a2a 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Card suit decorations */}
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 60,
            fontSize: 80,
            opacity: 0.15,
            display: 'flex',
            gap: 20,
          }}
        >
          <span style={{ color: '#ef4444' }}>♥</span>
          <span style={{ color: '#3b82f6' }}>♦</span>
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            right: 60,
            fontSize: 80,
            opacity: 0.15,
            display: 'flex',
            gap: 20,
          }}
        >
          <span style={{ color: '#22c55e' }}>♣</span>
          <span style={{ color: '#a855f7' }}>♠</span>
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            fontSize: 120,
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: -2,
          }}
        >
          Tysi
          <span style={{ color: '#fbbf24' }}>ą</span>c
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 32,
            color: 'rgba(255,255,255,0.6)',
            marginTop: 8,
          }}
        >
          Polish Card Game
        </div>

        {/* Suit row */}
        <div
          style={{
            display: 'flex',
            gap: 24,
            marginTop: 32,
            fontSize: 48,
          }}
        >
          <span style={{ color: '#ef4444' }}>♥</span>
          <span style={{ color: '#3b82f6' }}>♦</span>
          <span style={{ color: '#22c55e' }}>♣</span>
          <span style={{ color: '#a855f7' }}>♠</span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 24,
            color: 'rgba(255,255,255,0.4)',
            marginTop: 24,
          }}
        >
          Play online with friends • First to 1000 wins!
        </div>
      </div>
    ),
    { ...size }
  );
}
