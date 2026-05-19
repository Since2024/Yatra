// lib/passport/getPassportData.ts
// Server-only. No client imports. No 'use client' directive.

import { PublicKey } from '@solana/web3.js';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { getConnection } from '@/lib/solana/connection';
import { readDriverRepOnChain, getDriverRepPDA } from '@/lib/solana/trrlProgram';

export interface DriverPassportData {
  walletAddress:   string;
  displayName:     string;
  trustScore:      number;
  tier:            'platinum' | 'gold' | 'silver' | 'bronze' | 'new';
  zkVerified:      boolean;
  completedTrips:  number;
  totalTrips:      number;
  completionRate:  number;   // 0–1
  pathFidelity:    number;   // 0–100
  onTimeRate:      number;   // 0–1
  avgArrivalDeltaS: number;
  safetyIndex:     number;   // 0–100
  pdaAddress:      string;
  lastSolanaTx:    string | null;
  source:          'chain+firebase' | 'firebase-only';
}

export async function getPassportData(
  walletAddress: string
): Promise<DriverPassportData | null> {
  try {
    new PublicKey(walletAddress);
  } catch {
    return null;
  }

  const adminDb = getAdminDb();
  const connection = getConnection();

  const [onChain, userSnap, repSnap] = await Promise.all([
    readDriverRepOnChain(connection, walletAddress).catch(() => null),
    adminDb
      .ref('users')
      .orderByChild('solanaWallet')
      .equalTo(walletAddress)
      .limitToFirst(1)
      .get(),
    adminDb
      .ref('reputation/drivers')
      .orderByChild('driverPubkey')
      .equalTo(walletAddress)
      .limitToFirst(1)
      .get(),
  ]);

  const firebaseUser = Object.values(userSnap.val() ?? {})[0] as { name?: string } | undefined;
  const firebaseRep  = Object.values(repSnap.val()  ?? {})[0] as Record<string, unknown> | undefined;

  if (!onChain && !firebaseRep) return null;

  const pdaPubkey = getDriverRepPDA(walletAddress);

  const trustScore = onChain?.score
    ?? Number(firebaseRep?.trustScore ?? firebaseRep?.score ?? 0);
  const completedTrips = onChain?.completedTrips
    ?? Number(firebaseRep?.completedTrips ?? 0);
  const totalTrips = onChain?.totalTrips
    ?? Number(firebaseRep?.totalTrips ?? 0);
  const pathFidelityX100 = Number(
    firebaseRep?.pathFidelityX100 ?? firebaseRep?.lastFidelityX100 ?? 10000
  );
  const avgArrivalDeltaS = Number(firebaseRep?.avgArrivalDeltaS ?? 0);
  const hardBrakeEvents  = Number(firebaseRep?.hardBrakeEvents ?? 0);
  const deviationEvents  = Number(firebaseRep?.routeDeviationEvents ?? 0);
  const sosTriggered     = Number(firebaseRep?.sosTriggered ?? 0);

  return {
    walletAddress,
    displayName:     firebaseUser?.name ?? 'Yatra Driver',
    trustScore,
    tier:            computeTier(trustScore),
    zkVerified:      onChain?.zkVerified ?? Boolean(firebaseRep?.zkVerified),
    completedTrips,
    totalTrips,
    completionRate:  totalTrips > 0 ? completedTrips / totalTrips : 0,
    pathFidelity:    pathFidelityX100 / 100,
    onTimeRate:      computeOnTimeRate(avgArrivalDeltaS),
    avgArrivalDeltaS,
    safetyIndex:     computeSafetyIndex(hardBrakeEvents, deviationEvents, sosTriggered),
    pdaAddress:      pdaPubkey.toBase58(),
    lastSolanaTx:    (firebaseRep?.lastSolanaTx as string | null) ?? null,
    source:          onChain ? 'chain+firebase' : 'firebase-only',
  };
}

function computeTier(score: number): DriverPassportData['tier'] {
  if (score >= 900) return 'platinum';
  if (score >= 750) return 'gold';
  if (score >= 550) return 'silver';
  if (score >= 300) return 'bronze';
  return 'new';
}

function computeOnTimeRate(avgDeltaS: number): number {
  return Math.max(0, Math.min(1, 1 - Math.abs(avgDeltaS) / 300));
}

function computeSafetyIndex(brakes: number, deviations: number, sos: number): number {
  return Math.max(0, 100 - brakes * 3 - deviations * 2 - sos * 15);
}
