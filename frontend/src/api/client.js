/**
 * api/client.js — HTTP API client for QuadBid Backend.
 *
 * Automatically includes the Bearer JWT token from localStorage
 * on every authenticated request.
 */

const BASE_URL = '/api';

export function getAuthToken() {
  return localStorage.getItem('quadbid_token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('quadbid_token', token);
  } else {
    localStorage.removeItem('quadbid_token');
  }
}

async function request(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    if (response.status === 401) {
      setAuthToken(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('quadbid_unauthorized'));
      }
    }
    let errorMsg = response.statusText || 'Request failed';
    if (response.status === 401) {
      errorMsg = 'Campus authentication required. Please sign in with your @kongu.edu student account to proceed.';
    } else if (data?.detail) {
      if (Array.isArray(data.detail)) {
        // FastAPI 422 validation errors array: [{ loc: [...], msg: "..." }]
        errorMsg = data.detail
          .map((item) => {
            if (typeof item === 'string') return item;
            const field = item.loc && item.loc.length > 1 ? `${item.loc[item.loc.length - 1]}: ` : '';
            return `${field}${item.msg || JSON.stringify(item)}`;
          })
          .join('; ');
      } else if (typeof data.detail === 'string') {
        errorMsg = data.detail;
      } else {
        errorMsg = JSON.stringify(data.detail);
      }
    } else if (data?.message) {
      errorMsg = typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
    }
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Auth
  devLogin: (userData) =>
    request('/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  getMe: () => request('/auth/me'),

  getGoogleAuthUrl: () => request('/auth/google'),

  completeProfile: (profileData) =>
    request('/auth/complete-profile', {
      method: 'POST',
      body: JSON.stringify(profileData),
    }),

  // File Upload
  uploadImage: async (file) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);

    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const response = await fetch('/api/upload', {
      method: 'POST',
      headers,
      body: formData,
    });

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      let errorMsg = response.statusText || 'Upload failed';
      if (data?.detail) {
        if (typeof data.detail === 'string') errorMsg = data.detail;
        else errorMsg = JSON.stringify(data.detail);
      }
      throw new Error(errorMsg);
    }

    return data;
  },

  // Listings
  getListings: (params = {}) => {
    const query = new URLSearchParams();
    if (params.keyword) query.append('keyword', params.keyword);
    if (params.category && params.category !== 'all') query.append('category', params.category);
    if (params.condition && params.condition !== 'all') query.append('condition', params.condition);
    if (params.min_price) query.append('min_price', params.min_price);
    if (params.max_price) query.append('max_price', params.max_price);
    if (params.closing_soon) query.append('closing_soon', 'true');
    if (params.status) query.append('status', params.status);

    const qs = query.toString();
    return request(`/listings${qs ? `?${qs}` : ''}`);
  },

  getListing: (id) => request(`/listings/${id}`),

  createListing: (payload) =>
    request('/listings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateListing: (id, payload) =>
    request(`/listings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  cancelListing: (id) =>
    request(`/listings/${id}`, {
      method: 'DELETE',
    }),

  // Bids
  placeBid: (listingId, amount) =>
    request(`/listings/${listingId}/bids`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  getBidHistory: (listingId) => request(`/listings/${listingId}/bids`),

  getAuctionLeader: (listingId) => request(`/listings/${listingId}/leader`),

  // Sale Lifecycle (Phase 4)
  getSaleOutcome: (listingId) => request(`/listings/${listingId}/outcome`),

  approveSale: (listingId, payload = {}) =>
    request(`/listings/${listingId}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  rejectSale: (listingId, payload = {}) =>
    request(`/listings/${listingId}/reject`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  confirmHandover: (listingId, handoverCode) =>
    request(`/listings/${listingId}/handover`, {
      method: 'POST',
      body: JSON.stringify({ handover_code: handoverCode }),
    }),

  reportSaleIssue: (listingId, payload) =>
    request(`/listings/${listingId}/report-issue`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Questions & Answers (Phase 6)
  getQuestions: (listingId) => request(`/listings/${listingId}/questions`),

  askQuestion: (listingId, questionText) =>
    request(`/listings/${listingId}/questions`, {
      method: 'POST',
      body: JSON.stringify({ question_text: questionText }),
    }),

  answerQuestion: (listingId, questionId, answerText) =>
    request(`/listings/${listingId}/questions/${questionId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ answer_text: answerText }),
    }),

  // Watchlist & Saved Searches (Phase 7)
  getWatchlist: () => request('/watchlist'),

  addToWatchlist: (listingId) =>
    request(`/watchlist/${listingId}`, {
      method: 'POST',
    }),

  removeFromWatchlist: (listingId) =>
    request(`/watchlist/${listingId}`, {
      method: 'DELETE',
    }),

  getSavedSearches: () => request('/saved-searches'),

  createSavedSearch: (payload) =>
    request('/saved-searches', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteSavedSearch: (id) =>
    request(`/saved-searches/${id}`, {
      method: 'DELETE',
    }),

  // Automatic Proxy Bidding (Phase 8)
  getProxyBid: (listingId) => request(`/listings/${listingId}/proxy-bid`),

  setProxyBid: (listingId, maxCeiling) =>
    request(`/listings/${listingId}/proxy-bid`, {
      method: 'POST',
      body: JSON.stringify({ max_ceiling: maxCeiling }),
    }),
};

