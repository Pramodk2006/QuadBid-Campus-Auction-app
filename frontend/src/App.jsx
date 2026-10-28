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
  const [sortBy, setSortBy] = useState('closing_soon');
  const [activeTab, setActiveTab] = useState('live');

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

      // Local sort if requested
      let sorted = [...data];
      if (sortBy === 'lowest_price') {
        sorted.sort((a, b) => (a.current_price || a.starting_price) - (b.current_price || b.starting_price));
      } else if (sortBy === 'most_active') {
        sorted.sort((a, b) => (b.bid_count || 0) - (a.bid_count || 0));
      } else {
        // closing soonest
        sorted.sort((a, b) => new Date(a.closes_at) - new Date(b.closes_at));
      }

      setListings(sorted);

      // Collect recent bids across available listings for the live campus stream ticker
      const allBidsPromises = sorted.slice(0, 6).map((l) => api.getBidHistory(l.id).catch(() => []));
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
  }, [searchQuery, category, condition, closingSoon, under500, sortBy]);

  // Periodic real-time refresh every 5s
  useEffect(() => {
    const interval = setInterval(fetchListings, 5000);
    return () => clearInterval(interval);
  }, [searchQuery, category, condition, closingSoon, under500, sortBy]);

  // Split listings into featured item (first 1 or 2) and sublots
  const featuredItem = listings.length > 0 ? listings[0] : null;
  const subLots = listings.length > 1 ? listings.slice(1) : [];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased flex flex-col selection:bg-indigo-600 selection:text-white">
      {/* Top Header & Sub-Nav */}
      <Navbar
        onOpenCreate={() => {
          if (!isAuthenticated) setIsAuthOpen(true);
          else setIsCreateOpen(true);
        }}
        onOpenAuth={() => setIsAuthOpen(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-8 py-10 flex flex-col gap-10">
        {/* REFINED HERO (Crisp Light Mode, Deep Typography, Generous Whitespace) */}
        <section className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm p-8 sm:p-12 lg:p-14">
          {/* Subtle ambient glow background effects */}
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-slate-100/70 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-indigo-50/50 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 live-indicator" />
              <span>Senior Departure Week • 3 Days Until Hostel Checkout</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight font-headline">
              Fair bidding, anti-sniping protection, and zero waste campus handovers.
            </h1>

            <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-2xl">
              Outgoing seniors pass lab gear, cycles, and course books directly to incoming juniors. Every bid placed within the final 60 seconds automatically extends the auction.
            </p>

            <div className="pt-3 flex flex-wrap items-center gap-4">
              <button
                onClick={() => {
                  if (!isAuthenticated) setIsAuthOpen(true);
                  else setIsCreateOpen(true);
                }}
                className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">post_add</span>
                <span>List Item to Handover</span>
              </button>

              <button
                onClick={() => {
                  alert('AI Concierge: Natural language search ("find me a cycle under ₹2000") is available in the AI tab.');
                }}
                className="px-5 py-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-semibold text-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-indigo-600">smart_toy</span>
                <span>Launch AI Assistant</span>
              </button>
            </div>
          </div>
        </section>

        {/* Category & Filter Bar */}
        <FilterBar
          category={category}
          setCategory={setCategory}
          condition={condition}
          setCondition={setCondition}
          closingSoon={closingSoon}
          setClosingSoon={setClosingSoon}
          under500={under500}
          setUnder500={setUnder500}
          sortBy={sortBy}
          setSortBy={setSortBy}
          itemsCount={listings.length}
        />

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-600 text-base">error</span>
            <span>Failed to fetch lots: {error}</span>
          </div>
        )}

        {/* MAIN GRID: AUCTION LOT FEED (8 cols) + SIDEBAR (4 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* AUCTION LOT FEED (Col 1-8) */}
          <section className="lg:col-span-8 space-y-8">
            {loading ? (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 h-64 animate-pulse" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 h-72 animate-pulse" />
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 h-72 animate-pulse" />
                </div>
              </div>
            ) : listings.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3 shadow-xs">
                <span className="material-symbols-outlined text-4xl text-slate-400 mx-auto">
                  inventory_2
                </span>
                <h3 className="font-bold text-slate-900 text-base">No active lots match your filters</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Try clearing your filters or be the first senior to list an item in this category.
                </p>
                <button
                  onClick={() => {
                    setCategory('all');
                    setCondition('all');
                    setClosingSoon(false);
                    setUnder500(false);
                    setSearchQuery('');
                  }}
                  className="mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-900 transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Featured item (horizontal card layout) */}
                {featuredItem && (
                  <ListingCard
                    listing={featuredItem}
                    featured={true}
                    onSelect={(lst) => setSelectedListingId(lst.id)}
                  />
                )}

                {/* Sublots (2-column balanced cards) */}
                {subLots.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {subLots.map((item) => (
                      <ListingCard
                        key={item.id}
                        listing={item}
                        featured={false}
                        onSelect={(lst) => setSelectedListingId(lst.id)}
                      />
                    ))}
                  </div>
                )}
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

      {/* Campus Footer */}
      <footer className="mt-20 bg-white border-t border-slate-200 py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 flex flex-col md:flex-row justify-between items-center gap-6 text-slate-500 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-md bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                gavel
              </span>
            </div>
            <span className="font-extrabold text-slate-900 text-sm tracking-tight">QuadBid</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">
              © 2026 Kongu Campus Exchange System. Secured by Student Council Escrow.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-6 font-medium">
            <a className="hover:text-indigo-600 transition-colors" href="#">
              Campus Logistics Rules
            </a>
            <a className="hover:text-indigo-600 transition-colors" href="#">
              Anti-Sniping Protocol
            </a>
            <a className="hover:text-indigo-600 transition-colors" href="#">
              Hostel Gate Escrow
            </a>
            <a className="hover:text-indigo-600 transition-colors" href="#">
              Warden Support
            </a>
          </div>
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
