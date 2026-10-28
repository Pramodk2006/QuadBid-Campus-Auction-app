import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatRupees, getTimeRemaining } from '../utils/formatters';

export default function WatchlistModal({ onClose, onSelectLot, onWatchlistChange }) {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('watched'); // 'watched' | 'alerts'
  const [watchlist, setWatchlist] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New alert form
  const [newQuery, setNewQuery] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newMaxPrice, setNewMaxPrice] = useState('');
  const [savingAlert, setSavingAlert] = useState(false);

  const loadData = async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [watchData, alertsData] = await Promise.all([
        api.getWatchlist().catch(() => []),
        api.getSavedSearches().catch(() => []),
      ]);
      setWatchlist(watchData);
      setAlerts(alertsData);
      if (onWatchlistChange) onWatchlistChange(watchData.length);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isAuthenticated]);

  const handleRemoveWatch = async (listingId, e) => {
    e.stopPropagation();
    try {
      await api.removeFromWatchlist(listingId);
      const updated = watchlist.filter((w) => w.listing_id !== listingId);
      setWatchlist(updated);
      if (onWatchlistChange) onWatchlistChange(updated.length);
    } catch (err) {
      alert(`Failed to remove: ${err.message}`);
    }
  };

  const handleCreateAlert = async (e) => {
    e.preventDefault();
    if (!newQuery.trim()) return;
    setSavingAlert(true);
    try {
      const payload = {
        query: newQuery.trim(),
        category: newCategory || undefined,
        max_price: newMaxPrice ? parseFloat(newMaxPrice) : undefined,
      };
      const created = await api.createSavedSearch(payload);
      setAlerts([created, ...alerts]);
      setNewQuery('');
      setNewCategory('');
      setNewMaxPrice('');
    } catch (err) {
      alert(`Failed to save alert: ${err.message}`);
    } finally {
      setSavingAlert(false);
    }
  };

  const handleDeleteAlert = async (alertId) => {
    try {
      await api.deleteSavedSearch(alertId);
      setAlerts(alerts.filter((a) => a.id !== alertId));
    } catch (err) {
      alert(`Failed to delete alert: ${err.message}`);
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
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <span className="material-symbols-outlined text-lg">bookmark</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-headline">Watchlist & Alerts</h2>
              <p className="text-xs text-slate-500">Track pinned items and keyword alert triggers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Segmented Tab Header */}
        <div className="px-6 pt-3 border-b border-slate-200 flex gap-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('watched')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'watched'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-sm">visibility</span>
            <span>Watched Lots ({watchlist.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'alerts'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-sm">notifications</span>
            <span>Keyword Alerts ({alerts.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {!isAuthenticated ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
              <span className="material-symbols-outlined text-3xl text-slate-400">lock</span>
              <p className="text-xs font-bold text-slate-800">Please sign in with your college account</p>
              <p className="text-[11px] text-slate-500">Sign in to save items to your personal watchlist.</p>
            </div>
          ) : loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeTab === 'watched' ? (
            watchlist.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                <span className="material-symbols-outlined text-3xl text-slate-400">bookmark_border</span>
                <p className="text-xs font-bold text-slate-800">Your watchlist is empty</p>
                <p className="text-[11px] text-slate-500">
                  Bookmark any active lot from the marketplace cards or inspection room to monitor it here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {watchlist.map((item) => {
                  const l = item.listing;
                  const timer = getTimeRemaining(l.closes_at);
                  const photo = l.photos && l.photos.length > 0 ? l.photos[0] : null;

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        onClose();
                        onSelectLot(l.id);
                      }}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm bg-white flex items-center justify-between gap-4 cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {photo ? (
                          <img
                            src={photo}
                            alt={l.title}
                            className="w-14 h-14 rounded-lg object-cover shrink-0 border border-slate-200"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <span className="material-symbols-outlined">inventory_2</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block font-mono">
                            {l.category} • Lot #{l.id}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                            {l.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-mono">
                            <span>{timer.formatted}</span>
                            <span>•</span>
                            <span className="text-slate-800 font-bold">{formatRupees(l.current_price || l.starting_price)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleRemoveWatch(l.id, e)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Remove from Watchlist"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Keyword Alerts Tab */
            <div className="space-y-6">
              {/* Add New Alert Form */}
              <form onSubmit={handleCreateAlert} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-900 block">Create New Keyword Alert</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Casio, Cycle, Bishop"
                    value={newQuery}
                    onChange={(e) => setNewQuery(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                  >
                    <option value="">Any Category</option>
                    <option value="cycle">Cycle & Mobility</option>
                    <option value="calculator">Scientific Calculator</option>
                    <option value="books">Textbooks</option>
                    <option value="electronics">Electronics</option>
                    <option value="other">Other</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Max ₹ (Optional)"
                    value={newMaxPrice}
                    onChange={(e) => setNewMaxPrice(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingAlert}
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer transition-all shadow-xs"
                  >
                    {savingAlert ? 'Saving...' : 'Add Alert'}
                  </button>
                </div>
              </form>

              {/* Active Alerts List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
                  Active Alerts ({alerts.length})
                </span>
                {alerts.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No keyword alerts configured yet.</p>
                ) : (
                  alerts.map((al) => (
                    <div
                      key={al.id}
                      className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900">"{al.query}"</span>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 font-mono">
                          <span>Category: {al.category || 'All'}</span>
                          {al.max_price && (
                            <>
                              <span>•</span>
                              <span>Under {formatRupees(al.max_price)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAlert(al.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Delete Alert"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
