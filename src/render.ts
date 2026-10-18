import { AUDIENCE_LABEL, AUDIENCES } from './audience.ts';
import { matchConditions } from './conditions.ts';
import { areaKey } from './place.ts';
import { dateWords } from './dates.ts';
import type { Level, Signal } from './signals.ts';

export { dateWords };
import { FLAGGED, type Org, type OrgState, type State, type Status } from './types.ts';

const REPO = 'https://github.com/chrisdemetriouaudio/neuro-support-checker';

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
    out.push('', 'To decide: use the **admin page** (https://neurosupport.labs.chrisdemetriou.com/admin): "It is still running" or "Remove".');
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

export function replaceBetweenMarkers(doc: string, block: string, name = 'live'): string {
  const start = `<!-- ${name}:start -->`;
  const end = `<!-- ${name}:end -->`;
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
  const pending = signalsOf(s).filter((x) => x.level === 'none');
  const chips = shown.map((x) => `<li class="chk ${x.level}" title="${esc(x.detail)}"><span aria-hidden="true">${x.level === 'green' ? '✓' : '!'}</span> ${esc(x.label)}</li>`).join('');
  // Say what has not been checked, and why (e.g. "Confirmed by them: not asked yet"), rather than promising it.
  const more = pending.map((x) => `<li class="chk none" title="${esc(x.detail)}"><span aria-hidden="true">○</span> ${esc(x.label)}: ${x.key === 'confirmed' ? 'not asked yet' : 'not checked yet'}</li>`).join('');
  return `<ul class="checks" aria-label="Checks">${chips}${more}</ul>`;
}

