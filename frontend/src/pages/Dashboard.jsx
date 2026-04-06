import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Chart from 'chart.js/auto';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, addDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { getAvailableAssets, getMarketRange, getHistoricalPrices } from '../csvService';
import '../dashboard.css';

// ── INITIAL STOCK DATA ──────────────────────────────────────
let STOCKS = {};
let csvFilesList = []; // Cached Firestore csvFiles metadata

const FEE_RATE   = 0.005; // 0.5% per trade
const START_CASH = 10000; // ₹10,000 starting cash
const CURRENCY   = '₹';

function calcNetWorth(s) {
    let total = s.cash;
    for (const [sym, h] of Object.entries(s.holdings)) {
        total += h.shares * (s.prices[sym] || 0);
    }
    return total;
}

// ── ACHIEVEMENT DEFINITIONS ─────────────────────────────────
const ACHIEVEMENTS_DEF = [
    { id: "first_trade",  icon: "🎯", name: "First Trade",      desc: "Execute your very first trade.",              check: s => s.transactions.length >= 1 },
    { id: "ten_trades",   icon: "📦", name: "Active Trader",    desc: "Complete 10 trades.",                         check: s => s.transactions.length >= 10 },
    { id: "diversify",    icon: "🌐", name: "Diversified",      desc: "Hold 3 different stocks at once.",            check: s => Object.keys(s.holdings).length >= 3 },
    { id: "first_profit", icon: "💰", name: "In the Green",     desc: "End a day with a positive P&L.",             check: s => s.bestDay > 0 },
    { id: "streak_3",     icon: "🔥", name: "3-Day Streak",     desc: "Profit 3 days in a row.",                    check: s => s.currentStreak >= 3 },
    { id: "streak_5",     icon: "⚡", name: "5-Day Streak",     desc: "Profit 5 days in a row.",                    check: s => s.currentStreak >= 5 },
    { id: "streak_10",    icon: "🌟", name: "On a Roll",        desc: "Profit 10 days in a row.",                   check: s => s.currentStreak >= 10 },
    { id: "day_10",       icon: "📅", name: "Veteran",          desc: "Simulate 10 days.",                          check: s => s.currentDay >= 10 },
    { id: "day_30",       icon: "🗓️", name: "Month of Markets", desc: "Simulate 30 days.",                          check: s => s.currentDay >= 30 },
    { id: "net_11k",      icon: "📈", name: "Bull Runner",      desc: "Reach a net worth of ₹11,000.",              check: s => calcNetWorth(s) >= 11000 },
    { id: "net_12500",    icon: "🚀", name: "Momentum Master",  desc: "Reach a net worth of ₹12,500.",              check: s => calcNetWorth(s) >= 12500 },
    { id: "net_15k",      icon: "💎", name: "Diamond Hands",    desc: "Reach a net worth of ₹15,000.",              check: s => calcNetWorth(s) >= 15000 },
    { id: "sell_profit",  icon: "🎉", name: "Profit Taker",     desc: "Sell a stock for a profit.",                 check: s => s.hasSoldForProfit },
    { id: "big_day",      icon: "🏆", name: "Big Winner",       desc: `Earn over ${CURRENCY}200 in a single day.`, check: s => s.bestDay >= 200 },
];

function buildInitialState() {
    const prices = {};
    const prevPrices = {};
    for (const [sym, data] of Object.entries(STOCKS)) {
        prices[sym]     = data.price;
        prevPrices[sym] = data.price;
    }
    return {
        currentDay:      1,
        cash:            START_CASH,
        holdings:        {},   // { AAPL: { shares, avgCost } }
        transactions:    [],   // array of trade records
        netWorthHistory: [{ day: 0, value: START_CASH }],
        dayPnlHistory:   [],   // { day, pnl }
        prices,
        prevPrices,
        unlockedAchievements: [],
        currentStreak:  0,
        bestStreak:     0,
        bestDay:        0,
        worstDay:       0,
        totalFees:      0,
        hasSoldForProfit: false,
        dayPnl:         0,
        simStartDate:   null,
        simEndDate:     null,
        currentDate:    null,
        isSimActive:    false,
    };
}

