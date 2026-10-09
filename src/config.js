export const API_URL = import.meta.env.VITE_API_URL;
export const API_TOKEN = import.meta.env.VITE_API_TOKEN;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthName = (m) => MONTH_NAMES[m - 1];
export const pad = (n) => String(n).padStart(2, '0');
export const monthKey = (y, m) => `${y}-${pad(m)}`;

// Financial years run Apr → Mar. "FY25" in the sheet = Apr 2025 – Mar 2026.
function fyMonths(startYear) {
  const out = [];
  for (let i = 0; i < 12; i++) {
    const m = ((3 + i) % 12) + 1;
    const y = m >= 4 ? startYear : startYear + 1;
    out.push({ y, m, key: monthKey(y, m), label: `${monthName(m)} ${String(y).slice(2)}` });
  }
  return out;
}

export const FY_PREV_START = 2025;
export const FY_CUR_START = 2026;
export const FY_PREV_MONTHS = fyMonths(FY_PREV_START);
export const FY_CUR_MONTHS = fyMonths(FY_CUR_START);
export const ALL_MONTHS = [...FY_PREV_MONTHS, ...FY_CUR_MONTHS];
export const FY_PREV_KEYS = new Set(FY_PREV_MONTHS.map((m) => m.key));
export const isPrevFY = (key) => FY_PREV_KEYS.has(key);

export const QUARTERS = [
  ...[0, 1, 2, 3].map((q) => ({ label: `Q${q + 1} FY26`, months: FY_PREV_MONTHS.slice(q * 3, q * 3 + 3) })),
  ...[0, 1, 2, 3].map((q) => ({ label: `Q${q + 1} FY27`, months: FY_CUR_MONTHS.slice(q * 3, q * 3 + 3) })),
];
export const FYS = [
  { label: 'FY25-26', months: FY_PREV_MONTHS },
  { label: 'FY26-27', months: FY_CUR_MONTHS },
];

export const PLATFORMS = ['Zepto', 'Blinkit', 'Instamart', 'Big Basket', 'Amazon', 'First Club'];
export const PAID_CHANNELS = ['Blinkit', 'Zepto', 'Instamart'];

export const PLATFORM_CONFIG = {
  Zepto: { color: '#8b7cf6', budget: 2070000 }, // monthly ad budget (₹), used for pacing
  Blinkit: { color: '#eab308' },
  Instamart: { color: '#3b82f6', budget: 1275000 },
  'Big Basket': { color: '#84cc16' },
  Amazon: { color: '#f97316' },
  'First Club': { color: '#14b8a6' },
  Shopify: { color: '#ec4899' },
};
export const platColor = (p) => PLATFORM_CONFIG[p]?.color || '#6b7280';

export const CATEGORIES = ['Ragi Chips', 'Dipsters', 'Puffs', 'Others'];
export const CAT_COLORS = {
  'Ragi Chips': '#eab308',
  Dipsters: '#a78bfa',
  Puffs: '#3b82f6',
  Others: '#6b7280',
};

// Zepto co-funds 100% of July ad spend, so the OMS figure is double the real spend.
export const ZEPTO_SPEND_CORRECTION = { '2026-07': 0.5 };

export const PERIODS = [
  { id: 't1', label: 'T-1', title: 'Yesterday' },
  { id: 't2', label: 'T-2', title: 'Two days ago' },
  { id: '7d', label: '7 days' },
  { id: 'mtd', label: 'MTD' },
  { id: 'custom', label: 'Custom' },
];
export const PERIOD_LABELS = { t1: 'T-1 (yesterday)', t2: 'T-2', '7d': 'Last 7 days', mtd: 'Month to date', custom: 'Custom range' };
