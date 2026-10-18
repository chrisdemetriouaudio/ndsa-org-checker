import { dateWords } from './dates.ts';
import type { Register } from './registerTypes.ts';
import type { CheckResult, Org } from './types.ts';

export type Level = 'green' | 'amber' | 'red' | 'none';

export interface Signal {
  key: string;
  label: string; // short column name
  level: Level;
  detail: string; // plain-English why
  weight: number; // share of the score
  /** Proof comes from an official record or the organisation itself; evidence is inferred from the website. */
  kind: 'proof' | 'evidence';
  /** Strong signals at red mean "likely closed"; weak ones mean "needs a check". */
  strength: 'strong' | 'weak';
  /** Red here proves the organisation has closed (removed from the register, dissolved, or closed by a person). */
  provesClosure?: boolean;
}

export const WINDOW = 7; // checks looked at (one a day)
export const STRIKES = 3; // failures in the window before it counts as red
const CONFIRMED_DAYS = 183;

const daysBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

/** One line per category, each green / amber / red / not checked. Pure. */
export function computeSignals(org: Org, history: CheckResult[], today: string, register?: Register): Signal[] {
  const review = org.review;
  const recent = history.filter((h) => !review || h.date > review.date).slice(-WINDOW);
  const n = recent.length;
  const last = recent.at(-1);
  const prev = recent.at(-2);
  const signals: Signal[] = [];
  const evidence = (s: Omit<Signal, 'kind'>) => signals.push({ ...s, kind: 'evidence' });
  const proof = (s: Omit<Signal, 'kind' | 'strength' | 'weight'> & { weight: number }) => signals.push({ ...s, kind: 'proof', strength: 'strong' });

  // Evidence from the website.
  const dns = recent.filter((h) => h.error === 'DNS').length;
  evidence({
    key: 'address', label: 'Web address', weight: 15, strength: 'strong',
    level: !n ? 'none' : dns >= STRIKES ? 'red' : dns ? 'amber' : 'green',
    detail: !n ? 'Not checked yet' : dns ? `Web address not found on ${dns} of the last ${n} checks` : 'Web address exists',
  });

  const down = recent.filter((h) => !h.reachable && h.error !== 'DNS').length;
  evidence({
    key: 'answers', label: 'Website answers', weight: 15, strength: 'weak',
    level: !n ? 'none' : down >= STRIKES ? 'red' : down ? 'amber' : 'green',
    detail: !n ? 'Not checked yet' : down ? `Website down on ${down} of the last ${n} checks` : 'Website answered at every check',
  });

  const twice = (pick: (h: CheckResult) => string[]) =>
    last && pick(last).length ? (prev && pick(prev).length ? 'red' : 'amber') : 'green';

  const closedLevel = n ? twice((h) => h.closedPhrases) : 'none';
  evidence({
    key: 'notice', label: 'No closing notice', weight: 15, strength: 'strong', level: closedLevel,
    detail: closedLevel === 'none' ? 'Not checked yet' : closedLevel === 'green' ? 'No closing wording on the homepage'
      : `Homepage says "${last!.closedPhrases[0]}"${closedLevel === 'red' ? ' (2 checks in a row)' : ' (once so far)'}`,
  });

  const parkedLevel = n ? twice((h) => h.parkedPhrases) : 'none';
  evidence({
    key: 'parked', label: 'Not for sale', weight: 15, strength: 'strong', level: parkedLevel,
    detail: parkedLevel === 'none' ? 'Not checked yet' : parkedLevel === 'green' ? 'Domain is not parked or for sale'
      : `Domain looks parked: "${last!.parkedPhrases[0]}"${parkedLevel === 'red' ? ' (2 checks in a row)' : ' (once so far)'}`,
  });

  evidence({
    key: 'moved', label: 'Same address', weight: 5, strength: 'weak',
    level: !n ? 'none' : last?.movedTo ? 'red' : 'green',
    detail: !n ? 'Not checked yet' : last?.movedTo ? `Website now goes to ${last.movedTo}` : 'Website stays at its own address',
  });

  // Proof: an official record, or the organisation itself.
  proof({ key: 'register', label: 'Charity register', weight: 25, ...registerSignal(org, register) });

  const confirmedRecently = review?.status === 'Confirmed' && daysBetween(review.date, today) <= CONFIRMED_DAYS;
  proof({
    key: 'confirmed', label: 'Confirmed by them', weight: 25,
    level: confirmedRecently ? 'green' : 'none',
    detail: confirmedRecently ? `Confirmed by ${review!.by} on ${dateWords(review!.date)}` : 'Not asked yet (verification e-mails come in phase 4)',
  });

  return signals;
}

const OVERDUE = new Set(['Submission Overdue', 'Submission Double Default']);

/** The charity register's say, as a level. Removed or dissolved proves closure. */
export function registerSignal(org: Org, register?: Register): Pick<Signal, 'level' | 'detail' | 'provesClosure'> {
  const n = org.charityNumber;
  if (!n) return { level: 'none', detail: org.registerNote ?? 'No charity number yet' };
  if (!register?.extractDate) return { level: 'none', detail: 'Charity register not downloaded yet' };
  const e = register.entries[n];
  const asOf = register.live ? '(live charity register)' : `(register of ${dateWords(register.extractDate)})`;
  if (!e) return { level: 'amber', detail: `Charity number ${n} not found on the register ${asOf}` };
  if (e.status === 'Removed') {
    return { level: 'red', provesClosure: true, detail: `Removed from the charity register on ${dateWords(e.removedOn)}${e.removalReason ? ` (${e.removalReason.toLowerCase()})` : ''}` };
  }
  if (e.dissolved) return { level: 'red', provesClosure: true, detail: `Charity ${n} is dissolved ${asOf}` };
  if (e.inAdministration) return { level: 'red', detail: `Charity ${n} is in administration ${asOf}` };
  if (e.insolvent) return { level: 'red', detail: `Charity ${n} is marked insolvent ${asOf}` };
  if (e.interimManager != null) return { level: 'amber', detail: `The Charity Commission has put in an interim manager${e.interimManager ? ` (${dateWords(e.interimManager)})` : ''}` };
  if (e.reporting && OVERDUE.has(e.reporting)) return { level: 'amber', detail: `Accounts overdue: "${e.reporting}" ${asOf}` };
  if (e.reporting === 'Suppressed') return { level: 'amber', detail: `Reporting suspended by the Charity Commission ${asOf}` };
  return { level: 'green', detail: `Registered charity ${n}, last accounts to ${dateWords(e.lastAccounts)}` };
}

const VALUE: Record<Exclude<Level, 'none'>, number> = { green: 1, amber: 0.5, red: 0 };

export const PROOF_RED_CAP = 40;

/**
 * 0–100 confidence that the organisation is still running, from the categories checked so far.
 * Proof outranks website evidence: proven closed scores 0, and any other red proof caps the score at 40.
 */
export function score(signals: Signal[]): { score: number | null; checked: number; total: number } {
  const checked = signals.filter((s) => s.level !== 'none');
  const weight = checked.reduce((t, s) => t + s.weight, 0);
  const got = checked.reduce((t, s) => t + s.weight * VALUE[s.level as Exclude<Level, 'none'>], 0);
  let result = weight ? Math.round((100 * got) / weight) : null;
  const proofRed = checked.filter((s) => s.kind === 'proof' && s.level === 'red');
  if (proofRed.some((s) => s.provesClosure)) result = 0;
  else if (proofRed.length && result !== null) result = Math.min(result, PROOF_RED_CAP);
  return { score: result, checked: checked.length, total: signals.length };
}
