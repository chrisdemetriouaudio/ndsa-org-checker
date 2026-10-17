import type { CheckResult, Org, Status } from './types.ts';

const WINDOW = 7; // checks looked at (one a day)
const STRIKES = 3; // failures in the window before it counts
const CONFIRMED_DAYS = 183;

const daysBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

/** Turns the check history into a suggested status with plain-English reasons. Pure. */
export function decideStatus(org: Org, history: CheckResult[], today: string): { status: Status; reasons: string[] } {
  const review = org.review;
  if (review?.status === 'Closed') {
    return { status: 'Closed', reasons: [`Closed by ${review.by} on ${review.date}${review.note ? `: ${review.note}` : ''}`] };
  }

  const recent = history.filter((h) => !review || h.date > review.date).slice(-WINDOW);
  const lastTwo = recent.slice(-2);
  const strong: string[] = [];
  const weak: string[] = [];

  const dnsFails = recent.filter((h) => h.error === 'DNS').length;
  if (dnsFails >= STRIKES) strong.push(`The web address no longer exists (${dnsFails} of the last ${recent.length} checks)`);

  if (lastTwo.length === 2 && lastTwo.every((h) => h.parkedPhrases.length > 0)) {
    strong.push(`The domain looks parked or for sale ("${lastTwo[1].parkedPhrases[0]}")`);
  }
  if (lastTwo.length === 2 && lastTwo.every((h) => h.closedPhrases.length > 0)) {
    strong.push(`The website says "${lastTwo[1].closedPhrases[0]}"`);
  }

  const down = recent.filter((h) => !h.reachable && h.error !== 'DNS').length;
  if (down >= STRIKES) weak.push(`The website was down on ${down} of the last ${recent.length} checks`);

  const last = recent.at(-1);
  if (last?.movedTo && !strong.length) weak.push(`The website now goes to ${last.movedTo}`);

  if (strong.length) return { status: 'Likely closed', reasons: strong };
  if (weak.length) return { status: 'Needs a check', reasons: weak };
  if (review?.status === 'Confirmed' && daysBetween(review.date, today) <= CONFIRMED_DAYS) {
    return { status: 'Confirmed', reasons: [`Confirmed by ${review.by} on ${review.date}`] };
  }
  if (!recent.length) return { status: 'Looks active', reasons: ['Not checked yet'] };
  return { status: 'Looks active', reasons: [] };
}
