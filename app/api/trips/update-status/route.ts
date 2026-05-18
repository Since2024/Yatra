import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFirebaseAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { getConnection, getServerKeypair } from '@/lib/solana/connection';
import { releaseEscrow } from '@/lib/solana/escrow';
import { computeTelemetry } from '@/lib/solana/telemetry';
import { updateRepOnChain } from '@/lib/solana/trrlProgram';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface UpdateStatusBody {
    tripId: string;
    status: string;
    extraFields?: Record<string, any>;
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as UpdateStatusBody;
        const { tripId, status, extraFields } = body;

        if (!tripId || !status) {
            return NextResponse.json({ error: 'Missing tripId or status' }, { status: 400 });
        }

        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session')?.value || null;
        if (!sessionCookie) {
            return NextResponse.json({ error: 'Missing session cookie' }, { status: 401 });
        }

        const auth = getFirebaseAdminAuth();
        const decoded = await auth.verifySessionCookie(sessionCookie);
        const uid = decoded.uid;

        const adminDb = getAdminDb();
        
        // 1. Fetch trip/booking data
        let isBooking = false;
        let tripRef = adminDb.ref(`trips/${tripId}`);
        let tripSnap = await tripRef.get();
        
        if (!tripSnap.exists()) {
            tripRef = adminDb.ref(`bookings/${tripId}`);
            tripSnap = await tripRef.get();
            isBooking = true;
        }
        
        if (!tripSnap.exists()) {
            return NextResponse.json({ error: 'Trip record not found' }, { status: 404 });
        }

        const tripData = tripSnap.val();
        const currentStatus = tripData.status;
        const driverId = tripData.driverId || tripData.busId; // bookings sometimes use busId as driver ref

        // 2. Security Check: Only the assigned driver or admin can update
        if (uid !== driverId) {
            // Check if user is admin
            const userSnap = await adminDb.ref(`users/${uid}`).get();
            const userData = userSnap.val();
            if (userData?.role !== 'admin') {
                return NextResponse.json({ error: 'Unauthorized: Only the assigned driver can update this trip' }, { status: 403 });
            }
        }

        // 3. Update Status with Idempotency
        const now = new Date().toISOString();
        let statusChanged = false;

        const { committed, snapshot: updatedTripSnap } = await tripRef.transaction((currentTrip) => {
            if (!currentTrip) return currentTrip;
            if (currentTrip.status === status) {
                statusChanged = false;
                return; // Abort: already updated
            }
            statusChanged = true;
            const terminalStates = ['completed', 'cancelled', 'expired', 'rejected'];
            if (terminalStates.includes(currentTrip.status) && terminalStates.includes(status)) {
                statusChanged = false;
                return; // Abort: cannot change between terminal states
            }

            currentTrip.status = status;
            currentTrip.updatedAt = now;
            if (status === 'completed') {
                currentTrip.completedAt = now;
            }
            // Apply extra fields
            if (extraFields) {
                Object.assign(currentTrip, extraFields);
            }
            return currentTrip;
        });

        if (!committed && !statusChanged) {
            return NextResponse.json({ success: true, status, message: 'Already processed' });
        }

        const finalTripData = updatedTripSnap.val();

        // 4. Sync linked record
        const linkedBookingId = finalTripData.bookingId || (isBooking ? null : tripId);
        if (linkedBookingId && linkedBookingId !== tripId) {
            await adminDb.ref(`bookings/${linkedBookingId}`).update({
                status: status === 'active' ? 'confirmed' : status,
                updatedAt: now,
            });
        }

        // 5. Aggregate Statistics (Only if status actually changed)
        if (statusChanged) {
            const statsRef = adminDb.ref(`users/${driverId}/stats`);
            await statsRef.transaction((currentStats) => {
                const stats = currentStats || {
                    completedTrips: 0,
                    totalEarnings: 0,
                    totalRides: 0,
                    cancelledTrips: 0,
                    completionRate: 0
                };

                if (status === 'accepted' && currentStatus === 'requested') {
                    stats.totalRides = Number(stats.totalRides || 0) + 1;
                } else if (status === 'completed' && currentStatus !== 'completed') {
                    stats.completedTrips = Number(stats.completedTrips || 0) + 1;
                    const fare = Number(finalTripData.fare || 0);
                    stats.totalEarnings = Number(stats.totalEarnings || 0) + fare;
                } else if (status === 'cancelled' && currentStatus !== 'cancelled') {
                    stats.cancelledTrips = Number(stats.cancelledTrips || 0) + 1;
                }

                // Recalculate completion rate (Clamped to 100)
                const completedCount = Number(stats.completedTrips || 0);
                const totalAttempted = Math.max(Number(stats.totalRides || completedCount), 1);
                stats.completionRate = Math.min(Math.round((completedCount / totalAttempted) * 100), 100);

                return stats;
            });

            // 6. Update Reputation Node (Atomic)
            if (status === 'completed' || status === 'accepted') {
                const repRef = adminDb.ref(`reputation/drivers/${driverId}`);
                await repRef.transaction((currentRep) => {
                    const rep = currentRep || { totalTrips: 0, completedTrips: 0, score: 500 };

                    if (status === 'accepted') {
                        rep.totalTrips = Number(rep.totalTrips || 0) + 1;
                    } else if (status === 'completed') {
                        rep.completedTrips = Number(rep.completedTrips || 0) + 1;
                    }
                    rep.verifiedAt = Date.now();

                    // Trigger score recalculation
                    const total = Math.max(Number(rep.totalTrips || 0), 1);
                    const completed = Number(rep.completedTrips || 0);
                    const completionFactor = Math.min((completed / total) * 400, 400);
                    const ratingFactor = (Number(rep.avgRatingX100 || 500) / 500) * 300;
                    const punctuality = Math.min(Number(rep.onTimeArrivals || 0) / Math.max(completed, 1), 1) * 200;
                    const zkBonus = rep.zkVerified ? 100 : 0;
                    const sosPenalty = Number(rep.sosTriggered || 0) * 20;

                    const rawScore = Math.round(completionFactor + ratingFactor + punctuality + zkBonus - sosPenalty);
                    rep.score = Math.max(0, Math.min(isNaN(rawScore) ? 500 : rawScore, 1000));

                    return rep;
                });

                if (status === 'completed') {
                    // Fire-and-forget — trip completion response is not held up by Solana
                    adminDb.ref(`reputation/drivers/${driverId}`).get().then(async (repSnap) => {
                        const rep = repSnap.val() || {};
                        const driverWallet = finalTripData.driverWalletAddress || rep.driverPubkey;
                        if (!driverWallet) return;

                        const trip = finalTripData;

                        // ── 1. Read real GPS trace and sensor events from Firebase ──────────────────
                        const [locationSnap, sensorSnap] = await Promise.all([
                            adminDb.ref(`tripLocations/${tripId}/driver`).get(),
                            adminDb.ref(`trips/${tripId}/sensorEvents`).get(),
                        ]);

                        const driverGpsTrace = locationSnap.val() ?? {};
                        const rawSensorEvents = sensorSnap.val()
                            ? Object.values(sensorSnap.val() as Record<string, unknown>)
                            : [];

                        const sensorEvents = rawSensorEvents.filter(
                            (e): e is { type: 'hard_brake' | 'deviation'; timestamp: number } =>
                                typeof e === 'object' &&
                                e !== null &&
                                'type' in e &&
                                ((e as { type: unknown }).type === 'hard_brake' ||
                                    (e as { type: unknown }).type === 'deviation')
                        );

                        const toUnixMs = (value: unknown): number => {
                            if (typeof value === 'number') return value;
                            if (typeof value === 'string') {
                                const parsed = Date.parse(value);
                                return Number.isFinite(parsed) ? parsed : Date.now();
                            }
                            return Date.now();
                        };

                        // ── 2. Compute telemetry from real GPS data ─────────────────────────────────
                        const telemetry = computeTelemetry({
                            tripId,
                            osrmRouteHash: trip.routeHash ?? '',
                            driverGpsTrace,
                            scheduledPickupAt: toUnixMs(trip.scheduledPickupAt ?? trip.createdAt),
                            actualPickupAt: toUnixMs(trip.arrivedAt ?? trip.completedAt ?? Date.now()),
                            sensorEvents,
                        });

                        // Inject SOS flag from trip record
                        const sosTrigger = trip.sosTriggered ? 1 : 0;

                        // ── 3. Write telemetry snapshot to Firebase (analytics, non-blocking) ───────
                        adminDb.ref(`trips/${tripId}/telemetry`).update({
                            fidelityX100: telemetry.fidelityX100,
                            arrivalDeltaS: telemetry.arrivalDeltaS,
                            hardBrakes: telemetry.hardBrakes,
                            deviations: telemetry.deviations,
                            sosTrigger,
                            capturedAt: Date.now(),
                        }).catch((err: Error) =>
                            console.error('[TRRL] Firebase telemetry write failed:', err.message)
                        );

                        // ── 4. Fire on-chain TRRL update (non-blocking — Firebase is canonical) ─────
                        const driverWalletOnChain: string | undefined =
                            trip.driverWallet ?? trip.driverPubkey ?? driverWallet;
                        if (driverWalletOnChain) {
                            updateRepOnChain(driverWalletOnChain, {
                                isCompleted: true,
                                fidelityX100: telemetry.fidelityX100,
                                arrivalDeltaS: telemetry.arrivalDeltaS,
                                hardBrakes: telemetry.hardBrakes,
                                deviations: telemetry.deviations,
                                sosTrigger,
                                tripRating: 0,
                                setZkVerified: false,
                                zkCommitment: new Uint8Array(32),
                            })
                                .then((sig: string) => {
                                    adminDb
                                        .ref(`reputation/drivers/${trip.driverId ?? driverId}/lastSolanaTx`)
                                        .set(sig)
                                        .catch(() => {});
                                })
                                .catch((err: Error) =>
                                    console.error('[TRRL] on-chain update failed, Firebase canonical:', err.message)
                                );
                        }

                        const connection = getConnection();
                        const serverKeypair = getServerKeypair();
                        const amountLamports = finalTripData.amountLamports || 500000;

                        const escrowTelemetry = {
                            isCompleted: true,
                            fidelityX100: telemetry.fidelityX100,
                            arrivalDeltaS: telemetry.arrivalDeltaS,
                            hardBrakes: telemetry.hardBrakes,
                            deviations: telemetry.deviations,
                            sosTriggered: sosTrigger,
                        };

                        return releaseEscrow(
                            connection,
                            serverKeypair,
                            tripId,
                            driverWallet,
                            amountLamports,
                            escrowTelemetry
                        ).then((signature) =>
                            adminDb.ref(`reputation/drivers/${driverId}`).update({
                                lastSolanaTx: signature,
                                escrowStatus: 'released',
                                lastFidelityX100: telemetry.fidelityX100,
                            })
                        );
                    }).catch((err: any) =>
                        console.error('[update-status] Hybrid Escrow+TRRL update failed:', err.message)
                    );
                }
            }
        }

        return NextResponse.json({ success: true, status });

    } catch (error: any) {
        console.error('[API UpdateStatus] Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
