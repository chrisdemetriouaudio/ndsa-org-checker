---
phase: 6
status: live
updated: 2026-10-17
---

# 🚪 Phase 6 — Admin Front Door

> [!info] At a glance
> **What:** a passkey-protected admin page to add, remove and review organisations. The directory stays public.
> **Where:** https://ndsa.labs.chrisdemetriou.com/admin (directory at https://ndsa.labs.chrisdemetriou.com).
> **Status:** ✅ Live (17 Oct 2026). Keys added; Chris signed in with a passkey.
> **Back to:** [[00 Dashboard]]

## 👉 Your actions

- [ ] **Give Wade his sign-in link yourself** when ready: run `npm run admin -- link` with his address, then pass it on personally.

## 💭 Later

- [ ] **Try an "add several" with 5 real organisations** and check the instant results.
- [ ] **Check the score is valid** (see the Backlog: test against the register).

## ✅ Done

> [!success]- Finished (tap to open)
> - [x] **Resend key and GitHub token added; Chris signed in with a passkey** (17 Oct 2026).
> - [x] **Approved admin list in the database:** Chris (tech@) and Wade (17 Oct 2026). Only these two can sign in.
> - [x] **Wade is never e-mailed by the system.** Link requests for him are held and logged; tested with a stand-in address.
> - [x] **Hand-delivered links:** `npm run admin -- link` prints a single-use link (72 hours). Nothing is sent.
> - [x] **No sign-in loop:** people with a passkey are offered it first after an e-mailed link (17 Oct 2026).
> - [x] **Passwordless:** a single-use link, then a passkey. No passwords anywhere.
> - [x] **Cloudflare Worker (free tier)** serves the public directory and /admin (17 Oct 2026).
> - [x] **Admins:** an e-mail on the list, then a passkey. A link alone can only add a passkey.
> - [x] **Safe by default:** single-use 15-minute links, hashed tokens, rate limits, same-site checks, strict security headers.
> - [x] **Unknown addresses get the same answer** as known ones, so the admin list can't be guessed.
> - [x] **Add one or up to 25 at once;** duplicates and bad addresses are explained in plain words.
> - [x] **Remove archives** with a reason (never deletes); **Restore** undoes it; **Still running** clears a flag.
> - [x] **Instant check:** new entries are checked within about a minute (tested on 17 Oct 2026: 34 seconds).
> - [x] **Tested live:** forged sessions, used links, junk passkeys and other-site requests are all refused.
