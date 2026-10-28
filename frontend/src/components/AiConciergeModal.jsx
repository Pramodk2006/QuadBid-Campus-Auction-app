import React, { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatRupees, getTimeRemaining } from '../utils/formatters';

const SUGGESTIONS = [
  'Campus cycle with gears under ₹1600',
  'Scientific calculator for university exams',
  'Textbooks and notes for semester prep',
  'Wireless mouse or dorm accessories',
  'Drafter or drawing kit under 400',
];

export default function AiConciergeModal({ onClose, listings = [], onSelectLot }) {
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(null);
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'Hello! I am your QuadBid Campus Concierge powered by semantic AI. Tell me what you are looking for (e.g., "Find me a cycle under ₹1500" or "Do we have calculators available?"). I will analyze student listings across campus and let you know if items are available or strictly not found.',
      recommendations: [],
      isAvailable: true,
    },
  ]);

  const handleSearch = async (searchQuery) => {
    const q = searchQuery.trim();
    if (!q || loading) return;

    // Add user message immediately
    const userMsg = { sender: 'user', text: q };
    setMessages((prev) => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      // Call backend AI Concierge (Gemini LLM + collegiate semantic ontology)
      const res = await api.askAiConcierge(q);

      // Match recommended IDs back to client listings for full card previews
      const matchedLots = (res.recommended_listing_ids || [])
        .map((id) => listings.find((item) => Number(item.id) === Number(id)))
        .filter(Boolean);

      const aiMsg = {
        sender: 'ai',
        text: res.reply,
        recommendations: matchedLots,
        isAvailable: res.is_available,
        queryPrompt: q,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.warn('AI Concierge backend call failed, falling back to local search:', err);

      // Graceful local semantic fallback
      const qLower = q.toLowerCase();
      let maxPrice = null;
      const priceMatch = qLower.match(/(?:under|below|less than|within|max)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
      if (priceMatch) {
        maxPrice = parseFloat(priceMatch[1]);
      }

      const keywords = qLower
        .replace(/(?:under|below|less than|within|max|\d+|find|me|a|an|the|looking|for|show|is|there|any)/gi, '')
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 2);

      const matches = listings.filter((item) => {
        const price = item.current_price || item.starting_price;
        if (maxPrice !== null && price > maxPrice) return false;
        if (keywords.length === 0) return false;
        const searchableText = `${item.title} ${item.category} ${item.description}`.toLowerCase();
        return keywords.some((kw) => searchableText.includes(kw));
      });

      const isAvail = matches.length > 0;
      const aiText = isAvail
        ? `I found ${matches.length} campus ${matches.length === 1 ? 'lot' : 'lots'} matching your query "${q}":`
        : `Not Available: No active campus auction lots currently match "${q}".`;

      const aiMsg = {
        sender: 'ai',
        text: aiText,
        recommendations: matches.slice(0, 4),
        isAvailable: isAvail,
        queryPrompt: q,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWatchlistAlert = async (searchKw) => {
    if (!isAuthenticated) {
      alert('Please sign in to save search keyword alerts.');
      return;
    }
    try {
      await api.createSavedSearch({ keyword: searchKw });
      setSavedSuccess(`Alert created for "${searchKw}"! You'll be notified when a junior/senior posts it.`);
      setTimeout(() => setSavedSuccess(null), 4000);
    } catch (err) {
      alert(err.message || 'Failed to create alert');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-white text-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-lg">smart_toy</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 font-headline">AI Campus Concierge</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-indigo-100 text-indigo-700">
                  Semantic LLM
                </span>
              </div>
              <p className="text-xs text-slate-500">Natural language inventory assistant with strict catalog guardrails</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Suggestion Pills */}
        <div className="px-6 py-2.5 bg-indigo-50/50 border-b border-indigo-100/60 flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
          <span className="text-slate-500 font-bold shrink-0 text-[11px]">Quick Queries:</span>
          {SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              type="button"
              disabled={loading}
              onClick={() => handleSearch(s)}
              className="px-2.5 py-1 rounded-full bg-white hover:bg-indigo-600 hover:text-white border border-indigo-200 text-slate-700 text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Alert Feedback Banner */}
        {savedSuccess && (
          <div className="px-6 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-emerald-600">notifications_active</span>
            <span className="font-medium">{savedSuccess}</span>
          </div>
        )}

        {/* Chat / Message Stream */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-slate-900 text-white rounded-br-xs'
                    : 'bg-slate-100 text-slate-800 rounded-bl-xs border border-slate-200/80'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-[10px] uppercase font-mono tracking-wider opacity-75">
                    {m.sender === 'user' ? 'You' : 'Concierge'}
                  </span>
                  {m.sender === 'ai' && m.isAvailable === false && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 font-mono">
                      Not Available
                    </span>
                  )}
                  {m.sender === 'ai' && m.isAvailable === true && m.recommendations && m.recommendations.length > 0 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                      In Stock
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-line">{m.text}</p>

                {/* Not Available Watchlist CTA */}
                {m.sender === 'ai' && m.isAvailable === false && m.queryPrompt && (
                  <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-500">Want an alert when someone posts this?</span>
                    <button
                      type="button"
                      onClick={() => handleCreateWatchlistAlert(m.queryPrompt)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px]">add_alert</span>
                      <span>Create Alert</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Recommendation Cards */}
              {m.recommendations && m.recommendations.length > 0 && (
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  {m.recommendations.map((lot) => {
                    const timer = getTimeRemaining(lot.closes_at);
                    const photo = lot.photos && lot.photos.length > 0 ? lot.photos[0] : null;

                    return (
                      <div
                        key={lot.id}
                        onClick={() => {
                          onClose();
                          onSelectLot(lot.id);
                        }}
                        className="p-3 bg-white rounded-xl border border-slate-200 hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer flex gap-3 group"
                      >
                        {photo ? (
                          <img
                            src={photo}
                            alt={lot.title}
                            className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <span className="material-symbols-outlined text-lg">inventory_2</span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1 flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-indigo-600 uppercase font-mono block">
                              {lot.category} • Lot #{lot.id}
                            </span>
                            <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 truncate">
                              {lot.title}
                            </h4>
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-1">
                            <span className="font-bold font-mono text-slate-900">
                              {formatRupees(lot.current_price || lot.starting_price)}
                            </span>
                            <span className={`text-[10px] font-mono ${timer.isClosed ? 'text-slate-500' : 'text-emerald-700 font-bold'}`}>
                              {timer.formatted}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-indigo-600 font-medium py-2">
              <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              <span>Campus Concierge is scanning active lots...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch(query);
          }}
          className="p-4 border-t border-slate-200 bg-slate-50 flex items-center gap-2"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            placeholder="Ask AI: 'find me a scientific calculator' or 'cycles under ₹2000'..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-sm">send</span>
            <span>Ask</span>
          </button>
        </form>
      </div>
    </div>
  );
}
