import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import bcrypt from 'bcryptjs';
import '../index.css';

export default function Login() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (isAdminMode) {
      navigate('/admin-dashboard');
      return;
    }

    setLoading(true);
    try {
      // 1. Look for the user by email in the "users" collection
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('No account found with this email.');
        setLoading(false);
        return;
      }

      // 2. We found a user, check their password
      let matchedUser = null;
      querySnapshot.forEach((doc) => {
        matchedUser = doc.data();
      });

      const isPasswordCorrect = await bcrypt.compare(password, matchedUser.password);

      if (isPasswordCorrect) {
        navigate('/dashboard');
      } else {
        setError('Incorrect password.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-header" style={{ marginBottom: '1rem' }}>
        <h1>Stock Simulator</h1>
        <p>Welcome back! Sign in to your {isAdminMode ? 'Admin' : 'User'} account.</p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => setIsAdminMode(false)}
          style={{
            background: !isAdminMode ? '#10b981' : 'transparent',
            color: !isAdminMode ? '#fff' : '#94a3b8',
            border: '1px solid #10b981',
            padding: '0.5rem 1.5rem',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
          User Login
        </button>
        <button
          type="button"
          onClick={() => setIsAdminMode(true)}
          style={{
            background: isAdminMode ? '#3b82f6' : 'transparent',
            color: isAdminMode ? '#fff' : '#94a3b8',
            border: '1px solid #3b82f6',
            padding: '0.5rem 1.5rem',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
          Admin Login
        </button>
      </div>

      <form onSubmit={handleLogin} id="login-form">
        {error && <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="you@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%', paddingRight: '2.5rem' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8'
              }}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              )}
            </button>
          </div>
          <Link to="/forgot-password" style={{ fontSize: '0.85rem', color: '#10b981', textAlign: 'right', textDecoration: 'none', marginTop: '0.25rem', display: 'block' }}>Forgot password?</Link>
        </div>

        <button type="submit" className="btn-primary" disabled={loading} style={{ background: isAdminMode ? '#3b82f6' : '#10b981' }}>
          {loading ? 'Signing In...' : `Sign In ${isAdminMode ? 'as Admin' : ''}`}
        </button>
      </form>

      <div className="auth-footer">
        <p>Don't have an account? <Link to="/register">Create one</Link></p>
      </div>
    </div>
  );
}
