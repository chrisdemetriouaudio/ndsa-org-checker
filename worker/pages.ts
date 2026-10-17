import { AUDIENCE_LABEL, AUDIENCES } from '../src/audience.ts';
import { AREAS, FOCUS, KINDS, MAX_PER_ADD } from '../src/neworg.ts';
import { dateWords, scoreHue, TICK } from '../src/render.ts';
import { FLAGGED, type Org, type Summary } from '../src/types.ts';
import type { Admin } from './auth.ts';

export const esc = (t: unknown) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLE = `
:root{--bg:#fbfaf7;--card:#fff;--ink:#1d1d1b;--quiet:#5c5b57;--line:#e3e0d8;--accent:#2f5d8a;--accent-ink:#fff;--note:#fff4d6;--bad:#b3261e;--good:#2e7d4f}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--card:#1f1f1d;--ink:#eeece6;--quiet:#a9a69e;--line:#34332f;--accent:#8db8e3;--accent-ink:#10202f;--note:#3a3120;--bad:#f28b82;--good:#7fd19b}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:18px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.01em}
main{max-width:1000px;margin:0 auto;padding:28px 16px 64px}h1{font-size:1.7rem;margin:0 0 4px}h2{font-size:1.25rem;margin:32px 0 10px;padding-bottom:4px;border-bottom:1px solid var(--line)}
.quiet{color:var(--quiet)}.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin:12px 0}
a{color:var(--accent)}button,.btn{font:inherit;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:var(--accent-ink);padding:8px 16px;cursor:pointer}
button.plain{background:transparent;color:var(--accent)}button.danger{border-color:var(--bad);background:transparent;color:var(--bad)}
input,select,textarea{font:inherit;width:100%;padding:9px 12px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)}
textarea{min-height:150px;font-family:ui-monospace,Menlo,monospace;font-size:.9rem}
label{display:block;font-weight:600;margin:12px 0 4px}.checks{display:flex;flex-wrap:wrap;gap:4px 16px}.checks label{font-weight:400;display:flex;gap:6px;align-items:center;margin:0}.checks input{width:auto}
.row{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}@media(max-width:640px){.row{grid-template-columns:1fr}}
.msg{border-radius:8px;padding:8px 12px;margin:12px 0}.msg.ok{background:color-mix(in srgb,var(--good) 15%,transparent)}.msg.bad{background:color-mix(in srgb,var(--bad) 15%,transparent)}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
table{width:100%;border-collapse:collapse;font-size:.92rem}th,td{padding:8px 6px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{font-weight:600}
td.ticks{white-space:nowrap;letter-spacing:2px}.score{font-weight:700;border-radius:8px;padding:1px 9px;white-space:nowrap;--h:0;background:hsl(var(--h) 70% 92%);color:hsl(var(--h) 75% 26%)}
@media (prefers-color-scheme:dark){.score{background:hsl(var(--h) 45% 20%);color:hsl(var(--h) 70% 72%)}}
details>summary{cursor:pointer;color:var(--accent)}.inline{display:flex;gap:8px;margin-top:6px}.inline input{flex:1}
.table-wrap{overflow-x:auto}`;

/** Every page: same shell, strict headers are added by the router. Scripts carry the request's nonce. */
export function layout(title: string, body: string, nonceValue: string, script = ''): string {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)}</title><style>${STYLE}</style></head>
<body><main>${body}</main>${script ? `<script nonce="${nonceValue}">${script}</script>` : ''}</body></html>`;
}

const POST_JS = `
async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Something went wrong. Please try again.');
  return j;
}
function say(el, text, ok) { el.hidden = false; el.className = 'msg ' + (ok ? 'ok' : 'bad'); el.textContent = text; }
const passkeysWork = !!(window.PublicKeyCredential && PublicKeyCredential.parseRequestOptionsFromJSON);`;

export function signInPage(n: string): string {
  return layout('Admin sign in', `
