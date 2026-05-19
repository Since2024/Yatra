// app/verify/driver/[wallet]/page.tsx
// Server Component — no 'use client'. Public route — no auth required.

import { Metadata } from 'next';
import { DriverPassportCard } from '@/components/passport/DriverPassportCard';
import { PassportVerificationBadge } from '@/components/passport/PassportVerificationBadge';
import { getPassportData } from '@/lib/passport/getPassportData';

interface PageProps {
  params: Promise<{ wallet: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { wallet } = await params;
  const data = await getPassportData(wallet).catch(() => null);
  return {
    title:       `${data?.displayName ?? 'Driver'} — Yatra Trust Passport`,
    description: `Trust Score: ${data?.trustScore ?? '—'}/1000 · Verified on Solana`,
    openGraph: {
      title:       `${data?.displayName ?? 'Driver'} — Yatra Trust Passport`,
      description: `Trust Score: ${data?.trustScore ?? '—'}/1000 · ${data?.tier ?? 'New Driver'}`,
    },
  };
}

export default async function DriverPassportPage({ params }: PageProps) {
  const { wallet } = await params;
  const data = await getPassportData(wallet).catch(() => null);

  if (!data) {
    return (
      <main style={{ minHeight: '100vh', background: '#FAFAFA', display: 'flex',
                     alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center', fontFamily: 'monospace' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#1A1A1A' }}>
            Passport not found
          </div>
          <div style={{ fontSize: '13px', color: '#71717A', marginTop: '8px',
                        wordBreak: 'break-all', maxWidth: '360px' }}>
            No driver record found for wallet: {wallet}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#FAFAFA', padding: '48px 16px' }}>
      <DriverPassportCard data={data} />
      <PassportVerificationBadge
        txSignature={data.lastSolanaTx}
        pdaAddress={data.pdaAddress}
        network="devnet"
      />
    </main>
  );
}
