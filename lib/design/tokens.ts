// lib/design/tokens.ts
// Single source of truth for all Yatra design values.
// Import from this file in every component — never hardcode design values.

export const tokens = {
  color: {
    bgPrimary:    '#FAFAFA' as const,
    bgCard:       'rgba(255,255,255,0.72)' as const,
    bgCardDark:   '#0F172A' as const,
    bgOverlay:    'rgba(0,0,0,0.04)' as const,
    fgPrimary:    '#1A1A1A' as const,    // contrast 16:1 on bgPrimary — WCAG AAA
    fgSecondary:  '#71717A' as const,    // contrast 4.6:1 on bgPrimary — WCAG AA
    fgMuted:      '#A1A1AA' as const,
    fgInverse:    '#FAFAFA' as const,
    cyan:         '#00D4AA' as const,    // decorative only — 2.6:1 on bgPrimary, NOT for body text
    cyanSoft:     'rgba(0,212,170,0.08)' as const,
    amber:        '#F59E0B' as const,
    emerald:      '#10B981' as const,
    rose:         '#F43F5E' as const,
    solana:       '#9945FF' as const,
    tierPlatinum: '#E5E7EB' as const,
    tierGold:     '#F59E0B' as const,
    tierSilver:   '#94A3B8' as const,
    tierBronze:   '#D97706' as const,
    tierNew:      '#6B7280' as const,
  },
  typography: {
    fontSerif: "'Playfair Display', Georgia, serif" as const,
    fontSans:  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" as const,
    fontMono:  "'JetBrains Mono', 'SF Mono', Consolas, monospace" as const,
  },
  glass: {
    background:   'rgba(255,255,255,0.72)' as const,
    backdropBlur: 'blur(20px)' as const,
    border:       '0.5px solid rgba(0,0,0,0.06)' as const,
    borderRadius: '16px' as const,
  },
  animation: {
    springSnappy:   { type: 'spring' as const, stiffness: 400, damping: 25 },
    springMagnetic: { type: 'spring' as const, stiffness: 300, damping: 10 },
    springGentle:   { type: 'spring' as const, stiffness: 150, damping: 20 },
    springScore:    { stiffness: 60, damping: 15 },
    ease:           [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
  shadow: {
    card:     '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)' as const,
    elevated: '0 4px 24px rgba(0,0,0,0.08)' as const,
    cyanGlow: '0 0 0 1px rgba(0,212,170,0.3), 0 4px 20px rgba(0,212,170,0.12)' as const,
  },
} as const;

export type TrustTier = 'platinum' | 'gold' | 'silver' | 'bronze' | 'new';

export const TIER_COLORS: Record<TrustTier, string> = {
  platinum: tokens.color.tierPlatinum,
  gold:     tokens.color.tierGold,
  silver:   tokens.color.tierSilver,
  bronze:   tokens.color.tierBronze,
  new:      tokens.color.tierNew,
};
