---
title: Changelog
updated: 2026-10-17
---

# 📜 Changelog

> [!info] At a glance
> **What:** everything that went live, newest first.
> **How to read:** tap a date to open it. Only the newest is open.
> **Back to:** [[00 Dashboard]]

> [!success]+ 🚀 18 Oct 2026 · Near you, who for, and a gentler daily run · live
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
> - **Directory:** now also at ndsa.labs.chrisdemetriou.com (public).
> - **Admin page:** ndsa.labs.chrisdemetriou.com/admin. E-mail on the admin list, then a passkey.
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
> - **Repo:** github.com/chrisdemetriouaudio/ndsa-org-checker (public).
> - **Daily check:** GitHub Actions, about 7am, free. Rewrites [[Live status]] and the Dashboard's Live box.
> - **Public directory:** chrisdemetriouaudio.github.io/ndsa-org-checker (GitHub Pages, free).
> - **Alerts:** new flags are posted to the "Services to review" GitHub issue.
> - **First run:** 40 look active, 4 need a check (moved or renamed).
