// Session token utilities
// - 16-digit hex token
// - 1 week inactivity TTL (refreshed on every page load / activity)

const TOKEN_KEY = 'stocksim_token';
const USER_KEY = 'stocksim_user';
const LAST_ACTIVITY_KEY = 'stocksim_last_activity';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds

/**
 * Generate a 16-digit hexadecimal token
 */
export function generateToken() {
  const bytes = new Uint8Array(8); // 8 bytes = 16 hex chars
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a new session: store token, user data, and activity timestamp
 */
export function createSession(userData) {
  const token = generateToken();
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(userData));
  localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  return token;
}

/**
 * Refresh the activity timestamp (call on every page load / user interaction)
 */
export function refreshActivity() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  }
}

/**
 * Check if the current session is valid (token exists + not expired)
 */
export function isSessionValid() {
  const token = localStorage.getItem(TOKEN_KEY);
  const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);

  if (!token || !lastActivity) return false;

  const elapsed = Date.now() - parseInt(lastActivity, 10);
  if (elapsed > TTL_MS) {
    // Session expired due to inactivity
    clearSession();
    return false;
  }

  return true;
}

/**
 * Get the stored user data (if session is valid)
 */
export function getSessionUser() {
  if (!isSessionValid()) return null;

  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;

  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Get the current token
 */
export function getToken() {
  if (!isSessionValid()) return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Destroy the session (logout)
 */
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(LAST_ACTIVITY_KEY);
}
