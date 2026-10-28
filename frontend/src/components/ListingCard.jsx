import React, { useState, useEffect } from 'react';
import { formatRupees, getTimeRemaining } from '../utils/formatters';

const CATEGORY_FALLBACK_IMAGES = {
  cycle: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80',
  calculator: 'https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&w=800&q=80',
  books: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
  electronics: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=800&q=80',
  other: 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=800&q=80',
};

export default function ListingCard({ listing, onSelect, featured = false }) {
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

  const currentPrice = listing.current_price || listing.starting_price;
  const nextMinBid = listing.bid_count > 0 ? currentPrice + listing.min_bid_increment : currentPrice;

  // Format Condition for human display
  const conditionLabel = {
    new: 'Brand New',
    like_new: 'Like New',
    good: 'Good Condition',
    fair: 'Fair',
    needs_repair: 'Needs Repair',
  }[listing.condition] || listing.condition;

  // If featured (wide horizontal card matching Mockup Item 1 & 2)
  if (featured) {
    return (
      <div
        onClick={() => onSelect(listing)}
        className="group rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-300 overflow-hidden shadow-sm cursor-pointer"
      >
        <div className="grid grid-cols-1 md:grid-cols-12">
          {/* Image Section */}
          <div className="md:col-span-5 relative min-h-[260px] bg-slate-100 overflow-hidden">
            <img
              src={photo}
              alt={listing.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
            {/* Top Badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              <div
                className={`px-3 py-1 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 font-mono text-xs font-bold flex items-center gap-1.5 shadow-sm ${
                  timer.isClosed
                    ? 'text-slate-600'
                    : timer.isUrgent
                    ? 'text-rose-700'
                    : 'text-slate-900'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    timer.isClosed ? 'bg-slate-400' : timer.isUrgent ? 'bg-rose-500 live-indicator' : 'bg-emerald-500 live-indicator'
                  }`}
                />
                <span className="tabular-nums">{timer.formatted}</span>
              </div>

              {timer.isUrgent && !timer.isClosed && (
                <div className="px-2.5 py-0.5 rounded-md bg-indigo-50/95 backdrop-blur-md text-indigo-700 text-[11px] font-semibold flex items-center gap-1 border border-indigo-200 shadow-xs">
                  <span className="material-symbols-outlined text-[13px]">alarm</span>
                  <span>+60s Anti-Snipe</span>
                </div>
              )}
            </div>

            {/* Location Tag */}
            <div className="absolute bottom-4 left-4">
              <span className="px-2.5 py-1 rounded-md bg-white/95 backdrop-blur-md text-slate-700 text-xs font-semibold flex items-center gap-1 border border-slate-200 shadow-sm">
                <span className="material-symbols-outlined text-[14px] text-slate-900">location_on</span>
                <span>Hostel Quad Handover</span>
              </span>
            </div>
          </div>

          {/* Card Content */}
          <div className="md:col-span-7 p-6 sm:p-7 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {listing.category} • Lot #{listing.id}
                  </span>
                  <h2 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors mt-0.5">
                    {listing.title}
                  </h2>
                </div>
                <span className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold">
                  {conditionLabel}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="material-symbols-outlined text-[15px] text-slate-400">account_circle</span>
                <span>
                  Seller:{' '}
                  <span className="text-slate-900 font-semibold">{listing.seller_display_name}</span>
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                {listing.description}
              </p>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">shield</span>
                  <span>Campus Escrow Active</span>
                </div>
                <span className="text-slate-400 font-mono text-[11px]">
                  {listing.bid_count > 0 ? `${listing.bid_count} bids placed` : 'No bids yet'}
                </span>
              </div>
            </div>

            {/* Price & CTA */}
            <div className="pt-4 border-t border-slate-200 flex items-end justify-between gap-4">
              <div>
                <span className="text-xs text-slate-500 font-medium block">
                  {timer.isClosed
                    ? listing.bid_count > 0
                      ? `Winning Bid (${listing.bid_count} bids)`
                      : 'Closed (Unsold)'
                    : listing.bid_count > 0
                    ? `Leading Bid (${listing.bid_count} bids)`
                    : 'Starting Price'}
                </span>
                <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
                  {formatRupees(currentPrice)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {timer.isClosed ? (
                  <button
                    type="button"
                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px] text-indigo-600">handshake</span>
                    <span>View Handover Outcome</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">gavel</span>
                    <span>Quick Bid {formatRupees(nextMinBid)}</span>
                  </button>
                )}
                <button
                  type="button"
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-slate-900 transition-colors"
                  title="View Auction Room"
                >
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Standard 2-column balanced sublot card
  return (
    <div
      onClick={() => onSelect(listing)}
      className="group rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-sm cursor-pointer"
    >
      {/* Top Image */}
      <div className="relative h-52 bg-slate-100 overflow-hidden">
        <img
          src={photo}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        {/* Countdown Badge */}
        <div className="absolute top-3 left-3">
          <div
            className={`px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 font-mono text-xs font-bold flex items-center gap-1.5 shadow-sm ${
              timer.isClosed
                ? 'text-slate-500'
                : timer.isUrgent
                ? 'text-rose-700'
                : 'text-slate-800'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                timer.isClosed ? 'bg-slate-400' : timer.isUrgent ? 'bg-rose-500 live-indicator' : 'bg-emerald-500 live-indicator'
              }`}
            />
            <span className="tabular-nums">{timer.formatted}</span>
          </div>
        </div>

        {/* Location chip */}
        <div className="absolute bottom-3 left-3">
          <span className="px-2 py-0.5 rounded-md bg-white/95 backdrop-blur-md text-slate-700 text-[11px] font-semibold border border-slate-200 shadow-sm flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px] text-slate-900">location_on</span>
            <span>Hostel Quad</span>
          </span>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-bold uppercase tracking-wider text-[11px]">
              {listing.category} • #{listing.id}
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200">
              {conditionLabel}
            </span>
          </div>

          <h4 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors mt-1.5 line-clamp-1">
            {listing.title}
          </h4>

          <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
            {listing.description}
          </p>
        </div>

        {/* Price & CTA */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-medium block">
              {timer.isClosed
                ? listing.bid_count > 0
                  ? `Won (${listing.bid_count})`
                  : 'Unsold'
                : listing.bid_count > 0
                ? `Leading (${listing.bid_count})`
                : 'Starting'}
            </span>
            <span className="text-lg font-bold text-slate-900 font-mono">
              {formatRupees(currentPrice)}
            </span>
          </div>
          {timer.isClosed ? (
            <button
              type="button"
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1 transition-all shadow-xs"
            >
              <span className="material-symbols-outlined text-[15px] text-indigo-600">handshake</span>
              <span>Outcome</span>
            </button>
          ) : (
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1 transition-all shadow-xs"
            >
              <span className="material-symbols-outlined text-[15px]">gavel</span>
              <span>Bid {formatRupees(nextMinBid)}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
