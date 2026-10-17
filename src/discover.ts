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
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchConditions } from './conditions.ts';
import { dateWords } from './dates.ts';
import { normaliseUrl } from './neworg.ts';
import { forEachZipLine } from './register.ts';
import type { Org } from './types.ts';

export type Nation = 'England' | 'Wales' | 'Scotland' | 'Northern Ireland';
export const NATIONS: Nation[] = ['England', 'Wales', 'Scotland', 'Northern Ireland'];

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
}

export interface Decision { decision: 'added' | 'rejected'; by: string; date: string }

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

async function fromEnglandAndWales(): Promise<Candidate[]> {
  const found = new Map<string, Candidate>();
  await forEachZipLine(`${CCEW}/publicextract.charity.zip`, (line) => {
    if (!line.includes('"linked_charity_number":0') || !line.includes('"Registered"')) return;
    const r = jsonLine(line);
    if (!r || r.charity_registration_status !== 'Registered') return;
    const name = tidy(r.charity_name);
    const m = matchConditions(name, tidy(r.charity_activities));
    if (!m) return;
    const number = String(r.registered_charity_number);
    found.set(number, {
      key: `ccew:${number}`, source: 'ccew', number, name, website: site(r.charity_contact_web),
      nations: [], area: '', form: tidy(r.charity_type) || 'Registered charity', ...m,
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
  for (const [number, c] of found) {
    const list = areas.get(number) ?? [];
    c.nations = ccewNations(list);
    c.area = list.filter((a) => a.type !== 'Country').map((a) => a.description).slice(0, 4).join(', ') || 'England and Wales';
  }
  return [...found.values()];
}

async function fromScotland(): Promise<Candidate[]> {
  let text = '';
  await forEachZipLine(OSCR_ZIP, (line) => { text += `${line}\n`; });
  return parseCsv(text).flatMap((r) => {
    if (!['Active', 'Not Submitted'].includes(r['Charity Status'])) return [];
    const name = tidy(r['Charity Name']);
    const description = [r['Known As'], r['Objectives'], r['Activities'], r['What the charity is set up to do and how it does this']].map(tidy).join(' · ');
    const m = matchConditions(name, description);
    if (!m) return [];
    return [{
      key: `oscr:${r['Charity Number']}`, source: 'oscr' as const, number: r['Charity Number'], name, website: site(r['Website']),
      nations: ['Scotland' as Nation], area: tidy(r['Main Operating Location']) || tidy(r['Geographical Spread']) || 'Scotland',
      form: tidy(r['Constitutional Form']).replace(/\s*\(.*\)$/, '') || 'Scottish charity', ...m,
    }];
  });
}

async function fromNorthernIreland(): Promise<Candidate[]> {
  const res = await fetch(CCNI_CSV);
  if (!res.ok) throw new Error(`Northern Ireland register download failed: HTTP ${res.status}`);
  return parseCsv(await res.text()).flatMap((r) => {
    if (/removed/i.test(r['Status'])) return [];
    const name = tidy(r['Charity name']);
    // "Who the charity helps" is a tick-box list; many groups tick a dozen boxes. Only a short list (3 or fewer)
    // says the charity is focused on those people.
    const helps = tidy(r['Who the charity helps']);
    const focused = helps && helps.split(',').length <= 3 ? helps : '';
    const description = [r['Other name'], r['What the charity does'], focused].map(tidy).join(' · ');
    const m = matchConditions(name, description);
    if (!m) return [];
    return [{
      key: `ccni:${r['Reg charity number']}`, source: 'ccni' as const, number: r['Reg charity number'], name, website: site(r['Website']),
      nations: ['Northern Ireland' as Nation], area: 'Northern Ireland', form: tidy(r['Type of governing document']) || 'NI charity', ...m,
    }];
  });
}

const host = (url: string | null) => (url ? new URL(url).hostname.replace(/^www\./, '') : null);

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

function summary(candidates: Candidate[], failed: string[], today: string): string {
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
    '> This page rewrites itself each time discovery runs.',
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

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const read = async <T>(p: string, fallback: T) => readFile(join(root, p), 'utf8').then((t) => JSON.parse(t) as T, () => fallback);
  const listed = await read<Org[]>('data/orgs.json', []);
  const decided = await read<Record<string, Decision>>('data/candidate-decisions.json', {});
  const today = new Date().toISOString().slice(0, 10);

  const failed: string[] = [];
  const parts = await Promise.all([
    fromEnglandAndWales().catch((e) => { failed.push('England and Wales'); console.error(e); return []; }),
    fromScotland().catch((e) => { failed.push('Scotland'); console.error(e); return []; }),
    fromNorthernIreland().catch((e) => { failed.push('Northern Ireland'); console.error(e); return []; }),
  ]);
  const candidates = shortlist(parts.flat(), listed, decided);

  await writeFile(join(root, 'data/candidates.json'), `{"updated":"${today}","candidates":[\n${candidates.map((c) => JSON.stringify(c)).join(',\n')}\n]}\n`);
  await writeFile(join(root, 'ndsa-PMO/30 Live/Candidates.md'), summary(candidates, failed, today));
  for (const n of NATIONS) console.log(`${n}: ${candidates.filter((c) => c.nations.includes(n)).length}`);
  console.log(`${candidates.length} candidates (${candidates.filter((c) => c.inName).length} named for a condition).${failed.length ? ` Failed: ${failed.join(', ')}` : ''}`);
  if (failed.length) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
