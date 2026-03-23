import React from 'react';
import { Link } from 'react-router-dom';
import '../index.css';

export default function Register() {
  return (
    <div className="auth-container">
        <div className="auth-header">
            <h1>Create your account to get started.</h1>
        </div>
        <form action="#" method="POST">
            <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <input type="text" id="name" name="name" placeholder="Alex Johnson" required />
            </div>
            <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input type="email" id="email" name="email" placeholder="you@gmail.com" required />
            </div>
            <div className="form-group">
                <label htmlFor="password">Password</label>
                <input type="password" id="password" name="password" placeholder="••••••••" required />
                <span className="helper-text">Must be at least 8 characters.</span>
            </div>
            <div className="form-group">
                <label htmlFor="confirm-password">Confirm Password</label>
                <input type="password" id="confirm-password" name="confirm-password" placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn-primary">Register</button>
            <div className="auth-footer">
                Already have an account? <Link to="/login">Log In</Link>
            </div>
        </form>
    </div>
  );
}
