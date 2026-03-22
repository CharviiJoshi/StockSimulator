import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../home.css';

export default function Home() {
    const navigate = useNavigate();
    const [theme, setTheme] = useState(localStorage.getItem('stocksim-theme') || 'dark');
    const [username, setUsername] = useState('Learner');
    const [stats, setStats] = useState({
        day: 1,
        cash: 10000,
        streak: 0,
        trades: 0,
        nw: 10000
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('stocksim-theme', theme);
    }, [theme]);

    useEffect(() => {
        const storedName = localStorage.getItem('stocksim-username');
        if (storedName) setUsername(storedName);

        const storedState = localStorage.getItem('stocksim-state');
        if (storedState) {
            try {
                const s = JSON.parse(storedState);
                let currentNw = s.cash || 10000;
                for (const [sym, h] of Object.entries(s.holdings || {})) {
                    if (s.prices && s.prices[sym]) currentNw += h.shares * s.prices[sym];
                }
                setStats({
                    day: s.currentDay || 1,
                    cash: s.cash || 10000,
                    streak: s.currentStreak || 0,
                    trades: (s.transactions || []).length,
                    nw: currentNw
                });
            } catch (e) {}
        }
    }, []);

    const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

    const handleNavigation = (section) => {
        localStorage.setItem('stocksim-section', section);
        navigate(`/dashboard#${section}`);
    };

    return (
        <div style={{minHeight: '100vh', display: 'flex', flexDirection: 'column'}}>
            <header className="home-nav">
                <div className="home-logo">
                    <span className="logo-sym">◈</span> StockSim
                </div>
                <div className="home-nav-right">
                    <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
                        {theme === 'dark' ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                                <circle cx="12" cy="12" r="5" />
                                <line x1="12" y1="1" x2="12" y2="3" />
                                <line x1="12" y1="21" x2="12" y2="23" />
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                <line x1="1" y1="12" x2="3" y2="12" />
                                <line x1="21" y1="12" x2="23" y2="12" />
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                            </svg>
                        ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                            </svg>
                        )}
                    </button>
                    <Link to="/edit-profile" className="user-chip" style={{textDecoration: 'none', color: 'inherit'}}>
                        <span className="user-avatar">{username[0].toUpperCase()}</span>
                        <span className="user-name">{username}</span>
                    </Link>
                    <Link to="/login" className="btn-logout">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        Log out
                    </Link>
                </div>
            </header>

            <section className="home-hero">
                <div className="home-glow home-glow-1"></div>
                <div className="home-glow home-glow-2"></div>
                <div className="home-hero-inner">
                    <div className="home-greeting">
                        <p className="home-day-chip">Day <span>{stats.day}</span></p>
                        <h1>Welcome back, <span className="home-username-title">{username}</span>.</h1>
                        <p className="home-subtitle">Your virtual portfolio starts at <strong>₹10,000</strong>. Pick a section below to continue.</p>
                    </div>
                    <div className="home-quick-stats">
                        <div className="hqs-card">
                            <div className="hqs-label">Net Worth</div>
                            <div className="hqs-value">₹{Number(stats.nw).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div className="hqs-card">
                            <div className="hqs-label">Cash</div>
                            <div className="hqs-value">₹{Number(stats.cash).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div className="hqs-card">
                            <div className="hqs-label">Streak</div>
                            <div className="hqs-value">{stats.streak} 🔥</div>
                        </div>
                        <div className="hqs-card">
                            <div className="hqs-label">Trades Made</div>
                            <div className="hqs-value">{stats.trades}</div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="home-features">
                <h2 className="home-section-title">Where do you want to go?</h2>
                <div className="home-grid">
                    {[
                        { id: 'overview', title: 'Overview', desc: 'Net worth chart, portfolio allocation, and quick stats at a glance.', icon: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /> },
                        { id: 'trade', title: 'Trade', desc: 'Buy and sell stocks with real simulated fees. Includes market price panel.', isAccent: true, icon: <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6" /></> },
                        { id: 'portfolio', title: 'Portfolio', desc: 'View all your holdings with avg cost, market value, and unrealised P&L.', icon: <><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></> },
                        { id: 'ledger', title: 'Ledger', desc: 'Full transaction history with undo support for every buy and sell order.', icon: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></> },
                        { id: 'heatmap', title: 'Heatmap', desc: 'Calendar view of daily gains and losses — spot your trading patterns.', icon: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></> },
                        { id: 'achievements', title: 'Achievements', desc: '14 badges to unlock. Track your profit streak and milestone progress.', icon: <><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" /></> }
                    ].map(card => (
                        <div key={card.id} className={`home-card ${card.isAccent ? 'home-card-accent' : ''}`} onClick={() => handleNavigation(card.id)} style={{cursor: 'pointer'}}>
                            <div className="hcard-icon-wrap">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    {card.icon}
                                </svg>
                            </div>
                            <h3>{card.title}</h3>
                            <p>{card.desc}</p>
                            <span className="hcard-arrow">→</span>
                        </div>
                    ))}
                </div>
            </section>

            <footer className="home-footer">
                <span>StockSim &nbsp;·&nbsp; Virtual cash only &nbsp;·&nbsp; Not real investing advice.</span>
            </footer>
        </div>
    );
}
