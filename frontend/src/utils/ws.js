/**
 * utils/ws.js — WebSocket connection builder.
 */

export function getWebSocketUrl(path) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // If running on Vite dev server (port 5173), API is on port 8000
  const host = window.location.port === '5173'
    ? `${window.location.hostname}:8000`
    : window.location.host;

  return `${protocol}//${host}${path}`;
}

