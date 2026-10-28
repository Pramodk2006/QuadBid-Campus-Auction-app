import React, { useState, useEffect, useMemo } from 'react';
import Navbar from './components/Navbar';
import FilterBar from './components/FilterBar';
import ListingCard from './components/ListingCard';
import LiveBidStream from './components/LiveBidStream';
import AuctionDetailModal from './components/AuctionDetailModal';
import CreateListingModal from './components/CreateListingModal';
import AuthModal from './components/AuthModal';
import WatchlistModal from './components/WatchlistModal';
import AiConciergeModal from './components/AiConciergeModal';
import SellerHubModal from './components/SellerHubModal';
import { api } from './api/client';
import { useAuth } from './context/AuthContext';
import { getWebSocketUrl } from './utils/ws';
import { requestNotificationPermission, getNotificationPermission } from './utils/notifications';

export default function App() {
  const { user, isAuthenticated, loginWithToken } = useAuth();
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
  const [lotStatusFilter, setLotStatusFilter] = useState('all'); // 'all' | 'live' | 'closed'

  // Modals
  const [selectedListingId, setSelectedListingId] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [setupTokenData, setSetupTokenData] = useState(null);
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);
  const [isAiConciergeOpen, setIsAiConciergeOpen] = useState(false);
  const [isSellerHubOpen, setIsSellerHubOpen] = useState(false);
  const [watchlistCount, setWatchlistCount] = useState(0);

  // Handle OAuth callback tokens or unauthorized events
  useEffect(() => {
    const handleUnauthorized = () => {
      setIsAuthOpen(true);
    };
    window.addEventListener('quadbid_unauthorized', handleUnauthorized);

    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const setupToken = params.get('setup_token');
      const email = params.get('email');
      const name = params.get('name');
      const authError = params.get('auth_error');

      if (token) {
        loginWithToken(token).then(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
        });
      } else if (setupToken) {
        setSetupTokenData({ setup_token: setupToken, email: email || '', name: name || '' });
        setIsAuthOpen(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (authError) {
        setError(`Google Authentication: ${decodeURIComponent(authError)}`);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (e) {
      console.warn('Error reading OAuth query params:', e);
    }

    return () => {
      window.removeEventListener('quadbid_unauthorized', handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      api.getWatchlist().then((res) => setWatchlistCount(res.length)).catch(() => {});
    } else {
      setWatchlistCount(0);
    }
  }, [isAuthenticated]);

  const fetchListings = async () => {
    try {
      setError(null);
      const data = await api.getListings({
        keyword: searchQuery.trim() || undefined,
        category: category !== 'all' ? category : undefined,
        condition: condition !== 'all' ? condition : undefined,
        closing_soon: closingSoon,
        max_price: under500 ? 500 : undefined,
        status: 'all',
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

  // Periodic fallback refresh every 10s
  useEffect(() => {
    const interval = setInterval(fetchListings, 10000);
    return () => clearInterval(interval);
  }, [searchQuery, category, condition, closingSoon, under500, sortBy]);

  // Real-time Global Live WebSocket stream
  useEffect(() => {
    const wsUrl = getWebSocketUrl('/ws/live');
    let socket;
    try {
      socket = new WebSocket(wsUrl);

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'GLOBAL_BID_TICKER') {
            setRecentBids((prev) => [
              {
                id: Date.now() + Math.random(),
                listing_id: data.listing_id,
                amount: data.amount,
                bidder_name: data.bidder_name || data.bidder_display_name,
                bidder_display_name: data.bidder_display_name,
                created_at: data.created_at,
              },
              ...prev.slice(0, 15),
            ]);
            // Refresh listings for updated price on listing cards
            fetchListings();
          }
        } catch (err) {
          console.warn('WS live ticker parse error:', err);
        }
      };

      const pingInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send('ping');
        }
      }, 20000);

      return () => {
        clearInterval(pingInterval);
        socket.close();
      };
    } catch (err) {
      console.warn('Failed to connect to live WS:', err);
    }
  }, []);

  // Partition listings into Live vs Closed lots
  const now = new Date();
  const isLiveLot = (item) => {
    const isPast = new Date(item.closes_at) <= now;
    return item.status === 'active' && !isPast;
  };

  const liveListings = useMemo(() => listings.filter(isLiveLot), [listings]);
  const closedListings = useMemo(() => listings.filter((item) => !isLiveLot(item)), [listings]);

  // Split live listings into featured item (first 1) and sublots
  const featuredLiveItem = liveListings.length > 0 ? liveListings[0] : null;
  const liveSubLots = liveListings.length > 1 ? liveListings.slice(1) : [];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased flex flex-col selection:bg-indigo-600 selection:text-white">
      {/* Top Header */}
      <Navbar
        onOpenCreate={() => {
          if (!isAuthenticated) setIsAuthOpen(true);
          else setIsCreateOpen(true);
        }}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenWatchlist={() => setIsWatchlistOpen(true)}
        onOpenAiConcierge={() => setIsAiConciergeOpen(true)}
        onOpenSellerHub={() => setIsSellerHubOpen(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        watchlistCount={watchlistCount}
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
                onClick={() => setIsAiConciergeOpen(true)}
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
            {/* View Categorization Tabs */}
            <div className="flex items-center justify-between flex-wrap gap-4 pb-2">
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setLotStatusFilter('all')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    lotStatusFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">grid_view</span>
                  <span>All Lots</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-mono">
                    {listings.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setLotStatusFilter('live')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    lotStatusFilter === 'live'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 live-indicator" />
                  <span>Live Bidding</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono">
                    {liveListings.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setLotStatusFilter('closed')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    lotStatusFilter === 'closed'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] text-indigo-600">handshake</span>
                  <span>Closed & Handover</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-mono">
                    {closedListings.length}
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="material-symbols-outlined text-sm text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                <span>Hostel Quad Handover Active</span>
              </div>
            </div>

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
                <h3 className="font-bold text-slate-900 text-base">No lots match your filters</h3>
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
                    setLotStatusFilter('all');
                  }}
                  className="mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-900 transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="space-y-10">
                {/* SECTION 1: LIVE AUCTIONS */}
                {lotStatusFilter !== 'closed' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 live-indicator" />
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight font-headline">
                          Live Auctions
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold font-mono">
                          {liveListings.length} ACTIVE
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 hidden sm:inline-block">
                        Anti-sniping active • +60s extension on final-minute bids
                      </span>
                    </div>

                    {liveListings.length === 0 ? (
                      <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-2">
                        <p className="text-sm font-semibold text-slate-700">No active lots currently live in this filter</p>
                        <p className="text-xs text-slate-400">Check the Closed & Handover section or clear active filters.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {featuredLiveItem && (
                          <ListingCard
                            listing={featuredLiveItem}
                            featured={true}
                            onSelect={(lst) => setSelectedListingId(lst.id)}
                          />
                        )}

                        {liveSubLots.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {liveSubLots.map((item) => (
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
                  </div>
                )}

                {/* SECTION 2: CLOSED & ESCROW HANDOVER LOTS */}
                {lotStatusFilter !== 'live' && (
                  <div className={`space-y-6 ${lotStatusFilter === 'all' ? 'pt-8 border-t border-slate-200' : ''}`}>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                          <span className="material-symbols-outlined text-[18px] text-indigo-600">handshake</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight font-headline">
                              Closed & Handover Lots
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold font-mono">
                              {closedListings.length} RESOLVED
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            Bidding ended. Funds held in hostel escrow until physical QUAD-XXXX handshake verification.
                          </p>
                        </div>
                      </div>
                    </div>

                    {closedListings.length === 0 ? (
                      <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-2">
                        <p className="text-sm font-semibold text-slate-700">No closed lots recorded yet</p>
                        <p className="text-xs text-slate-400">Completed auctions with winning student details appear here.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {closedListings.map((item) => (
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
          onOpenAuth={() => setIsAuthOpen(true)}
        />
      )}

      {isAuthOpen && (
        <AuthModal
          onClose={() => {
            setIsAuthOpen(false);
            setSetupTokenData(null);
          }}
          setupTokenData={setupTokenData}
        />
      )}

      {isWatchlistOpen && (
        <WatchlistModal
          onClose={() => setIsWatchlistOpen(false)}
          onSelectLot={(id) => setSelectedListingId(id)}
          onWatchlistChange={(count) => setWatchlistCount(count)}
          listings={listings}
        />
      )}

      {isAiConciergeOpen && (
        <AiConciergeModal
          onClose={() => setIsAiConciergeOpen(false)}
          listings={listings}
          onSelectLot={(id) => setSelectedListingId(id)}
        />
      )}

      {isSellerHubOpen && (
        <SellerHubModal
          onClose={() => setIsSellerHubOpen(false)}
          listings={listings}
          onSelectLot={(id) => setSelectedListingId(id)}
          onOpenCreate={() => {
            if (!isAuthenticated) setIsAuthOpen(true);
            else setIsCreateOpen(true);
          }}
        />
      )}
    </div>
  );
}
