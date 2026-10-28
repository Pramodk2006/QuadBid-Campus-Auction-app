import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatRupees, getTimeRemaining } from '../utils/formatters';

export default function SellerHubModal({
  onClose,
  listings = [],
  onSelectLot,
  onOpenCreate,
}) {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('seller'); // 'seller' | 'bids'

  const isMyLot = (l) => {
    if (!user) return false;
    if (l.seller_id != null && user.id != null && Number(l.seller_id) === Number(user.id)) return true;
    if (user.display_name && l.seller_display_name && l.seller_display_name === user.display_name) return true;
    if (user.roll_number && l.seller_display_name && l.seller_display_name.includes(user.roll_number)) return true;
    return false;
  };

  const myListings = listings.filter(isMyLot);
  const otherListings = listings.filter((l) => !isMyLot(l));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-white text-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <span className="material-symbols-outlined text-lg">handshake</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-headline">Campus Handover Hub</h2>
              <p className="text-xs text-slate-500">Track your listed sales, leading bids, and QR codes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-6 pt-3 border-b border-slate-200 flex items-center justify-between gap-4 text-xs font-bold">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('seller')}
              className={`pb-2.5 border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
                activeTab === 'seller'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-sm">storefront</span>
              <span>My Listed Lots ({myListings.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bids')}
              className={`pb-2.5 border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
                activeTab === 'bids'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-sm">gavel</span>
              <span>Available Lots ({otherListings.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenCreate();
            }}
            className="mb-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>List Item</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {!isAuthenticated ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
              <span className="material-symbols-outlined text-3xl text-slate-400">lock</span>
              <p className="text-xs font-bold text-slate-800">Sign in with your campus account</p>
              <p className="text-[11px] text-slate-500">Sign in to manage lots you posted as a senior seller.</p>
            </div>
          ) : activeTab === 'seller' ? (
            myListings.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-3">
                <span className="material-symbols-outlined text-3xl text-slate-400">inventory_2</span>
                <p className="text-xs font-bold text-slate-800">You haven't listed any lots yet</p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Graduating or moving hostels? Pass your cycles, calculators, and books to incoming juniors.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCreate();
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  Create Your First Listing
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {myListings.map((l) => {
                  const timer = getTimeRemaining(l.closes_at);
                  const photo = l.photos && l.photos.length > 0 ? l.photos[0] : null;

                  return (
                    <div
                      key={l.id}
                      onClick={() => {
                        onClose();
                        onSelectLot(l.id);
                      }}
                      className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm bg-white flex items-center justify-between gap-4 cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {photo ? (
                          <img
                            src={photo}
                            alt={l.title}
                            className="w-14 h-14 rounded-lg object-cover shrink-0 border border-slate-200"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <span className="material-symbols-outlined">inventory_2</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-indigo-600 uppercase font-mono block">
                            {l.category} • Lot #{l.id}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 truncate">
                            {l.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-mono">
                            <span>{timer.formatted}</span>
                            <span>•</span>
                            <span className="text-slate-800 font-bold">{formatRupees(l.current_price || l.starting_price)}</span>
                            <span>•</span>
                            <span>{l.bid_count} bids placed</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase font-mono ${
                          timer.isClosed ? 'bg-slate-100 text-slate-700 border border-slate-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}>
                          {timer.isClosed ? 'Awaiting Handover' : 'Active Live'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Other Lots Tab */
            <div className="space-y-3">
              {otherListings.map((l) => {
                const timer = getTimeRemaining(l.closes_at);
                const photo = l.photos && l.photos.length > 0 ? l.photos[0] : null;

                return (
                  <div
                    key={l.id}
                    onClick={() => {
                      onClose();
                      onSelectLot(l.id);
                    }}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm bg-white flex items-center justify-between gap-4 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {photo ? (
                        <img
                          src={photo}
                          alt={l.title}
                          className="w-14 h-14 rounded-lg object-cover shrink-0 border border-slate-200"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                          <span className="material-symbols-outlined">inventory_2</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-indigo-600 uppercase font-mono block">
                          {l.category} • Lot #{l.id}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 truncate">
                          {l.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-mono">
                          <span>{timer.formatted}</span>
                          <span>•</span>
                          <span className="text-slate-800 font-bold">{formatRupees(l.current_price || l.starting_price)}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      Inspect Lot
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
