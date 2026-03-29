import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  isSessionValid,
  getSessionUser,
  clearSession,
  refreshActivity,
} from '../auth';

const AuthContext = createContext(null);

// Pages that don't require authentication
const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-login: check token on app load
  useEffect(() => {
    if (isSessionValid()) {
      const sessionUser = getSessionUser();
      if (sessionUser) {
        setUser(sessionUser);
        refreshActivity();
      }
    }
    setLoading(false);
  }, []);

  // Refresh activity timestamp on every route change
  useEffect(() => {
    if (user) {
      refreshActivity();
    }
  }, [location.pathname, user]);

  // Redirect unauthenticated users away from protected pages
  useEffect(() => {
    if (!loading && !user && !PUBLIC_ROUTES.includes(location.pathname)) {
      navigate('/login');
    }
  }, [loading, user, location.pathname, navigate]);

  const login = (userData) => {
    setUser(userData);
  };

  const logout = () => {
    clearSession();
    setUser(null);
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
