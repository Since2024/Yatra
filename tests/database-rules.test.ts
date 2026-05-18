import { describe, expect, it } from 'vitest';
import rules from '@/database.rules.json';

describe('database rules privacy boundaries', () => {
  const rootRules = (rules as any).rules;

  it('restricts trip reads to participants only', () => {
    const readRule = rootRules.trips.$tripId['.read'] as string;
    expect(readRule).toContain("data.child('passengerId').val() === auth.uid");
    expect(readRule).toContain("data.child('driverId').val() === auth.uid");
  });

  it('restricts booking reads to the owning passenger', () => {
    const readRule = rootRules.bookings.$bookingId['.read'] as string;
    expect(readRule).toBe("auth != null && data.child('passengerId').val() === auth.uid");
  });

  it('restricts booking writes to the owning passenger', () => {
    const writeRule = rootRules.bookings.$bookingId['.write'] as string;
    expect(writeRule).toBe("auth != null && data.child('passengerId').val() === auth.uid");
  });

  it('restricts tripLocations reads to trip participants via trips node', () => {
    const readRule = rootRules.tripLocations.$tripId['.read'] as string;
    expect(readRule).toContain("root.child('trips').child($tripId).child('passengerId').val() === auth.uid");
    expect(readRule).toContain("root.child('trips').child($tripId).child('driverId').val() === auth.uid");
  });

  it('preserves tripLocations participant write rule', () => {
    const writeRule = rootRules.tripLocations.$tripId['.write'] as string;
    expect(writeRule).toContain("root.child('trips').child($tripId).child('passengerId').val() === auth.uid");
    expect(writeRule).toContain("root.child('trips').child($tripId).child('driverId').val() === auth.uid");
  });

  it('preserves trips participant write rule and schema validation', () => {
    const writeRule = rootRules.trips.$tripId['.write'] as string;
    expect(writeRule).toContain("data.child('passengerId').val() === auth.uid");
    expect(writeRule).toContain("data.child('driverId').val() === auth.uid");
    expect(rootRules.trips.$tripId['.validate']).toContain("newData.hasChildren(['id','driverId'");
  });
});
