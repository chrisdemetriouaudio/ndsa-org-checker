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
    out.push('', 'To decide: tell Claude "**[name] is still running**" or "**close [name]**". It goes into `data/orgs.json`.');
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
export function renderSite(orgs: Org[], state: State): string {
  const shown = rows(orgs, state).filter((r) => ['Confirmed', 'Looks active', 'Needs a check'].includes(r.s.status));
  const cards = shown.map(({ org, s }) => {
    const report = `${REPO}/issues/new?title=${encodeURIComponent(`Problem with ${org.name}`)}&body=${encodeURIComponent(`Listing: ${org.name} (${org.url})\n\nWhat went wrong:\n`)}`;
    const checking = s.status === 'Needs a check' ? '<p class="note">We are re-checking this service.</p>' : '';
    const freshness = s.status === 'Confirmed' ? `Confirmed by the organisation` : `Last checked ${dateWords(s.lastChecked)}`;
    const hue = s.score === null ? null : scoreHue(s.score);
    return `<li class="card">
  <div class="top"><h2><a href="${esc(org.url)}">${esc(org.name)}</a></h2><span class="score" ${hue === null ? '' : `style="--h:${hue}"`} title="How sure we are it is still running">${s.score ?? '—'}<small>/100</small></span></div>
  <p class="meta">${esc(org.kind)} · ${esc(org.area)}</p>
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
<meta name="description" content="Neurodivergent support organisations in the UK, checked every day.">
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
</style>
</head>
<body>
<main>
<h1>ND Support Directory</h1>
<p class="lead">${shown.length} UK organisations supporting neurodivergent people. Every website is checked daily. Last check: ${dateWords(state.updated)}. The score (out of 100) shows how sure we are each one is still running.</p>
<label for="q" class="lead">Search by name, area or need</label>
<input id="q" type="search" placeholder="For example: ADHD, Scotland, dyslexia">
<ul id="list">
${cards}
</ul>
<footer>Prototype. Services that look closed are hidden until a person checks them. <a href="${REPO}">How this works</a>.</footer>
</main>
<script>
const q=document.getElementById('q');const items=[...document.querySelectorAll('#list .card')];
q.addEventListener('input',()=>{const t=q.value.trim().toLowerCase();for(const li of items)li.hidden=t&&!li.textContent.toLowerCase().includes(t);});
</script>
</body>
</html>
`;
}
