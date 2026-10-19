import { sortKey } from './neworg.ts';
import { AUDIENCE_LABEL, AUDIENCES } from './audience.ts';
import { CONDITIONS, matchConditions } from './conditions.ts';
import { areaKey } from './place.ts';
import { dateWords } from './dates.ts';
import type { Level, Signal } from './signals.ts';

export { dateWords };
import { FLAGGED, type Org, type OrgState, type State, type Status } from './types.ts';
import { DISPLAY_HEAD_JS, DISPLAY_JS, DISPLAY_PANEL, DISPLAY_TOGGLE, displayCss, ICON_CSS, LOGO, THEME_CSS, BRAIN_PATH, BRAIN_FOLDS } from './display.ts';

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
    .sort((a, b) => sortKey(a.org.name).localeCompare(sortKey(b.org.name)));
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
    .sort((a, b) => (a.s.score ?? 0) - (b.s.score ?? 0) || sortKey(a.org.name).localeCompare(sortKey(b.org.name)));
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

/** Larger inline icons for section headings (a handful per page; the small repeated icons are CSS masks: ICON_CSS). */
const ICONS = {
  check: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15.5 15.5L21 21M7.8 10.7l2 2 3.6-4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  browse: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 6.5h16M4 12h16M4 17.5h10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  chat: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 5h14a2 2 0 012 2v8a2 2 0 01-2 2h-7l-4.5 3.5V17H5a2 2 0 01-2-2V7a2 2 0 012-2z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M8 11h.01M12 11h.01M16 11h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
};

/** Friendly shapes in the top band: sun, coral and mint, with a big tick. Hidden in high contrast and on phones. */
const HERO_SHAPES = `<svg class="deco shapes" viewBox="0 0 320 260" aria-hidden="true" focusable="false">
<circle class="s-coral" cx="92" cy="196" r="52"/><circle class="s-mint" cx="62" cy="64" r="15"/>
<g transform="translate(92 24) scale(1.9)"><path class="s-sun" d="${BRAIN_PATH}"/><path class="s-fold" d="${BRAIN_FOLDS}" fill="none" stroke-width="4.5" stroke-linecap="round"/></g>
<rect class="s-mint" x="214" y="158" width="88" height="88" rx="28" transform="rotate(12 258 202)"/>
<path class="s-tick" d="M236 202l14 14 28-32" fill="none" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const wave = (cls: string) => `<svg class="wave ${cls}" viewBox="0 0 1440 56" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 56V26C200 4 420 0 720 22s520 34 720 6V56Z"/></svg>`;

/** The finder's avatar: the logo as a tiny picture (img-src allows data:). */
const AVATAR = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect width='40' height='40' rx='13' fill='#e3f1ec'/><g transform='translate(3 6) scale(.34)'><path d='${BRAIN_PATH}' fill='#f3c457'/><path d='${BRAIN_FOLDS}' fill='none' stroke='#12504c' stroke-width='7' stroke-linecap='round'/></g></svg>`)}")`;

/*
 * Mobile first: one calm column with a sticky search bar. From 1024px wide: search, finder and filters in a sticky
 * left column, results on the right. Spacing on a 4/8 scale; type on a 1.2 scale from 18px body text.
 */
