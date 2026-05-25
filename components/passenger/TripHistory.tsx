'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { subscribeToPassengerHistory } from '@/lib/firebaseDb';
import { Booking } from '@/lib/types';
import TripTicketCard from './TripTicketCard';
import { History, Ticket } from 'lucide-react';

export default function TripHistory({ onReclaim }: { onReclaim?: (id: string) => void }) {
    const { currentUser } = useAuth();
    const [bookings, setBookings] = useState<Booking[]>([]);

    useEffect(() => {
        if (!currentUser) return;

        const unsubscribe = subscribeToPassengerHistory(currentUser.uid, (data) => {
            setBookings(data);
        });

        return () => unsubscribe();
    }, [currentUser]);

    if (bookings.length === 0) return null;

    return (
        <div className="space-y-4">
            {/* Section Header */}
            <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-black text-foreground">Trip History</h2>
                {bookings.some(b => b.receipt) && (
                    <span className="ml-1 text-[10px] font-black uppercase tracking-widest bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                        <Ticket className="w-2.5 h-2.5" />
                        NFT Receipts
                    </span>
                )}
            </div>

            {/* Ticket list */}
            <div className="space-y-3">
                {bookings.map((booking) => (
                    <TripTicketCard 
                        key={booking.id} 
                        booking={booking} 
                        onReclaim={onReclaim}
                    />
                ))}
            </div>
        </div>
    );
}
