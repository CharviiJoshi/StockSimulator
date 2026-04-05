import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import bcrypt from 'bcryptjs';
import '../index.css';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Validate password length
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      // Hash the password using bcryptjs
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(formData.password, salt);

      // Auto-increment userId using a Firestore transaction
      const counterRef = doc(db, 'counters', 'users');

      const newUserId = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);

        let currentCount = 0;
        if (counterDoc.exists()) {
          currentCount = counterDoc.data().count;
        }

        const nextId = currentCount + 1;
        transaction.set(counterRef, { count: nextId });

        // Create the user document with the incremented ID
        const userRef = doc(db, 'users', String(nextId));
        transaction.set(userRef, {
          userId: nextId,
          name: formData.name,
          email: formData.email,
          password: hashedPassword,
          createdAt: new Date().toISOString(),
        });

        return nextId;
      });

      console.log('User registered with ID:', newUserId);
      navigate('/login');
    } catch (err) {
      console.error('Registration error:', err);
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
        <div className="auth-header">
            <h1>Create your account to get started.</h1>
        </div>
        <form onSubmit={handleSubmit}>
            {error && <div className="error-message">{error}</div>}
            <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  placeholder="Alex Johnson"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
            </div>
            <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="you@gmail.com"
                  value={formData.email}
                  onChange={handleChange}
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
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <span className="helper-text">Must be at least 8 characters.</span>
            </div>
            <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Registering...' : 'Register'}
            </button>
            <div className="auth-footer">
                Already have an account? <Link to="/login">Log In</Link>
            </div>
        </form>
    </div>
  );
}
