/**
 * "Is it still running?" for one website (and an optional charity number), on demand.
 * Same rules as the daily checks: one polite visit (robots.txt respected, 200 KB at most), the charity register
 * via the morning's lookup files (or live, for England and Wales, when CCEW_API_KEY is set), and the same scoring. Results are cached for 30 minutes per website.
 */
import { normaliseUrl } from '../src/neworg.ts';
import { findPhrases, isMarketplace, movedTo, pageText, pageTitle, robotsDisallowsAll } from '../src/page.ts';
import { hostKey, hostShard, numberShard, registerLink, SOURCE_NAME, toRegisterEntry, type LookupEntry } from '../src/lookupKeys.ts';
import { decideStatus } from '../src/status.ts';
import type { CheckResult, Org } from '../src/types.ts';
import type { Env } from './auth.ts';
import { charityByName, liveCharity } from './ccew.ts';
import { namesFromTitle } from '../src/ccew.ts';

const UA = 'neuro-support-checker/0.1 (+https://github.com/chrisdemetriouaudio/neuro-support-checker)';
const MAX_BYTES = 200_000;
const ALIVE = new Set([401, 403, 429]);

export interface CheckReport {
  url: string;
  finalUrl: string | null;
  title: string | null;
  verdict: 'running' | 'check' | 'closed';
  headline: string;
  score: number | null;
  reasons: string[];
  signals: { label: string; level: string; detail: string }[];
  charity: {
    register: string; number: string; name: string; link: string; status: string;
    matched: 'number' | 'website' | 'directory' | 'moved' | 'name';
    live: boolean; // from the live register just now, not this morning's download
    removalReason: string | null;
    grantMaker: boolean | null; // mainly gives grants rather than running services itself
    does: string[]; // live register only: how it helps
    where: string[]; // live register only: council areas, region or countries it works in
    otherNames: string[];
  } | null;
  listed: { name: string } | null;
  checked: string;
}

const lookupBase = (env: Env) => `https://raw.githubusercontent.com/${env.GITHUB_REPO}/lookup`;

async function getJson<T>(url: string, ttl: number): Promise<T | null> {
  const res = await fetch(url, { cf: { cacheTtl: ttl } } as RequestInit);
  return res.ok ? ((await res.json()) as T) : null;
}

