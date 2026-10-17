---
phase: 7
status: in progress
updated: 2026-10-17
---

# 🔎 Phase 7 — Finding Organisations

> [!info] At a glance
> **What:** find UK organisations that support people with the 18 conditions in scope, in all 4 nations.
> **How:** a script reads free official data, matches exact phrases, and puts candidates on a review list. A person adds them.
> **Status:** 🛠️ Stage 1 live. 18 Oct 2026: 830 added automatically, 682 turned down, 222 left for a person, 318 have no website.
> **Back to:** [[00 Dashboard]] · counts in [[Candidates]]

## 👉 Your actions

- [ ] **Look at the 222 unclear ones** when you have time: Admin → Review candidates (shows only those by default).
- [ ] **Add informal groups and peer networks by hand** (Add an organisation). No register lists them.

## 🛠️ For Claude

- [ ] **Stage 2: Companies House:** CICs and not-for-profit companies limited by guarantee (free monthly file, names only).
- [ ] **Stage 3: Councils:** every UK local authority, and each English council's SEND Local Offer page.
- [ ] **Stage 4: Possible Disabled People's Organisations:** "user-led" wording; a person confirms the 75% rule.

## 💭 Later

- [ ] **Scotland and Northern Ireland register checks** for the daily score (the data is now downloaded weekly anyway).

## ✅ Done

> [!success]- Finished (tap to open)
> - [x] **Automatic triage:** each candidate gets a relevance score with reasons: add, unclear, or turned down (18 Oct 2026).
> - [x] **Turned down automatically:** care and housing providers, schools, grant-makers, overseas work, general services.
> - [x] **980 borderline ones read and decided by Claude** (618 kept, 362 turned down); saved as overrides the rules respect.
> - [x] **830 added** after a website check; each one's register areas, postcode, map point and "who for" filled in.
> - [x] **The 18 conditions** set by Chris: autism, ADHD, Tourette, dyslexia, dyscalculia, dysgraphia, dyspraxia, DLD, sensory processing, prosopagnosia, synaesthesia, OCD, learning disability, Down, Williams and Fragile X syndromes, acquired and traumatic brain injury (plus neurodiversity in general).
> - [x] **Exact-phrase matching,** tested against look-alikes (County Down, sensory impairment services, "Add", "Williams Trust").
> - [x] **All 4 nations:** England and Wales register (Welsh areas flagged), Scottish Charity Register, Northern Ireland register.
> - [x] **Northern Ireland fix:** tick-box "who it helps" lists only count when short (3 or fewer). Cut false matches from 772 to 139.
> - [x] **Spot-checked by hand:** samples from every nation look right; a few broad charities remain for people to judge.
> - [x] **Review page:** filter by nation, condition, name or search; add (instant check) or mark not relevant; decisions remembered.
> - [x] **Runs weekly** (Mondays) on GitHub Actions, free.
> - [x] **Scottish data attribution** shown on the public directory, as its licence requires.
