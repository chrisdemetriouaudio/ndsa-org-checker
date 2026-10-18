/**
 * Display settings ("Aa Display" at the top of every page): theme, text size, dyslexia-friendly font, wider spacing,
 * high contrast and a reading mask. The same tools, wording and behaviour as the Genesis app (genesis-auth
 * public/web/display.*), using this site's colours. Saved on this device only (localStorage "nsc-display").
 * Pure strings, shared by the public directory (src/render.ts) and the admin pages (worker/pages.ts).
 */

const KEY = 'nsc-display';

/*
 * Colour tokens per theme. "Calm teal and warm paper": deep teal for trust, a cream page, and sun, coral and mint as
 * friendly accent shapes (decoration only, never behind text). Every text pair meets WCAG 2.2 AA (4.5:1) and every
 * control edge 3:1 in all four themes. --sc-* are the saturation/lightness for the score colours, whose hue (--h) follows
 * the score: badge background, number and ring.
 */
export const LIGHT = 'color-scheme:light;--bg:#faf6ef;--card:#fff;--ink:#1c2b2a;--quiet:#556461;--line:#e6ded0;--edge:#7b8885;--accent:#0d6b66;--accent-ink:#fff;--note:#fff1d6;--tint:#fff1d6;--tint-2:#e3f1ec;--tag-bg:#e3f1ec;--tag-ink:#164a45;--hero:#12504c;--hero-ink:#fff8ec;--hero-quiet:#cfe5df;--coral:#e8805f;--sun:#f3c457;--mint:#8fd3c1;--track:#ece5d8;--green:#256b41;--amber:#8a5a00;--red:#b3261e;--green-bg:#e6f4ea;--amber-bg:#fff4d6;--red-bg:#fde7e5;--good:#256b41;--bad:#b3261e;--sc-bg:70% 92%;--sc-ink:75% 24%;--sc-ring:55% 35%';
export const DARK = 'color-scheme:dark;--bg:#111817;--card:#1a2321;--ink:#f1ede4;--quiet:#a8b4b0;--line:#2c3836;--edge:#74837f;--accent:#7dd3c6;--accent-ink:#0a2220;--note:#2a2619;--tint:#2a2619;--tint-2:#1f3632;--tag-bg:#1f3632;--tag-ink:#cdeee6;--hero:#0e3b38;--hero-ink:#fff8ec;--hero-quiet:#bfd9d2;--coral:#e8805f;--sun:#f3c457;--mint:#8fd3c1;--track:#2c3836;--green:#7fd19b;--amber:#f2c25b;--red:#f28b82;--green-bg:#183323;--amber-bg:#3a3120;--red-bg:#3d2220;--good:#7fd19b;--bad:#f28b82;--sc-bg:45% 20%;--sc-ink:70% 72%;--sc-ring:40% 55%';
const HC_DARK = 'color-scheme:dark;--bg:#000;--card:#000;--ink:#fff;--quiet:#fff;--line:#fff;--edge:#fff;--accent:#ffe14d;--accent-ink:#000;--note:#000;--tint:#000;--tint-2:#000;--tag-bg:#000;--tag-ink:#fff;--hero:#000;--hero-ink:#fff;--hero-quiet:#fff;--coral:#fff;--sun:#ffe14d;--mint:#fff;--track:#000;--green:#7dff9e;--amber:#ffe14d;--red:#ff8a80;--green-bg:#000;--amber-bg:#000;--red-bg:#000;--good:#7dff9e;--bad:#ff8a80;--sc-bg:0% 0%;--sc-ink:0% 100%;--sc-ring:0% 100%';
const HC_LIGHT = 'color-scheme:light;--bg:#fff;--card:#fff;--ink:#000;--quiet:#000;--line:#000;--edge:#000;--accent:#0033cc;--accent-ink:#fff;--note:#fff;--tint:#fff;--tint-2:#fff;--tag-bg:#fff;--tag-ink:#000;--hero:#fff;--hero-ink:#000;--hero-quiet:#000;--coral:#000;--sun:#0033cc;--mint:#000;--track:#fff;--green:#00561f;--amber:#7a4a00;--red:#a40000;--green-bg:#fff;--amber-bg:#fff;--red-bg:#fff;--good:#00561f;--bad:#a40000;--sc-bg:0% 100%;--sc-ink:0% 0%;--sc-ring:0% 0%';

