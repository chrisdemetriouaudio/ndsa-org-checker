/**
 * Admin sign-in: an e-mail on the admin list, then a passkey.
 *
 *  - An e-mailed link (single use, 15 minutes) only proves the address. It gives a short "link"
 *    session that can do one thing: add a passkey. Admin work always needs a "passkey" session.
 *  - Passkey sign-in is username-less (discoverable credentials, user verification required).
 *  - Sign-in requests answer the same whether or not the address is on the list.
 *  - Tokens are random, stored only as SHA-256 hashes; the cookie is __Host-, HttpOnly, Secure, SameSite=Strict.
 */
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { b64urlEncode, randomToken, sha256Hex } from './crypto.ts';
import {
  authenticationOptions, looksLikeAssertion, looksLikeAttestation, newUserHandle, registrationOptions,
  verifyAssertion, verifyRegistration, type RelyingParty,
} from './webauthn.ts';

export interface Env {
  DB: D1Database;
  ORIGIN: string;
  RP_ID: string;
  EMAIL_FROM: string;
  GITHUB_REPO: string;
  RESEND_API_KEY?: string;
  GITHUB_TOKEN?: string;
}

/** An error whose message is safe and useful to show the person. Anything else shows a plain apology. */
export class SafeError extends Error {}

export interface Admin { email: string; name: string; level: 'link' | 'passkey' }

const COOKIE = '__Host-ndsa';
const LINK_TTL = 15 * 60;
const LINK_SESSION_TTL = 30 * 60;
const SESSION_TTL = 12 * 60 * 60;
const CHALLENGE_TTL = 5 * 60;
const now = () => Math.floor(Date.now() / 1000);

export const rp = (env: Env): RelyingParty => ({ rpID: env.RP_ID, rpName: 'ND Support Directory', origin: env.ORIGIN });
export const isEmail = (s: string) => /^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[a-z]{2,}$/i.test(s);

export async function audit(env: Env, email: string | null, action: string, detail = '') {
  await env.DB.prepare('INSERT INTO audit (at, email, action, detail) VALUES (?, ?, ?, ?)').bind(now(), email, action, detail.slice(0, 500)).run();
}

/** Fixed-window counter. Returns false once `limit` is passed in the window. */
async function allow(env: Env, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const t = now();
  const row = await env.DB.prepare('SELECT window_start, count FROM rate_limits WHERE key = ?').bind(key).first<{ window_start: number; count: number }>();
  if (!row || t - row.window_start >= windowSeconds) {
    await env.DB.prepare('INSERT OR REPLACE INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)').bind(key, t).run();
    return true;
  }
  if (row.count >= limit) return false;
  await env.DB.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').bind(key).run();
  return true;
}

// ---- Sessions ----

function readCookie(req: Request): string | null {
  const m = /(?:^|;\s*)__Host-ndsa=([A-Za-z0-9_-]{20,100})/.exec(req.headers.get('cookie') ?? '');
  return m ? m[1] : null;
}

export async function currentAdmin(req: Request, env: Env): Promise<Admin | null> {
  const token = readCookie(req);
  if (!token) return null;
  const row = await env.DB.prepare(
    'SELECT s.email, s.level, a.name FROM sessions s JOIN admins a ON a.email = s.email WHERE s.token_hash = ? AND s.expires_at > ?',
  ).bind(await sha256Hex(token), now()).first<Admin>();
  return row ?? null;
}

/** Starts a session and returns its Set-Cookie header. Any older session on this browser is ended. */
export async function startSession(req: Request, env: Env, email: string, level: Admin['level']): Promise<string> {
  await endSession(req, env);
  const token = randomToken(32);
  const ttl = level === 'passkey' ? SESSION_TTL : LINK_SESSION_TTL;
  await env.DB.prepare('INSERT INTO sessions (token_hash, email, level, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256Hex(token), email, level, now(), now() + ttl).run();
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now()).run();
  return `${COOKIE}=${token}; Path=/; Max-Age=${ttl}; HttpOnly; Secure; SameSite=Strict`;
}

