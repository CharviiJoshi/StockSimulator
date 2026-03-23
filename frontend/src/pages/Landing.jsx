import React from 'react';
import { Link } from 'react-router-dom';
import '../index.css';
import '../landing.css';

export default function Home() {
  return (
    <div className="landing-body">
      {/* NAV */}
      <nav className="landing-nav">
          <div className="nav-logo">
              <span className="logo-icon">◈</span> StockSim
          </div>
          <div className="nav-links">
              <a href="#features">Features</a>
              <a href="#how-it-works">How It Works</a>
              <Link to="/login" className="nav-cta">Sign In</Link>
          </div>
      </nav>

      {/* HERO */}
      <section className="hero-section">
          <div className="hero-content">
              <div className="hero-badge">
                  <span className="badge-dot"></span> Free for students &amp; learners
              </div>
              <h1 className="hero-title">
                  Practice trading<br />
                  <span className="gradient-text">before it counts.</span>
              </h1>
              <p className="hero-subtitle">
                  StockSim gives you ₹10,000 in virtual cash and a realistic market to practice in. Trade day by day,
                  track your performance, and see what your decisions look like over time — without touching real money.
              </p>
              <div className="hero-cta-group">
                  <Link to="/register" className="btn-hero-primary">Start for Free</Link>
                  <Link to="/login" className="btn-hero-secondary">Already have an account →</Link>
              </div>
          </div>
          <div className="hero-visual">
              <div className="dashboard-mockup">
                  <div className="mockup-header">
                      <div className="mockup-dot red"></div>
                      <div className="mockup-dot yellow"></div>
                      <div className="mockup-dot green"></div>
                      <span className="mockup-title">Dashboard — Day 14</span>
                  </div>
                  <div className="mockup-body">
                      <div className="mockup-metric">
                          <span className="mockup-label">Net Worth</span>
                          <span className="mockup-value up">₹1,27,430.50</span>
                      </div>
                      <div className="mockup-metric">
                          <span className="mockup-label">Today's Gain</span>
                          <span className="mockup-value up">+₹2,315.00 &nbsp;(+1.85%)</span>
                      </div>
                      <div className="mockup-chart-preview">
                          <svg viewBox="0 0 200 60" className="sparkline">
                              <polyline points="0,55 20,45 40,50 60,30 80,35 100,20 120,25 140,10 160,15 180,5 200,8"
                                  fill="none" stroke="url(#sparkGrad)" strokeWidth="2.5" strokeLinecap="round"
                                  strokeLinejoin="round" />
                              <defs>
                                  <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                      <stop offset="0%" style={ {stopColor: '#06b6d4'} } />
                                      <stop offset="100%" style={ {stopColor: '#10b981'} } />
                                  </linearGradient>
                              </defs>
                          </svg>
                      </div>
                      <div className="mockup-holdings">
                          <div className="holding-row">
                              <span className="holding-ticker">Stock A</span>
                              <span className="holding-val up">+4.2%</span>
                          </div>
                          <div className="holding-row">
                              <span className="holding-ticker">Stock B</span>
                              <span className="holding-val down">−1.8%</span>
                          </div>
                          <div className="holding-row">
                              <span className="holding-ticker">Stock C</span>
                              <span className="holding-val up">+7.1%</span>
                          </div>
                      </div>
                      <div className="mockup-badges">
                          <span className="mbadge unlocked">🏅 First Trade</span>
                          <span className="mbadge unlocked">🔥 3-Day Streak</span>
                          <span className="mbadge">🌐 Diversified</span>
                      </div>
                  </div>
              </div>
          </div>
      </section>

      {/* FEATURES */}
      <section className="features-section" id="features">
          <div className="section-header">
              <h2>Built for learning, not for looks</h2>
              <p>Every feature is here because it teaches you something useful about how trading actually works.</p>
          </div>
          <div className="features-grid">
              <div className="feature-card">
                  <div className="feature-icon-wrap">
                      <svg className="feature-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                  </div>
                  <h3>Day-by-Day Time Control</h3>
                  <p>Move forward one day at a time. Stock prices shift, your portfolio reacts — you see exactly how each
                      decision plays out before committing to the next one.</p>
              </div>
              <div className="feature-card">
                  <div className="feature-icon-wrap">
                      <svg className="feature-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="1" x2="12" y2="23" />
                          <path d="M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6" />
                      </svg>
                  </div>
                  <h3>Buy &amp; Sell with Real Fees</h3>
                  <p>Every trade comes with a 0.5% brokerage fee — just like real life. You'll quickly notice how fees eat
                      into profits when you overtrade.</p>
              </div>
              <div className="feature-card">
                  <div className="feature-icon-wrap">
                      <svg className="feature-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 14 4 9 9 4" />
                          <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                      </svg>
                  </div>
                  <h3>Undo Without Consequences</h3>
                  <p>Changed your mind after a trade? Hit undo. The simulator rolls back your entire state — cash,
                      holdings, ledger — exactly as it was. Experiment freely.</p>
              </div>
              <div className="feature-card">
                  <div className="feature-icon-wrap">
                      <svg className="feature-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                  </div>
                  <h3>Portfolio Charts</h3>
                  <p>A live net worth line chart and an allocation breakdown update with every trade. Useful for spotting
                      when you're overexposed to a single stock.</p>
              </div>
              <div className="feature-card">
                  <div className="feature-icon-wrap">
                      <svg className="feature-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="7" height="7" rx="1" />
                          <rect x="14" y="3" width="7" height="7" rx="1" />
                          <rect x="3" y="14" width="7" height="7" rx="1" />
                          <rect x="14" y="14" width="7" height="7" rx="1" />
                      </svg>
                  </div>
                  <h3>Calendar Heatmap</h3>
                  <p>Each simulated day gets a color — green for gains, red for losses. Scroll back through your history
                      and spot the patterns in your trading behavior.</p>
              </div>
              <div className="feature-card">
                  <div className="feature-icon-wrap">
                      <svg className="feature-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="8" r="6" />
                          <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
                      </svg>
                  </div>
                  <h3>Achievements &amp; Streaks</h3>
                  <p>14 badges unlock as you hit milestones — first trade, holding a 5-day profit streak, reaching $125k.
                      A bit of structure to keep things interesting.</p>
              </div>
          </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how-section" id="how-it-works">
          <div className="section-header">
              <h2>How it works</h2>
              <p>Pick it up in minutes. The sim does the heavy lifting.</p>
          </div>
          <div className="steps-container">
              <div className="step-card">
                  <div className="step-number">01</div>
                  <h3>Create a free account</h3>
                  <p>Sign up in under a minute. You start with ₹10,000 in virtual cash — no credit card, no commitment.
                  </p>
              </div>
              <div className="step-arrow">→</div>
              <div className="step-card">
                  <div class="step-number">02</div>
                  <h3>Build your portfolio</h3>
                  <p>Pick stocks from the market panel, set a quantity, and execute. The buy/sell form shows your fee and
                      total before you confirm.</p>
              </div>
              <div className="step-arrow">→</div>
              <div className="step-card">
                  <div className="step-number">03</div>
                  <h3>Advance and review</h3>
                  <p>Hit "Next Day" to move time forward. Check your charts, review your ledger, and adjust your strategy
                      based on what happened.</p>
              </div>
          </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="cta-section">
          <h2>Give it a try — it's free.</h2>
          <p>No real money. No pressure. Just you, ₹10k virtual cash, and the market.</p>
          <Link to="/register" className="btn-hero-primary">Create your account</Link>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
          <span className="logo-icon">◈</span> StockSim &nbsp;·&nbsp; A trading simulator &nbsp;·&nbsp;
          <Link to="/login">Sign In</Link> &nbsp;·&nbsp;
          <Link to="/register">Register</Link>
          <span className="footer-note">Virtual cash only. Not real investing advice.</span>
      </footer>

    </div>
  );
}
