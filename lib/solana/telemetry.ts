// lib/solana/telemetry.ts
// Pure computation — no Firebase, no Solana, no HTTP calls.

import type { TripTelemetry } from '@/lib/types';

interface GpsPoint {
  lat:       number;
  lng:       number;
  timestamp: number;
}

interface SensorEvent {
  type:      'hard_brake' | 'deviation';
  timestamp: number;
}

interface ComputeTelemetryParams {
  tripId:            string;
  osrmRouteHash:     string;
  driverGpsTrace:    Record<string, GpsPoint>;
  scheduledPickupAt: number; // unix milliseconds
  actualPickupAt:    number; // unix milliseconds
  sensorEvents:      SensorEvent[];
}

export function computeTelemetry(params: ComputeTelemetryParams): TripTelemetry {
  const trace = Object.values(params.driverGpsTrace ?? {})
    .filter(p => typeof p.lat === 'number' && typeof p.lng === 'number')
    .sort((a, b) => a.timestamp - b.timestamp);

  const fidelityX100 = trace.length < 2
    ? 10000
    : Math.round(estimatePathFidelity(trace) * 10000);

  const rawDeltaS =
    params.actualPickupAt && params.scheduledPickupAt
      ? Math.round((params.actualPickupAt - params.scheduledPickupAt) / 1000)
      : 0;

  // Clamp to signed 16-bit integer range — matches on-chain i16 type
  const arrivalDeltaS = Math.max(-32768, Math.min(32767, rawDeltaS));

  const hardBrakes = Math.min(
    255,
    params.sensorEvents.filter(e => e.type === 'hard_brake').length
  );
  const deviations = Math.min(
    255,
    params.sensorEvents.filter(e => e.type === 'deviation').length
  );

  return {
    fidelityX100:  Math.min(10000, Math.max(0, fidelityX100)),
    arrivalDeltaS,
    hardBrakes,
    deviations,
    sosTrigger:    0,    // Caller injects from trip.sosTriggered
    isCompleted:   true,
  };
}

// Estimates path fidelity via bearing-change variance.
// Low variance = consistent direction = driver stayed on route.
// StdDev of 0° = perfectly straight = 1.0. StdDev ≥ 90° = chaotic = 0.0.
function estimatePathFidelity(trace: GpsPoint[]): number {
  if (trace.length < 2) return 1.0;

  const bearings: number[] = [];
  for (let i = 1; i < trace.length; i++) {
    const dlng = trace[i].lng - trace[i - 1].lng;
    const dlat = trace[i].lat - trace[i - 1].lat;
    bearings.push(Math.atan2(dlng, dlat) * (180 / Math.PI));
  }

  const mean = bearings.reduce((s, b) => s + b, 0) / bearings.length;
  const variance =
    bearings.reduce((s, b) => s + (b - mean) ** 2, 0) / bearings.length;
  const stdDev = Math.sqrt(variance);

  return Math.max(0, Math.min(1, 1 - stdDev / 90));
}
