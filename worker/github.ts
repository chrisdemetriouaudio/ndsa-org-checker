/**
 * The list lives in the GitHub repo. Public pages read the raw files; admin changes go through the
 * GitHub API with a fine-grained token limited to this one repo (contents + actions: read and write).
 */
import { serialiseOrgs } from '../src/neworg.ts';
import type { Org } from '../src/types.ts';
import { SafeError, type Env } from './auth.ts';

const API = 'https://api.github.com';

const apiHeaders = (env: Env) => {
  if (!env.GITHUB_TOKEN) throw new SafeError('Saving is switched off on this site until its GitHub key (GITHUB_TOKEN) is added.');
  return {
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
    accept: 'application/vnd.github+json',
    'user-agent': 'neuro-support-checker',
    'x-github-api-version': '2022-11-28',
  };
};

const decode = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), (c) => c.charCodeAt(0)));
const encode = (text: string) => {
  let s = '';
  for (const b of new TextEncoder().encode(text)) s += String.fromCharCode(b);
  return btoa(s);
};

/**
 * Read through the API, with the file's version (sha) for a safe update. `ref` defaults to main, which GitHub can
 * serve slightly out of date for a few seconds after a save; a commit id is always exact.
 */
export async function readFile(env: Env, path: string, ref = 'main'): Promise<{ text: string; sha: string }> {
  if (!env.GITHUB_TOKEN) return readPublic(env, path, ref);
  const res = await fetch(`${API}/repos/${env.GITHUB_REPO}/contents/${path}?ref=${encodeURIComponent(ref)}`, { headers: apiHeaders(env) });
  if (!res.ok) throw new Error(`Could not read ${path}: HTTP ${res.status}`);
  const j = (await res.json()) as { content?: string; sha: string; download_url?: string };
  if (j.content) return { text: decode(j.content), sha: j.sha };
  const big = await fetch(j.download_url!, { headers: apiHeaders(env) }); // files over 1 MB come without content
  return { text: await big.text(), sha: j.sha };
}

/** Without the key (read-only mode): the public copy of the file. It can be a few minutes old, and has no sha, so it cannot be saved over. */
async function readPublic(env: Env, path: string, ref: string): Promise<{ text: string; sha: string }> {
  const res = await fetch(`https://raw.githubusercontent.com/${env.GITHUB_REPO}/${encodeURIComponent(ref)}/${path}`);
  if (res.status === 404) throw new NotFound(path);
  if (!res.ok) throw new Error(`Could not read ${path}: HTTP ${res.status}`);
  return { text: await res.text(), sha: '' };
}
class NotFound extends Error {}

/** Like readFile, but a missing file comes back as null (so it can be created). */
export async function readFileIfAny(env: Env, path: string): Promise<{ text: string; sha: string } | null> {
  if (!env.GITHUB_TOKEN) return readPublic(env, path, 'main').catch((e) => { if (e instanceof NotFound) return null; throw e; });
  const res = await fetch(`${API}/repos/${env.GITHUB_REPO}/contents/${path}?ref=main`, { method: 'HEAD', headers: apiHeaders(env) });
  if (res.status === 404) return null;
  return readFile(env, path);
}

/** Read–change–write of a small JSON file, created if missing, with one retry on a clash. */
export async function updateJson<T>(env: Env, path: string, empty: T, message: string, change: (value: T) => T): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const file = await readFileIfAny(env, path);
    const next = change(file?.text.trim() ? (JSON.parse(file.text) as T) : empty);
    if (await writeFile(env, path, `${JSON.stringify(next, null, 2)}\n`, file?.sha, message)) return next;
  }
  throw new SafeError('The list changed while saving. Please try again.');
}

/** Writes a file only if nobody changed it since `sha` was read (no sha = create). Returns false on a clash. Notes the new commit in env.saved. */
export async function writeFile(env: Env, path: string, text: string, sha: string | undefined, message: string): Promise<boolean> {
  const res = await fetch(`${API}/repos/${env.GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { ...apiHeaders(env), 'content-type': 'application/json' },
    body: JSON.stringify({ message, content: encode(text), branch: 'main', ...(sha ? { sha } : {}) }),
  });
  if (res.status === 409 || res.status === 422) return false;
  if (!res.ok) throw new Error(`Could not save ${path}: HTTP ${res.status}`);
  const commit = ((await res.json().catch(() => ({}))) as { commit?: { sha?: string } }).commit?.sha;
  if (env.saved && commit) env.saved.commit = env.saved.after = commit;
  return true;
}

/**
 * Read–change–write, tried up to 3 times if the file changed underneath us. The first try reads the version this
 * admin saved last (if any), so a second change straight after the first does not trip over GitHub's short delay.
 */
export async function updateOrgs(env: Env, message: string, change: (orgs: Org[]) => Org[] | null): Promise<Org[] | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1500));
    const { text, sha } = await readFile(env, 'data/orgs.json', attempt === 0 && env.saved?.after ? env.saved.after : 'main');
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
