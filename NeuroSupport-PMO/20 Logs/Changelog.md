---
title: Changelog
updated: 2026-10-18
---

# 📜 Changelog

> [!info] At a glance
> **What:** everything that went live, newest first.
> **How to read:** tap a date to open it. Only the newest is open.
> **Back to:** [[00 Dashboard]]

> [!success]+ 🚀 18 Oct 2026 · Filters you can always undo · live
> - **"Showing:" bar** above the results: every active filter (condition, who for, near, search) as a chip with ✕, plus **Clear all**. It stays in view as you scroll.
> - **"Start again"** at every step of the finder, not just the end.
> - **Fixed:** after tapping a condition there was no way to see or undo it.

> [!success]- 🚀 18 Oct 2026 · Display settings (as in Genesis) · live
> - **"Aa Display"** at the top of the directory and every admin page: theme, text size, dyslexia-friendly font (OpenDyslexic), wider spacing, high contrast, reading mask.
> - **Same tools and wording as the Genesis app.** Saved on this device only. Escape closes it; focus returns to the button.
> - **Text size re-wraps** instead of zooming, so nothing runs off a phone screen.
> - **Admin sign in** moved to the top, as a visible button (it was default blue on dark).
> - **Admin page without the GitHub key** shows the list read-only with a plain note, instead of an error.

> [!success]- 🚀 18 Oct 2026 · All three registers in the score; tidy-up · live
> - **Scotland and Northern Ireland** now feed the "Charity register" tick: 104 organisations got their numbers (101 green, 3 overdue accounts).
> - **Fixed:** three runs in one day counted as three days of a website not answering. 82 candidates put back.
> - **Old address bridged:** ndsa.labs runs today's code with its own keys until the keys move.
> - **Data:** Autism Hampshire's base, and who Autistica, Autistic UK and Neurodivergence Wales are for.
> - **Wording:** the project describes its real scope (18 conditions), not "neurodivergent".

> [!success]- 🚀 18 Oct 2026 · Removing works first time · live
> - **Fixed:** removing an organisation looked like it did nothing the first time. It had saved, but the page showed GitHub's older copy for a few seconds.
> - **Now:** the page reads the exact version just saved, and says "Removed ✓" straight away. Same for restore, "still running" and editing details.
> - **Also:** a second change straight after the first no longer trips over the delay (tries up to 3 times).

