import React from 'react';
import { Gavel, Search, Plus, ShieldCheck, LogOut, User, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onOpenCreate, onOpenAuth, searchQuery, setSearchQuery }) {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-[#0F172A]/90 backdrop-blur-md border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold shadow-inner">
            <Gavel className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-white font-headline">QuadBid</span>
              <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-semibold text-amber-400">
                Kongu • Campus Relay
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Senior to Junior Fair Handover</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cycles, fx-991, textbooks..."
              className="w-full bg-slate-900/80 hover:bg-slate-900 pl-10 pr-4 py-2.5 rounded-xl text-sm text-slate-200 placeholder:text-slate-500 border border-slate-700/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* Actions & Profile */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <button
                onClick={onOpenCreate}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">List Item</span>
              </button>

              {/* Student Verified Profile Pill */}
              <div className="flex items-center gap-3 pl-2 sm:border-l sm:border-slate-800">
                <div className="flex items-center gap-2.5 bg-slate-900/90 border border-slate-700/70 py-1.5 px-3 rounded-full">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs ring-1 ring-emerald-500/30">
                    {user.name.charAt(0)}
                  </div>
                  <div className="flex flex-col text-left text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-200 max-w-[120px] truncate">{user.name}</span>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" title="Verified Campus Student" />
                    </div>
                    <span className="text-[10px] font-mono text-amber-400 font-medium">
                      {user.roll_number || 'No Roll No'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={logout}
                  className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-sm font-semibold transition-all cursor-pointer"
            >
              <User className="w-4 h-4 text-indigo-400" />
              <span>Student Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
