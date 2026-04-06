// Client-side CSV parser + Cloudinary data fetcher
// Replaces the Python/Pandas backend entirely
// Fetches CSVs from Cloudinary URLs, parses them in-browser, caches results

const csvCache = {}; // { symbol: { url, data: [rows], cachedAt } }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Parse a CSV string into an array of objects
 */
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || '';
    });
    return row;
  }).filter(row => row.Date); // skip empty rows
}

/**
 * Fetch and parse a CSV from a Cloudinary URL (with caching)
 */
async function fetchCSV(symbol, url) {
  const now = Date.now();

  if (csvCache[symbol] && csvCache[symbol].url === url && (now - csvCache[symbol].cachedAt) < CACHE_TTL_MS) {
    return csvCache[symbol].data;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const data = parseCSV(text);

    csvCache[symbol] = { url, data, cachedAt: now };
    console.log(`[CSV] Cached ${symbol} (${data.length} rows)`);
    return data;
  } catch (err) {
    console.error(`[CSV] Failed to fetch ${symbol}:`, err);
    return null;
  }
}

/**
 * Get available assets from Firestore csvFiles list
 * (No network call needed — just transforms the file list)
 */
export function getAvailableAssets(csvFiles) {
  const assets = {};
  for (const f of csvFiles) {
    if (f.status === 'Active') {
      assets[f.symbol] = {
        name: `${f.symbol} Stock`,
        price: 0.0,
      };
    }
  }
  console.log('[CSV] Available assets:', Object.keys(assets).join(', '));
  return assets;
}

/**
 * Get the min/max date range across all active CSV files
 */
export async function getMarketRange(csvFiles) {
  const allDates = [];

  for (const f of csvFiles) {
    if (f.status !== 'Active') continue;
    const data = await fetchCSV(f.symbol, f.cloudinaryUrl);
    if (!data) continue;

    for (const row of data) {
      if (row.Date) {
        const d = new Date(row.Date);
        if (!isNaN(d.getTime())) allDates.push(d);
      }
    }
  }

  if (allDates.length === 0) {
    return { min: '2020-01-01', max: '2026-03-19' };
  }

  allDates.sort((a, b) => a - b);
  return {
    min: allDates[0].toISOString().split('T')[0],
    max: allDates[allDates.length - 1].toISOString().split('T')[0],
  };
}

/**
 * Get Close prices for all active stocks on a given date
 */
export async function getHistoricalPrices(csvFiles, dateStr) {
  const prices = {};
  const targetDate = new Date(dateStr);
  const targetStr = targetDate.toISOString().split('T')[0];

  for (const f of csvFiles) {
    if (f.status !== 'Active') continue;
    const data = await fetchCSV(f.symbol, f.cloudinaryUrl);
    if (!data) continue;

    // Find the row matching the target date
    for (const row of data) {
      const rowDate = new Date(row.Date);
      const rowStr = rowDate.toISOString().split('T')[0];

      if (rowStr === targetStr) {
        // Find the Close column (could be "Close" or "Close*" etc.)
        const closeKey = Object.keys(row).find(k => k.includes('Close'));
        if (closeKey) {
          const val = parseFloat(row[closeKey]);
          if (!isNaN(val)) {
            prices[f.symbol] = val;
          }
        }
        break;
      }
    }
  }

  return prices;
}

/**
 * Clear the cache (useful on re-upload)
 */
export function clearCSVCache() {
  Object.keys(csvCache).forEach(k => delete csvCache[k]);
  console.log('[CSV] Cache cleared');
}
