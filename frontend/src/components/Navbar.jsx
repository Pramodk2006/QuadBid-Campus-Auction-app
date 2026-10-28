import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { requestNotificationPermission, getNotificationPermission, sendBrowserNotification } from '../utils/notifications';

export default function Navbar({ onOpenCreate, onOpenAuth, searchQuery, setSearchQuery, activeTab = 'live', setActiveTab }) {
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
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200 shadow-sm">
      {/* Top Header Row */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-20 flex items-center justify-between gap-6">
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-sm">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              gavel
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-slate-900 font-headline">QuadBid</span>
              <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-600">
                Kongu Campus Relay
              </span>
            </div>
          </div>
        </div>

        {/* Frosted Light Search Bar */}
        <div className="flex-1 max-w-lg hidden md:block">
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-4 text-slate-400 text-[19px] pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cycles, calculators, textbooks..."
              className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white pl-11 pr-24 py-2.5 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none transition-all"
            />
            <div className="absolute right-3">
              <span className="px-2 py-0.5 rounded-md bg-white text-[11px] text-slate-600 font-mono font-medium border border-slate-200 shadow-xs">
                Hostel 1–9
              </span>
            </div>
          </div>
        </div>

        {/* Actions & Profile */}
        <div className="flex items-center gap-3.5 shrink-0">
          <button
            onClick={handleToggleNotifications}
            className={`relative p-2.5 rounded-xl transition-colors cursor-pointer ${
              notifStatus === 'granted'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
            title={
              notifStatus === 'granted'
                ? 'Browser notifications enabled (Click to test)'
                : 'Enable browser notifications for live outbid and extension alerts'
            }
          >
            <span className="material-symbols-outlined text-[20px]">
              {notifStatus === 'granted' ? 'notifications_active' : 'notifications'}
            </span>
            <span
              className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                notifStatus === 'granted' ? 'bg-emerald-500' : 'bg-indigo-600'
              } live-indicator`}
            ></span>
          </button>

          <button
            onClick={onOpenCreate}
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-900 text-sm font-semibold transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-slate-700">add</span>
            <span>List Item</span>
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm ring-2 ring-slate-200">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 bg-emerald-600 text-white rounded-full p-0.5 ring-2 ring-white">
                  <span className="material-symbols-outlined text-[10px] block" style={{ fontVariationSettings: "'FILL' 1" }}>
                    verified
                  </span>
                </span>
              </div>

              <div className="hidden xl:flex flex-col text-left text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900">{user.name}</span>
                  <span className="px-1.5 py-0.2 rounded bg-slate-100 text-[10px] text-slate-600 font-mono font-medium border border-slate-200">
                    {user.roll_number || 'Campus'}
                  </span>
                </div>
                <span className="text-emerald-700 font-medium text-[11px]">Verified Student</span>
              </div>

              <button
                onClick={logout}
                className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2.5 rounded-xl active:scale-95 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">login</span>
              <span>Student Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Minimal Sub-Navigation Links */}
      <div className="border-t border-slate-200 bg-slate-50/80">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between overflow-x-auto no-scrollbar py-2 text-sm">
          <div className="flex items-center gap-8">
            <a
              href="#live"
              onClick={(e) => { e.preventDefault(); setActiveTab && setActiveTab('live'); }}
              className={`font-semibold flex items-center gap-2 py-1 border-b-2 -mb-[9px] transition-colors ${
                (!activeTab || activeTab === 'live')
                  ? 'text-slate-900 border-slate-900'
                  : 'text-slate-600 hover:text-slate-900 border-transparent'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 live-indicator"></span>
              Live Auctions
            </a>
            <a
              href="#watchlist"
              onClick={(e) => { e.preventDefault(); setActiveTab && setActiveTab('watchlist'); }}
              className={`font-medium py-1 transition-colors ${
                activeTab === 'watchlist' ? 'text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Watchlist & Alerts
            </a>
            <a
              href="#concierge"
              onClick={(e) => { e.preventDefault(); setActiveTab && setActiveTab('concierge'); }}
              className="text-slate-600 hover:text-slate-900 font-medium py-1 transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px] text-indigo-600">smart_toy</span>
              AI Concierge
            </a>
            <a
              href="#seller"
              onClick={(e) => { e.preventDefault(); setActiveTab && setActiveTab('seller'); }}
              className="text-slate-600 hover:text-slate-900 font-medium py-1 transition-colors"
            >
              Seller Hub
            </a>
            <a
              href="#escrow"
              onClick={(e) => { e.preventDefault(); setActiveTab && setActiveTab('escrow'); }}
              className="text-slate-600 hover:text-slate-900 font-medium py-1 transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px] text-slate-600">handshake</span>
              Escrow Protection
            </a>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500">
            <span className="material-symbols-outlined text-[15px] text-emerald-600">shield</span>
            <span>Funds held until physical QR handshake</span>
          </div>
        </div>
      </div>
    </header>
  );
}
