/**
 * Input sanitization utilities
 * Prevents XSS and injection attacks
 */

/**
 * Sanitize HTML input by escaping special characters
 * @param {string} input - Input string to sanitize
 * @returns {string} - Sanitized string
 */
export function sanitizeHtml(input) {
  if (typeof input !== 'string') return '';
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };
  
  return input.replace(/[&<>"'`=/]/g, char => map[char]);
}

/**
 * Sanitize URL input
 * @param {string} input - URL string to sanitize
 * @returns {string} - Sanitized URL or empty string if invalid
 */
export function sanitizeUrl(input) {
  if (typeof input !== 'string') return '';
  
  // Remove dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  const lowerInput = input.toLowerCase();
  
  for (const protocol of dangerousProtocols) {
    if (lowerInput.startsWith(protocol)) {
      return '';
    }
  }
  
  // Basic URL validation
  try {
    // If it's a relative URL, allow it
    if (input.startsWith('/') || input.startsWith('?') || input.startsWith('#')) {
      return input;
    }
    
    // If it's an absolute URL, validate it
    const url = new URL(input);
    const allowedProtocols = ['http:', 'https:'];
    if (!allowedProtocols.includes(url.protocol)) {
      return '';
    }
    
    return input;
  } catch (e) {
    // Invalid URL format
    return '';
  }
}

/**
 * Sanitize email input
 * @param {string} input - Email string to sanitize
 * @returns {string} - Sanitized email or empty string if invalid
 */
export function sanitizeEmail(input) {
  if (typeof input !== 'string') return '';
  
  // Remove dangerous characters
  const sanitized = input.replace(/[<>"'`]/g, '');
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    return '';
  }
  
  return sanitized;
}

/**
 * Sanitize text input (removes dangerous characters)
 * @param {string} input - Text string to sanitize
 * @returns {string} - Sanitized text
 */
export function sanitizeText(input) {
  if (typeof input !== 'string') return '';
  
  // Remove dangerous characters but allow spaces, letters, numbers, and basic punctuation
  return input.replace(/[<>"'`]/g, '').trim();
}

/**
 * Sanitize numeric input
 * @param {string} input - Numeric string to sanitize
 * @returns {string} - Sanitized number or empty string
 */
export function sanitizeNumber(input) {
  if (typeof input !== 'string') return '';
  
  // Remove non-numeric characters except decimal point
  const sanitized = input.replace(/[^0-9.]/g, '');
  
  // Validate it's a valid number
  if (isNaN(parseFloat(sanitized))) {
    return '';
  }
  
  return sanitized;
}

/**
 * Validate and sanitize affiliate ID
 * @param {string} input - Affiliate ID to validate
 * @returns {string} - Validated affiliate ID or empty string
 */
export function sanitizeAffiliateId(input) {
  if (typeof input !== 'string') return '';
  
  // Affiliate IDs should be alphanumeric, 8-16 characters
  const sanitized = input.replace(/[^A-Za-z0-9]/g, '');
  
  if (sanitized.length < 8 || sanitized.length > 16) {
    return '';
  }
  
  return sanitized.toUpperCase();
}

/**
 * Sanitize form data object
 * @param {object} data - Form data object
 * @param {object} rules - Sanitization rules for each field
 * @returns {object} - Sanitized data
 */
export function sanitizeFormData(data, rules = {}) {
  const sanitized = {};
  
  for (const [key, value] of Object.entries(data)) {
    const rule = rules[key];
    
    if (!rule) {
      // No rule specified, use default text sanitization
      sanitized[key] = sanitizeText(value);
    } else {
      switch (rule) {
        case 'email':
          sanitized[key] = sanitizeEmail(value);
          break;
        case 'url':
          sanitized[key] = sanitizeUrl(value);
          break;
        case 'number':
          sanitized[key] = sanitizeNumber(value);
          break;
        case 'html':
          sanitized[key] = sanitizeHtml(value);
          break;
        case 'affiliate':
          sanitized[key] = sanitizeAffiliateId(value);
          break;
        default:
          sanitized[key] = sanitizeText(value);
      }
    }
  }
  
  return sanitized;
}

/**
 * Prevent XSS in user-generated content
 * @param {string} content - User-generated content
 * @returns {string} - Safe content for rendering
 */
export function preventXss(content) {
  if (typeof content !== 'string') return '';
  
  // Escape HTML entities
  return sanitizeHtml(content);
}
