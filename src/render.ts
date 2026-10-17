import { FLAGGED, type Org, type OrgState, type State, type Status } from './types.ts';

const REPO = 'https://github.com/chrisdemetriouaudio/ndsa-org-checker';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-17" → "17 Oct 2026" (the vault's date style). */
export function dateWords(iso: string | null): string {
  if (!iso) return 'never';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS.at(m - 1)} ${y}`;
}

const ICON: Record<Status, string> = {
  Confirmed: '✅',
  'Looks active': '🟢',
  'Needs a check': '🟡',
  'Likely closed': '🔴',
  Closed: '⚫',
};

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
const lastAnswer = (s: OrgState) => {
  const h = s.history.at(-1);
  if (!h) return '—';
  if (h.error) return h.error === 'DNS' ? 'Address not found' : h.error;
  return h.robotsBlocked ? `${h.httpStatus} (page not read: robots.txt)` : String(h.httpStatus);
};

/** The generated "30 Live/Live status.md" note. */
export function renderLivePage(orgs: Org[], state: State): string {
  const all = rows(orgs, state);
  const c = countByStatus(orgs, state);
  const flagged = all.filter((r) => FLAGGED.includes(r.s.status))
    .sort((a, b) => (a.s.status === b.s.status ? 0 : a.s.status === 'Likely closed' ? -1 : 1));
  const fine = all.filter((r) => !FLAGGED.includes(r.s.status) && r.s.status !== 'Closed');
  const closed = all.filter((r) => r.s.status === 'Closed');
  const updated = state.updated?.slice(0, 10) ?? null;

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
    '## 👉 To review',
    '',
  ];

  if (!flagged.length) {
    out.push('- Nothing to review.');
  } else {
    for (const { org, s } of flagged) {
      out.push(`- ${ICON[s.status]} **Check ${org.name}:** ${s.status.toLowerCase()} since ${dateWords(s.since)}.`);
    }
    out.push('', '| Service | Why | Website |', '| --- | --- | --- |');
    for (const { org, s } of flagged) {
      out.push(`| ${cell(org.name)} | ${cell(s.reasons.join('. '))} | [visit](${org.url}) |`);
    }
    out.push('', 'To decide: tell Claude "**[name] is still running**" or "**close [name]**". It goes into `data/orgs.json`.');
  }

  out.push('', '## ✅ Fine', '', `> [!success]- ${fine.length} services look fine`, '> | Service | Status | Area | Last answer | Last checked |', '> | --- | --- | --- | --- | --- |');
  for (const { org, s } of fine) {
    out.push(`> | [${cell(org.name)}](${org.url}) | ${ICON[s.status]} ${s.status} | ${cell(org.area)} | ${lastAnswer(s)} | ${dateWords(s.lastChecked)} |`);
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
  return [
    '> [!info] Live (updated by the daily check)',
    `> **Last check:** ${dateWords(state.updated)}.`,
    `> **To review:** ${toReview}. See [[Live status]].`,
    `> **Fine:** ${c['Looks active'] + c.Confirmed} · **Closed:** ${c.Closed}`,
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
    ...newly.map(({ org, s }) => `- ${ICON[s.status]} **${org.name}** (${s.status}): ${s.reasons.join('. ')}. ${org.url}`),
    '',
    'Nothing is removed until a person decides.',
  ].join('\n');
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The public directory page (site/index.html). Likely-closed and closed services are hidden. */
export function renderSite(orgs: Org[], state: State): string {
  const shown = rows(orgs, state).filter((r) => ['Confirmed', 'Looks active', 'Needs a check'].includes(r.s.status));
  const cards = shown.map(({ org, s }) => {
    const report = `${REPO}/issues/new?title=${encodeURIComponent(`Problem with ${org.name}`)}&body=${encodeURIComponent(`Listing: ${org.name} (${org.url})\n\nWhat went wrong:\n`)}`;
    const checking = s.status === 'Needs a check' ? '<p class="note">We are re-checking this service.</p>' : '';
    const freshness = s.status === 'Confirmed' ? `Confirmed by the organisation` : `Last checked ${dateWords(s.lastChecked)}`;
    return `<li class="card">
  <h2><a href="${esc(org.url)}">${esc(org.name)}</a></h2>
  <p class="meta">${esc(org.kind)} · ${esc(org.area)}</p>
  <p class="tags">${org.focus.map((f) => `<span>${esc(f)}</span>`).join('')}</p>
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
:root{--bg:#fbfaf7;--card:#fff;--ink:#1d1d1b;--quiet:#5c5b57;--line:#e3e0d8;--accent:#2f5d8a;--note:#fff4d6}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--card:#1f1f1d;--ink:#eeece6;--quiet:#a9a69e;--line:#34332f;--accent:#8db8e3;--note:#3a3120}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:18px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.01em}
main{max-width:860px;margin:0 auto;padding:32px 16px 64px}h1{font-size:1.8rem;margin:0 0 4px}
.lead{color:var(--quiet);margin:0 0 24px}ul{list-style:none;padding:0;margin:0;display:grid;gap:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 18px}
.card h2{font-size:1.15rem;margin:0}.card a{color:var(--accent)}.meta,.fresh{color:var(--quiet);font-size:.9rem;margin:4px 0 0}
.tags{margin:8px 0 0;display:flex;flex-wrap:wrap;gap:6px}.tags span{border:1px solid var(--line);border-radius:999px;padding:0 10px;font-size:.85rem}
.note{background:var(--note);border-radius:6px;padding:4px 10px;margin:8px 0 0;font-size:.9rem}
input{width:100%;font:inherit;padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);margin:0 0 16px}
footer{color:var(--quiet);font-size:.85rem;margin-top:32px}
</style>
</head>
<body>
<main>
<h1>ND Support Directory</h1>
<p class="lead">${shown.length} UK organisations supporting neurodivergent people. Every website is checked daily. Last check: ${dateWords(state.updated)}.</p>
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
