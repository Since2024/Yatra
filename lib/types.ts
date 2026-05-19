export interface Location {
  lat: number;
  lng: number;
  address?: string;
  timestamp: Date;
}

export type UserRole = 'driver' | 'passenger' | 'admin';
export type TripStatus =
  | 'requested'
  | 'accepted'
  | 'arrived'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'rejected'
  | 'expired';

export type RequestStatus = 'idle' | 'requesting' | 'accepted' | 'on-trip';

export interface LiveUser {
  id: string;
  role: 'driver' | 'passenger';
  lat: number;
  lng: number;
  isOnline: boolean;
  timestamp: string | number;
  route?: string;
  vehicleType?: VehicleTypeId;
  requestStatus?: RequestStatus; // 'idle' | 'requesting' | 'on-trip'
  // Populated from Firebase users/{id}/verificationBadge for verified drivers
  verificationBadge?: {
    mintAddress: string;
    txSignature: string;
    explorerLink: string;
    verifiedAt: string;
    zkCommitment?: string;
    zkMemoExplorerLink?: string;
    ageVerified?: boolean;
  };
}

export interface User {
  id: string;
  phone: string;
  name: string;
  email?: string;
  role: UserRole;
  createdAt: Date;
  solanaWallet?: string; // Phantom wallet address (for Solana features)
}

export interface Driver extends User {
  vehicleType: VehicleTypeId;
  vehicleNumber: string;
  capacity: number;
  licenseNumber: string;
  licenseFrontImage?: string;
  licenseBackImage?: string;
  route: string;
  isApproved: boolean;
  rating?: number;
  trustScore?: number;
  pathFidelity?: number;
  hardBrakes?: number;
  routeDeviations?: number;
  hasQualityStreak?: boolean;
  verificationBadge?: {
    mintAddress: string;
    txSignature: string;
    explorerLink: string;
    verifiedAt: string;
    // ZK Civic Identity fields (Phase 1 upgrade)
    zkCommitment?: string;        // Poseidon commitment anchored on Solana
    zkMemoSignature?: string;     // Tx signature of the on-chain Memo
    zkMemoExplorerLink?: string;  // Explorer link for the Memo tx
    ageVerified?: boolean;        // True if ZK age proof passed
  };
}

export interface PassengerUser extends User {
  emergencyContact?: string;
  solanaWallet?: string; // Optional field for Trip Ticket NFTs
}

export type UserProfile = Driver | PassengerUser;

export type VehicleTypeId = 'bus' | 'others' | 'taxi' | 'bike';

export interface VehicleType {
  id: VehicleTypeId;
  name: string;
  icon: string;
  capacity: number;
  fareMultiplier: number;
  color: string;
}

export interface Bus {
  id: string;
  driverName: string;
  busNumber: string;
  route: string;
  currentLocation?: Location;
  destination: Location;
  passengers: Passenger[];
  capacity: number;
  isActive: boolean;
  emoji: string;
  vehicleType: VehicleTypeId;
  // Seat management fields
  onlineBookedSeats: number;      // Seats booked via app
  offlineOccupiedSeats: number;   // Manually tracked by driver
  availableSeats: number;          // Calculated: capacity - online - offline
  lastSeatUpdate: Date;            // For showing "Updated Xs ago"
  driverId?: string;               // Firebase UID of the driver
  driverWalletAddress?: string;     // Solana wallet for earnings
  // Additional fields
  onlineBooked?: number;           // Alias for onlineBookedSeats
  offlineBooked?: number;          // Alias for offlineOccupiedSeats
  driverImage?: string;            // Base64 or URL
  vehicleImage?: string;           // Base64 or URL
}

export interface Passenger {
  id: string;
  name: string;
  pickupLocation: Location;
  dropoffLocation: Location;
  status: 'waiting' | 'picked' | 'dropped';
  bookingTime: Date;
  fare?: number;
}

export interface Booking {
  id: string;
  passengerId: string;
  driverId?: string;
  busId: string;
  passengerName: string;
  phoneNumber: string;
  email?: string;
  numberOfPassengers: number;
  pickupLocation: LocationWithTimestamp;
  dropoffLocation: LocationWithTimestamp;
  fare: number;
  route?: string;
  vehicleType?: VehicleTypeId;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'expired';
  timestamp: Date;
  notes?: string;
  paymentMethod?: 'cash' | 'digital';
  // NFT Receipt (populated after driver confirms dropoff)
  receipt?: {
    mintAddress: string;
    txSignature: string;
    explorerLink: string;
    status: 'minted';
    mintedAt: string;
  };
  escrowStatus?: 'locked' | 'released' | 'reclaimed';
  // Booking timeout fields
  reservationExpiresAt?: Date;     // 10-minute timeout
  isExpired: boolean;
}

