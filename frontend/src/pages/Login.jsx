import React from 'react';
import { Link } from 'react-router-dom';
import '../index.css';

export default function Login() {
  return (
    <div className="auth-container">
        <div className="auth-header">
            <h1>Stock Simulator</h1>
            <p>Welcome back! Sign in to your account.</p>
        </div>

        <form action="#" method="POST" id="login-form">
            <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input type="email" id="email" name="email" placeholder="you@university.edu" required />
            </div>

            <div className="form-group">
                <label htmlFor="password">Password</label>
                <input type="password" id="password" name="password" placeholder="••••••••" required />
            </div>

            <button type="submit" className="btn-primary">Sign In</button>
        </form>

        <div className="auth-footer">
            <p>Don't have an account? <Link to="/register">Create one</Link></p>
        </div> 
    </div>
  );
}
