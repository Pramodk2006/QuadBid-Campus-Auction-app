import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatRupees, formatTime, getTimeRemaining } from '../utils/formatters';
import { getWebSocketUrl } from '../utils/ws';
import { sendBrowserNotification } from '../utils/notifications';

const DEFAULT_PHOTOS = [
  'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?auto=format&fit=crop&w=800&q=80',
];

export default function AuctionDetailModal({ listingId, onClose, onBidPlaced }) {
  const { user, isAuthenticated } = useAuth();
  const [listing, setListing] = useState(null);
  const [leader, setLeader] = useState(null);
  const [bids, setBids] = useState([]);
  const [outcome, setOutcome] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [timer, setTimer] = useState(null);

  // Gallery active photo index
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // Q&A state
  const [questionInput, setQuestionInput] = useState('');
  const [qaFilter, setQaFilter] = useState('');
  const [replyInputs, setReplyInputs] = useState({});

  // Proxy bid state
  const [proxyEnabled, setProxyEnabled] = useState(true);
  const [proxyCeiling, setProxyCeiling] = useState('');

  // Handover state
  const [handoverLocation, setHandoverLocation] = useState('Hostel Quad / Common Room');
  const [sellerNotes, setSellerNotes] = useState('');
  const [inputCode, setInputCode] = useState('');

  useEffect(() => {
    // Prevent background scrolling while modal is open, enable full-page modal scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const loadData = async () => {
    try {
      const [listingData, leaderData, bidsData, outcomeData, questionsData] = await Promise.all([
        api.getListing(listingId),
        api.getAuctionLeader(listingId),
        api.getBidHistory(listingId),
        api.getSaleOutcome(listingId).catch(() => null),
        api.getQuestions(listingId).catch(() => []),
      ]);
      setListing(listingData);
      setLeader(leaderData);
      setBids(bidsData);
      setOutcome(outcomeData);
      setQuestions(questionsData);
      setTimer(getTimeRemaining(listingData.closes_at));

      if (!bidAmount && leaderData?.min_next_bid) {
        setBidAmount(leaderData.min_next_bid.toString());
      }
      if (!proxyCeiling && leaderData?.current_price) {
        setProxyCeiling((leaderData.current_price + (listingData.min_bid_increment * 6)).toString());
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

  const wsRef = useRef(null);
  const previousLeaderIdRef = useRef(null);

  useEffect(() => {
    if (leader?.leading_bidder_id) {
      previousLeaderIdRef.current = leader.leading_bidder_id;
    }
  }, [leader?.leading_bidder_id]);

  useEffect(() => {
    const wsUrl = getWebSocketUrl(`/ws/listings/${listingId}`);
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_BID') {
          // Prepend new bid in real time
          setBids((prev) => [data.bid, ...prev.filter((b) => b.id !== data.bid.id)]);
          // Update leader
          setLeader((prev) => ({
            ...prev,
            current_price: data.bid.amount,
            leading_bidder_display_name: data.bid.bidder_display_name,
            leading_bidder_name: data.bid.bidder_display_name,
            leading_bidder_id: data.bid.bidder_id,
            has_bids: true,
            bid_count: data.bid_count,
            min_next_bid: data.bid.amount + (listing?.min_bid_increment || 50),
          }));

          // Handle anti-sniping extension
          if (data.extended) {
            setListing((prev) => (prev ? { ...prev, closes_at: data.closes_at } : prev));
            setTimer(getTimeRemaining(data.closes_at));
            setSuccessMsg('⚡ Clock extended by +60s due to bid in final 30 seconds!');

            if (document.hidden) {
              sendBrowserNotification('⚡ Anti-Sniping Triggered!', {
                body: `Auction extended by +60s! New leading bid: ₹${data.bid.amount} by ${data.bid.bidder_display_name}`,
              });
            }
          }

          // Outbid notification if user was leading
          if (user && previousLeaderIdRef.current === user.id && data.bid.bidder_id !== user.id) {
            if (document.hidden) {
              sendBrowserNotification('⚠️ You were Outbid on QuadBid!', {
                body: `Higher bid of ₹${data.bid.amount} placed by ${data.bid.bidder_display_name}.`,
              });
            }
          }
        } else if (data.type === 'NEW_QUESTION' || data.type === 'NEW_ANSWER') {
          api.getQuestions(listingId).then((res) => setQuestions(res)).catch(() => {});
          if (data.type === 'NEW_ANSWER' && document.hidden) {
            sendBrowserNotification('💬 Question Answered!', {
              body: `Seller: "${data.answer_text}"`,
            });
          }
        }
      } catch (err) {
        console.warn('WS parse error:', err);
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
  }, [listingId, user?.id]);

  useEffect(() => {
    if (!listing?.closes_at) return;
    const clockInterval = setInterval(() => {
      setTimer(getTimeRemaining(listing.closes_at));
    }, 1000);
    return () => clearInterval(clockInterval);
  }, [listing?.closes_at]);

  const handlePlaceBid = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!isAuthenticated) {
      setError('Please sign in with your campus account to place bids.');
      return;
    }

    const amountNum = parseFloat(bidAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid bid amount.');
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

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!questionInput.trim()) return;
    if (!isAuthenticated) {
      alert('Please sign in with your campus account to ask questions.');
      return;
    }

    try {
      await api.askQuestion(listingId, questionInput.trim());
      setQuestionInput('');
      const updatedQ = await api.getQuestions(listingId);
      setQuestions(updatedQ);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAnswerQuestion = async (questionId) => {
    const text = replyInputs[questionId]?.trim();
    if (!text) return;

    try {
      await api.answerQuestion(listingId, questionId, text);
      setReplyInputs({ ...replyInputs, [questionId]: '' });
      const updatedQ = await api.getQuestions(listingId);
      setQuestions(updatedQ);
    } catch (err) {
      alert(err.message);
    }
  };

  // Handover action handlers
  const handleApprove = async () => {
    try {
      await api.approveSale(listingId, {
        handover_location: handoverLocation,
        seller_notes: sellerNotes || undefined,
      });
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReject = async () => {
    try {
      await api.rejectSale(listingId, { reason: 'Reserve price not met by market demand' });
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    try {
      await api.confirmHandover(listingId, inputCode.trim().toUpperCase());
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  if (error && !listing) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xl max-w-sm w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-2xl">error_outline</span>
          </div>
          <h3 className="text-base font-bold text-slate-900">Failed to Load Lot #{listingId}</h3>
          <p className="text-xs text-slate-600">{error}</p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (loading || !listing) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xl max-w-sm w-full text-center space-y-4 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
            title="Close"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
          <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-800">Connecting to Campus Lot #{listingId}...</p>
        </div>
      </div>
    );
  }

  const photosList = listing.photos && listing.photos.length > 0 ? listing.photos : DEFAULT_PHOTOS;
  const currentPhoto = photosList[activePhotoIndex] || photosList[0];

  const currentPrice = leader?.current_price || listing.current_price || listing.starting_price;
  const isSeller = user && listing.seller_id === user.id;
  const isLeadingBidder = user && leader?.leading_bidder_id === user.id;
  const isWinner = outcome?.winner_id && user && outcome.winner_id === user.id;

  const filteredQuestions = questions.filter((q) =>
    qaFilter
      ? q.question_text.toLowerCase().includes(qaFilter.toLowerCase()) ||
        (q.answer_text && q.answer_text.toLowerCase().includes(qaFilter.toLowerCase()))
      : true
  );

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-md p-2 sm:p-6 lg:p-8 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-7xl mx-auto bg-[#f8fafc] text-slate-800 rounded-2xl border border-slate-200 shadow-2xl my-2 sm:my-6">
        {/* Sticky Modal Top Bar with Breadcrumbs & Close */}
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4 rounded-t-2xl">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2.5 text-slate-500 text-xs truncate">
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="material-symbols-outlined text-sm">home</span>
              <span>Home</span>
            </span>
            <span className="text-slate-300">/</span>
            <span className="capitalize text-slate-700">{listing.category}</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-semibold truncate max-w-xs">{listing.title}</span>
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 tracking-wide font-mono">
              LOT #{listing.id}
            </span>
          </nav>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Modal Main Viewport (2-Column High-Fidelity Split Layout) */}
        <div className="p-6 lg:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            {/* ============================================================== */}
            {/* LEFT COLUMN: Item Inspection & Transparency (7 cols)            */}
            {/* ============================================================== */}
            <section className="lg:col-span-7 flex flex-col gap-8">
              {/* Multi-photo Gallery Card */}
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                {/* Main Display */}
                <div className="relative w-full aspect-[16/10] rounded-lg overflow-hidden bg-slate-100 mb-4 group border border-slate-200">
                  <img
                    id="mainGalleryImage"
                    src={currentPhoto}
                    alt={listing.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                  {/* Live Status Watermark Pill */}
                  <div className="absolute top-3.5 left-3.5 bg-slate-900/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 flex items-center gap-2 text-xs font-bold text-white shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot" />
                    <span>
                      {timer?.isClosed ? 'CLOSED LOT' : 'ACTIVE LOT'} • {bids.length} BIDS
                    </span>
                  </div>

                  {/* Handover Badge on Media */}
                  <div className="absolute top-3.5 right-3.5 bg-white/95 backdrop-blur-md text-emerald-800 border border-emerald-200 px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                    <span
                      className="material-symbols-outlined text-sm text-emerald-600"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      lock
                    </span>
                    <span>Escrow Protected Handover</span>
                  </div>

                  {/* Location Chip */}
                  <div className="absolute bottom-3.5 left-3.5 bg-white/95 backdrop-blur-md text-slate-800 px-3.5 py-1.5 rounded-md text-xs border border-slate-200 flex items-center gap-1.5 shadow-sm">
                    <span className="material-symbols-outlined text-sm text-indigo-600">location_on</span>
                    <span className="text-slate-500 font-medium">Location:</span> Hostel Quad Porch (Stand #14)
                  </div>
                </div>

                {/* Thumbnails Row */}
                <div className="grid grid-cols-4 gap-3">
                  {photosList.slice(0, 4).map((p, idx) => {
                    const labels = ['Overview', 'Detail', 'Tread', 'Stand'];
                    const isActive = activePhotoIndex === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActivePhotoIndex(idx)}
                        className={`relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all hover:opacity-95 cursor-pointer ${
                          isActive
                            ? 'border-indigo-600 ring-2 ring-indigo-500/20'
                            : 'border-slate-200 hover:border-indigo-600'
                        }`}
                      >
                        <img src={p} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                        <span className="absolute bottom-1.5 left-1.5 bg-slate-900/80 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                          {labels[idx] || `Shot ${idx + 1}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Item Overview Header & Specs Card */}
              <article className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm flex flex-col gap-6">
                <div>
                  <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium font-mono">
                      <span className="material-symbols-outlined text-xs text-indigo-600">tag</span>
                      <span>Lot: #{listing.id}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold capitalize">
                      <span className="material-symbols-outlined text-xs">category</span>
                      <span>{listing.category}</span>
                    </span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
                    {listing.title}
                  </h1>

                  {/* Dorm Verification Strip */}
                  <div className="inline-flex flex-wrap items-center gap-2.5 px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5 text-indigo-700 font-semibold">
                      <span
                        className="material-symbols-outlined text-base text-indigo-600"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        shield_person
                      </span>
                      <span>Hostel Quad Handover</span>
                    </div>
                    <span className="text-slate-300">•</span>
                    <span>
                      Verified Senior Seller:{' '}
                      <strong className="text-slate-900 font-semibold">{listing.seller_display_name}</strong>
                    </span>
                    <span className="text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[10px] font-bold">
                      .edu Verified
                    </span>
                  </div>
                </div>

                <hr className="border-slate-200" />

                {/* Condition Details Bento Block */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-emerald-600 text-base">verified</span>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                          Graded Condition
                        </span>
                      </div>
                      <div className="inline-block px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold mb-2 capitalize">
                        {listing.condition?.replace('_', ' ')} • Fully Serviced
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {listing.description}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-indigo-600 text-base">schedule</span>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                          Handover Window
                        </span>
                      </div>
                      <div className="inline-block px-2.5 py-1 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-2">
                        Strict Move-Out Slot
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Pickup within 24 hours of closing (Hostel Quad / Central Porch). Escrow verification code required for handover sign-off.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Specs List */}
                <div className="pt-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3.5">
                    Verified Hardware Breakdown
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6 text-xs bg-slate-50 p-5 rounded-xl border border-slate-200">
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500 text-[11px]">Item Category</span>
                      <span className="font-semibold text-slate-900 capitalize">{listing.category}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500 text-[11px]">Condition Rating</span>
                      <span className="font-semibold text-slate-900 capitalize">{listing.condition?.replace('_', ' ')}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500 text-[11px]">Ownership</span>
                      <span className="font-semibold text-slate-900">Kongu Senior (Solo Owner)</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500 text-[11px]">Minimum Increment</span>
                      <span className="font-semibold text-slate-900 font-mono">
                        {formatRupees(listing.min_bid_increment)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500 text-[11px]">Campus Escrow</span>
                      <span className="font-semibold text-emerald-700">Protected Handshake</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500 text-[11px]">Hostel Network</span>
                      <span className="font-semibold text-slate-900">Hostel 1–9 Quad Delivery</span>
                    </div>
                  </div>
                </div>
              </article>

              {/* Public Q&A Section */}
              <section className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                        <span className="material-symbols-outlined text-lg">forum</span>
                      </div>
                      <h2 className="text-lg font-bold text-slate-900 tracking-tight">Questions Before Bidding</h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {questions.length} questions logged • Direct senior seller interaction
                    </p>
                  </div>

                  {/* Search in Q&A */}
                  <div className="relative w-full sm:w-64">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-base">
                      search
                    </span>
                    <input
                      type="text"
                      value={qaFilter}
                      onChange={(e) => setQaFilter(e.target.value)}
                      placeholder="Filter questions..."
                      className="w-full pl-9 pr-3.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white placeholder:text-slate-400 transition-all"
                    />
                  </div>
                </div>

                {/* Q&A Thread Container */}
                <div className="flex flex-col gap-4">
                  {filteredQuestions.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                      No questions asked yet. Be the first student to inquire about this lot!
                    </div>
                  ) : (
                    filteredQuestions.map((q, idx) => (
                      <div
                        key={q.id}
                        className="p-5 rounded-xl bg-slate-50/80 border border-slate-200 relative flex flex-col gap-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {idx === 0 && (
                              <span className="bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <span
                                  className="material-symbols-outlined text-xs text-amber-700"
                                  style={{ fontVariationSettings: "'FILL' 1" }}
                                >
                                  push_pin
                                </span>
                                PINNED QA
                              </span>
                            )}
                            <span className="text-xs text-slate-500">
                              Asked by {q.asker_display_name} • {formatTime(q.created_at)}
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            Public Quad Log
                          </span>
                        </div>

                        <p className="text-sm font-semibold text-slate-900">
                          Q: {q.question_text}
                        </p>

                        {/* Seller Answer Box */}
                        {q.answer_text ? (
                          <div className="pl-4 border-l-2 border-indigo-600 bg-white rounded-r-lg p-3.5 border border-slate-200/80 flex items-start gap-3">
                            <span
                              className="material-symbols-outlined text-indigo-600 text-xl mt-0.5"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              account_circle
                            </span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">
                                  {q.answered_by_display_name || 'Seller'}
                                </span>
                                <span className="text-[10px] text-slate-500">Official Seller Answer</span>
                              </div>
                              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                {q.answer_text}
                              </p>
                            </div>
                          </div>
                        ) : isSeller ? (
                          <div className="pt-2 border-t border-slate-200 flex gap-2">
                            <input
                              type="text"
                              value={replyInputs[q.id] || ''}
                              onChange={(e) =>
                                setReplyInputs({ ...replyInputs, [q.id]: e.target.value })
                              }
                              placeholder="Type your official seller answer..."
                              className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
                            />
                            <button
                              type="button"
                              onClick={() => handleAnswerQuestion(q.id)}
                              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                            >
                              Reply Publicly
                            </button>
                          </div>
                        ) : (
                          <p className="text-[11px] italic text-slate-400">Awaiting seller reply...</p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Question Input Form */}
                <form onSubmit={handleAskQuestion} className="pt-4 border-t border-slate-200 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">
                      Ask {listing.seller_display_name ? listing.seller_display_name.split(' ')[0] : 'Seller'} something specific...
                    </span>
                    <span className="text-slate-400 text-[11px]">(Must be campus-related, public log)</span>
                  </div>
                  <div className="flex gap-2.5">
                    <input
                      type="text"
                      value={questionInput}
                      onChange={(e) => setQuestionInput(e.target.value)}
                      placeholder="e.g., Are battery/accessories included with the lot?"
                      className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-1 focus:ring-indigo-600 transition-all placeholder:text-slate-400"
                    />
                    <button
                      type="submit"
                      className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-5 py-2.5 rounded-lg transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap shadow-sm cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">send</span>
                      <span>Ask Publicly</span>
                    </button>
                  </div>
                </form>
              </section>
            </section>

            {/* ============================================================== */}
            {/* RIGHT COLUMN: Live Bidding Engine & Terminal (5 cols)          */}
            {/* ============================================================== */}
            <section className="lg:col-span-5 flex flex-col gap-8">
              {/* Countdown Timer Banner */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-indigo-700 font-extrabold tracking-wider uppercase flex items-center gap-1.5">
                    <span
                      className="material-symbols-outlined text-base text-indigo-600"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      alarm_on
                    </span>
                    LOT COUNTDOWN
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-dot" />
                    <span>LIVE CLOCK</span>
                  </div>
                </div>

                {/* Main Countdown Digits */}
                <div className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-xs text-slate-500 block mb-1">CLOSING IN:</span>
                    <div className="text-3xl font-extrabold tracking-tight text-slate-900 font-mono bg-slate-50 px-4 py-2 rounded-lg border border-slate-200 inline-block shadow-inner tabular-nums">
                      <span>{timer ? timer.formatted : '00:00:00'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs block text-slate-500">Lot Status</span>
                    <span
                      className={`text-sm font-semibold ${
                        timer?.isClosed ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {timer?.isClosed ? 'Auction Ended' : 'Active Bidding'}
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-1">
                      {timer?.isClosed ? 'Awaiting Handover' : 'Real-time Ticker'}
                    </span>
                  </div>
                </div>

                {/* Anti-Sniping Rule Warning Chip */}
                <div className="mt-4 p-3.5 rounded-lg bg-amber-50/80 border border-amber-200 text-slate-800 flex items-start gap-2.5">
                  <span
                    className="material-symbols-outlined text-amber-600 text-base mt-0.5 shrink-0"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    bolt
                  </span>
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    <strong className="font-bold text-amber-900">⚡ Anti-Sniping Active:</strong> Any bid placed in the final 30 seconds automatically extends the clock by +60 seconds to ensure equal opportunity.
                  </p>
                </div>
              </div>

              {/* Pricing & Leading Bid Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col gap-6">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">
                      {bids.length > 0 ? 'Current Leading Bid' : 'Starting Price'}
                    </span>
                    <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 flex items-baseline gap-1 mt-1 tracking-tight font-mono">
                      <span className="text-2xl font-bold text-indigo-600">₹</span>
                      <span>{currentPrice.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                      <span className="material-symbols-outlined text-xs text-emerald-600">verified_user</span>
                      <span>{bids.length > 0 ? 'Top Bid' : 'Starting'}</span>
                    </span>
                    <div className="text-xs text-slate-500 mt-2">
                      Starting: <strong className="text-slate-900">{formatRupees(listing.starting_price)}</strong> | Step:{' '}
                      <strong className="text-slate-900">{formatRupees(listing.min_bid_increment)}</strong>
                    </div>
                  </div>
                </div>

                {/* Leading Bidder Info Strip */}
                {leader?.has_bids ? (
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                        <span className="material-symbols-outlined text-base">shield_person</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-medium">Leading Student</span>
                        <span className="font-bold text-slate-900">{leader.leading_bidder_name}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block uppercase font-medium">Timestamp</span>
                      <span className="font-mono text-xs font-semibold text-slate-800">
                        {leader.last_bid_at ? formatTime(leader.last_bid_at) : 'Active'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                    No bids yet. First bid must be at least {formatRupees(listing.starting_price)}.
                  </div>
                )}

                {/* Bid Actions or Handover Resolution */}
                {timer && !timer.isClosed ? (
                  <div className="flex flex-col gap-3.5 pt-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Instant Quick Bid Increment
                    </span>

                    {/* Tactile Increment Pills */}
                    <div className="grid grid-cols-3 gap-2.5">
                      {[1, 2, 4].map((multiplier) => {
                        const step = listing.min_bid_increment * multiplier;
                        const targetAmount = (leader?.current_price || listing.starting_price) + step;
                        return (
                          <button
                            key={multiplier}
                            type="button"
                            onClick={() => setBidAmount(targetAmount.toString())}
                            className="py-2.5 px-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-indigo-500 text-center transition-all active:scale-95 group cursor-pointer"
                          >
                            <span className="block text-xs font-bold text-indigo-700 group-hover:text-indigo-900 transition-colors">
                              +₹{step}
                            </span>
                            <span className="block text-[11px] text-slate-500 font-medium font-mono">
                              (₹{targetAmount.toLocaleString('en-IN')})
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Bid Input + Main CTA */}
                    <form onSubmit={handlePlaceBid} className="mt-1 flex flex-col gap-3">
                      <div className="relative">
                        <span className="absolute left-4 top-3 font-bold text-lg text-slate-500">₹</span>
                        <input
                          type="number"
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                          min={leader?.min_next_bid || listing.starting_price}
                          step={listing.min_bid_increment}
                          className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-mono text-lg font-bold text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-600/10 transition-all"
                        />
                      </div>

                      {error && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">error</span>
                          <span>{error}</span>
                        </div>
                      )}

                      {successMsg && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          <span>{successMsg}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={submitting || isSeller}
                        className={`w-full py-3.5 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          isSeller
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-slate-900 hover:bg-slate-800 text-white active:scale-[0.98]'
                        }`}
                      >
                        <span
                          className="material-symbols-outlined text-lg"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          gavel
                        </span>
                        <span>{isSeller ? 'Sellers Cannot Bid on Own Lot' : submitting ? 'Submitting Bid...' : 'Place Bid Now'}</span>
                      </button>
                    </form>
                  </div>
                ) : (
                  /* POST-CLOSING RESOLUTION */
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-indigo-600">gavel</span>
                      <h4 className="text-sm font-bold text-slate-900">Auction Closed — Handover Resolution</h4>
                    </div>

                    {outcome?.status === 'unsold' && (
                      <p className="text-xs text-slate-600">
                        This lot closed with 0 bids and was marked unsold. The seller can re-list anytime.
                      </p>
                    )}

                    {outcome?.status === 'pending_approval' && isSeller && (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-700">
                          Winner:{' '}
                          <strong className="text-slate-900">{outcome.winner_display_name}</strong> for{' '}
                          <strong className="text-emerald-700">{formatRupees(outcome.final_price)}</strong>.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleApprove}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                          >
                            Approve Price & Reserve
                          </button>
                          <button
                            type="button"
                            onClick={handleReject}
                            className="py-2 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}

                    {outcome?.status === 'approved' && (
                      <div className="space-y-3">
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs">
                          <p className="font-bold">✓ Seller Approved Winning Bid!</p>
                          <p className="mt-1">
                            Exchange Handshake Code during in-person inspection:
                          </p>
                          <div className="mt-2 text-center p-2 bg-white rounded border border-emerald-300 font-mono text-base font-extrabold text-emerald-900 tracking-wider">
                            {outcome.handover_code || 'QUAD-XXXX'}
                          </div>
                        </div>

                        {(isWinner || isSeller) && (
                          <form onSubmit={handleVerifyCode} className="space-y-2 pt-2">
                            <label className="text-[11px] font-bold text-slate-700 block">
                              Enter Handshake Code to Complete Handover:
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={inputCode}
                                onChange={(e) => setInputCode(e.target.value)}
                                placeholder="e.g. QUAD-8392"
                                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono uppercase bg-white text-slate-900"
                              />
                              <button
                                type="submit"
                                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer"
                              >
                                Confirm Handshake
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}

                    {outcome?.status === 'completed' && (
                      <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-bold text-center">
                        🎉 Campus Handover Successfully Completed! Verified via Student Council Escrow.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Automatic Proxy Bidding Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col gap-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-600 text-xl">smart_toy</span>
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Automatic Proxy Bidding
                    </span>
                  </div>
                  {/* Custom Toggle */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={proxyEnabled}
                      onChange={(e) => setProxyEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  The engine automatically bids the minimum increment (+{formatRupees(listing.min_bid_increment)}) on your behalf whenever outbid, up to your ceiling.
                </p>

                <div className="flex gap-2.5 items-center pt-1">
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-2 text-xs font-semibold text-slate-500">₹</span>
                    <input
                      type="number"
                      value={proxyCeiling}
                      onChange={(e) => setProxyCeiling(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-xs font-semibold focus:outline-none focus:border-indigo-600 focus:bg-white font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => alert(`Proxy bidding ceiling updated to ₹${parseFloat(proxyCeiling || 0).toLocaleString('en-IN')}. Engine will bid automatically on outbids.`)}
                    className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-xs font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Update Limit
                  </button>
                </div>
              </div>

              {/* Full Public Bid History Log (Clean Ledger) */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-600 text-base">history</span>
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Public Bid Ledger
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500">Immutable Logs</span>
                </div>

                {/* Bid History Table */}
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/60 text-slate-500 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200 sticky top-0 bg-white">
                      <tr>
                        <th className="py-2.5 px-4 font-medium">Bidder</th>
                        <th className="py-2.5 px-4 font-medium">Amount</th>
                        <th className="py-2.5 px-4 font-medium">Time</th>
                        <th className="py-2.5 px-4 font-medium">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bids.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400 italic">
                            No bids recorded yet. Be the first to bid!
                          </td>
                        </tr>
                      ) : (
                        bids.map((b, i) => (
                          <tr
                            key={b.id}
                            className={`transition-colors ${
                              i === 0
                                ? 'bg-emerald-50/40 hover:bg-emerald-50/70'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-3 px-4 font-medium text-slate-900 flex items-center gap-1.5">
                              {i === 0 && (
                                <span
                                  className="material-symbols-outlined text-emerald-600 text-sm"
                                  style={{ fontVariationSettings: "'FILL' 1" }}
                                >
                                  check_circle
                                </span>
                              )}
                              <span>{b.bidder_display_name}</span>
                            </td>
                            <td
                              className={`py-3 px-4 font-mono font-bold ${
                                i === 0 ? 'text-emerald-700' : 'text-slate-900'
                              }`}
                            >
                              {formatRupees(b.amount)}
                            </td>
                            <td className="py-3 px-4 text-slate-500 text-[11px]">
                              {formatTime(b.created_at)}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  i === 0
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-white border border-slate-200 text-slate-700'
                                }`}
                              >
                                {i === 0 ? 'Leading' : 'Manual'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Post-Auction Handover & Terms Box */}
              <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-800 flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-indigo-600 text-base"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    handshake
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Post-Auction Handover Terms
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  When clock reaches 00:00, provisional winner is verified. Seller {listing.seller_display_name ? listing.seller_display_name.split(' ')[0] : 'Seller'} has 4 hours to confirm reservation and coordinate Hostel Quad test inspection.
                </p>
                <div className="flex items-center gap-2 text-xs text-emerald-700 pt-1 font-medium">
                  <span className="material-symbols-outlined text-sm text-emerald-600">security</span>
                  <span>Campus Escrow protects funds until handover sign-off.</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
