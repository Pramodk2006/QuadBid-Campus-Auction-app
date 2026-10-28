import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import FilterBar from './components/FilterBar';
import ListingCard from './components/ListingCard';
import LiveBidStream from './components/LiveBidStream';
import AuctionDetailModal from './components/AuctionDetailModal';
import CreateListingModal from './components/CreateListingModal';
import AuthModal from './components/AuthModal';
import { api } from './api/client';
import { useAuth } from './context/AuthContext';
import { Plus, ShieldCheck, Sparkles, RefreshCw, AlertCircle, Shield } from 'lucide-react';

export default function App() {
  const { user, isAuthenticated } = useAuth();
  const [listings, setListings] = useState([]);
  const [recentBids, setRecentBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [condition, setCondition] = useState('all');
  const [closingSoon, setClosingSoon] = useState(false);
  const [under500, setUnder500] = useState(false);

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
        max_price: under500 ? 500 : undefined,
      });
      setListings(data);

      // Collect all recent bids across available listings for the live campus stream ticker
      const allBidsPromises = data.slice(0, 5).map((l) => api.getBidHistory(l.id).catch(() => []));
      const results = await Promise.all(allBidsPromises);
      const flattened = results.flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setRecentBids(flattened);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, [searchQuery, category, condition, closingSoon, under500]);

  // Periodic real-time refresh every 5s
  useEffect(() => {
    const interval = setInterval(fetchListings, 5000);
    return () => clearInterval(interval);
  }, [searchQuery, category, condition, closingSoon, under500]);

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-[#e0e8f0] flex flex-col font-sans selection:bg-[#7dd3fc] selection:text-[#001f2e]">
      {/* Frosted Glacier Top Nav */}
      <Navbar
        onOpenCreate={() => {
          if (!isAuthenticated) setIsAuthOpen(true);
          else setIsCreateOpen(true);
        }}
        onOpenAuth={() => setIsAuthOpen(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-10">
        {/* REFINED GLACIER HERO (from stitch_campus_auction_marketplace_ui/code.html) */}
        <section className="relative overflow-hidden rounded-2xl bg-[#141c2e] border border-[#2a3a48]/60 p-8 sm:p-12 lg:p-14">
          {/* Subtle Glacier glow effects */}
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#7dd3fc]/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-[#1a3a4e]/40 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1a2438]/80 border border-[#2a3a48] text-[#7dd3fc] text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7dd3fc] live-indicator" />
              <span>Senior Departure Week • Direct Campus Handover Relay</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight font-headline">
              Fair bidding, anti-sniping protection, and zero waste campus handovers.
            </h1>

            <p className="text-base sm:text-lg text-[#a0b4c4] font-normal leading-relaxed max-w-2xl">
              Outgoing seniors pass lab gear, cycles, and course books directly to incoming juniors. Every bid placed within the final 30 seconds automatically extends the auction.
            </p>

            <div className="pt-3 flex flex-wrap items-center gap-4">
              <button
                onClick={() => {
                  if (!isAuthenticated) setIsAuthOpen(true);
                  else setIsCreateOpen(true);
                }}
                className="px-6 py-3 rounded-xl bg-[#7dd3fc] hover:bg-[#c8eaff] text-[#001f2e] font-semibold text-sm flex items-center gap-2 shadow-lg shadow-[#7dd3fc]/10 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>List Item to Handover</span>
              </button>

              {!isAuthenticated && (
                <button
                  onClick={() => setIsAuthOpen(true)}
                  className="px-5 py-3 rounded-xl bg-[#1a2438] hover:bg-[#202c42] border border-[#2a3a48] text-[#e0e8f0] font-medium text-sm flex items-center gap-2 transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-[#7dd3fc]" />
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
          under500={under500}
          setUnder500={setUnder500}
        />

        {error && (
          <div className="p-4 rounded-xl bg-[#3d1414]/80 border border-[#ff6b6b]/40 text-[#ff6b6b] text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>Failed to fetch lots: {error}</span>
          </div>
        )}

        {/* MAIN GRID: FEED + REFINED SIDEBAR (Col 8 + Col 4 as in code.html) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* AUCTION LOT FEED (Col 1-8) */}
          <section className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#7dd3fc] live-indicator" />
                <h2 className="text-base font-bold text-white font-headline">Live Campus Lots</h2>
                <span className="px-2 py-0.5 rounded-full bg-[#1a2438] text-[#7dd3fc] text-xs font-mono font-semibold">
                  {listings.length}
                </span>
              </div>

              <button
                onClick={fetchListings}
                className="text-xs font-medium text-[#a0b4c4] hover:text-[#7dd3fc] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync</span>
              </button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-[#141c2e] border border-[#2a3a48] rounded-2xl p-4 space-y-4 animate-pulse">
                    <div className="aspect-[16/10] bg-[#111828] rounded-xl" />
                    <div className="h-4 bg-[#1a2438] rounded w-3/4" />
                    <div className="h-8 bg-[#1a2438] rounded mt-4" />
                  </div>
                ))}
              </div>
            ) : listings.length === 0 ? (
              <div className="p-12 text-center bg-[#141c2e] rounded-2xl border border-dashed border-[#2a3a48] space-y-3">
                <Sparkles className="w-8 h-8 text-[#7dd3fc] mx-auto" />
                <h3 className="font-bold text-white text-base">No active lots found</h3>
                <p className="text-xs text-[#a0b4c4] max-w-sm mx-auto">
                  Try clearing the category filter or be the first senior to list an item in this category.
                </p>
                <button
                  onClick={() => {
                    setCategory('all');
                    setCondition('all');
                    setClosingSoon(false);
                    setUnder500(false);
                    setSearchQuery('');
                  }}
                  className="mt-2 px-4 py-2 bg-[#1a2438] hover:bg-[#202c42] rounded-xl text-xs font-bold text-[#7dd3fc] transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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

          {/* SIDEBAR PANEL (Col 9-12) */}
          <div className="lg:col-span-4">
            <LiveBidStream
              recentBids={recentBids}
              onSelectLot={(id) => setSelectedListingId(id)}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-[#2a3a48]/50 bg-[#0f1524]/80 py-8 text-xs text-[#a0b4c4]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white font-headline">QuadBid</span>
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
