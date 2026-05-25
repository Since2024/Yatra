'use client';

import { ExternalLink, CheckCircle2, Ticket, Bus, Bike, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Booking } from '@/lib/types';

function getVehicleEmoji(vehicleType?: string): string {
    switch (vehicleType) {
        case 'bus': return '🚌';
        case 'bike': return '🚲';
        case 'taxi': return '🚕';
        default: return '🎫';
    }
}

function getFormattedDate(timestamp: any): string {
    if (!timestamp) return 'Unknown date';
    if (timestamp instanceof Date && !isNaN(timestamp.getTime())) {
        return timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    if (typeof timestamp === 'string') {
        const d = new Date(timestamp);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
    }
    if (typeof timestamp === 'number') {
        const d = new Date(timestamp > 99999999999 ? timestamp : timestamp * 1000);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
    }
    if (typeof timestamp === 'object' && timestamp !== null) {
        if ('seconds' in timestamp && typeof timestamp.seconds === 'number') {
            const d = new Date(timestamp.seconds * 1000);
            if (!isNaN(d.getTime())) {
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            }
        }
        if ('toDate' in timestamp && typeof timestamp.toDate === 'function') {
            const d = timestamp.toDate();
            if (d instanceof Date && !isNaN(d.getTime())) {
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            }
        }
    }
    return 'Unknown date';
}

function formatTime(isoString: any) {
    if (!isoString) return 'Unknown date';
    let d: Date;
    if (isoString instanceof Date) {
        d = isoString;
    } else if (typeof isoString === 'number') {
        d = new Date(isoString > 99999999999 ? isoString : isoString * 1000);
    } else if (typeof isoString === 'object' && isoString !== null && 'seconds' in isoString) {
        d = new Date(isoString.seconds * 1000);
    } else {
        d = new Date(String(isoString));
    }
    if (isNaN(d.getTime())) return 'Unknown time';
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function TripTicketCard({ 
    booking, 
    onReclaim 
}: { 
    booking: Booking; 
    onReclaim?: (id: string) => void;
}) {
    const { receipt, route, fare, vehicleType, timestamp } = booking;
    const emoji = getVehicleEmoji(vehicleType);
    const hasReceipt = !!receipt;

    const handleOpenExplorer = () => {
        if (receipt?.explorerLink) {
            window.open(receipt.explorerLink, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <div
            className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${hasReceipt ? 'border-secondary/30 bg-card shadow-md' : 'border-border bg-surface-soft' }`}
        >
            {/* Decorative ticket-hole strip */}
            {hasReceipt && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 via-blue-500 to-cyan-500" />
            )}

            <div className="p-4 pl-5">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl" role="img" aria-label="vehicle">{emoji}</span>
                        <div>
                            <p className="font-black text-foreground text-sm">{route || 'Trip'}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {getFormattedDate(timestamp)}
                            </p>
                        </div>
                    </div>

                    {/* Fare */}
                    {fare > 0 && (
                        <span className="text-sm font-black text-emerald-600 shrink-0">रु {fare}</span>
                    )}
                </div>

                {/* Receipt Section */}
                {hasReceipt ? (
                    <div className="mt-4 space-y-3">
                        {/* Verified badge */}
                        <div className="flex items-center gap-2">
                            <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] px-2 py-0.5 font-black uppercase tracking-widest flex items-center gap-1 shadow-sm">
                                <CheckCircle2 className="w-3 h-3" />
                                Verified on Solana
                            </Badge>
                            <Badge className="bg-cyan-50 text-cyan-700 border-cyan-200 text-[10px] px-2 py-0.5 font-black uppercase tracking-widest shadow-sm">
                                Soulbound NFT
                            </Badge>
                        </div>

                        {/* Mint address */}
                        <div className="bg-surface-soft rounded-xl p-3 border border-border font-mono text-[11px] text-muted-foreground flex items-center justify-between gap-2">
                            <span className="truncate">
                                {receipt.mintAddress.slice(0, 8)}...{receipt.mintAddress.slice(-8)}
                            </span>
                            <Ticket className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        </div>

                        {/* Minted at */}
                        {receipt.mintedAt && (
                            <p className="text-[11px] text-muted-foreground">
                                Minted: {formatTime(receipt.mintedAt)}
                            </p>
                        )}

                        {/* Explorer button */}
                        <Button
                            onClick={handleOpenExplorer}
                            className="w-full h-10 text-xs font-black bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-md tracking-wide text-white"
                        >
                            <ExternalLink className="w-3.5 h-3.5 mr-2" />
                            ⭐ Blockchain Receipt
                        </Button>
                    </div>
                ) : (
                    <div className="mt-3 flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <Ticket className="w-3.5 h-3.5" />
                            <span>
                                {['cancelled', 'rejected', 'expired'].includes(booking.status) 
                                    ? 'Trip failed' 
                                    : booking.status === 'completed'
                                        ? 'Completed (Receipt generating...)'
                                        : 'Receipt will appear after dropoff'}
                            </span>
                        </div>
                        
                        {booking.paymentMethod === 'digital' && 
                         ['cancelled', 'rejected', 'expired'].includes(booking.status) && 
                         booking.escrowStatus === 'locked' && 
                         onReclaim && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onReclaim(booking.id)}
                                className="w-full h-9 text-xs font-bold border-primary/25 text-primary-hover hover:bg-primary-soft"
                            >
                                Reclaim Locked Funds (SOL)
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