<h1>Admin sign in</h1>
<p class="quiet">Only people on the admin list can sign in.</p>
<div class="card">
  <h2 style="margin-top:0">Sign in with your passkey</h2>
  <p>Use your face, fingerprint or device PIN.</p>
  <button id="pk">Sign in with a passkey</button>
  <div id="pk-msg" hidden></div>
</div>
<div class="card">
  <h2 style="margin-top:0">First time, or new device?</h2>
  <p>We'll e-mail you a sign-in link. Then you add a passkey.</p>
  <form id="link"><label for="email">Your e-mail address</label><input id="email" type="email" autocomplete="email" required>
  <p><button>E-mail me a link</button></p></form>
  <div id="link-msg" hidden></div>
</div>
<p class="quiet"><a href="/">Back to the directory</a></p>`, n, `${POST_JS}
document.getElementById('pk').onclick = async () => {
  const m = document.getElementById('pk-msg');
  if (!passkeysWork) return say(m, 'This browser cannot use passkeys. Please update it, or use another browser.', false);
  try {
    const { id, options } = await post('/auth/passkey/options');
    const cred = await navigator.credentials.get({ publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(options) });
    await post('/auth/passkey/verify', { id, response: cred.toJSON() });
    location.href = '/admin';
  } catch (e) { say(m, e.name === 'NotAllowedError' ? 'Sign-in was cancelled.' : e.message, false); }
};
document.getElementById('link').onsubmit = async (ev) => {
  ev.preventDefault();
  const m = document.getElementById('link-msg');
  try { await post('/auth/email', { email: document.getElementById('email').value }); say(m, 'If that address is on the admin list, a link is on its way. It works once, for 15 minutes.', true); }
  catch (e) { say(m, e.message, false); }
};`);
}

/** A link opened from e-mail only shows this button, so e-mail scanners cannot use it up. */
export function linkPage(n: string, token: string): string {
  return layout('Continue signing in', `
<h1>Continue signing in</h1>
<form method="post" action="/auth/link"><input type="hidden" name="t" value="${esc(token)}"><p><button>Continue</button></p></form>`, n);
}

export function messagePage(n: string, title: string, text: string): string {
  return layout(title, `<h1>${esc(title)}</h1><p>${esc(text)}</p><p><a href="/admin">Go to sign in</a></p>`, n);
}

const USE_PASSKEY_JS = `
async function usePasskey(m) {
  const { id, options } = await post('/auth/passkey/options');
  const cred = await navigator.credentials.get({ publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(options) });
  await post('/auth/passkey/verify', { id, response: cred.toJSON() });
  location.href = '/admin';
}
async function addPasskey() {
  const { id, options } = await post('/auth/passkey/register-options');
  const cred = await navigator.credentials.create({ publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(options) });
  await post('/auth/passkey/register', { id, response: cred.toJSON() });
  location.href = '/admin';
}
function why(e, action) {
  if (e.name === 'InvalidStateError') return 'This device already has your passkey. Click "Use my passkey" instead.';
  if (e.name === 'NotAllowedError') return action + ' was cancelled or timed out. Please try again.';
  return e.message;
}`;

/**
 * After an e-mailed link. Someone who already has a passkey is offered it first: a device that holds
 * one refuses to make a second for the same account ("InvalidStateError"), which looked like a loop.
 */
export function passkeySetupPage(n: string, admin: Admin, hasPasskey: boolean): string {
  const use = `<div class="card"><h2 style="margin-top:0">Use my passkey</h2>
<p>You already have a passkey. Use it to finish signing in.</p>
<p><button id="use">Use my passkey</button></p><div id="use-msg" hidden></div></div>`;
  const add = `<div class="card"><h2 style="margin-top:0">${hasPasskey ? 'New device?' : 'Add a passkey'}</h2>
<p>${hasPasskey ? 'Add a passkey for this device if your passkey is not on it.' : 'A passkey uses your face, fingerprint or device PIN. Nothing to remember, and it cannot be phished.'}</p>
<p><button id="add" class="${hasPasskey ? 'plain' : ''}">Add a passkey${hasPasskey ? ' for this device' : ''}</button></p><div id="add-msg" hidden></div></div>`;
  return layout(hasPasskey ? 'Finish signing in' : 'Add a passkey', `
