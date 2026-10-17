/**
 * The list lives in the GitHub repo. Public pages read the raw files; admin changes go through the
 * GitHub API with a fine-grained token limited to this one repo (contents + actions: read and write).
 */
import { serialiseOrgs } from '../src/neworg.ts';
import type { Org, State } from '../src/types.ts';
import { SafeError, type Env } from './auth.ts';

const API = 'https://api.github.com';

const apiHeaders = (env: Env) => {
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not set');
  return {
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
    accept: 'application/vnd.github+json',
    'user-agent': 'ndsa-org-checker',
    'x-github-api-version': '2022-11-28',
  };
};

const decode = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), (c) => c.charCodeAt(0)));
const encode = (text: string) => {
  let s = '';
  for (const b of new TextEncoder().encode(text)) s += String.fromCharCode(b);
  return btoa(s);
};

/** Public read through the raw file host (cached about a minute at the edge). */
export async function readPublic(env: Env): Promise<{ orgs: Org[]; state: State }> {
  const raw = (path: string) => fetch(`https://raw.githubusercontent.com/${env.GITHUB_REPO}/main/${path}`, { cf: { cacheTtl: 60 } } as RequestInit)
    .then((r) => { if (!r.ok) throw new Error(`Could not read ${path}: HTTP ${r.status}`); return r.json(); });
  const [orgs, state] = await Promise.all([raw('data/orgs.json'), raw('data/state.json')]);
  return { orgs: orgs as Org[], state: state as State };
}

/** Fresh read through the API, with the file's version (sha) for a safe update. */
export async function readFile(env: Env, path: string): Promise<{ text: string; sha: string }> {
  const res = await fetch(`${API}/repos/${env.GITHUB_REPO}/contents/${path}?ref=main`, { headers: apiHeaders(env) });
  if (!res.ok) throw new Error(`Could not read ${path}: HTTP ${res.status}`);
  const j = (await res.json()) as { content?: string; sha: string; download_url?: string };
  if (j.content) return { text: decode(j.content), sha: j.sha };
  const big = await fetch(j.download_url!, { headers: apiHeaders(env) }); // files over 1 MB come without content
  return { text: await big.text(), sha: j.sha };
}

/** Writes a file only if nobody changed it since `sha` was read. Returns false on a clash. */
export async function writeFile(env: Env, path: string, text: string, sha: string, message: string): Promise<boolean> {
  const res = await fetch(`${API}/repos/${env.GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { ...apiHeaders(env), 'content-type': 'application/json' },
    body: JSON.stringify({ message, content: encode(text), sha, branch: 'main' }),
  });
  if (res.status === 409 || res.status === 422) return false;
  if (!res.ok) throw new Error(`Could not save ${path}: HTTP ${res.status}`);
  return true;
}

/** Read–change–write with one retry if the file changed underneath us. */
export async function updateOrgs(env: Env, message: string, change: (orgs: Org[]) => Org[] | null): Promise<Org[] | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text, sha } = await readFile(env, 'data/orgs.json');
    const next = change(JSON.parse(text) as Org[]);
    if (!next) return null;
    if (await writeFile(env, 'data/orgs.json', serialiseOrgs(next), sha, message)) return next;
  }
  throw new SafeError('The list changed while saving. Please try again.');
}

/** Starts the "Check new entries" workflow: checks `ids` now, or only re-renders when ids is empty. */
export async function startCheck(env: Env, ids: string[]): Promise<void> {
  const res = await fetch(`${API}/repos/${env.GITHUB_REPO}/actions/workflows/check-new.yml/dispatches`, {
    method: 'POST',
    headers: { ...apiHeaders(env), 'content-type': 'application/json' },
    body: JSON.stringify({ ref: 'main', inputs: { ids: ids.join(',') } }),
  });
  if (!res.ok) throw new Error(`Could not start the check: HTTP ${res.status}`);
}
