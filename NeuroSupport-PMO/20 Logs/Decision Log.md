---
title: Decision Log
updated: 2026-10-18
---

# ⚖️ Decision Log

> [!info] At a glance
> **What:** choices we made, and why, so we don't argue them again.
> **How to read:** each box title is the decision. Tap it to see why.
> **Back to:** [[00 Dashboard]]

> [!question]- 19 Oct 2026 · Footer asks organisations if they want a tool like this
> - **Decided by Chris:** the footer opens with "Need a tool like this for your organisation?".
> - **Decided:** "Designed and built by Chris Demetriou" stays, linking to chrisdemetriou.com; "See what else I've built" links to labs.chrisdemetriou.com.
> - **Why:** the directory is the best proof of what Chris builds.

> [!question]- 18 Oct 2026 · Look and feel: warm, phone-first, spacious, deep green
> - **Decided by Chris:** warm and friendly; designed for families and carers on phones; spacious cards; keep the deep green.
> - **Decided:** no endless scroll (12 at a time); a condition filter shows only organisations for that condition.
> - **Why:** the old page looked like a beginner exercise and scrolled forever.

> [!question]- 18 Oct 2026 · Keep the old address running until the keys move
> - **Decided:** ndsa.labs runs today's code with its own keys and admin list, as a bridge.
> - **Decided:** once the 2 keys are on the new site and sign-in works there, the old address forwards to the new one; the old Worker and database are deleted only with Chris's OK.
> - **Why:** Cloudflare never shows a saved key, so Claude cannot copy them; Chris still signs in at the old address.

> [!question]- 18 Oct 2026 · Nobody reviews candidates: unclear ones are parked after 7 days
> - **Decided:** the register's own "how it works" tick-boxes break ties. Advice or advocacy tips in; grants, housing or research only tip out.
> - **Decided:** care providers never tip in, even if they tick "advice".
> - **Decided:** still unclear after 7 days = parked, never added. Websites that stay gone are parked too.
> - **Decided:** the tie-breaker uses the free daily register files, not the API, so GitHub needs no extra key.
> - **Why:** the owner has no time to review; parking is safe because it never adds anything unchecked.

> [!question]- 18 Oct 2026 · Decide candidates automatically
> - **Decided:** nobody can review 2,052 by hand. A relevance score with reasons decides: add, unclear, or turn down.
> - **Decided:** care homes, housing and care providers, schools, grant-makers and overseas work are not signposting services.
> - **Decided:** day-opportunity, activity, advocacy, arts, sport and peer groups are.
> - **Decided:** Claude read the 980 borderline ones; those decisions are saved and outrank the rules. Anyone can reverse one.
> - **Why:** a useful directory now, with every decision explained.

> [!question]- 18 Oct 2026 · Near you means "serves my area"
> - **Decided:** match the visitor's council (from their postcode) against each organisation's service areas on the register.
> - **Why:** distance from an office missed local groups that serve the area.

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
> - **Address:** neurosupport.labs.chrisdemetriou.com. Passkeys are tied to it, so it should not change.
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