<h1>${hasPasskey ? 'Finish signing in' : 'Add a passkey'}</h1>
<p>Hello ${esc(admin.name)}.</p>
${hasPasskey ? use + add : add}`, n, `${POST_JS}${USE_PASSKEY_JS}
const run = (button, box, fn, action) => { const el = document.getElementById(button); if (!el) return; el.onclick = async () => {
  const m = document.getElementById(box);
  if (!passkeysWork) return say(m, 'This browser cannot use passkeys. Please update it, or use another browser.', false);
  try { await fn(m); } catch (e) { say(m, why(e, action), false); }
}; };
run('use', 'use-msg', usePasskey, 'Signing in');
run('add', 'add-msg', addPasskey, 'Adding the passkey');`);
}

type Row = Summary['orgs'][string];
const LEVEL: Record<string, 'green' | 'amber' | 'red' | 'none'> = { g: 'green', a: 'amber', r: 'red', n: 'none' };
const scoreBadge = (s?: Row) => (s?.score == null ? '<span class="quiet">—</span>' : `<span class="score" style="--h:${scoreHue(s.score)}">${s.score}</span>`);
const tickRow = (s: Row | undefined, labels: string[]) => [...(s?.ticks ?? '')].map((c, i) => `<span title="${esc(`${labels[i] ?? ''}${s!.notes[i] ? `: ${s!.notes[i]}` : ''}`)}">${TICK[LEVEL[c] ?? 'none']}</span>`).join('');

function options(list: string[], selected?: string) {
  return list.map((v) => `<option${v === selected ? ' selected' : ''}>${esc(v)}</option>`).join('');
}

function focusBoxes(prefix: string) {
  return `<div class="checks">${FOCUS.map((f, i) => `<label><input type="checkbox" name="focus" value="${esc(f)}" id="${prefix}${i}"> ${esc(f)}</label>`).join('')}</div>`;
}

function audienceBoxes(prefix: string, chosen: string[] = []) {
  return `<div class="checks">${AUDIENCES.map((a) => `<label><input type="checkbox" name="audiences" value="${a}" id="${prefix}${a}"${chosen.includes(a) ? ' checked' : ''}> ${esc(AUDIENCE_LABEL[a])}</label>`).join('')}</div>`;
}

function detailsControl(org: Org) {
  const cov = org.coverage ?? 'national';
  return `<details><summary>Edit details</summary><form data-api="/admin/api/details" class="inline" style="flex-direction:column">
<input type="hidden" name="id" value="${esc(org.id)}">
<strong>Who it is for</strong>${audienceBoxes(`w-${esc(org.id)}-`, org.audiences ?? [])}
<label for="pc-${esc(org.id)}">Base postcode</label><input id="pc-${esc(org.id)}" name="postcode" value="${esc(org.postcode ?? '')}" placeholder="Where it is based, like SO23 9AA">
<label for="cov-${esc(org.id)}">Works</label><select id="cov-${esc(org.id)}" name="coverage"><option value="local"${cov === 'local' ? ' selected' : ''}>Locally (shown by distance)</option><option value="national"${cov === 'national' ? ' selected' : ''}>Across the nation</option></select>
<button class="plain">Save</button></form></details>`;
}

function removeControl(org: Org) {
  return `<details><summary>Remove</summary><form data-api="/admin/api/review" class="inline">
<input type="hidden" name="id" value="${esc(org.id)}"><input type="hidden" name="action" value="remove">
<input name="reason" placeholder="Why? For example: closed in 2025" required aria-label="Reason for removing ${esc(org.name)}"><button class="danger">Remove</button></form></details>`;
}

export function adminPage(n: string, admin: Admin, orgs: Org[], state: Summary): string {
  const rows = [...orgs].sort((a, b) => a.name.localeCompare(b.name));
  const pending = rows.filter((o) => !state.orgs[o.id] && o.review?.status !== 'Closed');
  const flagged = rows.filter((o) => state.orgs[o.id] && FLAGGED.includes(state.orgs[o.id].status));
  const closed = rows.filter((o) => o.review?.status === 'Closed');
  const live = rows.filter((o) => o.review?.status !== 'Closed' && state.orgs[o.id]);
  const scores = live.map((o) => state.orgs[o.id].score).filter((x): x is number => x !== null);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const header = state.labels;

  const body = `
