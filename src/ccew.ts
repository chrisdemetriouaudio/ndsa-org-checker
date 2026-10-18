/**
 * The Charity Commission's Register of Charities API (England and Wales): the answers we use, and how they become
 * the checker's register entry. Pure, so the Worker and the tests share it. Definition: docs/charity-commission-api/.
 */
import type { LookupEntry } from './lookupKeys.ts';

export const CCEW_API = 'https://api.charitycommission.gov.uk/register/api';

/** GetAllCharityDetailsV2: the fields we read. reg_status is "R" (registered) or "RM" (removed). */
export interface CcewDetails {
  reg_charity_number: number;
  charity_name: string;
  reg_status: string;
  date_of_removal: string | null;
  removal_reason: string | null;
  insolvent: boolean | null;
  in_administration: boolean | null;
  cio_dissolution_ind: boolean | null;
  interim_manager_ind: boolean | null;
  date_of_interim_manager_appt: string | null;
  reporting_status: string | null;
  latest_acc_fin_year_end_date: string | null;
  web: string | null;
  who_what_where?: { classification_code: number; classification_type: string; classification_desc: string }[] | null;
  CharityAoOLocalAuthority?: { local_authority: string; metropolitan_county: string | null; welsh_ind: boolean | null }[] | null;
  CharityAoORegion?: { region: string }[] | null;
  CharityAoOCountryContinent?: { country: string; continent: string }[] | null;
  other_names?: { other_name: string; name_type: string }[] | null;
}

/** One row of GetSearchCharityByName. */
export interface CcewFound {
  reg_charity_number: number;
  group_subsid_suffix: number;
  charity_name: string;
  reg_status: string;
  date_of_removal: string | null;
}

/** What the live register adds to the morning's lookup files. */
export interface CcewExtra {
  removalReason: string | null;
  interimManager: string | null; // date appointed, or '' when the date is not given
  grantMaker: boolean | null;
  does: string[]; // how it helps, in the register's words: "Provides services", "Provides advocacy / advice / information"
  where: string[]; // where it works: up to 10 council areas, else a region such as "Throughout England", else countries
  otherNames: string[]; // working names and old names
}

const day = (s: string | null | undefined) => (s ? s.slice(0, 10) : '');

/** The live details in the same shape as the morning's lookup files, so the scoring rules treat both alike. */
export function detailsToEntry(d: CcewDetails): LookupEntry {
  const reporting = d.reporting_status ?? '';
  const flags = `${d.insolvent ? 'i' : ''}${d.in_administration ? 'a' : ''}${d.cio_dissolution_ind ? 'd' : ''}${/overdue|double default/i.test(reporting) ? 'o' : ''}${reporting === 'Suppressed' ? 's' : ''}`;
  const name = String(d.charity_name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return ['e', String(d.reg_charity_number), name, d.reg_status === 'RM' ? 'X' : 'R', day(d.date_of_removal), flags, day(d.latest_acc_fin_year_end_date)];
}

export function detailsExtra(d: CcewDetails, grantMaker: boolean | null): CcewExtra {
  return {
    removalReason: d.removal_reason?.trim() || null,
    interimManager: d.interim_manager_ind ? day(d.date_of_interim_manager_appt) : null,
    grantMaker,
    does: (d.who_what_where ?? []).filter((c) => c.classification_type === 'How' && c.classification_code !== 310).map((c) => c.classification_desc.trim()),
    where: whereItWorks(d),
    otherNames: [...new Set((d.other_names ?? []).map((n) => n.other_name.replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, 5),
  };
}

/** Council areas if the charity named them (at most 10), otherwise its region, otherwise the countries it works in. */
export function whereItWorks(d: CcewDetails): string[] {
  const councils = (d.CharityAoOLocalAuthority ?? []).map((a) => a.local_authority.trim()).filter(Boolean);
  if (councils.length) return [...new Set(councils)];
  const regions = (d.CharityAoORegion ?? []).map((r) => r.region.trim()).filter(Boolean);
  if (regions.length) return [...new Set(regions)];
  return [...new Set((d.CharityAoOCountryContinent ?? []).map((c) => c.country.trim()).filter(Boolean))].slice(0, 10);
}

/** A name with the parts charities add and drop freely taken off, for comparing two names. */
export function nameKey(s: string): string {
  return s.toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|ltd|limited|cio|uk|charity|charitable|incorporated|trust|company)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The likely charity names in a page title: "Home | National Autistic Society" -> ["National Autistic Society", "Home"]. */
export function namesFromTitle(title: string | null): string[] {
  if (!title) return [];
  const parts = title.split(/\s+[|–—:·-]\s+|\s*\|\s*/).map((p) => p.trim()).filter((p) => nameKey(p).split(' ').length >= 2);
  return [...new Set(parts)].sort((a, b) => b.length - a.length).slice(0, 2);
}

/**
 * The search result that is this charity, if any. Only an exact name match counts (after nameKey), and only the main
 * charity (suffix 0). A registered match wins over a removed one with the same name.
 */
export function pickByName(found: CcewFound[], name: string): CcewFound | null {
  const want = nameKey(name);
  if (!want) return null;
  const same = found.filter((f) => f.group_subsid_suffix === 0 && nameKey(f.charity_name) === want);
  return same.find((f) => f.reg_status === 'R') ?? same[0] ?? null;
}
