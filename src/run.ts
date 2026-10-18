import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSite, type RobotsCache } from './check.ts';
import { renderDashboardBlock, renderLivePage, renderNewFlags, renderSite, replaceBetweenMarkers } from './render.ts';
import type { Register } from './registerTypes.ts';
import { decideStatus, isDue } from './status.ts';
import { FLAGGED, HISTORY_LIMIT, type CheckResult, type Org, type State, type Summary } from './types.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = (...p: string[]) => join(root, ...p);
/** At most this many websites are visited at the same time, and never two requests at once to one site. */
const SITES_AT_ONCE = 8;

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

const hostOf = (url: string) => new URL(url).hostname.toLowerCase().replace(/^www\./, '');

export interface RunOptions {
  renderOnly?: boolean; // visit nothing, just rewrite the pages
  only?: Set<string>; // visit just these organisations (new entries), whatever their schedule
}

/** Visits the websites that are due, works out every organisation's status, and rewrites the outputs. */
export async function runChecks({ renderOnly = false, only }: RunOptions = {}) {
  const orgs = await readJson<Org[]>(path('data/orgs.json'), []);
  const state = await readJson<State>(path('data/state.json'), { updated: null, orgs: {} });
  const register = await readJson<Register>(path('data/register.json'), { extractDate: null, entries: {} });
  const robots: RobotsCache = state.robots ?? {};
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const newly: { org: Org; s: State['orgs'][string] }[] = [];

  // Which websites to visit today, grouped by site so each site gets one request at a time.
  const due = renderOnly ? [] : orgs.filter((o) => o.review?.status !== 'Closed' && (only ? only.has(o.id) : isDue(state.orgs[o.id], today)));
  const bySite = new Map<string, Org[]>();
  for (const o of due) bySite.set(hostOf(o.url), [...(bySite.get(hostOf(o.url)) ?? []), o]);
  const results = new Map<string, CheckResult>(); // by organisation id
  let visits = 0;
  await pool([...bySite.values()], SITES_AT_ONCE, async (group) => {
    const byUrl = new Map<string, CheckResult>(); // entries sharing a web address share one visit
    for (const org of group) {
      let r = byUrl.get(org.url);
      if (!r) {
        r = await checkSite(org.url, today, { robots, previous: state.orgs[org.id]?.history.at(-1) });
        byUrl.set(org.url, r);
        visits++;
      }
      results.set(org.id, r);
      console.log(`${r.reachable ? 'ok ' : 'DOWN'} ${String(r.notModified ? 'same' : r.httpStatus ?? r.error).padEnd(8)} ${org.name}`);
    }
  });

  for (const org of orgs) {
    const prev = state.orgs[org.id];
    const result = results.get(org.id);
    const history = result ? [...(prev?.history ?? []).filter((h) => h.date !== today), result].slice(-HISTORY_LIMIT) : prev?.history ?? [];
    const { status, reasons, proven, signals, score } = decideStatus(org, history, today, register);
    const s = { status, reasons, since: prev && prev.status === status ? prev.since : today, lastChecked: history.at(-1)?.date ?? null, proven, score, signals, history };
    state.orgs[org.id] = s;
    if (FLAGGED.includes(status) && !FLAGGED.includes(prev?.status ?? 'Looks active')) newly.push({ org, s });
  }

  // Forget organisations removed from the list, and robots.txt answers over a month old.
  for (const id of Object.keys(state.orgs)) if (!orgs.some((o) => o.id === id)) delete state.orgs[id];
  for (const [h, r] of Object.entries(robots)) if ((Date.parse(today) - Date.parse(r.date)) / 86_400_000 > 30) delete robots[h];
  state.robots = robots;
  if (!renderOnly && !only) state.updated = now; // "last check" means the full daily run

  await write(path('data/state.json'), `${JSON.stringify(state, null, 2)}\n`);
  // A small copy without the check history, for the admin page (the full state is several MB).
  const first = Object.values(state.orgs).find((s) => s.signals?.length);
  const summary: Summary = {
    updated: state.updated,
    labels: first?.signals.map((x) => x.label) ?? [],
    orgs: Object.fromEntries(Object.entries(state.orgs).map(([id, s]) => [id, {
      status: s.status, score: s.score, reasons: s.reasons, proven: s.proven, lastChecked: s.lastChecked,
      ticks: (s.signals ?? []).map((x) => x.level[0]).join(''),
      notes: (s.signals ?? []).map((x) => (x.level === 'green' ? '' : x.detail)),
    }])),
  };
  await write(path('data/summary.json'), `${JSON.stringify(summary)}\n`);
  // Website -> name of every listed organisation, so the checker can say "in our directory".
  const listed = Object.fromEntries(orgs.filter((o) => o.review?.status !== 'Closed').map((o) => [new URL(o.url).hostname.toLowerCase().replace(/^www\./, ''), o.name]));
  await write(path('data/listed.json'), `${JSON.stringify(listed)}\n`);
  await write(path('NeuroSupport-PMO/30 Live/Live status.md'), renderLivePage(orgs, state));
  await write(path('site/index.html'), renderSite(orgs, state));

  const dashboardFile = path('NeuroSupport-PMO/00 Start here/00 Dashboard.md');
  const dashboard = await readFile(dashboardFile, 'utf8').catch(() => null);
  if (dashboard) await write(dashboardFile, replaceBetweenMarkers(dashboard, renderDashboardBlock(orgs, state)));

  // The workflow posts this as a GitHub issue comment, which e-mails watchers.
  await rm(path('out/new-flags.md'), { force: true });
  if (newly.length) await write(path('out/new-flags.md'), renderNewFlags(newly));
  console.log(`\n${orgs.length} organisations: ${due.length} due today, ${visits} website visits across ${bySite.size} sites. ${newly.length} newly flagged.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const onlyArg = process.argv.find((a) => a.startsWith('--only='));
  await runChecks({
    renderOnly: process.argv.includes('--render-only'),
    only: onlyArg ? new Set(onlyArg.slice(7).split(',').filter(Boolean)) : undefined,
  });
}
