// Session token utilities
// - 16-digit hex token synced with Firestore
// - 1 week inactivity TTL (refreshed on every page load / activity)

import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

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
 * Create a new session: store token locally AND in the user's Firestore document
 */
export async function createSession(userData) {
  const token = generateToken();
  console.log('[AUTH] 🔑 Generated new session token:', token);

  // Store locally
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(userData));
  localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());

  // Store in Firestore user document
  try {
    const userRef = doc(db, 'users', String(userData.userId));
    await setDoc(userRef, { sessionToken: token }, { merge: true });
    console.log('[AUTH] ✅ Token saved to Firestore for user:', userData.userId);
  } catch (err) {
    console.error('[AUTH] ❌ Failed to save token to Firestore:', err);
  }

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

  if (!token || !lastActivity) {
    console.log('[AUTH] ⚠️ No local session found');
    return false;
  }

  const elapsed = Date.now() - parseInt(lastActivity, 10);
  if (elapsed > TTL_MS) {
    // Session expired due to inactivity
    console.log('[AUTH] ⏰ Session expired (inactive for', Math.round(elapsed / 1000 / 60 / 60), 'hours)');
    clearSessionLocal();
    return false;
  }

  console.log('[AUTH] ✅ Local session is valid (token:', token.substring(0, 6) + '...)');
  return true;
}

/**
 * Validate the local token against Firestore.
 * Returns the user data if token matches, null otherwise.
 */
export async function validateTokenWithDB() {
  const token = localStorage.getItem(TOKEN_KEY);
  const userStr = localStorage.getItem(USER_KEY);

  if (!token || !userStr) {
    console.log('[AUTH] ⚠️ No local token or user data to validate');
    return null;
  }

  let userData;
  try {
    userData = JSON.parse(userStr);
  } catch {
    console.log('[AUTH] ❌ Failed to parse stored user data');
    return null;
  }

  try {
    const userRef = doc(db, 'users', String(userData.userId));
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.log('[AUTH] ❌ User document not found in Firestore');
      clearSessionLocal();
      return null;
    }

    const dbData = userSnap.data();
    if (dbData.sessionToken === token) {
      console.log('[AUTH] ✅ Token matches Firestore — auto-login successful');
      return userData;
    } else {
      console.log('[AUTH] ❌ Token mismatch — local:', token.substring(0, 6) + '... vs DB:', (dbData.sessionToken || 'none').substring(0, 6) + '...');
      clearSessionLocal();
      return null;
    }
  } catch (err) {
    console.error('[AUTH] ❌ Error validating token with Firestore:', err);
    return null;
  }
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
 * Clear local storage only (no Firestore call)
 */
function clearSessionLocal() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(LAST_ACTIVITY_KEY);
}

/**
 * Destroy the session (logout) — clears locally AND removes token from Firestore
 */
export async function clearSession() {
  const userStr = localStorage.getItem(USER_KEY);
  console.log('[AUTH] 🚪 Clearing session...');

  // Remove token from Firestore
  if (userStr) {
    try {
      const userData = JSON.parse(userStr);
      const userRef = doc(db, 'users', String(userData.userId));
      await updateDoc(userRef, { sessionToken: null });
      console.log('[AUTH] ✅ Token removed from Firestore for user:', userData.userId);
    } catch (err) {
      console.error('[AUTH] ❌ Failed to clear token from Firestore:', err);
    }
  }

  // Clear local storage
  clearSessionLocal();
  console.log('[AUTH] ✅ Local session cleared');
}