<div class="top"><div><h1>Admin</h1><p class="quiet" style="margin:0">ND Support Directory · signed in as ${esc(admin.name)}</p></div>
<div><a href="/">Directory</a> &nbsp; <button class="plain" id="out">Sign out</button></div></div>

<div class="card"><strong>At a glance:</strong> ${live.length} listed · ${flagged.length} to review · ${pending.length} being checked · ${closed.length} removed · average score ${avg ?? '—'}. Last daily check: ${dateWords(state.updated)}.</div>

<div class="card"><strong>Found in the charity registers:</strong> organisations that may belong here, waiting for a person to check. <a href="/admin/candidates">Review candidates</a></div>

<h2>Add an organisation</h2>
<form data-api="/admin/api/add" data-kind="one" class="card">
<div class="row"><div><label for="a-name">Name</label><input id="a-name" name="name" required maxlength="120"></div>
<div><label for="a-url">Website</label><input id="a-url" name="url" required placeholder="https://www.example.org.uk"></div></div>
<div class="row"><div><label for="a-area">Area</label><input id="a-area" name="area" list="areas" placeholder="UK, Scotland, Hampshire…"><datalist id="areas">${options(AREAS)}</datalist></div>
<div><label for="a-kind">Type</label><select id="a-kind" name="kind">${options(KINDS, 'Not sure')}</select></div></div>
<div class="row"><div><label for="a-pc">Base postcode (optional)</label><input id="a-pc" name="postcode" placeholder="Where it is based, like SO23 9AA"></div>
<div><label for="a-cov">Works</label><select id="a-cov" name="coverage"><option value="local">Locally (shown by distance)</option><option value="national">Across the nation</option></select></div></div>
<label for="a-num">Charity number (England and Wales, optional)</label><input id="a-num" name="charityNumber" inputmode="numeric" placeholder="Leave blank if unsure">
<label>Who it supports</label>${focusBoxes('a-f')}
<label>Who it is for (tick all that apply; none = ages not stated)</label>${audienceBoxes('a-a')}
<p><button>Add and check now</button></p><div class="out" hidden></div></form>

<details class="card"><summary><strong>Add several at once</strong> (up to ${MAX_PER_ADD})</summary>
<form data-api="/admin/api/add" data-kind="many">
<label for="m-lines">One per line: name | website | area | charity number</label>
<textarea id="m-lines" name="lines" placeholder="Autism Hampshire | autismhampshire.org.uk | Hampshire | 288141&#10;ADHD Embrace | adhdembrace.org"></textarea>
<p class="quiet">Area and charity number are optional. Pasting two columns from a spreadsheet works too.</p>
<label for="m-kind">Type (for all of them)</label><select id="m-kind" name="kind">${options(KINDS, 'Not sure')}</select>
<label>Who they support (for all of them)</label>${focusBoxes('m-f')}
<label>Who they are for (for all of them)</label>${audienceBoxes('m-a')}
<p><button>Add all and check now</button></p><div class="out" hidden></div></form></details>

${pending.length ? `<h2>Being checked now</h2><div class="card">${pending.map((o) => `<div>⏳ <strong>${esc(o.name)}</strong> <span class="quiet">${esc(o.url)}</span></div>`).join('')}
<p class="quiet">Results usually appear in 1 to 2 minutes. This page refreshes itself.</p></div>` : ''}

