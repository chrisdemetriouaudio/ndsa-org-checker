import { AUDIENCE_LABEL, AUDIENCES } from './audience.ts';
import { matchConditions } from './conditions.ts';
import { dateWords } from './dates.ts';
import type { Level, Signal } from './signals.ts';

export { dateWords };
import { FLAGGED, type Org, type OrgState, type State, type Status } from './types.ts';

const REPO = 'https://github.com/chrisdemetriouaudio/ndsa-org-checker';

const ICON: Record<Status, string> = {
  Confirmed: '✅',
  'Looks active': '🟢',
  'Needs a check': '🟡',
  'Likely closed': '🔴',
  Closed: '⚫',
};

/** Category ticks: fine, in question, serious, not checked yet. */
export const TICK: Record<Level, string> = { green: '✅', amber: '🟡', red: '🔴', none: '⚪' };

type Row = { org: Org; s: OrgState };

function rows(orgs: Org[], state: State): Row[] {
  return orgs
    .filter((org) => state.orgs[org.id])
    .map((org) => ({ org, s: state.orgs[org.id] }))
    .sort((a, b) => a.org.name.localeCompare(b.org.name));
}

export function countByStatus(orgs: Org[], state: State): Record<Status, number> {
  const counts: Record<Status, number> = { Confirmed: 0, 'Looks active': 0, 'Needs a check': 0, 'Likely closed': 0, Closed: 0 };
  for (const { s } of rows(orgs, state)) counts[s.status]++;
  return counts;
}

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
/** Score as a temperature: 🟢 90+ · 🟡 70–89 · 🟠 50–69 · 🔴 1–49 · ⚫ 0 (proven closed). */
export function scoreEmoji(score: number | null): string {
  if (score === null) return '⚪';
  return score >= 90 ? '🟢' : score >= 70 ? '🟡' : score >= 50 ? '🟠' : score > 0 ? '🔴' : '⚫';
}

/** Hue on a smooth red (0) → amber (40) → green (130) scale, so colour tracks the score exactly. */
export function scoreHue(score: number): number {
  const s = Math.max(0, Math.min(100, score));
  return Math.round(s <= 60 ? (s / 60) * 40 : 40 + ((s - 60) / 40) * 90);
}

const scoreText = (s: OrgState) => (s.score === null ? '—' : `${scoreEmoji(s.score)} ${s.score}`);
const signalsOf = (s: OrgState): Signal[] => s.signals ?? [];

/** Category headers, taken from the first organisation that has them. */
function categoryHeaders(all: Row[]): string[] {
  return signalsOf(all.find((r) => signalsOf(r.s).length)?.s ?? ({} as OrgState)).map((x) => x.label);
}

function legend(all: Row[]): string[] {
  const sample = signalsOf(all.find((r) => signalsOf(r.s).length)?.s ?? ({} as OrgState));
  return [
    '> [!info]- How to read the ticks and the score (tap to open)',
    '> **Ticks:** ✅ fine · 🟡 in question · 🔴 serious · ⚪ not checked yet.',
    '> **Score:** 0 to 100. How sure we are the organisation is still running, from the categories checked so far. Proven closed scores 0. Insolvent or in administration scores 40 at most.',
    '> **Score colours:** 🟢 90 to 100 · 🟡 70 to 89 · 🟠 50 to 69 · 🔴 1 to 49 · ⚫ 0 (proven closed).',
    '> **Proof or evidence:** evidence comes from the website and can be wrong. Proof comes from an official record or the organisation itself.',
    '> **Closure is only "proven"** when a proof category is 🔴. Website evidence alone means "likely closed".',
    '>',
    ...sample.map((x) => `> - **${x.label}** (${x.kind}, ${x.weight} points): ${x.kind === 'proof' ? (x.key === 'register' ? 'the official charity record. 🔴 removed or dissolved proves closure; 🔴 insolvent or in administration means likely closed' : 'the organisation replies itself') :x.strength === 'strong' ? '🔴 means likely closed' : '🔴 means needs a check'}.`),
  ];
}

