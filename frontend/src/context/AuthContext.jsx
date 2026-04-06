import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  isSessionValid,
  getSessionUser,
  clearSession,
  refreshActivity,
  createSession,
  validateTokenWithDB,
} from '../auth';

const AuthContext = createContext(null);

// Pages that don't require authentication
const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-login: check token on app load and validate against Firestore
  useEffect(() => {
    const checkSession = async () => {
      console.log('[ROUTER] 🔄 Checking existing session on app load...');
      if (isSessionValid()) {
        // Token exists locally and isn't expired — now validate against Firestore
        console.log('[ROUTER] 🔍 Local session found, validating with Firestore...');
        const validatedUser = await validateTokenWithDB();
        if (validatedUser) {
          setUser(validatedUser);
          refreshActivity();
          console.log('[ROUTER] ✅ Auto-login successful for:', validatedUser.email || validatedUser.name);
        } else {
          console.log('[ROUTER] ❌ Token validation failed — user must login again');
          setUser(null);
        }
      } else {
        console.log('[ROUTER] ⚠️ No valid local session — user must login');
      }
      setLoading(false);
    };
    checkSession();
  }, []);

  // Log every route change
  useEffect(() => {
    console.log(`[ROUTER] 📍 Route changed to: ${location.pathname} | Authenticated: ${!!user} | User: ${user?.email || 'none'}`);
  }, [location.pathname, user]);

  // Refresh activity timestamp on every route change
  useEffect(() => {
    if (user) {
      refreshActivity();
    }
  }, [location.pathname, user]);

  // Redirect unauthenticated users away from protected pages
  useEffect(() => {
    if (!loading && !user && !PUBLIC_ROUTES.includes(location.pathname)) {
      console.log(`[ROUTER] 🚫 Unauthenticated access to ${location.pathname} — redirecting to /login`);
      navigate('/login');
    }
  }, [loading, user, location.pathname, navigate]);

  // Redirect authenticated users away from login/register to dashboard
  // Redirect authenticated users away from login/register to their dashboard
  useEffect(() => {
    if (!loading && user && (location.pathname === '/login' || location.pathname === '/register')) {
      const target = user.role === 'admin' ? '/admin-dashboard' : '/dashboard';
      console.log(`[ROUTER] ↩️ Authenticated user on ${location.pathname} — redirecting to ${target}`);
      navigate(target);
    }
  }, [loading, user, location.pathname, navigate]);

  const login = async (userData) => {
    console.log('[ROUTER] 🔐 Login initiated for user:', userData.email || userData.name);
    await createSession(userData);
    setUser(userData);
    const target = userData.role === 'admin' ? '/admin-dashboard' : '/dashboard';
    console.log(`[ROUTER] ✅ Login complete — navigating to ${target}`);
    navigate(target);
  };

  const logout = async () => {
    console.log('[ROUTER] 🚪 Logout initiated');
    await clearSession();
    setUser(null);
    console.log('[ROUTER] ✅ Logout complete — navigating to /login');
    navigate('/login');
  };

  if (loading) {
    return null; // Don't render until auth check is done
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
