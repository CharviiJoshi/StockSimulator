import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, setDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import bcrypt from 'bcryptjs';
import '../dashboard.css';

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState('csv-management');
  const [theme, setTheme] = useState(localStorage.getItem('stocksim-theme') || 'dark');
  const [notification, setNotification] = useState({ text: '', isError: false, visible: false });

  const [files, setFiles] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '' });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('stocksim-theme', theme);
    fetchFiles();
    fetchAdmins();
  }, [theme]);

  const fetchFiles = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/list-csvs`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data);
      }
    } catch (err) {
      console.error('Failed to fetch files:', err);
    }
  };

  const fetchAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'admin'));
      const snapshot = await getDocs(q);
      const adminList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAdmins(adminList);
    } catch (err) {
      console.error('Failed to fetch admins:', err);
      showNotification('Failed to load admin list', true);
    } finally {
      setLoadingAdmins(false);
    }
  };

  const showNotification = (msg, isError = false) => {
    setNotification({ text: msg, isError, visible: true });
    setTimeout(() => setNotification(n => ({ ...n, visible: false })), 3500);
  };

  const handleToggleStatus = (id) => {
    setFiles(files.map(f => {
      if (f.id === id) {
        const newStatus = f.status === 'Active' ? 'Inactive' : 'Active';
        showNotification(`File marked as ${newStatus}`);
        return { ...f, status: newStatus };
      }
      return f;
    }));
  };

  const handleDelete = async (filename) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/delete-csv/${filename}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        showNotification('File successfully deleted', true);
        fetchFiles();
      }
    } catch (err) {
      showNotification('Failed to delete file', true);
    }
  };

    const handleUpload = async (e) => {
    e.preventDefault();
    
    const fileInput = e.target.querySelector('input[type="file"]');
    const file = fileInput.files[0];
    
    if (!file) {
      showNotification('Please select a file first.', true);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      showNotification("Sending to Pandas Engine for validation...");
      
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/upload-csv`, {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Upload failed');
      }
      
      showNotification('CSV Validation Passed & Saved to Hard Drive!');
      fetchFiles();
      
    } catch (error) {
      showNotification(`Error: ${error.message}`, true);
    }
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    const { name, email, password } = newAdmin;

    if (!name || !email || !password) {
      showNotification('Please fill in all fields', true);
      return;
    }

    try {
      showNotification('Creating new administrator...');

      // 1. Check if email exists
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        showNotification('User with this email already exists', true);
        return;
      }

      // 2. Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // 3. Get next ID and save (Single Transaction)
      const counterRef = doc(db, 'counters', 'users');

      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let currentCount = 0;
        if (counterDoc.exists()) {
          currentCount = counterDoc.data().count;
        }

        const nextId = currentCount + 1;
        transaction.set(counterRef, { count: nextId });

        const newUserRef = doc(db, 'users', String(nextId));
        transaction.set(newUserRef, {
          userId: nextId,
          name: name,
          email: email,
          password: hashedPassword,
          role: 'admin',
          createdAt: new Date().toISOString(),
        });
      });

      showNotification(`Admin account created for ${name}`);
      setNewAdmin({ name: '', email: '', password: '' });
      fetchAdmins();
    } catch (err) {
      console.error('Error adding admin:', err);
      showNotification('Failed to create admin account', true);
    }
  };


  return (
    <div className="main-container" style={{ minHeight: '100vh', width: '100%' }}>

      {/* SIDEBAR */}
      <aside className="sidebar" id="sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon-s">◈</span>
          <span className="logo-text">StockSim Admin</span>
        </div>

        <nav className="sidebar-nav">
          {[
            { id: 'csv-management', label: 'CSV Data', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> },
            { id: 'admin-management', label: 'Admin Panel', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> },
            { id: 'history', label: 'Data Registry', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> }
          ].map(sec => (
            <a key={sec.id} href={`#${sec.id}`} className={`nav-item ${activeSection === sec.id ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveSection(sec.id); }}>
              <span className="nav-icon">{sec.icon}</span>
              <span>{sec.label}</span>
            </a>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Link to="/login" className="nav-item logout-btn">
            <span className="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg></span>
            <span>Log Out</span>
          </Link>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="main-content">

        {/* TOPBAR */}
        <header className="topbar" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0.9rem 2rem' }}>
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)' }}>
            {activeSection === 'csv-management' ? 'Data Management' : 
             activeSection === 'admin-management' ? 'Admin Management' : 'Data Registry'}
          </div>
          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link to="/edit-profile" className="btn-theme-toggle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: 'inherit' }} title="Edit Profile">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </Link>
            <button className="btn-theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Toggle theme">
              {theme === 'dark' ?
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
              }
            </button>
          </div>
        </header>

        {/* NOTIFICATION */}
        <div className={`notification ${notification.isError ? 'error' : ''} ${!notification.visible ? 'hidden' : ''}`}>
          <span>{notification.text}</span>
        </div>

        {/* SECTION: CSV MANAGEMENT */}
        <section className={`section ${activeSection === 'csv-management' ? 'active' : ''}`} style={{ padding: '2rem' }}>

          {/* Upload Card */}
          <div className="card" style={{ width: '100%', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header">
              <h3>Upload New Market Data</h3>
              <span className="card-badge">Strict Validation</span>
            </div>
            <form onSubmit={handleUpload} className="trade-form" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="form-row" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label>Select CSV File</label>
                <input type="file" accept=".csv" className="trade-input" required style={{ width: '100%', flex: 1, minHeight: '200px', borderStyle: 'dashed', textAlign: 'center', borderColor: 'var(--border-bright)', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} />
              </div>
              <div className="trade-info-box" style={{ marginTop: '1.5rem' }}>
                <div className="tib-row"><span>Required Headers</span><span>Date, Open, High, Low, Close, Volume</span></div>
                <div className="tib-row fee-row" style={{ color: 'var(--amber)' }}><span>Note: Gaps or missing data will trigger validation error.</span></div>
              </div>
              <button type="submit" className="btn-execute" style={{ marginTop: '1rem', padding: '1rem', fontSize: '1.1rem' }}>Verify & Upload CSV</button>
            </form>
          </div>
        </section>

        {/* SECTION: ADMIN MANAGEMENT */}
        <section className={`section ${activeSection === 'admin-management' ? 'active' : ''}`} style={{ padding: '2rem' }}>
          <div className="trade-layout">
            {/* Add Admin Form */}
            <div className="card">
              <div className="card-header">
                <h3>Add New Administrator</h3>
                <span className="card-badge">Privileged Role</span>
              </div>
              <form onSubmit={handleAddAdmin} className="trade-form">
                <div className="form-row">
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    className="trade-input" 
                    placeholder="Enter name" 
                    value={newAdmin.name}
                    onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                    required 
                  />
                </div>
                <div className="form-row">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    className="trade-input" 
                    placeholder="admin@example.com" 
                    value={newAdmin.email}
                    onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                    required 
                  />
                </div>
                <div className="form-row">
                  <label>Password</label>
                  <input 
                    type="password" 
                    className="trade-input" 
                    placeholder="••••••••" 
                    value={newAdmin.password}
                    onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                    required 
                  />
                </div>
                <div className="trade-info-box" style={{ marginTop: '0.5rem' }}>
                  <div className="tib-row"><span>Access Level</span><span style={{ color: 'var(--cyan)' }}>Full Admin Rights</span></div>
                  <div className="tib-row fee-row" style={{ color: 'var(--amber)' }}><span>Note: This user will have full access to dashboards and CSV data.</span></div>
                </div>
                <button type="submit" className="btn-execute" style={{ marginTop: '1rem' }}>Create Admin Account</button>
              </form>
            </div>

            {/* Admin List */}
            <div className="card">
              <div className="card-header">
                <h3>Current Administrators</h3>
                <button className="btn-undo-ledger" onClick={fetchAdmins} style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'transparent' }}>
                  ⟳ Refresh
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingAdmins ? (
                      <tr className="empty-row"><td colSpan="3">Loading administrators...</td></tr>
                    ) : admins.length === 0 ? (
                      <tr className="empty-row"><td colSpan="3">No administrators found.</td></tr>
                    ) : (
                      admins.map(admin => (
                        <tr key={admin.id}>
                          <td style={{ fontWeight: 600 }}>{admin.name}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{admin.email}</td>
                          <td>
                            <span className="ach-tag" style={{ background: 'rgba(6,182,212,0.15)', color: 'var(--cyan)', marginTop: 0 }}>
                              {admin.role}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION: HISTORY */}
        <section className={`section ${activeSection === 'history' ? 'active' : ''}`} style={{ padding: '2rem' }}>

          {/* Files List Table */}
          <div className="card" style={{ width: '100%', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header">
              <h3>Uploaded Datasets</h3>
              <button className="btn-undo-ledger" onClick={fetchFiles} style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'transparent' }}>
                ⟳ Refresh List
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Uploaded On</th>
                    <th>Size</th>
                    <th>Records</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.length === 0 ? (
                    <tr className="empty-row"><td colSpan="6">No CSV files found in the system.</td></tr>
                  ) : (
                    files.map(file => (
                      <tr key={file.id}>
                        <td className="ticker-cell" style={{ color: 'var(--cyan)' }}>{file.name}</td>
                        <td>{file.date}</td>
                        <td>{file.size}</td>
                        <td>{file.records.toLocaleString()}</td>
                        <td>
                          <span className="ach-tag" style={{
                            background: file.status === 'Active' ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                            color: file.status === 'Active' ? 'var(--green)' : 'var(--red)',
                            marginTop: 0
                          }}>
                            {file.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn-undo-ledger"
                            onClick={() => handleToggleStatus(file.id)}
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', marginRight: '0.5rem', background: 'transparent', borderColor: 'var(--border)', color: 'var(--text)' }}>
                            Toggle Status
                          </button>
                          <button
                            className="btn-undo-ledger"
                            onClick={() => handleDelete(file.id)}
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