/** The generated "30 Live/Live status.md" note. */
export function renderLivePage(orgs: Org[], state: State): string {
  const all = rows(orgs, state);
  const c = countByStatus(orgs, state);
  const flagged = all.filter((r) => FLAGGED.includes(r.s.status))
    .sort((a, b) => Number(b.s.proven) - Number(a.s.proven) || (a.s.score ?? 0) - (b.s.score ?? 0));
  const fine = all.filter((r) => !FLAGGED.includes(r.s.status) && r.s.status !== 'Closed')
    .sort((a, b) => (a.s.score ?? 0) - (b.s.score ?? 0) || a.org.name.localeCompare(b.org.name));
  const closed = all.filter((r) => r.s.status === 'Closed');
  const updated = state.updated?.slice(0, 10) ?? null;
  const headers = categoryHeaders(all);
  const tableHead = (first: string, last: string) => [
    `| ${first} | Score | ${headers.join(' | ')} | ${last} |`,
    `| --- | ---: | ${headers.map(() => ':---:').join(' | ')} | --- |`,
  ];
  const ticks = (s: OrgState) => signalsOf(s).map((x) => TICK[x.level]).join(' | ');

  const out: string[] = [
    '---',
    'title: Live status',
    `updated: ${updated ?? ''}`,
    '---',
    '',
    '# 📡 Live status',
    '',
    '> [!info] At a glance',
    `> **Last check:** ${dateWords(updated)}, ${all.length} services.`,
    `> **To review:** ${flagged.length} (${c['Likely closed']} likely closed, ${c['Needs a check']} need a check).`,
    `> **Fine:** ${c['Looks active']} look active, ${c.Confirmed} confirmed. **Closed:** ${c.Closed}.`,
    '> This page rewrites itself after every daily check. Edits made here are lost.',
    '',
    ...legend(all),
    '',
    '## 👉 To review',
    '',
  ];

  if (!flagged.length) {
    out.push('- Nothing to review.');
  } else {
    for (const { org, s } of flagged) {
      const what = s.proven ? 'proven closed by an official record' : `${s.status.toLowerCase()} since ${dateWords(s.since)}`;
      out.push(`- ${ICON[s.status]} **${s.proven ? 'Close' : 'Check'} ${org.name}:** ${what}. Score ${scoreText(s)}.`);
    }
    out.push('', ...tableHead('Service', 'Why'));
    for (const { org, s } of flagged) {
      out.push(`| [${cell(org.name)}](${org.url}) | ${scoreText(s)} | ${ticks(s)} | ${cell(s.reasons.join('. '))} |`);
    }
    out.push('', 'To decide: use the **admin page** (https://ndsa.labs.chrisdemetriou.com/admin): "It is still running" or "Remove".');
  }

  out.push('', '## ✅ Fine', '', `> [!success]- ${fine.length} services look fine (lowest score first)`);
  out.push(...tableHead('Service', 'Last checked').map((l) => `> ${l}`));
  for (const { org, s } of fine) {
    out.push(`> | [${cell(org.name)}](${org.url}) | ${scoreText(s)} | ${ticks(s)} | ${dateWords(s.lastChecked)} |`);
  }

  if (closed.length) {
    out.push('', `> [!note]- ${closed.length} closed (archived, not deleted)`);
    for (const { org, s } of closed) out.push(`> - **${org.name}:** ${cell(s.reasons.join('. '))}`);
  }
  out.push('');
  return out.join('\n');
}

/** The lines that go between the live markers on the Dashboard. */
export function renderDashboardBlock(orgs: Org[], state: State): string {
  const c = countByStatus(orgs, state);
  const toReview = c['Needs a check'] + c['Likely closed'];
  const scores = rows(orgs, state).map((r) => r.s.score).filter((x): x is number => x !== null);
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  return [
    '> [!info] Live (updated by the daily check)',
    `> **Last check:** ${dateWords(state.updated)}.`,
    `> **To review:** ${toReview}. See [[Live status]].`,
    `> **Fine:** ${c['Looks active'] + c.Confirmed} · **Closed:** ${c.Closed} · **Average score:** ${average ?? '—'} out of 100`,
  ].join('\n');
}

export function replaceBetweenMarkers(doc: string, block: string): string {
  const start = '<!-- live:start -->';
  const end = '<!-- live:end -->';
  const a = doc.indexOf(start);
  const b = doc.indexOf(end);
  if (a === -1 || b === -1 || b < a) return doc;
  return `${doc.slice(0, a + start.length)}\n${block}\n${doc.slice(b)}`;
}