function advanceDateStr(dateStr) {
    const d = new Date(dateStr);
    do {
        d.setDate(d.getDate() + 1);
    } while (d.getDay() === 0 || d.getDay() === 6); // skip weekends
    return d.toISOString().split('T')[0];
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return ""; 
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Fallback for old transactions without simDate
function getFallbackDate(dayNum, startDate) {
    if (!startDate) return "";
    let d = new Date(startDate);
    let tradingDay = 1;
    while (tradingDay < dayNum) {
        d.setDate(d.getDate() + 1);
        if (d.getDay() !== 0 && d.getDay() !== 6) { // Skip weekends
            tradingDay++;
        }
    }
    return d.toISOString();
}

function fmt(n, decimals = 2) {
    if (n === null || n === undefined || isNaN(n) || n === 0) return "NA";
    return CURRENCY + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtSigned(n) {
    if (n === null || n === undefined || isNaN(n) || n === 0) return "NA";
    return (n >= 0 ? '+' : '−') + fmt(Math.abs(n));
}

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

const CHART_COLORS = [
    '#06b6d4','#10b981','#f59e0b','#8b5cf6','#f43f5e',
    '#3b82f6','#ec4899','#14b8a6','#a78bfa','#fbbf24'
];

export default function Dashboard() {
    const { user, logout } = useAuth();
    const [state, setState] = useState(buildInitialState);
    const [stateHistory, setStateHistory] = useState([]);
    const [activeSection, setActiveSection] = useState('overview');
    const [orderType, setOrderType] = useState('BUY');
    const [tradeSymbol, setTradeSymbol] = useState('AAPL');
    const [tradeQty, setTradeQty] = useState(1);
    
    // UI states
    const [notification, setNotification] = useState({ text: '', isError: false, visible: false });
    const [theme, setTheme] = useState(localStorage.getItem('stocksim-theme') || 'dark');
    
    // Filters and Sim states
    const [chartFromDay, setChartFromDay] = useState(0);
    const [chartToDay, setChartToDay] = useState(null); // null = all time
    const [simStartDate, setSimStartDate] = useState('');
    const [simEndDate, setSimEndDate] = useState('');
    const [simWarn, setSimWarn] = useState('');
    const [tradeWarn, setTradeWarn] = useState('');
    const [marketRange, setMarketRange] = useState({ min: "2020-01-01", max: "2026-03-19" });
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    // Helper: load CSV file metadata from Firestore
    const loadCSVFiles = async () => {
        try {
            const snapshot = await getDocs(collection(db, 'csvFiles'));
            const files = snapshot.docs
                .map(d => d.data())
                .filter(f => f.status === 'Active');
            csvFilesList = files;
            console.log('[DASHBOARD] Loaded', files.length, 'active CSV files from Firestore');
            return files;
        } catch (err) {
            console.error('[DASHBOARD] Failed to load CSV files from Firestore:', err);
            return [];
        }
    };

    const fetchPricesForDate = async (dateStr) => {
        try {
            return await getHistoricalPrices(csvFilesList, dateStr);
        } catch (err) {
            console.error("Failed to fetch historical prices:", err);
            return null;
        }
    };

    useEffect(() => {
        const initDashboard = async () => {
            try {
                // 0. Load CSV file metadata from Firestore
                const files = await loadCSVFiles();

                // 1. Get market date range (parsed in-browser from Cloudinary CSVs)
                const range = await getMarketRange(files);
                setMarketRange(range);
                setSimStartDate(range.min);
                setSimEndDate(range.max);

                // 2. Get available assets (derived from Firestore csvFiles)
                const realAssets = getAvailableAssets(files);
                STOCKS = realAssets;
                const symbols = Object.keys(realAssets);
                if (symbols.length > 0 && !symbols.includes(tradeSymbol)) {
                    setTradeSymbol(symbols[0]);
                }

                // 3. Load user-specific simulation state from Firestore
                if (user && user.userId) {
                    const userRef = doc(db, 'users', String(user.userId));
                    const userSnap = await getDoc(userRef);
                    
                    if (userSnap.exists()) {
                        const data = userSnap.data();
                        if (data.simState) {
                            const tradesRef = collection(db, 'users', String(user.userId), 'transactions');
                            const tradesSnap = await getDocs(tradesRef);
                            const transactions = tradesSnap.docs
                                .map(d => d.data())
                                .sort((a, b) => {
                                    if (a.day !== b.day) return a.day - b.day;
                                    return new Date(a.timestamp) - new Date(b.timestamp);
                                });
                            
                            setState(prev => ({
                                ...prev,
                                ...data.simState,
                                transactions: transactions
                            }));
                        } else {
                            // First time user, set initial prices from the range's start
                            const initialPrices = await fetchPricesForDate(range.min);
                            if (initialPrices) {
                                setState(prev => ({ ...prev, prices: initialPrices, prevPrices: initialPrices }));
                            }
                        }
                    }
                }
                setIsDataLoaded(true);
            } catch (err) {
                console.error("Dashboard initialization error:", err);
            }
        };

        if (user) initDashboard();
    }, [user]);


    const nwChartRef = useRef(null);
    const allocChartRef = useRef(null);
    const netWorthChartInst = useRef(null);
    const allocChartInst = useRef(null);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('stocksim-theme', theme);
    }, [theme]);

    function getThemeColors() {
        const isDark = theme !== 'light';
        return {
            gridColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
            tickColor: isDark ? '#475569' : '#94a3b8',
            bgColor:   isDark ? '#0a0f1a' : '#f1f5f9',
            cashColor: isDark ? '#334155' : '#cbd5e1',
        };
    }

    const showNotification = (msg, isError = false) => {
        setNotification({ text: msg, isError, visible: true });
        setTimeout(() => setNotification(n => ({ ...n, visible: false })), 3500);
    };

    const pushHistory = (currentState) => {
        setStateHistory(prev => {
            const next = [...prev, deepClone(currentState)];
            if (next.length > 50) next.shift();
            return next;
        });
    };

    const advanceDay = async () => {
        if (!isDataLoaded) return;
        let newState = deepClone(state);
        let nextDate = newState.currentDate;
        
        if (newState.isSimActive && newState.currentDate) {
            if (newState.currentDate >= newState.simEndDate) {
                showNotification('Simulation ended! You reached your selected end date.', true);
                return;
            }
            nextDate = advanceDateStr(newState.currentDate);
        }

        const newPrices = await fetchPricesForDate(nextDate || marketRange.min);
        if (!newPrices) {
            showNotification('Could not fetch market data for the next day.', true);
            return;
        }

        pushHistory(state);

        const prevNW = calcNetWorth(newState);
        
        // Use real prices from CSV
        newState.prevPrices = { ...newState.prices };
        newState.prices = newPrices;
        newState.currentDate = nextDate;

        const newNW = calcNetWorth(newState);
        const dayPnl = parseFloat((newNW - prevNW).toFixed(2));
        newState.dayPnl = dayPnl;
        newState.dayPnlHistory.push({ day: newState.currentDay, pnl: dayPnl });

        // Streak
        if (dayPnl > 0) {
            newState.currentStreak++;
            if (newState.currentStreak > newState.bestStreak) newState.bestStreak = newState.currentStreak;
        } else {
            newState.currentStreak = 0;
        }

        newState.bestDay  = Math.max(newState.bestDay, dayPnl);
        newState.worstDay = Math.min(newState.worstDay, dayPnl);
        newState.currentDay++;
        newState.netWorthHistory.push({ day: newState.currentDay - 1, value: newNW });

        checkAchievements(newState);
        setState(newState);
        
        // Persist to Firestore
        if (user && user.userId && isDataLoaded) {
            const userRef = doc(db, 'users', String(user.userId));
            const { transactions, ...persistState } = newState;
            persistState.tradeCount = transactions.filter(t => !t.isUndone).length;
            updateDoc(userRef, { simState: persistState });
        }

        const dateStr = newState.isSimActive ? formatDateDisplay(newState.currentDate) : `Day ${newState.currentDay}`;
        const msg = dayPnl >= 0
            ? `📅 ${dateStr} — Portfolio up ${fmtSigned(dayPnl)} today!`
            : `📅 ${dateStr} — Portfolio down ${fmtSigned(dayPnl)} today.`;
        showNotification(msg, dayPnl < 0);
    };

    const startSimulation = async () => {
        if (!simStartDate || !simEndDate) {
            setSimWarn("Please select both start and end dates.");
            return;
        }
        const start = new Date(simStartDate);
        const end   = new Date(simEndDate);

        if (start >= end) {
            setSimWarn("Start date must be before end date.");
            return;
        }
        if (start.getDay() === 0 || start.getDay() === 6) {
            setSimWarn("Start date cannot be on a weekend.");
            return;
        }

        const initialPrices = await fetchPricesForDate(simStartDate);
        if (!initialPrices) {
            setSimWarn("Could not fetch market data for the selected start date.");
            return;
        }

        setState(prev => ({
            ...prev,
            simStartDate,
            simEndDate,
            currentDate: simStartDate,
            prices: initialPrices,
            prevPrices: initialPrices,
            isSimActive: true
        }));
        setSimWarn("Simulation started successfully!");
        setChartFromDay(0);
        setChartToDay(null);
        setTimeout(() => setSimWarn(''), 3000);
    };

    const executeTrade = () => {
        if (!tradeSymbol || !tradeQty || tradeQty < 1) {
            setTradeWarn('Please enter a valid quantity.');
            return;
        }

        let newState = deepClone(state);
        const price = newState.prices[tradeSymbol];
        const cost  = price * tradeQty;
        const fee   = parseFloat((cost * FEE_RATE).toFixed(2));

        if (orderType === 'BUY') {
            const total = cost + fee;
            if (total > newState.cash) {
                setTradeWarn(`Not enough cash. You need ${fmt(total)} but have ${fmt(newState.cash)}.`);
                return;
            }
            pushHistory(state);
            newState.cash = parseFloat((newState.cash - total).toFixed(2));
            if (!newState.holdings[tradeSymbol]) newState.holdings[tradeSymbol] = { shares: 0, avgCost: 0 };
            const h = newState.holdings[tradeSymbol];
            const totalCost = h.shares * h.avgCost + cost;
            h.shares  += tradeQty;
            h.avgCost  = parseFloat((totalCost / h.shares).toFixed(4));
        } else {
            if (!newState.holdings[tradeSymbol] || newState.holdings[tradeSymbol].shares < tradeQty) {
                setTradeWarn(`You don't hold enough ${tradeSymbol} shares.`);
                return;
            }
            pushHistory(state);
            const h = newState.holdings[tradeSymbol];
            const proceeds = cost - fee;
            const costBasis = h.avgCost * tradeQty;
            if (proceeds > costBasis) newState.hasSoldForProfit = true;
            newState.cash = parseFloat((newState.cash + proceeds).toFixed(2));
            h.shares -= tradeQty;
            if (h.shares === 0) delete newState.holdings[tradeSymbol];
        }

        const transaction = {
            id:    newState.transactions.length + 1,
            day:   newState.currentDay,
            simDate: newState.currentDate, // Record current simulation date
            type:  orderType,
            sym:   tradeSymbol,
            qty:   tradeQty,
            price: parseFloat(price.toFixed(2)),
            fee,
            total: orderType === 'BUY' ? -(cost + fee) : (cost - fee),
            timestamp: new Date().toISOString(),
            isUndone: false
        };

        newState.transactions.push(transaction);
        newState.totalFees = parseFloat((newState.totalFees + fee).toFixed(2));
        setTradeWarn('');
        setTradeQty(1);

        checkAchievements(newState);
        setState(newState);
        
        // Persist to Firestore
        if (user && user.userId && isDataLoaded) {
            const userRef = doc(db, 'users', String(user.userId));
            const { transactions, ...persistState } = newState;
            persistState.tradeCount = transactions.filter(t => !t.isUndone).length;
            updateDoc(userRef, { simState: persistState });
            
            // Add transaction to subcollection
            const tradesRef = collection(db, 'users', String(user.userId), 'transactions');
            addDoc(tradesRef, transaction);
        }

        showNotification(`✅ ${orderType} ${tradeQty} × ${tradeSymbol} @ ${fmt(price)} — Fee: ${fmt(fee)}`);
    };

    const undoLast = async () => {
        if (stateHistory.length === 0) return;
        const prev = stateHistory[stateHistory.length - 1];
        
        // Soft undo: Mark the last transaction as Undone instead of deleting it
        let newState = deepClone(prev);
        const lastTxIdx = state.transactions.length - 1;
        if (lastTxIdx >= 0) {
            const lastTx = state.transactions[lastTxIdx];
            // Update the transactions list to include a copy of the transactions from 'state' but with the last one marked undone
            newState.transactions = state.transactions.map((t, i) => i === lastTxIdx ? { ...t, isUndone: true } : t);
            
            // Sync with Firestore
            if (user && user.userId) {
                const tradesRef = collection(db, 'users', String(user.userId), 'transactions');
                const q = query(tradesRef, where('id', '==', lastTx.id));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    await updateDoc(doc(db, 'users', String(user.userId), 'transactions', snap.docs[0].id), { isUndone: true });
                }
            }
        }

        setState(newState);
        setStateHistory(h => h.slice(0, h.length - 1));
        
        // Persist the state (cash/holdings) back to Firestore
        if (user && user.userId) {
            const userRef = doc(db, 'users', String(user.userId));
            const { transactions, ...persistState } = newState;
            persistState.tradeCount = transactions.filter(t => !t.isUndone).length;
            updateDoc(userRef, { simState: persistState });
        }

        showNotification('↩ Last action undone and recorded.');
    };

    const checkAchievements = (s) => {
        for (const ach of ACHIEVEMENTS_DEF) {
            if (!s.unlockedAchievements.includes(ach.id) && ach.check(s)) {
                s.unlockedAchievements.push(ach.id);
                showNotification(`🏅 Achievement unlocked: "${ach.name}"!`);
            }
        }
    };

    // Initialize & Update Charts
    useEffect(() => {
        if (!nwChartRef.current || !allocChartRef.current || activeSection !== 'overview') return;

        const tc = getThemeColors();
        if (!netWorthChartInst.current) {
            netWorthChartInst.current = new Chart(nwChartRef.current, {
                type: 'line',
                data: { labels: [], datasets: [{ label: 'Net Worth', data: [], borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.07)', borderWidth: 2.5, pointRadius: 3, pointHoverRadius: 6, fill: true, tension: 0.4 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + CURRENCY + ctx.parsed.y.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) } } }, scales: { x: { grid: { color: tc.gridColor }, ticks: { color: tc.tickColor, font: { size: 11 } } }, y: { grid: { color: tc.gridColor }, ticks: { color: tc.tickColor, font: { size: 11 }, callback: v => CURRENCY + (v/1000).toFixed(0) + 'k' } } } }
            });
            allocChartInst.current = new Chart(allocChartRef.current, {
                type: 'doughnut',
                data: { labels: ['Cash'], datasets: [{ data: [100], backgroundColor: [tc.cashColor], borderColor: tc.bgColor, borderWidth: 2, hoverOffset: 6 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed.toFixed(1)}%` } } }, cutout: '68%' }
            });
        }

        // Apply filters & state
        let history = state.netWorthHistory;
        const maxDay = chartToDay !== null ? chartToDay : state.currentDay - 1;
        history = history.filter(h => h.day >= chartFromDay && h.day <= maxDay);

        const labels = history.map(h => 'D' + h.day);
        const vals   = history.map(h => h.value);
        netWorthChartInst.current.data.labels = labels;
        netWorthChartInst.current.data.datasets[0].data = vals;
        if (vals.length >= 2) {
            const isUp = vals[vals.length - 1] >= vals[0];
            netWorthChartInst.current.data.datasets[0].borderColor = isUp ? '#10b981' : '#f43f5e';
            netWorthChartInst.current.data.datasets[0].backgroundColor = isUp ? 'rgba(16,185,129,0.07)' : 'rgba(244,63,94,0.07)';
        }
        netWorthChartInst.current.options.scales.x.grid.color = tc.gridColor;
        netWorthChartInst.current.options.scales.x.ticks.color = tc.tickColor;
        netWorthChartInst.current.options.scales.y.grid.color = tc.gridColor;
        netWorthChartInst.current.options.scales.y.ticks.color = tc.tickColor;
        netWorthChartInst.current.update('none');

        const nw = calcNetWorth(state);
        const labels2 = ['Cash'];
        const vals2   = [parseFloat(((state.cash / nw) * 100).toFixed(2))];
        const colors = [tc.cashColor];
        let i = 0;
        for (const [sym, h] of Object.entries(state.holdings)) {
            const mv  = h.shares * state.prices[sym];
            const pct = parseFloat(((mv / nw) * 100).toFixed(2));
            labels2.push(sym);
            vals2.push(pct);
            colors.push(CHART_COLORS[i++ % CHART_COLORS.length]);
        }
        allocChartInst.current.data.labels = labels2;
        allocChartInst.current.data.datasets[0].data = vals2;
        allocChartInst.current.data.datasets[0].backgroundColor = colors;
        allocChartInst.current.data.datasets[0].borderColor = colors.map(() => tc.bgColor);
        allocChartInst.current.update('none');

    }, [state, activeSection, chartFromDay, chartToDay, theme]);

    // Trade preview calculations
    const curPrice = state.prices[tradeSymbol] || 0;
    const curCost = curPrice * tradeQty;
    const curFee = curCost * FEE_RATE;
    const curTotal = orderType === 'BUY' ? curCost + curFee : curCost - curFee;

    const allocLegendInfo = () => {
        const nw = calcNetWorth(state);
        const items = [{ lab: 'Cash', val: parseFloat(((state.cash / nw) * 100).toFixed(2)), col: getThemeColors().cashColor }];
        let i = 0;
        for (const [sym, h] of Object.entries(state.holdings)) {
            const mv = h.shares * state.prices[sym];
            items.push({ lab: sym, val: parseFloat(((mv / nw) * 100).toFixed(2)), col: CHART_COLORS[i++ % CHART_COLORS.length] });
        }
        return items;
    };

    if (!isDataLoaded) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(6, 182, 212, 0.2)', borderTopColor: 'var(--accent-cyan)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '1rem' }}></div>
                <p style={{ fontWeight: 500, letterSpacing: '0.05em' }}>SYNCING MARKET DATA...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <div className="main-container" style={{display: 'flex', minHeight: '100vh', width: '100%'}}>
            {/* SIDEBAR */}
            <aside className="sidebar" id="sidebar">
                <div className="sidebar-logo">
                    <span className="logo-icon-s">◈</span>
                    <span className="logo-text">StockSim</span>
                </div>
                <nav className="sidebar-nav">
                    {['overview', 'trade', 'portfolio', 'ledger', 'heatmap', 'achievements'].map(sec => (
                        <a key={sec} href={`#${sec}`} className={`nav-item ${activeSection === sec ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveSection(sec); }}>
                            <span className="nav-icon">
                                {sec === 'overview' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
                                {sec === 'trade' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6"/></svg>}
                                {sec === 'portfolio' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
                                {sec === 'ledger' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>}
                                {sec === 'heatmap' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
                                {sec === 'achievements' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>}
                            </span>
                            <span style={{textTransform: 'capitalize'}}>{sec}</span>
                        </a>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    {user?.role !== 'admin' && (
                        <Link to="/home" className="nav-item home-btn">
                            <span className="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>
                            <span>Home</span>
                        </Link>
                    )}
                    <a href="#" className="nav-item logout-btn" onClick={(e) => { e.preventDefault(); logout(); }}>
                        <span className="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></span>
                        <span>Log Out</span>
                    </a>
                </div>
            </aside>

            {/* MAIN AREA */}
            <div className="main-content">
                <header className="topbar">
                    <div className="topbar-left">
                        <div className="day-badge">
                            <span className="day-label">Day</span>
                            <span className="day-number">{state.currentDay}</span>
                        </div>
                        <div className="topbar-date" style={{fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '0.5rem'}}>
                            {formatDateDisplay(state.currentDate || marketRange.min)}
                        </div>
                        <div className="topbar-metrics">
                            <div className="topbar-metric"><span className="tm-label">Net Worth</span><span className="tm-value">{fmt(calcNetWorth(state))}</span></div>
                            <div className="metric-sep"></div>
                            <div className="topbar-metric"><span className="tm-label">Cash</span><span className="tm-value">{fmt(state.cash)}</span></div>
                            <div className="metric-sep"></div>
                            <div className="topbar-metric"><span className="tm-label">Day P&L</span><span className={`tm-value ${state.dayPnl >= 0 ? 'up' : 'down'}`}>{fmtSigned(state.dayPnl)}</span></div>
                            <div className="metric-sep"></div>
                            <div className="topbar-metric"><span className="tm-label">Streak</span><span className="tm-value streak-val">{state.currentStreak} 🔥</span></div>
                        </div>
                    </div>
                    <div className="topbar-right">
                        <button className="btn-theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Toggle light/dark mode">
                            {theme === 'dark' ? 
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                              : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                            }
                        </button>
                        <button className="btn-undo" onClick={undoLast} disabled={stateHistory.length === 0}>↩ Undo</button>
                        <button className="btn-next-day" onClick={advanceDay}>Next Day →</button>
                    </div>
                </header>

                <div className={`notification ${notification.isError ? 'error' : ''} ${!notification.visible ? 'hidden' : ''}`}>
                    <span>{notification.text}</span>
                </div>

                {/* OVERVIEW */}
                <section className={`section ${activeSection === 'overview' ? 'active' : ''}`}>
                    <div className="section-title">Overview</div>
                    <div className="date-range-bar">
                        <label>From Day</label>
                        <input type="number" className="date-input" min="0" value={chartFromDay} onChange={e => setChartFromDay(Math.max(0, parseInt(e.target.value)||0))} />
                        <label>To Day</label>
                        <input type="number" className="date-input" min="1" value={chartToDay === null ? Math.max(1, state.currentDay - 1) : chartToDay} onChange={e => setChartToDay(Math.max(chartFromDay, parseInt(e.target.value)||1))} />
                        <button className="btn-reset-range" onClick={() => { setChartFromDay(0); setChartToDay(null); }}>Reset</button>
                    </div>
                    <div className="overview-grid">
                        <div className="card card-chart">
                            <div className="card-header">
                                <h3>Net Worth Over Time</h3>
                                <span className="card-badge">{chartToDay === null ? 'All Time' : `Day ${chartFromDay} → Day ${chartToDay}`}</span>
                            </div>
                            <div className="chart-container"><canvas ref={nwChartRef}></canvas></div>
                        </div>
                        <div className="card card-allocation">
                            <div className="card-header"><h3>Portfolio Allocation</h3></div>
                            <div className="alloc-container"><canvas ref={allocChartRef}></canvas></div>
                            <div className="alloc-legend">
                                {allocLegendInfo().map((item, idx) => (
                                    <div key={idx} className="alloc-legend-item"><span className="al-dot" style={{background: item.col}}></span>{item.lab} {item.val}%</div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="stats-row">
                        {(() => {
                            const ret = calcNetWorth(state) - START_CASH;
                            const pct = ((ret / START_CASH) * 100).toFixed(2);
                            return (
                                <>
                                <div className="stat-card">
                                    <div className="stat-card-label">Total Return</div>
                                    <div className={`stat-card-value ${ret >= 0 ? 'up':'down'}`}>{fmtSigned(ret)}</div>
                                    <div className="stat-card-sub">{(ret >= 0 ? '+' : '') + pct + '%'}</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card-label">Best Day</div><div className="stat-card-value up">{fmtSigned(state.bestDay)}</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card-label">Worst Day</div><div className="stat-card-value down">{fmtSigned(state.worstDay)}</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card-label">Total Trades</div><div className="stat-card-value">{state.transactions.length}</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card-label">Fees Paid</div><div className="stat-card-value">{fmt(state.totalFees)}</div>
                                </div>
                                </>
                            )
                        })()}
                    </div>
                </section>

                {/* TRADE */}
                <section className={`section ${activeSection === 'trade' ? 'active' : ''}`}>
                    <div className="section-title">Trade Stocks</div>
                    <div className="card time-travel-card" style={{marginBottom: '1.5rem'}}>
                        <div className="card-header"><h3>Simulation Period</h3></div>
                        <div className="date-selection-group" style={{display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap'}}>
                            <div className="form-row" style={{flex: 1, minWidth: '200px', marginBottom: 0}}>
                                <label>Start Date</label>
                                <input type="date" className="trade-input" value={simStartDate} min={marketRange.min} max={new Date().toISOString().split('T')[0]} onChange={e => setSimStartDate(e.target.value)} />
                            </div>
                            <div className="form-row" style={{flex: 1, minWidth: '200px', marginBottom: 0}}>
                                <label>End Date</label>
                                <input type="date" className="trade-input" value={simEndDate} min={marketRange.min} max={new Date().toISOString().split('T')[0]} onChange={e => setSimEndDate(e.target.value)} />
                            </div>
                            <button className="btn-execute" onClick={startSimulation} style={{width: 'auto', padding: '0.75rem 2rem'}}>Start Simulation</button>
                        </div>
                        <p className="trade-note" style={{marginTop: '0.5rem', textAlign: 'left'}}>{simWarn}</p>
                    </div>

                    <div className="trade-layout">
                        <div className="card trade-card">
                            <div className="card-header"><h3>Place an Order</h3></div>
                            <div className="trade-form">
                                <div className="form-row">
                                    <label>Stock Symbol</label>
                                    <select className="trade-input" value={tradeSymbol} onChange={e => setTradeSymbol(e.target.value)}>
                                        {Object.keys(STOCKS).map(sym => <option key={sym} value={sym}>{sym} – {STOCKS[sym].name}</option>)}
                                    </select>
                                </div>
                                <div className="form-row">
                                    <label>Order Type</label>
                                    <div className="order-type-toggle">
                                        <button className={`ot-btn ${orderType === 'BUY' ? 'active buy-active' : ''}`} onClick={() => setOrderType('BUY')}>BUY</button>
                                        <button className={`ot-btn ${orderType === 'SELL' ? 'active sell-active' : ''}`} onClick={() => setOrderType('SELL')}>SELL</button>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <label>Quantity</label>
                                    <input type="number" className="trade-input" min="1" value={tradeQty} onChange={e => setTradeQty(parseInt(e.target.value)||0)} placeholder="Number of shares" />
                                </div>
                                <div className="trade-info-box">
                                    <div className="tib-row"><span>Current Price</span><span>{fmt(curPrice)}</span></div>
                                    <div className="tib-row"><span>Estimated Cost</span><span>{fmt(curCost)}</span></div>
                                    <div className="tib-row fee-row"><span>Transaction Fee (0.5%)</span><span>{fmt(curFee)}</span></div>
                                    <div className="tib-row total-row"><span>Total</span><span>{fmt(curTotal)}</span></div>
                                </div>
                                <button className="btn-execute" onClick={executeTrade}>{orderType === 'BUY' ? 'Execute Buy Order' : 'Execute Sell Order'}</button>
                                <p className="trade-note">{tradeWarn}</p>
                            </div>
                        </div>
                        <div className="card market-card">
                            <div className="card-header">
                                <h3>Market Prices <span className="day-tag">{formatDateDisplay(state.currentDate || marketRange.min)}</span></h3>
                            </div>
                            <table className="market-table">
                                <thead><tr><th>Symbol</th><th>Price</th><th>Day Chg</th><th>You Hold</th></tr></thead>
                                <tbody>
                                    {Object.entries(STOCKS).map(([sym, _]) => {
                                        const cur = state.prices[sym];
                                        const prev = state.prevPrices[sym];
                                        
                                        // If price is missing (NA), show NA instead of calculation
                                        const hasData = cur !== undefined && cur !== null && cur !== 0;
                                        const chg = hasData ? (cur - (prev || cur)) : 0;
                                        const pct = (hasData && prev) ? ((chg / prev) * 100).toFixed(2) : "0.00";
                                        const held = state.holdings[sym]?.shares || 0;
                                        
                                        return (
                                            <tr key={sym}>
                                                <td className="ticker-cell">{sym}</td>
                                                <td>{hasData ? fmt(cur) : "NA"}</td>
                                                <td className={hasData ? (chg >= 0 ? 'up' : 'down') : ''}>
                                                    {hasData ? (chg >= 0 ? '+' : '') + pct + '%' : "NA"}
                                                </td>
                                                <td>{held > 0 ? `${held} shares` : '—'}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* PORTFOLIO */}
                <section className={`section ${activeSection === 'portfolio' ? 'active' : ''}`}>
                    <div className="section-title">Holdings</div>
                    <div className="card">
                        <div className="card-header"><h3>Current Holdings</h3></div>
                        <table className="ledger-table">
                            <thead><tr><th>Symbol</th><th>Shares</th><th>Avg Cost</th><th>Current Price</th><th>Market Value</th><th>Gain / Loss</th><th>Return %</th></tr></thead>
                            <tbody>
                                {Object.keys(state.holdings).length === 0 ? (
                                    <tr className="empty-row"><td colSpan="7">No holdings yet. Go to Trade to buy your first stock!</td></tr>
                                ) : Object.entries(state.holdings).map(([sym, h]) => {
                                    const cur = state.prices[sym];
                                    const mv = cur * h.shares;
                                    const gl = mv - h.avgCost * h.shares;
                                    const glPct = ((gl / (h.avgCost * h.shares)) * 100).toFixed(2);
                                    const up = gl >= 0 ? 'up' : 'down';
                                    return (
                                        <tr key={sym}>
                                            <td className="ticker-cell">{sym}</td>
                                            <td>{h.shares}</td>
                                            <td>{fmt(h.avgCost)}</td>
                                            <td>{fmt(cur)}</td>
                                            <td>{fmt(mv)}</td>
                                            <td className={up}>{fmtSigned(gl)}</td>
                                            <td className={up}>{gl >= 0 ? '+' : ''}{glPct}%</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* LEDGER */}
                <section className={`section ${activeSection === 'ledger' ? 'active' : ''}`}>
                    <div className="section-title">Transaction Ledger</div>
                    <div className="card">
                        <div className="card-header">
                            <h3>Trade History</h3>
                            <button className="btn-undo-ledger" onClick={undoLast} disabled={stateHistory.length === 0}>↩ Undo Last Trade</button>
                        </div>
                                <table className="ledger-table">
                                    <thead><tr><th>#</th><th>Date</th><th>Type</th><th>Symbol</th><th>Qty</th><th>Price</th><th>Fee</th><th>Total</th></tr></thead>
                                    <tbody>
                                        {state.transactions.length === 0 ? <tr className="empty-row"><td colSpan="8">No transactions yet.</td></tr> :
                                         [...state.transactions].reverse().map(t => (
                                            <tr key={t.id} style={t.isUndone ? { opacity: 0.5, textDecoration: 'line-through' } : {}}>
                                                <td>{t.id}</td>
                                                <td style={{fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)'}}>
                                                    {formatDateDisplay(t.simDate || getFallbackDate(t.day, marketRange.min))}
                                                </td>
                                                <td className={`ledger-${t.type.toLowerCase()}`}>{t.isUndone ? 'UNDONE' : t.type}</td>
                                                <td className="ticker-cell">{t.sym}</td>
                                                <td>{t.qty}</td>
                                                <td>{fmt(t.price)}</td>
                                                <td>{fmt(t.fee)}</td>
                                                <td className={t.total < 0 ? 'down' : 'up'}>{fmtSigned(t.total)}</td>
                                            </tr>
                                         ))}
                                    </tbody>
                                </table>
                    </div>
                </section>

                {/* HEATMAP */}
                <section className={`section ${activeSection === 'heatmap' ? 'active' : ''}`}>
                    <div className="section-title">Calendar Heatmap</div>
                    <div className="card">
                        <div className="card-header">
                            <h3>Daily Gain / Loss</h3>
                            <div className="heatmap-legend">
                                <span className="hl-item"><span className="hl-box loss-3"></span> Big Loss</span>
                                <span className="hl-item"><span className="hl-box loss-1"></span> Small Loss</span>
                                <span className="hl-item"><span className="hl-box neutral"></span> Flat</span>
                                <span className="hl-item"><span className="hl-box gain-1"></span> Small Gain</span>
                                <span className="hl-item"><span className="hl-box gain-3"></span> Big Gain</span>
                            </div>
                        </div>
                        <div className="heatmap-grid">
                            {state.currentDay - 1 === 0 ? <span style={{color:'#475569',fontSize:'0.85rem'}}>Advance days to build the heatmap.</span> :
                             Array.from({length: state.currentDay - 1}, (_, i) => i + 1).map(d => {
                                 const pnl = state.dayPnlHistory.find(h => h.day === d)?.pnl || 0;
                                 let cls = 'neutral';
                                 if (pnl > 200) cls = 'gain-3'; else if (pnl > 50) cls = 'gain-2'; else if (pnl > 0) cls = 'gain-1';
                                 else if (pnl < -200) cls = 'loss-3'; else if (pnl < -50) cls = 'loss-2'; else if (pnl < 0) cls = 'loss-1';
                                 return (
                                     <div key={d} className={`hmap-cell ${cls}`} data-day={d}>
                                         <div className="hmap-tooltip">Day {d}: {fmtSigned(pnl)}</div>{d}
                                     </div>
                                 )
                             })
                            }
                        </div>
                        <p className="heatmap-note">Each cell represents one simulated day. Hover for details.</p>
                    </div>
                </section>

                {/* ACHIEVEMENTS */}
                <section className={`section ${activeSection === 'achievements' ? 'active' : ''}`}>
                    <div className="section-title">Achievements & Badges</div>
                    <div className="achievements-intro">
                        <span>{state.unlockedAchievements.length}</span> of <span>{ACHIEVEMENTS_DEF.length}</span> badges unlocked
                    </div>
                    <div className="achievements-grid">
                        {ACHIEVEMENTS_DEF.map(ach => {
                            const isUnlocked = state.unlockedAchievements.includes(ach.id);
                            return (
                                <div key={ach.id} className={`achievement-card ${isUnlocked ? 'unlocked' : 'ach-locked'}`}>
                                    <div className="ach-icon">{ach.icon}</div>
                                    <div className="ach-info">
                                        <div className="ach-name">{ach.name}</div>
                                        <div className="ach-desc">{ach.desc}</div>
                                        <div className="ach-tag">{isUnlocked ? '✓ Unlocked' : 'Locked'}</div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    <div className="streak-panel">
                        <div className="streak-info">
                            <div className="streak-fire">🔥</div>
                            <div>
                                <div className="streak-num">{state.currentStreak}</div>
                                <div className="streak-label-big">Day Profit Streak</div>
                            </div>
                        </div>
                        <div className="streak-best">Best: <strong>{state.bestStreak} days</strong></div>
                    </div>
                </section>
            </div>
        </div>
    );
}
