// components/driver/TrustScoreRing.tsx
'use client';

import { useEffect } from 'react';
import { motion, useSpring, useTransform, MotionValue } from 'framer-motion';
import { tokens, TIER_COLORS, type TrustTier } from '@/lib/design/tokens';

export interface TrustScoreRingProps {
  /** Current trust score, 0–1000 */
  score:        number;
  /** Driver's current tier — determines ring color */
  tier:         TrustTier;
  /** Pass true while a Solana transaction is pending confirmation */
  isAnimating?: boolean;
  /** Rendered size in pixels (default: 160) */
  size?:        number;
}

const SVG_SIZE       = 120;
const RING_RADIUS    = 54;
const STROKE_WIDTH   = 8;
const CIRCUMFERENCE  = 2 * Math.PI * RING_RADIUS;

export function TrustScoreRing({
  score,
  tier,
  isAnimating = false,
  size = 160,
}: TrustScoreRingProps) {
  const springScore: MotionValue<number> = useSpring(0, tokens.animation.springScore);

  const dashOffset: MotionValue<number> = useTransform(
    springScore,
    [0, 1000],
    [CIRCUMFERENCE, 0]
  );

  useEffect(() => {
    springScore.set(score);
  }, [score, springScore]);

  const tierColor = TIER_COLORS[tier];

  return (
    <div
      role="img"
      aria-label={`Trust score: ${score} out of 1000, tier: ${tier}`}
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
    >
      {isAnimating && (
        <motion.div
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, borderRadius: '50%' }}
          animate={{
            boxShadow: [
              '0 0 0 0px rgba(0,212,170,0.5)',
              '0 0 0 16px rgba(0,212,170,0)',
            ],
          }}
          transition={{ duration: 1.5, repeat: Infinity, repeatType: 'loop' }}
        />
      )}

      <svg
        aria-hidden="true"
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          transform: 'rotate(-90deg)',
        }}
      >
        <circle
          cx={SVG_SIZE / 2}
          cy={SVG_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={STROKE_WIDTH}
          stroke="rgba(0,0,0,0.06)"
        />
        <motion.circle
          cx={SVG_SIZE / 2}
          cy={SVG_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={STROKE_WIDTH}
          stroke={isAnimating ? tokens.color.cyan : tierColor}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          style={{ strokeDashoffset: dashOffset }}
        />
      </svg>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2px',
        }}
      >
        <motion.span
          style={{
            fontFamily:  tokens.typography.fontMono,
            fontSize:    `${size * 0.225}px`,
            fontWeight:  800,
            color:       tokens.color.fgPrimary,
            lineHeight:  1,
            letterSpacing: '-0.03em',
          }}
        >
          {Math.round(score)}
        </motion.span>
        <span
          style={{
            fontFamily:    tokens.typography.fontMono,
            fontSize:      `${size * 0.075}px`,
            fontWeight:    500,
            color:         tokens.color.fgSecondary,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          / 1000
        </span>
      </div>
    </div>
  );
}
