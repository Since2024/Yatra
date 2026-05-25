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

  const onChainPromise = readDriverRepOnChain(connection, walletAddress).catch(() => null);

  // Fetch all users to find the matching solanaWallet in memory (bypasses missing database index)
  const userSnap = await adminDb.ref('users').get();
  const usersVal = userSnap.val() ?? {};

  let driverUid: string | null = null;
  let firebaseUser: any = null;
  for (const [uid, u] of Object.entries(usersVal)) {
    if (u && typeof u === 'object' && (u as any).solanaWallet === walletAddress) {
      driverUid = uid;
      firebaseUser = u;
      break;
    }
  }

  // Fetch reputation directly using the driverUid if found (bypasses missing driverPubkey database index)
  let firebaseRep: any = null;
  if (driverUid) {
    const repSnap = await adminDb.ref(`reputation/drivers/${driverUid}`).get();
    if (repSnap.exists()) {
      firebaseRep = repSnap.val();
    }
  }

  // Fallback: if not found by direct UID, try querying by driverPubkey
  if (!firebaseRep) {
    const repSnap = await adminDb
      .ref('reputation/drivers')
      .orderByChild('driverPubkey')
      .equalTo(walletAddress)
      .limitToFirst(1)
      .get();
    if (repSnap.exists()) {
      firebaseRep = Object.values(repSnap.val() ?? {})[0];
    }
  }

  const onChain = await onChainPromise;

  console.log(`[getPassportData] wallet=${walletAddress}`);
  console.log(`[getPassportData] driverUid=${driverUid}`);
  console.log(`[getPassportData] onChain=`, onChain);
  console.log(`[getPassportData] firebaseUser=`, firebaseUser);
  console.log(`[getPassportData] firebaseRep=`, firebaseRep);

  if (!onChain && !firebaseRep) {
    // No reputation yet — if the user exists in Firebase, return a fresh passport
    if (!firebaseUser) return null;
    const pdaPubkey = getDriverRepPDA(walletAddress);
    return {
      walletAddress,
      displayName:     firebaseUser?.name ?? 'Yatra Driver',
      trustScore:      0,
      tier:            'new' as const,
      zkVerified:      false,
      completedTrips:  0,
      totalTrips:      0,
      completionRate:  0,
      pathFidelity:    100,
      onTimeRate:      1,
      avgArrivalDeltaS: 0,
      safetyIndex:     100,
      pdaAddress:      pdaPubkey.toBase58(),
      lastSolanaTx:    null,
      source:          'firebase-only' as const,
    };
  }

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
