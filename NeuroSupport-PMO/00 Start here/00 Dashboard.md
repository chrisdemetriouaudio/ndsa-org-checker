---
title: Dashboard
updated: 2026-10-18
---

# 🎛️ Dashboard

> [!info] At a glance
> **What:** daily checks that UK support organisations for autism, ADHD, dyslexia, learning disability, Down syndrome, brain injury and related conditions are still running.
> **Status:** ✅ Working prototype. 901 organisations checked every morning; new ones found and decided automatically. Free tools only.
> **Admin page:** for now, sign in at ndsa.labs.chrisdemetriou.com/admin (your passkey is there). It moves to neurosupport.labs.chrisdemetriou.com/admin once 2 keys move (below).
> **Rule:** checks suggest a status. A person decides every closure.
> New here? Read [[How this vault works]] (1 minute).

<!-- live:start -->
> [!info] Live (updated by the daily check)
> **Last check:** 21 Oct 2026.
> **To review:** 11. See [[Live status]].
> **Fine:** 891 · **Closed:** 4 · **Average score:** 98 out of 100
<!-- live:end -->

<!-- candidates:start -->
> [!info] New organisations (decided automatically every morning)
> **21 Oct 2026:** added 0 · turned away 0 · parked 0.
> **Still settling:** 11 (websites being retried, or found in the last 7 days) · **Parked in total:** 184. Nothing here needs you.
<!-- candidates:end -->

## 👉 Your actions

- [ ] **Deploy the Worker** so admin pages show the new footer: `npm run worker:deploy`.
- [ ] **Move 2 keys to the new site** (about 10 minutes). Steps: [[Phase 6 — Admin Front Door]].
- [ ] **Give Wade his sign-in link yourself** when ready: `npm run admin -- link` with his address. The system never e-mails him.
- [ ] **Share the plan with Wade:** Share menu on the plan doc (link below).

## 🛠️ For Claude

- [ ] **After the keys move:** check sign-in on the new site, then send the old address to the new one.
- [ ] **Then, with your OK:** delete the old Worker and its database.

## ⏳ Waiting

- ⏳ **Wade's thoughts on the plan** and its assumptions.

## 💭 Optional

- 💭 **Decide on Phase 4:** e-mail each organisation twice a year to confirm it is still running? It would fill the last tick. See [[Phase 4 — Verification Emails & Reports]].
- 💭 **Decide on Phase 5:** a pilot with a partner charity (Wade's call).

More ideas: [[Backlog & Parked]].

## ✅ Done

> [!success]- Finished (tap to open)
> - [x] **ADHD Foundation and Dyspraxia Foundation removed** by you (18 Oct 2026).
> - [x] **All three UK registers in the daily score:** Scotland and Northern Ireland too (18 Oct 2026).
> - [x] **Removing works first time** on both the old and new admin pages (18 Oct 2026).
> - [x] **Tried the button finder, "Near you" and "Who is it for?"** (you, 18 Oct 2026).
> - [x] **Watching the repo on GitHub** for flag alerts (you, 18 Oct 2026).
> - [x] **Unclear candidates decided automatically:** register tie-breaker, parked after 7 days. Nothing waits on you (18 Oct 2026).
> - [x] **Checker reads the live Charity Commission register** (key added and tested, 18 Oct 2026).
> - [x] **Scottish and Northern Ireland registers** used by the checker and the daily search (18 Oct 2026).
> - [x] **830 organisations added automatically, 682 turned down with reasons** (18 Oct 2026).
> - [x] **Near you finds who serves your council area,** not just who is based nearby (18 Oct 2026).
> - [x] **Button finder** on the directory (18 Oct 2026).
> - [x] **Near you + Who is it for?** filters on the directory (18 Oct 2026).
> - [x] **One gentle morning run:** find, refresh, check; healthy sites every 3 days (18 Oct 2026).
> - [x] **Daily discovery:** clear new ones added automatically (max 20 a day); the rest marked NEW (18 Oct 2026).
> - [x] **Discovery stage 1:** 2,052 candidates from all 4 nations' charity registers (17 Oct 2026).
> - [x] **Keys added and first passkey sign-in done** (17 Oct 2026).
> - [x] **Approved admin list set up:** Chris, and Wade (never e-mailed) (17 Oct 2026).
> - [x] **Admin front door built and live** at neurosupport.labs.chrisdemetriou.com (17 Oct 2026).
> - [x] **Score colours follow the score** like a temperature (17 Oct 2026).
> - [x] **Closed Autism Alliance UK and Dyslexia Action:** both removed from the register (17 Oct 2026).
> - [x] **Charity register connected:** free daily download, no API key (17 Oct 2026).
> - [x] **Updated the 4 moved organisations** to their new names and addresses (17 Oct 2026).
> - [x] **Opened the vault in Obsidian** and allowed the Git plugin (17 Oct 2026).

## 🚦 Phases

| Phase | What | Status |
| --- | --- | --- |
| [[Phase 1 — Seed List]] | 44 hand-picked organisations to start with | ✅ Done |
| [[Phase 2 — Website & Register Checks]] | Daily website and charity register checks | ✅ Live (England and Wales register) |
| [[Phase 3 — AI Reading & Review Page]] | AI reads each homepage; one-click review | 💭 Later |
| [[Phase 4 — Verification Emails & Reports]] | Twice-yearly emails; "report a problem" | 💭 Later (report link done) |
| [[Phase 5 — Pilot]] | Larger list with a partner charity | 💭 Later |
| [[Phase 6 — Admin Front Door]] | Passkey admin page: add, remove, review | ✅ Live (Chris signed in) |
| [[Phase 7 — Finding Organisations]] | Find organisations in all 4 nations | 🛠️ Stage 1 live, runs daily |
| [[Phase 8 — Finding Support Easily]] | Who for, near you, button finder | ✅ Live |

## 🔗 Links

- **Live status (updates itself):** [[Live status]]
- **Public directory:** https://neurosupport.labs.chrisdemetriou.com (also https://chrisdemetriouaudio.github.io/neuro-support-checker/)
- **Admin page:** https://neurosupport.labs.chrisdemetriou.com/admin
- **Code:** https://github.com/chrisdemetriouaudio/neuro-support-checker (local: `/Volumes/01 PROJECTS/Claude/neuro-support-checker`)
- **Daily check runs:** https://github.com/chrisdemetriouaudio/neuro-support-checker/actions
- **Flag alerts:** the "Services to review" issue on GitHub. Watch the repo to get them by e-mail.
- **The plan (for Wade):** https://claude.ai/code/artifact/a0dabc1c-61f8-4bcc-8709-2938182b35ec
