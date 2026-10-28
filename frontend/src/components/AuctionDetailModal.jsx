import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  Gavel,
  ShieldCheck,
  User,
  Flame,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatRupees, getTimeRemaining } from '../utils/formatters';

export default function AuctionDetailModal({ listingId, onClose, onBidPlaced }) {
  const { user, isAuthenticated } = useAuth();
  const [listing, setListing] = useState(null);
  const [leader, setLeader] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [timer, setTimer] = useState(null);

  // Fetch full details, leader, and bids
  const loadData = async () => {
    try {
      const [listingData, leaderData, bidsData] = await Promise.all([
        api.getListing(listingId),
        api.getAuctionLeader(listingId),
        api.getBidHistory(listingId),
      ]);
      setListing(listingData);
      setLeader(leaderData);
      setBids(bidsData);
      setTimer(getTimeRemaining(listingData.closes_at));

      // Auto-populate minimum acceptable bid if input is empty
      if (!bidAmount) {
        setBidAmount(leaderData.min_next_bid.toString());
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Real-time polling every 2.5s for live auction updates
    const pollInterval = setInterval(loadData, 2500);
    return () => clearInterval(pollInterval);
  }, [listingId]);

  // Clock countdown interval every 1s
  useEffect(() => {
    if (!listing?.closes_at) return;
    const clockInterval = setInterval(() => {
      setTimer(getTimeRemaining(listing.closes_at));
    }, 1000);
    return () => clearInterval(clockInterval);
  }, [listing?.closes_at]);

  const handlePlaceBid = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const amountNum = parseFloat(bidAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid bid amount');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.placeBid(listingId, amountNum);
      setSuccessMsg(result.message);
      // Immediately refresh data
      await loadData();
      if (onBidPlaced) onBidPlaced();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickAdd = (increment) => {
    const base = leader?.min_next_bid || listing?.starting_price || 0;
    const current = parseFloat(bidAmount) || base;
    setBidAmount((current + increment).toString());
  };

  if (loading && !listing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Loading auction details...</p>
        </div>
      </div>
    );
  }

  if (!listing) return null;

  const isSeller = user && user.id === listing.seller_id;
  const isLeader = user && leader?.leading_bidder_id === user.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="relative bg-white w-full max-w-4xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold uppercase tracking-wider">
              Lot #{listing.id} • {listing.category}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-200/80 text-slate-700 text-xs font-semibold capitalize">
              {listing.condition?.replace('_', ' ')}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          {/* Main Hero Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Photos & Description */}
            <div className="lg:col-span-7 space-y-4">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 relative">
                <img
                  src={
                    listing.photos?.[0] ||
                    'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=800&q=80'
                  }
                  alt={listing.title}
                  className="w-full h-full object-cover"
                />

                {/* Anti-Sniping Alert Banner */}
                {timer?.isUrgent && !timer?.isClosed && (
                  <div className="absolute top-4 left-4 right-4 bg-rose-600 text-white p-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg animate-pulse">
                    <Flame className="w-4 h-4" />
                    <span>FINAL SECONDS: Any bid placed extends closing by +60 seconds!</span>
                  </div>
                )}
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-headline">{listing.title}</h1>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-100">
                  {listing.description}
                </p>
              </div>

              {/* Seller Information Card */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">Seller (Outgoing Senior)</span>
                    <span className="font-bold text-slate-800 text-sm">{listing.seller_display_name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verified Student</span>
                </div>
              </div>
            </div>

            {/* Right: Live Bidding & Leader Card */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              {/* Leader Status Panel */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {leader?.has_bids ? 'Current Leading Bid' : 'Starting Price'}
                  </span>
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      timer?.isClosed
                        ? 'bg-slate-800 text-slate-400'
                        : timer?.isUrgent
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span className="tabular-nums font-mono">{timer?.formatted}</span>
                  </div>
                </div>

                {/* Big Price Ticker */}
                <div>
                  <div className="text-3xl sm:text-4xl font-extrabold font-headline tabular-nums tracking-tight">
                    {formatRupees(leader?.current_price)}
                  </div>
                  {leader?.has_bids ? (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-300">
                      <span>Leading Bidder:</span>
                      <span className="font-bold text-amber-300">{leader?.leading_bidder_display_name}</span>
                      {isLeader && (
                        <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                          You are leading!
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400">No bids yet. First bid must match starting price.</p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
                  <span>Minimum Next Bid:</span>
                  <span className="font-bold text-white tabular-nums">{formatRupees(leader?.min_next_bid)}</span>
                </div>
              </div>

              {/* Bidding Form */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Gavel className="w-4 h-4 text-indigo-600" />
                  <span>Place Your Bid</span>
                </h3>

                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {timer?.isClosed ? (
                  <div className="p-4 rounded-xl bg-slate-200 text-slate-700 text-center text-sm font-bold">
                    This auction has closed.
                  </div>
                ) : isSeller ? (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs text-center font-medium">
                    You are the seller of this item. Sellers are not permitted to bid on their own lots.
                  </div>
                ) : !isAuthenticated ? (
                  <div className="text-center p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                    <p className="text-xs text-slate-600">You must be signed in with your college ID to place a bid.</p>
                  </div>
                ) : (
                  <form onSubmit={handlePlaceBid} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Bid Amount (₹) — minimum {formatRupees(leader?.min_next_bid)}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold">₹</span>
                        <input
                          type="number"
                          step="any"
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                          placeholder={leader?.min_next_bid?.toString()}
                          className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold tabular-nums text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          disabled={submitting}
                        />
                      </div>
                    </div>

                    {/* Quick increment buttons */}
                    <div className="flex items-center gap-1.5">
                      {[20, 50, 100, 200].map((inc) => (
                        <button
                          key={inc}
                          type="button"
                          onClick={() => handleQuickAdd(inc)}
                          className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                        >
                          +{inc}
                        </button>
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {submitting ? (
                        <span>Validating on server...</span>
                      ) : (
                        <>
                          <Gavel className="w-4 h-4" />
                          <span>Submit Bid of {formatRupees(parseFloat(bidAmount) || leader?.min_next_bid)}</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* Full Public Bid History */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Public Bid History ({bids.length} total)</span>
              </h3>
              <span className="text-[11px] text-slate-500">Every bid is recorded with verified Roll Number</span>
            </div>

            {bids.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No bids recorded yet. Be the first student to place a bid!
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto border border-slate-200 rounded-xl">
                {bids.map((b, idx) => (
                  <div
                    key={b.id}
                    className={`flex items-center justify-between p-3 text-xs transition-colors ${
                      idx === 0 ? 'bg-amber-50/60 font-semibold' : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-slate-400 text-[10px] font-mono">#{idx + 1}</span>
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{b.bidder_display_name}</span>
                        {idx === 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold text-[10px]">
                            Leader
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-slate-400 text-[11px] font-mono">
                        {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className="text-sm font-bold text-slate-900 tabular-nums">
                        {formatRupees(b.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
