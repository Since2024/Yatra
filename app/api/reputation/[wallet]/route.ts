import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { PublicKey } from '@solana/web3.js';
import { getConnection } from '@/lib/solana/connection';
import { readDriverRepOnChain } from '@/lib/solana/trrlProgram';
import { checkRateLimit } from '@/lib/utils/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEVNET_EXPLORER = 'https://explorer.solana.com/tx';
const PDA_EXPLORER = 'https://explorer.solana.com/address';

/**
 * GET /api/reputation/:wallet
 *
 * Public — no auth required. Designed for cross-platform consumption.
 * Any platform (Pathao, InDrive, etc.) can call this with a driver's
 * Solana wallet address and receive their TRRL reputation score.
 *
 * Data priority:
 *   1. On-chain TRRL PDA (authoritative — tamper-proof, trust-minimized)
 *   2. Firebase (fallback if PDA not yet initialized, also supplies
 *      metadata fields like lastSolanaTx and zkCommitment)
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ wallet: string }> }
) {
    const { wallet } = await params;

    // Rate limit: 60 requests per IP per minute
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    if (!checkRateLimit(`rep-lookup:${ip}`, 60, 60_000)) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Validate Solana address format
    try {
        new PublicKey(wallet);
    } catch {
        return NextResponse.json({ error: 'Invalid Solana wallet address' }, { status: 400 });
    }

    try {
        // 1. Try on-chain PDA first (authoritative source)
        const connection = getConnection();
        const onChainPromise = readDriverRepOnChain(connection, wallet).catch(() => null);

        // Fetch all users to find the matching solanaWallet (bypasses missing database index)
        const userSnap = await getAdminDb().ref('users').get();
        const usersVal = userSnap.val() ?? {};

        let driverUid: string | null = null;
        let firebaseUser: any = null;
        for (const [uid, u] of Object.entries(usersVal)) {
            if (u && typeof u === 'object' && (u as any).solanaWallet === wallet) {
                driverUid = uid;
                firebaseUser = u;
                break;
            }
        }

        // Fetch reputation directly using the driverUid if found (bypasses missing driverPubkey database index)
        let fbRep: any = null;
        if (driverUid) {
            const repSnap = await getAdminDb().ref(`reputation/drivers/${driverUid}`).get();
            if (repSnap.exists()) {
                fbRep = repSnap.val();
            }
        }

        // Fallback: if not found by direct UID, try querying by driverPubkey
        if (!fbRep) {
            const repSnap = await getAdminDb()
                .ref('reputation/drivers')
                .orderByChild('driverPubkey')
                .equalTo(wallet)
                .limitToFirst(1)
                .get();
            if (repSnap.exists()) {
                fbRep = Object.values(repSnap.val() ?? {})[0];
            }
        }

        const chainData = await onChainPromise;

        if (!chainData && !fbRep) {
            return NextResponse.json({ error: 'No reputation record found for this wallet' }, { status: 404 });
        }

        // 2. Merge: on-chain wins for score/stats; Firebase supplies metadata
        const { PublicKey: PK } = await import('@solana/web3.js');
        const { getDriverRepPDA } = await import('@/lib/solana/trrlProgram');
        const pdaAddress = getDriverRepPDA(wallet).toBase58();

        const lastSolanaTx = fbRep?.lastSolanaTx || null;

        const response = {
            // Identity
            wallet,
            source: chainData ? 'YATRA_TRRL_V1_ONCHAIN' : 'YATRA_TRRL_V1_FIREBASE',

            // Score (0–1000) — on-chain is authoritative
            score: chainData?.score ?? Number(fbRep?.score ?? 0),

            // Trip stats — on-chain is authoritative
            totalTrips: chainData?.totalTrips ?? Number(fbRep?.totalTrips ?? 0),
            completedTrips: chainData?.completedTrips ?? Number(fbRep?.completedTrips ?? 0),
            avgRating: chainData?.avgRating
                ?? parseFloat((Number(fbRep?.avgRatingX100 ?? 0) / 100).toFixed(2)),
            onTimePct: chainData?.onTimePct ?? (() => {
                const completed = Number(fbRep?.completedTrips ?? 0);
                const onTime = Number(fbRep?.onTimeArrivals ?? 0);
                return Math.round((onTime / Math.max(completed, 1)) * 100);
            })(),

            // Trust signals
            zkVerified: chainData?.zkVerified ?? Boolean(fbRep?.zkVerified),
            zkCommitment: fbRep?.zkCommitment || null,

            // On-chain PDA address — any platform can fetch this directly
            reputationPDA: pdaAddress,
            pdaExplorerUrl: `${PDA_EXPLORER}/${pdaAddress}?cluster=devnet`,

            // Last write transaction
            lastSolanaTx,
            explorerUrl: lastSolanaTx
                ? `${DEVNET_EXPLORER}/${lastSolanaTx}?cluster=devnet`
                : null,

            verifiedAt: chainData?.lastUpdated
                ?? (fbRep?.verifiedAt ? new Date(fbRep.verifiedAt).toISOString() : null),
        };

        return NextResponse.json(response, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
            },
        });

    } catch (error: any) {
        console.error('[reputation] lookup failed:', error.message);
        return NextResponse.json({ error: 'Failed to fetch reputation' }, { status: 500 });
    }
}
