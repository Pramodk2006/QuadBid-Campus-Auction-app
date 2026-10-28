import React, { useState, useEffect } from 'react';
import { Clock, ShieldCheck, Flame, Gavel, User } from 'lucide-react';
import { formatRupees, getTimeRemaining } from '../utils/formatters';

const CATEGORY_FALLBACK_IMAGES = {
  cycle: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=600&q=80',
  calculator: 'https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&w=600&q=80',
  books: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
  electronics: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=600&q=80',
  other: 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=600&q=80',
};

export default function ListingCard({ listing, onSelect }) {
  const [timer, setTimer] = useState(() => getTimeRemaining(listing.closes_at));

  // 1-second interval to keep live countdown ticker accurate
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(getTimeRemaining(listing.closes_at));
    }, 1000);
    return () => clearInterval(interval);
  }, [listing.closes_at]);

  const photo =
    listing.photos && listing.photos.length > 0
      ? listing.photos[0]
      : CATEGORY_FALLBACK_IMAGES[listing.category] || CATEGORY_FALLBACK_IMAGES.other;

  return (
    <div
      onClick={() => onSelect(listing)}
      className="group bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-400/80 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-200 flex flex-col overflow-hidden cursor-pointer"
    >
      {/* Top Media Container (4:3 aspect ratio) */}
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        <img
          src={photo}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />

        {/* Live Countdown Badge Overlay */}
        <div className="absolute top-3 left-3">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md border shadow-sm ${
              timer.isClosed
                ? 'bg-slate-900/85 text-slate-300 border-slate-700'
                : timer.isUrgent
                ? 'bg-rose-500/90 text-white border-rose-400 animate-pulse'
                : 'bg-white/90 text-slate-800 border-white/60'
            }`}
          >
            {!timer.isClosed && (
              <span
                className={`w-2 h-2 rounded-full ${
                  timer.isUrgent ? 'bg-white' : 'bg-amber-500'
                } animate-pulse-dot`}
              />
            )}
            <span className="tabular-nums font-mono">{timer.formatted}</span>
          </div>
        </div>

        {/* Anti-sniping Pill Alert */}
        {timer.isUrgent && !timer.isClosed && (
          <div className="absolute bottom-3 left-3 right-3 bg-rose-600/90 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 shadow-md">
            <Flame className="w-3.5 h-3.5" />
            <span>Anti-Sniping Active (+60s on bid)</span>
          </div>
        )}

        {/* Condition Badge */}
        <div className="absolute top-3 right-3 bg-slate-900/75 backdrop-blur-md text-white text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full border border-white/20">
          {listing.condition?.replace('_', ' ')}
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          {/* Seller Roll-Number Identity */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-1.5 font-medium truncate max-w-[200px]" title={listing.seller_display_name}>
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate">{listing.seller_display_name}</span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Verified
            </span>
          </div>

          {/* Title */}
          <h3 className="font-bold text-slate-900 text-sm line-clamp-2 group-hover:text-indigo-600 transition-colors">
            {listing.title}
          </h3>
        </div>

        {/* Price & Bid Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-end justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">
              {listing.bid_count > 0 ? 'Leading Bid' : 'Starting Price'}
            </span>
            <div className="text-xl font-extrabold text-slate-950 font-headline tabular-nums">
              {formatRupees(listing.current_price || listing.starting_price)}
            </div>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
              <Gavel className="w-3.5 h-3.5" />
              <span>{listing.bid_count || 0} bids</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
