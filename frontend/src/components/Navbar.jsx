import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { requestNotificationPermission, getNotificationPermission, sendBrowserNotification } from '../utils/notifications';

export default function Navbar({
  onOpenCreate,
  onOpenAuth,
  onOpenWatchlist,
  onOpenAiConcierge,
  onOpenSellerHub,
  searchQuery,
  setSearchQuery,
  watchlistCount = 0,
}) {
  const { user, isAuthenticated, logout } = useAuth();
  const [notifStatus, setNotifStatus] = useState(getNotificationPermission);

  const handleToggleNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifStatus(perm);
    if (perm === 'granted') {
      sendBrowserNotification('🎉 QuadBid Notifications Enabled!', {
        body: 'You will receive instant alerts when outbid or when an auction deadline is extended.',
      });
    } else if (perm === 'denied') {
      alert('Browser notifications are blocked in your browser. Please allow them in site settings.');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-xs">
      {/* Crisp Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between gap-3 sm:gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-xs">
            <span className="material-symbols-outlined text-[19px] sm:text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              gavel
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 font-headline">QuadBid</span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] sm:text-[11px] font-semibold text-slate-600">
                Kongu Campus
              </span>
            </div>
          </div>
        </div>

        {/* Desktop Search Bar (hidden on mobile) */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-3.5 text-slate-400 text-[18px] pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cycles, calculators, textbooks..."
              className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white pl-10 pr-24 py-2 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none transition-all"
            />
            <div className="absolute right-2.5">
              <span className="px-2 py-0.5 rounded-md bg-white text-[11px] text-slate-600 font-mono font-medium border border-slate-200 shadow-xs">
                Hostels 1–9
              </span>
            </div>
          </div>
        </div>

        {/* Action Shortcuts */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Desktop Shortcuts (hidden on mobile to make room for bottom nav) */}
          <div className="hidden md:flex items-center gap-2">
            {/* AI Concierge Shortcut */}
            <button
              onClick={onOpenAiConcierge}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all border border-indigo-200/80 shadow-xs cursor-pointer"
              title="Launch AI Campus Concierge"
            >
              <span className="material-symbols-outlined text-[17px] text-indigo-600">smart_toy</span>
              <span className="hidden lg:inline">AI Concierge</span>
            </button>

            {/* Watchlist Shortcut */}
            <button
              onClick={onOpenWatchlist}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-all border border-slate-200 cursor-pointer"
              title="Watchlist & Saved Alerts"
            >
              <span className="material-symbols-outlined text-[17px] text-slate-600">bookmark</span>
              <span className="hidden lg:inline">Watchlist</span>
              {watchlistCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-slate-900 text-white text-[10px] font-mono font-bold">
                  {watchlistCount}
                </span>
              )}
            </button>

            {/* Seller / Escrow Handover Hub */}
            <button
              onClick={onOpenSellerHub}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-all border border-slate-200 cursor-pointer"
              title="Seller Approvals & QR Handover Codes"
            >
              <span className="material-symbols-outlined text-[17px] text-slate-600">handshake</span>
              <span className="hidden lg:inline">Handover Hub</span>
            </button>

            {/* List Item Button */}
            <button
              onClick={onOpenCreate}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]">add_circle</span>
              <span>List Item</span>
            </button>
          </div>

          {/* Browser Notifications Toggle */}
          <button
            onClick={handleToggleNotifications}
            className={`relative p-2 rounded-xl transition-colors cursor-pointer border ${
              notifStatus === 'granted'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
            }`}
            title={
              notifStatus === 'granted'
                ? 'Browser notifications enabled'
                : 'Enable browser notifications for live outbid and extension alerts'
            }
          >
            <span className="material-symbols-outlined text-[18px] sm:text-[19px]">
              {notifStatus === 'granted' ? 'notifications_active' : 'notifications'}
            </span>
            <span
              className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                notifStatus === 'granted' ? 'bg-emerald-500' : 'bg-indigo-600'
              } live-indicator`}
            />
          </button>

          {/* Auth / Profile cluster */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2 pl-1.5 sm:pl-2 border-l border-slate-200">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs ring-2 ring-slate-200">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 bg-emerald-600 text-white rounded-full p-0.5 ring-2 ring-white">
                  <span className="material-symbols-outlined text-[9px] block" style={{ fontVariationSettings: "'FILL' 1" }}>
                    verified
                  </span>
                </span>
              </div>

              <div className="hidden xl:flex flex-col text-left text-xs">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-slate-900 truncate max-w-[100px]">{user.name}</span>
                  <span className="px-1.5 py-0.2 rounded bg-slate-100 text-[10px] text-slate-600 font-mono font-medium border border-slate-200">
                    {user.roll_number || 'Campus'}
                  </span>
                </div>
                <span className="text-emerald-700 font-medium text-[10px]">Verified Student</span>
              </div>

              <button
                onClick={logout}
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-3 sm:px-3.5 py-2 rounded-xl active:scale-95 transition-all flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">login</span>
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Search Input Row (< md screens) */}
      <div className="md:hidden px-4 pb-2.5 pt-1 border-t border-slate-100 bg-slate-50/60">
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[18px] pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search 130+ campus cycles, calcs, books..."
            className="w-full bg-white focus:bg-white pl-9 pr-20 py-2 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none transition-all shadow-2xs"
          />
          <div className="absolute right-2">
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600 font-mono border border-slate-200">
              Hostels
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
