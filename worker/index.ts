import { applyReview, MAX_PER_ADD, parseLines, validateNew, type NewOrgInput, type ReviewAction } from '../src/neworg.ts';
import { renderSite } from '../src/render.ts';
import type { State } from '../src/types.ts';
import {
  audit, consumeLink, currentAdmin, endSession, nonce, passkeyRegister, passkeyRegistrationOptions, passkeySignIn,
  passkeySignInOptions, requestLink, SafeError, startSession, type Admin, type Env,
} from './auth.ts';
import { readFile, readPublic, startCheck, updateOrgs } from './github.ts';
import { adminPage, linkPage, messagePage, passkeySetupPage, signInPage } from './pages.ts';

const MAX_BODY = 64 * 1024;

function headers(n: string, extra: Record<string, string> = {}): Headers {
  return new Headers({
    'content-security-policy': `default-src 'none'; script-src 'nonce-${n}'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin', // never sent to other sites; same-site posts keep a real Origin
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'strict-transport-security': 'max-age=31536000',
    ...extra,
  });
}

const html = (body: string, n: string, extra: Record<string, string> = {}, status = 200) =>
  new Response(body, { status, headers: headers(n, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...extra }) });

const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: headers('none', { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra }) });

/**
 * Only accept writes sent by our own pages. Browsers may send `Origin: null` on a same-site form post
 * (privacy settings), so the browser-set Sec-Fetch-Site header is accepted too; pages cannot fake it.
 */
const sameOrigin = (req: Request, env: Env) =>
  req.headers.get('origin') === env.ORIGIN || req.headers.get('sec-fetch-site') === 'same-origin';

async function readJson(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > MAX_BODY) throw new Error('Too much text in one go.');
  try {
    const v = JSON.parse(text || '{}');
    return v && typeof v === 'object' ? v as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

const today = () => new Date().toISOString().slice(0, 10);
const asList = (v: unknown) => (Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? [v] : []);

async function directory(env: Env, n: string): Promise<Response> {
  const { orgs, state } = await readPublic(env);
  const page = renderSite(orgs, state)
    .replace('<script>', `<script nonce="${n}">`)
    .replace('</footer>', ' · <a href="/admin">Admin sign in</a></footer>');
  return html(page, n, { 'cache-control': 'public, max-age=60' });
}

async function adminHome(env: Env, admin: Admin, n: string): Promise<Response> {
  const [orgsFile, stateFile] = await Promise.all([readFile(env, 'data/orgs.json'), readFile(env, 'data/state.json')]);
  return html(adminPage(n, admin, JSON.parse(orgsFile.text), JSON.parse(stateFile.text) as State), n);
}

async function addOrgs(env: Env, admin: Admin, body: Record<string, unknown>): Promise<Response> {
  const shared = { kind: String(body.kind ?? ''), focus: asList(body.focus) };
  const inputs: NewOrgInput[] = typeof body.lines === 'string'
    ? parseLines(body.lines).map((i) => ({ ...shared, ...i }))
    : [{ ...shared, name: String(body.name ?? ''), url: String(body.url ?? ''), area: String(body.area ?? ''), charityNumber: String(body.charityNumber ?? '') }];
  if (!inputs.length) return json({ error: 'Add at least one organisation.' }, 400);
  if (inputs.length > MAX_PER_ADD) return json({ error: `Please add at most ${MAX_PER_ADD} at a time.` }, 400);

  const problems: string[] = [];
  const added: string[] = [];
  const saved = await updateOrgs(env, `Add organisations (by ${admin.name}, admin page)`, (orgs) => {
    problems.length = 0;
    added.length = 0;
    const taken = new Set(orgs.map((o) => o.id));
    const next = [...orgs];
    inputs.forEach((input, i) => {
      const v = validateNew(input, next, taken);
      if (v.org) { next.push(v.org); added.push(v.org.id); } else {
        const label = inputs.length > 1 ? `Line ${i + 1}${input.name ? ` (${input.name.slice(0, 40)})` : ''}: ` : '';
        problems.push(`${label}${v.problems.join(' ')}`);
      }
    });
    return added.length ? next : null;
  });
  if (!saved) return json({ error: problems.join(' ') || 'Nothing was added.' }, 400);
  await audit(env, admin.email, 'added', added.join(','));
  if (!(await startCheckSafely(env, added))) problems.push('Saved, but the instant check did not start. They will be checked at the next daily check.');
  return json({ added: added.length, problems });
}

async function review(env: Env, admin: Admin, body: Record<string, unknown>): Promise<Response> {
  const action = String(body.action) as ReviewAction;
  if (!['remove', 'restore', 'still-running'].includes(action)) return json({ error: 'Unknown action.' }, 400);
  const id = String(body.id ?? '');
  let problem: string | undefined;
  const words = { remove: 'Remove', restore: 'Restore', 'still-running': 'Mark still running:' }[action];
  const saved = await updateOrgs(env, `${words} ${id} (by ${admin.name}, admin page)`, (orgs) => {
    const r = applyReview(orgs, id, action, admin.name, today(), String(body.reason ?? ''));
    problem = r.problem;
    return r.problem ? null : r.orgs;
  });
  if (!saved) return json({ error: problem ?? 'Nothing changed.' }, 400);
  await audit(env, admin.email, action, id);
  await startCheckSafely(env, []);
  return json({ ok: true });
}

async function startCheckSafely(env: Env, ids: string[]): Promise<boolean> {
  try {
    await startCheck(env, ids);
    return true;
  } catch (e) {
    console.error('check did not start', e);
    return false;
  }
}

async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const n = nonce();
  const { pathname: path } = url;
  const method = req.method;

  if (method === 'GET' && path === '/') return directory(env, n);
  if (method === 'GET' && path === '/robots.txt') return new Response('User-agent: *\nDisallow: /admin\nDisallow: /auth\n');

  if (method === 'GET' && path === '/admin') {
    const admin = await currentAdmin(req, env);
    if (!admin) return html(signInPage(n), n);
    if (admin.level === 'link') {
      const has = await env.DB.prepare('SELECT 1 FROM passkeys WHERE email = ? LIMIT 1').bind(admin.email).first();
      return html(passkeySetupPage(n, admin, !!has), n);
    }
    return adminHome(env, admin, n);
  }

  if (method === 'GET' && path === '/auth/link') return html(linkPage(n, url.searchParams.get('t') ?? ''), n);

  if (method !== 'POST') return new Response('Not found', { status: 404 });
  if (!sameOrigin(req, env)) return json({ error: 'Not allowed.' }, 403);

  if (path === '/auth/link') {
    const form = await req.formData();
    const email = await consumeLink(env, String(form.get('t') ?? ''));
    if (!email) return html(messagePage(n, 'Link not valid', 'This link has expired or was already used. Ask for a new one.'), n, {}, 400);
    await audit(env, email, 'signed-in', 'e-mail link');
    return new Response(null, { status: 303, headers: { location: '/admin', 'set-cookie': await startSession(req, env, email, 'link') } });
  }

  const body = await readJson(req);

  if (path === '/auth/email') {
    try {
      await requestLink(env, String(body.email ?? ''), req.headers.get('cf-connecting-ip') ?? '');
    } catch (e) {
      console.error('sign-in link failed', e); // same answer either way, so the list is not revealed
    }
    return json({ ok: true });
  }
  if (path === '/auth/passkey/options') return json(await passkeySignInOptions(env));
  if (path === '/auth/passkey/verify') {
    const email = await passkeySignIn(env, body);
    if (!email) return json({ error: 'That passkey was not recognised.' }, 401);
    return json({ ok: true }, 200, { 'set-cookie': await startSession(req, env, email, 'passkey') });
  }
  if (path === '/auth/signout') return json({ ok: true }, 200, { 'set-cookie': await endSession(req, env) });

  const admin = await currentAdmin(req, env);
  if (!admin) return json({ error: 'Please sign in again.' }, 401);

  if (path === '/auth/passkey/register-options') return json(await passkeyRegistrationOptions(env, admin));
  if (path === '/auth/passkey/register') {
    if (!(await passkeyRegister(env, admin, body))) return json({ error: 'The passkey could not be added. Please try again.' }, 400);
    return json({ ok: true }, 200, { 'set-cookie': await startSession(req, env, admin.email, 'passkey') });
  }

  if (admin.level !== 'passkey') return json({ error: 'Please add a passkey first.' }, 403);
  if (path === '/admin/api/add') return addOrgs(env, admin, body);
  if (path === '/admin/api/review') return review(env, admin, body);
  return json({ error: 'Not found.' }, 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      return await handle(req, env);
    } catch (e) {
      console.error(e);
      const message = e instanceof SafeError ? e.message : 'Something went wrong. Please try again in a minute.';
      return req.method === 'POST' ? json({ error: message }, 500) : new Response('Something went wrong. Please try again in a minute.', { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
