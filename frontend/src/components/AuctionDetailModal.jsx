import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  Gavel,
  ShieldCheck,
  User,
  Flame,
  AlertCircle,
  CheckCircle2,
  Layers,
  Handshake,
  Check,
  MapPin,
  FileText,
  XCircle,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatRupees, getTimeRemaining } from '../utils/formatters';

export default function AuctionDetailModal({ listingId, onClose, onBidPlaced }) {
  const { user, isAuthenticated } = useAuth();
  const [listing, setListing] = useState(null);
  const [leader, setLeader] = useState(null);
  const [bids, setBids] = useState([]);
  const [outcome, setOutcome] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [timer, setTimer] = useState(null);

  // Handover state
  const [handoverLocation, setHandoverLocation] = useState('Hostel Quad / Common Room');
  const [sellerNotes, setSellerNotes] = useState('');
  const [inputCode, setInputCode] = useState('');

  // Fetch full details, leader, bids, and sale outcome
  const loadData = async () => {
    try {
      const [listingData, leaderData, bidsData, outcomeData] = await Promise.all([
        api.getListing(listingId),
        api.getAuctionLeader(listingId),
        api.getBidHistory(listingId),
        api.getSaleOutcome(listingId).catch(() => null),
      ]);
      setListing(listingData);
      setLeader(leaderData);
      setBids(bidsData);
      setOutcome(outcomeData);
      setTimer(getTimeRemaining(listingData.closes_at));

      if (!bidAmount && leaderData?.min_next_bid) {
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
    const pollInterval = setInterval(loadData, 2500);
    return () => clearInterval(pollInterval);
  }, [listingId]);

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
      await loadData();
      if (onBidPlaced) onBidPlaced();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveSale = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.approveSale(listingId, {
        handover_location: handoverLocation,
        seller_notes: sellerNotes,
      });
      setOutcome(res);
      setSuccessMsg(`Winning price of ₹${res.final_price} approved! Verification code: ${res.handover_code}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectSale = async () => {
    if (!window.confirm('Are you sure you want to reject this winning bid? This will conclude the auction.')) {
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.rejectSale(listingId, { reason: 'Price rejected by seller' });
      setOutcome(res);
      setSuccessMsg('Sale rejected. The item remains unsold.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmHandover = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.confirmHandover(listingId, inputCode);
      setOutcome(res);
      setSuccessMsg('🎉 Campus Handover Verified! Transaction successfully completed.');
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
  const isWinner = user && (outcome?.winner_id === user.id || leader?.leading_bidder_id === user.id);
  const isClosed = timer?.isClosed || listing.status === 'closed';

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
            {outcome?.status && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  outcome.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : outcome.status === 'approved'
                    ? 'bg-indigo-100 text-indigo-800'
                    : outcome.status === 'rejected'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {outcome.status.replace('_', ' ')}
              </span>
            )}
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

            {/* Right: Live Bidding / Resolution Card */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              {/* Leader Status Panel */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {isClosed ? 'Final Price' : leader?.has_bids ? 'Current Leading Bid' : 'Starting Price'}
                  </span>
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      isClosed
                        ? 'bg-slate-800 text-slate-300'
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
                    {formatRupees(outcome?.final_price || leader?.current_price)}
                  </div>
                  {leader?.has_bids ? (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-300">
                      <span>{isClosed ? 'Provisional Winner:' : 'Leading Bidder:'}</span>
                      <span className="font-bold text-amber-300">
                        {outcome?.winner_display_name || leader?.leading_bidder_display_name}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400">
                      {isClosed ? 'No bids placed. Marked unsold.' : 'No bids yet. First bid must match starting price.'}
                    </p>
                  )}
                </div>

                {!isClosed && (
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
                    <span>Minimum Next Bid:</span>
                    <span className="font-bold text-white tabular-nums">{formatRupees(leader?.min_next_bid)}</span>
                  </div>
                )}
              </div>

              {/* Feedback Alerts */}
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

              {/* ───────────────────────────────────────────────────────────── */}
              {/* SECTION: IF AUCTION IS CLOSED -> SALE LIFECYCLE & HANDOVER   */}
              {/* ───────────────────────────────────────────────────────────── */}
              {isClosed ? (
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                  {/* Status Case 1: Unsold */}
                  {outcome?.status === 'unsold' && (
                    <div className="text-center py-4 space-y-2">
                      <p className="text-sm font-bold text-slate-700">Auction Concluded (Unsold)</p>
                      <p className="text-xs text-slate-500">
                        No students placed a bid before the deadline. As seller, you can re-list this item anytime.
                      </p>
                    </div>
                  )}

                  {/* Status Case 2: Pending Approval */}
                  {outcome?.status === 'pending_approval' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-xs font-semibold">
                        <Clock className="w-4 h-4 shrink-0" />
                        <span>Awaiting Seller Decision on Final Price (₹{outcome.final_price})</span>
                      </div>

                      {isSeller ? (
                        <div className="space-y-3 pt-2">
                          <p className="text-xs text-slate-600">
                            You can review the winning bidder ({outcome.winner_display_name}) and decide whether to approve this price.
                          </p>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Pickup / Handover Location on Campus
                            </label>
                            <input
                              type="text"
                              value={handoverLocation}
                              onChange={(e) => setHandoverLocation(e.target.value)}
                              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500"
                              placeholder="e.g. Hostel 4 Quad / Main Library"
                            />
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={handleApproveSale}
                              disabled={submitting}
                              className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Check className="w-4 h-4" />
                              <span>Approve & Reserve</span>
                            </button>

                            <button
                              onClick={handleRejectSale}
                              disabled={submitting}
                              className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Reject Price</span>
                            </button>
                          </div>
                        </div>
                      ) : isWinner ? (
                        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 font-medium">
                          🎉 You are the provisional winner with your bid of ₹{outcome.final_price}! The seller is reviewing the winning price.
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 text-center py-2">
                          Auction ended. The seller is currently reviewing the winning price.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Status Case 3: Approved -> Handover in Progress */}
                  {outcome?.status === 'approved' && (
                    <div className="space-y-4">
                      {/* Campus Handshake Code Banner */}
                      <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-emerald-50 border border-emerald-200 text-center space-y-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          Campus Handshake Verification Code
                        </span>
                        <div className="text-2xl font-black font-mono tracking-widest text-indigo-950">
                          {outcome.handover_code}
                        </div>
                        <p className="text-[11px] text-slate-600">
                          Meet at: <strong className="text-slate-900">{outcome.handover_location}</strong>
                        </p>
                      </div>

                      {/* 3-Step Handover Checklist as in DESIGN.md */}
                      <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                        <span className="font-bold text-slate-700 block">Campus Handover Protocol:</span>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>1. Inspect lot in quad / common room</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>2. Exchange physical handshake code</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>3. Confirm in app to complete sale</span>
                        </div>
                      </div>

                      {/* Code verification input */}
                      {(isSeller || isWinner) && (
                        <form onSubmit={handleConfirmHandover} className="space-y-2 pt-1">
                          <label className="block text-[11px] font-bold text-slate-600">
                            Enter Handshake Code to Complete Handover:
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              required
                              placeholder="QUAD-XXXX"
                              value={inputCode}
                              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                              className="flex-1 px-3 py-2 text-xs font-mono font-bold uppercase border border-slate-300 rounded-xl focus:ring-1 focus:ring-indigo-500"
                            />
                            <button
                              type="submit"
                              disabled={submitting}
                              className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer disabled:opacity-50"
                            >
                              Confirm
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  {/* Status Case 4: Completed */}
                  {outcome?.status === 'completed' && (
                    <div className="text-center py-4 space-y-2 bg-emerald-50/80 p-4 rounded-xl border border-emerald-200">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto font-bold">
                        <Handshake className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-emerald-950">Campus Handover Completed</h4>
                      <p className="text-xs text-emerald-800">
                        Item successfully handed over between {outcome.seller_display_name} and {outcome.winner_display_name}.
                      </p>
                    </div>
                  )}

                  {/* Status Case 5: Rejected */}
                  {outcome?.status === 'rejected' && (
                    <div className="text-center py-4 space-y-1 bg-rose-50 p-4 rounded-xl border border-rose-200">
                      <h4 className="text-sm font-bold text-rose-950">Winning Price Rejected</h4>
                      <p className="text-xs text-rose-800">
                        The seller declined the provisional bid. The item has been marked unsold.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* ───────────────────────────────────────────────────────────── */
                /* SECTION: AUCTION STILL ACTIVE -> REGULAR BIDDING FORM        */
                /* ───────────────────────────────────────────────────────────── */
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Gavel className="w-4 h-4 text-indigo-600" />
                    <span>Place Your Bid</span>
                  </h3>

                  {isSeller ? (
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
              )}
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
                            {isClosed ? 'Winner' : 'Leader'}
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
