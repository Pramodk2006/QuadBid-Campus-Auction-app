import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function MobileBottomNav({
  onOpenCreate,
  onOpenWatchlist,
  onOpenAiConcierge,
  onOpenSellerHub,
  watchlistCount = 0,
}) {
  const { isAuthenticated } = useAuth();

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-2 py-1.5 flex items-center justify-around pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))]"
    >
      {/* 1. Explore / Marketplace */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="flex flex-col items-center justify-center py-1 px-2 text-slate-700 hover:text-indigo-600 transition-colors min-w-[56px] cursor-pointer"
      >
        <span className="material-symbols-outlined text-[22px]">storefront</span>
        <span className="text-[10px] font-bold mt-0.5">Market</span>
      </button>

      {/* 2. AI Concierge */}
      <button
        type="button"
        onClick={onOpenAiConcierge}
        className="flex flex-col items-center justify-center py-1 px-2 text-indigo-600 hover:text-indigo-700 transition-colors min-w-[56px] cursor-pointer"
      >
        <span className="material-symbols-outlined text-[22px]">smart_toy</span>
        <span className="text-[10px] font-bold mt-0.5">AI Concierge</span>
      </button>

      {/* 3. Prominent Raised List Item Button */}
      <button
        type="button"
        onClick={onOpenCreate}
        className="flex flex-col items-center justify-center -mt-5 cursor-pointer group"
      >
        <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg group-hover:bg-slate-800 group-active:scale-95 transition-all ring-4 ring-white">
          <span className="material-symbols-outlined text-[26px]">add</span>
        </div>
        <span className="text-[10px] font-bold text-slate-900 mt-1">List Lot</span>
      </button>

      {/* 4. Watchlist */}
      <button
        type="button"
        onClick={onOpenWatchlist}
        className="relative flex flex-col items-center justify-center py-1 px-2 text-slate-700 hover:text-indigo-600 transition-colors min-w-[56px] cursor-pointer"
      >
        <div className="relative">
          <span className="material-symbols-outlined text-[22px]">bookmark</span>
          {watchlistCount > 0 && (
            <span className="absolute -top-1 -right-1.5 px-1 min-w-[14px] h-[14px] rounded-full bg-slate-900 text-white text-[9px] font-mono font-bold flex items-center justify-center">
              {watchlistCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-bold mt-0.5">Watchlist</span>
      </button>

      {/* 5. Handover Hub */}
      <button
        type="button"
        onClick={onOpenSellerHub}
        className="flex flex-col items-center justify-center py-1 px-2 text-slate-700 hover:text-indigo-600 transition-colors min-w-[56px] cursor-pointer"
      >
        <span className="material-symbols-outlined text-[22px]">handshake</span>
        <span className="text-[10px] font-bold mt-0.5">Handover</span>
      </button>
    </nav>
  );
}

