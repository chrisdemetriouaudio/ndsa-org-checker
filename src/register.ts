import { spawn } from 'node:child_process';
import { createWriteStream, mkdtempSync, rmSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import type { Org } from './types.ts';

/** The Charity Commission's free daily register download (England and Wales). No API key needed. */
export const REGISTER_ZIP =
  'https://ccewuksprdoneregsadata1.blob.core.windows.net/data/json/publicextract.charity.zip';

import type { Register, RegisterEntry } from './registerTypes.ts';

export type { Register, RegisterEntry };

const day = (s: unknown) => (typeof s === 'string' ? s.slice(0, 10) : null);

/** One line of the extract → the main charity's entry, or null (linked sub-charities and other lines). */
export function parseRegisterLine(line: string): (RegisterEntry & { extractDate: string | null }) | null {
  const json = line.replace(/^﻿?[[,]/, '').replace(/]$/, '');
  if (!json.startsWith('{')) return null;
  const r = JSON.parse(json) as Record<string, unknown>;
  if (r.linked_charity_number !== 0) return null;
  return {
    extractDate: day(r.date_of_extract),
    number: String(r.registered_charity_number),
    name: String(r.charity_name ?? ''),
    status: String(r.charity_registration_status ?? ''),
    removedOn: day(r.date_of_removal),
    reporting: (r.charity_reporting_status as string | null) ?? null,
    lastAccounts: day(r.latest_acc_fin_period_end_date),
    insolvent: r.charity_insolvent === true,
    inAdministration: r.charity_in_administration === true,
    dissolved: r.cio_is_dissolved === true,
    web: (r.charity_contact_web as string | null) ?? null,
  };
}

// Each file is downloaded at most once per run, however many steps read it (finding new organisations,
// refreshing the register snapshot). Files live in a temporary folder that is removed when the run ends.
const downloads = new Map<string, Promise<string>>();
let tmp: string | null = null;
process.on('exit', () => { if (tmp) rmSync(tmp, { recursive: true, force: true }); });

export function downloadOnce(url: string): Promise<string> {
  let file = downloads.get(url);
  if (!file) {
    file = (async () => {
      tmp ??= mkdtempSync(join(tmpdir(), 'nsc-'));
      const path = join(tmp, `file-${downloads.size}`);
      // Up to 3 tries, a minute apart: a register's site or the runner's DNS sometimes has a bad moment.
      let res: Response | null = null;
      for (let attempt = 1; ; attempt++) {
        try {
          res = await fetch(url, { headers: { 'user-agent': 'neuro-support-checker/0.1 (+https://github.com/chrisdemetriouaudio/neuro-support-checker)' } });
          if (res.ok && res.body) break;
          if (res.status < 500 && res.status !== 429) break;
        } catch (e) {
          if (attempt >= 3) throw e;
        }
        if (attempt >= 3) break;
        await new Promise((r) => setTimeout(r, 60_000));
      }
      if (!res?.ok || !res.body) throw new Error(`Download failed (${url}): HTTP ${res?.status}`);
      await pipeline(Readable.fromWeb(res.body as never), createWriteStream(path));
      return path;
    })();
    file.catch(() => downloads.delete(url)); // a failed download may be retried by a later step
    downloads.set(url, file);
  }
  return file;
}

/** Hands each line of the file inside a (downloaded-once) zip to `onLine`, without unzipping to disk. */
export async function forEachZipLine(url: string, onLine: (line: string) => void): Promise<void> {
  const zip = await downloadOnce(url);
  const unzip = spawn('unzip', ['-p', zip], { stdio: ['ignore', 'pipe', 'inherit'] });
  for await (const line of createInterface({ input: unzip.stdout })) onLine(line);
}

/** Downloads the register and keeps the main charities `keep` accepts. Streams: unzipped it is about 500 MB. */
export async function downloadRegister(keep: (entry: RegisterEntry) => boolean): Promise<Register> {
  const register: Register = { extractDate: null, entries: {} };
  await forEachZipLine(REGISTER_ZIP, (line) => {
    if (!line.includes('"linked_charity_number":0')) return;
    const entry = parseRegisterLine(line);
    if (!entry) return;
    const { extractDate, ...rest } = entry;
    register.extractDate ??= extractDate;
    if (keep(rest)) register.entries[rest.number] = rest;
  });
  return register;
}

/** Refreshes data/register.json for every charity number on our list. */
export async function refreshRegister() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const orgs = JSON.parse(await readFile(join(root, 'data/orgs.json'), 'utf8')) as Org[];
  const wanted = new Set(orgs.map((o) => o.charityNumber).filter(Boolean));
  const register = await downloadRegister((e) => wanted.has(e.number));
  register.sources = ['e'];
  // Scotland and Northern Ireland: the same files discovery reads each morning (downloaded once per run).
  const { parseCsv, OSCR_ZIP, CCNI_CSV } = await import('./discover.ts');
  const { oscrEntry, ccniEntry } = await import('./registersUk.ts');
  try {
    let text = '';
    await forEachZipLine(OSCR_ZIP, (line) => { text += `${line}\n`; });
    for (const r of parseCsv(text)) if (wanted.has(r['Charity Number']?.trim())) { const e = oscrEntry(r); register.entries[e.number] = e; }
    register.sources.push('s');
  } catch (e) { console.error('Scottish register not read today:', e); }
  try {
    for (const r of parseCsv(await readFile(await downloadOnce(CCNI_CSV), 'utf8'))) {
      const e = ccniEntry(r);
      if (wanted.has(e.number)) register.entries[e.number] = e;
    }
    register.sources.push('n');
  } catch (e) { console.error('Northern Ireland register not read today:', e); }
  const missing = [...wanted].filter((n) => !register.entries[n as string]);
  await writeFile(join(root, 'data/register.json'), `${JSON.stringify(register, null, 2)}\n`);
  console.log(`Register of ${register.extractDate}: found ${Object.keys(register.entries).length} of ${wanted.size} charities.`);
  if (missing.length) console.log(`Not found: ${missing.join(', ')}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await refreshRegister();
