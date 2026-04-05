import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import bcrypt from 'bcryptjs';
import '../index.css';

export default function ForgotPassword() {
  const navigate = useNavigate();

  // Steps: 'email' → 'otp' → 'reset'
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [userDocId, setUserDocId] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ─── STEP 1: Send OTP via server ───────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to send OTP.');
        setLoading(false);
        return;
      }

      // We still need the user doc ID for the password reset step
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setUserDocId(snapshot.docs[0].id);
      }

      setSuccess('OTP sent to your email! Check your inbox.');
      setStep('otp');
    } catch (err) {
      console.error('Send OTP error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── STEP 2: Verify OTP via server ─────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpInput }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'OTP verification failed.');
        setLoading(false);
        return;
      }

      setSuccess('OTP verified! Set your new password.');
      setStep('reset');
    } catch (err) {
      console.error('Verify OTP error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── STEP 3: Reset password ────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      const userRef = doc(db, 'users', userDocId);
      await updateDoc(userRef, { password: hashedPassword });

      setSuccess('Password reset successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      console.error('Reset password error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-header">
        <h2>Forgot Password</h2>
        <p>
          {step === 'email' && 'Enter your email to receive a one-time password.'}
          {step === 'otp' && 'Enter the OTP sent to your email.'}
          {step === 'reset' && 'Set your new password.'}
        </p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message" style={{
        background: 'rgba(16,185,129,0.1)',
        border: '1px solid rgba(16,185,129,0.3)',
        color: '#10b981',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        marginBottom: '1rem',
        fontSize: '0.9rem',
      }}>{success}</div>}

      {/* STEP 1: Email */}
      {step === 'email' && (
        <form onSubmit={handleSendOtp}>
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
          <button type="submit" className="btn-primary" style={{marginTop: '1rem', width: '100%'}} disabled={loading}>
            {loading ? 'Sending OTP...' : 'Send OTP'}
          </button>
        </form>
      )}

      {/* STEP 2: OTP Verification */}
      {step === 'otp' && (
        <form onSubmit={handleVerifyOtp}>
          <div className="form-group">
            <label htmlFor="otp">Enter OTP</label>
            <input
              type="text"
              id="otp"
              name="otp"
              placeholder="6-digit OTP"
              maxLength="6"
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
              required
              style={{
                textAlign: 'center',
                fontSize: '1.5rem',
                letterSpacing: '8px',
                fontWeight: '700',
                color: 'var(--text-primary)'
              }}
            />
          </div>
          <button type="submit" className="btn-primary" style={{marginTop: '1rem', width: '100%'}} disabled={loading}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{marginTop: '0.5rem', width: '100%', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)'}}
            onClick={() => { setStep('email'); setError(''); setSuccess(''); }}
          >
            Resend OTP
          </button>
        </form>
      )}

      {/* STEP 3: New Password */}
      {step === 'reset' && (
        <form onSubmit={handleResetPassword}>
          <div className="form-group" style={{ position: 'relative' }}>
            <label htmlFor="newPassword">New Password</label>
            <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  id="newPassword"
                  name="newPassword"
                  placeholder="••••••••"
                  style={{ color: 'var(--text-primary)' }}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
            </div>
            <span className="helper-text">Must be at least 8 characters.</span>
          </div>
          <div className="form-group" style={{ position: 'relative' }}>
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="••••••••"
                  style={{ color: 'var(--text-primary)' }}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button 
                  type="button" 
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                  {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                </button>
            </div>
          </div>
          <button type="submit" className="btn-primary" style={{marginTop: '1rem', width: '100%'}} disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      )}

      <div className="auth-footer" style={{marginTop: '2rem'}}>
        <p>Remembered your password? <Link to="/login">Sign in here</Link></p>
      </div>
    </div>
  );
}
