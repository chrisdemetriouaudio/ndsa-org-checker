---
title: Decision Log
updated: 2026-10-17
---

# ⚖️ Decision Log

> [!info] At a glance
> **What:** choices we made, and why, so we don't argue them again.
> **How to read:** each box title is the decision. Tap it to see why.
> **Back to:** [[00 Dashboard]]

> [!question]- 17 Oct 2026 · Ticks, a score, and proof before "closed"
> - **Decided:** each organisation gets 7 categories, each ✅ 🟡 🔴 or ⚪, and a score out of 100.
> - **Decided:** website checks are evidence (they can be wrong). Proof = charity register, the organisation itself, or a person.
> - **Decided:** only proof makes a closure "proven". A person still makes the final call.
> - **Why:** one number to sort by, ticks to see why, and no closure on website evidence alone.

> [!question]- 17 Oct 2026 · Free tools only for the prototype
> - **Decided:** GitHub Actions runs the checks; GitHub Pages hosts the directory; data lives in the repo.
> - **Why:** costs nothing on a public repo, and needs no server.
> - **Later:** move to Cloudflare (also free) if it needs a database or a review page.

> [!question]- 17 Oct 2026 · Public repo
> - **Decided:** the code and the list are public.
> - **Why:** free Pages and Actions; the list holds only public organisation details.

> [!question]- 17 Oct 2026 · A person decides every closure
> - **Decided:** checks only suggest. Closing a listing needs a person (`review` in `data/orgs.json`).
> - **Why:** wrongly removing a live service harms the people who need it.

> [!question]- 17 Oct 2026 · No AI phone calls or pretend enquiries
> - **Decided:** organisations are contacted openly, by e-mail, at most twice a year.
> - **Why:** helpline time belongs to people in distress; secret tests would damage trust.

> [!question]- 17 Oct 2026 · Hand-picked seed list
> - **Decided:** start with 44 well-known organisations, not a register download.
> - **Why:** Wade gave no list; a small known list makes false alarms easy to spot.
