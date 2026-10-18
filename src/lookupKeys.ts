/** The checker's lookup keys and entry format: pure, shared by the daily build (Node) and the checker (Worker). */
import type { RegisterEntry } from './registerTypes.ts';

/** [source e/s/n, number, name, status R(egistered)/X(removed), removed on, flags, last accounts]. Flags: i insolvent, a administration, d dissolved, o overdue, s suppressed. */
export type LookupEntry = [string, string, string, 'R' | 'X', string, string, string];

export const hostKey = (host: string) => host.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
/** FNV-1a hash -> one of 1,024 evenly sized files (the Worker computes the same). */
function bucket(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h % 1024).toString().padStart(4, '0');
}
export const hostShard = (host: string) => bucket(hostKey(host));
export const numberShard = (n: string) => bucket(n.toUpperCase().replace(/\s/g, ''));
export const SOURCE_NAME: Record<string, string> = { e: 'Charity Commission for England and Wales', s: 'Scottish Charity Register', n: 'Charity Commission for Northern Ireland' };

export function registerLink(e: LookupEntry): string {
  const [src, number] = e;
  if (src === 'e') return `https://register-of-charities.charitycommission.gov.uk/charity-search/-/charity-details/${number}`;
  if (src === 's') return `https://www.oscr.org.uk/about-charities/search-the-register/charity-details?number=${number}`;
  return `https://www.charitycommissionni.org.uk/charity-details/?regId=${number}`;
}

/** The register entry the scoring rules expect (src/signals.ts). */
export function toRegisterEntry(e: LookupEntry): RegisterEntry {
  const [, number, name, status, removedOn, flags, lastAccounts] = e;
  return {
    number, name, status: status === 'X' ? 'Removed' : 'Registered', removedOn: removedOn || null,
    reporting: flags.includes('o') ? 'Submission Overdue' : flags.includes('s') ? 'Suppressed' : 'Submission Received',
    lastAccounts: lastAccounts || null, insolvent: flags.includes('i'), inAdministration: flags.includes('a'), dissolved: flags.includes('d'), web: null,
  };
}

