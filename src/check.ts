import { lookup, resolve4 } from 'node:dns/promises';
import type { CheckResult } from './types.ts';

export const USER_AGENT =
  'ndsa-org-checker/0.1 (+https://github.com/chrisdemetriouaudio/ndsa-org-checker)';

const PAGE_TIMEOUT_MS = 20_000;
const ROBOTS_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 500_000;

/** Status codes that mean "a server is there but won't show us the page" (usually bot protection). */
const BLOCKED_BUT_ALIVE = new Set([401, 403, 429]);

const CLOSED_PHRASES = [
  'has now closed',
  'have now closed',
  'has closed its doors',
  'has permanently closed',
  'permanently closed',
  'ceased trading',
  'ceased operating',
  'ceased operations',
  'no longer operating',
  'no longer operational',
  'has been dissolved',
  'charity has closed',
  'has gone into administration',
  'entered administration',
];

const PARKED_PHRASES = [
  'this domain is for sale',
  'domain may be for sale',
  'buy this domain',
  'domain is parked',
  'parked free',
  'this domain has expired',
  'domain has expired',
  'account suspended',
  'this site can’t be reached',
];

const MARKETPLACE_HOSTS = ['sedo.com', 'dan.com', 'afternic.com', 'hugedomains.com', 'godaddy.com', 'bodis.com', 'parkingcrew.net'];

/** Lower-cased visible text of an HTML page. */
export function pageText(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, '’')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/'/g, '’');
}

export function findPhrases(text: string): { closed: string[]; parked: string[] } {
  return {
    closed: CLOSED_PHRASES.filter((p) => text.includes(p)),
    parked: PARKED_PHRASES.filter((p) => text.includes(p)),
  };
}

export function pageTitle(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 200) || null : null;
}

const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, '');

/** The new host when a redirect lands on a different site (not just www or a subdomain). */
export function movedTo(fromUrl: string, toUrl: string): string | null {
  const a = bareHost(new URL(fromUrl).hostname);
  const b = bareHost(new URL(toUrl).hostname);
  if (a === b || b.endsWith(`.${a}`) || a.endsWith(`.${b}`)) return null;
  return b;
}

export function isMarketplace(host: string): boolean {
  return MARKETPLACE_HOSTS.some((m) => host === m || host.endsWith(`.${m}`));
}

/** True when robots.txt asks every robot (or this one) to stay off the whole site. */
export function robotsDisallowsAll(robots: string, agent = 'ndsa-org-checker'): boolean {
  let applies = false;
  let inAgents = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!inAgents) applies = false;
      inAgents = true;
      if (value === '*' || value.toLowerCase() === agent) applies = true;
    } else {
      inAgents = false;
      if (applies && key === 'disallow' && value === '/') return true;
    }
  }
  return false;
}

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

/** One polite visit to an organisation's homepage. Never throws. */
export async function checkSite(url: string, date: string): Promise<CheckResult> {
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

  try {
    const robots = await fetch(`${origin}/robots.txt`, { headers, signal: AbortSignal.timeout(ROBOTS_TIMEOUT_MS) });
    if (robots.ok) result.robotsBlocked = robotsDisallowsAll(await readCapped(robots));
  } catch {
    // No robots.txt is fine.
  }

  try {
    const res = await fetch(url, {
      method: result.robotsBlocked ? 'HEAD' : 'GET',
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    result.httpStatus = res.status;
    result.finalUrl = res.url || url;
    result.reachable = res.ok || BLOCKED_BUT_ALIVE.has(res.status);
    result.movedTo = movedTo(url, result.finalUrl);
    if (result.movedTo && isMarketplace(result.movedTo)) result.parkedPhrases.push('redirects to a domain marketplace');
    if (!result.robotsBlocked && res.ok) {
      const html = await readCapped(res);
      result.title = pageTitle(html);
      const found = findPhrases(pageText(html));
      result.closedPhrases = found.closed;
      result.parkedPhrases.push(...found.parked);
    }
  } catch (err) {
    result.error = classifyError(err);
  }
  result.ms = Date.now() - started;
  return result;
}
