import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { createSession } from '../auth';
import { useAuth } from '../context/AuthContext';
import bcrypt from 'bcryptjs';
import '../index.css';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Query users collection for matching email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('Invalid credentials. Please try again.');
        setLoading(false);
        return;
      }

      // Get the user document
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      // Compare entered password with stored hash
      const isMatch = await bcrypt.compare(password, userData.password);

      if (!isMatch) {
        setError('Invalid credentials. Please try again.');
        setLoading(false);
        return;
      }

      // Login success — create session with 16-digit hex token
      const userInfo = {
        userId: userData.userId,
        name: userData.name,
        email: userData.email,
      };

      createSession(userInfo);
      login(userInfo);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
        <div className="auth-header">
            <h1>Stock Simulator</h1>
            <p>Welcome back! Sign in to your account.</p>
        </div>

        <form onSubmit={handleSubmit} id="login-form">
            {error && <div className="error-message">{error}</div>}
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
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Link to="/forgot-password" style={{fontSize: '0.85rem', color: '#10b981', textAlign: 'right', textDecoration: 'none', marginTop: '0.25rem', display: 'block'}}>Forgot password?</Link>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
        </form>

        <div className="auth-footer">
            <p>Don't have an account? <Link to="/register">Create one</Link></p>
        </div> 
    </div>
  );
}
