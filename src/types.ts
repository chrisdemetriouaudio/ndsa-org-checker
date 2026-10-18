import type { Audience } from './audience.ts';
import type { Coverage, Nation } from './place.ts';
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
  audiences?: Audience[]; // children / adults / families; empty or missing = not stated
  postcode?: string; // base postcode (registered office), not always where groups meet
  lat?: number; // map point for the postcode (postcodes.io), about 100 m accurate
  lon?: number;
  coverage?: Coverage; // works locally, or across a whole nation
  nations?: Nation[]; // which nations it covers
  serves?: string[]; // council areas or regions it serves, in the register's words
  servesFrom?: 'register' | 'office'; // declared on the charity register, or just its office's council
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
  etag?: string | null; // for "has it changed?" on the next visit
  lastModified?: string | null;
  notModified?: boolean; // the page had not changed since the last visit
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
  robots?: Record<string, { date: string; disallowAll: boolean }>; // robots.txt answers, kept a week
}

/** The admin page's small copy of the state: tick labels once, each organisation's ticks as one letter each. */
export interface Summary {
  updated: string | null;
  labels: string[]; // tick labels, in order
  orgs: Record<string, {
    status: Status; score: number | null; reasons: string[]; proven: boolean; lastChecked: string | null;
    ticks: string; // one letter per tick: g green, a amber, r red, n not checked
    notes: string[]; // what each tick measured ('' when green)
  }>;
}

export const HISTORY_LIMIT = 14; // enough for the 7-check window and the 2-week 'new' rule
export const FLAGGED: Status[] = ['Needs a check', 'Likely closed'];
