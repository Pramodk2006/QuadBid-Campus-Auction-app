import React from 'react';
import { Gavel, Clock, Shield } from 'lucide-react';
import { formatRupees } from '../utils/formatters';

export default function LiveBidStream({ recentBids, onSelectLot }) {
  return (
    <aside className="space-y-6">
      {/* 1. Live Bid Stream Widget */}
      <div className="rounded-2xl bg-[#141c2e] border border-[#2a3a48]/60 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#2a3a48]/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#7dd3fc] live-indicator" />
            <h3 className="text-sm font-bold text-white font-headline">Live Campus Bid Stream</h3>
          </div>
          <span className="px-2 py-0.5 rounded bg-[#1a2438] text-[#7dd3fc] text-[10px] font-mono font-semibold uppercase tracking-wider">
            Real-time
          </span>
        </div>

        {recentBids.length === 0 ? (
          <p className="text-xs text-[#a0b4c4] text-center py-4">Waiting for incoming campus bids...</p>
        ) : (
          <div className="space-y-3">
            {recentBids.slice(0, 6).map((b) => (
              <div
                key={b.id}
                onClick={() => onSelectLot(b.listing_id)}
                className="p-3 rounded-xl bg-[#111828] border border-[#2a3a48]/40 hover:border-[#7dd3fc]/40 transition-colors flex items-start justify-between gap-3 cursor-pointer"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#1a2438] text-[#7dd3fc] flex items-center justify-center font-bold text-xs shrink-0">
                    {b.bidder_display_name ? b.bidder_display_name.charAt(0) : 'U'}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">
                      {formatRupees(b.amount)} on <span className="text-[#7dd3fc]">Lot #{b.listing_id}</span>
                    </div>
                    <div className="text-[11px] text-[#a0b4c4] mt-0.5 font-mono truncate max-w-[170px]">
                      {b.bidder_display_name}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-[#4a6070] shrink-0">
                  {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Campus Handover Protocol Card */}
      <div className="rounded-2xl bg-[#141c2e] border border-[#2a3a48]/60 p-5 space-y-3">
        <div className="flex items-center gap-2 text-[#7dd3fc]">
          <Shield className="w-4 h-4" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Physical Handshake Escrow</h3>
        </div>
        <p className="text-xs text-[#a0b4c4] leading-relaxed">
          Seniors and juniors meet in person inside hostel common rooms. Digital confirmation releases only upon physical handshake code verification.
        </p>
      </div>
    </aside>
  );
}
