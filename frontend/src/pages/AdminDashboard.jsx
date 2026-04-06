import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, updateDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import bcrypt from 'bcryptjs';
import '../dashboard.css';

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dz9o6gddm';

export default function AdminDashboard() {
  const { logout } = useAuth();
  const [activeSection, setActiveSection] = useState('csv-management');
  const [theme, setTheme] = useState(localStorage.getItem('stocksim-theme') || 'dark');
  const [notification, setNotification] = useState({ text: '', isError: false, visible: false });

  const [files, setFiles] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '' });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('stocksim-theme', theme);
    fetchFiles();
    fetchAdmins();
  }, [theme]);

  // ── Fetch CSV files from Firestore ──────────────────────────
  const fetchFiles = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'csvFiles'));
      const fileList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      fileList.sort((a, b) => (a.symbol || '').localeCompare(b.symbol || ''));
      setFiles(fileList);
      console.log('[ADMIN] Loaded', fileList.length, 'CSV files from Firestore');
    } catch (err) {
      console.error('[ADMIN] Failed to fetch files from Firestore:', err);
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

  // ── CSV Validation (client-side) ────────────────────────────
  const validateCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return { valid: false, error: 'File has no data rows.' };

    const headers = lines[0].split(',').map(h => h.trim());
    const required = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume'];
    const missing = required.filter(r => !headers.includes(r));

    if (missing.length > 0) {
      return { valid: false, error: `Missing required columns: ${missing.join(', ')}` };
    }

    return { valid: true, records: lines.length - 1 };
  };

  // ── Upload CSV to Cloudinary + save metadata to Firestore ───
  const handleUpload = async (e) => {
    e.preventDefault();

    const fileInput = e.target.querySelector('input[type="file"]');
    const file = fileInput.files[0];

    if (!file) {
      showNotification('Please select a file first.', true);
      return;
    }

    if (!file.name.endsWith('.csv')) {
      showNotification('Only CSV files are allowed.', true);
      return;
    }

    setUploading(true);

    try {
      // 1. Read and validate CSV content
      showNotification('Validating CSV headers...');
      const text = await file.text();
      const validation = validateCSV(text);

      if (!validation.valid) {
        showNotification(`Validation failed: ${validation.error}`, true);
        setUploading(false);
        return;
      }

      // 2. Upload to Cloudinary with signed upload
      showNotification('Uploading to Cloudinary...');
      const timestamp = Math.round(Date.now() / 1000);
      const folder = 'stock-csvs';
      const apiKey = '651894386886899';
      const apiSecret = 'znkWCfKNvFXXf1Nqo1lx9Qstzcs';

      // Generate SHA-1 signature
      const paramsStr = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
      const msgBuffer = new TextEncoder().encode(paramsStr);
      const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
      const signature = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);
      formData.append('folder', folder);

      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`,
        { method: 'POST', body: formData }
      );

      if (!cloudRes.ok) {
        const errData = await cloudRes.json();
        throw new Error(errData.error?.message || 'Cloudinary upload failed');
      }

      const cloudData = await cloudRes.json();
      console.log('[ADMIN] Cloudinary upload success:', cloudData.secure_url);

      // 3. Derive symbol from filename (e.g., "AAPL.csv" → "AAPL", "GOOGL(in).csv" → "GOOGL")
      const symbol = file.name
        .replace(/\(in\)/gi, '')
        .replace(/\.csv$/i, '')
        .trim()
        .toUpperCase();

      // 4. Save metadata to Firestore csvFiles collection
      const csvDoc = {
        symbol,
        filename: file.name,
        cloudinaryUrl: cloudData.secure_url,
        cloudinaryPublicId: cloudData.public_id,
        uploadedAt: new Date().toISOString(),
        records: validation.records,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        status: 'Active',
      };

      await setDoc(doc(db, 'csvFiles', symbol), csvDoc);
      console.log('[ADMIN] Saved CSV metadata to Firestore:', symbol);

      showNotification(`✅ ${symbol}.csv uploaded & saved successfully!`);
      fileInput.value = '';
      fetchFiles();
    } catch (error) {
      console.error('[ADMIN] Upload error:', error);
      showNotification(`Error: ${error.message}`, true);
    } finally {
      setUploading(false);
    }
  };

  // ── Toggle status in Firestore ──────────────────────────────
  const handleToggleStatus = async (id) => {
    const file = files.find(f => f.id === id);
    if (!file) return;

    const newStatus = file.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await updateDoc(doc(db, 'csvFiles', id), { status: newStatus });
      showNotification(`File marked as ${newStatus}`);
      setFiles(files.map(f => f.id === id ? { ...f, status: newStatus } : f));
    } catch (err) {
      showNotification('Failed to update status', true);
    }
  };

  // ── Delete from Firestore ───────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'csvFiles', id));
      showNotification('File record deleted from database');
      fetchFiles();
    } catch (err) {
      showNotification('Failed to delete file', true);
    }
  };

  // ── Add Admin ───────────────────────────────────────────────
  const handleAddAdmin = async (e) => {
    e.preventDefault();
    const { name, email, password } = newAdmin;

    if (!name || !email || !password) {
      showNotification('Please fill in all fields', true);
      return;
    }

    try {
      showNotification('Creating new administrator...');

      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        showNotification('User with this email already exists', true);
        return;
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

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
          <a href="#" className="nav-item logout-btn" onClick={(e) => { e.preventDefault(); logout(); }}>
            <span className="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg></span>
            <span>Log Out</span>
          </a>
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
              <span className="card-badge">Cloudinary + Firebase</span>
            </div>
            <form onSubmit={handleUpload} className="trade-form" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="form-row" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label>Select CSV File</label>
                <input type="file" accept=".csv" className="trade-input" required style={{ width: '100%', flex: 1, minHeight: '200px', borderStyle: 'dashed', textAlign: 'center', borderColor: 'var(--border-bright)', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} />
              </div>
              <div className="trade-info-box" style={{ marginTop: '1.5rem' }}>
                <div className="tib-row"><span>Required Headers</span><span>Date, Open, High, Low, Close, Volume</span></div>
                <div className="tib-row"><span>Storage</span><span>Cloudinary (raw) + Firebase metadata</span></div>
                <div className="tib-row fee-row" style={{ color: 'var(--amber)' }}><span>Symbol is derived from filename (e.g. AAPL.csv → AAPL)</span></div>
              </div>
              <button type="submit" className="btn-execute" disabled={uploading} style={{ marginTop: '1rem', padding: '1rem', fontSize: '1.1rem' }}>
                {uploading ? 'Uploading...' : 'Verify & Upload CSV'}
              </button>
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
                    <th>Symbol</th>
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
                    <tr className="empty-row"><td colSpan="7">No CSV files found. Upload data from the CSV Data tab.</td></tr>
                  ) : (
                    files.map(file => (
                      <tr key={file.id}>
                        <td className="ticker-cell" style={{ color: 'var(--cyan)' }}>{file.symbol}</td>
                        <td>{file.filename}</td>
                        <td>{file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString() : '—'}</td>
                        <td>{file.size}</td>
                        <td>{(file.records || 0).toLocaleString()}</td>
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