<h2>To review (${flagged.length})</h2>
${flagged.length ? flagged.map((o) => {
    const s = state.orgs[o.id];
    return `<div class="card"><div class="top"><strong>${esc(o.name)}</strong> ${scoreBadge(s)}</div>
<p style="margin:6px 0">${s.proven ? 'Proven closed' : esc(s.status)}: ${esc(s.reasons.join('. '))}</p>
<div class="inline"><form data-api="/admin/api/review"><input type="hidden" name="id" value="${esc(o.id)}"><input type="hidden" name="action" value="still-running"><button class="plain">It is still running</button></form></div>
${removeControl(o)}</div>`;
  }).join('') : '<p>Nothing to review.</p>'}

<h2>All organisations (${live.length})</h2>
<p class="quiet">Hover over a tick to see what it measured. ${header.length ? `Ticks, in order: ${header.map(esc).join(' · ')}.` : ''}</p>
<div class="table-wrap"><table><thead><tr><th>Organisation</th><th>Score</th><th>Status</th><th>Ticks</th><th>For</th><th>Checked</th><th></th></tr></thead><tbody>
${live.map((o) => {
    const s = state.orgs[o.id];
    return `<tr><td><a href="${esc(o.url)}">${esc(o.name)}</a><br><span class="quiet">${esc(o.area)}</span></td><td>${scoreBadge(s)}</td><td>${esc(s.status)}</td><td class="ticks">${tickRow(s, state.labels)}</td><td>${o.audiences?.length ? o.audiences.map(esc).join(', ') : '<span class="quiet">not stated</span>'}<br><span class="quiet">${o.coverage === 'local' ? `Local · ${esc(o.postcode ?? 'no postcode')}` : 'Across the nation'}</span>${detailsControl(o)}</td><td>${dateWords(s.lastChecked)}</td><td>${removeControl(o)}</td></tr>`;
  }).join('')}
</tbody></table></div>

<h2>Removed (${closed.length})</h2>
${closed.length ? closed.map((o) => `<div class="card"><strong>${esc(o.name)}</strong>: ${esc(o.review?.note ?? '')} <span class="quiet">(${esc(o.review?.by)}, ${dateWords(o.review?.date ?? null)})</span>
<form data-api="/admin/api/review" class="inline"><input type="hidden" name="id" value="${esc(o.id)}"><input type="hidden" name="action" value="restore"><button class="plain">Restore</button></form></div>`).join('') : '<p>None.</p>'}`;

  return layout('Admin · ND Support Directory', body, n, `${POST_JS}
document.getElementById('out').onclick = async () => { await post('/auth/signout'); location.href = '/admin'; };
for (const form of document.querySelectorAll('form[data-api]')) {
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    const body = Object.fromEntries([...fd.entries()].filter(([k]) => k !== 'focus' && k !== 'audiences'));
    body.focus = fd.getAll('focus');
    body.audiences = fd.getAll('audiences');
    const out = form.querySelector('.out') || form.parentElement.querySelector('.out') || document.createElement('div');
    const button = form.querySelector('button'); button.disabled = true;
    try {
      const r = await post(form.dataset.api, body);
      if (r.problems && r.problems.length && out.isConnected) {
        say(out, (r.added ? r.added + ' added. ' : '') + 'Not added: ' + r.problems.join(' '), !r.added ? false : true);
        if (r.added) setTimeout(() => location.reload(), 2500);
      } else location.reload();
    } catch (e) { if (out.isConnected) say(out, e.message, false); else alert(e.message); }
    finally { button.disabled = false; }
  };
}
${pending.length ? "setTimeout(() => location.reload(), 20000);" : ''}`);
}

/**
 * Review list for discovered candidates. The (public) candidates file is loaded by the browser straight from
 * GitHub, so the Worker stays within its small free-tier CPU budget; register text is only ever set as text.
 */
export function candidatesPage(n: string, admin: Admin, decided: string[], repo: string): string {
  const body = `
