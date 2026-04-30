export { cn } from './utils';
// Re-export so callers can import everything from a single path.

/**
 * Returns rtlClass when the document direction is RTL, ltrClass otherwise.
 * Useful for inline style overrides; prefer CSS logical properties when possible.
 */
export function rtlClass(ltrClass: string, rtlClass: string): string {
  if (typeof document === 'undefined') return ltrClass;
  return document.documentElement.dir === 'rtl' ? rtlClass : ltrClass;
}

/** Formats an amount in agorot (integer cents) as ILS currency string. */
export function formatCurrency(agorot: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 2,
  }).format(agorot / 100);
}

/** Formats a Date (or ISO string) in Hebrew long date format. */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/** Formats a ratio (0–1) as a Hebrew percent string. */
export function formatPercent(ratio: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(ratio);
}
