const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-17" → "17 Oct 2026" (the vault's date style). */
export function dateWords(iso: string | null): string {
  if (!iso) return 'never';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS.at(m - 1)} ${y}`;
}
