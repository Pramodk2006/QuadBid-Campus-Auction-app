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
  XCircle,
  MapPin,
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
      setSuccessMsg(`Winning price approved! Verification code: ${res.handover_code}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectSale = async () => {
    if (!window.confirm('Reject this winning bid? This will mark the auction unsold.')) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.rejectSale(listingId, { reason: 'Price rejected by seller' });
      setOutcome(res);
      setSuccessMsg('Sale rejected.');
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
      setSuccessMsg('🎉 Campus Handover Verified! Transaction completed.');
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0e1a]/85 backdrop-blur-md p-4">
        <div className="bg-[#141c2e] border border-[#2a3a48] rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl">
          <div className="w-10 h-10 border-4 border-[#7dd3fc] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-[#e0e8f0]">Loading auction details...</p>
        </div>
      </div>
    );
  }

  if (!listing) return null;

  const isSeller = user && user.id === listing.seller_id;
  const isWinner = user && (outcome?.winner_id === user.id || leader?.leading_bidder_id === user.id);
  const isClosed = timer?.isClosed || listing.status === 'closed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0e1a]/90 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
      <div className="relative bg-[#0f1524] text-[#e0e8f0] w-full max-w-4xl rounded-2xl sm:rounded-3xl shadow-2xl border border-[#2a3a48] overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3a48]/70 bg-[#111828]/80">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#1a2438] border border-[#7dd3fc]/30 text-[#7dd3fc] text-xs font-bold uppercase tracking-wider">
              Lot #{listing.id} • {listing.category}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#1a2438] border border-[#2a3a48] text-[#a0b4c4] text-xs font-semibold capitalize">
              {listing.condition?.replace('_', ' ')}
            </span>
            {outcome?.status && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  outcome.status === 'completed'
                    ? 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30'
                    : outcome.status === 'approved'
                    ? 'bg-[#7dd3fc]/20 text-[#7dd3fc] border border-[#7dd3fc]/30'
                    : outcome.status === 'rejected'
                    ? 'bg-[#ff6b6b]/20 text-[#ff6b6b] border border-[#ff6b6b]/30'
                    : 'bg-[#fea619]/20 text-[#fea619] border border-[#fea619]/30'
                }`}
              >
                {outcome.status.replace('_', ' ')}
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#a0b4c4] hover:text-white hover:bg-[#1a2438] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Image & Description */}
            <div className="lg:col-span-7 space-y-4">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-[#111828] border border-[#2a3a48] relative">
                <img
                  src={
                    listing.photos?.[0] ||
                    'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=800&q=80'
                  }
                  alt={listing.title}
                  className="w-full h-full object-cover"
                />

                {timer?.isUrgent && !timer?.isClosed && (
                  <div className="absolute top-4 left-4 right-4 bg-[#ff6b6b]/90 text-white p-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg backdrop-blur-sm animate-pulse">
                    <Flame className="w-4 h-4" />
                    <span>FINAL 30 SECONDS: Any bid placed extends closing by +60s!</span>
                  </div>
                )}
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white font-headline">{listing.title}</h1>
                <p className="text-sm text-[#a0b4c4] leading-relaxed whitespace-pre-line bg-[#141c2e] p-4 rounded-xl border border-[#2a3a48]/70">
                  {listing.description}
                </p>
              </div>

              {/* Seller Information Card */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#141c2e] border border-[#2a3a48]/70 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#1a2438] text-[#7dd3fc] font-bold flex items-center justify-center border border-[#7dd3fc]/20">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] uppercase font-bold text-[#4a6070] block">Seller (Outgoing Senior)</span>
                    <span className="font-bold text-white text-sm">{listing.seller_display_name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[#7dd3fc] bg-[#7dd3fc]/10 px-2.5 py-1 rounded-full border border-[#7dd3fc]/30 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verified Student</span>
                </div>
              </div>
            </div>

            {/* Right: Bidding & Leader Card */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              {/* Leader Status Panel */}
              <div className="p-5 rounded-2xl bg-[#141c2e] border border-[#7dd3fc]/30 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#88b4cc] uppercase tracking-wider">
                    {isClosed ? 'Final Price' : leader?.has_bids ? 'Current Leading Bid' : 'Starting Price'}
                  </span>
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      isClosed
                        ? 'bg-[#1a2438] text-[#a0b4c4]'
                        : timer?.isUrgent
                        ? 'bg-[#ff6b6b] text-white animate-pulse'
                        : 'bg-[#0a0e1a] text-[#7dd3fc] border border-[#7dd3fc]/30'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span className="tabular-nums font-mono">{timer?.formatted}</span>
                  </div>
                </div>

                <div>
                  <div className="text-3xl sm:text-4xl font-bold font-mono text-white tracking-tight tabular-nums">
                    {formatRupees(outcome?.final_price || leader?.current_price)}
                  </div>
                  {leader?.has_bids ? (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-[#a0b4c4]">
                      <span>{isClosed ? 'Provisional Winner:' : 'Leading Bidder:'}</span>
                      <span className="font-bold text-[#7dd3fc]">
                        {outcome?.winner_display_name || leader?.leading_bidder_display_name}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-[#4a6070]">
                      {isClosed ? 'No bids placed. Marked unsold.' : 'No bids yet. First bid matches starting price.'}
                    </p>
                  )}
                </div>

                {!isClosed && (
                  <div className="pt-2 border-t border-[#2a3a48] flex items-center justify-between text-xs text-[#a0b4c4]">
                    <span>Minimum Next Bid:</span>
                    <span className="font-bold text-white tabular-nums font-mono">{formatRupees(leader?.min_next_bid)}</span>
                  </div>
                )}
              </div>

              {/* Feedback Alerts */}
              {error && (
                <div className="p-3 rounded-xl bg-[#3d1414]/80 border border-[#ff6b6b]/40 text-[#ff6b6b] text-xs font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-xl bg-[#14ba82]/20 border border-[#14ba82]/40 text-[#14ba82] text-xs font-medium flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Resolution or Bidding */}
              {isClosed ? (
                <div className="p-5 rounded-2xl bg-[#141c2e] border border-[#2a3a48] space-y-4">
                  {outcome?.status === 'unsold' && (
                    <div className="text-center py-4 space-y-1">
                      <p className="text-sm font-bold text-white">Auction Concluded (Unsold)</p>
                      <p className="text-xs text-[#a0b4c4]">No bids were submitted. Item can be relisted.</p>
                    </div>
                  )}

                  {outcome?.status === 'pending_approval' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-[#7dd3fc] bg-[#1a2438] p-2.5 rounded-xl border border-[#2a3a48] text-xs font-semibold">
                        <Clock className="w-4 h-4 shrink-0" />
                        <span>Awaiting Seller Decision (Final Price: ₹{outcome.final_price})</span>
                      </div>

                      {isSeller ? (
                        <div className="space-y-3 pt-1">
                          <p className="text-xs text-[#a0b4c4]">
                            Winning bidder: <strong className="text-white">{outcome.winner_display_name}</strong>
                          </p>

                          <div>
                            <label className="block text-[11px] font-bold text-[#88b4cc] mb-1">
                              Pickup / Handover Location
                            </label>
                            <input
                              type="text"
                              value={handoverLocation}
                              onChange={(e) => setHandoverLocation(e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-[#111828] border border-[#2a3a48] rounded-lg text-white focus:border-[#7dd3fc] focus:outline-none"
                              placeholder="e.g. Hostel 3 Quad"
                            />
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={handleApproveSale}
                              disabled={submitting}
                              className="flex-1 py-2.5 px-3 bg-[#7dd3fc] hover:bg-[#c8eaff] text-[#001f2e] font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Check className="w-4 h-4" />
                              <span>Approve & Reserve</span>
                            </button>

                            <button
                              onClick={handleRejectSale}
                              disabled={submitting}
                              className="py-2.5 px-3 bg-[#3d1414] hover:bg-[#521c1c] text-[#ff6b6b] border border-[#ff6b6b]/30 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Reject</span>
                            </button>
                          </div>
                        </div>
                      ) : isWinner ? (
                        <div className="p-3 bg-[#1a2438] border border-[#7dd3fc]/30 rounded-xl text-xs text-[#7dd3fc] font-medium">
                          🎉 You are the provisional winner at ₹{outcome.final_price}! Awaiting seller confirmation.
                        </div>
                      ) : (
                        <p className="text-xs text-[#a0b4c4] text-center py-2">
                          Auction ended. Awaiting seller decision.
                        </p>
                      )}
                    </div>
                  )}

                  {outcome?.status === 'approved' && (
                    <div className="space-y-4">
                      {/* Handshake Code */}
                      <div className="p-4 rounded-xl bg-[#111828] border border-[#7dd3fc]/40 text-center space-y-1">
                        <span className="text-[11px] font-bold text-[#88b4cc] uppercase tracking-wider block">
                          Campus Handshake Verification Code
                        </span>
                        <div className="text-2xl font-black font-mono tracking-widest text-[#7dd3fc]">
                          {outcome.handover_code}
                        </div>
                        <p className="text-[11px] text-[#a0b4c4]">
                          Meet at: <strong className="text-white">{outcome.handover_location}</strong>
                        </p>
                      </div>

                      {/* Code verification input */}
                      {(isSeller || isWinner) && (
                        <form onSubmit={handleConfirmHandover} className="space-y-2 pt-1">
                          <label className="block text-[11px] font-bold text-[#88b4cc]">
                            Enter Handshake Code to Complete Handover:
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              required
                              placeholder="QUAD-XXXX"
                              value={inputCode}
                              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                              className="flex-1 px-3 py-2 text-xs font-mono font-bold uppercase bg-[#111828] border border-[#2a3a48] text-white rounded-xl focus:border-[#7dd3fc] focus:outline-none"
                            />
                            <button
                              type="submit"
                              disabled={submitting}
                              className="py-2 px-4 bg-[#7dd3fc] hover:bg-[#c8eaff] text-[#001f2e] font-bold text-xs rounded-xl shadow transition-all cursor-pointer disabled:opacity-50"
                            >
                              Confirm
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  {outcome?.status === 'completed' && (
                    <div className="text-center py-4 space-y-2 bg-[#10b981]/10 p-4 rounded-xl border border-[#10b981]/30">
                      <Handshake className="w-6 h-6 text-[#10b981] mx-auto" />
                      <h4 className="text-sm font-bold text-white">Campus Handover Completed</h4>
                      <p className="text-xs text-[#a0b4c4]">
                        Lot transferred between {outcome.seller_display_name} and {outcome.winner_display_name}.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Regular Bidding Form */
                <div className="p-5 rounded-2xl bg-[#141c2e] border border-[#2a3a48] space-y-4">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <Gavel className="w-4 h-4 text-[#7dd3fc]" />
                    <span>Place Your Bid</span>
                  </h3>

                  {isSeller ? (
                    <div className="p-3 rounded-xl bg-[#1a2438] border border-[#2a3a48] text-[#88b4cc] text-xs text-center font-medium">
                      You are the seller. Sellers cannot bid on their own lot.
                    </div>
                  ) : !isAuthenticated ? (
                    <div className="text-center p-4 bg-[#111828] rounded-xl border border-[#2a3a48] space-y-1">
                      <p className="text-xs text-[#a0b4c4]">Sign in with your Kongu college ID to place a bid.</p>
                    </div>
                  ) : (
                    <form onSubmit={handlePlaceBid} className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#88b4cc] mb-1">
                          Bid Amount (₹) — minimum {formatRupees(leader?.min_next_bid)}
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-2.5 text-[#4a6070] font-bold">₹</span>
                          <input
                            type="number"
                            step="any"
                            value={bidAmount}
                            onChange={(e) => setBidAmount(e.target.value)}
                            placeholder={leader?.min_next_bid?.toString()}
                            className="w-full pl-8 pr-4 py-2.5 bg-[#111828] border border-[#2a3a48] rounded-xl text-white font-bold font-mono text-lg focus:outline-none focus:border-[#7dd3fc]"
                            disabled={submitting}
                          />
                        </div>
                      </div>

                      {/* Quick increments */}
                      <div className="flex items-center gap-1.5">
                        {[20, 50, 100, 200].map((inc) => (
                          <button
                            key={inc}
                            type="button"
                            onClick={() => handleQuickAdd(inc)}
                            className="flex-1 py-1.5 px-2 bg-[#1a2438] hover:bg-[#202c42] border border-[#2a3a48] rounded-lg text-xs font-bold text-[#7dd3fc] transition-colors cursor-pointer"
                          >
                            +{inc}
                          </button>
                        ))}
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3 px-4 bg-[#7dd3fc] hover:bg-[#c8eaff] text-[#001f2e] font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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

          {/* Bid History */}
          <div className="pt-4 border-t border-[#2a3a48] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#7dd3fc]" />
                <span>Public Bid History ({bids.length} total)</span>
              </h3>
              <span className="text-[11px] text-[#4a6070]">Verified Roll Number Recorded</span>
            </div>

            {bids.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#a0b4c4] bg-[#111828] rounded-xl border border-dashed border-[#2a3a48]">
                No bids recorded yet. Be the first student to place a bid!
              </div>
            ) : (
              <div className="divide-y divide-[#2a3a48] max-h-52 overflow-y-auto border border-[#2a3a48] rounded-xl bg-[#111828]">
                {bids.map((b, idx) => (
                  <div
                    key={b.id}
                    className={`flex items-center justify-between p-3 text-xs ${
                      idx === 0 ? 'bg-[#1a2438] font-semibold' : 'hover:bg-[#141c2e]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-[#4a6070] text-[10px] font-mono">#{idx + 1}</span>
                      <div className="flex items-center gap-1.5 font-medium text-white">
                        <User className="w-3.5 h-3.5 text-[#88b4cc]" />
                        <span>{b.bidder_display_name}</span>
                        {idx === 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-[#7dd3fc] text-[#001f2e] font-bold text-[10px]">
                            {isClosed ? 'Winner' : 'Leader'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-[#4a6070] text-[11px] font-mono">
                        {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className="text-sm font-bold text-white font-mono tabular-nums">
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
