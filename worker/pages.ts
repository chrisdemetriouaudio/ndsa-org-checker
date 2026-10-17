import { AREAS, FOCUS, KINDS, MAX_PER_ADD } from '../src/neworg.ts';
import { dateWords, scoreHue, TICK } from '../src/render.ts';
import { FLAGGED, type Org, type OrgState, type State } from '../src/types.ts';
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

export function passkeySetupPage(n: string, admin: Admin): string {
  return layout('Add a passkey', `
<h1>Add a passkey</h1>
<p>Hello ${esc(admin.name)}. To finish, add a passkey on this device.</p>
<p class="quiet">A passkey uses your face, fingerprint or device PIN. Nothing to remember, and it cannot be phished.</p>
<p><button id="add">Add a passkey</button></p><div id="m" hidden></div>`, n, `${POST_JS}
document.getElementById('add').onclick = async () => {
  const m = document.getElementById('m');
  if (!passkeysWork) return say(m, 'This browser cannot use passkeys. Please update it, or use another browser.', false);
  try {
    const { id, options } = await post('/auth/passkey/register-options');
    const cred = await navigator.credentials.create({ publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(options) });
    await post('/auth/passkey/register', { id, response: cred.toJSON() });
    location.href = '/admin';
  } catch (e) { say(m, e.name === 'NotAllowedError' ? 'Adding the passkey was cancelled.' : e.message, false); }
};`);
}

const scoreBadge = (s?: OrgState) => (s?.score == null ? '<span class="quiet">—</span>' : `<span class="score" style="--h:${scoreHue(s.score)}">${s.score}</span>`);
const ticks = (s?: OrgState) => (s?.signals ?? []).map((x) => `<span title="${esc(`${x.label}: ${x.detail}`)}">${TICK[x.level]}</span>`).join('');

function options(list: string[], selected?: string) {
  return list.map((v) => `<option${v === selected ? ' selected' : ''}>${esc(v)}</option>`).join('');
}

function focusBoxes(prefix: string) {
  return `<div class="checks">${FOCUS.map((f, i) => `<label><input type="checkbox" name="focus" value="${esc(f)}" id="${prefix}${i}"> ${esc(f)}</label>`).join('')}</div>`;
}

function removeControl(org: Org) {
  return `<details><summary>Remove</summary><form data-api="/admin/api/review" class="inline">
<input type="hidden" name="id" value="${esc(org.id)}"><input type="hidden" name="action" value="remove">
<input name="reason" placeholder="Why? For example: closed in 2025" required aria-label="Reason for removing ${esc(org.name)}"><button class="danger">Remove</button></form></details>`;
}

export function adminPage(n: string, admin: Admin, orgs: Org[], state: State): string {
  const rows = [...orgs].sort((a, b) => a.name.localeCompare(b.name));
  const pending = rows.filter((o) => !state.orgs[o.id] && o.review?.status !== 'Closed');
  const flagged = rows.filter((o) => state.orgs[o.id] && FLAGGED.includes(state.orgs[o.id].status));
  const closed = rows.filter((o) => o.review?.status === 'Closed');
  const live = rows.filter((o) => o.review?.status !== 'Closed' && state.orgs[o.id]);
  const scores = live.map((o) => state.orgs[o.id].score).filter((x): x is number => x !== null);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const header = state.orgs[rows[0]?.id]?.signals?.map((x) => x.label) ?? [];

  const body = `
<div class="top"><div><h1>Admin</h1><p class="quiet" style="margin:0">ND Support Directory · signed in as ${esc(admin.name)}</p></div>
<div><a href="/">Directory</a> &nbsp; <button class="plain" id="out">Sign out</button></div></div>

<div class="card"><strong>At a glance:</strong> ${live.length} listed · ${flagged.length} to review · ${pending.length} being checked · ${closed.length} removed · average score ${avg ?? '—'}. Last daily check: ${dateWords(state.updated)}.</div>

<h2>Add an organisation</h2>
<form data-api="/admin/api/add" data-kind="one" class="card">
<div class="row"><div><label for="a-name">Name</label><input id="a-name" name="name" required maxlength="120"></div>
<div><label for="a-url">Website</label><input id="a-url" name="url" required placeholder="https://www.example.org.uk"></div></div>
<div class="row"><div><label for="a-area">Area</label><input id="a-area" name="area" list="areas" placeholder="UK, Scotland, Hampshire…"><datalist id="areas">${options(AREAS)}</datalist></div>
<div><label for="a-kind">Type</label><select id="a-kind" name="kind">${options(KINDS, 'Not sure')}</select></div></div>
<label for="a-num">Charity number (England and Wales, optional)</label><input id="a-num" name="charityNumber" inputmode="numeric" placeholder="Leave blank if unsure">
<label>Who it supports</label>${focusBoxes('a-f')}
<p><button>Add and check now</button></p><div class="out" hidden></div></form>

<details class="card"><summary><strong>Add several at once</strong> (up to ${MAX_PER_ADD})</summary>
<form data-api="/admin/api/add" data-kind="many">
<label for="m-lines">One per line: name | website | area | charity number</label>
<textarea id="m-lines" name="lines" placeholder="Autism Hampshire | autismhampshire.org.uk | Hampshire | 288141&#10;ADHD Embrace | adhdembrace.org"></textarea>
<p class="quiet">Area and charity number are optional. Pasting two columns from a spreadsheet works too.</p>
<label for="m-kind">Type (for all of them)</label><select id="m-kind" name="kind">${options(KINDS, 'Not sure')}</select>
<label>Who they support (for all of them)</label>${focusBoxes('m-f')}
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
<div class="table-wrap"><table><thead><tr><th>Organisation</th><th>Score</th><th>Status</th><th>Ticks</th><th>Checked</th><th></th></tr></thead><tbody>
${live.map((o) => {
    const s = state.orgs[o.id];
    return `<tr><td><a href="${esc(o.url)}">${esc(o.name)}</a><br><span class="quiet">${esc(o.area)}</span></td><td>${scoreBadge(s)}</td><td>${esc(s.status)}</td><td class="ticks">${ticks(s)}</td><td>${dateWords(s.lastChecked)}</td><td>${removeControl(o)}</td></tr>`;
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
    const body = Object.fromEntries([...fd.entries()].filter(([k]) => k !== 'focus'));
    body.focus = fd.getAll('focus');
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