<div class="top"><div><h1>Candidates</h1><p class="quiet" style="margin:0">Organisations found in the charity registers · signed in as ${esc(admin.name)}</p></div>
<div><a href="/admin">Back to admin</a></div></div>
<div class="card"><p style="margin:0">Clear ones are added or turned down automatically every morning. <strong>These are the ones the rules could not decide.</strong> Tick, then choose <strong>Add to the directory</strong> or <strong>Not relevant</strong>. Either way it leaves this list for good.</p></div>
<div class="card">
<div class="row"><div><label for="f-nation">Nation</label><select id="f-nation"><option value="">All nations</option><option>England</option><option>Wales</option><option>Scotland</option><option>Northern Ireland</option></select></div>
<div><label for="f-cond">Condition</label><select id="f-cond"><option value="">All conditions</option></select></div></div>
<div class="row"><div><label for="f-verdict">Show</label><select id="f-verdict"><option value="review">Needs a person</option><option value="no-website">Would be added, but no website</option><option value="">All waiting</option></select></div><div></div></div>
<div class="row"><div><label for="f-aud">Who for</label><select id="f-aud"><option value="">Everyone</option>${AUDIENCES.map((a) => `<option value="${a}">${esc(AUDIENCE_LABEL[a])}</option>`).join('')}</select></div><div></div></div>
<div class="row"><div><label for="f-q">Search</label><input id="f-q" type="search" placeholder="Name, place or words"></div>
<div><label>&nbsp;</label><label style="font-weight:400;display:flex;gap:8px;align-items:center"><input type="checkbox" id="f-named" style="width:auto"> Only ones named for a condition</label>
<label style="font-weight:400;display:flex;gap:8px;align-items:center;margin-top:4px"><input type="checkbox" id="f-new" style="width:auto"> New only (found in the last 14 days)</label></div></div>
</div>
<p id="count" class="quiet">Loading…</p>
<div class="inline" style="margin-bottom:12px"><button id="add">Add to the directory</button><button id="reject" class="danger">Not relevant</button><span id="picked" class="quiet" style="align-self:center"></span></div>
<div id="msg" hidden></div>
<div class="table-wrap"><table><thead><tr><th></th><th>Organisation</th><th>Nation</th><th>Conditions</th><th>What it does, and why it is here</th></tr></thead><tbody id="rows"></tbody></table></div>
<div class="inline" style="margin-top:12px"><button id="prev" class="plain">Previous</button><span id="page" class="quiet" style="align-self:center"></span><button id="next" class="plain">Next</button></div>`;

  return layout('Candidates · ND Support Directory', body, n, `${POST_JS}
const DECIDED = new Set(${JSON.stringify(decided)});
const PER_PAGE = 50, MAX = ${MAX_PER_ADD};
const REGISTER = {
  ccew: (n) => 'https://register-of-charities.charitycommission.gov.uk/charity-search/-/charity-details/' + n,
  oscr: (n) => 'https://www.oscr.org.uk/about-charities/search-the-register/charity-details?number=' + n,
  ccni: (n) => 'https://www.charitycommissionni.org.uk/charity-details/?regId=' + n,
};
let all = [], shown = [], page = 0, baseline = '';
const NEW_DAYS = 14;
const isNew = (c) => c.firstSeen && c.firstSeen > baseline && (Date.now() - Date.parse(c.firstSeen)) / 864e5 <= NEW_DAYS;
const picked = new Map();
const $ = (id) => document.getElementById(id);
const el = (tag, text, attrs) => { const e = document.createElement(tag); if (text != null) e.textContent = text; for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); return e; };

