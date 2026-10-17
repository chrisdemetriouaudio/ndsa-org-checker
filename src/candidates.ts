/**
 * Candidates found by discovery, and the rules shared by the daily run and the admin page for turning one
 * into a directory entry. Pure: no downloads, no Node-only parts (the Worker uses this too).
 */
import { cleanAudiences, type Audience } from './audience.ts';
import type { Coverage, Nation } from './place.ts';
import type { Triage } from './triage.ts';
import { tidyName, type NewOrgInput } from './neworg.ts';

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
  triage?: Triage;
  firstSeen?: string; // date discovery first found it
}

export interface Decision { decision: 'added' | 'rejected'; by: string; date: string; reason?: string }

const REGISTER_NOTE: Record<string, string> = {
  oscr: 'A Scottish charity (Scottish register check not built yet)',
  ccni: 'A Northern Ireland charity (Northern Ireland register check not built yet)',
};

/** The directory entry a candidate becomes (still checked by validateNew before saving). */
export function candidateToInput(c: Pick<Candidate, 'source' | 'number' | 'name' | 'website' | 'area' | 'nations' | 'conditions'> & { audiences?: unknown; postcode?: unknown; coverage?: unknown; serves?: unknown }): NewOrgInput {
  return {
    name: tidyName(String(c.name ?? '')),
    url: String(c.website ?? ''),
    area: String(c.area ?? '') || (Array.isArray(c.nations) ? c.nations.join(', ') : ''),
    kind: 'Registered charity',
    focus: Array.isArray(c.conditions) ? c.conditions.map(String) : [],
    charityNumber: c.source === 'ccew' ? String(c.number ?? '') : '',
    registerNote: REGISTER_NOTE[c.source],
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
