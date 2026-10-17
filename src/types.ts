import type { Signal } from './signals.ts';

export type Status = 'Confirmed' | 'Looks active' | 'Needs a check' | 'Likely closed' | 'Closed';

/** A person's decision about a listing. Checks dated on or before it are ignored. */
export interface Review {
  status: 'Confirmed' | 'Still running' | 'Closed';
  date: string; // YYYY-MM-DD
  by: string;
  note?: string;
}

export interface Org {
  id: string;
  name: string;
  url: string;
  area: string;
  kind: string;
  focus: string[];
  charityNumber?: string | null; // England and Wales register
  registerNote?: string; // why there is no charity number
  notes?: string;
  review?: Review;
}

export interface CheckResult {
  date: string; // YYYY-MM-DD
  reachable: boolean; // the server answered (bot-protection answers count)
  httpStatus: number | null;
  finalUrl: string | null;
  ms: number;
  error: 'DNS' | 'Timeout' | 'TLS' | 'Network' | null;
  robotsBlocked: boolean;
  closedPhrases: string[];
  parkedPhrases: string[];
  movedTo: string | null; // a different domain the site now redirects to
  title: string | null;
}

export interface OrgState {
  status: Status;
  reasons: string[];
  since: string; // date the current status started
  lastChecked: string | null;
  proven: boolean; // closure rests on proof, not just website evidence
  score: number | null; // 0–100 confidence it is still running
  signals: Signal[]; // one per category, green / amber / red / not checked
  history: CheckResult[]; // newest last, at most HISTORY_LIMIT
}

export interface State {
  updated: string | null;
  orgs: Record<string, OrgState>;
}

export const HISTORY_LIMIT = 30;
export const FLAGGED: Status[] = ['Needs a check', 'Likely closed'];
