// ============================================================
//  StockSim Dashboard — dashboard.js
//  State Management, Trading, Charts, Heatmap, Achievements
// ============================================================

// ── INITIAL STOCK DATA ──────────────────────────────────────
const STOCKS = {
    AAPL:  { name: "Apple Inc.",       price: 178.50  },
    TSLA:  { name: "Tesla Inc.",       price: 245.30  },
    NVDA:  { name: "NVIDIA Corp.",     price: 485.80  },
    MSFT:  { name: "Microsoft Corp.",  price: 375.20  },
    GOOGL: { name: "Alphabet Inc.",    price: 140.60  },
    AMZN:  { name: "Amazon.com",       price: 175.40  },
    META:  { name: "Meta Platforms",   price: 318.90  },
    NFLX:  { name: "Netflix Inc.",     price: 432.10  },
    AMD:   { name: "AMD Inc.",         price: 156.30  },
    PYPL:  { name: "PayPal Holdings",  price: 64.20   },
};

const FEE_RATE   = 0.005; // 0.5% per trade
const START_CASH = 10000; // ₹10,000 starting cash
const CURRENCY   = '₹';

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

// ── STATE ────────────────────────────────────────────────────
let state = buildInitialState();
let stateHistory = [];      // for undo
let orderType = 'BUY';

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

