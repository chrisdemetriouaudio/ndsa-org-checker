/**
 * Finds UK organisations that may support people with the conditions in src/conditions.ts, for a person
 * to review. Nothing found here goes on the directory until an admin adds it.
 *
 * Stage 1 sources (all free, Open Government Licence):
 *  - England and Wales: Charity Commission daily extract (charity + area of operation)
 *  - Scotland: OSCR Scottish Charity Register download (attribution required; no direct marketing)
 *  - Northern Ireland: Charity Commission for Northern Ireland register export
 *
 * Writes data/candidates.json (one candidate per line) and ndsa-PMO/30 Live/Candidates.md.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inferAudiences } from './audience.ts';
import { candidateToInput, isClear, MAX_AUTO_ADD, NATIONS, pickAutoAdds, type Candidate, type Decision, type Nation, type SiteVerdict } from './candidates.ts';
import { checkSite } from './check.ts';
import { matchConditions } from './conditions.ts';
import { dateWords } from './dates.ts';
import { normaliseUrl, serialiseOrgs, validateNew } from './neworg.ts';
import { downloadOnce, forEachZipLine } from './register.ts';
import type { Org } from './types.ts';

export { NATIONS, type Candidate, type Decision, type Nation } from './candidates.ts';

const CCEW = 'https://ccewuksprdoneregsadata1.blob.core.windows.net/data/json';
const OSCR_ZIP = 'https://www.oscr.org.uk/download/charity-register';
const CCNI_CSV = 'https://www.charitycommissionni.org.uk/api/charity-search/exportSearchResultsToCsv/?homePageId=c0884e5e-b621-4563-a378-2b313e15c74a&pageNumber=1&sortOption=Rank%3Basc&searchText=';

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
type About = Map<string, { text: string; categories: string }>;

async function fromEnglandAndWales(listed: Listed, about: About): Promise<Candidate[]> {
  const found = new Map<string, Candidate>();
  const text = new Map<string, string>(); // number -> activities, for found and listed charities
  await forEachZipLine(`${CCEW}/publicextract.charity.zip`, (line) => {
    if (!line.includes('"linked_charity_number":0') || !line.includes('"Registered"')) return;
    const r = jsonLine(line);
    if (!r || r.charity_registration_status !== 'Registered') return;
    const number = String(r.registered_charity_number);
    const name = tidy(r.charity_name);
    const activities = tidy(r.charity_activities);
    if (listed.byNumber.has(number)) text.set(number, `${name} · ${activities}`);
    const m = matchConditions(name, activities);
    if (!m) return;
    text.set(number, `${name} · ${activities}`);
    found.set(number, {
      key: `ccew:${number}`, source: 'ccew', number, name, website: site(r.charity_contact_web),
      nations: [], area: '', form: tidy(r.charity_type) || 'Registered charity', audiences: [], ...m,
    });
  });
  const areas = new Map<string, { description: string; welsh: boolean; type: string }[]>();
  await forEachZipLine(`${CCEW}/publicextract.charity_area_of_operation.zip`, (line) => {
    if (!line.includes('"linked_charity_number":0')) return;
    const r = jsonLine(line);
    const number = r && String(r.registered_charity_number);
    if (!r || !number || !found.has(number)) return;
    const list = areas.get(number) ?? [];
    list.push({ description: tidy(r.geographic_area_description), welsh: r.welsh_ind === true, type: tidy(r.geographic_area_type) });
    areas.set(number, list);
  });
  const who = new Map<string, string[]>(); // the register's "who it helps" categories
  await forEachZipLine(`${CCEW}/publicextract.charity_classification.zip`, (line) => {
    if (!line.includes('"Who"') || !line.includes('"linked_charity_number":0')) return;
    const r = jsonLine(line);
    const number = r && String(r.registered_charity_number);
    if (!r || !number || !text.has(number) || r.classification_type !== 'Who') return;
    who.set(number, [...(who.get(number) ?? []), tidy(r.classification_description)]);
  });
  for (const [number, c] of found) {
    const list = areas.get(number) ?? [];
    c.nations = ccewNations(list);
    c.area = list.filter((a) => a.type !== 'Country').map((a) => a.description).slice(0, 4).join(', ') || 'England and Wales';
    c.audiences = inferAudiences(text.get(number) ?? '', (who.get(number) ?? []).join(', '));
  }
  for (const [number, id] of listed.byNumber) {
    if (text.has(number)) about.set(id, { text: text.get(number)!, categories: (who.get(number) ?? []).join(', ') });
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
    if (listedId) about.set(listedId, { text: `${name} · ${description}`, categories: tidy(r['Beneficiaries']) });
    const m = matchConditions(name, description);
    if (!m) return [];
    return [{
      key: `oscr:${r['Charity Number']}`, source: 'oscr' as const, number: r['Charity Number'], name, website,
      nations: ['Scotland' as Nation], area: tidy(r['Main Operating Location']) || tidy(r['Geographical Spread']) || 'Scotland',
      form: tidy(r['Constitutional Form']).replace(/\s*\(.*\)$/, '') || 'Scottish charity',
      audiences: inferAudiences(`${name} · ${description}`, tidy(r['Beneficiaries'])), ...m,
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
    if (listedId) about.set(listedId, { text: `${name} · ${tidy(r['What the charity does'])}`, categories: helps });
    const m = matchConditions(name, description);
    if (!m) return [];
    return [{
      key: `ccni:${r['Reg charity number']}`, source: 'ccni' as const, number: r['Reg charity number'], name, website,
      nations: ['Northern Ireland' as Nation], area: 'Northern Ireland', form: tidy(r['Type of governing document']) || 'NI charity',
      audiences: inferAudiences(`${name} · ${tidy(r['What the charity does'])}`, helps), ...m,
    }];
  });
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
    `> **Not added yet.** An admin reviews them on the admin page before anything goes on the directory.`,
    ...(failed.length ? [`> 🔴 **Could not read:** ${failed.join(', ')}. Those nations may be missing.`] : []),
    '> This page rewrites itself each time discovery runs (every morning).',
    '',
    `## 🆕 New on ${dateWords(today)}`,
    '',
    ...(note ? [`🔴 ${note}`, ''] : []),
    added.length ? `**Added to the directory automatically (${added.length}):** named for a condition, with a working website.` : '- Nothing was added automatically.',
    ...added.map((c) => `- ✅ ${c.name} (${c.nations.join(', ')}): ${c.conditions.join(', ')}`),
    '',
    newForReview.length ? `**New, waiting for review (${newForReview.length}):** Admin → Review candidates → "New only".` : '- No new ones waiting for review.',
    ...newForReview.slice(0, 30).map((c) => `- 👉 ${c.name} (${c.nations.join(', ')}): ${c.conditions.join(', ')}`),
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
async function checkSites(list: Candidate[], today: string): Promise<Map<string, SiteVerdict>> {
  const verdicts = new Map<string, SiteVerdict>();
  const queue = [...list];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const r = await checkSite(c.website!, today);
      const why = !r.reachable ? `website did not answer (${r.error ?? r.httpStatus})` : r.closedPhrases.length ? `website says "${r.closedPhrases[0]}"`
        : r.parkedPhrases.length ? 'website looks parked or for sale' : r.movedTo ? `website now goes to ${r.movedTo}` : '';
      verdicts.set(c.key, { ok: !why, why: why || 'website answered cleanly' });
    }
  }));
  return verdicts;
}

function alertText(today: string, added: Candidate[], review: Candidate[], verdicts: Map<string, SiteVerdict>, note: string | null): string {
  return [
    `**New organisations found on ${dateWords(today)}**`, '',
    ...(note ? [`🔴 ${note}`, ''] : []),
    ...(added.length ? [`Added to the directory automatically (${added.length}):`, ...added.map((c) => `- ✅ **${c.name}** (${c.nations.join(', ')}): ${c.conditions.join(', ')}. ${c.website}`), ''] : []),
    ...(review.length ? [`Waiting for review on the admin page (${review.length}):`, ...review.slice(0, 40).map((c) => {
      const v = verdicts.get(c.key);
      const why = !c.inName ? 'mentions a condition, not named for it' : !c.website ? 'no website on the register' : v && !v.ok ? v.why : 'needs a look';
      return `- 👉 **${c.name}** (${c.nations.join(', ')}): ${why}.`;
    }), ...(review.length > 40 ? [`- …and ${review.length - 40} more.`] : []), ''] : []),
    'Review: https://ndsa.labs.chrisdemetriou.com/admin/candidates',
  ].join('\n');
}

/** Finds candidates, adds clear new ones, and writes the review list. Returns the ids it added. */
export async function discover(): Promise<string[]> {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const path = (p: string) => join(root, p);
  const read = async <T>(p: string, fallback: T) => readFile(path(p), 'utf8').then((t) => JSON.parse(t) as T, () => fallback);
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
    if (org.audiences?.length || !info) continue;
    const found = inferAudiences(info.text, info.categories);
    if (found.length) { org.audiences = found; filled++; }
  }
  if (filled) {
    await writeFile(path('data/orgs.json'), serialiseOrgs(listed));
    console.log(`Filled in who it is for: ${filled} listed organisations.`);
  }
  let candidates = shortlist(parts.flat(), listed, decided);
  // Baseline = the first run. Only candidates first seen after it are shown as NEW.
  const baseline = previousFile?.baseline ?? previousFile?.updated ?? today;
  for (const c of candidates) c.firstSeen = previous.get(c.key)?.firstSeen ?? (previousFile ? today : baseline);

  // New = not in yesterday's list. The very first run has no yesterday, so nothing counts as new.
  const fresh = previousFile ? candidates.filter((c) => !previous.has(c.key)) : [];
  const clear = fresh.filter(isClear);
  const verdicts = clear.length && clear.length <= MAX_AUTO_ADD ? await checkSites(clear, today) : new Map<string, SiteVerdict>();
  const { add, review, note } = pickAutoAdds(fresh, verdicts);

  const added: Candidate[] = [];
  const addedIds: string[] = [];
  if (add.length) {
    const orgs = [...listed];
    const taken = new Set(orgs.map((o) => o.id));
    for (const c of add) {
      const v = validateNew(candidateToInput(c), orgs, taken);
      if (v.org) { orgs.push(v.org); added.push(c); addedIds.push(v.org.id); }
    }
    for (const c of added) decided[c.key] = { decision: 'added', by: 'daily discovery (automatic)', date: today };
    await writeFile(path('data/orgs.json'), serialiseOrgs(orgs));
    await writeFile(path('data/candidate-decisions.json'), `${JSON.stringify(decided, null, 2)}\n`);
    const addedKeys = new Set(added.map((c) => c.key));
    candidates = candidates.filter((c) => !addedKeys.has(c.key));
  }
  const reviewLeft = review.filter((c) => !added.some((a) => a.key === c.key));

  await writeFile(path('data/candidates.json'), `{"updated":"${today}","baseline":"${baseline}","candidates":[\n${candidates.map((c) => JSON.stringify(c)).join(',\n')}\n]}\n`);
  await writeFile(path('ndsa-PMO/30 Live/Candidates.md'), summary(candidates, failed, today, added, reviewLeft, note));
  if (added.length || reviewLeft.length || note) {
    await mkdir(path('out'), { recursive: true });
    await writeFile(path('out/discover-alert.md'), alertText(today, added, reviewLeft, verdicts, note));
  }
  for (const n of NATIONS) console.log(`${n}: ${candidates.filter((c) => c.nations.includes(n)).length}`);
  console.log(`${candidates.length} candidates. New today: ${fresh.length} (added ${added.length}, for review ${reviewLeft.length}).${failed.length ? ` Failed: ${failed.join(', ')}` : ''}`);
  if (failed.length) process.exitCode = 1;
  return addedIds;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await discover();
