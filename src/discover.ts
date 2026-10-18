/**
 * Finds UK organisations that may support people with the conditions in src/conditions.ts, for a person
 * to settle. Clear ones are added, misfits turned away, and anything still unclear after a week is parked: nobody has to review them.
 *
 * Stage 1 sources (all free, Open Government Licence):
 *  - England and Wales: Charity Commission daily extract (charity + area of operation)
 *  - Scotland: OSCR Scottish Charity Register download (attribution required; no direct marketing)
 *  - Northern Ireland: Charity Commission for Northern Ireland register export
 *
 * Writes data/candidates.json (one candidate per line) and NeuroSupport-PMO/30 Live/Candidates.md.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inferAudiences } from './audience.ts';
import { PARK_UNCLEAR_AFTER_DAYS, triage, type Verdict } from './triage.ts';
import { replaceBetweenMarkers } from './render.ts';
import { addMapPoints } from './geo.ts';
import { ccewCoverage, ccniCoverage, oscrCoverage, postcodeIn, ukPostcode, type Coverage } from './place.ts';
import { candidateToInput, NATIONS, planActions, siteOutcome, type Candidate, type Decision, type Nation, type SiteVerdict } from './candidates.ts';
import { checkSite } from './check.ts';
import { matchConditions } from './conditions.ts';
import { dateWords } from './dates.ts';
import { normaliseUrl, serialiseOrgs, validateNew } from './neworg.ts';
import { downloadOnce, forEachZipLine } from './register.ts';
import type { CheckResult, Org, State } from './types.ts';

export { NATIONS, type Candidate, type Decision, type Nation } from './candidates.ts';

const CCEW = 'https://ccewuksprdoneregsadata1.blob.core.windows.net/data/json';
export const OSCR_ZIP = 'https://www.oscr.org.uk/download/charity-register';
export const CCNI_CSV = 'https://www.charitycommissionni.org.uk/api/charity-search/exportSearchResultsToCsv/?homePageId=c0884e5e-b621-4563-a378-2b313e15c74a&pageNumber=1&sortOption=Rank%3Basc&searchText=';

/** RFC 4180 CSV: quoted fields may hold commas, quotes ("") and line breaks. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [head = [], ...body] = rows;
  const keys = head.map((h) => h.replace(/^﻿/, '').trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

const jsonLine = (line: string): Record<string, unknown> | null => {
  const s = line.replace(/^﻿?[[,]/, '').replace(/]$/, '');
  return s.startsWith('{') ? (JSON.parse(s) as Record<string, unknown>) : null;
};

/** England / Wales from the register's areas of operation (each area carries a Welsh flag). */
export function ccewNations(areas: { description: string; welsh: boolean; type: string }[]): Nation[] {
  const n = new Set<Nation>();
  for (const a of areas) {
    const d = a.description.toLowerCase();
    if (a.welsh || d.includes('wales')) n.add('Wales');
    if (d.includes('england') || (a.type === 'Local Authority' && !a.welsh) || (a.type === 'Region' && !a.welsh && !d.includes('wales'))) n.add('England');
    if (d === 'scotland') n.add('Scotland');
    if (d === 'northern ireland') n.add('Northern Ireland');
  }
  return n.size ? NATIONS.filter((x) => n.has(x)) : ['England'];
}

