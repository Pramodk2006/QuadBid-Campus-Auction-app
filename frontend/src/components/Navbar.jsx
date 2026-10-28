import React from 'react';
import { Gavel, Search, Plus, ShieldCheck, LogOut, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onOpenCreate, onOpenAuth, searchQuery, setSearchQuery }) {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-[#0f1524]/85 backdrop-blur-xl border-b border-[#2a3a48]/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-[#7dd3fc]/10 border border-[#7dd3fc]/25 text-[#7dd3fc] flex items-center justify-center font-bold shadow-inner">
            <Gavel className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-white font-headline">QuadBid</span>
              <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-[#1a2438] border border-[#2a3a48] text-[11px] font-medium text-[#88b4cc]">
                Kongu • Campus Relay
              </span>
            </div>
          </div>
        </div>

        {/* Frosted Search Bar */}
        <div className="flex-1 max-w-lg hidden md:block">
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-4 h-4 text-[#a0b4c4] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cycles, calculators, textbooks..."
              className="w-full bg-[#111828]/80 hover:bg-[#111828] pl-11 pr-24 py-2.5 rounded-xl text-sm text-[#e0e8f0] placeholder:text-[#4a6070] border border-[#2a3a48]/60 focus:border-[#7dd3fc] focus:ring-1 focus:ring-[#7dd3fc] focus:outline-none transition-all"
            />
            <div className="absolute right-3">
              <span className="px-2 py-0.5 rounded-md bg-[#1a2438] text-[11px] text-[#a0b4c4] font-mono font-medium border border-[#2a3a48]/40">
                Hostels 1–9
              </span>
            </div>
          </div>
        </div>

        {/* Actions & Profile */}
        <div className="flex items-center gap-3 shrink-0">
          {isAuthenticated ? (
            <>
              <button
                onClick={onOpenCreate}
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a2438] hover:bg-[#202c42] border border-[#2a3a48] text-[#e0e8f0] text-sm font-medium transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#7dd3fc]" />
                <span>List Item</span>
              </button>

              {/* Verified Student Badge */}
              <div className="flex items-center gap-3 pl-2 border-l border-[#2a3a48]/60">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-[#7dd3fc]/20 text-[#7dd3fc] ring-2 ring-[#7dd3fc]/30 flex items-center justify-center font-bold text-sm">
                    {user.name.charAt(0)}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 bg-[#7dd3fc] text-[#001f2e] rounded-full p-0.5 ring-2 ring-[#0a0e1a]">
                    <ShieldCheck className="w-2.5 h-2.5" />
                  </span>
                </div>

                <div className="hidden xl:flex flex-col text-left text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-white">{user.name}</span>
                    <span className="px-1.5 py-0.2 rounded bg-[#1a2438] text-[10px] text-[#a0b4c4] font-mono">
                      {user.roll_number}
                    </span>
                  </div>
                  <span className="text-[#88b4cc] text-[11px]">Verified Student</span>
                </div>

                <button
                  onClick={logout}
                  className="p-2 text-[#a0b4c4] hover:text-[#ff6b6b] rounded-lg hover:bg-[#1a2438] transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7dd3fc] hover:bg-[#c8eaff] text-[#001f2e] text-sm font-semibold transition-all cursor-pointer"
            >
              <User className="w-4 h-4" />
              <span>Student Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