const SITE_CSS = `
:root{--sp-1:4px;--sp-2:8px;--sp-3:12px;--sp-4:16px;--sp-5:24px;--sp-6:32px;--sp-7:48px;--sp-8:64px;
--fs-sm:.9375rem;--fs-base:1.125rem;--fs-md:1.3125rem;--fs-lg:1.5625rem;--fs-xl:1.875rem;--fs-hero:clamp(1.75rem,1.15rem + 2.8vw,2.85rem);
--r-sm:12px;--r-md:18px;--r-lg:24px;--r-pill:999px;--measure:65ch}
*{box-sizing:border-box}[hidden]{display:none!important}
html{-webkit-text-size-adjust:100%;scroll-padding-top:var(--sp-5)}
@media (max-width:1023.98px){html{scroll-padding-top:140px}}
body{margin:0;background:var(--bg);color:var(--ink);font:500 18px/1.6 var(--body-font);letter-spacing:.005em;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:var(--display);font-weight:800;letter-spacing:var(--tight);line-height:1.2;margin:0}
p{margin:0}
a{color:var(--accent);text-underline-offset:.2em;text-decoration-thickness:.08em}
ul{list-style:none;padding:0;margin:0}
.wrap{max-width:1200px;margin:0 auto;padding:0 var(--sp-4)}
@media (min-width:600px){.wrap{padding:0 var(--sp-5)}}
.sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.skip{position:absolute;left:var(--sp-3);top:-200px;z-index:100;background:var(--card);color:var(--ink);font-weight:800;padding:var(--sp-3) var(--sp-4);border-radius:var(--r-sm);border:2px solid var(--accent)}.skip:focus{top:var(--sp-3)}
/* ---------- Top band ---------- */
.hero{background:var(--hero);color:var(--hero-ink);position:relative;overflow:hidden}
.hero::before{content:"";position:absolute;width:420px;height:420px;border-radius:50%;right:-210px;top:120px;background:color-mix(in srgb,var(--mint) 13%,transparent)}
.hero::after{content:"";position:absolute;width:150px;height:150px;border-radius:50%;left:-75px;top:-75px;background:color-mix(in srgb,var(--sun) 16%,transparent)}
.hero .wrap{position:relative;z-index:1;padding-top:var(--sp-4);padding-bottom:96px}
.hero :focus-visible,.site-foot :focus-visible{outline-color:var(--hero-ink)}
.masthead{display:flex;justify-content:space-between;align-items:center;gap:var(--sp-3);flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:var(--sp-3);min-width:0}
.brand h1{font-size:var(--fs-md);color:var(--hero-ink);line-height:1.1}
@media (max-width:479.98px){.brand h1{max-width:8.2em}}
.mast-tools{display:flex;gap:var(--sp-2);align-items:center;flex-wrap:wrap;margin-left:auto}
.admin-link{display:inline-flex;align-items:center;min-height:44px;font-size:var(--fs-sm);font-weight:700;white-space:nowrap;color:var(--hero-ink);border:1.5px solid var(--hero-ink);border-radius:var(--r-pill);padding:var(--sp-1) var(--sp-4);text-decoration:none}
.admin-link:hover{background:var(--hero-ink);color:var(--hero)}
.hero-body{position:relative;z-index:1;max-width:36rem;margin-top:var(--sp-5)}
.kicker{display:inline-flex;align-items:center;gap:var(--sp-2);font-weight:800;font-size:var(--fs-sm);color:var(--hero-ink);background:color-mix(in srgb,var(--hero-ink) 12%,var(--hero));border-radius:var(--r-pill);padding:var(--sp-1) var(--sp-3);margin:0 0 var(--sp-4)}
.kicker::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--sun)}
.hero-lead{font:800 var(--fs-hero)/1.15 var(--display);letter-spacing:var(--tight);margin:0 0 var(--sp-5);color:var(--hero-ink);text-wrap:balance;overflow-wrap:break-word}
.facts{display:flex;flex-wrap:wrap;gap:var(--sp-2)}
.facts li{display:flex;align-items:baseline;gap:6px;background:color-mix(in srgb,var(--hero-ink) 12%,var(--hero));color:var(--hero-quiet);border-radius:var(--r-md);padding:var(--sp-2) var(--sp-4);font-size:var(--fs-sm);font-weight:700}
.facts strong{font-family:var(--display);font-weight:800;font-size:var(--fs-md);color:var(--hero-ink);line-height:1}
.shapes{display:none}
@media (min-width:860px){.shapes{display:block;position:absolute;right:var(--sp-5);top:84px;width:300px;height:auto}.hero-body{margin-top:var(--sp-7)}.hero .wrap{padding-bottom:120px}}
.s-sun{fill:var(--sun)}.s-fold{stroke:var(--hero)}.s-coral{fill:var(--coral)}.s-mint{fill:var(--mint)}.s-tick{stroke:var(--hero)}
.wave{position:absolute;left:0;right:0;width:100%;height:48px;pointer-events:none}
.wave.down{bottom:-1px;fill:var(--bg)}.wave.up{top:-47px;fill:var(--hero);transform:scaleX(-1)}
main{display:block}
/* ---------- Shared pieces ---------- */
.sec-head{display:flex;align-items:center;gap:var(--sp-3)}
.sec-head h2{font-size:var(--fs-lg)}
.how{margin-top:var(--sp-7);margin-bottom:var(--sp-7)}.how-grid{display:grid;gap:var(--sp-4);margin-top:var(--sp-4)}@media (min-width:760px){.how-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (min-width:1100px){.how-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.how-card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:var(--sp-5)}.how-card h3{margin:0 0 var(--sp-2);font-size:var(--fs-md, 1.125rem)}.how-card p{margin:0;max-width:65ch}
.ico{flex:none;display:inline-grid;place-items:center;width:44px;height:44px;border-radius:14px;color:#1c2b2a}
.ico svg{width:24px;height:24px}.ico.sun{background:var(--sun)}.ico.mint{background:var(--mint)}.ico.coral{background:var(--coral)}
.lead{color:var(--quiet);max-width:var(--measure)}
.hint{color:var(--quiet);font-size:var(--fs-sm);margin-top:var(--sp-2);max-width:var(--measure)}
input:not([type=checkbox]):not([type=radio]),select{width:100%;font:inherit;font-weight:600;min-height:52px;padding:var(--sp-3) var(--sp-4);border:2px solid var(--edge);border-radius:var(--r-md);background:var(--card);color:var(--ink);margin:0}
input:not([type=checkbox]):not([type=radio]):hover{border-color:var(--ink)}
input:not([type=checkbox]):not([type=radio]):focus-visible{border-color:var(--accent);outline-offset:1px}
::placeholder{color:var(--quiet);opacity:1;font-weight:500}
label{font-weight:800}
.btn,#check-go,.nearrow button:not(.linkish){display:inline-flex;align-items:center;justify-content:center;gap:var(--sp-2);font:inherit;font-weight:800;min-height:52px;border:2px solid var(--accent);background:var(--accent);color:var(--accent-ink);border-radius:var(--r-pill);padding:var(--sp-2) var(--sp-6);cursor:pointer}
.btn:hover,#check-go:hover,.nearrow button:not(.linkish):hover{background:var(--ink);border-color:var(--ink);color:var(--bg)}
#check-go:disabled{opacity:.6;cursor:progress}
.linkish{font:inherit;font-weight:800;background:none;border:0;color:var(--accent);text-decoration:underline;text-underline-offset:.2em;cursor:pointer;padding:0 var(--sp-1);min-height:44px}
/* ---------- "Is it still running?" ---------- */
.checker{position:relative;z-index:3;margin:-80px 0 var(--sp-7);background:var(--card);border-radius:var(--r-lg);padding:var(--sp-5) var(--sp-4);box-shadow:0 1px 0 var(--line),0 24px 48px -28px rgba(10,40,38,.5);border-top:6px solid var(--sun)}
@media (min-width:600px){.checker{padding:var(--sp-6)}}
.checker>.hint{margin:var(--sp-3) 0 0}
.checker form{margin-top:var(--sp-5)}.checker label{display:block;margin-bottom:var(--sp-2)}
.checker details{margin:var(--sp-2) 0 0}.checker details label{margin-top:var(--sp-2)}
.checker summary{cursor:pointer;color:var(--accent);font-weight:800;font-size:var(--fs-sm);min-height:44px;display:flex;align-items:center;gap:var(--sp-2);list-style:none;width:fit-content}
.checker summary::-webkit-details-marker{display:none}
.checker summary::before{content:"+";display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--tint-2);color:var(--accent);font-weight:800;line-height:1;flex:none}
.checker details[open] summary::before{content:"\\2212"}
.checker form p{margin-top:var(--sp-3)}
@media (min-width:900px){.checker{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);grid-template-rows:auto 1fr;column-gap:var(--sp-7);align-items:start}
.checker>.sec-head,.checker>.hint{grid-column:1}.checker>form{grid-column:2;grid-row:1/span 2;margin-top:0}.checker>#check-out{grid-column:1/-1}}
#check-out:not(:empty){margin-top:var(--sp-5)}
#check-out>.hint{display:flex;align-items:center;gap:var(--sp-2);font-weight:700}
#check-out>.note{margin:0}
/* The verdict */
.result{border-radius:var(--r-lg);border:1px solid var(--line);overflow:hidden;background:var(--card)}
.result>*{margin-left:var(--sp-5);margin-right:var(--sp-5)}
.result>.top{margin:0 0 var(--sp-4);padding:var(--sp-5);display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--sp-4);align-items:center;background:var(--tint-2)}
.result.running>.top{background:var(--green-bg)}.result.check>.top{background:var(--amber-bg)}.result.closed>.top{background:var(--red-bg)}
.result h3{font-size:var(--fs-lg);display:flex;align-items:flex-start;gap:var(--sp-3);line-height:1.15}
.result h3::before{flex:none;display:grid;place-items:center;width:1.3em;height:1.3em;border-radius:50%;font-size:.85em;color:var(--card);background:var(--edge);content:"?"/""}
.result.running h3::before{background:var(--green);content:"\\2713"/""}.result.check h3::before{background:var(--amber);content:"!"/""}.result.closed h3::before{background:var(--red);content:"\\2715"/""}
.result p{margin-top:var(--sp-2);max-width:var(--measure)}
.result>p.meta:first-of-type{margin-top:0}
.result .ticks{margin-top:var(--sp-4);margin-bottom:var(--sp-4);display:grid;gap:0;border-top:1px solid var(--line)}
.result .ticks li{display:grid;grid-template-columns:28px minmax(0,1fr);column-gap:var(--sp-3);padding:var(--sp-3) 0;border-bottom:1px solid var(--line);font-size:var(--fs-sm);color:var(--quiet)}
.result .ticks strong{color:var(--ink);font-size:var(--fs-base)}
.result .ticks .tk{grid-row:1/span 2;width:28px;height:28px;margin-top:2px}
.result>*:last-child{margin-bottom:var(--sp-5)}
.tk{display:inline-grid;place-items:center;border-radius:50%;font-weight:800;font-size:.8rem;line-height:1;color:var(--card);background:var(--edge)}
.tk.green{background:var(--green)}.tk.amber{background:var(--amber)}.tk.red{background:var(--red)}.tk.none{background:transparent;color:var(--quiet);box-shadow:inset 0 0 0 1.5px var(--edge)}
/* ---------- Directory ---------- */
.dir-intro{margin-bottom:var(--sp-5)}
.dir-intro .lead{margin-top:var(--sp-3)}
.dir{display:flex;flex-direction:column;gap:var(--sp-5)}
.side,.filters{display:contents}
.searchbar{position:sticky;top:0;z-index:20;background:var(--bg);margin:0 calc(-1 * var(--sp-4));padding:var(--sp-3) var(--sp-4);border-bottom:1px solid var(--line)}
@media (min-width:600px){.searchbar{margin:0 calc(-1 * var(--sp-5));padding:var(--sp-3) var(--sp-5)}}
.searchbar .row1{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:0 var(--sp-3);margin-bottom:6px}
.searchbar label{font-size:var(--fs-sm)}
#count{font-size:var(--fs-sm);font-weight:800;color:var(--tag-ink);background:var(--tag-bg);border-radius:var(--r-pill);padding:0 var(--sp-2)}
.search{position:relative}
.search .ic{position:absolute;left:18px;top:50%;width:1.3em;height:1.3em;transform:translateY(-50%);color:var(--accent);pointer-events:none}
.search input{padding-left:3.2em!important;border-radius:var(--r-pill)!important}
.panel{border-radius:var(--r-lg);padding:var(--sp-5)}
.finder{background:var(--tint)}
.finder .sec-head h2{font-size:var(--fs-md)}
.finder>.hint{margin:var(--sp-3) 0 0}
#chat{display:flex;flex-direction:column;gap:var(--sp-3);margin-top:var(--sp-3)}
#chat:empty{display:none}
.bubble{padding:var(--sp-3) var(--sp-4);border-radius:20px;max-width:88%;width:fit-content;line-height:1.45}
.bubble.bot{position:relative;margin-left:44px;background:var(--card);border-radius:6px 20px 20px 20px;box-shadow:0 1px 0 var(--line)}
.bubble.bot::before{content:"";position:absolute;left:-44px;top:0;width:34px;height:34px;border-radius:11px;background:${AVATAR} center/cover}
.bubble.me{margin-left:auto;background:var(--accent);color:var(--accent-ink);border-radius:20px 6px 20px 20px;font-weight:800}
#choices{display:flex;flex-wrap:wrap;gap:var(--sp-2);margin-top:var(--sp-4)}
#choices:empty{display:none}
#choices button,.aud button{display:inline-flex;align-items:center;gap:var(--sp-2);font:inherit;font-size:var(--fs-sm);font-weight:800;min-height:44px;border:2px solid var(--accent);background:var(--card);color:var(--accent);border-radius:22px;padding:var(--sp-2) var(--sp-4);cursor:pointer;max-width:100%;text-align:left}
#choices button:hover{background:var(--accent);color:var(--accent-ink)}
.near{background:var(--tint-2)}
.near>label{display:flex;align-items:center;gap:var(--sp-3);font-size:var(--fs-md);font-family:var(--display);font-weight:800;letter-spacing:var(--tight)}
.near>label .ic{width:44px;height:44px;border-radius:14px;background:var(--mint);color:#1c2b2a;-webkit-mask:none;mask:none;position:relative}
.near>label .ic::after{content:"";position:absolute;inset:10px;background:currentColor;-webkit-mask:var(--i) center/contain no-repeat;mask:var(--i) center/contain no-repeat}
.nearrow{display:flex;flex-wrap:wrap;gap:var(--sp-2);margin-top:var(--sp-4);align-items:center}.nearrow input{flex:1 1 200px;width:auto!important;min-width:0}
.aud{display:flex;flex-wrap:wrap;gap:var(--sp-2);align-items:center}
.aud>span{font-weight:800;width:100%;margin-bottom:var(--sp-1)}
.aud button{border-color:var(--edge);color:var(--ink)}
.aud button:hover{border-color:var(--accent)}
.aud button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.aud button[aria-pressed="true"]::before{content:"\\2713"/"";font-weight:800}
.results-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:var(--sp-2) var(--sp-4);margin-bottom:var(--sp-4)}
.scorekey{display:flex;align-items:center;flex-wrap:wrap;gap:var(--sp-2) var(--sp-3);font-size:var(--fs-sm);color:var(--quiet)}
.scorekey .ends{display:flex;gap:var(--sp-2);align-items:center;font-weight:800;color:var(--ink)}
.scorekey .bar{display:inline-block;width:120px;height:10px;border-radius:var(--r-pill);background:linear-gradient(90deg,hsl(0 var(--sc-ring)),hsl(20 var(--sc-ring)) 30%,hsl(40 var(--sc-ring)) 60%,hsl(85 var(--sc-ring)) 80%,hsl(130 var(--sc-ring)))}
#list{display:grid;gap:var(--sp-5)}
.group{display:flex;align-items:center;gap:var(--sp-3);font-family:var(--display);font-weight:800;font-size:var(--fs-base);letter-spacing:var(--tight);line-height:1.3;color:var(--tag-ink);margin-top:var(--sp-3);padding:var(--sp-3) var(--sp-4);background:var(--tag-bg);border-radius:var(--r-md)}
.group::before{content:"";flex:none;width:10px;height:10px;border-radius:50%;background:var(--accent)}
.group:first-child{margin-top:0}
#more-general{margin:0 0 var(--sp-4)}#more-general span:empty{display:none}
#more-general button{display:inline-flex;align-items:center;gap:var(--sp-2);min-height:48px;padding:var(--sp-2) var(--sp-5);border-radius:24px;border:2px dashed var(--accent);background:var(--tint-2);color:var(--accent);text-decoration:none;font-weight:800;text-align:left;max-width:100%}
#more-general button::before{content:"+"/"";flex:none;display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--accent);color:var(--accent-ink);font-weight:800}
#more-general button:hover{border-style:solid}
/* ---------- Organisation card ---------- */
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);padding:var(--sp-5) var(--sp-5) var(--sp-4);display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:var(--sp-4);align-items:start;box-shadow:0 1px 0 var(--line)}
.card:hover{border-color:var(--edge)}
.card:focus-within{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.card>*{grid-column:1/-1}.card>.top{display:contents}
.card h2{grid-column:1;align-self:center}.card .score{grid-column:2;grid-row:1}
@media (min-width:600px){.card .meta{grid-column:1}.card .score{grid-row:1/span 2}.card h2{align-self:start}}
.card h2{font-size:var(--fs-md);line-height:1.25;min-width:0}
.card h2 a{color:var(--ink);text-decoration:none;background:linear-gradient(var(--sun),var(--sun)) 0 100%/100% 3px no-repeat;padding-bottom:2px}
.card h2 a:hover{color:var(--accent);background-size:100% 100%;background-image:linear-gradient(var(--tint),var(--tint))}
.meta{color:var(--quiet);font-size:var(--fs-sm);margin-top:var(--sp-2);font-weight:600}.card .meta{display:flex;gap:var(--sp-2);align-items:flex-start}
.card .meta::before{content:"";flex:none;width:1.15em;height:1.15em;margin-top:.2em;background:currentColor;--i:var(--ic-building);-webkit-mask:var(--i) center/contain no-repeat;mask:var(--i) center/contain no-repeat}
.facts-list{margin-top:var(--sp-4);display:grid;gap:var(--sp-2)}
.who{display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:var(--sp-3);font-size:var(--fs-sm);align-items:start}
.who .k{display:inline-flex;align-items:center;gap:var(--sp-2);color:var(--quiet);font-weight:800;min-width:5.6em}
.who .k::before{content:"";flex:none;width:1.15em;height:1.15em;background:var(--accent);-webkit-mask:var(--i) center/contain no-repeat;mask:var(--i) center/contain no-repeat}
.who.for .k::before{--i:var(--ic-users)}.who.serves .k::before{--i:var(--ic-pin)}
.dist{font-size:var(--fs-sm);font-weight:800;margin-top:var(--sp-3);color:var(--tag-ink);background:var(--tag-bg);border-radius:var(--r-sm);padding:var(--sp-1) var(--sp-3);width:fit-content;max-width:100%}
.tags{margin-top:var(--sp-4);display:flex;flex-wrap:wrap;gap:var(--sp-2)}.tags span{background:var(--tint);color:var(--ink);border-radius:var(--r-pill);padding:2px var(--sp-3);font-size:var(--fs-sm);font-weight:800}
.checks{display:flex;flex-wrap:wrap;gap:var(--sp-2);margin-top:var(--sp-3)}
.chk{display:inline-flex;align-items:center;gap:6px;font-size:.875rem;font-weight:700;color:var(--ink);border:1px solid var(--line);border-radius:var(--r-pill);padding:2px var(--sp-3) 2px 4px}
.chk span{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;font-size:.75rem;font-weight:800;line-height:1;color:var(--card)}
.chk.green span{background:var(--green)}.chk.amber span{background:var(--amber)}.chk.red span{background:var(--red)}
.chk.amber{background:var(--amber-bg)}.chk.red{background:var(--red-bg)}
.chk.none{color:var(--quiet);border-style:dashed;border-color:var(--edge)}.chk.none span{color:var(--quiet);box-shadow:inset 0 0 0 1.5px var(--edge)}
.note{display:flex;gap:var(--sp-2);align-items:flex-start;background:var(--note);border-radius:var(--r-sm);padding:var(--sp-2) var(--sp-3);margin-top:var(--sp-3);font-size:var(--fs-sm);font-weight:700}
.note::before{content:"";flex:none;width:1.15em;height:1.15em;margin-top:.2em;background:var(--amber);--i:var(--ic-info);-webkit-mask:var(--i) center/contain no-repeat;mask:var(--i) center/contain no-repeat}
.foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--sp-3) var(--sp-4);margin-top:var(--sp-5);padding-top:var(--sp-4);border-top:1px solid var(--line)}
.visit{display:inline-flex;align-items:center;justify-content:center;gap:var(--sp-2);min-height:48px;padding:var(--sp-2) var(--sp-5);border-radius:var(--r-pill);background:var(--tint-2);color:var(--accent);font-weight:800;text-decoration:none;flex:1 1 auto}
@media (min-width:600px){.visit{flex:0 0 auto}}
.visit::after{content:"";width:1.15em;height:1.15em;background:currentColor;--i:var(--ic-arrow);-webkit-mask:var(--i) center/contain no-repeat;mask:var(--i) center/contain no-repeat}
.visit:hover{background:var(--accent);color:var(--accent-ink)}
.fresh{color:var(--quiet);font-size:.875rem;font-weight:600}
.fresh a{color:var(--quiet)}.fresh a:hover{color:var(--accent)}
/* Score: a ring that fills with the score, in its temperature colour (red, amber, green) */
.card .score,.result .score{flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;font:800 1.25rem/1 var(--display);color:hsl(var(--h,0) var(--sc-ink));
background:radial-gradient(closest-side,var(--card) calc(100% - 7px),transparent calc(100% - 6.5px)),conic-gradient(hsl(var(--h,0) var(--sc-ring)) calc(var(--s,0) * 1%),var(--track) 0)}
.result .score{width:88px;height:88px;font-size:1.75rem;background:radial-gradient(closest-side,var(--card) calc(100% - 10px),transparent calc(100% - 9.5px)),conic-gradient(hsl(var(--h,0) var(--sc-ring)) calc(var(--s,0) * 1%),var(--track) 0)}
.card .score small,.result .score small{font-weight:700;font-size:.55em;color:var(--quiet);margin-top:3px;letter-spacing:0}
:root[data-text] .card .score{width:3.6em;height:3.6em}
.score.na{color:var(--quiet)}
@media (min-width:600px){.result h3{font-size:var(--fs-xl)}.result .score{width:96px;height:96px;font-size:2rem}}
@media (max-width:599.98px){.result>.top{grid-template-columns:minmax(0,1fr)}.result>.top .score{justify-self:start}}
#list .paged{display:none!important}
.pager{display:flex;flex-direction:column;align-items:center;gap:var(--sp-3);margin-top:var(--sp-6);text-align:center}
#page-count{color:var(--quiet);font-weight:800}
.pager .btn{background:var(--card);color:var(--accent);min-width:min(100%,16rem)}
.pager .btn:hover{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.to-top{position:fixed;right:var(--sp-4);bottom:var(--sp-4);z-index:30;display:inline-flex;align-items:center;gap:var(--sp-2);min-height:48px;padding:0 var(--sp-5);border-radius:var(--r-pill);background:var(--accent);color:var(--accent-ink);font-weight:800;text-decoration:none;box-shadow:0 10px 24px -12px rgba(0,0,0,.55)}
.to-top:hover{background:var(--ink);color:var(--bg)}
@media (max-width:599.98px){.to-top{width:52px;height:52px;padding:0;justify-content:center}.to-top .ic{width:1.4em;height:1.4em}.to-top .tt{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}}
.active{display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp-2) var(--sp-3);margin-bottom:var(--sp-4);padding:var(--sp-3) var(--sp-4);background:var(--card);border:2px solid var(--accent);border-radius:var(--r-lg)}
.active-label{font-weight:800}
.chips{display:flex;flex-wrap:wrap;gap:var(--sp-2);min-width:0}
.chip-x{display:inline-flex;align-items:center;gap:var(--sp-2);min-height:44px;padding:var(--sp-1) var(--sp-2) var(--sp-1) var(--sp-4);border-radius:22px;border:0;background:var(--tag-bg);color:var(--tag-ink);font:inherit;font-size:var(--fs-sm);font-weight:800;cursor:pointer;max-width:100%;text-align:left}
.chip-x span{flex:none;display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--card);color:var(--tag-ink);font-size:.75rem}
.chip-x:hover{background:var(--accent);color:var(--accent-ink)}
.clear-all{font:inherit;font-weight:800;font-size:var(--fs-sm);min-height:44px;padding:var(--sp-1) var(--sp-4);border-radius:var(--r-pill);border:2px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer;margin-left:auto}
.clear-all:hover{background:var(--accent);color:var(--accent-ink)}
.disclose{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:var(--sp-2);min-height:44px;cursor:pointer;font:inherit;color:inherit;letter-spacing:inherit;border-radius:8px}
.disclose:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.chev{flex:none;width:28px;height:28px;border-radius:50%;background:var(--card);position:relative}
.chev::after{content:"";position:absolute;left:9px;top:7px;width:8px;height:8px;border:solid var(--accent);border-width:0 2.5px 2.5px 0;transform:rotate(45deg)}
.disclose[aria-expanded="true"] .chev::after{top:11px;transform:rotate(-135deg)}
#more{margin-top:var(--sp-5);display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp-2)}
.empty{text-align:center;background:var(--card);border:2px dashed var(--edge);border-radius:var(--r-lg);padding:var(--sp-7) var(--sp-5)}
.empty .ic{width:56px;height:56px;color:var(--accent)}
.empty h3{font-size:var(--fs-lg);margin-top:var(--sp-3)}
.empty p{color:var(--quiet);margin:var(--sp-2) auto var(--sp-5);max-width:34ch}
/* ---------- Footer ---------- */
.site-foot{background:var(--hero);color:var(--hero-ink);margin-top:var(--sp-8);padding:var(--sp-6) 0 var(--sp-7);font-size:var(--fs-sm);position:relative}
.site-foot a{color:var(--hero-ink);font-weight:700}
.foot-grid{display:grid;gap:var(--sp-6)}
.site-foot .brand strong{font-family:var(--display);font-size:var(--fs-md);font-weight:800;letter-spacing:var(--tight)}.site-foot .logo{width:40px;height:40px}
.site-foot h2{font-size:var(--fs-base);margin-bottom:var(--sp-2);color:var(--hero-ink)}
.site-foot p{color:var(--hero-quiet);max-width:var(--measure)}
.site-foot .tagline{margin-top:var(--sp-3);color:var(--hero-ink);font-weight:700}
.foot-base{margin-top:var(--sp-6);padding-top:var(--sp-4);border-top:1px solid color-mix(in srgb,var(--hero-ink) 25%,var(--hero));display:flex;justify-content:space-between;gap:var(--sp-3);flex-wrap:wrap;color:var(--hero-quiet)}
.foot-base a{display:inline-flex;align-items:center;gap:var(--sp-2);min-height:44px}
.credit{margin:var(--sp-3) 0 0;color:var(--hero-quiet);font-size:.9375rem}.credit a{color:var(--hero-ink);font-weight:700;display:inline-flex;align-items:center;min-height:44px}.credit-ask{display:block;color:var(--hero-ink);font-weight:700;font-size:1.0625rem}
@media (min-width:860px){.foot-grid{grid-template-columns:1.2fr 1fr 1.6fr;gap:var(--sp-7)}}
/* ---------- Desktop: sticky left column ---------- */
@media (min-width:1024px){
.active{position:sticky;top:var(--sp-3);z-index:6;box-shadow:0 12px 24px -20px rgba(10,40,38,.6)}
.dir{display:grid;grid-template-columns:minmax(19rem,23rem) minmax(0,1fr);gap:var(--sp-6);align-items:start}
.side{display:flex;flex-direction:column;gap:var(--sp-5);align-self:stretch}
.filters{display:flex;flex-direction:column;gap:var(--sp-4);position:sticky;top:0;z-index:5;background:var(--bg);padding:var(--sp-4) 0;margin-top:calc(-1 * var(--sp-4))}
.searchbar{position:static;margin:0;padding:0;border:0;background:none}
.results{min-width:0}
.panel{padding:var(--sp-5) var(--sp-4)}
.aud{background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);padding:var(--sp-4)}}
@media (prefers-reduced-motion:no-preference){
#choices button,.aud button,.btn,#check-go,.admin-link,.visit,.card,.card h2 a,input{transition:background-color .15s ease,color .15s ease,border-color .15s ease,box-shadow .15s ease,background-size .2s ease}
.bubble,#check-out>.result{animation:rise .25s ease-out both}
@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}}
/* ---------- High contrast ---------- */
:root[data-contrast="high"] .hero::before,:root[data-contrast="high"] .hero::after,:root[data-contrast="high"] .wave{display:none}
:root[data-contrast="high"] .panel,:root[data-contrast="high"] .aud,:root[data-contrast="high"] .result>.top,:root[data-contrast="high"] .empty{border:2px solid var(--ink)}
:root[data-contrast="high"] .hero{border-bottom:3px solid var(--ink)}:root[data-contrast="high"] .site-foot{border-top:3px solid var(--ink)}
:root[data-contrast="high"] .ico,:root[data-contrast="high"] .near>label .ic{background:var(--bg);color:var(--ink);outline:2px solid var(--ink)}
:root[data-contrast="high"] .tags span,:root[data-contrast="high"] .chk,:root[data-contrast="high"] .dist,:root[data-contrast="high"] .group,:root[data-contrast="high"] .facts li,:root[data-contrast="high"] .kicker,:root[data-contrast="high"] .visit,:root[data-contrast="high"] .note{border:1.5px solid var(--ink)}
:root[data-contrast="high"] .card h2 a{text-decoration:underline;background:none}
:root[data-contrast="high"] .checker{border:2px solid var(--ink)}
:root[data-contrast="high"] .bubble.bot{border:1.5px solid var(--ink)}
:root[data-contrast="high"] .group,:root[data-contrast="high"] .chip-x,:root[data-contrast="high"] .chev,:root[data-contrast="high"] .to-top{outline:1.5px solid var(--ink)}
`;

