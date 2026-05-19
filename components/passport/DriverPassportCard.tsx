// components/passport/DriverPassportCard.tsx
// Server component — no 'use client'. No framer-motion. Renders static HTML.

import type { DriverPassportData } from '@/lib/passport/getPassportData';
import { generatePassportQR } from '@/lib/passport/generatePassportQR';

interface Props {
  data: DriverPassportData;
}

const TIER_LABELS: Record<DriverPassportData['tier'], string> = {
  platinum: '🏆 Platinum',
  gold:     '🥇 Gold',
  silver:   '🥈 Silver',
  bronze:   '🥉 Bronze',
  new:      '🆕 New Driver',
};

const TIER_COLORS: Record<DriverPassportData['tier'], string> = {
  platinum: '#E5E7EB',
  gold:     '#F59E0B',
  silver:   '#94A3B8',
  bronze:   '#D97706',
  new:      '#6B7280',
};

function formatDelta(seconds: number): string {
  const abs = Math.abs(seconds);
  const mins = Math.floor(abs / 60);
  const secs = abs % 60;
  const direction = seconds < 0 ? 'early' : 'late';
  return mins > 0 ? `${mins}m ${secs}s ${direction}` : `${secs}s ${direction}`;
}

function indicator(value: number, goodThreshold: number): string {
  return value >= goodThreshold ? '🟢' : value >= goodThreshold * 0.7 ? '🟡' : '🔴';
}

export async function DriverPassportCard({ data }: Props) {
  const qrDataUrl = await generatePassportQR(data).catch(() => null);

  return (
    <div
      style={{
        maxWidth: '480px',
        margin: '0 auto',
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '0.5px solid rgba(0,0,0,0.08)',
        borderRadius: '20px',
        padding: '32px',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '24px' }}>
        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="Verification QR" width={80} height={80}
               style={{ borderRadius: '8px', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: '#71717A', marginBottom: '4px', fontFamily: 'monospace' }}>
            YATRA DRIVER TRUST PASSPORT
          </div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: '#1A1A1A' }}>
            {data.displayName}
          </div>
          {data.zkVerified && (
            <div style={{ fontSize: '13px', color: '#00D4AA', marginTop: '4px', display: 'flex',
                          alignItems: 'center', gap: '4px' }}>
              🛡 ZK Verified — Identity confirmed
            </div>
          )}
          <div style={{ fontSize: '12px', color: '#A1A1AA', marginTop: '4px',
                        fontFamily: 'monospace' }}>
            {data.walletAddress.slice(0, 6)}...{data.walletAddress.slice(-4)}
          </div>
        </div>
      </div>

      <div style={{ padding: '20px', background: 'rgba(0,0,0,0.02)', borderRadius: '12px',
                    marginBottom: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase',
                      color: '#71717A', marginBottom: '8px', fontFamily: 'monospace' }}>
          TRUST SCORE
        </div>
        <div style={{ fontSize: '56px', fontWeight: 800, color: '#1A1A1A',
                      fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
          {data.trustScore}
        </div>
        <div style={{ fontSize: '16px', color: '#71717A', marginTop: '2px' }}>/ 1000</div>
        <div style={{ marginTop: '12px', background: '#E5E7EB', borderRadius: '4px',
                      height: '6px', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: '4px', width: `${data.trustScore / 10}%`,
                        background: TIER_COLORS[data.tier], transition: 'width 1s ease' }} />
        </div>
        <div style={{ marginTop: '8px', fontSize: '13px', fontWeight: 600,
                      color: TIER_COLORS[data.tier] }}>
          {TIER_LABELS[data.tier]}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
                    marginBottom: '20px' }}>
        {[
          { label: 'Trips completed', value: data.completedTrips.toLocaleString() },
          { label: 'Completion rate', value: `${(data.completionRate * 100).toFixed(1)}%` },
          { label: 'Path fidelity', value: `${data.pathFidelity.toFixed(1)}% ${indicator(data.pathFidelity, 85)}` },
          { label: 'On-time rate',   value: `${(data.onTimeRate * 100).toFixed(1)}% ${indicator(data.onTimeRate * 100, 80)}` },
          { label: 'Avg arrival',    value: formatDelta(data.avgArrivalDeltaS) },
          { label: 'Safety index',   value: `${data.safetyIndex}/100 ${indicator(data.safetyIndex, 80)}` },
        ].map(({ label, value }) => (
          <div key={label} style={{ padding: '12px 14px', background: '#FAFAFA',
                                    borderRadius: '10px', border: '0.5px solid rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase',
                          color: '#A1A1AA', marginBottom: '4px', fontFamily: 'monospace' }}>
              {label}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#1A1A1A',
                          fontFamily: 'monospace' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: '11px', color: '#A1A1AA', textAlign: 'center',
                    fontFamily: 'monospace' }}>
        Source: {data.source === 'chain+firebase' ? '✓ Verified on Solana' : 'Firebase (chain pending)'}
        {data.lastSolanaTx && ` · Updated ${new Date().toLocaleDateString()}`}
      </div>
    </div>
  );
}