import { NATIONS, ukPostcode } from './place.ts';
import { cleanAudiences } from './audience.ts';
import type { Org, Review } from './types.ts';

/** What an admin types in for one organisation. */
export interface NewOrgInput {
  name: string;
  url: string;
  area?: string;
  kind?: string;
  focus?: string[];
  charityNumber?: string;
  registerNote?: string;
  audiences?: string[];
  postcode?: string;
  coverage?: string;
  nations?: string[];
  serves?: string[];
}

export const AREAS = ['UK', 'England', 'Scotland', 'Wales', 'Northern Ireland'];
export const KINDS = [
  'Registered charity', 'National charity', 'Regional charity', 'Local charity', 'User-led organisation',
  'Community interest company', 'Community group', 'NHS or government service', 'Not sure',
];
export const FOCUS = [
  'autism', 'ADHD', 'dyslexia', 'dyspraxia (DCD)', 'Tourette syndrome', 'developmental language disorder',
  'learning disability', 'SEND advice', 'neurodiversity', 'families',
];
export const MAX_PER_ADD = 25;

/** Plain, single-line text with nothing that could break the vault's tables or the HTML. */
export const clean = (s: unknown, max: number) =>
  String(s ?? '').replace(/[\u0000-\u001f<>|`\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

const bareHost = (url: string) => new URL(url).hostname.toLowerCase().replace(/^www\./, '');

/** A public http(s) website, tidied; null for anything else (IP addresses, localhost, other schemes). */
export function normaliseUrl(raw: string): string | null {
  let u = String(raw ?? '').trim();
  if (!u || u.length > 300) return null;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const x = new URL(u);
    const host = x.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(x.protocol) || x.username || x.password || x.port) return null;
    if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':')) return null;
    if (host === 'localhost' || /\.(local|localhost|internal|test|invalid)$/.test(host)) return null;
    const path = x.pathname === '/' ? '' : x.pathname.replace(/\/+$/, '');
    return `${x.protocol}//${host}${path}`;
  } catch {
    return null;
  }
}

export function slug(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'organisation';
}

/** Checks one new entry against the list. Returns the entry ready to save, or what is wrong in plain words. */
export function validateNew(input: NewOrgInput, existing: Org[], takenIds: Set<string>): { org?: Org; problems: string[] } {
  const problems: string[] = [];
  const name = clean(input.name, 120);
  if (name.length < 2) problems.push('Add the organisation’s name.');
  const url = normaliseUrl(input.url);
  if (!url) problems.push('Add a working website address, like https://www.example.org.uk.');
  const number = clean(input.charityNumber, 12).replace(/\s/g, '');
  if (number && !/^\d{6,8}$/.test(number)) problems.push('A charity number has 6 to 8 digits. Leave it blank if unsure.');
  if (url) {
    const twin = existing.find((o) => bareHost(o.url) === bareHost(url));
    if (twin) problems.push(`Already listed as ${twin.name}.`);
  }
  if (number && existing.some((o) => o.charityNumber === number)) problems.push(`Charity number ${number} is already listed.`);
  if (problems.length) return { problems };

  let id = slug(name);
  for (let n = 2; takenIds.has(id); n++) id = `${slug(name)}-${n}`;
  takenIds.add(id);
  const focus = (input.focus ?? []).map((f) => clean(f, 40)).filter(Boolean).slice(0, 10);
  const org: Org = {
    id,
    name,
    url: url!,
    area: clean(input.area, 60) || 'UK',
    kind: KINDS.includes(clean(input.kind, 60)) ? clean(input.kind, 60) : 'Not sure',
    focus: focus.length ? focus : ['neurodiversity'],
  };
  if (number) org.charityNumber = number;
  const postcode = ukPostcode(input.postcode);
  if (postcode) org.postcode = postcode;
  if (input.coverage === 'national' || input.coverage === 'local') org.coverage = input.coverage;
  const nations = NATIONS.filter((n) => (input.nations ?? []).includes(n));
  if (nations.length) org.nations = nations;
  const serves = (input.serves ?? []).map((s) => clean(s, 60)).filter(Boolean).slice(0, 30);
  if (serves.length) org.serves = serves;
  const audiences = cleanAudiences(input.audiences);
  if (audiences.length) org.audiences = audiences;
  const note = clean(input.registerNote, 120);
  if (note) org.registerNote = note;
  return { org, problems: [] };
}

/** Pasted lines: "name | website | area | charity number" (tabs from a spreadsheet work too). */
export function parseLines(text: string): NewOrgInput[] {
  return String(text ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [name = '', url = '', area = '', charityNumber = ''] = l.split(/\s*[|\t]\s*/);
      return { name, url, area, charityNumber };
    });
}

export type ReviewAction = 'remove' | 'restore' | 'still-running';

/** Applies an admin's decision. Removing archives the entry (never deletes); restoring undoes it. */
export function applyReview(orgs: Org[], id: string, action: ReviewAction, by: string, today: string, reason?: string): { orgs: Org[]; problem?: string } {
  const org = orgs.find((o) => o.id === id);
  if (!org) return { orgs, problem: 'That organisation is not on the list.' };
  const note = clean(reason, 200);
  const next = orgs.map((o) => {
    if (o.id !== id) return o;
    const copy: Org = { ...o };
    if (action === 'restore') delete copy.review;
    else {
      const review: Review = { status: action === 'remove' ? 'Closed' : 'Still running', date: today, by: clean(by, 60) };
      if (note) review.note = note;
      copy.review = review;
    }
    return copy;
  });
  if (action === 'remove' && !note) return { orgs, problem: 'Say why it is being removed.' };
  return { orgs: next };
}

const ACRONYMS = new Set(['ADHD', 'OCD', 'DLD', 'DCD', 'UK', 'NI', 'CIO', 'SCIO', 'CIC', 'PMLD', 'SEN', 'SEND', 'ABI', 'TBI', 'NHS', 'YMCA', 'ADD', 'LD']);
const SMALL = new Set(['and', 'of', 'the', 'for', 'in', 'with', 'on', 'at', 'to', 'a', 'an', 'by', 'or']);

/** Register names are often ALL CAPITALS: "BRENT MENCAP" → "Brent Mencap", keeping ADHD, UK, CIO and the like. */
export function tidyName(name: string): string {
  const letters = name.replace(/[^A-Za-z]/g, '');
  if (letters.length < 4 || letters !== letters.toUpperCase()) return name;
  return name.toLowerCase().split(/(\s+|-|\/|\()/).map((w, i) => {
    const up = w.toUpperCase();
    if (ACRONYMS.has(up.replace(/[^A-Z]/g, '')) && up.replace(/[^A-Z]/g, '').length === w.replace(/[^a-z]/gi, '').length) return up;
    if (i > 0 && SMALL.has(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join('').replace(/\bLtd\b/i, 'Ltd').replace(/'S\b/g, "'s");
}

/** orgs.json in the repo's one-entry-per-line style. */
export const serialiseOrgs = (orgs: Org[]) => `[\n${orgs.map((o) => `  ${JSON.stringify(o)}`).join(',\n')}\n]\n`;
