// Cookie utility functions for affiliate tracking

/**
 * Set a cookie with optional expiration and security flags
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {number} days - Days until expiration (default: 30)
 * @param {object} options - Cookie options
 */
export function setCookie(name, value, days = 30, options = {}) {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;

  // Build cookie string with security flags
  let cookieString = `${name}=${encodeURIComponent(value)};${expires};path=/`;

  // Add security flags if not in development mode
  if (process.env.NODE_ENV !== 'development') {
    cookieString += ';Secure'; // Only send over HTTPS
  }

  // Add SameSite policy (default to Lax for affiliate cookies)
  const sameSite = options.sameSite || 'Lax';
  cookieString += `;SameSite=${sameSite}`;

  // Add HttpOnly flag for non-affiliate cookies (affiliate cookies need JS access)
  if (!name.includes('affiliate')) {
    cookieString += ';HttpOnly';
  }

  document.cookie = cookieString;
}

/**
 * Get a cookie value by name
 * @param {string} name - Cookie name
 * @returns {string|null} - Cookie value or null if not found
 */
export function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
  }
  return null;
}

/**
 * Delete a cookie
 * @param {string} name - Cookie name
 */
export function deleteCookie(name) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

/**
 * Set affiliate cookie from URL parameter or stored value
 * @param {string} affiliateId - Affiliate ID to store
 * @param {number} days - Cookie expiration days (default: 30)
 */
export function setAffiliateCookie(affiliateId, days = 30) {
  if (affiliateId) {
    setCookie('affiliate_code', affiliateId, days);
    // Also store in localStorage as backup
    try {
      localStorage.setItem('affiliate_code', affiliateId);
      localStorage.setItem('affiliate_code_expiry', Date.now() + (days * 24 * 60 * 60 * 1000));
    } catch (e) {
      console.warn('Could not store affiliate code in localStorage');
    }
  }
}

/**
 * Get affiliate ID from cookie or localStorage
 * @returns {string|null} - Affiliate ID or null if not found
 */
export function getAffiliateId() {
  // Try cookie first (check both old and new cookie names)
  let affiliateId = getCookie('affiliate_code') || getCookie('affiliate_id');

  // If no cookie, try localStorage
  if (!affiliateId && typeof window !== 'undefined') {
    try {
      const storedId = localStorage.getItem('affiliate_code') || localStorage.getItem('affiliate_id');
      const expiry = localStorage.getItem('affiliate_code_expiry') || localStorage.getItem('affiliate_expiry');

      if (storedId && expiry && Date.now() < parseInt(expiry)) {
        affiliateId = storedId;
        // Refresh the cookie
        setCookie('affiliate_code', storedId, 30);
      } else if (expiry && Date.now() >= parseInt(expiry)) {
        // Expired, clean up
        localStorage.removeItem('affiliate_code');
        localStorage.removeItem('affiliate_code_expiry');
        localStorage.removeItem('affiliate_id');
        localStorage.removeItem('affiliate_expiry');
      }
    } catch (e) {
      console.warn('Could not read affiliate code from localStorage');
    }
  }

  return affiliateId;
}

/**
 * Extract affiliate ID from URL
 * @param {string} url - URL to extract from (defaults to window.location.href)
 * @returns {string|null} - Affiliate ID or null if not found
 */
export function extractAffiliateIdFromUrl(url = null) {
  if (typeof window === 'undefined') return null;

  const urlToParse = url || window.location.href;
  const urlObj = new URL(urlToParse);

  // Check for affiliate path: /affiliate/ABC123
  const pathParts = urlObj.pathname.split('/');
  const affiliateIndex = pathParts.indexOf('affiliate');
  if (affiliateIndex !== -1 && affiliateIndex < pathParts.length - 1) {
    return pathParts[affiliateIndex + 1];
  }

  // Check for query parameter: ?affiliate=ABC123 or ?ref=ABC123
  return urlObj.searchParams.get('affiliate') || urlObj.searchParams.get('ref');
}

/**
 * Check if current page was accessed via affiliate link
 * and set cookie if needed
 */
export function checkAndSetAffiliateFromUrl() {
  if (typeof window === 'undefined') return null;

  const affiliateId = extractAffiliateIdFromUrl();
  if (affiliateId) {
    setAffiliateCookie(affiliateId, 30);
    return affiliateId;
  }

  return getAffiliateId();
}

/**
 * Clear affiliate attribution (for testing or user preference)
 */
export function clearAffiliateAttribution() {
  deleteCookie('affiliate_id');
  try {
    localStorage.removeItem('affiliate_id');
    localStorage.removeItem('affiliate_expiry');
  } catch (e) {
    // Ignore localStorage errors
  }
}