> [!success]- 🚀 18 Oct 2026 · New organisations decided without you · live
> - **Turned away 5** care, housing and care-provider bodies that were waiting (L'Arche, Langdon Housing, Avenues London, Hansel Foundation, ARC).
> - **Register tie-breaker:** when the words leave it unclear, the register's own tick-boxes decide. Advice or advocacy tips it in; grants, housing or research only tip it out.
> - **7-day deadline:** anything still unclear a week after it was found is parked, never added.
> - **Dashboard line** each morning: added, turned away, parked. The daily alert no longer asks you to review.
> - **Directory wording:** "1 more check coming" now says "Confirmed by them: not asked yet" (that check is Phase 4, not built).
> - **Gentler:** a website is never visited twice in one day, even if the run is started again by hand.
> - **Register downloads retry** up to 3 times. Fixed: Northern Ireland's file failed once on 18 Oct 2026 (a passing DNS fault); yesterday's list was kept.

> [!success]- 🚀 18 Oct 2026 · Admin table: frozen column titles · live
> - **Column titles stay in view** while you scroll the organisations.
> - **Each tick has its own titled column** (Web address, Website answers, and so on).
> - **Organisation names stay pinned** on the left when you swipe sideways on a phone.
> - **Wider table** on big screens, so rows are half as tall.

> [!success]- 🚀 18 Oct 2026 · Checker reads the live charity register · live
> - **Live register (England and Wales):** today's record instead of this morning's download. Key added and tested.
> - **Says why:** the reason a charity was removed, e.g. "ceased to exist" or "merged".
> - **New warning:** an interim manager put in by the Charity Commission shows amber.
> - **Grant-makers:** says when a charity mainly gives grants rather than running services.
> - **Full record in one call** (GetAllCharityDetailsV2): what it does (e.g. "Provides services"), where it works (council areas or region), other names.
> - **Name search:** if the register does not list the website, it looks for the exact name. A name match never proves a closure.
> - **If the API is down:** works as before, from the morning's files.

> [!success]- 🚀 18 Oct 2026 · 830 organisations added; Near you by council area · live
> - **Directory:** 869 organisations (was 41). Each card says who it serves.
> - **Automatic triage:** clear ones added (website checked), clear misfits turned down with reasons, 222 unclear ones wait.
> - **Near you:** finds who serves your council area, then who is based nearby, then nationwide ones.
> - **Faster admin page:** reads a 198 KB summary instead of the full history.

> [!success]- 🚀 18 Oct 2026 · Button finder · live
> - **"Not sure where to start?"** 3 questions with buttons: what for, who for, where. No typing except an optional postcode.
> - **Uses the same filters** as the rest of the page; the list updates after each answer.

> [!success]- 🚀 18 Oct 2026 · Near you, who for, and a gentler daily run · live
> - **Near you:** postcode + 5 to 100 miles; nearest first; nationwide ones under "Also covering your area".
> - **Who is it for?** Children and young people · Adults · Families and carers.
> - **One morning run:** finds new organisations, refreshes the register, checks websites. Each register file is downloaded once.
> - **Gentle on websites:** one visit per site, robots.txt weekly, "has it changed?", healthy ones every 3 days.
> - **Daily discovery:** clear new organisations are added automatically (max 20 a day). The rest wait, marked NEW.
> - **Fixed:** a merge left broken text in a data file for a few minutes on 17 Oct 2026; restored the same night.

> [!success]- 🚀 17 Oct 2026 · Finding organisations, stage 1 · live
> - **Found:** 2,052 candidates from the charity registers of all 4 nations (England 1,532 · Wales 303 · Scotland 408 · Northern Ireland 139).
> - **Conditions:** the 18 in scope, matched on exact phrases. 455 are named for a condition.
> - **Review:** Admin → Review candidates. Add (checked straight away) or mark not relevant.
> - **Runs weekly.** Counts in [[Candidates]].

> [!success]- 🚀 17 Oct 2026 · Passkey sign-in loop fixed · live
> - **Problem:** after an e-mailed link, people who already had a passkey were asked to add one again; the device refused ("invalid state").
> - **Fix:** if you already have a passkey, the page offers **Use my passkey** first. Adding one for a new device is the second option.
> - **For everyone on the admin list.** Tested both cases with a throwaway account (since removed).

> [!success]- 🚀 17 Oct 2026 · Approved admin list · live
> - **Who can sign in:** Chris and Wade only. Everyone else gets nothing.
> - **Never-email admins:** the system will not e-mail Wade, even if someone types his address. Tested.
> - **Hand-delivered links:** `npm run admin -- link` makes a single-use link for you to pass on yourself.

> [!success]- 🚀 17 Oct 2026 · Admin front door · live
> - **Directory:** now also at neurosupport.labs.chrisdemetriou.com (public).
> - **Admin page:** neurosupport.labs.chrisdemetriou.com/admin. E-mail on the admin list, then a passkey.
> - **Admins can:** add one or several organisations, remove (archive), restore, and clear flags.
> - **Instant check:** new entries are checked straight away, not the next morning.
> - **Also:** score colours follow the score like a temperature.
> - **Waiting for:** admin e-mail addresses, a Resend key and a GitHub token.

> [!success]- 🚀 17 Oct 2026 · 2 organisations closed · live
> - **Closed by Chris:** Autism Alliance UK and Dyslexia Action. Both were removed from the charity register.
> - **Archived, not deleted:** they sit in the Closed box in [[Live status]] and are hidden from the directory.
> - **Left flagged on purpose:** ADHD Foundation (in administration) and Dyspraxia Foundation (insolvent).

> [!success]- 🚀 17 Oct 2026 · Charity register connected · live
> - **Source:** the Charity Commission's free daily register download. No API key.
> - **Matched:** 34 of 44 organisations to their charity numbers.
> - **Proven closed (removed from the register):** Autism Alliance UK (5 Jul 2023), Dyslexia Action (16 Aug 2023).
> - **Likely closed:** ADHD Foundation (in administration), Dyspraxia Foundation (insolvent).
> - **Scores:** proven closed scores 0. Insolvent or in administration scores 40 at most.

> [!success]- 🚀 17 Oct 2026 · Ticks and a score for every organisation · live
> - **7 categories per organisation:** ✅ fine · 🟡 in question · 🔴 serious · ⚪ not checked yet.
> - **Score out of 100:** how sure we are it is still running. Shown in [[Live status]] and on the public directory.
> - **Proof versus evidence:** website checks are evidence. Closure is "proven" only by an official record, the organisation or a person.
> - **Lowest scores first** in [[Live status]], so problems are easy to spot.

> [!success]- 🚀 17 Oct 2026 · 4 moved organisations updated · live
> - **Neuroinclusive Education Network:** was Autism Education Trust. Now nen.org.uk.
> - **Neurodivergence Wales:** was Autism Wales. Now neurodivergencewales.org.
> - **Autism Central:** now autismcentral.nhs.uk.
> - **Neurodiversity in Business:** now neurodiversity.org.
> - **Result:** 0 to review. All 44 look fine. The "Services to review" issue is closed.

> [!success]- 🚀 17 Oct 2026 · Prototype live · daily checks of 44 organisations
> - **Repo:** github.com/chrisdemetriouaudio/neuro-support-checker (public).
> - **Daily check:** GitHub Actions, about 7am, free. Rewrites [[Live status]] and the Dashboard's Live box.
> - **Public directory:** chrisdemetriouaudio.github.io/neuro-support-checker (GitHub Pages, free).
> - **Alerts:** new flags are posted to the "Services to review" GitHub issue.
> - **First run:** 40 look active, 4 need a check (moved or renamed).
