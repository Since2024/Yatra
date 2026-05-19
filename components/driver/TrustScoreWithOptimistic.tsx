// components/driver/TrustScoreWithOptimistic.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrustScoreRing } from './TrustScoreRing';
import { tokens, type TrustTier } from '@/lib/design/tokens';

type SyncState = 'synced' | 'pending' | 'failed';

export interface TrustScoreWithOptimisticProps {
  /** Score from Firebase — available immediately, used as optimistic display */
  firebaseScore:  number;
  /** Score from on-chain PDA — null until the tx confirms */
  chainScore:     number | null;
  /** Most recent Solana tx signature — change triggers 'pending' state */
  lastSolanaTx:   string | null;
  /** Driver's current tier */
  tier:           TrustTier;
  /** Ring size in px (default: 160) */
  size?:          number;
  /** Max ms to wait for chain confirmation before switching to 'failed' */
  timeoutMs?:     number;
}

const STATUS_CONFIG: Record<SyncState, { color: string; text: string; icon: string }> = {
  synced:  { color: '#10B981', text: 'On-chain confirmed',      icon: '✓' },
  pending: { color: '#00D4AA', text: 'Anchoring to Solana...',  icon: '◉' },
  failed:  { color: '#F59E0B', text: 'Saved locally · retry scheduled', icon: '⚠' },
};

export function TrustScoreWithOptimistic({
  firebaseScore,
  chainScore,
  lastSolanaTx,
  tier,
  size       = 160,
  timeoutMs  = 30_000,
}: TrustScoreWithOptimisticProps) {
  const [syncState,    setSyncState]    = useState<SyncState>('synced');
  const [displayScore, setDisplayScore] = useState<number>(firebaseScore);

  useEffect(() => {
    if (!lastSolanaTx) return;

    setSyncState('pending');
    setDisplayScore(firebaseScore);

    const failTimer = setTimeout(() => {
      setSyncState(prev => prev === 'pending' ? 'failed' : prev);
    }, timeoutMs);

    return () => clearTimeout(failTimer);
  }, [lastSolanaTx, firebaseScore, timeoutMs]);

  useEffect(() => {
    if (chainScore === null) return;
    setDisplayScore(chainScore);
    setSyncState('synced');
  }, [chainScore]);

  const status = STATUS_CONFIG[syncState];

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}
    >
      <TrustScoreRing
        score={displayScore}
        tier={tier}
        size={size}
        isAnimating={syncState === 'pending'}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={syncState}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          style={{
            display:     'flex',
            alignItems:  'center',
            gap:         '6px',
            fontSize:    '11px',
            fontFamily:  tokens.typography.fontMono,
            color:       status.color,
            letterSpacing: '0.04em',
          }}
          role="status"
          aria-live="polite"
          aria-label={status.text}
        >
          {syncState === 'pending' ? (
            <motion.span
              aria-hidden="true"
              style={{ display: 'inline-block', width: '7px', height: '7px',
                       borderRadius: '50%', background: status.color }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          ) : (
            <span aria-hidden="true" style={{ fontSize: '10px' }}>
              {status.icon}
            </span>
          )}
          {status.text}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
