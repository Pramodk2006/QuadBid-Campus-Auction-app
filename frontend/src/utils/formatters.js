/**
 * Format currency in Indian Rupees with proper grouping.
 */
export function formatRupees(amount) {
  if (amount === null || amount === undefined) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Calculate countdown components from closing date.
 */
export function getTimeRemaining(closesAt) {
  const total = new Date(closesAt).getTime() - new Date().getTime();
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));

  const isClosed = total <= 0;
  const isUrgent = total > 0 && total <= 30 * 1000; // anti-sniping window (<=30s)
  const isClosingSoon = total > 0 && total <= 15 * 60 * 1000; // < 15 mins

  let formatted = 'Closed';
  if (!isClosed) {
    if (days > 0) {
      formatted = `${days}d ${hours}h left`;
    } else if (hours > 0) {
      formatted = `${hours}h ${minutes}m left`;
    } else if (minutes > 0) {
      formatted = `${minutes}m ${seconds}s`;
    } else {
      formatted = `${seconds}s`;
    }
  }

  return {
    total,
    days,
    hours,
    minutes,
    seconds,
    isClosed,
    isUrgent,
    isClosingSoon,
    formatted,
  };
}

/**
 * Format timestamp to collegiate readable time e.g. "18:42:15"
 */
export function formatTime(isoString) {
  if (!isoString) return '--:--:--';
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-IN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Format ISO string to readable short date
 */
export function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}