// ── DATE LOGIC ───────────────────────────────────────────────
function advanceDateStr(dateStr) {
    const d = new Date(dateStr);
    do {
        d.setDate(d.getDate() + 1);
    } while (d.getDay() === 0 || d.getDay() === 6); // skip weekends
    return d.toISOString().split('T')[0];
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return "Not Started";
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── HELPERS ──────────────────────────────────────────────────
function calcNetWorth(s) {
    let total = s.cash;
    for (const [sym, h] of Object.entries(s.holdings)) {
        total += h.shares * (s.prices[sym] || 0);
    }
    return total;
}

function fmt(n, decimals = 2) {
    return CURRENCY + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtSigned(n) {
    return (n >= 0 ? '+' : '−') + fmt(Math.abs(n));
}

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

function showNotification(msg, isError = false) {
    const el = document.getElementById('notification');
    el.textContent = msg;
    el.className = 'notification' + (isError ? ' error' : '');
    clearTimeout(window._notifTimer);
    window._notifTimer = setTimeout(() => el.classList.add('hidden'), 3500);
}

// Save state to localStorage so home.html can read quick stats
function persistState() {
    try {
        localStorage.setItem('stocksim-state', JSON.stringify({
            currentDay: state.currentDay,
            cash: state.cash,
            holdings: state.holdings,
            prices: state.prices,
            currentStreak: state.currentStreak,
            transactions: state.transactions,
        }));
    } catch(e) {}
}

// ── ADVANCE DAY ─────────────────────────────────────────────
function advanceDay() {
    if (state.isSimActive && state.currentDate) {
        if (state.currentDate >= state.simEndDate) {
            showNotification('Simulation ended! You reached your selected end date.', true);
            return;
        }
        state.currentDate = advanceDateStr(state.currentDate);
    }

    pushHistory();
    const prevNW = calcNetWorth(state);

    // Randomize prices
    for (const sym of Object.keys(state.prices)) {
        const change = (Math.random() - 0.475) * 0.065; // slight upward bias
        state.prevPrices[sym] = state.prices[sym];
        state.prices[sym] = parseFloat((state.prices[sym] * (1 + change)).toFixed(2));
    }

    const newNW = calcNetWorth(state);
    const dayPnl = parseFloat((newNW - prevNW).toFixed(2));
    state.dayPnl = dayPnl;
    state.dayPnlHistory.push({ day: state.currentDay, pnl: dayPnl });

    // Streak
    if (dayPnl > 0) {
        state.currentStreak++;
        if (state.currentStreak > state.bestStreak) state.bestStreak = state.currentStreak;
    } else {
        state.currentStreak = 0;
    }

    state.bestDay  = Math.max(state.bestDay, dayPnl);
    state.worstDay = Math.min(state.worstDay, dayPnl);

    state.currentDay++;
    state.netWorthHistory.push({ day: state.currentDay - 1, value: newNW });

    // Update date-to input max
    const toInput = document.getElementById('date-to');
    if (toInput) toInput.max = state.currentDay - 1;

    checkAchievements();
    renderAll();
    persistState();

    const dateStr = state.isSimActive ? formatDateDisplay(state.currentDate) : `Day ${state.currentDay}`;
    const msg = dayPnl >= 0
        ? `📅 ${dateStr} — Portfolio up ${fmtSigned(dayPnl)} today!`
        : `📅 ${dateStr} — Portfolio down ${fmtSigned(dayPnl)} today.`;
    showNotification(msg, dayPnl < 0);
}

// ── START SIMULATION ────────────────────────────────────────
function startSimulation() {
    const startStr = document.getElementById('sim-start-date').value;
    const endStr   = document.getElementById('sim-end-date').value;
    const warn     = document.getElementById('sim-warn');

    if (!startStr || !endStr) {
        warn.textContent = "Please select both start and end dates.";
        return;
    }

    const start = new Date(startStr);
    const end   = new Date(endStr);

    if (start >= end) {
        warn.textContent = "Start date must be before end date.";
        return;
    }

    if (start.getDay() === 0 || start.getDay() === 6) {
        warn.textContent = "Start date cannot be on a weekend.";
        return;
    }

    // Reset simulation but preserve some UI states
    state = buildInitialState();
    stateHistory = [];
    state.simStartDate = startStr;
    state.simEndDate   = endStr;
    state.currentDate  = startStr;
    state.isSimActive  = true;

    warn.textContent = "Simulation started successfully!";
    setTimeout(() => { warn.textContent = ''; }, 3000);

    // Also reset UI inputs
    resetDateRange();
    
    renderAll();
    persistState();
}

// ── TRADE EXECUTION ─────────────────────────────────────────
function executeTrade() {
    const sym = document.getElementById('trade-symbol').value;
    const qty = parseInt(document.getElementById('trade-qty').value, 10);

    if (!sym || !qty || qty < 1) {
        document.getElementById('trade-warn').textContent = 'Please enter a valid quantity.';
        return;
    }

    const price = state.prices[sym];
    const cost  = price * qty;
    const fee   = parseFloat((cost * FEE_RATE).toFixed(2));

    if (orderType === 'BUY') {
        const total = cost + fee;
        if (total > state.cash) {
            document.getElementById('trade-warn').textContent = `Not enough cash. You need ${fmt(total)} but have ${fmt(state.cash)}.`;
            return;
        }
        pushHistory();
        state.cash = parseFloat((state.cash - total).toFixed(2));
        if (!state.holdings[sym]) state.holdings[sym] = { shares: 0, avgCost: 0 };
        const h = state.holdings[sym];
        const totalCost = h.shares * h.avgCost + cost;
        h.shares  += qty;
        h.avgCost  = parseFloat((totalCost / h.shares).toFixed(4));

    } else { // SELL
        if (!state.holdings[sym] || state.holdings[sym].shares < qty) {
            document.getElementById('trade-warn').textContent = `You don't hold enough ${sym} shares.`;
            return;
        }
        pushHistory();
        const h = state.holdings[sym];
        const proceeds = cost - fee;
        const costBasis = h.avgCost * qty;
        if (proceeds > costBasis) state.hasSoldForProfit = true;
        state.cash = parseFloat((state.cash + proceeds).toFixed(2));
        h.shares -= qty;
        if (h.shares === 0) delete state.holdings[sym];
    }

    state.transactions.push({
        id:    state.transactions.length + 1,
        day:   state.currentDay,
        type:  orderType,
        sym,
        qty,
        price: parseFloat(price.toFixed(2)),
        fee,
        total: orderType === 'BUY' ? -(cost + fee) : (cost - fee),
    });
    state.totalFees = parseFloat((state.totalFees + fee).toFixed(2));
    document.getElementById('trade-warn').textContent = '';
    document.getElementById('trade-qty').value = 1;

    checkAchievements();
    renderAll();
    persistState();
    showNotification(`✅ ${orderType} ${qty} × ${sym} @ ${fmt(price)} — Fee: ${fmt(fee)}`);
}

// ── UNDO ─────────────────────────────────────────────────────
function pushHistory() {
    stateHistory.push(deepClone(state));
    if (stateHistory.length > 50) stateHistory.shift();
}

function undoLast() {
    if (stateHistory.length === 0) return;
    state = stateHistory.pop();
    checkAchievements();
    renderAll();
    persistState();
    showNotification('↩ Last action undone.');
}

// ── ACHIEVEMENTS ─────────────────────────────────────────────
function checkAchievements() {
    for (const ach of ACHIEVEMENTS_DEF) {
        if (!state.unlockedAchievements.includes(ach.id) && ach.check(state)) {
            state.unlockedAchievements.push(ach.id);
            showNotification(`🏅 Achievement unlocked: "${ach.name}"!`);
        }
    }
}

// ── CHART SETUP ──────────────────────────────────────────────
let netWorthChart = null;
let allocChart    = null;

const CHART_COLORS = [
    '#06b6d4','#10b981','#f59e0b','#8b5cf6','#f43f5e',
    '#3b82f6','#ec4899','#14b8a6','#a78bfa','#fbbf24'
];

function getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    return {
        gridColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
        tickColor: isDark ? '#475569' : '#94a3b8',
        bgColor:   isDark ? '#0a0f1a' : '#f1f5f9',
        cashColor: isDark ? '#334155' : '#cbd5e1',
    };
}

function initCharts() {
    const tc = getThemeColors();
    const nwCtx = document.getElementById('netWorthChart').getContext('2d');
    netWorthChart = new Chart(nwCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Net Worth', data: [],
                borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.07)',
                borderWidth: 2.5, pointRadius: 3, pointHoverRadius: 6, fill: true, tension: 0.4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ' ' + CURRENCY + ctx.parsed.y.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) } }
            },
            scales: {
                x: { grid: { color: tc.gridColor }, ticks: { color: tc.tickColor, font: { size: 11 } } },
                y: { grid: { color: tc.gridColor }, ticks: { color: tc.tickColor, font: { size: 11 }, callback: v => CURRENCY + (v/1000).toFixed(0) + 'k' } }
            }
        }
    });

    const acCtx = document.getElementById('allocChart').getContext('2d');
    allocChart = new Chart(acCtx, {
        type: 'doughnut',
        data: { labels: ['Cash'], datasets: [{ data: [100], backgroundColor: [tc.cashColor], borderColor: tc.bgColor, borderWidth: 2, hoverOffset: 6 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed.toFixed(1)}%` } } },
            cutout: '68%',
        }
    });
}

// ── DATE RANGE FILTER ────────────────────────────────────────
let chartFromDay = 0;
let chartToDay   = null; // null = all time

function applyDateRange() {
    const fromVal = parseInt(document.getElementById('date-from').value, 10);
    const toVal   = parseInt(document.getElementById('date-to').value, 10);
    if (!isNaN(fromVal)) chartFromDay = Math.max(0, fromVal);
    if (!isNaN(toVal))   chartToDay   = Math.max(chartFromDay, toVal);
    const badge = document.getElementById('perf-badge');
    badge.textContent = `Day ${chartFromDay} → Day ${chartToDay ?? state.currentDay - 1}`;
    renderCharts();
}

function resetDateRange() {
    chartFromDay = 0;
    chartToDay   = null;
    document.getElementById('date-from').value = 0;
    document.getElementById('date-to').value   = Math.max(1, state.currentDay - 1);
    document.getElementById('perf-badge').textContent = 'All Time';
    renderCharts();
}

// ── RENDER ───────────────────────────────────────────────────
function renderAll() {
    renderTopbar();
    renderMarket();
    renderHoldings();
    renderLedger();
    renderCharts();
    renderHeatmap();
    renderAchievements();
    renderStats();
    updateUndoBtns();
    // Update date-to max to current max day
    const toInput = document.getElementById('date-to');
    if (toInput && chartToDay === null) toInput.value = Math.max(1, state.currentDay - 1);
}

function renderTopbar() {
    document.getElementById('day-number').textContent   = state.currentDay;
    
    const realDateEl = document.getElementById('topbar-real-date');
    if (realDateEl) {
        realDateEl.textContent = state.isSimActive ? formatDateDisplay(state.currentDate) : 'Not Started';
    }

    document.getElementById('market-day').textContent   = state.isSimActive ? formatDateDisplay(state.currentDate) : state.currentDay;
    
    const nw = calcNetWorth(state);
    document.getElementById('net-worth').textContent    = fmt(nw);
    document.getElementById('cash-balance').textContent = fmt(state.cash);
    const pnlEl = document.getElementById('day-pnl');
    pnlEl.textContent = fmtSigned(state.dayPnl);
    pnlEl.className   = 'tm-value ' + (state.dayPnl >= 0 ? 'up' : 'down');
    document.getElementById('streak-display').textContent = state.currentStreak + ' 🔥';
}

function renderMarket() {
    const tbody = document.getElementById('market-tbody');
    tbody.innerHTML = '';
    for (const [sym, data] of Object.entries(STOCKS)) {
        const cur  = state.prices[sym];
        const prev = state.prevPrices[sym];
        const chg  = cur - prev;
        const pct  = ((chg / prev) * 100).toFixed(2);
        const held = state.holdings[sym] ? state.holdings[sym].shares : 0;
        const upDown = chg >= 0 ? 'up' : 'down';
        tbody.innerHTML += `<tr>
            <td class="ticker-cell">${sym}</td>
            <td>${fmt(cur)}</td>
            <td class="${upDown}">${chg >= 0 ? '+' : ''}${pct}%</td>
            <td>${held > 0 ? held + ' shares' : '—'}</td>
        </tr>`;
    }
}

function renderHoldings() {
    const tbody = document.getElementById('holdings-tbody');
    if (Object.keys(state.holdings).length === 0) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No holdings yet. Go to Trade to buy your first stock!</td></tr>`;
        return;
    }
    tbody.innerHTML = '';
    for (const [sym, h] of Object.entries(state.holdings)) {
        const cur   = state.prices[sym];
        const mv    = cur * h.shares;
        const gl    = mv - h.avgCost * h.shares;
        const glPct = ((gl / (h.avgCost * h.shares)) * 100).toFixed(2);
        const up    = gl >= 0 ? 'up' : 'down';
        tbody.innerHTML += `<tr>
            <td class="ticker-cell">${sym}</td>
            <td>${h.shares}</td>
            <td>${fmt(h.avgCost)}</td>
            <td>${fmt(cur)}</td>
            <td>${fmt(mv)}</td>
            <td class="${up}">${fmtSigned(gl)}</td>
            <td class="${up}">${gl >= 0 ? '+' : ''}${glPct}%</td>
        </tr>`;
    }
}

function renderLedger() {
    const tbody = document.getElementById('ledger-tbody');
    if (state.transactions.length === 0) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No transactions yet.</td></tr>`;
        return;
    }
    tbody.innerHTML = '';
    for (const t of [...state.transactions].reverse()) {
        tbody.innerHTML += `<tr>
            <td>${t.id}</td>
            <td>Day ${t.day}</td>
            <td class="ledger-${t.type.toLowerCase()}">${t.type}</td>
            <td class="ticker-cell">${t.sym}</td>
            <td>${t.qty}</td>
            <td>${fmt(t.price)}</td>
            <td>${fmt(t.fee)}</td>
            <td class="${t.total < 0 ? 'down' : 'up'}">${fmtSigned(t.total)}</td>
        </tr>`;
    }
}

function renderCharts() {
    // Apply date range filter
    let history = state.netWorthHistory;
    const maxDay = chartToDay !== null ? chartToDay : Infinity;
    history = history.filter(h => h.day >= chartFromDay && h.day <= maxDay);

    const labels = history.map(h => 'D' + h.day);
    const vals   = history.map(h => h.value);
    netWorthChart.data.labels   = labels;
    netWorthChart.data.datasets[0].data = vals;
    if (vals.length >= 2) {
        const isUp = vals[vals.length - 1] >= vals[0];
        netWorthChart.data.datasets[0].borderColor     = isUp ? '#10b981' : '#f43f5e';
        netWorthChart.data.datasets[0].backgroundColor = isUp ? 'rgba(16,185,129,0.07)' : 'rgba(244,63,94,0.07)';
    }
    netWorthChart.update('none');

    // Allocation pie chart
    const nw    = calcNetWorth(state);
    const labels2 = ['Cash'];
    const vals2   = [parseFloat(((state.cash / nw) * 100).toFixed(2))];
    const tc = getThemeColors();
    const colors = [tc.cashColor];
    let i = 0;
    for (const [sym, h] of Object.entries(state.holdings)) {
        const mv  = h.shares * state.prices[sym];
        const pct = parseFloat(((mv / nw) * 100).toFixed(2));
        labels2.push(sym);
        vals2.push(pct);
        colors.push(CHART_COLORS[i++ % CHART_COLORS.length]);
    }
    allocChart.data.labels                         = labels2;
    allocChart.data.datasets[0].data              = vals2;
    allocChart.data.datasets[0].backgroundColor   = colors;
    allocChart.data.datasets[0].borderColor       = colors.map(() => tc.bgColor);
    allocChart.update('none');

    // Legend
    const legend = document.getElementById('alloc-legend');
    legend.innerHTML = labels2.map((l, idx) =>
        `<div class="alloc-legend-item"><span class="al-dot" style="background:${colors[idx]}"></span>${l} ${vals2[idx]}%</div>`
    ).join('');
}

function renderHeatmap() {
    const grid = document.getElementById('heatmap-grid');
    grid.innerHTML = '';

    const totalDays = state.currentDay - 1;
    if (totalDays === 0) {
        grid.innerHTML = '<span style="color:#475569;font-size:0.85rem;">Advance days to build the heatmap.</span>';
        return;
    }

    for (let d = 1; d <= totalDays; d++) {
        const entry = state.dayPnlHistory.find(h => h.day === d);
        const pnl   = entry ? entry.pnl : 0;
        let cls = 'neutral';
        const abs = Math.abs(pnl);
        if (pnl > 200)       cls = 'gain-3';
        else if (pnl > 50)   cls = 'gain-2';
        else if (pnl > 0)    cls = 'gain-1';
        else if (pnl < -200) cls = 'loss-3';
        else if (pnl < -50)  cls = 'loss-2';
        else if (pnl < 0)    cls = 'loss-1';

        const sign   = pnl >= 0 ? '+' : '−';
        const amtStr = abs >= 1000 ? sign + CURRENCY + (abs/1000).toFixed(1) + 'k' : sign + CURRENCY + abs.toFixed(0);
        const cell = document.createElement('div');
        cell.className = `hmap-cell ${cls}`;
        cell.dataset.day = d;
        cell.innerHTML = `<div class="hmap-tooltip">Day ${d}: ${fmtSigned(pnl)}</div>${d}`;
        grid.appendChild(cell);
    }
}

function renderAchievements() {
    const grid  = document.getElementById('achievements-grid');
    const total = ACHIEVEMENTS_DEF.length;
    const unlocked = state.unlockedAchievements.length;

    document.getElementById('badges-unlocked').textContent = unlocked;
    document.getElementById('badges-total').textContent    = total;
    document.getElementById('streak-big').textContent      = state.currentStreak;
    document.getElementById('streak-best').textContent     = state.bestStreak + ' days';

    grid.innerHTML = '';
    for (const ach of ACHIEVEMENTS_DEF) {
        const isUnlocked = state.unlockedAchievements.includes(ach.id);
        grid.innerHTML += `<div class="achievement-card ${isUnlocked ? 'unlocked' : 'ach-locked'}">
            <div class="ach-icon">${ach.icon}</div>
            <div class="ach-info">
                <div class="ach-name">${ach.name}</div>
                <div class="ach-desc">${ach.desc}</div>
                <div class="ach-tag">${isUnlocked ? '✓ Unlocked' : 'Locked'}</div>
            </div>
        </div>`;
    }
}

function renderStats() {
    const nw  = calcNetWorth(state);
    const ret = nw - START_CASH;
    const pct = ((ret / START_CASH) * 100).toFixed(2);
    document.getElementById('total-return').textContent     = fmtSigned(ret);
    document.getElementById('total-return').className       = 'stat-card-value ' + (ret >= 0 ? 'up' : 'down');
    document.getElementById('total-return-pct').textContent = (ret >= 0 ? '+' : '') + pct + '%';
    document.getElementById('best-day').textContent         = fmtSigned(state.bestDay);
    document.getElementById('best-day').className           = 'stat-card-value up';
    document.getElementById('worst-day').textContent        = fmtSigned(state.worstDay);
    document.getElementById('worst-day').className          = 'stat-card-value down';
    document.getElementById('total-trades').textContent     = state.transactions.length;
    document.getElementById('fees-paid').textContent        = fmt(state.totalFees);
}

function updateUndoBtns() {
    const can = stateHistory.length > 0;
    document.getElementById('btn-undo').disabled        = !can;
    document.getElementById('btn-undo-ledger').disabled = !can;
}

// ── TRADING PANEL LIVE PREVIEW ───────────────────────────────
function updateTradePreview() {
    const sym   = document.getElementById('trade-symbol').value;
    const qty   = parseInt(document.getElementById('trade-qty').value, 10) || 0;
    const price = state.prices[sym] || 0;
    const cost  = price * qty;
    const fee   = cost * FEE_RATE;
    const total = orderType === 'BUY' ? cost + fee : cost - fee;

    document.getElementById('trade-price').textContent = fmt(price);
    document.getElementById('trade-cost').textContent  = fmt(cost);
    document.getElementById('trade-fee').textContent   = fmt(fee);
    document.getElementById('trade-total').textContent = fmt(total);
    document.getElementById('trade-warn').textContent  = '';
}

function setOrderType(type) {
    orderType = type;
    document.getElementById('btn-buy').className  = 'ot-btn' + (type === 'BUY'  ? ' active buy-active'  : '');
    document.getElementById('btn-sell').className = 'ot-btn' + (type === 'SELL' ? ' active sell-active' : '');
    document.getElementById('btn-execute').textContent = type === 'BUY' ? 'Execute Buy Order' : 'Execute Sell Order';
    updateTradePreview();
}

// ── THEME ─────────────────────────────────────────────────────
function initTheme() {
    const saved = localStorage.getItem('stocksim-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
}

function updateThemeIcon(theme) {
    const sunIcon  = document.getElementById('tbicon-sun');
    const moonIcon = document.getElementById('tbicon-moon');
    if (!sunIcon || !moonIcon) return;
    sunIcon.classList.toggle('tb-hidden',  theme === 'light');
    moonIcon.classList.toggle('tb-hidden', theme === 'dark');
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next    = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('stocksim-theme', next);
    updateThemeIcon(next);
    // re-render charts with correct colors
    if (netWorthChart && allocChart) renderCharts();
}

// ── NAVIGATION ────────────────────────────────────────────────
function initNav() {
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            const sec = item.dataset.section;
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.getElementById('section-' + sec).classList.add('active');
        });
    });

    // Handle URL hash for deep-linking from home.html
    const hash = window.location.hash.replace('#', '');
    if (hash) {
        const target = document.querySelector(`.nav-item[data-section="${hash}"]`);
        if (target) target.click();
    }
    // Also check localStorage preference
    const pref = localStorage.getItem('stocksim-section');
    if (pref && !hash) {
        const target = document.querySelector(`.nav-item[data-section="${pref}"]`);
        if (target) { target.click(); localStorage.removeItem('stocksim-section'); }
    }
}

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initNav();
    initCharts();

    // Buttons
    document.getElementById('btn-next-day').addEventListener('click', advanceDay);
    document.getElementById('btn-undo').addEventListener('click', undoLast);
    document.getElementById('btn-undo-ledger').addEventListener('click', undoLast);
    document.getElementById('btn-execute').addEventListener('click', executeTrade);
    document.getElementById('btn-theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('btn-start-sim').addEventListener('click', startSimulation);

    // Date range
    document.getElementById('btn-apply-range').addEventListener('click', applyDateRange);
    document.getElementById('btn-reset-range').addEventListener('click', resetDateRange);

    // Trade preview listeners
    document.getElementById('trade-symbol').addEventListener('change', updateTradePreview);
    document.getElementById('trade-qty').addEventListener('input', updateTradePreview);

    // Set initial buy button state
    setOrderType('BUY');

    // Initial render
    renderAll();
    persistState();
});
