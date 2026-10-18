/**
 * Candidates found by discovery, and the rules shared by the daily run and the admin page for turning one
 * into a directory entry. Pure: no downloads, no Node-only parts (the Worker uses this too).
 */
import { cleanAudiences, type Audience } from './audience.ts';
import type { Coverage, Nation } from './place.ts';
import type { Triage } from './triage.ts';
import type { CheckResult } from './types.ts';
import { tidyName, type NewOrgInput } from './neworg.ts';
import { primaryConditions } from './conditions.ts';

export { NATIONS, type Nation } from './place.ts';

export interface Candidate {
  key: string; // source:number, stable between runs
  source: 'ccew' | 'oscr' | 'ccni';
  number: string;
  name: string;
  website: string | null;
  nations: Nation[];
  area: string; // where it works, in the register's words
  form: string; // legal form
  conditions: string[];
  inName: boolean;
  snippet: string;
  audiences: Audience[]; // who it is for, where the register or its description says
  postcode?: string | null; // base postcode from the register
  coverage?: Coverage;
  serves?: string[]; // council areas or regions it serves, from the register
  about?: string; // the start of the register's description (400 characters), for rules and people
  how?: string; // the register's tick-boxes for how it works, e.g. "Provides services; Makes grants to individuals"
  triage?: Triage;
  firstSeen?: string; // date discovery first found it
  siteFails?: number; // days in a row its website check has failed
  siteFailedOn?: string; // the last day it failed: a website is visited at most once a day, so a second run that day counts nothing
}

export interface Decision { decision: 'added' | 'rejected'; by: string; date: string; reason?: string }


/** The directory entry a candidate becomes (still checked by validateNew before saving). */
export function candidateToInput(c: Pick<Candidate, 'source' | 'number' | 'name' | 'website' | 'area' | 'nations' | 'conditions'> & { audiences?: unknown; postcode?: unknown; coverage?: unknown; serves?: unknown; about?: unknown }): NewOrgInput {
  const all = Array.isArray(c.conditions) ? c.conditions.map(String) : [];
  const main = typeof c.about === 'string' && c.about ? primaryConditions(String(c.name ?? ''), c.about) : [];
  return {
    name: tidyName(String(c.name ?? '')),
    url: String(c.website ?? ''),
    area: String(c.area ?? '') || (Array.isArray(c.nations) ? c.nations.join(', ') : ''),
    kind: 'Registered charity',
    focus: main.length ? main : all, // what it is mainly for, not every condition its description mentions
    charityNumber: c.source === 'ccni' ? `NIC${String(c.number ?? '')}` : String(c.number ?? ''),
    audiences: cleanAudiences(c.audiences),
    postcode: String(c.postcode ?? ''),
    coverage: c.coverage === 'national' ? 'national' : 'local',
    nations: Array.isArray(c.nations) ? c.nations.map(String) : [],
    serves: Array.isArray(c.serves) ? c.serves.map(String) : [],
  };
}

/** The most the daily run will add by itself. More than this at once means something odd: none are added. */
export const MAX_AUTO_ADD = 20;

/**
 * What the daily run does with each candidate, from its relevance verdict:
 *  - reject: leaves the list for good (the reason is recorded);
 *  - add: its website is checked, and it is added if the website passes.
 * New finds that qualify for adding are capped: more than MAX_AUTO_ADD at once means something odd, so none of
 * those are added that day. The backlog (candidates seen before) is not capped.
 */
export function planActions(candidates: Candidate[], freshKeys: Set<string>): { reject: Candidate[]; check: Candidate[]; note: string | null } {
  const reject = candidates.filter((c) => c.triage?.verdict === 'reject');
  let check = candidates.filter((c) => c.triage?.verdict === 'add');
  const freshAdds = check.filter((c) => freshKeys.has(c.key));
  let note: string | null = null;
  if (freshAdds.length > MAX_AUTO_ADD) {
    note = `${freshAdds.length} new organisations qualified at once (the limit is ${MAX_AUTO_ADD}), so none of them were added automatically. Please check them on the review page.`;
    check = check.filter((c) => !freshKeys.has(c.key));
  }
  return { reject, check, note };
}

export interface SiteVerdict { ok: boolean; why: string }

/** Hosts that are never an organisation's own website. */
const NOT_A_SITE = /(^|\.)(google\.com|accounts\.google\.com|facebook\.com|godaddy\.com|wix\.com|squarespace\.com|sedo\.com)$/i;
const STOP = new Set(['the', 'and', 'for', 'with', 'group', 'trust', 'charity', 'limited', 'ltd', 'association', 'society', 'support', 'project', 'centre', 'center', 'foundation', 'company', 'community', 'org', 'www', 'co', 'uk', 'com', 'net', 'cio', 'scio']);
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w));

/** A redirect to a new address counts as the same organisation when the new address shares a word with its name or old address. */
export function relatedMove(name: string, oldUrl: string, newHost: string): boolean {
  if (NOT_A_SITE.test(newHost)) return false;
  const host = newHost.toLowerCase();
  const own = [...words(name), ...words(new URL(oldUrl).hostname)];
  return own.some((w) => host.includes(w));
}

export const PARK_AFTER_FAILS = 3;

/**
 * What to do with a candidate that qualified for adding, after one visit to its website:
 *  add          – the website answered cleanly
 *  add-moved    – it moved to a related new address: follow the move and keep the new address
 *  reject       – the website says it has closed
 *  park         – the address is gone (no such domain, 404/410), or it failed 3 days running
 *  review       – an unrelated move, or a temporary failure: try again tomorrow / a person looks
 */
export function siteOutcome(c: Pick<Candidate, 'name' | 'website'>, r: CheckResult, prevFails: number):
  { action: 'add' | 'add-moved' | 'reject' | 'park' | 'review'; why: string; fails: number; newUrl?: string } {
  if (r.closedPhrases.length) return { action: 'reject', why: `website says "${r.closedPhrases[0]}"`, fails: 0 };
  if (r.parkedPhrases.length) return { action: 'park', why: 'website looks parked or for sale', fails: prevFails + 1 };
  if (r.reachable && !r.movedTo) return { action: 'add', why: 'website answered cleanly', fails: 0 };
  if (r.reachable && r.movedTo) {
    if (relatedMove(c.name, c.website!, r.movedTo)) return { action: 'add-moved', why: `website moved to ${r.movedTo}; the new address is used`, fails: 0, newUrl: `https://${r.movedTo}` };
    return { action: 'review', why: `website now goes to ${r.movedTo}, which may be a different organisation`, fails: 0 };
  }
  if (r.error === 'DNS' || r.httpStatus === 404 || r.httpStatus === 410) return { action: 'park', why: 'the web address no longer works', fails: prevFails + 1 };
  const fails = prevFails + 1;
  const what = `website did not answer (${r.error ?? r.httpStatus})`;
  return fails >= PARK_AFTER_FAILS ? { action: 'park', why: `${what} on ${fails} days running`, fails } : { action: 'review', why: `${what}; trying again tomorrow`, fails };
}