const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", '#39': "'", lt: '<', gt: '>', nbsp: ' ' };
const tidy = (s: unknown) => String(s ?? '').replace(/&(amp|quot|apos|#39|lt|gt|nbsp);/g, (_, e: string) => ENTITIES[e]).replace(/\s+/g, ' ').trim();
const site = (s: unknown) => (tidy(s) ? normaliseUrl(tidy(s)) : null);
const host = (url: string | null) => (url ? new URL(url).hostname.replace(/^www\./, '') : null);

/** Listed organisations, so register rows about them can fill in missing details (who they are for). */
interface Listed { byNumber: Map<string, string>; byHost: Map<string, string> }
/** What a register says about a listed organisation: free text and category labels. */
type About = Map<string, { text: string; categories: string; postcode?: string | null; coverage?: Coverage; nations?: Nation[]; serves?: string[]; number?: string }>;

async function fromEnglandAndWales(listed: Listed, about: About): Promise<Candidate[]> {
  const found = new Map<string, Candidate>();
  const text = new Map<string, string>(); // number -> activities, for found and listed charities
  const postcodes = new Map<string, string | null>();
  await forEachZipLine(`${CCEW}/publicextract.charity.zip`, (line) => {
    if (!line.includes('"linked_charity_number":0') || !line.includes('"Registered"')) return;
    const r = jsonLine(line);
    if (!r || r.charity_registration_status !== 'Registered') return;
    const number = String(r.registered_charity_number);
    const name = tidy(r.charity_name);
    const activities = tidy(r.charity_activities);
    if (listed.byNumber.has(number)) { text.set(number, `${name} · ${activities}`); postcodes.set(number, ukPostcode(r.charity_contact_postcode)); }
    const m = matchConditions(name, activities);
    if (!m) return;
    text.set(number, `${name} · ${activities}`);
    postcodes.set(number, ukPostcode(r.charity_contact_postcode));
    found.set(number, {
      key: `ccew:${number}`, source: 'ccew', number, name, website: site(r.charity_contact_web),
      nations: [], area: '', form: tidy(r.charity_type) || 'Registered charity', audiences: [], about: activities.slice(0, 400), ...m,
    });
  });
  const areas = new Map<string, { description: string; welsh: boolean; type: string }[]>();
  await forEachZipLine(`${CCEW}/publicextract.charity_area_of_operation.zip`, (line) => {
    if (!line.includes('"linked_charity_number":0')) return;
    const r = jsonLine(line);
    const number = r && String(r.registered_charity_number);
    if (!r || !number || !text.has(number)) return;
    const list = areas.get(number) ?? [];
    list.push({ description: tidy(r.geographic_area_description), welsh: r.welsh_ind === true, type: tidy(r.geographic_area_type) });
    areas.set(number, list);
  });
  const who = new Map<string, string[]>(); // the register's "who it helps" categories
  const how = new Map<string, string[]>(); // and its "how it works" ones: services, advice, grants...
  await forEachZipLine(`${CCEW}/publicextract.charity_classification.zip`, (line) => {
    if (!(line.includes('"Who"') || line.includes('"How"')) || !line.includes('"linked_charity_number":0')) return;
    const r = jsonLine(line);
    const number = r && String(r.registered_charity_number);
    if (!r || !number || !text.has(number)) return;
    const into = r.classification_type === 'Who' ? who : r.classification_type === 'How' ? how : null;
    into?.set(number, [...(into.get(number) ?? []), tidy(r.classification_description)]);
  });
  for (const [number, c] of found) {
    const list = areas.get(number) ?? [];
    c.nations = ccewNations(list);
    c.area = list.filter((a) => a.type !== 'Country').map((a) => a.description).slice(0, 4).join(', ') || 'England and Wales';
    c.audiences = inferAudiences(text.get(number) ?? '', (who.get(number) ?? []).join(', '));
    c.postcode = postcodes.get(number) ?? null;
    c.coverage = ccewCoverage(list.map((a) => a.description));
    c.serves = list.filter((a) => a.type !== 'Country').map((a) => a.description).slice(0, 30);
    c.how = (how.get(number) ?? []).join('; ') || undefined;
  }
  for (const [number, id] of listed.byNumber) {
    if (!text.has(number)) continue;
    const list = areas.get(number) ?? [];
    about.set(id, {
      text: text.get(number)!, categories: (who.get(number) ?? []).join(', '), postcode: postcodes.get(number) ?? null,
      coverage: ccewCoverage(list.map((a) => a.description)), nations: ccewNations(list),
      serves: list.filter((a) => a.type !== 'Country').map((a) => a.description).slice(0, 30),
    });
  }
  return [...found.values()];
}

async function fromScotland(listed: Listed, about: About): Promise<Candidate[]> {
  let text = '';
  await forEachZipLine(OSCR_ZIP, (line) => { text += `${line}\n`; });
  return parseCsv(text).flatMap((r) => {
    if (!['Active', 'Not Submitted'].includes(r['Charity Status'])) return [];
    const name = tidy(r['Charity Name']);
    const description = [r['Known As'], r['Objectives'], r['Activities'], r['What the charity is set up to do and how it does this']].map(tidy).join(' · ');
    const website = site(r['Website']);
    const listedId = website ? listed.byHost.get(host(website)!) : undefined;
    const postcode = ukPostcode(r['Postcode']);
    const coverage = oscrCoverage(tidy(r['Geographical Spread']));
    const place = tidy(r['Main Operating Location']);
    const serves = coverage === 'national' ? ['Throughout Scotland'] : place && !/outwith/i.test(place) ? [place] : [];
    if (listedId) about.set(listedId, { text: `${name} · ${description}`, categories: tidy(r['Beneficiaries']), postcode, coverage, nations: ['Scotland'], serves, number: tidy(r['Charity Number']) });
    const m = matchConditions(name, description);
    if (!m) return [];
    return [{
      key: `oscr:${r['Charity Number']}`, source: 'oscr' as const, number: r['Charity Number'], name, website,
      nations: ['Scotland' as Nation], area: tidy(r['Main Operating Location']) || tidy(r['Geographical Spread']) || 'Scotland',
      form: tidy(r['Constitutional Form']).replace(/\s*\(.*\)$/, '') || 'Scottish charity',
      audiences: inferAudiences(`${name} · ${description}`, tidy(r['Beneficiaries'])), postcode, coverage, serves, about: description.slice(0, 400), how: tidy(r['Activities']) || undefined, ...m,
    }];
  });
}

async function fromNorthernIreland(listed: Listed, about: About): Promise<Candidate[]> {
  return parseCsv(await readFile(await downloadOnce(CCNI_CSV), 'utf8')).flatMap((r) => {
    if (/removed/i.test(r['Status'])) return [];
    const name = tidy(r['Charity name']);
    // "Who the charity helps" is a tick-box list; many groups tick a dozen boxes. Only a short list (3 or fewer)
    // says the charity is focused on those people, so only a short list counts towards matching a condition.
    const helps = tidy(r['Who the charity helps']);
    const focused = helps && helps.split(',').length <= 3 ? helps : '';
    const description = [r['Other name'], r['What the charity does'], focused].map(tidy).join(' · ');
    const website = site(r['Website']);
    const listedId = website ? listed.byHost.get(host(website)!) : undefined;
    const postcode = postcodeIn(r['Public address']);
    const coverage = ccniCoverage(`${name} · ${tidy(r['What the charity does'])}`);
    const serves = coverage === 'national' ? ['Throughout Northern Ireland'] : [];
    if (listedId) about.set(listedId, { text: `${name} · ${tidy(r['What the charity does'])}`, categories: helps, postcode, coverage, nations: ['Northern Ireland'], serves, number: `NIC${tidy(r['Reg charity number'])}` });
    const m = matchConditions(name, description);
    if (!m) return [];
    return [{
      key: `ccni:${r['Reg charity number']}`, source: 'ccni' as const, number: r['Reg charity number'], name, website,
      nations: ['Northern Ireland' as Nation], area: 'Northern Ireland', form: tidy(r['Type of governing document']) || 'NI charity',
      audiences: inferAudiences(`${name} · ${tidy(r['What the charity does'])}`, helps), postcode, coverage, serves, about: description.slice(0, 400), how: tidy(r['How the charity works']) || undefined, ...m,
    }];
  });
}


/** Parks every candidate still unclear PARK_UNCLEAR_AFTER_DAYS after it was first found. Returns how many it parked. */
export function parkStale(candidates: Candidate[], today: string): number {
  let n = 0;
  for (const c of candidates) {
    if (c.triage?.verdict !== 'review' || !c.firstSeen) continue;
    const days = (Date.parse(today) - Date.parse(c.firstSeen)) / 86_400_000;
    if (days < PARK_UNCLEAR_AFTER_DAYS) continue;
    c.triage = { ...c.triage, verdict: 'parked', reasons: [...c.triage.reasons, `still unclear ${PARK_UNCLEAR_AFTER_DAYS} days after it was found, so parked (never added)`] };
    n++;
  }
  return n;
}

/** Drops ones already listed or already decided, and the same organisation registered in two nations. */
export function shortlist(all: Candidate[], listed: Org[], decided: Record<string, Decision>): Candidate[] {
  const listedNumbers = new Set(listed.map((o) => o.charityNumber).filter(Boolean));
  const listedHosts = new Set(listed.map((o) => host(o.url)));
  const seenHosts = new Set<string>();
  return all
    .filter((c) => !decided[c.key] && !(c.source === 'ccew' && listedNumbers.has(c.number)) && !(c.website && listedHosts.has(host(c.website))))
    .sort((a, b) => Number(b.inName) - Number(a.inName) || a.name.localeCompare(b.name))
    .filter((c) => {
      const h = host(c.website);
      if (!h) return true;
      if (seenHosts.has(h)) return false;
      seenHosts.add(h);
      return true;
    });
}

function summary(candidates: Candidate[], failed: string[], today: string, added: Candidate[], newForReview: Candidate[], note: string | null): string {
  const conditions = [...new Set(candidates.flatMap((c) => c.conditions))].sort();
  const count = (n: Nation, cond?: string) => candidates.filter((c) => c.nations.includes(n) && (!cond || c.conditions.includes(cond))).length;
  const out = [
    '---', 'title: Candidates', `updated: ${today}`, '---', '',
    '# 🔎 Candidates', '',
    '> [!info] At a glance',
    `> **Found:** ${candidates.length} possible organisations on ${dateWords(today)}, from the charity registers of all 4 nations.`,
    `> **Named for a condition:** ${candidates.filter((c) => c.inName).length}. The rest mention one in their description.`,
    `> **Decided automatically every morning:** clear ones added (website checked), misfits turned away, anything unclear after ${PARK_UNCLEAR_AFTER_DAYS} days parked. Nobody has to review them.`,
    ...(failed.length ? [`> 🔴 **Could not read:** ${failed.join(', ')}. Those nations may be missing.`] : []),
    '> This page rewrites itself each time discovery runs (every morning).',
    '',
    `## 🆕 New on ${dateWords(today)}`,
    '',
    ...(note ? [`🔴 ${note}`, ''] : []),
    added.length ? `**Added to the directory automatically (${added.length}):** named for a condition, with a working website.` : '- Nothing was added automatically.',
    ...added.map((c) => `- ✅ ${c.name} (${c.nations.join(', ')}): ${c.conditions.join(', ')}`),
    '',
    newForReview.length ? `**New and still settling (${newForReview.length}):** decided within ${PARK_UNCLEAR_AFTER_DAYS} days. You can look at them in Admin → Review candidates, but you do not have to.` : '- No new ones still settling.',
    ...newForReview.slice(0, 30).map((c) => `- ⏳ ${c.name} (${c.nations.join(', ')}): ${c.conditions.join(', ')}`),
    ...(newForReview.length > 30 ? [`- …and ${newForReview.length - 30} more on the review page.`] : []),
    '',
    '## 🗺️ By nation and condition', '',
    `| Condition | ${NATIONS.join(' | ')} |`,
    `| --- | ${NATIONS.map(() => '---:').join(' | ')} |`,
    ...conditions.map((cond) => `| ${cond} | ${NATIONS.map((n) => count(n, cond)).join(' | ')} |`),
    `| **All** | ${NATIONS.map((n) => `**${count(n)}**`).join(' | ')} |`,
    '',
    'An organisation can count under more than one condition and more than one nation.',
    '',
    '> [!note]- Sources (tap to open)',
    '> - England and Wales: Charity Commission register of charities.',
    '> - Scotland: © Crown Copyright and database right ' + today.slice(0, 4) + '. Contains information from the Scottish Charity Register supplied by the Office of the Scottish Charity Regulator and licensed under the Open Government Licence v.3.0.',
    '> - Northern Ireland: Charity Commission for Northern Ireland register of charities (Open Government Licence).',
    '',
  ];
  return out.join('\n');
}

/** Visits each clear new candidate's website once; only a clean answer counts. */
async function checkSites(list: Candidate[], today: string, results?: Map<string, CheckResult>): Promise<Map<string, SiteVerdict>> {
  const verdicts = new Map<string, SiteVerdict>();
  const queue = [...list];
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const r = await checkSite(c.website!, today);
      const why = !r.reachable ? `website did not answer (${r.error ?? r.httpStatus})` : r.closedPhrases.length ? `website says "${r.closedPhrases[0]}"`
        : r.parkedPhrases.length ? 'website looks parked or for sale' : r.movedTo ? `website now goes to ${r.movedTo}` : '';
      verdicts.set(c.key, { ok: !why, why: why || 'website answered cleanly' });
      results?.set(c.key, r);
    }
  }));
  return verdicts;
}

