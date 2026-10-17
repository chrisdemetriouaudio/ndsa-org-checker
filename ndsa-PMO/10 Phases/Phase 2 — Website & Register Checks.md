---
phase: 2
status: in progress
updated: 2026-10-17
---

# 🔎 Phase 2 — Website & Register Checks

> [!info] At a glance
> **What:** check every website each morning, then add the charity registers.
> **Status:** 🛠️ Website checks live (17 Oct 2026). Register checks not started.
> **Passes when:** 4 weeks of checks, every flag either real or a fixed false alarm.
> **Back to:** [[00 Dashboard]]

## 👉 Your actions

- [ ] **Get a free Charity Commission API key** (only needed for register checks).

## 🛠️ For Claude

- [ ] **Add Charity Commission register checks** once the key exists. This turns the "Charity register" tick on: the first proof category.
- [ ] **Add Companies House checks** for charitable companies.

## ✅ Done

> [!success]- Finished (tap to open)
> - [x] **Ticks and a score** for every organisation; proof kept apart from evidence (17 Oct 2026).
> - [x] **Daily website check on GitHub Actions** (free), about 7am (17 Oct 2026).
> - [x] **Spots:** address gone, site down, "we have closed" wording, parked domains, moves to a new domain.
> - [x] **Polite:** one visit a day, named robot, follows robots.txt.
> - [x] **Fair:** a site must fail 3 times in 7 days before it is flagged.
> - [x] **First run found 4 moved or renamed organisations,** for example Autism Wales → Neurodivergence Wales.
> - [x] **First run found ADHD Foundation's address not answering** (one day only, so not flagged).
