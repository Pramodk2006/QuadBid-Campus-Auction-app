/**
 * utils/notifications.js — Browser Notification API integration.
 *
 * Enables background tab notifications for:
 *   - When outbid on an active auction
 *   - When anti-sniping extends an auction deadline
 *   - When a seller answers a buyer's question
 *   - When an auction closes and winner is declared
 */

export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('Failed to request notification permission:', err);
    return 'denied';
  }
}

export function sendBrowserNotification(title, options = {}) {
  if (!isNotificationSupported()) return null;
  if (Notification.permission !== 'granted') return null;

  try {
    const defaultOptions = {
      icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏛️</text></svg>',
      badge: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚡</text></svg>',
      ...options,
    };
    const notification = new Notification(title, defaultOptions);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return notification;
  } catch (err) {
    console.warn('Browser notification failed:', err);
    return null;
  }
}

