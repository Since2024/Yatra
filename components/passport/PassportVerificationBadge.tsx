// components/passport/PassportVerificationBadge.tsx
// Server component — no 'use client'.

interface Props {
  txSignature: string | null;
  pdaAddress:  string;
  network:     'devnet' | 'mainnet-beta';
}

export function PassportVerificationBadge({ txSignature, pdaAddress, network }: Props) {
  const explorerBase = `https://explorer.solana.com`;
  const clusterParam = network === 'devnet' ? '?cluster=devnet' : '';

  return (
    <div style={{
      maxWidth: '480px', margin: '16px auto 0', display: 'flex', gap: '12px',
      flexWrap: 'wrap', justifyContent: 'center',
    }}>
      <a
        href={`${explorerBase}/address/${pdaAddress}${clusterParam}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '10px 18px', borderRadius: '10px', fontSize: '12px',
          fontWeight: 500, fontFamily: 'monospace', color: '#00D4AA',
          border: '1px solid rgba(0,212,170,0.3)', textDecoration: 'none',
          background: 'rgba(0,212,170,0.06)',
        }}
      >
        🔗 Verify on Solana Explorer
      </a>
      {txSignature && (
        <a
          href={`${explorerBase}/tx/${txSignature}${clusterParam}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '10px 18px', borderRadius: '10px', fontSize: '12px',
            fontWeight: 500, fontFamily: 'monospace', color: '#71717A',
            border: '1px solid rgba(0,0,0,0.08)', textDecoration: 'none',
            background: 'rgba(0,0,0,0.02)',
          }}
        >
          📋 Last update tx
        </a>
      )}
    </div>
  );
}