/** Markdown for a GitHub issue comment when services become flagged. */
export function renderNewFlags(newly: Row[]): string {
  return [
    `**${newly.length} service${newly.length === 1 ? '' : 's'} flagged on ${dateWords(newly[0]?.s.lastChecked ?? null)}**`,
    '',
    ...newly.map(({ org, s }) => `- ${ICON[s.status]} **${org.name}** (${s.proven ? 'proven closed' : s.status}, score ${scoreText(s)}): ${s.reasons.join('. ')}. ${org.url}`),
    '',
    'Nothing is removed until a person decides.',
  ].join('\n');
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function siteChecks(s: OrgState): string {
  const shown = signalsOf(s).filter((x) => x.level !== 'none');
  const pending = signalsOf(s).length - shown.length;
  const chips = shown.map((x) => `<li class="chk ${x.level}" title="${esc(x.detail)}"><span aria-hidden="true">${x.level === 'green' ? '✓' : '!'}</span> ${esc(x.label)}</li>`).join('');
  const more = pending ? `<li class="chk none">${pending} more check${pending === 1 ? '' : 's'} coming</li>` : '';
  return `<ul class="checks" aria-label="Checks">${chips}${more}</ul>`;
}

/** The public directory page (site/index.html). Likely-closed and closed services are hidden. */
/** Conditions an organisation supports, from its name and focus words; "general" = all neurodivergent people. */
function conditionsOf(org: Org): { labels: string[]; general: boolean } {
  const m = matchConditions(org.name, org.focus.join(', '));
  const labels = (m?.conditions ?? []).filter((c) => c !== 'neurodiversity');
  const general = !!m?.conditions.includes('neurodiversity') || org.focus.some((f) => /^(SEND|neurodivergence)$/i.test(f));
  return { labels, general };
}

export function renderSite(orgs: Org[], state: State): string {
  const shown = rows(orgs, state).filter((r) => ['Confirmed', 'Looks active', 'Needs a check'].includes(r.s.status));
  const condCount = new Map<string, number>();
  for (const { org } of shown) for (const c of conditionsOf(org).labels) condCount.set(c, (condCount.get(c) ?? 0) + 1);
  const condButtons = [...condCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const cards = shown.map(({ org, s }) => {
    const report = `${REPO}/issues/new?title=${encodeURIComponent(`Problem with ${org.name}`)}&body=${encodeURIComponent(`Listing: ${org.name} (${org.url})\n\nWhat went wrong:\n`)}`;
    const checking = s.status === 'Needs a check' ? '<p class="note">We are re-checking this service.</p>' : '';
    const freshness = s.status === 'Confirmed' ? `Confirmed by the organisation` : `Last checked ${dateWords(s.lastChecked)}`;
    const hue = s.score === null ? null : scoreHue(s.score);
    const who = org.audiences?.length ? org.audiences.map((a) => AUDIENCE_LABEL[a]).join(' · ') : 'Ages not stated';
    const place = org.lat != null ? ` data-lat="${org.lat}" data-lon="${org.lon}"` : '';
    const cs = conditionsOf(org);
    return `<li class="card" data-cond="${esc(cs.labels.join('|'))}" data-general="${cs.general ? 1 : ''}" data-aud="${esc((org.audiences ?? []).join(' '))}" data-cov="${org.coverage ?? 'national'}" data-nations="${esc((org.nations ?? []).join('|'))}"${place}>
  <div class="top"><h2><a href="${esc(org.url)}">${esc(org.name)}</a></h2><span class="score" ${hue === null ? '' : `style="--h:${hue}"`} title="How sure we are it is still running">${s.score ?? '—'}<small>/100</small></span></div>
  <p class="meta">${esc(org.kind)} · ${esc(org.area)}</p>
  <p class="who">For: ${esc(who)}</p>
  <p class="dist" hidden></p>
  <p class="tags">${org.focus.map((f) => `<span>${esc(f)}</span>`).join('')}</p>
  ${siteChecks(s)}
  ${checking}<p class="fresh">${freshness} · <a href="${report}">Report a problem</a></p>
</li>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ND Support Directory</title>
<meta name="description" content="Neurodivergent support organisations in the UK, checked every few days.">
<style>
:root{--bg:#fbfaf7;--card:#fff;--ink:#1d1d1b;--quiet:#5c5b57;--line:#e3e0d8;--accent:#2f5d8a;--note:#fff4d6;--green:#2e7d4f;--amber:#a86a00;--red:#b3261e;--green-bg:#e6f4ea;--amber-bg:#fff4d6;--red-bg:#fde7e5}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--card:#1f1f1d;--ink:#eeece6;--quiet:#a9a69e;--line:#34332f;--accent:#8db8e3;--note:#3a3120;--green:#7fd19b;--amber:#f2c25b;--red:#f28b82;--green-bg:#1d3324;--amber-bg:#3a3120;--red-bg:#3d2220}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:18px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.01em}
main{max-width:860px;margin:0 auto;padding:32px 16px 64px}h1{font-size:1.8rem;margin:0 0 4px}
.lead{color:var(--quiet);margin:0 0 24px}ul{list-style:none;padding:0;margin:0}#list{display:grid;gap:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 18px}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.card h2{font-size:1.15rem;margin:0}.card a{color:var(--accent)}.meta,.fresh{color:var(--quiet);font-size:.9rem;margin:4px 0 0}
.score{font-weight:700;font-size:1.05rem;border-radius:8px;padding:2px 10px;white-space:nowrap}.score small{font-weight:400;font-size:.75rem;opacity:.8}
.score{--h:0;background:hsl(var(--h) 70% 92%);color:hsl(var(--h) 75% 26%)}
@media (prefers-color-scheme:dark){.score{background:hsl(var(--h) 45% 20%);color:hsl(var(--h) 70% 72%)}}
.tags{margin:8px 0 0;display:flex;flex-wrap:wrap;gap:6px}.tags span{border:1px solid var(--line);border-radius:999px;padding:0 10px;font-size:.85rem}
.checks{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0}.chk{font-size:.8rem;border-radius:6px;padding:1px 8px}
.chk span{font-weight:700}.chk.green{background:var(--green-bg);color:var(--green)}.chk.amber{background:var(--amber-bg);color:var(--amber)}.chk.red{background:var(--red-bg);color:var(--red)}.chk.none{color:var(--quiet);border:1px dashed var(--line)}
.note{background:var(--note);border-radius:6px;padding:4px 10px;margin:8px 0 0;font-size:.9rem}
input{width:100%;font:inherit;padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);margin:0 0 16px}
footer{color:var(--quiet);font-size:.85rem;margin-top:32px}
.who{font-size:.9rem;margin:4px 0 0}
#more{margin-top:16px}
.near{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:0 0 16px}.near label{font-weight:600}
.nearrow{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}.nearrow input{flex:1 1 160px;margin:0}.nearrow select{font:inherit;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)}
.nearrow button:not(.linkish){font:inherit;border:1px solid var(--accent);background:var(--accent);color:var(--bg);border-radius:8px;padding:8px 16px;cursor:pointer}
.hint{color:var(--quiet);font-size:.85rem;margin:8px 0 0}.dist{font-size:.9rem;font-weight:600;margin:4px 0 0}
.finder{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:0 0 16px}.finder h2{font-size:1.15rem;margin:0}
.bubble{margin:8px 0;padding:8px 12px;border-radius:12px;max-width:85%;width:fit-content}.bubble.bot{background:var(--bg);border:1px solid var(--line)}
.bubble.me{margin-left:auto;background:var(--accent);color:var(--bg)}
#choices{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}#choices button{font:inherit;font-size:.95rem;border:1px solid var(--accent);background:transparent;color:var(--accent);border-radius:999px;padding:6px 14px;cursor:pointer}
#choices button:hover,#choices button:focus-visible{background:var(--accent);color:var(--bg)}
.group{list-style:none;font-weight:600;color:var(--quiet);margin:12px 0 0;padding:0 4px}.linkish{font:inherit;background:none;border:0;color:var(--accent);text-decoration:underline;cursor:pointer;padding:0}
.aud{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 20px}.aud span{color:var(--quiet);margin-right:4px}
.aud button{font:inherit;font-size:.95rem;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 14px;cursor:pointer}
.aud button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--bg)}
</style>
</head>
<body>
<main>
<h1>ND Support Directory</h1>
<p class="lead">${shown.length} UK organisations supporting neurodivergent people. Websites are checked every 1 to 3 days, and daily if anything looks wrong. Last check: ${dateWords(state.updated)}. The score (out of 100) shows how sure we are each one is still running.</p>
<label for="q" class="lead">Search by name, area or need</label>
<input id="q" type="search" placeholder="For example: ADHD, Scotland, dyslexia">
<section id="finder" class="finder" aria-labelledby="finder-title">
<h2 id="finder-title">Not sure where to start?</h2>
<p class="hint" style="margin-top:0">Answer 3 quick questions by tapping a button.</p>
<div id="chat" aria-live="polite"></div>
<div id="choices"></div>
</section>
<form id="near" class="near" hidden>
<label for="pc">Near you</label>
<div class="nearrow"><input id="pc" autocomplete="postal-code" placeholder="Postcode, like SO23 9AA or SO23" maxlength="9">
<select id="miles" aria-label="Distance">${[5, 10, 20, 30, 50, 100].map((m) => `<option value="${m}"${m === 20 ? ' selected' : ''}>within ${m} miles</option>`).join('')}</select>
<button>Search</button><button type="button" id="clear" class="linkish" hidden>Clear</button></div>
<p class="hint">Your postcode is only used to work out distances. It is not stored. Distances are to where each organisation is based, which is not always where its groups meet.</p>
<p id="near-msg" class="hint" hidden></p>
</form>
<div class="aud" role="group" aria-label="Who is it for?"><span>Who is it for?</span>
<button type="button" data-a="" aria-pressed="true">Everyone</button>
${AUDIENCES.map((a) => `<button type="button" data-a="${a}" aria-pressed="false">${AUDIENCE_LABEL[a]}</button>`).join('\n')}
</div>
<ul id="list">
${cards}
</ul>
<p id="more" class="lead" hidden><span></span> <button type="button" class="linkish">Show them too</button></p>
<footer>Prototype. Services that look closed are hidden until a person checks them. <a href="${REPO}">How this works</a>.<br>
Sources include the Charity Commission for England and Wales, the Charity Commission for Northern Ireland and the Scottish Charity Register: © Crown Copyright and database right ${new Date().getFullYear()}. Contains information from the Scottish Charity Register supplied by the Office of the Scottish Charity Regulator and licensed under the <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/">Open Government Licence v3.0</a>.</footer>
</main>
<script>
const q=document.getElementById('q');const items=[...document.querySelectorAll('#list .card')];
let aud='',cond='',showUnstated=false;
const more=document.getElementById('more');
let here=null;
const list=document.getElementById('list');const order=[...items];
const head=document.createElement('li');head.className='group';head.textContent='Also covering your area (works across the nation)';
const miles=(a,b)=>{const r=(d)=>d*Math.PI/180,h=Math.sin(r(b.lat-a.lat)/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(r(b.lon-a.lon)/2)**2;return 3958.8*2*Math.asin(Math.sqrt(h));};
const apply=()=>{const t=q.value.trim().toLowerCase();let unstated=0;
const limit=+document.getElementById('miles').value;const local=[],wide=[];
for(const li of items){const a=li.dataset.aud;const textOk=!t||li.textContent.toLowerCase().includes(t);
const audOk=!aud||(a?a.split(' ').includes(aud):showUnstated);const condOk=!cond||li.dataset.general||li.dataset.cond.split('|').includes(cond);if(aud&&!a&&textOk&&!showUnstated)unstated++;
let placeOk=true;const d=li.querySelector('.dist');d.hidden=true;
if(here){if(li.dataset.cov==='local'){if(li.dataset.lat){const m=miles(here,{lat:+li.dataset.lat,lon:+li.dataset.lon});placeOk=m<=limit;li.dataset.m=m;d.textContent=m<1?'Based less than 1 mile away':'Based about '+Math.round(m)+(Math.round(m)===1?' mile':' miles')+' away';d.hidden=!placeOk;}else placeOk=false;}
else{const n=li.dataset.nations;placeOk=!n||n.split('|').includes(here.country);}}
li.hidden=!(textOk&&audOk&&placeOk&&condOk);if(here&&!li.hidden)(li.dataset.cov==='local'?local:wide).push(li);}
if(here){local.sort((x,y)=>x.dataset.m-y.dataset.m);list.replaceChildren(...local,...(wide.length?[head]:[]),...wide,...order.filter(li=>li.hidden));
nearMsg.hidden=false;nearMsg.textContent=local.length+' based within '+limit+' miles of '+here.label+(wide.length?', and '+wide.length+' working across '+here.country:'')+'.';}
else if(head.isConnected){head.remove();list.replaceChildren(...order);}
more.hidden=!unstated;more.querySelector('span').textContent=unstated+' more '+(unstated===1?'organisation does':'organisations do')+' not say who '+(unstated===1?'it is':'they are')+' for.';};
more.querySelector('button').addEventListener('click',()=>{showUnstated=true;apply();});
const near=document.getElementById('near'),nearMsg=document.getElementById('near-msg'),clear=document.getElementById('clear');
fetch('/api/postcode?pc=SW1A',{method:'HEAD'}).then(r=>{if(r.ok)near.hidden=false;}).catch(()=>{});
near.addEventListener('submit',async(e)=>{e.preventDefault();const pc=document.getElementById('pc').value.trim();if(!pc)return;
nearMsg.hidden=false;nearMsg.textContent='Finding '+pc+'…';
try{const r=await fetch('/api/postcode?pc='+encodeURIComponent(pc));const j=await r.json();if(!r.ok)throw new Error(j.error||'Postcode not found');here=j;clear.hidden=false;apply();}
catch(err){here=null;nearMsg.textContent=err.message;apply();}});
document.getElementById('miles').addEventListener('change',()=>{if(here)apply();});
clear.addEventListener('click',()=>{here=null;clear.hidden=true;nearMsg.hidden=true;document.getElementById('pc').value='';apply();});
// Button finder: three questions, buttons only. It sets the same filters as the controls below.
const chat=document.getElementById('chat'),choices=document.getElementById('choices');
const CONDS=${JSON.stringify(condButtons.map(([c]) => c))};
const say=(who,text)=>{const p=document.createElement('p');p.className='bubble '+who;p.textContent=text;chat.append(p);};
const ask=(question,options)=>{say('bot',question);choices.replaceChildren(...options.map(([label,fn])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{say('me',label);choices.replaceChildren();fn();};return b;}));};
const setAud=(a)=>{aud=a;showUnstated=false;for(const x of document.querySelectorAll('.aud button'))x.setAttribute('aria-pressed',String(x.dataset.a===a));};
const show=()=>{apply();const n=items.filter(li=>!li.hidden).length;
say('bot',n?'Here '+(n===1?'is 1 organisation':'are '+n+' organisations')+' that may help. They are listed below.':'Nothing matches all of that yet. Try a wider distance, or "Anyone".');
const again=document.createElement('button');again.type='button';again.textContent='Start again';again.onclick=start;choices.replaceChildren(again);
if(n)document.getElementById('list').scrollIntoView({behavior:'smooth',block:'start'});};
const where=()=>ask('Where should it be?',[['Near a postcode',()=>{say('bot','Type your postcode in the "Near you" box below, choose how far, then press Search.');near.hidden=false;document.getElementById('pc').focus();const again=document.createElement('button');again.type='button';again.textContent='Start again';again.onclick=start;choices.replaceChildren(again);apply();}],['Anywhere in the UK',()=>{here=null;show();}]]);
const forWho=()=>ask('Who is the support for?',[['A child or young person',()=>{setAud('children');where();}],['An adult',()=>{setAud('adults');where();}],['My family, or me as a carer',()=>{setAud('families');where();}],['Anyone',()=>{setAud('');where();}]]);
const start=()=>{chat.replaceChildren();cond='';setAud('');here=null;clear.hidden=true;nearMsg.hidden=true;apply();
ask('What would you like support with?',[...CONDS.map(c=>[c.charAt(0).toUpperCase()+c.slice(1),()=>{cond=c;forWho();}]),['Not sure, or anything neurodivergent',()=>{cond='';forWho();}]]);};
start();
q.addEventListener('input',apply);
for(const b of document.querySelectorAll('.aud button'))b.addEventListener('click',()=>{aud=b.dataset.a;showUnstated=false;for(const x of document.querySelectorAll('.aud button'))x.setAttribute('aria-pressed',String(x===b));apply();});
</script>
</body>
</html>
`;
}