/** "Serves: X" without the label (the card shows the label itself). */
/** Cards shown at first; "Show 12 more" adds the next 12 (all stay on the page for search and filters). */
const PAGE = 12;

const servesValue = (org: Org) => servesText(org).replace(/^Serves: /, '');

export function renderSite(orgs: Org[], state: State): string {
  const shown = rows(orgs, state).filter((r) => ['Confirmed', 'Looks active', 'Needs a check'].includes(r.s.status));
  const condCount = new Map<string, number>();
  for (const { org } of shown) for (const c of conditionsOf(org).labels) condCount.set(c, (condCount.get(c) ?? 0) + 1);
  const condButtons = [...condCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const cards = shown.map(({ org, s }, i) => {
    const report = `${REPO}/issues/new?title=${encodeURIComponent(`Problem with ${org.name}`)}&body=${encodeURIComponent(`Listing: ${org.name} (${org.url})\n\nWhat went wrong:\n`)}`;
    const checking = s.status === 'Needs a check' ? '<p class="note">We are re-checking this service.</p>' : '';
    const freshness = s.status === 'Confirmed' ? `Confirmed by the organisation` : `Last checked ${dateWords(s.lastChecked)}`;
    const hue = s.score === null ? null : scoreHue(s.score);
    const who = org.audiences?.length ? org.audiences.map((a) => AUDIENCE_LABEL[a]).join(' · ') : 'Ages not stated';
    const place = `${org.lat != null ? ` data-lat="${org.lat}" data-lon="${org.lon}"` : ''} data-serves="${esc((org.serves ?? []).map(areaKey).join('|'))}" data-from="${org.servesFrom ?? ''}"`;
    const cs = conditionsOf(org);
    const badge = hue === null ? '<span class="score na" title="How sure we are it is still running">—</span>'
      : `<span class="score" style="--h:${hue};--s:${s.score}" title="How sure we are it is still running">${s.score}<small>/100</small></span>`;
    return `<li class="card${i >= PAGE ? ' paged' : ''}" data-cond="${esc(cs.labels.join('|'))}" data-general="${cs.general ? 1 : ''}" data-aud="${esc((org.audiences ?? []).join(' '))}" data-cov="${org.coverage ?? 'national'}" data-nations="${esc((org.nations ?? []).join('|'))}"${place}>
  <div class="top"><h2><a href="${esc(org.url)}">${esc(org.name)}</a></h2>${badge}</div>
  <p class="meta">${esc(org.kind)} · ${esc(org.area)}</p>
  <div class="facts-list"><p class="who for"><span class="k">For</span> <span>${esc(who)}</span></p>
  <p class="who serves"><span class="k">Serves</span> <span>${esc(servesValue(org))}</span></p></div>
  <p class="dist" hidden></p>
  <p class="tags">${org.focus.map((f) => `<span>${esc(f)}</span>`).join('')}</p>
  ${siteChecks(s)}
  ${checking}<div class="foot"><a class="visit" href="${esc(org.url)}" aria-label="Visit website: ${esc(org.name)}">Visit website</a><p class="fresh">${freshness} · <a href="${report}">Report a problem</a></p></div>
</li>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Neuro Support Checker</title>
<meta name="description" content="UK support organisations for autism, ADHD, dyslexia, learning disability, Down syndrome, brain injury and related conditions, checked every few days.">
<meta name="theme-color" content="#12504c">
<link rel="preload" href="fonts/Nunito-latin.woff2" as="font" type="font/woff2" crossorigin>
<script>${DISPLAY_HEAD_JS}</script>
<style>
${THEME_CSS}
${ICON_CSS}
${SITE_CSS}
${displayCss('fonts/')}
</style>
<noscript><style>#list .card.paged{display:grid!important}</style></noscript>
</head>
<body>
<a class="skip" href="#browse">Skip to the directory</a>
<header class="hero" id="top">
<div class="wrap">
<div class="masthead"><div class="brand">${LOGO}<h1>Neuro Support Checker</h1></div><span class="mast-tools"><span id="admin-slot"></span>${DISPLAY_TOGGLE}</span></div>
<div class="hero-body">
<p class="kicker">A free UK directory, checked for you</p>
<p class="hero-lead">Support for autism, ADHD, dyslexia, learning disability, Down syndrome, brain injury and more, across the UK.</p>
<ul class="facts"><li><strong>${shown.length}</strong> organisations</li><li><strong>${CONDITIONS.length}</strong> conditions</li><li>Checked every <strong>1 to 3</strong> days</li></ul>
</div>
${HERO_SHAPES}
</div>
${wave('down')}
</header>
<main class="wrap">
<section id="checker" class="checker" hidden aria-labelledby="checker-title">
<div class="sec-head"><span class="ico sun">${ICONS.check}</span><h2 id="checker-title">Is it still running?</h2></div>
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
<section class="browse-sec" aria-labelledby="browse">
<div class="dir-intro">
<div class="sec-head"><span class="ico mint">${ICONS.browse}</span><h2 class="browse" id="browse" tabindex="-1">Browse the directory</h2></div>
<p class="lead">${shown.length} UK organisations, checked every 1 to 3 days (daily if anything looks wrong). Last check: ${dateWords(state.updated)}. The score (out of 100) shows how sure we are each one is still running.</p>
</div>
<div class="dir">
<div class="side">
<div class="filters">
<div class="searchbar">
<div class="row1"><label for="q">Search by name, area or need</label><span id="count" aria-live="polite">${shown.length} shown</span></div>
<div class="search"><span class="ic ic-search" aria-hidden="true"></span><input id="q" type="search" placeholder="For example: ADHD, Scotland, dyslexia"></div>
</div>
<div class="aud" role="group" aria-label="Who is it for?"><span>Who is it for?</span>
<button type="button" data-a="" aria-pressed="true">Everyone</button>
${AUDIENCES.map((a) => `<button type="button" data-a="${a}" aria-pressed="false">${AUDIENCE_LABEL[a]}</button>`).join('\n')}
</div>
</div>
<section id="finder" class="finder panel" aria-labelledby="finder-title">
<div class="sec-head"><span class="ico coral">${ICONS.chat}</span><h2 id="finder-title"><button type="button" class="disclose" id="finder-toggle" aria-expanded="true" aria-controls="finder-body">Not sure where to start?<span class="chev" aria-hidden="true"></span></button></h2></div>
<p class="hint" style="margin-top:0">Answer 3 quick questions by tapping a button.</p>
<div id="finder-body">
<div id="chat" aria-live="polite"></div>
<div id="choices"></div>
</div>
</section>
<form id="near" class="near panel" hidden>
<label for="pc"><span class="ic ic-pin" aria-hidden="true"></span>Near you</label>
<div class="nearrow"><input id="pc" autocomplete="postal-code" placeholder="Postcode, like SO23 9AA or SO23" maxlength="9">
<button>Search</button><button type="button" id="clear" class="linkish" hidden>Clear</button></div>
<p class="hint">Your postcode is only used to find your council area and work out distances. It is not stored. Nothing is hidden: organisations are sorted by how sure we are they serve your area.</p>
<p id="near-msg" class="hint" hidden></p>
</form>
</div>
<div class="results">
<div class="results-head deco"><p class="scorekey"><span class="ends">0 <span class="bar" aria-hidden="true"></span> 100</span><span>Red: less sure. Green: more sure.</span></p></div>
<div id="active" class="active" hidden aria-live="polite"><span class="active-label">Showing:</span><span id="chips" class="chips"></span><button type="button" id="clear-all" class="clear-all">Clear all</button></div>
<p id="more-general" class="lead" hidden><span></span> <button type="button" class="linkish"></button></p>
<ul id="list">
${cards}
</ul>
<div id="empty" class="empty" hidden><span class="ic ic-nomatch" aria-hidden="true"></span><h3>Nothing matches yet</h3><p>Try fewer words, or show everyone.</p><button type="button" id="reset" class="btn">Clear search and filters</button></div>
<div id="pager" class="pager" hidden><p id="page-count"></p><button type="button" id="show-more" class="btn">Show 12 more</button></div>
<p id="more" class="lead" hidden><span></span> <button type="button" class="linkish">Show them too</button></p>
</div>
</div>
</section>
<section class="how wrap" id="how" aria-labelledby="how-title">
<div class="sec-head"><span class="ico sun">${ICONS.chat}</span><h2 id="how-title" tabindex="-1">How this works</h2></div>
<div class="how-grid">
<div class="how-card"><h3>Where the list comes from</h3><p>The three official UK charity registers: England and Wales, Scotland, and Northern Ireland. Every morning we look for organisations that support people with ${CONDITIONS.length} conditions, including autism, ADHD, dyslexia, learning disability, Down syndrome and brain injury. A new one is added only if it clearly offers support and its website works.</p></div>
<div class="how-card"><h3>How we check it is still running</h3><p>Every 1 to 3 days we visit each website once, politely. We look for a notice saying it has closed, a web address that has gone or is for sale, or a move to a new address. We also check the charity register: removed, insolvent, in administration, or accounts overdue.</p></div>
<div class="how-card"><h3>What the score means</h3><p>The score, out of 100, shows how sure we are that an organisation is still running. Green means sure, amber means worth checking, red means it may have closed. The ticks on each card show what was checked and what we found.</p></div>
<div class="how-card"><h3>A person decides every closure</h3><p>The checks only suggest. Services that look closed are hidden from the list until a person has checked them. Nobody is removed by a computer alone.</p></div>
<div class="how-card"><h3>Your privacy</h3><p>No account, no tracking. A postcode is only used to find your council area and work out distances; it is not stored. Display settings are saved on your own device.</p></div>
<div class="how-card"><h3>Spotted a mistake?</h3><p>Use "Report a problem" on any listing, and we will look at it.</p></div>
</div>
</section>
</main>
<a href="#top" id="to-top" class="to-top" hidden><span class="ic ic-up" aria-hidden="true"></span><span class="tt">Back to top</span></a>
<footer class="site-foot">
${wave('up')}
<div class="wrap">
<div class="foot-grid">
<div><div class="brand">${LOGO}<strong>Neuro Support Checker</strong></div><p class="tagline">Support for autism, ADHD, dyslexia and more, across the UK.</p></div>
<div><h2>About this site</h2><p>Prototype. Services that look closed are hidden until a person checks them. <a href="#how">How this works</a>.</p></div>
<div><h2>Sources</h2><p>Sources include the Charity Commission for England and Wales, the Charity Commission for Northern Ireland and the Scottish Charity Register: © Crown Copyright and database right ${new Date().getFullYear()}. Contains information from the Scottish Charity Register supplied by the Office of the Scottish Charity Regulator and licensed under the <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/">Open Government Licence v3.0</a>.</p></div>
</div>
<div class="foot-base"><span>Checked every 1 to 3 days. Last check: ${dateWords(state.updated)}.</span><a href="#top"><span class="ic ic-up" aria-hidden="true"></span>Back to top</a></div>
<p class="credit"><span class="credit-ask">Need a tool like this for your organisation?</span>© ${new Date().getFullYear()} · Designed and built by <a href="https://chrisdemetriou.com" rel="author">Chris Demetriou</a>. <a href="https://labs.chrisdemetriou.com/">See what else I've built<span aria-hidden="true">&nbsp;→</span></a></p>
</div>
</footer>
<script>
const q=document.getElementById('q');const items=[...document.querySelectorAll('#list .card')];
const countEl=document.getElementById('count'),empty=document.getElementById('empty');
// Paging: only the first PAGE matches show; "Show more" adds PAGE more. Filters reset it to the first page.
const PAGE=${PAGE};let limit=PAGE;const pager=document.getElementById('pager'),pageCount=document.getElementById('page-count'),moreBtn=document.getElementById('show-more');
const page=()=>{const kids=[...document.getElementById('list').children];let total=0;
for(const li of kids){if(li.classList.contains('group'))continue;if(li.hidden){li.classList.remove('paged');continue;}li.classList.toggle('paged',++total>limit);}
let head=null,vis=0,on=0;const done=()=>{if(head)head.classList.toggle('paged',vis>0&&!on);};for(const li of kids){if(li.classList.contains('group')){done();head=li;vis=on=0;}else if(!li.hidden){vis++;if(!li.classList.contains('paged'))on++;}}done();
pager.hidden=!total;pageCount.textContent='Showing '+Math.min(limit,total)+' of '+total;moreBtn.hidden=total<=limit;moreBtn.textContent='Show '+Math.min(PAGE,total-limit)+' more';};
moreBtn.addEventListener('click',()=>{const before=limit;limit+=PAGE;page();const vis=[...document.querySelectorAll('#list .card')].filter(li=>!li.hidden&&!li.classList.contains('paged'));const first=vis[before];if(first)first.querySelector('h2 a').focus();});
const icon=(k)=>{const s=document.createElement('span');s.className='ic ic-'+k;s.setAttribute('aria-hidden','true');return s;};
let aud='',cond='',showUnstated=false,generalFor='';
const more=document.getElementById('more');
let here=null;
const list=document.getElementById('list');const order=[...items];
const heading=()=>{const h=document.createElement('li');h.className='group';return h;};
const miles=(a,b)=>{const r=(d)=>d*Math.PI/180,h=Math.sin(r(b.lat-a.lat)/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(r(b.lon-a.lon)/2)**2;return 3958.8*2*Math.asin(Math.sqrt(h));};
const GROUPS=[['serving',()=>'Serves your area ('+here.district+')'],['wide',()=>'Works across '+here.country],['unknown',()=>'Area not recorded – may still serve you (nearest first)'],['other',()=>'Lists other areas – may not serve you (nearest first)']];
const heads=Object.fromEntries(GROUPS.map(([g])=>[g,heading()]));
// With a condition chosen: organisations for that condition first, then those for any neurodivergent condition, each under a heading.
const specHead=heading(),genHead=heading();const condName=()=>cond.charAt(0).toUpperCase()+cond.slice(1);
const specOf=(li)=>cond&&li.dataset.cond.split('|').includes(cond)?1:0;
const apply=()=>{const t=q.value.trim().toLowerCase();let unstated=0,generalHidden=0;const groups={serving:[],wide:[],unknown:[],other:[]};
for(const li of items){const a=li.dataset.aud;const textOk=!t||li.textContent.toLowerCase().includes(t);
const audOk=!aud||(a?a.split(' ').includes(aud):showUnstated);if(aud&&!a&&textOk&&!showUnstated)unstated++;const isSpec=!cond||li.dataset.cond.split('|').includes(cond);const condOk=isSpec||(li.dataset.general&&generalFor===cond);if(cond&&!isSpec&&li.dataset.general&&generalFor!==cond&&textOk&&audOk)generalHidden++;
const d=li.querySelector('.dist');d.hidden=true;let group=null;
if(here){const sv=(li.dataset.serves||'').split('|').filter(Boolean);const m=li.dataset.lat?miles(here,{lat:+li.dataset.lat,lon:+li.dataset.lon}):Infinity;li.dataset.m=m;
const far=m===Infinity?'':(m<1?'based less than 1 mile away':'based about '+Math.round(m)+(Math.round(m)===1?' mile':' miles')+' away');
if(li.dataset.cov!=='local'){const n=li.dataset.nations;group=!n||n.split('|').includes(here.country)?'wide':'other';}
else if(sv.some(k=>k===here.keys.district||(here.keys.county&&k===here.keys.county))){group='serving';d.textContent=(li.dataset.from==='office'?'Based in your area':'Serves your area, says the charity register')+(far?' · '+far:'');}
else if(!sv.length||li.dataset.from==='office'){group='unknown';d.textContent='Area not recorded'+(far?' · '+far:'');}
else{group='other';d.textContent='Lists other areas'+(far?' · '+far:'');}
d.hidden=group==='wide';}
li.hidden=!(textOk&&audOk&&condOk);if(here&&!li.hidden)groups[group].push(li);}
if(here){for(const g of ['serving','unknown','other'])groups[g].sort((x,y)=>(specOf(y)-specOf(x))||(x.dataset.m-y.dataset.m));groups.wide.sort((x,y)=>specOf(y)-specOf(x));
for(const [g,label] of GROUPS)heads[g].textContent=label()+' · '+groups[g].length;
list.replaceChildren(...GROUPS.flatMap(([g])=>groups[g].length?[heads[g],...groups[g]]:[]),...order.filter(li=>li.hidden));
nearMsg.hidden=false;nearMsg.textContent=groups.serving.length+' serve '+here.district+', '+groups.wide.length+' work across '+here.country+', '+groups.unknown.length+' have no recorded area, and '+groups.other.length+' list other areas.';}
else if(cond){const shownNow=order.filter(li=>!li.hidden),sp=shownNow.filter(specOf),ge=shownNow.filter(li=>!specOf(li));
specHead.textContent=sp.length?'For '+cond+' · '+sp.length:'Nothing listed just for '+cond+' yet';
genHead.textContent='For neurodivergent people in general (may help with '+cond+') · '+ge.length;
list.replaceChildren(specHead,...sp,...(ge.length?[genHead,...ge]:[]),...order.filter(li=>li.hidden));}
else if(specHead.isConnected||genHead.isConnected||Object.values(heads).some(h=>h.isConnected)){list.replaceChildren(...order);}
chipsUpdate(t);const mg=document.getElementById('more-general');mg.hidden=!generalHidden;if(generalHidden){mg.querySelector('span').textContent='';mg.querySelector('button').textContent='Also show '+generalHidden+(generalHidden===1?' organisation':' organisations')+' for neurodivergent people in general';}more.hidden=!unstated;more.querySelector('span').textContent=unstated+' more '+(unstated===1?'organisation does':'organisations do')+' not say who '+(unstated===1?'it is':'they are')+' for.';
const n=items.filter(li=>!li.hidden).length;countEl.textContent=n===items.length?n+' listed':n+' found';empty.hidden=n>0;limit=PAGE;page();};
more.querySelector('button').addEventListener('click',()=>{showUnstated=true;apply();});
document.querySelector('#more-general button').addEventListener('click',()=>{generalFor=cond;apply();});
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
const SYM={green:'✓',amber:'!',red:'!',none:'○'},WORD={green:'fine',amber:'in question',red:'serious',none:'not checked yet'};
const hue=(s)=>{s=Math.max(0,Math.min(100,s));return Math.round(s<=60?s/60*40:40+(s-60)/40*90);};
document.getElementById('check-form').addEventListener('submit',async(e)=>{e.preventDefault();
const u=document.getElementById('check-url').value.trim(),n=document.getElementById('check-num').value.trim();const go=document.getElementById('check-go');
checkOut.replaceChildren(mk('p','Checking '+u+'… this takes a few seconds.','hint'));go.disabled=true;
try{const r=await fetch('/api/check?url='+encodeURIComponent(u)+(n?'&number='+encodeURIComponent(n):''));const j=await r.json();if(!r.ok)throw new Error(j.error||'The check did not work. Please try again.');
const card=mk('div',null,'result '+j.verdict);const top=mk('div',null,'top');top.append(mk('h3',j.headline));
if(j.score!=null){const b=mk('span',String(j.score),'score');b.style.setProperty('--h',hue(j.score));b.style.setProperty('--s',j.score);b.append(mk('small','/100'));top.append(b);}card.append(top);
card.append(mk('p',(j.title?j.title+' · ':'')+(j.finalUrl||j.url),'meta'));
if(j.reasons&&j.reasons.length)card.append(mk('p',j.reasons.join('. ')+'.'));
const ul=mk('ul',null,'ticks');for(const s of j.signals){const li=mk('li');const t=mk('span',SYM[s.level],'tk '+s.level);t.setAttribute('aria-hidden','true');li.append(t,mk('strong',s.label),mk('span',' ('+WORD[s.level]+'): ','sr'),mk('span',s.detail));ul.append(li);}card.append(ul);
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
const AUD_LABEL=${JSON.stringify(AUDIENCE_LABEL)};
// Every active filter shows as a chip with ✕ above the results, plus "Clear all": nobody gets stuck in a filter.
function chipsUpdate(t){const box=document.getElementById('active'),chips=document.getElementById('chips');const list=[];
if(cond)list.push(['Support with: '+cond.charAt(0).toUpperCase()+cond.slice(1),()=>{cond='';apply();}]);
if(aud)list.push(['For: '+(AUD_LABEL[aud]||aud),()=>setAud('')]);
if(here)list.push(['Near: '+here.label,()=>clear.click()]);
if(t)list.push(['Search: "'+q.value.trim()+'"',()=>{q.value='';apply();}]);
chips.replaceChildren(...list.map(([label,fn])=>{const b=document.createElement('button');b.type='button';b.className='chip-x';b.setAttribute('aria-label','Remove filter: '+label);b.append(label+' ');const x=document.createElement('span');x.setAttribute('aria-hidden','true');x.textContent='✕';b.append(x);b.onclick=fn;return b;}));
box.hidden=!list.length;}
document.getElementById('clear-all').addEventListener('click',()=>{q.value='';start();});
const say=(who,text)=>{const p=document.createElement('p');p.className='bubble '+who;p.textContent=text;chat.append(p);};
const ask=(question,options)=>{say('bot',question);if(chat.children.length>2)options=[...options,['Start again',()=>start(),'restart']];choices.replaceChildren(...options.map(([label,fn,ic])=>{const b=document.createElement('button');b.type='button';b.textContent=label;if(ic)b.prepend(icon(ic));b.onclick=()=>{say('me',label);choices.replaceChildren();fn();};return b;}));};
const setAud=(a)=>{aud=a;showUnstated=false;for(const x of document.querySelectorAll('.aud button'))x.setAttribute('aria-pressed',String(x.dataset.a===a));apply();};
const show=()=>{apply();const n=items.filter(li=>!li.hidden).length;
const sp=cond?items.filter(li=>!li.hidden&&specOf(li)).length:0;
say('bot',!n&&!cond?'Nothing matches all of that yet. Try a wider distance, or "Anyone".':cond?(sp?'Here '+(sp===1?'is 1 organisation':'are '+sp+' organisations')+' for '+cond+'. They are listed below.':'Nothing is listed just for '+cond+' yet.')+' Organisations for neurodivergent people in general may also help: use the button above the list to show them.':'Here '+(n===1?'is 1 organisation':'are '+n+' organisations')+' that may help. They are listed below.');
const again=document.createElement('button');again.type='button';again.textContent='Start again';again.prepend(icon('restart'));again.onclick=start;choices.replaceChildren(again);
if(n)document.getElementById('list').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});};
const where=()=>ask('Where should it be?',[['Near a postcode',()=>{say('bot','Type your postcode in the "Near you" box below, then press Search. Nothing is hidden: the ones that serve your area come first.');near.hidden=false;document.getElementById('pc').focus();const again=document.createElement('button');again.type='button';again.textContent='Start again';again.prepend(icon('restart'));again.onclick=start;choices.replaceChildren(again);apply();},'pin'],['Anywhere in the UK',()=>{here=null;show();},'globe']]);
const forWho=()=>ask('Who is the support for?',[['A child or young person',()=>{setAud('children');where();}],['An adult',()=>{setAud('adults');where();}],['My family, or me as a carer',()=>{setAud('families');where();}],['Anyone',()=>{setAud('');where();}]]);
const start=()=>{chat.replaceChildren();cond='';setAud('');here=null;clear.hidden=true;nearMsg.hidden=true;apply();
ask('What would you like support with?',[...CONDS.map(c=>[c.charAt(0).toUpperCase()+c.slice(1),()=>{cond=c;apply();forWho();}]),['Not sure, or more than one',()=>{cond='';apply();forWho();}]]);};
start();
const ft=document.getElementById('finder-toggle'),fb=document.getElementById('finder-body'),wide=matchMedia('(min-width:1024px)');
const setFinder=(open)=>{ft.setAttribute('aria-expanded',String(open));fb.hidden=!open;};
setFinder(wide.matches);ft.addEventListener('click',()=>setFinder(fb.hidden));wide.addEventListener('change',(e)=>{if(e.matches)setFinder(true);});
const toTop=document.getElementById('to-top');const topCheck=()=>{toTop.hidden=scrollY<1200;};addEventListener('scroll',topCheck,{passive:true});topCheck();
document.getElementById('reset').addEventListener('click',()=>{q.value='';cond='';if(here)clear.click();setAud('');q.focus();});
q.addEventListener('input',apply);
for(const b of document.querySelectorAll('.aud button'))b.addEventListener('click',()=>{aud=b.dataset.a;showUnstated=false;for(const x of document.querySelectorAll('.aud button'))x.setAttribute('aria-pressed',String(x===b));apply();});
</script>
${DISPLAY_PANEL}
<script>${DISPLAY_JS}</script>
</body>
</html>
`;
}
