import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import '../editProfile.css';

export default function EditProfile() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    username: '',
    timezone: 'Asia/Kolkata (GMT+5:30)',
    bio: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        username: user.username || '',
        timezone: user.timezone || 'Asia/Kolkata (GMT+5:30)',
        bio: user.bio || ''
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (user && user.userId) {
        const userRef = doc(db, 'users', String(user.userId));
        await updateDoc(userRef, formData);
        
        // Update local context
        login({ ...user, ...formData });
        
        setMessage('Profile updated successfully!');
        setTimeout(() => navigate('/home'), 1500);
      }
    } catch (err) {
      console.error('Update profile error:', err);
      setMessage('Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="edit-profile-wrapper">
      <main className="card">
        <header className="head">
          <div>
            <h1>Edit Your Profile</h1>
          </div>
          <span className="badge">Account Active</span>
        </header>

        <form id="profileForm" onSubmit={handleSave}>
          <section className="avatar-wrap">
            <img id="avatarPreview" className="avatar" src={`https://ui-avatars.com/api/?name=${formData.name}&background=10b981&color=fff&size=120`} alt="Profile avatar" />
            <div style={{color: '#94a3b8', fontSize: '0.8rem'}}>Avatar matches your name</div>
          </section>

          {message && <div style={{ color: message.includes('success') ? '#10b981' : '#ef4444', textAlign: 'center', marginBottom: '1rem' }}>{message}</div>}

          <section className="inputs">
            <div className="field">
              <label htmlFor="name">Full Name</label>
              <input id="name" name="name" type="text" value={formData.name} onChange={handleChange} required />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" value={formData.email} readOnly style={{ opacity: 0.7, cursor: 'not-allowed' }} />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone Number</label>
              <input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} />
            </div>
            <div className="field">
              <label htmlFor="username">Username</label>
              <input id="username" name="username" type="text" value={formData.username} onChange={handleChange} required />
            </div>
            <div className="field">
              <label htmlFor="timezone">Timezone</label>
              <select id="timezone" name="timezone" value={formData.timezone} onChange={handleChange}>
                <option>Asia/Kolkata (GMT+5:30)</option>
                <option>America/New_York (GMT-5)</option>
                <option>Europe/London (GMT+0)</option>
              </select>
            </div>
            <div className="field full">
              <label htmlFor="bio">Bio</label>
              <textarea id="bio" name="bio" placeholder="Tell people about yourself..." value={formData.bio} onChange={handleChange}></textarea>
            </div>

            <div className="actions">
              <button type="button" className="btn-ghost" onClick={() => navigate('/home')}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save Profile'}</button>
            </div>
          </section>
        </form>
      </main>
    </div>
  );
}
