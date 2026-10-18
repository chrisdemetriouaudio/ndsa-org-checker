/**
 * The checker's lookups, rebuilt every morning from the three charity registers:
 *   host/<bucket>.json   website host -> the charities that list it
 *   number/<bucket>.json charity number -> its register status (removed charities too: the proof of closure)
 * Split into many small files so the checker reads only a few KB per check. Published to the `lookup` branch.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostKey, hostShard, numberShard, type LookupEntry } from './lookupKeys.ts';

export * from './lookupKeys.ts';

async function build(outDir: string) {
  const { forEachZipLine, downloadOnce } = await import('./register.ts');
  const { parseCsv } = await import('./discover.ts');
  const { normaliseUrl } = await import('./neworg.ts');
  const hosts = new Map<string, Record<string, LookupEntry[]>>();
  const numbers = new Map<string, Record<string, LookupEntry>>();
  const addNumber = (e: LookupEntry) => {
    const shard = numberShard(e[1]);
    const m = numbers.get(shard) ?? {};
    m[e[1]] = e;
    numbers.set(shard, m);
  };
  const addHost = (web: unknown, e: LookupEntry) => {
    const url = typeof web === 'string' && web.trim() ? normaliseUrl(web) : null;
    if (!url) return;
    const host = hostKey(new URL(url).hostname);
    const shard = hostShard(host);
    const m = hosts.get(shard) ?? {};
    (m[host] ??= []).push(e);
    hosts.set(shard, m);
  };
  const day = (s: unknown) => (typeof s === 'string' ? s.slice(0, 10) : '');
  const name = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);

  // England and Wales: every main charity (removed ones too).
  await forEachZipLine('https://ccewuksprdoneregsadata1.blob.core.windows.net/data/json/publicextract.charity.zip', (line) => {
    if (!line.includes('"linked_charity_number":0')) return;
    const s = line.replace(/^﻿?[[,]/, '').replace(/]$/, '');
    if (!s.startsWith('{')) return;
    const r = JSON.parse(s) as Record<string, unknown>;
    const flags = `${r.charity_insolvent === true ? 'i' : ''}${r.charity_in_administration === true ? 'a' : ''}${r.cio_is_dissolved === true ? 'd' : ''}${/overdue|double default/i.test(String(r.charity_reporting_status)) ? 'o' : ''}${r.charity_reporting_status === 'Suppressed' ? 's' : ''}`;
    const e: LookupEntry = ['e', String(r.registered_charity_number), name(r.charity_name), r.charity_registration_status === 'Removed' ? 'X' : 'R', day(r.date_of_removal), flags, day(r.latest_acc_fin_period_end_date)];
    addNumber(e);
    if (e[3] === 'R') addHost(r.charity_contact_web, e);
  });

  // Scotland: current charities.
  let oscr = '';
  await forEachZipLine('https://www.oscr.org.uk/download/charity-register', (line) => { oscr += `${line}\n`; });
  for (const r of parseCsv(oscr)) {
    const e: LookupEntry = ['s', r['Charity Number'], name(r['Charity Name']), 'R', '', r['Charity Status'] === 'Not Submitted' ? 'o' : '', ''];
    addNumber(e);
    addHost(r['Website'], e);
  }

  // Northern Ireland: current and removed charities.
  const ni = parseCsv(await readFile(await downloadOnce('https://www.charitycommissionni.org.uk/api/charity-search/exportSearchResultsToCsv/?homePageId=c0884e5e-b621-4563-a378-2b313e15c74a&pageNumber=1&sortOption=Rank%3Basc&searchText='), 'utf8'));
  for (const r of ni) {
    const removed = /removed/i.test(r['Status']);
    const e: LookupEntry = ['n', r['Reg charity number'], name(r['Charity name']), removed ? 'X' : 'R', '', /overdue/i.test(r['Status']) ? 'o' : '', ''];
    addNumber(e);
    if (!removed) addHost(r['Website'], e);
  }

  await rm(outDir, { recursive: true, force: true });
  await mkdir(join(outDir, 'host'), { recursive: true });
  await mkdir(join(outDir, 'number'), { recursive: true });
  // An address shared by many charities is a platform (facebook.com, a council site), not anyone's own website.
  for (const m of hosts.values()) for (const [h, list] of Object.entries(m)) if (list.length > 20) delete m[h];
  for (const [shard, m] of hosts) await writeFile(join(outDir, 'host', `${shard}.json`), JSON.stringify(m));
  for (const [shard, m] of numbers) await writeFile(join(outDir, 'number', `${shard}.json`), JSON.stringify(m));
  const count = (m: Map<string, Record<string, unknown>>) => [...m.values()].reduce((t, x) => t + Object.keys(x).length, 0);
  await writeFile(join(outDir, 'about.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), hosts: count(hosts), numbers: count(numbers) }));
  console.log(`Lookup: ${count(hosts)} websites in ${hosts.size} files, ${count(numbers)} charity numbers in ${numbers.size} files.`);
}

/** Builds the lookup into out/lookup (the workflow publishes it to the `lookup` branch). */
export async function buildLookup() {
  await build(join(dirname(fileURLToPath(import.meta.url)), '..', 'out', 'lookup'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await buildLookup();
