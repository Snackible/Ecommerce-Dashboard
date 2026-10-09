import { pad } from '../config';

export const num = (v) => Number(v) || 0;

// Dates arrive as 'YYYY-MM-DD' (read as a local calendar day) or as full timestamps.
export function parseLocalDate(str) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return parseInputDate(str);
  const d = new Date(str);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
// <input type=date> gives 'YYYY-MM-DD'; build it in local time so it never shifts a day.
export function parseInputDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
export const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export function fmt(n, currency = true) {
  if (!n || isNaN(n)) return currency ? '₹0' : '0';
  const a = Math.abs(n);
  const s =
    a >= 1e7 ? (n / 1e7).toFixed(2) + 'Cr'
    : a >= 1e5 ? (n / 1e5).toFixed(2) + 'L'
    : a >= 1e3 ? (n / 1e3).toFixed(1) + 'K'
    : Number(n).toFixed(0);
  return currency ? '₹' + s : s;
}
export function fmtShort(v) {
  if (v >= 1e7) return '₹' + (v / 1e7).toFixed(2) + 'Cr';
  if (v >= 1e5) return '₹' + (v / 1e5).toFixed(1) + 'L';
  if (v >= 1e3) return '₹' + (v / 1e3).toFixed(1) + 'K';
  return '₹' + Number(v).toFixed(0);
}
export function fmtUnits(v) {
  if (v >= 1e5) return (v / 1e5).toFixed(1) + 'L';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return Number(v).toFixed(0);
}
export const fmtRoas = (r) => (!r || isNaN(r) ? '--' : Number(r).toFixed(2) + 'x');
export const pctDelta = (a, b) => (b ? ((a - b) / b) * 100 : null);
export const sum = (rows, key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
export const shortDayLabel = (key) => {
  const p = key.split('-');
  return `${p[2]}/${p[1]}`;
};
export const dateLabel = (key) =>
  new Date(key + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' });
