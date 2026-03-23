import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../dashboard.css';

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState('csv-management');
  const [theme, setTheme] = useState(localStorage.getItem('stocksim-theme') || 'dark');
  const [notification, setNotification] = useState({ text: '', isError: false, visible: false });
  
  const [files, setFiles] = useState([
    { id: 1, name: 'historical_stock_prices.csv', date: '2026-03-20', size: '2.4 MB', records: 15420, status: 'Active' },
    { id: 2, name: 'user_portfolios_backup.csv', date: '2026-03-22', size: '1.1 MB', records: 850, status: 'Inactive' }
  ]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('stocksim-theme', theme);
  }, [theme]);

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

  const handleDelete = (id) => {
    setFiles(files.filter(f => f.id !== id));
    showNotification('File successfully deleted', true);
  };

  const handleUpdate = (id) => {
    showNotification(`Initiating update for file ID: ${id}`);
  };

  const handleUpload = (e) => {
    e.preventDefault();
    showNotification('CSV File uploaded successfully and validation passed!');
  };

  return (
    <div className="main-container" style={{display: 'flex', minHeight: '100vh', width: '100%'}}>
      
      {/* SIDEBAR */}
      <aside className="sidebar" id="sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon-s">◈</span>
          <span className="logo-text">StockSim Admin</span>
        </div>
        
        <nav className="sidebar-nav">
          {[
            { id: 'csv-management', label: 'CSV Data', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> },
            { id: 'users', label: 'Users', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> },
            { id: 'settings', label: 'Settings', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> }
          ].map(sec => (
            <a key={sec.id} href={`#${sec.id}`} className={`nav-item ${activeSection === sec.id ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveSection(sec.id); }}>
              <span className="nav-icon">{sec.icon}</span>
              <span>{sec.label}</span>
            </a>
          ))}
        </nav>
        
        <div className="sidebar-footer">
          <Link to="/home" className="nav-item home-btn">
            <span className="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>
            <span>Home</span>
          </Link>
          <Link to="/login" className="nav-item logout-btn">
            <span className="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></span>
            <span>Log Out</span>
          </Link>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="main-content">
        
        {/* TOPBAR */}
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-date" style={{fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)'}}>
              Administration System
            </div>
            <div className="metric-sep"></div>
            <div className="topbar-metric">
              <span className="tm-label">System Status</span>
              <span className="tm-value up">OPERATIONAL</span>
            </div>
            <div className="metric-sep"></div>
            <div className="topbar-metric">
              <span className="tm-label">Total Files</span>
              <span className="tm-value">{files.length}</span>
            </div>
          </div>
          <div className="topbar-right">
            <button className="btn-theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Toggle theme">
              {theme === 'dark' ? 
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              }
            </button>
          </div>
        </header>

        {/* NOTIFICATION */}
        <div className={`notification ${notification.isError ? 'error' : ''} ${!notification.visible ? 'hidden' : ''}`}>
          <span>{notification.text}</span>
        </div>

        {/* SECTION: CSV MANAGEMENT */}
        <section className={`section ${activeSection === 'csv-management' ? 'active' : ''}`}>
          <div className="section-title">Data Management (CSV)</div>
          
          <div className="overview-grid">
            {/* Upload Card */}
            <div className="card">
              <div className="card-header">
                <h3>Upload New Market Data</h3>
                <span className="card-badge">Strict Validation</span>
              </div>
              <form onSubmit={handleUpload} className="trade-form">
                <div className="form-row">
                  <label>Select CSV File</label>
                  <input type="file" accept=".csv" className="trade-input" required style={{ padding: '2rem 1rem', borderStyle: 'dashed', textAlign: 'center', borderColor: 'var(--border-bright)' }} />
                </div>
                <div className="trade-info-box" style={{ marginTop: '0.5rem' }}>
                  <div className="tib-row"><span>Required Headers</span><span>Date, Open, High, Low, Close, Volume</span></div>
                  <div className="tib-row fee-row" style={{ color: 'var(--amber)' }}><span>Note: Gaps or missing data will trigger validation error.</span></div>
                </div>
                <button type="submit" className="btn-execute" style={{ marginTop: '0.5rem' }}>Verify & Upload CSV</button>
              </form>
            </div>

            {/* Quick Stats */}
            <div className="card">
              <div className="card-header"><h3>Storage Overview</h3></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-subtle)', fontWeight: 600 }}>Storage Used</span>
                    <span style={{ color: 'var(--text)', fontWeight: 700 }}>3.5 MB / 500 MB</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--input-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: '1%', height: '100%', background: 'linear-gradient(90deg, var(--cyan), var(--green))' }}></div>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-subtle)', fontWeight: 600 }}>Active Assets</span>
                    <span style={{ color: 'var(--text)', fontWeight: 700 }}>1 Data Source</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Files List Table */}
          <div className="card">
            <div className="card-header">
              <h3>Uploaded Datasets</h3>
              <button className="btn-undo-ledger" style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'transparent' }}>
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
                            onClick={() => handleUpdate(file.id)}
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', marginRight: '0.5rem', background: 'rgba(6,182,212,0.1)', borderColor: 'rgba(6,182,212,0.3)', color: 'var(--cyan)' }}>
                            Update
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
