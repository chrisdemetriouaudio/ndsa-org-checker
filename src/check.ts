import { lookup, resolve4 } from 'node:dns/promises';
import type { CheckResult } from './types.ts';
import { findPhrases, isMarketplace, movedTo, pageText, pageTitle, robotsDisallowsAll } from './page.ts';

export { findPhrases, isMarketplace, movedTo, pageText, pageTitle, robotsDisallowsAll };

export const USER_AGENT =
  'neuro-support-checker/0.1 (+https://github.com/chrisdemetriouaudio/neuro-support-checker)';

const PAGE_TIMEOUT_MS = 20_000;
const ROBOTS_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 500_000;

/** Status codes that mean "a server is there but won't show us the page" (usually bot protection). */
const BLOCKED_BUT_ALIVE = new Set([401, 403, 429]);

function classifyError(err: unknown): CheckResult['error'] {
  const e = err as { name?: string; code?: string; cause?: { code?: string } };
  const code = e.cause?.code ?? e.code ?? '';
  if (e.name === 'TimeoutError' || e.name === 'AbortError') return 'Timeout';
  // ENOTFOUND = the name does not exist. EAI_AGAIN/SERVFAIL = DNS broken for now, so just "down".
  if (code === 'ENOTFOUND') return 'DNS';
  if (/CERT|SSL|TLS/i.test(code)) return 'TLS';
  return 'Network';
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BODY_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks));
}

const headers = { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' };

/** robots.txt answers, kept for a week per site so it is not fetched on every visit. */
export type RobotsCache = Record<string, { date: string; disallowAll: boolean }>;
const ROBOTS_DAYS = 7;
const daysSince = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86_400_000;

/**
 * One polite visit to an organisation's homepage. Never throws.
 *  - robots.txt is read at most once a week per site (cached in `robots`).
 *  - When the last visit gave an ETag / Last-Modified, the page is only sent if it changed (304 = unchanged,
 *    and the last visit's findings are kept).
 *  - "Too many requests" and "busy, try later" answers count as alive; there is no retry the same day.
 */
export async function checkSite(url: string, date: string, opts: { robots?: RobotsCache; previous?: CheckResult } = {}): Promise<CheckResult> {
  const result: CheckResult = {
    date, reachable: false, httpStatus: null, finalUrl: null, ms: 0, error: null,
    robotsBlocked: false, closedPhrases: [], parkedPhrases: [], movedTo: null, title: null,
  };
  const started = Date.now();
  const { hostname, origin } = new URL(url);

  try {
    await lookup(hostname);
  } catch {
    // Ask DNS directly: "no such name" means the address is gone; SERVFAIL etc. means broken for now.
    const code = await resolve4(hostname).then(() => 'OK', (e: { code?: string }) => e.code ?? '');
    result.error = code === 'ENOTFOUND' ? 'DNS' : 'Network';
    result.ms = Date.now() - started;
    return result;
  }

  const cached = opts.robots?.[hostname];
  if (cached && daysSince(cached.date, date) < ROBOTS_DAYS) {
    result.robotsBlocked = cached.disallowAll;
  } else {
    try {
      const robots = await fetch(`${origin}/robots.txt`, { headers, signal: AbortSignal.timeout(ROBOTS_TIMEOUT_MS) });
      if (robots.ok) result.robotsBlocked = robotsDisallowsAll(await readCapped(robots));
      else await robots.body?.cancel();
    } catch {
      // No robots.txt is fine.
    }
    if (opts.robots) opts.robots[hostname] = { date, disallowAll: result.robotsBlocked };
  }

  const prev = opts.previous;
  const conditional: Record<string, string> = {};
  if (prev?.etag) conditional['if-none-match'] = prev.etag;
  if (prev?.lastModified) conditional['if-modified-since'] = prev.lastModified;

  try {
    const res = await fetch(url, {
      method: result.robotsBlocked ? 'HEAD' : 'GET',
      headers: { ...headers, ...conditional },
      redirect: 'follow',
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    result.httpStatus = res.status;
    result.finalUrl = res.url || url;
    result.etag = res.headers.get('etag');
    result.lastModified = res.headers.get('last-modified');
    if (res.status === 304 && prev) {
      // Unchanged since the last visit: keep what that visit found.
      await res.body?.cancel();
      Object.assign(result, {
        reachable: true, finalUrl: prev.finalUrl ?? url, title: prev.title, movedTo: prev.movedTo,
        closedPhrases: [...prev.closedPhrases], parkedPhrases: [...prev.parkedPhrases],
        etag: result.etag ?? prev.etag ?? null, lastModified: result.lastModified ?? prev.lastModified ?? null, notModified: true,
      });
      result.ms = Date.now() - started;
      return result;
    }
    const busy = res.status === 503 && res.headers.has('retry-after');
    result.reachable = res.ok || BLOCKED_BUT_ALIVE.has(res.status) || busy;
    result.movedTo = movedTo(url, result.finalUrl);
    if (result.movedTo && isMarketplace(result.movedTo)) result.parkedPhrases.push('redirects to a domain marketplace');
    if (!result.robotsBlocked && res.ok) {
      const html = await readCapped(res);
      result.title = pageTitle(html);
      const found = findPhrases(pageText(html));
      result.closedPhrases = found.closed;
      result.parkedPhrases.push(...found.parked);
    } else await res.body?.cancel();
  } catch (err) {
    result.error = classifyError(err);
  }
  result.ms = Date.now() - started;
  return result;
}
