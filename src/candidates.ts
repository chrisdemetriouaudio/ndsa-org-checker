/**
 * Candidates found by discovery, and the rules shared by the daily run and the admin page for turning one
 * into a directory entry. Pure: no downloads, no Node-only parts (the Worker uses this too).
 */
import { cleanAudiences, type Audience } from './audience.ts';
import type { Coverage, Nation } from './place.ts';
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
  firstSeen?: string; // date discovery first found it
}

export interface Decision { decision: 'added' | 'rejected'; by: string; date: string }

const REGISTER_NOTE: Record<string, string> = {
  oscr: 'A Scottish charity (Scottish register check not built yet)',
  ccni: 'A Northern Ireland charity (Northern Ireland register check not built yet)',
};

/** The directory entry a candidate becomes (still checked by validateNew before saving). */
export function candidateToInput(c: Pick<Candidate, 'source' | 'number' | 'name' | 'website' | 'area' | 'nations' | 'conditions'> & { audiences?: unknown; postcode?: unknown; coverage?: unknown }): NewOrgInput {
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
  };
}

/** The most the daily run will add by itself. More than this at once means something odd: none are added. */
export const MAX_AUTO_ADD = 20;

/** A new candidate is "clear" when its name is for a condition and it has a website. */
export const isClear = (c: Candidate) => c.inName && !!c.website;

export interface SiteVerdict { ok: boolean; why: string }

/**
 * Which new candidates the daily run may add by itself: clear ones whose website passed. If there are more
 * clear ones than the cap, none are added and the reason says so.
 */
export function pickAutoAdds(fresh: Candidate[], verdicts: Map<string, SiteVerdict>): { add: Candidate[]; review: Candidate[]; note: string | null } {
  const clear = fresh.filter(isClear);
  if (clear.length > MAX_AUTO_ADD) {
    return { add: [], review: fresh, note: `${clear.length} clear new ones appeared at once (the limit is ${MAX_AUTO_ADD}), so none were added automatically. Please check them on the review page.` };
  }
  const add = clear.filter((c) => verdicts.get(c.key)?.ok);
  const added = new Set(add.map((c) => c.key));
  return { add, review: fresh.filter((c) => !added.has(c.key)), note: null };
}
