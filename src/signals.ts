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
}

export const WINDOW = 7; // checks looked at (one a day)
export const STRIKES = 3; // failures in the window before it counts as red
const CONFIRMED_DAYS = 183;

const daysBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

/** One line per category, each green / amber / red / not checked. Pure. */
export function computeSignals(org: Org, history: CheckResult[], today: string): Signal[] {
  const review = org.review;
  const recent = history.filter((h) => !review || h.date > review.date).slice(-WINDOW);
  const n = recent.length;
  const last = recent.at(-1);
  const prev = recent.at(-2);
  const signals: Signal[] = [];
  const evidence = (s: Omit<Signal, 'kind'>) => signals.push({ ...s, kind: 'evidence' });
  const proof = (s: Omit<Signal, 'kind' | 'strength'>) => signals.push({ ...s, kind: 'proof', strength: 'strong' });

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
    detail: !n ? 'Not checked yet' : down ? `Website down on ${down} of the last ${n} checks` : 'Website answers every day',
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
  proof({
    key: 'register', label: 'Charity register', weight: 25, level: 'none',
    detail: 'Charity register check not set up yet (needs a free API key)',
  });

  const confirmedRecently = review?.status === 'Confirmed' && daysBetween(review.date, today) <= CONFIRMED_DAYS;
  proof({
    key: 'confirmed', label: 'Confirmed by them', weight: 25,
    level: confirmedRecently ? 'green' : 'none',
    detail: confirmedRecently ? `Confirmed by ${review!.by} on ${review!.date}` : 'Not asked yet (verification e-mails come in phase 4)',
  });

  return signals;
}

const VALUE: Record<Exclude<Level, 'none'>, number> = { green: 1, amber: 0.5, red: 0 };

/** 0–100 confidence that the organisation is still running, from the categories checked so far. */
export function score(signals: Signal[]): { score: number | null; checked: number; total: number } {
  const checked = signals.filter((s) => s.level !== 'none');
  const weight = checked.reduce((t, s) => t + s.weight, 0);
  const got = checked.reduce((t, s) => t + s.weight * VALUE[s.level as Exclude<Level, 'none'>], 0);
  return { score: weight ? Math.round((100 * got) / weight) : null, checked: checked.length, total: signals.length };
}
