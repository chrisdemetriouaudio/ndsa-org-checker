import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSite } from './check.ts';
import { renderDashboardBlock, renderLivePage, renderNewFlags, renderSite, replaceBetweenMarkers } from './render.ts';
import type { Register } from './registerTypes.ts';
import { decideStatus } from './status.ts';
import { FLAGGED, HISTORY_LIMIT, type Org, type State } from './types.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = (...p: string[]) => join(root, ...p);
const CONCURRENCY = 6;

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

async function write(file: string, text: string) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, text);
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: limit }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) await fn(item);
  }));
}

async function main() {
  const renderOnly = process.argv.includes('--render-only');
  // --only=a,b visits just those organisations (new entries); everyone else is only re-rendered.
  const onlyArg = process.argv.find((a) => a.startsWith('--only='));
  const only = onlyArg ? new Set(onlyArg.slice(7).split(',').filter(Boolean)) : null;
  const orgs = await readJson<Org[]>(path('data/orgs.json'), []);
  const state = await readJson<State>(path('data/state.json'), { updated: null, orgs: {} });
  const register = await readJson<Register>(path('data/register.json'), { extractDate: null, entries: {} });
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const newly: { org: Org; s: State['orgs'][string] }[] = [];

  await pool(orgs, CONCURRENCY, async (org) => {
    const prev = state.orgs[org.id];
    let history = prev?.history ?? [];
    if (!renderOnly && org.review?.status !== 'Closed' && (!only || only.has(org.id))) {
      const result = await checkSite(org.url, today);
      history = [...history.filter((h) => h.date !== today), result].slice(-HISTORY_LIMIT);
      const mark = result.reachable ? 'ok ' : 'DOWN';
      console.log(`${mark} ${String(result.httpStatus ?? result.error).padEnd(8)} ${org.name}`);
    }
    const { status, reasons, proven, signals, score } = decideStatus(org, history, today, register);
    const s = {
      status,
      reasons,
      since: prev && prev.status === status ? prev.since : today,
      lastChecked: history.at(-1)?.date ?? null,
      proven,
      score,
      signals,
      history,
    };
    state.orgs[org.id] = s;
    if (FLAGGED.includes(status) && !FLAGGED.includes(prev?.status ?? 'Looks active')) newly.push({ org, s });
  });

  // Forget organisations removed from the list.
  for (const id of Object.keys(state.orgs)) if (!orgs.some((o) => o.id === id)) delete state.orgs[id];
  if (!renderOnly && !only) state.updated = now; // "last check" means the full daily run

  await write(path('data/state.json'), `${JSON.stringify(state, null, 2)}\n`);
  await write(path('ndsa-PMO/30 Live/Live status.md'), renderLivePage(orgs, state));
  await write(path('site/index.html'), renderSite(orgs, state));

  const dashboardFile = path('ndsa-PMO/00 Start here/00 Dashboard.md');
  const dashboard = await readFile(dashboardFile, 'utf8').catch(() => null);
  if (dashboard) await write(dashboardFile, replaceBetweenMarkers(dashboard, renderDashboardBlock(orgs, state)));

  // The workflow posts this as a GitHub issue comment, which e-mails watchers.
  await rm(path('out/new-flags.md'), { force: true });
  if (newly.length) await write(path('out/new-flags.md'), renderNewFlags(newly));
  console.log(`\n${orgs.length} services, ${newly.length} newly flagged.`);
}

await main();
