---
title: Decision Log
updated: 2026-10-17
---

# ⚖️ Decision Log

> [!info] At a glance
> **What:** choices we made, and why, so we don't argue them again.
> **How to read:** each box title is the decision. Tap it to see why.
> **Back to:** [[00 Dashboard]]

> [!question]- 18 Oct 2026 · Daily, gentle, and private
> - **Decided:** one morning run does everything. Healthy, steady organisations are visited every 3 days; anything doubtful daily.
> - **Decided:** clear new finds are added automatically (named for a condition, website passes), at most 20 a day.
> - **Decided:** a visitor's postcode is never stored. Nationwide organisations are never hidden by distance.
> - **Why:** fast for families, light on other people's websites, and nothing personal kept.

> [!question]- 17 Oct 2026 · How to find organisations
> - **Decided:** 18 conditions only (Chris's list). Matched on exact phrases, so "Down" or "sensory" alone never count.
> - **Decided:** everything found goes to a review list. A person adds it. Nothing found goes straight onto the directory.
> - **Decided:** in stages, one source at a time: charity registers first, then Companies House, councils, possible DPOs.
> - **Decided:** informal groups and peer networks are added by people. No register lists them.
> - **Why:** a wrong listing would send families to the wrong place, the very problem this solves.

> [!question]- 17 Oct 2026 · Wade is never contacted by the system
> - **Decided:** Wade's address is on the admin list but marked "never e-mail". Sign-in link requests for it are held and logged.
> - **Decided:** when Wade should get access, Chris makes a link by hand and gives it to him personally.
> - **Why:** Chris's instruction. Nothing may e-mail or notify Wade.

> [!question]- 17 Oct 2026 · Admin front door with passkeys
> - **Decided:** the directory stays public. Only admins (e-mail on the list + passkey) add or remove organisations.
> - **Decided:** no public suggestion forms. A Cloudflare Worker (free) is the front door; the list stays in GitHub.
> - **Decided:** "remove" archives with a reason, never deletes, so it can be restored.
> - **Address:** ndsa.labs.chrisdemetriou.com. Passkeys are tied to it, so it should not change.
> - **Why:** keeps the list trustworthy, with sign-in that cannot be phished.

> [!question]- 17 Oct 2026 · Free register download, and what counts as proof
> - **Decided:** use the Charity Commission's free daily download, not the API (no key, one file a day).
> - **Decided:** removed or dissolved = proven closed (score 0). Insolvent or in administration = likely closed (score 40 at most).
> - **Why:** administration can end in a rescue, so it is serious but not proof of closure.

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
