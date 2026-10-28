import React, { useState, useRef } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function CreateListingModal({ onClose, onCreated, onOpenAuth }) {
  const { user, isAuthenticated } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

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
  });

  const [photos, setPhotos] = useState([]);
  const [manualUrl, setManualUrl] = useState('');
  const [showManualUrl, setShowManualUrl] = useState(false);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (photos.length + files.length > 6) {
      setError('You can upload a maximum of 6 photos per item');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const uploadPromises = files.map(async (file) => {
        if (!file.type.startsWith('image/')) {
          throw new Error(`File "${file.name}" is not a valid image. Only JPEG, PNG, WebP allowed.`);
        }
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`File "${file.name}" exceeds 10MB limit.`);
        }
        const res = await api.uploadImage(file);
        return res.url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      setPhotos((prev) => [...prev, ...uploadedUrls]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddManualUrl = (e) => {
    e.preventDefault();
    if (!manualUrl.trim()) return;
    if (photos.length >= 6) {
      setError('Maximum 6 photos allowed');
      return;
    }
    setPhotos([...photos, manualUrl.trim()]);
    setManualUrl('');
    setError(null);
  };

  const handleRemovePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!isAuthenticated || !user) {
      setError('You must sign in with your verified campus account before listing an item.');
      return;
    }

    if (!formData.title.trim()) {
      setError('Please provide an item title');
      return;
    }
    if (formData.description.trim().length < 10) {
      setError('Description must be at least 10 characters');
      return;
    }

    // MANDATORY IMAGE CHECK
    if (photos.length === 0) {
      setError('At least one item inspection image from your device is mandatory');
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
      <div className="relative bg-white text-slate-800 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900 font-headline">List Item for Campus Handover</h2>
            <p className="text-xs text-slate-500">Posting as {user?.display_name || 'Verified Student'}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Body */}
        {!isAuthenticated || !user ? (
          <div className="p-8 text-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center mx-auto shadow-xs">
              <span className="material-symbols-outlined text-3xl">lock</span>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">Campus Identity Required to List Items</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                To guarantee safe in-person physical quad handovers, only verified students with an authenticated <code className="px-1 py-0.5 rounded bg-slate-100 font-mono font-semibold text-slate-800">@kongu.edu</code> account can create auction listings.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center max-w-xs mx-auto">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenAuth) onOpenAuth();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">login</span>
                <span>Sign In with College ID</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:border-indigo-600 focus:bg-white focus:outline-none"
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:border-indigo-600 focus:bg-white focus:outline-none"
              >
                <option value="new">Brand New</option>
                <option value="like_new">Like New</option>
                <option value="good">Good (Fully functional)</option>
                <option value="fair">Fair (Minor wear)</option>
                <option value="needs_repair">Needs Repair</option>
              </select>
            </div>
          </div>

          {/* DEVICE IMAGE UPLOAD SECTION (MANDATORY) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Inspection Photos * <span className="text-rose-600 font-extrabold">(Mandatory)</span>
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {photos.length}/6 uploaded
              </span>
            </div>

            {/* Dropzone Container */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                photos.length === 0
                  ? 'border-indigo-300 bg-indigo-50/40 hover:bg-indigo-50/70 hover:border-indigo-500'
                  : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 hover:border-slate-300'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="flex flex-col items-center gap-1.5 pointer-events-none">
                <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-xs">
                  <span className="material-symbols-outlined text-xl">
                    {uploading ? 'sync' : 'add_photo_alternate'}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800">
                    {uploading ? 'Uploading inspection photo...' : 'Click to select photo from device'}
                  </span>
                  <p className="text-[11px] text-slate-500">
                    PNG, JPG, WebP up to 10MB • At least 1 photo required
                  </p>
                </div>
              </div>
            </div>

            {/* Uploaded Photo Previews */}
            {photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-2">
                {photos.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group shadow-xs"
                  >
                    <img
                      src={url}
                      alt={`Photo ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {idx === 0 && (
                      <span className="absolute bottom-1 left-1 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                        Cover
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePhoto(idx);
                      }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/80 hover:bg-rose-600 text-white flex items-center justify-center transition-colors cursor-pointer"
                      title="Remove Photo"
                    >
                      <span className="material-symbols-outlined text-[13px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Optional Fallback Link URL Toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowManualUrl(!showManualUrl)}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>{showManualUrl ? '− Hide external image URL input' : '+ Or paste image URL'}</span>
              </button>

              {showManualUrl && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:border-indigo-600 focus:bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddManualUrl}
                    className="px-3 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
                  >
                    Add URL
                  </button>
                </div>
              )}
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
              Auction Closing Date & Time *
            </label>
            <input
              type="datetime-local"
              required
              value={formData.closes_at}
              onChange={(e) => setFormData({ ...formData, closes_at: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 font-mono focus:border-indigo-600 focus:bg-white focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Anti-sniping is enabled automatically: valid bids in the last 30s extend the auction by +60s.
            </p>
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
              disabled={submitting || uploading}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">publish</span>
                  <span>Publish Campus Lot</span>
                </>
              )}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
