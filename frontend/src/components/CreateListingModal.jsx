import React, { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function CreateListingModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const defaultClose = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const localIso = new Date(defaultClose.getTime() - defaultClose.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const [formData, setFormData] = useState({
    title: '',
    category: 'cycle',
    condition: 'good',
    description: '',
    starting_price: '500',
    min_bid_increment: '20',
    closes_at: localIso,
    photoUrl: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError('Please provide an item title');
      return;
    }
    if (formData.description.trim().length < 10) {
      setError('Description must be at least 10 characters');
      return;
    }

    const startPrice = parseFloat(formData.starting_price);
    const minInc = parseFloat(formData.min_bid_increment);

    if (isNaN(startPrice) || startPrice < 1) {
      setError('Starting price must be at least ₹1');
      return;
    }
    if (isNaN(minInc) || minInc <= 0) {
      setError('Minimum increment must be greater than 0');
      return;
    }

    const closeDate = new Date(formData.closes_at);
    if (isNaN(closeDate.getTime()) || closeDate <= new Date()) {
      setError('Closing date must be in the future');
      return;
    }

    setSubmitting(true);
    try {
      const photos = formData.photoUrl.trim() ? [formData.photoUrl.trim()] : [];
      await api.createListing({
        title: formData.title.trim(),
        category: formData.category,
        condition: formData.condition,
        description: formData.description.trim(),
        starting_price: startPrice,
        min_bid_increment: minInc,
        closes_at: closeDate.toISOString(),
        photos,
      });

      if (onCreated) onCreated();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative bg-white text-slate-800 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900 font-headline">List Item for Campus Handover</h2>
            <p className="text-xs text-slate-500">Posting as {user?.display_name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-600 text-base">error</span>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Hero Sprint Pro 21-Speed Gear Cycle"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:border-indigo-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:border-indigo-600 focus:bg-white focus:outline-none"
              >
                <option value="cycle">Cycle & Mobility</option>
                <option value="calculator">Scientific Calculator</option>
                <option value="books">Textbooks & Notes</option>
                <option value="electronics">Dorm Tech</option>
                <option value="other">Lab Gear & Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Condition
              </label>
              <select
                value={formData.condition}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:border-indigo-600 focus:bg-white focus:outline-none"
              >
                <option value="new">Brand New</option>
                <option value="like_new">Like New</option>
                <option value="good">Good (Fully functional)</option>
                <option value="fair">Fair (Minor wear)</option>
                <option value="needs_repair">Needs Repair</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Starting Price (₹) *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={formData.starting_price}
                onChange={(e) => setFormData({ ...formData, starting_price: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 font-mono focus:border-indigo-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Min Increment (₹) *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={formData.min_bid_increment}
                onChange={(e) => setFormData({ ...formData, min_bid_increment: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 font-mono focus:border-indigo-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Auction Closing Date & Time (UTC) *
            </label>
            <input
              type="datetime-local"
              required
              value={formData.closes_at}
              onChange={(e) => setFormData({ ...formData, closes_at: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 font-mono focus:border-indigo-600 focus:bg-white focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Anti-sniping is enabled automatically: valid bids in the last 30s extend by +60s.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Item Photo URL
            </label>
            <input
              type="url"
              placeholder="https://images.unsplash.com/photo-..."
              value={formData.photoUrl}
              onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:border-indigo-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Description & Handover Notes *
            </label>
            <textarea
              required
              rows={3}
              placeholder="Describe condition, accessories included, and preferred campus handover point (e.g. Hostel 3 Porch)..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:border-indigo-600 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Footer Action */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Publishing...' : 'Publish Campus Lot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
