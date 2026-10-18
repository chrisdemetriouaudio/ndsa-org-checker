import { cleanAudiences } from '../src/audience.ts';
import { areaKey, ukPostcode } from '../src/place.ts';
import { candidateToInput, type Candidate, type Decision } from '../src/candidates.ts';
import { applyReview, MAX_PER_ADD, parseLines, validateNew, type NewOrgInput, type ReviewAction } from '../src/neworg.ts';
import type { Summary } from '../src/types.ts';
import {
  audit, consumeLink, currentAdmin, endSession, nonce, passkeyRegister, passkeyRegistrationOptions, passkeySignIn,
  allow, passkeySignInOptions, requestLink, SafeError, startSession, type Admin, type Env,
} from './auth.ts';
import { checkOne } from './checker.ts';
import { sha256Hex } from './crypto.ts';
import { readFile, readFileIfAny, startCheck, updateJson, updateOrgs } from './github.ts';
import { adminPage, candidatesPage, linkPage, messagePage, passkeySetupPage, signInPage } from './pages.ts';

const MAX_BODY = 64 * 1024;

function headers(n: string, extra: Record<string, string> = {}): Headers {
  return new Headers({
    'content-security-policy': `default-src 'none'; script-src 'nonce-${n}'; style-src 'unsafe-inline'; font-src 'self'; connect-src 'self' https://raw.githubusercontent.com; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
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

/** The public page is built by the daily run (site/index.html); the Worker only adds this request's nonce. */
async function directory(env: Env, n: string): Promise<Response> {
  const res = await fetch(`https://raw.githubusercontent.com/${env.GITHUB_REPO}/main/site/index.html`, { cf: { cacheTtl: 60 } } as RequestInit);
  if (!res.ok) throw new Error(`Could not read the directory page: HTTP ${res.status}`);
  const page = (await res.text())
    .replaceAll('<script>', `<script nonce="${n}">`)
    .replace('<span id="admin-slot"></span>', '<a class="admin-link" href="/admin">Admin sign in</a>');
  return html(page, n, { 'cache-control': 'public, max-age=60' });
}

/** The commit this admin saved in the last few minutes, if any (see savedCookie). */
const savedRef = (req: Request) => /(?:^|;\s*)__Host-nsc-saved=([0-9a-f]{40})/.exec(req.headers.get('cookie') ?? '')?.[1] ?? null;
/** Remembers the commit a change created for 5 minutes, so the next page load shows that change straight away. */
const savedCookie = (commit: string) => `__Host-nsc-saved=${commit}; Path=/; Max-Age=300; Secure; HttpOnly; SameSite=Strict`;

async function adminHome(env: Env, admin: Admin, n: string, ref: string | null): Promise<Response> {
  // Right after a change, read the exact version saved: "main" can lag behind it for a few seconds.
  const orgsFile = await readFile(env, 'data/orgs.json', ref ?? 'main').catch(() => readFile(env, 'data/orgs.json'));
  const stateFile = await readFile(env, 'data/summary.json');
  return html(adminPage(n, admin, JSON.parse(orgsFile.text), JSON.parse(stateFile.text) as Summary, !env.GITHUB_TOKEN), n);
}

async function addOrgs(env: Env, admin: Admin, body: Record<string, unknown>): Promise<Response> {
  const shared = { kind: String(body.kind ?? ''), focus: asList(body.focus), audiences: asList(body.audiences) };
  const inputs: NewOrgInput[] = typeof body.lines === 'string'
    ? parseLines(body.lines).map((i) => ({ ...shared, ...i }))
    : [{ ...shared, name: String(body.name ?? ''), url: String(body.url ?? ''), area: String(body.area ?? ''), charityNumber: String(body.charityNumber ?? ''), postcode: String(body.postcode ?? ''), coverage: String(body.coverage ?? '') }];
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

type Decisions = Record<string, Decision>;
const DECISIONS = 'data/candidate-decisions.json';
async function candidatesHome(env: Env, admin: Admin, n: string): Promise<Response> {
  const file = await readFileIfAny(env, DECISIONS);
  const decided = file?.text.trim() ? Object.keys(JSON.parse(file.text) as Decisions) : [];
  return html(candidatesPage(n, admin, decided, env.GITHUB_REPO), n);
}

/** Add candidates to the directory, or mark them not relevant. Either way they leave the review list for good. */
async function decideCandidates(env: Env, admin: Admin, body: Record<string, unknown>): Promise<Response> {
  const action = body.action === 'add' ? 'add' : body.action === 'reject' ? 'reject' : null;
  const items = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [];
  if (!action || !items.length) return json({ error: 'Tick at least one organisation.' }, 400);
  if (items.length > MAX_PER_ADD) return json({ error: `Please choose at most ${MAX_PER_ADD} at a time.` }, 400);
  const valid = items.filter((i) => typeof i.key === 'string' && /^(ccew|oscr|ccni):[A-Za-z0-9]{1,12}$/.test(i.key));
  if (valid.length !== items.length) return json({ error: 'Some items were not recognised.' }, 400);

  const problems: string[] = [];
  const added: { key: string; id: string }[] = [];
  if (action === 'add') {
    await updateOrgs(env, `Add ${valid.length} discovered organisation(s) (by ${admin.name}, admin page)`, (orgs) => {
      problems.length = 0;
      added.length = 0;
      const taken = new Set(orgs.map((o) => o.id));
      const next = [...orgs];
      for (const i of valid) {
        const input = candidateToInput({ ...(i as unknown as Candidate), source: String(i.key).split(':')[0] as Candidate['source'] });
        const v = validateNew(input, next, taken);
        if (v.org) { next.push(v.org); added.push({ key: String(i.key), id: v.org.id }); } else problems.push(`${input.name.slice(0, 50)}: ${v.problems.join(' ')}`);
      }
      return added.length ? next : null;
    });
  }
  const decidedKeys = action === 'add' ? added.map((a) => a.key) : valid.map((i) => String(i.key));
  if (decidedKeys.length) {
    const today = new Date().toISOString().slice(0, 10);
    await updateJson<Decisions>(env, DECISIONS, {}, `${action === 'add' ? 'Added' : 'Not relevant'}: ${decidedKeys.length} candidate(s) (by ${admin.name}, admin page)`, (d) => {
      for (const key of decidedKeys) d[key] = { decision: action === 'add' ? 'added' : 'rejected', by: admin.name, date: today };
      return d;
    });
  }
  await audit(env, admin.email, `candidates-${action}`, decidedKeys.join(','));
  if (added.length && !(await startCheckSafely(env, added.map((a) => a.id)))) problems.push('Saved, but the instant check did not start. They will be checked at the next daily check.');
  return json({ done: decidedKeys, problems });
}

/** A UK postcode or district ("SO23 9AA" or "SO23") to a map point, via postcodes.io. Nothing is stored or logged. */
async function lookupPostcode(raw: string): Promise<{ lat: number; lon: number; country: string; label: string; district: string; county: string | null; region: string | null; keys: { district: string; county: string | null; region: string | null } } | null> {
  const full = ukPostcode(raw);
  const district = raw.toUpperCase().replace(/\s/g, '');
  if (!full && !/^[A-Z]{1,2}\d[A-Z\d]?$/.test(district)) return null;
  const res = await fetch(full ? `https://api.postcodes.io/postcodes/${encodeURIComponent(full)}` : `https://api.postcodes.io/outcodes/${district}`);
  if (!res.ok) return null;
  const r = ((await res.json()) as { result?: { latitude: number | null; longitude: number | null; country: string | string[]; admin_district?: string | string[] | null; admin_county?: string | string[] | null; region?: string | string[] | null } }).result;
  if (r?.latitude == null || r.longitude == null) return null;
  const first = (v: string | string[] | null | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const country = first(r.country) ?? 'UK';
  const council = first(r.admin_district) ?? full ?? district;
  const county = first(r.admin_county);
  const region = first(r.region);
  return {
    lat: r.latitude, lon: r.longitude, country, label: full ?? district, district: council, county, region,
    keys: { district: areaKey(council), county: county ? areaKey(county) : null, region: region ? areaKey(region) : null },
  };
}

/** Edits who an organisation is for, its base postcode and whether it works locally or across the nation. */
async function setDetails(env: Env, admin: Admin, body: Record<string, unknown>): Promise<Response> {
  const id = String(body.id ?? '');
  const audiences = cleanAudiences(asList(body.audiences));
  const rawPostcode = String(body.postcode ?? '').trim();
  const postcode = rawPostcode ? ukPostcode(rawPostcode) : null;
  if (rawPostcode && !postcode) return json({ error: 'That is not a full UK postcode, like SO23 9AA.' }, 400);
  const point = postcode ? await lookupPostcode(postcode) : null;
  if (postcode && !point) return json({ error: 'postcodes.io could not find that postcode.' }, 400);
  const coverage = body.coverage === 'local' || body.coverage === 'national' ? body.coverage : null;
  let found = false;
  await updateOrgs(env, `Details for ${id} (by ${admin.name}, admin page)`, (orgs) => {
    found = orgs.some((o) => o.id === id);
    if (!found) return null;
    return orgs.map((o) => {
      if (o.id !== id) return o;
      const copy = { ...o };
      if (audiences.length) copy.audiences = audiences; else delete copy.audiences;
      if (postcode && point) Object.assign(copy, { postcode, lat: Math.round(point.lat * 1000) / 1000, lon: Math.round(point.lon * 1000) / 1000 });
      if (!rawPostcode) { delete copy.postcode; delete copy.lat; delete copy.lon; }
      if (coverage) copy.coverage = coverage;
      return copy;
    });
  });
  if (!found) return json({ error: 'That organisation is not on the list.' }, 400);
  await audit(env, admin.email, 'details', `${id}: ${audiences.join(',')} ${postcode ?? '-'} ${coverage ?? ''}`);
  await startCheckSafely(env, []);
  return json({ ok: true });
}

async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const n = nonce();
  const { pathname: path } = url;
  const method = req.method;

  if (method === 'GET' && path === '/') return directory(env, n);
  if ((method === 'GET' || method === 'HEAD') && path === '/api/check') {
    if (method === 'HEAD') return new Response(null, { status: 200 });
    const target = url.searchParams.get('url') ?? '';
    const number = url.searchParams.get('number') ?? '';
    const cacheKey = new Request(`https://cache.internal/check?u=${encodeURIComponent(target.trim().toLowerCase())}&n=${encodeURIComponent(number.trim())}`);
    const cached = await caches.default.match(cacheKey);
    if (cached) return cached;
    const ip = req.headers.get('cf-connecting-ip') ?? '';
    if (!(await allow(env, `check:${(await sha256Hex(`nsc:${ip}`)).slice(0, 32)}`, 30, 3600))) {
      return json({ error: 'That is a lot of checks in one hour. Please try again a little later.' }, 429);
    }
    const report = await checkOne(env, target, number);
    if ('error' in report) return json(report, 400);
    const res = json(report, 200, { 'cache-control': 'public, max-age=1800' });
    await caches.default.put(cacheKey, res.clone());
    return res;
  }
  // The dyslexia-friendly font for the Display settings (OpenDyslexic, Bitstream Vera licence) and the site font
  // (Nunito, SIL Open Font License): both in site/fonts/ with their licences.
  const font = /^\/fonts\/(OpenDyslexic-(?:Regular|Bold)\.otf|Nunito-latin\.woff2)$/.exec(path);
  if (method === 'GET' && font) {
    const res = await fetch(`https://raw.githubusercontent.com/${env.GITHUB_REPO}/main/site/fonts/${font[1]}`, { cf: { cacheTtl: 86400 } } as RequestInit);
    if (!res.ok) return new Response('Not found', { status: 404 });
    return new Response(res.body, { headers: { 'content-type': font[1].endsWith('.woff2') ? 'font/woff2' : 'font/otf', 'cache-control': 'public, max-age=604800', 'x-content-type-options': 'nosniff' } });
  }
  if ((method === 'GET' || method === 'HEAD') && path === '/api/postcode') {
    if (method === 'HEAD') return new Response(null, { status: 200 });
    const point = await lookupPostcode(url.searchParams.get('pc') ?? '');
    return point ? json(point) : json({ error: 'We could not find that postcode. Try the first half, like SO23.' }, 400);
  }
  if (method === 'GET' && path === '/robots.txt') return new Response('User-agent: *\nDisallow: /admin\nDisallow: /auth\n');

  if (method === 'GET' && path === '/admin') {
    const admin = await currentAdmin(req, env);
    if (!admin) return html(signInPage(n), n);
    if (admin.level === 'link') {
      const has = await env.DB.prepare('SELECT 1 FROM passkeys WHERE email = ? LIMIT 1').bind(admin.email).first();
      return html(passkeySetupPage(n, admin, !!has), n);
    }
    return adminHome(env, admin, n, savedRef(req));
  }

  if (method === 'GET' && path === '/admin/candidates') {
    const admin = await currentAdmin(req, env);
    if (!admin || admin.level !== 'passkey') return new Response(null, { status: 303, headers: { location: '/admin' } });
    return candidatesHome(env, admin, n);
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
  const saving: Env = { ...env, saved: { after: savedRef(req), commit: null } };
  const res = path === '/admin/api/add' ? await addOrgs(saving, admin, body)
    : path === '/admin/api/review' ? await review(saving, admin, body)
      : path === '/admin/api/candidates' ? await decideCandidates(saving, admin, body)
        : path === '/admin/api/details' ? await setDetails(saving, admin, body)
          : json({ error: 'Not found.' }, 404);
  if (saving.saved?.commit) res.headers.append('set-cookie', savedCookie(saving.saved.commit));
  return res;
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
