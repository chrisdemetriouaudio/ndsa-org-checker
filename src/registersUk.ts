/**
 * Scotland's and Northern Ireland's registers, in the same entry shape as England and Wales (src/registerTypes.ts),
 * so one set of scoring rules covers all three. Pure: the daily run downloads the files, these read a row each.
 *   Scotland (OSCR): numbers like SC012345. The file lists current charities only, so a missing number means removed.
 *   Northern Ireland (CCNI): we store numbers as NIC100002 (the regulator's own style); its file says NIC-less 100002.
 */
import type { RegisterEntry } from './registerTypes.ts';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** "31/03/2025" or "31 March 2025" -> "2025-03-31"; anything else -> null. */
export function ukDate(s: string | undefined): string | null {
  const t = (s ?? '').trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = /^(\d{1,2}) ([A-Za-z]+) (\d{4})$/.exec(t);
  const month = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1;
  return m && month >= 0 ? `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

export const isScottish = (n: string) => /^SC\d{6}$/i.test(n);
export const isNorthernIrish = (n: string) => /^NIC\d{6}$/i.test(n);
/** Our NIC100002 -> the register file's 100002. */
export const niFileNumber = (n: string) => n.replace(/^NIC/i, '');

export function oscrEntry(r: Record<string, string>): RegisterEntry {
  return {
    number: r['Charity Number'].trim(), name: r['Charity Name'].trim(), status: 'Registered', removedOn: null,
    reporting: r['Charity Status'] === 'Not Submitted' ? 'Submission Overdue' : 'Submission Received',
    lastAccounts: ukDate(r['Year End']), insolvent: false, inAdministration: false, dissolved: false, web: r['Website']?.trim() || null,
  };
}

export function ccniEntry(r: Record<string, string>): RegisterEntry {
  const status = r['Status'] ?? '';
  return {
    number: `NIC${r['Reg charity number'].trim()}`, name: r['Charity name'].trim(), status: /removed/i.test(status) ? 'Removed' : 'Registered', removedOn: null,
    reporting: /overdue/i.test(status) ? 'Submission Overdue' : 'Submission Received',
    lastAccounts: ukDate(r['Financial period end'] || r['Date for financial year ending']), insolvent: false, inAdministration: false, dissolved: false,
    web: r['Website']?.trim() || null,
  };
}
