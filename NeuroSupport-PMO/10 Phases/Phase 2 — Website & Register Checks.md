---
phase: 2
status: in progress
updated: 2026-10-18
---

# 🔎 Phase 2 — Website & Register Checks

> [!info] At a glance
> **What:** check every website each morning, then add the charity registers.
> **Status:** ✅ Live (17 Oct 2026). Website checks and all three UK charity registers. Live register checks wait for the API key.
> **Passes when:** 4 weeks of checks, every flag either real or a fixed false alarm.
> **Back to:** [[00 Dashboard]]

## 👉 Your actions

- [ ] **Add the Charity Commission API key** (switches on live register checks):
  1. **Open** api-portal.charitycommission.gov.uk and sign in.
  2. **Go to** Products → Register of Charities → **Subscribe**. Name it "Neuro Support Checker".
  3. **Open** your Profile → Subscriptions → Primary key → **Show**, then copy it.
  4. **Run** `npx wrangler secret put CCEW_API_KEY --name neuro-support-checker` and paste when asked.
  5. Never paste the key into a chat.
- [ ] **Decide ADHD Foundation and Dyspraxia Foundation** (left flagged on purpose, 17 Oct 2026).

## 🛠️ For Claude

- [ ] **Add Companies House checks** for community interest companies such as Genius Within.

## ✅ Done

> [!success]- Finished (tap to open)
> - [x] **Live register through the Charity Commission API,** ready for the key: removal reasons, interim managers, grant-makers, name search (18 Oct 2026).
> - [x] **Scottish (OSCR) and Northern Ireland (CCNI) registers** added (18 Oct 2026).
> - [x] **Closed Autism Alliance UK and Dyslexia Action** on register proof (17 Oct 2026).
> - [x] **Charity register connected** through the free daily download; no API key needed (17 Oct 2026).
> - [x] **34 of 44 organisations matched** to their charity numbers; the other 10 show why they have none.
> - [x] **Register found 4 problems:** 2 removed (proven closed), 1 in administration, 1 insolvent.
> - [x] **Ticks and a score** for every organisation; proof kept apart from evidence (17 Oct 2026).
> - [x] **Daily website check on GitHub Actions** (free), about 7am (17 Oct 2026).
> - [x] **Spots:** address gone, site down, "we have closed" wording, parked domains, moves to a new domain.
> - [x] **Polite:** one visit a day, named robot, follows robots.txt.
> - [x] **Fair:** a site must fail 3 times in 7 days before it is flagged.
> - [x] **First run found 4 moved or renamed organisations,** for example Autism Wales → Neurodivergence Wales.
> - [x] **First run found ADHD Foundation's address not answering** (one day only, so not flagged).
