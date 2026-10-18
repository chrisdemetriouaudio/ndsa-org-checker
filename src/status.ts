import { dateWords } from './dates.ts';
import { computeSignals, score, type Signal } from './signals.ts';
import type { Register } from './registerTypes.ts';
import type { CheckResult, Org, Status } from './types.ts';

export interface Decision {
  status: Status;
  reasons: string[];
  /** True when the closure rests on proof (an official record, the organisation, or a person), not just the website. */
  proven: boolean;
  signals: Signal[];
  score: number | null;
}

/** Turns the check history into a suggested status, its categories and a score. Pure. */
export function decideStatus(org: Org, history: CheckResult[], today: string, register?: Register): Decision {
  const signals = computeSignals(org, history, today, register);
  const s = score(signals).score;
  const review = org.review;

  if (review?.status === 'Closed') {
    const why = `Closed by ${review.by} on ${dateWords(review.date)}${review.note ? `: ${review.note}` : ''}`;
    return { status: 'Closed', reasons: [why], proven: true, signals, score: 0 };
  }

  const red = signals.filter((x) => x.level === 'red');
  const proofRed = red.filter((x) => x.kind === 'proof');
  const strongRed = red.filter((x) => x.strength === 'strong');
  const why = (list: Signal[]) => list.map((x) => (x.kind === 'proof' ? `Proof: ${x.detail}` : x.detail));

  const proving = red.filter((x) => x.provesClosure);
  if (proving.length) return { status: 'Likely closed', reasons: why(red), proven: true, signals, score: s };
  if (proofRed.length || strongRed.length) return { status: 'Likely closed', reasons: why(red.filter((x) => x.kind === 'proof' || x.strength === 'strong')), proven: false, signals, score: s };
  if (red.length) return { status: 'Needs a check', reasons: why(red), proven: false, signals, score: s };

  const confirmed = signals.find((x) => x.key === 'confirmed');
  if (confirmed?.level === 'green') return { status: 'Confirmed', reasons: [confirmed.detail], proven: false, signals, score: s };
  const checked = signals.some((x) => x.kind === 'evidence' && x.level !== 'none');
  return { status: 'Looks active', reasons: checked ? [] : ['Not checked yet'], proven: false, signals, score: s };
}

const daysBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;
const HEALTHY_EVERY_DAYS = 3;
const SETTLING_DAYS = 14;

/**
 * Whether an organisation's website should be visited today. Healthy, steady ones every 3 days; daily when
 * anything is amber or red, when it is new (its first 2 weeks), or when its status changed in the last 2 weeks.
 */
export function isDue(prev: { status: Status; since: string; lastChecked: string | null; history: unknown[]; signals?: { kind: string; level: string }[] } | undefined, today: string): boolean {
  if (!prev?.lastChecked) return true;
  if (prev.lastChecked === today) return false; // never twice in one day, even if the run is started again by hand
  if (prev.status !== 'Looks active' && prev.status !== 'Confirmed') return true;
  if (prev.signals?.some((x) => x.kind === 'evidence' && (x.level === 'amber' || x.level === 'red'))) return true;
  if (prev.history.length < SETTLING_DAYS) return true;
  if (daysBetween(prev.since, today) < SETTLING_DAYS) return true;
  return daysBetween(prev.lastChecked, today) >= HEALTHY_EVERY_DAYS;
}
