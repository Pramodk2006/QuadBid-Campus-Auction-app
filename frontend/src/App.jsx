import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import FilterBar from './components/FilterBar';
import ListingCard from './components/ListingCard';
import AuctionDetailModal from './components/AuctionDetailModal';
import CreateListingModal from './components/CreateListingModal';
import AuthModal from './components/AuthModal';
import { api } from './api/client';
import { useAuth } from './context/AuthContext';
import { Sparkles, Plus, Clock, ShieldCheck, RefreshCw, AlertCircle } from 'lucide-react';

export default function App() {
  const { user, isAuthenticated } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [condition, setCondition] = useState('all');
  const [closingSoon, setClosingSoon] = useState(false);

  // Modals
  const [selectedListingId, setSelectedListingId] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const fetchListings = async () => {
    try {
      setError(null);
      const data = await api.getListings({
        keyword: searchQuery.trim() || undefined,
        category: category !== 'all' ? category : undefined,
        condition: condition !== 'all' ? condition : undefined,
        closing_soon: closingSoon,
      });
      setListings(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch on filter change
  useEffect(() => {
    fetchListings();
  }, [searchQuery, category, condition, closingSoon]);

  // Periodic polling every 5s for live auction updates across the grid
  useEffect(() => {
    const interval = setInterval(fetchListings, 5000);
    return () => clearInterval(interval);
  }, [searchQuery, category, condition, closingSoon]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      {/* Navigation */}
      <Navbar
        onOpenCreate={() => {
          if (!isAuthenticated) setIsAuthOpen(true);
          else setIsCreateOpen(true);
        }}
        onOpenAuth={() => setIsAuthOpen(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 text-white p-6 sm:p-10 shadow-xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse-dot" />
              <span>Final Exam Move-Out Week • Campus Relay</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight font-headline">
              Fair bidding. Real-time anti-sniping. Direct campus handovers.
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Outgoing seniors leave behind cycles, calculators, and books. Juniors compete fairly with transparent bids, verified roll numbers, and dynamic 60s extensions.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  if (!isAuthenticated) setIsAuthOpen(true);
                  else setIsCreateOpen(true);
                }}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>List Your Item</span>
              </button>

              {!isAuthenticated && (
                <button
                  onClick={() => setIsAuthOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Verify Student ID (@kongu.edu)</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Filters */}
        <FilterBar
          category={category}
          setCategory={setCategory}
          condition={condition}
          setCondition={setCondition}
          closingSoon={closingSoon}
          setClosingSoon={setClosingSoon}
        />

        {/* Listings Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 font-headline">Active Lots</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-xs font-bold font-mono">
                {listings.length}
              </span>
            </div>

            <button
              onClick={fetchListings}
              className="text-xs font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 p-1 rounded-lg transition-colors cursor-pointer"
              title="Refresh lots"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>Failed to fetch listings: {error}</span>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 animate-pulse">
                  <div className="aspect-[4/3] bg-slate-100 rounded-xl" />
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-4 bg-slate-100 rounded w-1/2" />
                  <div className="h-8 bg-slate-200 rounded mt-4" />
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">No active lots match your filters</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try switching category or condition, or be the first senior to list an item in this category.
              </p>
              <button
                onClick={() => {
                  setCategory('all');
                  setCondition('all');
                  setClosingSoon(false);
                  setSearchQuery('');
                }}
                className="mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {listings.map((item) => (
                <ListingCard
                  key={item.id}
                  listing={item}
                  onSelect={(lst) => setSelectedListingId(lst.id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 font-headline">QuadBid</span>
            <span>• Kongu Engineering College Campus Handover Network</span>
          </div>
          <p>© 2026 QuadBid. Built for fair campus auctions.</p>
        </div>
      </footer>

      {/* Modals */}
      {selectedListingId && (
        <AuctionDetailModal
          listingId={selectedListingId}
          onClose={() => setSelectedListingId(null)}
          onBidPlaced={fetchListings}
        />
      )}

      {isCreateOpen && (
        <CreateListingModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={fetchListings}
        />
      )}

      {isAuthOpen && <AuthModal onClose={() => setIsAuthOpen(false)} />}
    </div>
  );
}
