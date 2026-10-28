import React, { useState, useEffect } from 'react';
import { Clock, ShieldCheck, Flame, Gavel, User, MapPin } from 'lucide-react';
import { formatRupees, getTimeRemaining } from '../utils/formatters';

const CATEGORY_FALLBACK_IMAGES = {
  cycle: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80',
  calculator: 'https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&w=800&q=80',
  books: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
  electronics: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=800&q=80',
  other: 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=800&q=80',
};

export default function ListingCard({ listing, onSelect }) {
  const [timer, setTimer] = useState(() => getTimeRemaining(listing.closes_at));

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
      className="group rounded-2xl bg-[#141c2e] border border-[#2a3a48]/60 hover:border-[#7dd3fc]/50 transition-all duration-300 overflow-hidden flex flex-col justify-between cursor-pointer shadow-sm hover:shadow-lg hover:shadow-[#7dd3fc]/5"
    >
      {/* Top Image Container */}
      <div className="relative aspect-[16/10] bg-[#111828] overflow-hidden">
        <img
          src={photo}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Live Countdown & Anti-Snipe Badges Overlay */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          <div className="px-3 py-1 rounded-full bg-[#0a0e1a]/85 backdrop-blur-md border border-[#2a3a48] text-white font-mono text-xs font-semibold flex items-center gap-1.5 shadow-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                timer.isClosed ? 'bg-[#4a6070]' : timer.isUrgent ? 'bg-[#ff6b6b]' : 'bg-[#7dd3fc]'
              } live-indicator`}
            />
            <span className="tabular-nums">{timer.formatted}</span>
          </div>

          {timer.isUrgent && !timer.isClosed && (
            <div className="px-2.5 py-0.5 rounded-md bg-[#1a3a4e]/90 backdrop-blur-md text-[#7dd3fc] text-[11px] font-semibold flex items-center gap-1 border border-[#7dd3fc]/30">
              <Flame className="w-3 h-3 text-[#ff6b6b]" />
              <span>+60s Anti-Snipe</span>
            </div>
          )}
        </div>

        {/* Location Tag */}
        <div className="absolute bottom-3 left-3">
          <span className="px-2.5 py-1 rounded-md bg-[#0a0e1a]/85 backdrop-blur-md text-[#e0e8f0] text-[11px] font-medium flex items-center gap-1 border border-[#2a3a48]/40">
            <MapPin className="w-3 h-3 text-[#7dd3fc]" />
            <span>Campus Quad Handover</span>
          </span>
        </div>

        {/* Condition Tag */}
        <div className="absolute top-3 right-3 bg-[#1a2438]/90 backdrop-blur-md border border-[#2a3a48] text-[#e0e8f0] text-[10px] font-medium uppercase px-2 py-0.5 rounded-md">
          {listing.condition?.replace('_', ' ')}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#88b4cc] font-medium uppercase tracking-wider text-[11px]">
              {listing.category} • Lot #{listing.id}
            </span>
          </div>

          <h3 className="text-base font-bold text-white group-hover:text-[#7dd3fc] transition-colors line-clamp-2">
            {listing.title}
          </h3>

          <div className="flex items-center gap-1.5 text-xs text-[#a0b4c4]">
            <User className="w-3.5 h-3.5 text-[#88b4cc]" />
            <span className="truncate">
              Seller: <strong className="text-white font-medium">{listing.seller_display_name}</strong>
            </span>
          </div>
        </div>

        {/* Price & CTA */}
        <div className="pt-3 border-t border-[#2a3a48]/60 flex items-end justify-between gap-4">
          <div>
            <span className="text-[11px] text-[#4a6070] block">
              {listing.bid_count > 0 ? `Leading Bid (${listing.bid_count} bids)` : 'Starting Price'}
            </span>
            <div className="text-xl font-bold text-white font-mono tracking-tight tabular-nums">
              {formatRupees(listing.current_price || listing.starting_price)}
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(listing);
            }}
            className="px-4 py-2 rounded-xl bg-[#7dd3fc] hover:bg-[#c8eaff] text-[#001f2e] text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Gavel className="w-3.5 h-3.5" />
            <span>Bid</span>
          </button>
        </div>
      </div>
    </div>
  );
}