/** Whether the domain exists at all, asked of a public DNS-over-HTTPS service. null = could not tell. */
async function domainExists(host: string): Promise<boolean | null> {
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`, {
      headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(4000),
    });
    const j = (await res.json()) as { Status: number };
    return j.Status === 3 ? false : true; // 3 = no such domain
  } catch {
    return null;
  }
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => {});
  const all = new Uint8Array(Math.min(size, MAX_BYTES));
  let at = 0;
  for (const p of parts) { all.set(p.subarray(0, all.length - at), at); at += p.length; if (at >= all.length) break; }
  return new TextDecoder().decode(all);
}

async function visit(url: string, today: string): Promise<CheckResult> {
  const r: CheckResult = {
    date: today, reachable: false, httpStatus: null, finalUrl: null, ms: 0, error: null,
    robotsBlocked: false, closedPhrases: [], parkedPhrases: [], movedTo: null, title: null,
  };
  const started = Date.now();
  const { hostname, origin } = new URL(url);
  if ((await domainExists(hostname)) === false) { r.error = 'DNS'; return r; }
  const headers = { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' };
  try {
    const robots = await fetch(`${origin}/robots.txt`, { headers, signal: AbortSignal.timeout(5000) });
    if (robots.ok) r.robotsBlocked = robotsDisallowsAll((await readCapped(robots)).slice(0, 50_000), 'neuro-support-checker');
    else await robots.body?.cancel();
  } catch { /* no robots.txt is fine */ }
  try {
    const res = await fetch(url, { method: r.robotsBlocked ? 'HEAD' : 'GET', headers, redirect: 'follow', signal: AbortSignal.timeout(12000) });
    r.httpStatus = res.status;
    r.finalUrl = res.url || url;
    r.reachable = res.ok || ALIVE.has(res.status) || (res.status === 503 && res.headers.has('retry-after'));
    r.movedTo = movedTo(url, r.finalUrl);
    if (r.movedTo && isMarketplace(r.movedTo)) r.parkedPhrases.push('redirects to a domain marketplace');
    if (!r.robotsBlocked && res.ok) {
      const html = await readCapped(res);
      r.title = pageTitle(html);
      const found = findPhrases(pageText(html));
      r.closedPhrases = found.closed;
      r.parkedPhrases.push(...found.parked);
    } else await res.body?.cancel();
  } catch (e) {
    const name = (e as { name?: string }).name;
    r.error = name === 'TimeoutError' || name === 'AbortError' ? 'Timeout' : 'Network';
  }
  r.ms = Date.now() - started;
  return r;
}

async function findCharity(env: Env, host: string, number: string | null): Promise<LookupEntry | null> {
  if (number) {
    const shard = await getJson<Record<string, LookupEntry>>(`${lookupBase(env)}/number/${numberShard(number)}.json`, 3600);
    return shard?.[number] ?? null;
  }
  const shard = await getJson<Record<string, LookupEntry[]>>(`${lookupBase(env)}/host/${hostShard(host)}.json`, 3600);
  const list = shard?.[hostKey(host)] ?? [];
  return list.find((e) => e[3] === 'R') ?? list[0] ?? null;
}

export async function checkOne(env: Env, rawUrl: string, rawNumber: string): Promise<CheckReport | { error: string }> {
  const url = normaliseUrl(rawUrl);
  if (!url) return { error: 'Please enter a website address, like www.example.org.uk.' };
  const number = rawNumber.trim() ? rawNumber.toUpperCase().replace(/\s/g, '') : null;
  if (number && !/^(SC)?\d{5,8}$/.test(number)) return { error: 'A charity number looks like 1063184, or SC012345 in Scotland.' };
  const today = new Date().toISOString().slice(0, 10);
  const host = new URL(url).hostname;

  const [result, charity, listed] = await Promise.all([
    visit(url, today),
    findCharity(env, host, number),
    getJson<Record<string, [string, string] | string>>(`https://raw.githubusercontent.com/${env.GITHUB_REPO}/main/data/listed.json`, 600),
  ]);
  // Not matched by website? Our directory may know its number; or, if the site moved, the register may list the new address.
  const raw = listed?.[hostKey(host)] ?? (result.movedTo ? listed?.[hostKey(result.movedTo)] : undefined);
  const listedHere: [string, string] | undefined = typeof raw === 'string' ? [raw, ''] : raw; // older files held just the name
  const viaDirectory = !charity && listedHere?.[1] ? await findCharity(env, host, listedHere[1]) : null;
  const moved = !charity && !viaDirectory && result.movedTo ? await findCharity(env, result.movedTo, null) : null;
  let entry = charity ?? viaDirectory ?? moved;
  let matched: NonNullable<CheckReport['charity']>['matched'] = number ? 'number' : charity ? 'website' : viaDirectory ? 'directory' : 'moved';

  // Still no match: ask the live register for a charity with exactly the name our directory or the page title gives.
  let byName: string | null = null;
  if (!entry && env.CCEW_API_KEY) {
    for (const name of [...(listedHere?.[0] ? [listedHere[0]] : []), ...namesFromTitle(result.title)].slice(0, 2)) {
      const found = await charityByName(env, name);
      if (found) { byName = String(found.reg_charity_number); matched = 'name'; break; }
    }
  }
  // England and Wales: today's record from the live register, which also says why a charity was removed.
  const liveNumber = entry ? (entry[0] === 'e' ? entry[1] : null) : byName ?? (number && /^\d+$/.test(number) ? number : null);
  const live = liveNumber ? await liveCharity(env, liveNumber) : null;
  if (live) entry = live.entry;
  // A name match is good enough to say "registered", but never to prove a closure: another charity may share the name.
  const scored = entry && !(matched === 'name' && entry[3] === 'X') ? entry : null;

  const org: Org = { id: 'check', name: entry?.[2] ?? host, url, area: '', kind: '', focus: [], charityNumber: scored?.[1] ?? null };
  const register = scored
    ? { extractDate: today, live: !!live, entries: { [scored[1]]: { ...toRegisterEntry(scored), removalReason: live?.extra.removalReason ?? null, interimManager: live?.extra.interimManager ?? null } } }
    : undefined;
  const d = decideStatus(org, [result], today, register);
  const amber = d.signals.some((x) => x.kind === 'evidence' && x.level === 'amber');
  // One visit is enough to know an address does not exist at all, or that the site says it has closed.
  const gone = result.error === 'DNS';
  const says = result.closedPhrases[0];
  const verdict: CheckReport['verdict'] = gone || says || d.status === 'Likely closed' || d.status === 'Closed' ? 'closed' : d.status === 'Needs a check' || amber ? 'check' : 'running';
  const headline = d.proven ? 'Closed: the charity register says so'
    : gone ? 'This web address does not exist (any more)'
      : says ? `The website says "${says}"`
        : verdict === 'closed' ? 'Likely closed'
          : !result.reachable ? 'The website did not answer just now: worth checking'
            : verdict === 'check' ? 'Worth checking before you signpost anyone' : 'Looks like it is still running';
  const finalScore = gone || says ? Math.min(d.score ?? 0, 20) : d.score;
  const listedName = listedHere?.[0];

  return {
    url, finalUrl: result.finalUrl, title: result.title, verdict, headline, score: finalScore, reasons: d.reasons,
    signals: d.signals.map((x) => ({ label: x.label, level: x.level, detail: x.detail })),
    charity: entry ? {
      register: SOURCE_NAME[entry[0]], number: entry[1], name: entry[2], link: registerLink(entry), status: entry[3] === 'X' ? 'Removed' : 'Registered',
      matched, live: !!live, removalReason: live?.extra.removalReason ?? null, grantMaker: live?.extra.grantMaker ?? null,
      does: live?.extra.does ?? [], where: live?.extra.where ?? [], otherNames: live?.extra.otherNames ?? [],
    } : null,
    listed: listedName ? { name: listedName } : null,
    checked: new Date().toISOString(),
  };
}