export interface LocationWithTimestamp {
  lat: number;
  lng: number;
  address?: string;
  timestamp: Date;
}

export interface RouteStop {
  name: string;
  location: Location;
  order: number;
}

export type AlertType = 'accident' | 'breakdown' | 'emergency';

export interface Alert {
  id: string;
  busId: string;
  busNumber: string;
  driverName: string;
  type: AlertType;
  location: Location;
  timestamp: string; // ISO string
  status: 'active' | 'resolved';
  details?: string;
}

type PartialDriverProfile = Partial<Driver> & { isApproved?: boolean };
type PartialPassengerProfile = Partial<PassengerUser>;
type PartialProfile = PartialDriverProfile | PartialPassengerProfile | null | undefined;

export const checkProfileCompletion = (data: PartialProfile, explicitRole?: string): boolean => {
  if (!data) return false;
  const effectiveRole = data.role || explicitRole;
  if (!effectiveRole) return false;
  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') return false;

  return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// TRRL: Canonical Gen 2 Type Definitions
// Aligned across Firebase RTDB ↔ TypeScript ↔ On-Chain Anchor account.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Telemetry values computed from a single completed trip's GPS trace.
 * Field widths match the Rust on-chain types:
 *   fidelityX100  → u16 (0–10000)
 *   arrivalDeltaS → i16 (-32768 to 32767, signed)
 *   hardBrakes    → u8  (0–255)
 *   deviations    → u8  (0–255)
 *   sosTrigger    → u8  (0 or 1)
 */
export interface TripTelemetry {
  fidelityX100:  number;
  arrivalDeltaS: number;
  hardBrakes:    number;
  deviations:    number;
  sosTrigger:    number;
  isCompleted:   boolean;
}

/**
 * Driver reputation as stored in Firebase RTDB at reputation/drivers/{driverId}.
 * This is the denormalized fast-read layer. On-chain is authoritative; this
 * is the optimistic view that updates immediately on trip completion.
 */
export interface DriverReputationFirebase {
  driverPubkey:         string;
  trustScore:           number;     // 0–1000
  totalTrips:           number;
  completedTrips:       number;
  cancelledTrips:       number;
  avgRatingX100:        number;     // 0–500 (stars × 100)
  ratingCount:          number;
  onTimeArrivals:       number;     // trips where |arrivalDeltaS| < 120
  sosTriggered:         number;
  zkVerified:           boolean;
  zkCommitment:         string;     // hex-encoded Poseidon commitment
  pathFidelityX100:     number;     // EMA 0–10000
  avgArrivalDeltaS:     number;     // rolling mean; negative = consistently early
  hardBrakeEvents:      number;     // lifetime cumulative
  routeDeviationEvents: number;     // lifetime cumulative
  lastSolanaTx:         string | null; // most recent confirmed update_rep tx sig
  lastUpdated:          number;     // unix milliseconds
}

/**
 * Driver reputation as decoded from the on-chain DriverReputationProfile PDA.
 * Seeds: ["driver_rep", driver_pubkey].
 * Field names use camelCase here; Rust uses snake_case — mapping is 1:1.
 */
export interface DriverReputationOnChain {
  driver:               string;   // Pubkey base58
  trustScore:           number;   // u16 0–1000
  totalTrips:           number;   // u32
  completedTrips:       number;   // u32
  pathFidelityX100:     number;   // u16
  avgArrivalDeltaS:     number;   // i16 (JavaScript number, may be negative)
  hardBrakeEvents:      number;   // u8
  routeDeviationEvents: number;   // u8
  sosTriggered:         number;   // u8
  zkVerified:           boolean;
  bump:                 number;   // u8 PDA bump seed
}

/**
 * Merged view returned by GET /api/reputation/[wallet] and used in the
 * Driver Trust Passport page. On-chain values are authoritative where present;
 * Firebase fills gaps when the chain is unavailable.
 */
export interface DriverReputationMerged extends DriverReputationFirebase {
  onChain:          DriverReputationOnChain | null;
  source:           'chain+firebase' | 'firebase-only';
  // Derived display fields — computed in lib/solana/trrlProgram.ts
  completionRate:   number;   // 0–1
  averageRating:    number;   // 0–5
  punctualityPct:   number;   // 0–100
  anomalyIndex:     number;   // 0–100, lower is better
  cohortPercentile: number;   // 0–100
}

/**
 * Escrow state record stored in Firebase and cross-referenced with
 * the Memo-anchored on-chain record.
 */
export interface EscrowRecord {
  tripId:          string;
  driverPubkey:    string;
  passengerPubkey: string;
  fareLamports:    number;
  status:          'locked' | 'released' | 'reclaimed' | 'disputed';
  memoTx:          string;          // Memo program tx signature
  createdAt:       number;          // unix milliseconds
  releasedAt:      number | null;
  gpsVerifiedAt:   number | null;
}
