import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../index.css';

export default function Login() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');

    if (isAdminMode) {
      try {
        const response = await fetch(`http://localhost:3001/admins`);
        const admins = await response.json();
        const validAdmin = admins.find(a => a.email === email && a.password === password);

        if (validAdmin) {
          navigate('/admin-dashboard');
        } else {
          setError('Invalid admin credentials. Please try again.');
        }
      } catch (err) {
        console.error("Database connection error:", err);
        setError('Error connecting to the database server. Make sure json-server is running on port 3001.');
      }
    } else {
      navigate('/dashboard');
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

      {error && <div style={{ color: '#ef4444', marginBottom: '1rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{error}</div>}

      <form onSubmit={handleLogin} id="login-form">
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input type="email" id="email" name="email" placeholder="you@university.edu" required />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input type="password" id="password" name="password" placeholder="••••••••" required />
          <Link to="/forgot-password" style={{ fontSize: '0.85rem', color: '#10b981', textAlign: 'right', textDecoration: 'none', marginTop: '0.25rem', display: 'block' }}>Forgot password?</Link>
        </div>

        <button type="submit" className="btn-primary" style={{ background: isAdminMode ? '#3b82f6' : '#10b981' }}>
          Sign In {isAdminMode && 'as Admin'}
        </button>
      </form>

      {!isAdminMode && (
        <div className="auth-footer">
          <p>Don't have an account? <Link to="/register">Create one</Link></p>
        </div>
      )}
    </div>
  );
}
