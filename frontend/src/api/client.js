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
    const errorMsg = data?.detail || data?.message || response.statusText || 'Request failed';
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

  // Listings
  getListings: (params = {}) => {
    const query = new URLSearchParams();
    if (params.keyword) query.append('keyword', params.keyword);
    if (params.category && params.category !== 'all') query.append('category', params.category);
    if (params.condition && params.condition !== 'all') query.append('condition', params.condition);
    if (params.min_price) query.append('min_price', params.min_price);
    if (params.max_price) query.append('max_price', params.max_price);
    if (params.closing_soon) query.append('closing_soon', 'true');

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
};