export async function endSession(req: Request, env: Env): Promise<string> {
  const token = readCookie(req);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

// ---- E-mailed sign-in links ----

export async function requestLink(env: Env, rawEmail: string, ip: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  if (!isEmail(email)) return;
  const ipKey = `ip:${(await sha256Hex(`ndsa:${ip}`)).slice(0, 32)}`;
  if (!(await allow(env, ipKey, 10, 3600))) return;
  if (!(await allow(env, `email:${email}`, 3, 15 * 60))) return;
  const admin = await env.DB.prepare('SELECT email, name FROM admins WHERE email = ?').bind(email).first<{ email: string; name: string }>();
  if (!admin) {
    await audit(env, null, 'link-refused', 'address not on the admin list');
    return;
  }
  const token = randomToken(32);
  await env.DB.prepare('INSERT INTO login_links (token_hash, email, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(token), email, now(), now() + LINK_TTL).run();
  const link = `${env.ORIGIN}/auth/link?t=${token}`;
  await sendEmail(env, email, 'Your sign-in link for the ND Support Directory', [
    `Hello ${admin.name},`,
    '',
    'Here is your sign-in link for the ND Support Directory admin area.',
    'It works once, for 15 minutes:',
    '',
    link,
    '',
    'After signing in you will add a passkey, so next time you can sign in with your face, fingerprint or device PIN.',
    '',
    'If you did not ask for this, you can ignore this e-mail.',
  ].join('\n'));
  await audit(env, email, 'link-sent');
}

/** Uses up a link. Returns the admin's e-mail, or null if it is unknown, used or expired. */
export async function consumeLink(env: Env, token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const hash = await sha256Hex(token);
  const res = await env.DB.prepare('UPDATE login_links SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING email')
    .bind(now(), hash, now()).first<{ email: string }>();
  return res?.email ?? null;
}

async function sendEmail(env: Env, to: string, subject: string, text: string) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text }),
  });
  if (!res.ok) throw new Error(`E-mail failed: HTTP ${res.status}`);
}

// ---- Passkeys ----

async function saveChallenge(env: Env, kind: string, challenge: string, email: string | null): Promise<string> {
  const id = randomToken(18);
  await env.DB.prepare('INSERT INTO challenges (id, kind, challenge, email, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, kind, challenge, email, now() + CHALLENGE_TTL).run();
  await env.DB.prepare('DELETE FROM challenges WHERE expires_at < ?').bind(now()).run();
  return id;
}

async function takeChallenge(env: Env, id: unknown, kind: string): Promise<{ challenge: string; email: string | null } | null> {
  if (typeof id !== 'string' || id.length > 64) return null;
  return env.DB.prepare('DELETE FROM challenges WHERE id = ? AND kind = ? AND expires_at > ? RETURNING challenge, email')
    .bind(id, kind, now()).first<{ challenge: string; email: string | null }>();
}

export async function passkeyRegistrationOptions(env: Env, admin: Admin) {
  const row = await env.DB.prepare('SELECT user_handle FROM admins WHERE email = ?').bind(admin.email).first<{ user_handle: string }>();
  const existing = await env.DB.prepare('SELECT id, transports FROM passkeys WHERE email = ?').bind(admin.email).all<{ id: string; transports: string }>();
  const options = await registrationOptions(
    rp(env),
    { handle: row!.user_handle, name: admin.email, displayName: admin.name },
    existing.results.map((p) => ({ id: p.id, transports: JSON.parse(p.transports) as string[] })),
  );
  return { id: await saveChallenge(env, 'register', options.challenge, admin.email), options };
}

export async function passkeyRegister(env: Env, admin: Admin, body: { id?: unknown; response?: unknown }): Promise<boolean> {
  const saved = await takeChallenge(env, body.id, 'register');
  if (!saved || saved.email !== admin.email || !looksLikeAttestation(body.response)) return false;
  const v = await verifyRegistration(rp(env), body.response as RegistrationResponseJSON, saved.challenge);
  if (!v) return false;
  await env.DB.prepare(
    'INSERT INTO passkeys (id, email, public_key, counter, transports, device_type, backed_up, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(v.credentialId, admin.email, v.publicKey, v.counter, JSON.stringify(v.transports), v.deviceType, v.backedUp ? 1 : 0, now()).run();
  await audit(env, admin.email, 'passkey-added', v.deviceType);
  return true;
}

export async function passkeySignInOptions(env: Env) {
  const options = await authenticationOptions(rp(env));
  return { id: await saveChallenge(env, 'signin', options.challenge, null), options };
}

/** Returns the admin's e-mail when the passkey checks out. */
export async function passkeySignIn(env: Env, body: { id?: unknown; response?: unknown }): Promise<string | null> {
  const saved = await takeChallenge(env, body.id, 'signin');
  if (!saved || !looksLikeAssertion(body.response)) return null;
  const response = body.response as AuthenticationResponseJSON;
  const cred = await env.DB.prepare('SELECT id, email, public_key, counter, transports FROM passkeys WHERE id = ?')
    .bind(response.id).first<{ id: string; email: string; public_key: string; counter: number; transports: string }>();
  if (!cred) return null;
  const v = await verifyAssertion(rp(env), response, saved.challenge, {
    id: cred.id, publicKey: cred.public_key, counter: cred.counter, transports: JSON.parse(cred.transports) as string[],
  });
  if (!v) return null;
  await env.DB.prepare('UPDATE passkeys SET counter = ?, last_used_at = ? WHERE id = ?').bind(v.newCounter, now(), cred.id).run();
  await env.DB.prepare('UPDATE admins SET last_sign_in_at = ? WHERE email = ?').bind(now(), cred.email).run();
  await audit(env, cred.email, 'signed-in', 'passkey');
  return cred.email;
}

export const newHandle = () => newUserHandle();
export const nonce = () => b64urlEncode(crypto.getRandomValues(new Uint8Array(16)));
