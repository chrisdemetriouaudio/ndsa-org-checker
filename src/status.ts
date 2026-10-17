import { computeSignals, score, type Signal } from './signals.ts';
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
export function decideStatus(org: Org, history: CheckResult[], today: string): Decision {
  const signals = computeSignals(org, history, today);
  const s = score(signals).score;
  const review = org.review;

  if (review?.status === 'Closed') {
    const why = `Closed by ${review.by} on ${review.date}${review.note ? `: ${review.note}` : ''}`;
    return { status: 'Closed', reasons: [why], proven: true, signals, score: 0 };
  }

  const red = signals.filter((x) => x.level === 'red');
  const proofRed = red.filter((x) => x.kind === 'proof');
  const strongRed = red.filter((x) => x.strength === 'strong');
  const why = (list: Signal[]) => list.map((x) => (x.kind === 'proof' ? `Proof: ${x.detail}` : x.detail));

  if (proofRed.length) return { status: 'Likely closed', reasons: why(proofRed), proven: true, signals, score: s };
  if (strongRed.length) return { status: 'Likely closed', reasons: why(strongRed), proven: false, signals, score: s };
  if (red.length) return { status: 'Needs a check', reasons: why(red), proven: false, signals, score: s };

  const confirmed = signals.find((x) => x.key === 'confirmed');
  if (confirmed?.level === 'green') return { status: 'Confirmed', reasons: [confirmed.detail], proven: false, signals, score: s };
  const checked = signals.some((x) => x.kind === 'evidence' && x.level !== 'none');
  return { status: 'Looks active', reasons: checked ? [] : ['Not checked yet'], proven: false, signals, score: s };
}
