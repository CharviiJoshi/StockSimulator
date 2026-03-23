import React from 'react';
import { Link } from 'react-router-dom';
import '../index.css';

export default function ForgotPassword() {
  return (
    <div className="auth-container">
        <div className="auth-header">
            <h2>Forgot Password</h2>
            <p>Enter your email to receive a recovery link.</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); alert("Recovery link sent!"); }}>
            <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input type="email" id="email" name="email" placeholder="you@university.edu" required />
            </div>

            <button type="submit" className="btn-primary" style={{marginTop: '1rem', width: '100%'}}>Send Recovery Link</button>
        </form>

        <div className="auth-footer" style={{marginTop: '2rem'}}>
            <p>Remembered your password? <Link to="/login">Sign in here</Link></p>
        </div> 
    </div>
  );
}
