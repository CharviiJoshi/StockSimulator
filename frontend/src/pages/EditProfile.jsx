import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../editProfile.css';

export default function EditProfile() {
  const navigate = useNavigate();

  return (
    <div className="edit-profile-wrapper">
      <main className="card">
        <header className="head">
          <div>
            <h1>Edit Your Profile</h1>
          </div>
          <span className="badge">Account Active</span>
        </header>

        <form id="profileForm" onSubmit={(e) => { e.preventDefault(); alert("Profile updated!"); }}>
          <section className="avatar-wrap">
            <img id="avatarPreview" className="avatar" src="https://ui-avatars.com/api/?name=Learner&background=10b981&color=fff&size=120" alt="Profile avatar" />
            <div style={{color: '#94a3b8', fontSize: '0.8rem'}}>Upload new avatar</div>
          </section>

          <section className="inputs">
            <div className="field">
              <label htmlFor="firstName">First Name</label>
              <input id="firstName" name="firstName" type="text" defaultValue="John" required />
            </div>
            <div className="field">
              <label htmlFor="lastName">Last Name</label>
              <input id="lastName" name="lastName" type="text" defaultValue="Doe" required />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" defaultValue="learner@example.com" required />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone Number</label>
              <input id="phone" name="phone" type="tel" />
            </div>
            <div className="field">
              <label htmlFor="username">Username</label>
              <input id="username" name="username" type="text" defaultValue="Learner" required />
            </div>
            <div className="field">
              <label htmlFor="timezone">Timezone</label>
              <select id="timezone" name="timezone" defaultValue="Asia/Kolkata (GMT+5:30)">
                <option>Asia/Kolkata (GMT+5:30)</option>
                <option>America/New_York (GMT-5)</option>
                <option>Europe/London (GMT+0)</option>
              </select>
            </div>
            <div className="field full">
              <label htmlFor="bio">Bio</label>
              <textarea id="bio" name="bio" placeholder="Tell people about yourself..."></textarea>
            </div>

            <div className="actions">
              <button type="button" className="btn-ghost" onClick={() => navigate('/home')}>Cancel</button>
              <button type="reset" className="btn-danger">Reset</button>
              <button type="submit" className="btn-primary">Save Profile</button>
            </div>
          </section>
        </form>
      </main>
    </div>
  );
}
