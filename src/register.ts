import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

/** Downloads the register and keeps the main charities `keep` accepts. Streams: unzipped it is about 500 MB. */
export async function downloadRegister(keep: (entry: RegisterEntry) => boolean): Promise<Register> {
  const dir = await mkdtemp(join(tmpdir(), 'ccew-'));
  const zip = join(dir, 'register.zip');
  try {
    const res = await fetch(REGISTER_ZIP);
    if (!res.ok || !res.body) throw new Error(`Register download failed: HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(zip));

    const unzip = spawn('unzip', ['-p', zip], { stdio: ['ignore', 'pipe', 'inherit'] });
    const register: Register = { extractDate: null, entries: {} };
    for await (const line of createInterface({ input: unzip.stdout })) {
      if (!line.includes('"linked_charity_number":0')) continue;
      const entry = parseRegisterLine(line);
      if (!entry) continue;
      const { extractDate, ...rest } = entry;
      register.extractDate ??= extractDate;
      if (keep(rest)) register.entries[rest.number] = rest;
    }
    return register;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Refreshes data/register.json for every charity number on our list. */
async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const orgs = JSON.parse(await readFile(join(root, 'data/orgs.json'), 'utf8')) as Org[];
  const wanted = new Set(orgs.map((o) => o.charityNumber).filter(Boolean));
  const register = await downloadRegister((e) => wanted.has(e.number));
  const missing = [...wanted].filter((n) => !register.entries[n as string]);
  await writeFile(join(root, 'data/register.json'), `${JSON.stringify(register, null, 2)}\n`);
  console.log(`Register of ${register.extractDate}: found ${Object.keys(register.entries).length} of ${wanted.size} charities.`);
  if (missing.length) console.log(`Not found: ${missing.join(', ')}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
