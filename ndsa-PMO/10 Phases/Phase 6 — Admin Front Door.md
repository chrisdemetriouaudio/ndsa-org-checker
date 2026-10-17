---
phase: 6
status: live
updated: 2026-10-17
---

# 🚪 Phase 6 — Admin Front Door

> [!info] At a glance
> **What:** a passkey-protected admin page to add, remove and review organisations. The directory stays public.
> **Where:** https://ndsa.labs.chrisdemetriou.com/admin (directory at https://ndsa.labs.chrisdemetriou.com).
> **Status:** ⏳ Live (17 Oct 2026). Sign-in works once the 2 keys below are added and admins are on the list.
> **Back to:** [[00 Dashboard]]

## 👉 Your actions

- [ ] **Send Claude the admin e-mail addresses,** with each person's name.
- [ ] **Make a Resend key:** Resend → API Keys → Create, sending access only.
- [ ] **Add it to the Worker:** in the project folder, run `npx wrangler secret put RESEND_API_KEY` and paste it.
- [ ] **Make a GitHub token:** GitHub → Settings → Developer settings → Fine-grained tokens → Generate.
- [ ] **Limit the token:** only the `ndsa-org-checker` repo; Contents and Actions set to "Read and write".
- [ ] **Add it to the Worker:** run `npx wrangler secret put GITHUB_TOKEN` and paste it.
- [ ] **Sign in once:** e-mail link, then add a passkey on your phone or computer.

## 💭 Later

- [ ] **Try an "add several" with 5 real organisations** and check the instant results.
- [ ] **Check the score is valid** (see the Backlog: test against the register).

## ✅ Done

> [!success]- Finished (tap to open)
> - [x] **Cloudflare Worker (free tier)** serves the public directory and /admin (17 Oct 2026).
> - [x] **Admins:** an e-mail on the list, then a passkey. A link alone can only add a passkey.
> - [x] **Safe by default:** single-use 15-minute links, hashed tokens, rate limits, same-site checks, strict security headers.
> - [x] **Unknown addresses get the same answer** as known ones, so the admin list can't be guessed.
> - [x] **Add one or up to 25 at once;** duplicates and bad addresses are explained in plain words.
> - [x] **Remove archives** with a reason (never deletes); **Restore** undoes it; **Still running** clears a flag.
> - [x] **Instant check:** new entries are checked within about a minute (tested on 17 Oct 2026: 34 seconds).
> - [x] **Tested live:** forged sessions, used links, junk passkeys and other-site requests are all refused.