function alertText(today: string, added: Candidate[], review: Candidate[], verdicts: Map<string, SiteVerdict>, note: string | null): string {
  return [
    `**New organisations found on ${dateWords(today)}**`, '',
    ...(note ? [`🔴 ${note}`, ''] : []),
    ...(added.length ? [`Added to the directory automatically (${added.length}):`, ...added.map((c) => `- ✅ **${c.name}** (${c.nations.join(', ')}): ${c.conditions.join(', ')}. ${c.website}`), ''] : []),
    ...(review.length ? [`Also found ${review.length} that are not clear yet. They are decided automatically within ${PARK_UNCLEAR_AFTER_DAYS} days; nothing to do.`, ''] : []),
    'All candidates: https://neurosupport.labs.chrisdemetriou.com/admin/candidates',
  ].join('\n');
}

/** Finds candidates, adds clear new ones, and writes the review list. Returns the ids it added. */
export async function discover(): Promise<string[]> {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const path = (p: string) => join(root, p);
  // A missing, empty or unreadable file counts as "nothing yet".
  const read = async <T>(p: string, fallback: T): Promise<T> => {
    try { const t = await readFile(path(p), 'utf8'); return t.trim() ? (JSON.parse(t) as T) : fallback; } catch { return fallback; }
  };
  const listed = await read<Org[]>('data/orgs.json', []);
  const decided = await read<Record<string, Decision>>('data/candidate-decisions.json', {});
  const previousFile = await read<{ updated?: string; baseline?: string; candidates: Candidate[] } | null>('data/candidates.json', null);
  const previous = new Map((previousFile?.candidates ?? []).map((c) => [c.key, c]));
  const today = new Date().toISOString().slice(0, 10);

  // If a register cannot be read today, keep yesterday's list for it, so its charities do not look "new" tomorrow.
  const failed: string[] = [];
  const keep = (source: Candidate['source']) => [...previous.values()].filter((c) => c.source === source);
  const index: Listed = {
    byNumber: new Map(listed.filter((o) => o.charityNumber).map((o) => [o.charityNumber!, o.id])),
    byHost: new Map(listed.map((o) => [host(o.url)!, o.id])),
  };
  const about: About = new Map();
  const parts = await Promise.all([
    fromEnglandAndWales(index, about).catch((e) => { failed.push('England and Wales'); console.error(e); return keep('ccew'); }),
    fromScotland(index, about).catch((e) => { failed.push('Scotland'); console.error(e); return keep('oscr'); }),
    fromNorthernIreland(index, about).catch((e) => { failed.push('Northern Ireland'); console.error(e); return keep('ccni'); }),
  ]);

  // Fill in who listed organisations are for, where they have nothing yet and a register says.
  let filled = 0;
  for (const org of listed) {
    const info = about.get(org.id);
    if (!info) continue;
    const before = JSON.stringify(org);
    if (!org.audiences?.length) {
      const found = inferAudiences(info.text, info.categories);
      if (found.length) org.audiences = found;
    }
    // Scottish and Northern Irish charities found by their website get their register number, so the register check covers them.
    if (!org.charityNumber && info.number && /^(SC|NIC)\d{6}$/.test(info.number)) { org.charityNumber = info.number; delete org.registerNote; }
    if (!org.postcode && info.postcode) org.postcode = info.postcode;
    if (!org.coverage && info.coverage) org.coverage = info.coverage;
    if (!org.nations?.length && info.nations?.length) org.nations = info.nations;
    if (!org.serves?.length && info.serves?.length) { org.serves = info.serves; org.servesFrom = 'register'; }
    if (org.serves?.length && !org.servesFrom) org.servesFrom = org.charityNumber || /Scottish/.test(org.registerNote ?? '') ? 'register' : 'office';
    if (JSON.stringify(org) !== before) filled++;
  }
  try {
    const points = await addMapPoints(listed);
    if (points) { filled += points; console.log(`Map points added: ${points}.`); }
  } catch (e) {
    console.error('Map points could not be added today; they will be tried tomorrow.', e);
  }
  if (filled) {
    await writeFile(path('data/orgs.json'), serialiseOrgs(listed));
    console.log(`Filled in details from the registers: ${filled} listed organisations.`);
  }
  let candidates = shortlist(parts.flat(), listed, decided);
  // Baseline = the first run. Only candidates first seen after it are shown as NEW.
  const baseline = previousFile?.baseline ?? previousFile?.updated ?? today;
  // A person's (or Claude's) reading of a description outranks the rules.
  const overrides = await read<Record<string, { verdict: Verdict; by: string; date: string; reason?: string }>>('data/triage-overrides.json', {});
  for (const c of candidates) {
    c.firstSeen = previous.get(c.key)?.firstSeen ?? (previousFile ? today : baseline);
    const t = triage({ name: c.name, description: c.about ?? c.snippet, inName: c.inName, conditions: c.conditions, website: c.website, how: c.how });
    const o = overrides[c.key];
    c.triage = o ? {
      ...t,
      verdict: o.verdict === 'add' && !c.website ? 'no-website' : o.verdict,
      reasons: [...t.reasons, `${o.verdict === 'add' ? 'kept' : 'turned down'} after reading the description (${o.by}, ${dateWords(o.date)})${o.reason ? `: ${o.reason}` : ''}`],
    } : t;
  }

  // New = not in yesterday's list. The very first run has no yesterday, so nothing counts as new.
  const fresh = previousFile ? candidates.filter((c) => !previous.has(c.key)) : [];
  const freshKeys = new Set(fresh.map((c) => c.key));
  const { reject, check, note } = planActions(candidates, freshKeys);
  for (const c of reject) decided[c.key] = { decision: 'rejected', by: 'automatic triage', date: today, reason: c.triage!.reasons.join('; ') };

  // A website that already failed today is not visited again today (and does not count as another failed day).
  const failedToday = new Set(check.filter((c) => previous.get(c.key)?.siteFailedOn === today).map((c) => c.key));
  const visit = check.filter((c) => !failedToday.has(c.key));
  const siteResults = new Map<string, CheckResult>();
  const verdicts = visit.length ? await checkSites(visit, today, siteResults) : new Map<string, SiteVerdict>();
  const added: Candidate[] = [];
  const addedIds: string[] = [];
  const firstChecks = new Map<string, CheckResult>(); // new organisation id -> the visit that just passed
  const orgs = [...listed];
  const taken = new Set(orgs.map((o) => o.id));
  for (const c of check) {
    if (failedToday.has(c.key)) {
      const prev = previous.get(c.key)!;
      Object.assign(c, { siteFails: prev.siteFails, siteFailedOn: prev.siteFailedOn, triage: prev.triage });
      continue;
    }
    const r = siteResults.get(c.key);
    const o = r ? siteOutcome(c, r, previous.get(c.key)?.siteFails ?? 0) : { action: 'review' as const, why: 'not checked', fails: 0 };
    c.siteFails = o.fails || undefined;
    c.siteFailedOn = o.fails ? today : undefined;
    if (o.action === 'reject') {
      decided[c.key] = { decision: 'rejected', by: 'automatic triage', date: today, reason: [...c.triage!.reasons, o.why].join('; ') };
      reject.push(c);
      continue;
    }
    if (o.action === 'park' || o.action === 'review') {
      c.triage = { ...c.triage!, verdict: o.action === 'park' ? 'parked' : 'review', reasons: [...c.triage!.reasons, `website check: ${o.why}`] };
      continue;
    }
    if (o.action === 'add-moved') {
      c.website = o.newUrl!;
      r!.movedTo = null; // the new address is now its own address
      c.triage = { ...c.triage!, reasons: [...c.triage!.reasons, o.why] };
    }
    const v = validateNew(candidateToInput(c), orgs, taken);
    if (v.org) { orgs.push(v.org); added.push(c); addedIds.push(v.org.id); firstChecks.set(v.org.id, siteResults.get(c.key)!); decided[c.key] = { decision: 'added', by: 'automatic triage', date: today, reason: c.triage!.reasons.join('; ') }; }
  }
  if (added.length) {
    await writeFile(path('data/orgs.json'), serialiseOrgs(orgs));
    // Keep today's visit as each new organisation's first check, so the morning run does not visit it again today.
    const state = await read<State>('data/state.json', { updated: null, orgs: {} });
    for (const [id, r] of firstChecks) {
      if (!state.orgs[id]) state.orgs[id] = { status: 'Looks active', reasons: [], since: today, lastChecked: today, proven: false, score: null, signals: [], history: [r] };
    }
    await writeFile(path('data/state.json'), `${JSON.stringify(state, null, 2)}\n`);
  }
  if (added.length || reject.length) await writeFile(path('data/candidate-decisions.json'), `${JSON.stringify(decided, null, 2)}\n`);
  const gone = new Set([...reject, ...added].map((c) => c.key));
  candidates = candidates.filter((c) => !gone.has(c.key));
  // Nobody has to decide: anything still unclear a week after it was found is parked (never added).
  const parkedToday = parkStale(candidates, today);
  const reviewLeft = candidates.filter((c) => freshKeys.has(c.key) && c.triage?.verdict === 'review');

  await writeFile(path('data/candidates.json'), `{"updated":"${today}","baseline":"${baseline}","candidates":[\n${candidates.map((c) => JSON.stringify(c)).join(',\n')}\n]}\n`);
  await writeFile(path('NeuroSupport-PMO/30 Live/Candidates.md'), summary(candidates, failed, today, added, reviewLeft, note));
  if (added.length || note) {
    await mkdir(path('out'), { recursive: true });
    await writeFile(path('out/discover-alert.md'), alertText(today, added, reviewLeft, verdicts, note));
  }
  const dashboardFile = path('NeuroSupport-PMO/00 Start here/00 Dashboard.md');
  const dashboard = await readFile(dashboardFile, 'utf8').catch(() => '');
  const parked = candidates.filter((c) => c.triage?.verdict === 'parked').length;
  const waiting = candidates.filter((c) => c.triage?.verdict === 'review').length;
  if (dashboard) await writeFile(dashboardFile, replaceBetweenMarkers(dashboard, `> [!info] New organisations (decided automatically every morning)\n> **${dateWords(today)}:** added ${added.length} · turned away ${reject.length} · parked ${parkedToday}.\n> **Still settling:** ${waiting} (websites being retried, or found in the last ${PARK_UNCLEAR_AFTER_DAYS} days) · **Parked in total:** ${parked}. Nothing here needs you.`, 'candidates'));
  for (const n of NATIONS) console.log(`${n}: ${candidates.filter((c) => c.nations.includes(n)).length}`);
  const left: Record<string, number> = {};
  for (const c of candidates) left[c.triage!.verdict] = (left[c.triage!.verdict] ?? 0) + 1;
  console.log(`Added ${added.length}, turned down ${reject.length}, parked ${parkedToday}. Left: ${JSON.stringify(left)}. New today: ${fresh.length}.${failed.length ? ` Failed: ${failed.join(', ')}` : ''}`);
  if (failed.length) process.exitCode = 1;
  return addedIds;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await discover();