function filter() {
  const verdict = $('f-verdict').value, aud = $('f-aud').value, nation = $('f-nation').value, cond = $('f-cond').value, q = $('f-q').value.trim().toLowerCase(), named = $('f-named').checked, fresh = $('f-new').checked;
  shown = all.filter((c) => (!verdict || (c.triage && c.triage.verdict === verdict)) && (!aud || (c.audiences || []).includes(aud)) && (!nation || c.nations.includes(nation)) && (!cond || c.conditions.includes(cond)) && (!named || c.inName) && (!fresh || isNew(c))
    && (!q || (c.name + ' ' + c.area + ' ' + c.snippet).toLowerCase().includes(q)));
  page = 0; draw();
}
function draw() {
  const body = $('rows'); body.replaceChildren();
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  page = Math.min(page, pages - 1);
  for (const c of shown.slice(page * PER_PAGE, (page + 1) * PER_PAGE)) {
    const tr = el('tr');
    const box = el('input', null, { type: 'checkbox', 'aria-label': 'Choose ' + c.name });
    box.style.width = 'auto'; box.checked = picked.has(c.key);
    box.onchange = () => { if (box.checked) { if (picked.size >= MAX) { box.checked = false; return say($('msg'), 'Choose at most ' + MAX + ' at a time.', false); } picked.set(c.key, c); } else picked.delete(c.key); count(); };
    const name = el('td'); if (isNew(c)) { const b = el('strong', 'NEW '); b.style.color = 'var(--good)'; name.append(b); } const a = el('a', c.name, { href: REGISTER[c.source](c.number), target: '_blank', rel: 'noopener' }); name.append(a, el('br'));
    name.append(c.website ? el('a', c.website.replace(/^https?:\\/\\//, ''), { href: c.website, target: '_blank', rel: 'noopener' }) : el('span', 'No website on the register', { class: 'quiet' }));
    name.append(el('br'), el('span', c.form + ' · ' + c.area, { class: 'quiet' }));
    const why = el('td', c.about || c.snippet); if (c.triage) { why.append(el('br'), el('span', 'Score ' + c.triage.score + ': ' + c.triage.reasons.join('; '), { class: 'quiet' })); }
    tr.append(el('td'), name, el('td', c.nations.join(', ')), el('td', c.conditions.join(', ') + ((c.audiences || []).length ? ' · for ' + c.audiences.join(', ') : '')), why);
    tr.firstChild.append(box);
    body.append(tr);
  }
  $('page').textContent = 'Page ' + (page + 1) + ' of ' + pages;
  $('prev').disabled = page === 0; $('next').disabled = page >= pages - 1;
  count();
}
function count() {
  $('count').textContent = shown.length + ' of ' + all.length + ' candidates shown.';
  $('picked').textContent = picked.size ? picked.size + ' ticked' : '';
}
async function decide(action) {
  if (!picked.size) return say($('msg'), 'Tick at least one first.', false);
  const items = [...picked.values()];
  if (action === 'add' && items.some((c) => !c.website)) return say($('msg'), 'Some ticked ones have no website on the register. Untick them, or add them by hand with their website.', false);
  for (const b of [$('add'), $('reject')]) b.disabled = true;
  try {
    const r = await post('/admin/api/candidates', { action, items });
    for (const key of r.done) { DECIDED.add(key); picked.delete(key); }
    all = all.filter((c) => !DECIDED.has(c.key));
    say($('msg'), (action === 'add' ? r.done.length + ' added. They are being checked now.' : r.done.length + ' marked not relevant.') + (r.problems.length ? ' Not done: ' + r.problems.join(' ') : ''), !r.problems.length);
    filter();
  } catch (e) { say($('msg'), e.message, false); }
  finally { for (const b of [$('add'), $('reject')]) b.disabled = false; }
}
$('add').onclick = () => decide('add');
$('reject').onclick = () => decide('reject');
$('prev').onclick = () => { page--; draw(); scrollTo(0, 0); };
$('next').onclick = () => { page++; draw(); scrollTo(0, 0); };
for (const id of ['f-verdict', 'f-aud', 'f-nation', 'f-cond', 'f-named', 'f-new']) $(id).onchange = filter;
$('f-q').oninput = filter;
fetch('https://raw.githubusercontent.com/${repo}/main/data/candidates.json', { cache: 'no-store' })
  .then((r) => r.json())
  .then((data) => {
    baseline = data.baseline || data.updated || '';
    all = data.candidates.filter((c) => !DECIDED.has(c.key)).sort((a, b) => Number(isNew(b)) - Number(isNew(a)));
    for (const cond of [...new Set(all.flatMap((c) => c.conditions))].sort()) $('f-cond').append(el('option', cond));
    filter();
  })
  .catch(() => { $('count').textContent = 'Could not load the candidates. Please refresh the page.'; });`);
}
