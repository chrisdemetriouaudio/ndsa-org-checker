/** What a homepage says: pure text rules shared by the daily checks (Node) and the checker (Worker). */
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
export function robotsDisallowsAll(robots: string, agent = 'neuro-support-checker'): boolean {
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