/** Nunito everywhere (rounded, warm and very readable; 39 KB variable font, SIL Open Font License, site/fonts/). */
const FONTS = '--body-font:"Nunito",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;--display:"Nunito",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--tight:-.015em';

/** The base theme for both pages: follows the device until the Display panel picks one. Goes before displayCss(). */
export const THEME_CSS = `:root{${FONTS};${LIGHT}}@media (prefers-color-scheme:dark){:root{${DARK}}}
.score{--h:0;background:hsl(var(--h) var(--sc-bg));color:hsl(var(--h) var(--sc-ink))}`;

/** `fonts` is where the OpenDyslexic files are served: "/fonts/" on the Worker, "fonts/" next to a static copy. */
export function displayCss(fonts: string): string {
  return `
@font-face{font-family:"Nunito";src:url("${fonts}Nunito-latin.woff2") format("woff2");font-weight:400 800;font-style:normal;font-display:swap}
@font-face{font-family:"OpenDyslexic";src:url("${fonts}OpenDyslexic-Regular.otf") format("opentype");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"OpenDyslexic";src:url("${fonts}OpenDyslexic-Bold.otf") format("opentype");font-weight:500 800;font-style:normal;font-display:swap}
:root[data-theme="light"]{${LIGHT}}
:root[data-theme="dark"]{${DARK}}
/* Text size: bigger letters that re-wrap at any width (both pages set body text at 18px). */
:root[data-text="large"]{font-size:115%}:root[data-text="large"] body{font-size:20.5px}:root[data-text="xlarge"]{font-size:130%}:root[data-text="xlarge"] body{font-size:23.5px}
:root[data-text] input,:root[data-text] select,:root[data-text] textarea,:root[data-text] button{max-width:100%}
:root[data-text] #list{grid-template-columns:minmax(0,1fr)}:root[data-text] .card,:root[data-text] .result,:root[data-font] .card,:root[data-spacing] .card{overflow-wrap:anywhere;min-width:0}
:root[data-font="dyslexic"] body,:root[data-font="dyslexic"] button,:root[data-font="dyslexic"] input,:root[data-font="dyslexic"] select,:root[data-font="dyslexic"] textarea{font-family:"OpenDyslexic",system-ui,sans-serif}
:root[data-font="dyslexic"]{--display:"OpenDyslexic",system-ui,sans-serif;--body-font:"OpenDyslexic",system-ui,sans-serif;--tight:0}
:root[data-font="dyslexic"] h1,:root[data-font="dyslexic"] h2,:root[data-font="dyslexic"] h3{letter-spacing:0;line-height:1.3}
:root[data-spacing="wide"] body{line-height:1.9;letter-spacing:.06em;word-spacing:.16em}:root[data-spacing="wide"]{--tight:.04em}:root[data-spacing="wide"] p{margin-bottom:1.5em}
:root[data-contrast="high"]{${HC_DARK}}:root[data-contrast="high"][data-theme="light"]{${HC_LIGHT}}
@media (prefers-color-scheme:light){:root[data-contrast="high"]:not([data-theme="dark"]){${HC_LIGHT}}}
:root[data-contrast="high"] .card,:root[data-contrast="high"] .checker,:root[data-contrast="high"] .result,:root[data-contrast="high"] .table-wrap,:root[data-contrast="high"] .prefs-panel,:root[data-contrast="high"] input,:root[data-contrast="high"] select,:root[data-contrast="high"] textarea{border:2px solid var(--ink)!important;box-shadow:none!important}
:root[data-contrast="high"] .score{background:var(--bg)!important;color:var(--ink)!important;outline:2px solid var(--ink)}
:root[data-contrast="high"] .deco{display:none}
.logo{width:42px;height:42px;flex:none}.logo-bg{fill:var(--sun)}.logo-fold{stroke:#12504c}.logo-dot{fill:var(--mint)}.logo-tick{stroke:#12504c}
:root[data-contrast="high"] .logo-bg{fill:var(--bg);stroke:var(--ink);stroke-width:5}:root[data-contrast="high"] .logo-fold{stroke:var(--ink)}:root[data-contrast="high"] .logo-tick{stroke:var(--bg)}:root[data-contrast="high"] .logo-dot{fill:var(--ink)}
:root[data-contrast="high"] a{text-decoration:underline;text-decoration-thickness:2px}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.prefs-toggle{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:4px 16px;font:600 .95rem var(--body-font);color:var(--ink);cursor:pointer;background:var(--card);border:1.5px solid var(--edge);border-radius:99px}
.prefs-toggle:hover{border-color:var(--ink)}.prefs-toggle[aria-expanded="true"]{border-color:var(--accent)}
.prefs-toggle svg{width:19px;height:19px;flex:none}
.prefs-panel{position:fixed;z-index:80;left:max(8px,calc(50% - 230px));right:max(8px,calc(50% - 230px));top:64px;max-height:calc(100dvh - 80px);overflow-y:auto;overscroll-behavior:contain;background:var(--card);color:var(--ink);border:1px solid var(--line);border-top:6px solid var(--accent);border-radius:20px;box-shadow:0 30px 70px -20px rgba(0,0,0,.6);padding:16px 16px 18px;font-size:16px;line-height:1.5}
.prefs-panel[hidden]{display:none}
.prefs-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
.prefs-head h2{font-family:var(--display);font-size:1.2rem;margin:0;padding:0;border:0}.prefs-head h2:focus{outline:none}
.prefs-close{font:600 .9rem var(--body-font);cursor:pointer;color:var(--ink);background:transparent;border:1.5px solid var(--edge);border-radius:99px;min-height:44px;padding:4px 16px}
.prefs-group{border:0;padding:0;margin:0 0 14px;min-width:0}.prefs-group legend{font-weight:650;padding:0;margin-bottom:6px;font-size:.9rem}
.segmented{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:4px;background:var(--bg);padding:4px;border-radius:99px}
.segmented input{position:absolute;opacity:0;width:1px;height:1px}
.segmented label{margin:0;text-align:center;font-weight:600;font-size:.9rem;cursor:pointer;padding:6px 4px;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:99px;border:2px solid transparent;color:var(--ink)}
.segmented input:checked+label{background:var(--card);border-color:var(--accent)}
.segmented input:focus-visible+label{outline:2px solid var(--accent);outline-offset:2px}
.segmented .size-2{font-size:1rem}.segmented .size-3{font-size:1.2rem}
.switches{list-style:none;padding:0;margin:0 0 14px}.switches li{margin:0;border-top:1px solid var(--line)}.switches li:last-child{border-bottom:1px solid var(--line)}
.switch{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;margin:0;cursor:pointer;font-weight:600;font-size:.9rem}
.switch small{display:block;font-weight:400;color:var(--quiet);font-size:.8rem;margin-top:2px}
.switch input{appearance:none;-webkit-appearance:none;flex:none;margin:0;cursor:pointer;width:50px;height:29px;border-radius:99px;background:var(--edge);position:relative;border:0;padding:0}
.switch input::after{content:"";position:absolute;top:3px;left:3px;width:23px;height:23px;border-radius:50%;background:var(--card);transition:transform .15s}
.switch input:checked{background:var(--accent)}.switch input:checked::after{transform:translateX(21px)}
.prefs-foot{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.prefs-foot p{margin:0;font-size:.8rem;color:var(--quiet)}
.prefs-reset{font:600 .9rem var(--body-font);color:var(--accent);background:none;border:0;padding:6px 0;min-height:44px;cursor:pointer;text-decoration:underline;text-underline-offset:.18em}
@media (prefers-reduced-motion:reduce){.switch input::after{transition:none}}
.reading-mask{position:fixed;left:0;right:0;z-index:70;pointer-events:none;background:rgba(5,10,25,.62)}
.reading-mask--top{top:0;height:40vh}.reading-mask--bottom{bottom:0;height:40vh}.reading-mask[hidden]{display:none}`;
}

