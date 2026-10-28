import React, { useState } from 'react';
import { formatRupees, formatTime } from '../utils/formatters';

export default function LiveBidStream({ recentBids = [], onSelectLot }) {
  const [snipingQuery, setSnipingQuery] = useState('');
  const [alertSaved, setAlertSaved] = useState(false);

  const handleSetSnipingAlert = (e) => {
    e.preventDefault();
    if (!snipingQuery.trim()) return;
    setAlertSaved(true);
    setTimeout(() => {
      setAlertSaved(false);
      setSnipingQuery('');
    }, 3000);
  };

  return (
    <aside className="space-y-8">
      {/* 1. LIVE BID STREAM TICKER */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 live-indicator"></span>
            <h3 className="text-sm font-bold text-slate-900 font-headline">Live Campus Bid Stream</h3>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-mono font-bold uppercase tracking-wider border border-emerald-200">
            Real-time
          </span>
        </div>

        <div className="space-y-3.5">
          {recentBids.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              <span className="material-symbols-outlined text-2xl text-slate-300 block mb-1">
                hourglass_empty
              </span>
              <span>Waiting for live bids...</span>
            </div>
          ) : (
            recentBids.slice(0, 6).map((bid) => {
              const initials = bid.bidder_name
                ? bid.bidder_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()
                : 'ST';

              return (
                <div
                  key={bid.id}
                  onClick={() => onSelectLot && onSelectLot(bid.listing_id)}
                  className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 flex items-start justify-between gap-3 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {initials}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {formatRupees(bid.amount)}{' '}
                        <span className="text-indigo-600">on Lot #{bid.listing_id}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {bid.bidder_display_name} •{' '}
                        <span className="text-emerald-700 font-medium">Valid Bid</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 font-medium shrink-0">
                    {formatTime(bid.created_at)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. SNIPING ALERT / WISHLIST WIDGET */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 text-slate-900">
          <span className="material-symbols-outlined text-[20px] text-indigo-600">alarm</span>
          <h3 className="text-sm font-bold text-slate-900 font-headline">Campus Sniping Alert</h3>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Can’t monitor auctions? Set an alert trigger and our system will notify you the moment an item is listed.
        </p>

        <form onSubmit={handleSetSnipingAlert} className="space-y-2.5 pt-1">
          <input
            type="text"
            value={snipingQuery}
            onChange={(e) => setSnipingQuery(e.target.value)}
            placeholder='e.g. "Dorm kettle under ₹350"'
            className="w-full bg-slate-50 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 border border-slate-200 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition-colors"
          />
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">notification_add</span>
            <span>{alertSaved ? '✓ Alert Trigger Saved!' : 'Set Sniping Alert'}</span>
          </button>
        </form>

        <div className="text-[11px] text-slate-500 flex items-center gap-1 pt-1">
          <span className="material-symbols-outlined text-[13px] text-slate-400">lock</span>
          <span>Instant tab or browser notification</span>
        </div>
      </div>

      {/* 3. CIRCULAR METRICS STATS */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4 shadow-sm">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 font-headline">
          <span className="material-symbols-outlined text-emerald-600 text-[18px]">eco</span>
          <span>Campus Circular Impact</span>
        </h4>

        <div className="grid grid-cols-1 gap-3">
          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">recycling</span>
            </div>
            <div>
              <span className="text-lg font-bold text-slate-900 font-mono leading-tight block">142</span>
              <span className="text-xs text-slate-500 font-medium">Items saved from landfill</span>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">currency_rupee</span>
            </div>
            <div>
              <span className="text-lg font-bold text-slate-900 font-mono leading-tight block">₹1.8L</span>
              <span className="text-xs text-slate-500 font-medium">Student money retained</span>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">handshake</span>
            </div>
            <div>
              <span className="text-lg font-bold text-slate-900 font-mono leading-tight block">100%</span>
              <span className="text-xs text-slate-500 font-medium">Verified campus handovers</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