/** The public directory page (site/index.html). Likely-closed and closed services are hidden. */
/** "Serves: Bury, Rochdale and 3 more" or "Serves: all of England and Wales". */
export function servesText(org: Org): string {
  const throughout = org.serves?.find((s) => /^throughout /i.test(s));
  if (org.coverage === 'national' || throughout) {
    const where = throughout ? throughout.replace(/^throughout /i, '').replace(/ And /g, ' and ') : org.nations?.length ? org.nations.join(' and ') : 'the UK';
    return `Serves: all of ${where}`;
  }
  const s = org.serves ?? [];
  if (!s.length) return 'Serves: area not stated';
  return `Serves: ${s.slice(0, 4).join(', ')}${s.length > 4 ? ` and ${s.length - 4} more` : ''}`;
}

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
    const place = `${org.lat != null ? ` data-lat="${org.lat}" data-lon="${org.lon}"` : ''} data-serves="${esc((org.serves ?? []).map(areaKey).join('|'))}" data-from="${org.servesFrom ?? ''}"`;
    const cs = conditionsOf(org);
    return `<li class="card" data-cond="${esc(cs.labels.join('|'))}" data-general="${cs.general ? 1 : ''}" data-aud="${esc((org.audiences ?? []).join(' '))}" data-cov="${org.coverage ?? 'national'}" data-nations="${esc((org.nations ?? []).join('|'))}"${place}>
  <div class="top"><h2><a href="${esc(org.url)}">${esc(org.name)}</a></h2><span class="score" ${hue === null ? '' : `style="--h:${hue}"`} title="How sure we are it is still running">${s.score ?? '—'}<small>/100</small></span></div>
  <p class="meta">${esc(org.kind)} · ${esc(org.area)}</p>
  <p class="who">For: ${esc(who)}</p>
  <p class="who">${esc(servesText(org))}</p>
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
<title>Neuro Support Checker</title>
<meta name="description" content="UK support organisations for autism, ADHD, dyslexia, learning disability, Down syndrome, brain injury and related conditions, checked every few days.">
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
.checker{background:var(--card);border:2px solid var(--accent);border-radius:12px;padding:16px 18px;margin:8px 0 28px}.checker h2{margin:0 0 4px;font-size:1.3rem}
.checker input{margin:4px 0 8px}.checker details{margin:4px 0}.checker summary{cursor:pointer;color:var(--accent);font-size:.95rem}
#check-go{font:inherit;border:1px solid var(--accent);background:var(--accent);color:var(--bg);border-radius:8px;padding:8px 22px;cursor:pointer}
.result{border-radius:10px;padding:12px 14px;margin-top:8px;border:1px solid var(--line)}.result .top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.result h3{margin:0;font-size:1.15rem}
.result.running{border-color:var(--green)}.result.check{border-color:var(--amber)}.result.closed{border-color:var(--red)}
.result .ticks{list-style:none;padding:0;margin:8px 0;display:grid;gap:4px;font-size:.92rem}
.browse{font-size:1.3rem;margin:8px 0 4px}
.group{list-style:none;font-weight:600;color:var(--quiet);margin:12px 0 0;padding:0 4px}.linkish{font:inherit;background:none;border:0;color:var(--accent);text-decoration:underline;cursor:pointer;padding:0}
.aud{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 20px}.aud span{color:var(--quiet);margin-right:4px}
.aud button{font:inherit;font-size:.95rem;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 14px;cursor:pointer}
.aud button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--bg)}
</style>
</head>
<body>
<main>
<h1>Neuro Support Checker</h1>
<p class="lead">Support for autism, ADHD, dyslexia, learning disability, Down syndrome, brain injury and more, across the UK.</p>
<section id="checker" class="checker" hidden aria-labelledby="checker-title">
<h2 id="checker-title">Is it still running?</h2>
<p class="hint" style="margin-top:0">Before you signpost someone, check the organisation's website. It takes a few seconds.</p>
<form id="check-form">
<label for="check-url">Website</label>
<input id="check-url" inputmode="url" autocomplete="url" placeholder="For example: www.autism.org.uk" required>
<details><summary>I know its charity number (optional)</summary>
<label for="check-num">Charity number</label><input id="check-num" placeholder="For example: 269425, or SC012345 in Scotland"></details>
<p><button id="check-go">Check</button></p>
</form>
<div id="check-out" aria-live="polite"></div>
</section>
<h2 class="browse">Browse the directory</h2>
<p class="lead">${shown.length} UK organisations, checked every 1 to 3 days (daily if anything looks wrong). Last check: ${dateWords(state.updated)}. The score (out of 100) shows how sure we are each one is still running.</p>
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
<button>Search</button><button type="button" id="clear" class="linkish" hidden>Clear</button></div>
<p class="hint">Your postcode is only used to find your council area and work out distances. It is not stored. Nothing is hidden: organisations are sorted by how sure we are they serve your area.</p>
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
const heading=()=>{const h=document.createElement('li');h.className='group';return h;};
const miles=(a,b)=>{const r=(d)=>d*Math.PI/180,h=Math.sin(r(b.lat-a.lat)/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(r(b.lon-a.lon)/2)**2;return 3958.8*2*Math.asin(Math.sqrt(h));};
const GROUPS=[['serving',()=>'Serves your area ('+here.district+')'],['wide',()=>'Works across '+here.country],['unknown',()=>'Area not recorded – may still serve you (nearest first)'],['other',()=>'Lists other areas – may not serve you (nearest first)']];
const heads=Object.fromEntries(GROUPS.map(([g])=>[g,heading()]));
const apply=()=>{const t=q.value.trim().toLowerCase();let unstated=0;const groups={serving:[],wide:[],unknown:[],other:[]};
for(const li of items){const a=li.dataset.aud;const textOk=!t||li.textContent.toLowerCase().includes(t);
const audOk=!aud||(a?a.split(' ').includes(aud):showUnstated);if(aud&&!a&&textOk&&!showUnstated)unstated++;const condOk=!cond||li.dataset.general||li.dataset.cond.split('|').includes(cond);
const d=li.querySelector('.dist');d.hidden=true;let group=null;
if(here){const sv=(li.dataset.serves||'').split('|').filter(Boolean);const m=li.dataset.lat?miles(here,{lat:+li.dataset.lat,lon:+li.dataset.lon}):Infinity;li.dataset.m=m;
const far=m===Infinity?'':(m<1?'based less than 1 mile away':'based about '+Math.round(m)+(Math.round(m)===1?' mile':' miles')+' away');
if(li.dataset.cov!=='local'){const n=li.dataset.nations;group=!n||n.split('|').includes(here.country)?'wide':'other';}
else if(sv.some(k=>k===here.keys.district||(here.keys.county&&k===here.keys.county))){group='serving';d.textContent=(li.dataset.from==='office'?'Based in your area':'Serves your area, says the charity register')+(far?' · '+far:'');}
else if(!sv.length||li.dataset.from==='office'){group='unknown';d.textContent='Area not recorded'+(far?' · '+far:'');}
else{group='other';d.textContent='Lists other areas'+(far?' · '+far:'');}
d.hidden=group==='wide';}
li.hidden=!(textOk&&audOk&&condOk);if(here&&!li.hidden)groups[group].push(li);}
if(here){for(const g of ['serving','unknown','other'])groups[g].sort((x,y)=>x.dataset.m-y.dataset.m);
for(const [g,label] of GROUPS)heads[g].textContent=label()+' · '+groups[g].length;
list.replaceChildren(...GROUPS.flatMap(([g])=>groups[g].length?[heads[g],...groups[g]]:[]),...order.filter(li=>li.hidden));
nearMsg.hidden=false;nearMsg.textContent=groups.serving.length+' serve '+here.district+', '+groups.wide.length+' work across '+here.country+', '+groups.unknown.length+' have no recorded area, and '+groups.other.length+' list other areas.';}
else if(Object.values(heads).some(h=>h.isConnected)){list.replaceChildren(...order);}
more.hidden=!unstated;more.querySelector('span').textContent=unstated+' more '+(unstated===1?'organisation does':'organisations do')+' not say who '+(unstated===1?'it is':'they are')+' for.';};
more.querySelector('button').addEventListener('click',()=>{showUnstated=true;apply();});
const near=document.getElementById('near'),nearMsg=document.getElementById('near-msg'),clear=document.getElementById('clear');
fetch('/api/postcode?pc=SW1A',{method:'HEAD'}).then(r=>{if(r.ok)near.hidden=false;}).catch(()=>{});
near.addEventListener('submit',async(e)=>{e.preventDefault();const pc=document.getElementById('pc').value.trim();if(!pc)return;
nearMsg.hidden=false;nearMsg.textContent='Finding '+pc+'…';
try{const r=await fetch('/api/postcode?pc='+encodeURIComponent(pc));const j=await r.json();if(!r.ok)throw new Error(j.error||'Postcode not found');here=j;clear.hidden=false;apply();}
catch(err){here=null;nearMsg.textContent=err.message;apply();}});
clear.addEventListener('click',()=>{here=null;clear.hidden=true;nearMsg.hidden=true;document.getElementById('pc').value='';apply();});
// "Is it still running?" — one website, checked now by the same rules as the daily checks.
const checker=document.getElementById('checker'),checkOut=document.getElementById('check-out');
fetch('/api/check',{method:'HEAD'}).then(r=>{if(r.ok)checker.hidden=false;}).catch(()=>{});
const mk=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
const TICK={green:'✅',amber:'🟡',red:'🔴',none:'⚪'};
const hue=(s)=>{s=Math.max(0,Math.min(100,s));return Math.round(s<=60?s/60*40:40+(s-60)/40*90);};
document.getElementById('check-form').addEventListener('submit',async(e)=>{e.preventDefault();
const u=document.getElementById('check-url').value.trim(),n=document.getElementById('check-num').value.trim();const go=document.getElementById('check-go');
checkOut.replaceChildren(mk('p','Checking '+u+'… this takes a few seconds.','hint'));go.disabled=true;
try{const r=await fetch('/api/check?url='+encodeURIComponent(u)+(n?'&number='+encodeURIComponent(n):''));const j=await r.json();if(!r.ok)throw new Error(j.error||'The check did not work. Please try again.');
const card=mk('div',null,'result '+j.verdict);const top=mk('div',null,'top');top.append(mk('h3',(j.verdict==='running'?'🟢 ':j.verdict==='check'?'🟡 ':'🔴 ')+j.headline));
if(j.score!=null){const b=mk('span',String(j.score),'score');b.style.setProperty('--h',hue(j.score));b.append(mk('small','/100'));top.append(b);}card.append(top);
card.append(mk('p',(j.title?j.title+' · ':'')+(j.finalUrl||j.url),'meta'));
if(j.reasons&&j.reasons.length)card.append(mk('p',j.reasons.join('. ')+'.'));
const ul=mk('ul',null,'ticks');for(const s of j.signals){const li=mk('li');li.append(TICK[s.level]+' ',mk('strong',s.label),': '+s.detail);ul.append(li);}card.append(ul);
const reg=mk('p',null,'meta');const c=j.charity;if(c){reg.append('Charity register: ');const a=mk('a',c.name+' ('+c.number+')');a.href=c.link;a.rel='noopener';a.target='_blank';reg.append(a,' · '+c.status+(c.removalReason?' ('+c.removalReason.toLowerCase()+')':'')+' · '+c.register+(c.live?', checked live':''));}else reg.append('We could not match this website to a charity on the registers. If it is a charity, add its number above for a stronger check.');card.append(reg);
if(c&&c.matched==='name')card.append(mk('p','Matched by name only, because the register does not list this website. Check it is the same charity'+(c.status==='Removed'?'; until then this does not count as proof it has closed.':'.'),'note'));
if(c&&c.grantMaker)card.append(mk('p','The register says this charity mainly gives grants, rather than running services itself.','hint'));
if(c&&c.otherNames&&c.otherNames.length)card.append(mk('p','Also known as: '+c.otherNames.join(' · '),'meta'));
if(c&&c.does&&c.does.length)card.append(mk('p','What it does, says the register: '+c.does.join(' · '),'meta'));
if(c&&c.where&&c.where.length)card.append(mk('p','Where it works, says the register: '+c.where.join(', '),'meta'));
card.append(mk('p',j.listed?'In our directory as '+j.listed.name+'.':'Not in our directory yet.','meta'));
card.append(mk('p','Checked just now. One check can be caught out by a website having a bad day; the directory below is checked over a week.','hint'));
checkOut.replaceChildren(card);}
catch(err){checkOut.replaceChildren(mk('p',err.message,'note'));}finally{go.disabled=false;}});
// Button finder: three questions, buttons only. It sets the same filters as the controls below.
const chat=document.getElementById('chat'),choices=document.getElementById('choices');
const CONDS=${JSON.stringify(condButtons.map(([c]) => c))};
const say=(who,text)=>{const p=document.createElement('p');p.className='bubble '+who;p.textContent=text;chat.append(p);};
const ask=(question,options)=>{say('bot',question);choices.replaceChildren(...options.map(([label,fn])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{say('me',label);choices.replaceChildren();fn();};return b;}));};
const setAud=(a)=>{aud=a;showUnstated=false;for(const x of document.querySelectorAll('.aud button'))x.setAttribute('aria-pressed',String(x.dataset.a===a));apply();};
const show=()=>{apply();const n=items.filter(li=>!li.hidden).length;
say('bot',n?'Here '+(n===1?'is 1 organisation':'are '+n+' organisations')+' that may help. They are listed below.':'Nothing matches all of that yet. Try a wider distance, or "Anyone".');
const again=document.createElement('button');again.type='button';again.textContent='Start again';again.onclick=start;choices.replaceChildren(again);
if(n)document.getElementById('list').scrollIntoView({behavior:'smooth',block:'start'});};
const where=()=>ask('Where should it be?',[['Near a postcode',()=>{say('bot','Type your postcode in the "Near you" box below, then press Search. Nothing is hidden: the ones that serve your area come first.');near.hidden=false;document.getElementById('pc').focus();const again=document.createElement('button');again.type='button';again.textContent='Start again';again.onclick=start;choices.replaceChildren(again);apply();}],['Anywhere in the UK',()=>{here=null;show();}]]);
const forWho=()=>ask('Who is the support for?',[['A child or young person',()=>{setAud('children');where();}],['An adult',()=>{setAud('adults');where();}],['My family, or me as a carer',()=>{setAud('families');where();}],['Anyone',()=>{setAud('');where();}]]);
const start=()=>{chat.replaceChildren();cond='';setAud('');here=null;clear.hidden=true;nearMsg.hidden=true;apply();
ask('What would you like support with?',[...CONDS.map(c=>[c.charAt(0).toUpperCase()+c.slice(1),()=>{cond=c;apply();forWho();}]),['Not sure, or more than one',()=>{cond='';apply();forWho();}]]);};
start();
q.addEventListener('input',apply);
for(const b of document.querySelectorAll('.aud button'))b.addEventListener('click',()=>{aud=b.dataset.a;showUnstated=false;for(const x of document.querySelectorAll('.aud button'))x.setAttribute('aria-pressed',String(x===b));apply();});
</script>
</body>
</html>
`;
}