const ICON_PATHS: Record<string, string> = {
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c.6-3.3 2.8-5.2 5.5-5.2s4.9 1.9 5.5 5.2M15.6 5.1a3.1 3.1 0 010 5.8M17.6 14.6c1.7.7 2.7 2.3 3 4.9"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0113 0C18.5 14.8 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  restart: '<path d="M4.5 13a7.5 7.5 0 102.2-6.3"/><path d="M4.5 4.5v4.8h4.8"/>',
  building: '<path d="M4 21V9l8-5.5L20 9v12M3 21h18"/><path d="M9.5 21v-5.5h5V21"/>',
  flag: '<path d="M5.5 21V4M5.5 4.5h11l-2.2 4 2.2 4h-11"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>',
  nomatch: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M8.3 8.3l4.4 4.4M12.7 8.3l-4.4 4.4"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
};
const iconUrl = (inner: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round'>${inner.replace(/"/g, "'")}</svg>`)}")`;
/**
 * One line-icon set for both pages, drawn once in CSS as masks (so 900 cards carry no icon markup): an element with
 * class "ic ic-users" shows that icon in the text colour. Icons are always next to words that say the same thing.
 */
export const ICON_CSS = `:root{${Object.entries(ICON_PATHS).map(([k, v]) => `--ic-${k}:${iconUrl(v)}`).join(';')}}
${Object.keys(ICON_PATHS).map((k) => `.ic-${k}{--i:var(--ic-${k})}`).join('')}
.ic{display:inline-block;flex:none;width:1.15em;height:1.15em;vertical-align:-.2em;background:currentColor;-webkit-mask:var(--i) center/contain no-repeat;mask:var(--i) center/contain no-repeat}
@media (forced-colors:active){.ic{forced-color-adjust:none;background:CanvasText}}`;

/** The site's mark: a tick on a sun-yellow tile, with a coral dot. Decoration only (the name is always next to it). */
/** The brain mark (a 100×84 drawing): a rounded yellow brain with deep-green folds. Used by the logo, the hero and the finder's avatar. */
export const BRAIN_PATH = 'M30 74C18 74 10 66 10 56C4 52 2 44 6 37C3 28 9 18 19 16C22 8 32 4 41 7C47 2 57 2 63 7C72 4 82 9 85 18C94 21 98 31 95 40C99 48 96 58 88 62C87 71 78 77 69 75C64 81 54 82 48 77C42 80 34 79 30 74Z';
export const BRAIN_FOLDS = 'M50 10C46 20 54 28 49 38C45 46 52 54 48 64M21 30C29 28 34 34 32 42M71 21C66 29 74 34 70 42M17 56C25 52 31 56 33 62M82 51C74 50 67 55 67 63';
export const LOGO = `<svg class="logo" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><g transform="translate(0 3) scale(.37)"><path class="logo-bg" d="${BRAIN_PATH}"/><path class="logo-fold" d="${BRAIN_FOLDS}" fill="none" stroke-width="7" stroke-linecap="round"/></g><circle class="logo-dot" cx="31.5" cy="31" r="8"/><path class="logo-tick" d="M27.5 31l2.8 2.8 5-5.6" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** In <head>: applies the saved settings before the page draws, so there is no flash of the wrong look. */
export const DISPLAY_HEAD_JS = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})||"{}")||{};var r=document.documentElement;["theme","text","font","spacing","contrast"].forEach(function(k){if(typeof p[k]==="string"&&/^[a-z]+$/.test(p[k]))r.setAttribute("data-"+k,p[k]);});}catch(e){}})();`;

/** The "Aa Display" button, for the page's top bar. */
export const DISPLAY_TOGGLE = `<button type="button" class="prefs-toggle" id="prefsToggle" aria-label="Display settings" title="Display settings" aria-expanded="false" aria-controls="prefsPanel"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 18L8.2 5h1.6L15 18M5 14h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 11.5c.6-.9 1.5-1.4 2.6-1.4 1.6 0 2.4 1 2.4 2.5V18m0-3.5c-.8-.4-1.6-.5-2.5-.5-1.5 0-2.5.8-2.5 2s.9 2 2.2 2c1.3 0 2.3-.8 2.8-1.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Display</span></button>`;

/** The settings panel, placed once per page (end of <body>). */
export const DISPLAY_PANEL = `<div class="prefs-panel" id="prefsPanel" role="dialog" aria-modal="false" aria-labelledby="prefsHeading" hidden>
<div class="prefs-head"><h2 id="prefsHeading" tabindex="-1">Display settings</h2><button type="button" class="prefs-close">Close</button></div>
<fieldset class="prefs-group"><legend>Theme</legend><div class="segmented"><input type="radio" name="theme" id="prefThemeLight" value="light"><label for="prefThemeLight">Light</label><input type="radio" name="theme" id="prefThemeDark" value="dark"><label for="prefThemeDark">Dark</label><input type="radio" name="theme" id="prefThemeAuto" value="auto"><label for="prefThemeAuto">Match device</label></div></fieldset>
<fieldset class="prefs-group"><legend>Text size</legend><div class="segmented"><input type="radio" name="text" id="prefTextNormal" value="normal"><label for="prefTextNormal">Normal</label><input type="radio" name="text" id="prefTextLarge" value="large"><label for="prefTextLarge" class="size-2">Large</label><input type="radio" name="text" id="prefTextXlarge" value="xlarge"><label for="prefTextXlarge" class="size-3">Larger</label></div></fieldset>
<ul class="switches">
<li><label class="switch" for="prefFont"><span>Dyslexia-friendly font<small>OpenDyslexic: heavier letter bottoms help stop letters flipping</small></span><input type="checkbox" role="switch" name="font" id="prefFont" value="dyslexic"></label></li>
<li><label class="switch" for="prefSpacing"><span>Wider spacing<small>More space between letters, words and lines</small></span><input type="checkbox" role="switch" name="spacing" id="prefSpacing" value="wide"></label></li>
<li><label class="switch" for="prefContrast"><span>High contrast<small>Black and white with strong outlines</small></span><input type="checkbox" role="switch" name="contrast" id="prefContrast" value="high"></label></li>
<li><label class="switch" for="prefMask"><span>Reading mask<small>Dims the page except a strip that follows your finger or mouse</small></span><input type="checkbox" role="switch" name="mask" id="prefMask" value="on"></label></li>
</ul>
<div class="prefs-foot"><p>Saved on this device only.</p><button type="button" class="prefs-reset">Reset all</button></div>
</div>`;

/** Panel behaviour (a port of Genesis's display.js). Default theme here is "Match device". */
export const DISPLAY_JS = `(function(){
var KEY=${JSON.stringify(KEY)},DEFAULTS={theme:"auto",text:"normal",font:"default",spacing:"normal",contrast:"normal",mask:"off"},ATTRS=["theme","text","font","spacing","contrast"];
var root=document.documentElement,toggle=document.getElementById("prefsToggle"),panel=document.getElementById("prefsPanel");
if(!toggle||!panel)return;
var top=null,bottom=null,maskOn=false;
function strip(c){var d=document.createElement("div");d.className="reading-mask "+c;d.setAttribute("aria-hidden","true");document.body.appendChild(d);return d;}
function place(y){var h=Math.max(44,Math.round(window.innerHeight*.07));top.style.height=Math.max(0,y-h)+"px";bottom.style.height=Math.max(0,window.innerHeight-y-h)+"px";}
function move(e){var p=e.touches&&e.touches.length?e.touches[0]:e;if(typeof p.clientY==="number")place(p.clientY);}
function setMask(on){if(on===maskOn)return;maskOn=on;if(on){if(!top){top=strip("reading-mask--top");bottom=strip("reading-mask--bottom");}top.hidden=bottom.hidden=false;place(window.innerHeight/2);window.addEventListener("pointermove",move,{passive:true});window.addEventListener("touchstart",move,{passive:true});window.addEventListener("touchmove",move,{passive:true});}else if(top){top.hidden=bottom.hidden=true;window.removeEventListener("pointermove",move);window.removeEventListener("touchstart",move);window.removeEventListener("touchmove",move);}}
var prefs={};try{prefs=JSON.parse(localStorage.getItem(KEY)||"{}")||{};}catch(e){prefs={};}
function save(){try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch(e){}}
function apply(){ATTRS.forEach(function(k){var v=prefs[k];if(v&&v!==DEFAULTS[k])root.setAttribute("data-"+k,v);else root.removeAttribute("data-"+k);});setMask(prefs.mask==="on");}
function sync(){panel.querySelectorAll("input[type=radio]").forEach(function(i){i.checked=(prefs[i.name]||DEFAULTS[i.name])===i.value;});panel.querySelectorAll("input[type=checkbox]").forEach(function(i){i.checked=prefs[i.name]===i.value;});}
function open(){panel.hidden=false;toggle.setAttribute("aria-expanded","true");panel.querySelector("h2").focus();}
function close(back){panel.hidden=true;toggle.setAttribute("aria-expanded","false");if(back)toggle.focus();}
panel.addEventListener("change",function(e){var i=e.target;if(i.type==="radio")prefs[i.name]=i.value;else if(i.type==="checkbox")prefs[i.name]=i.checked?i.value:DEFAULTS[i.name];apply();save();});
toggle.addEventListener("click",function(){if(panel.hidden)open();else close(false);});
panel.querySelector(".prefs-close").addEventListener("click",function(){close(true);});
panel.querySelector(".prefs-reset").addEventListener("click",function(){prefs={};save();apply();sync();});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!panel.hidden)close(true);});
document.addEventListener("click",function(e){if(!panel.hidden&&!panel.contains(e.target)&&!toggle.contains(e.target))close(false);});
sync();apply();
})();`;
