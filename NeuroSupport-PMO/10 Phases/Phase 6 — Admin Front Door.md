---
phase: 6
status: live
updated: 2026-10-18
---

# 🚪 Phase 6 — Admin Front Door

> [!info] At a glance
> **What:** a passkey-protected admin page to add, remove and review organisations. The directory stays public.
> **Where:** for now https://ndsa.labs.chrisdemetriou.com/admin (old address, your passkey is there). New address: https://neurosupport.labs.chrisdemetriou.com/admin.
> **Status:** ✅ Live. 🔴 The new address cannot save changes or send sign-in e-mails yet: its 2 keys are still on the old one.
> **Back to:** [[00 Dashboard]]

## 👉 Your actions

- [ ] **Move 2 keys to the new site** (Cloudflare never shows a saved key, so they cannot be copied):
  1. **Resend:** resend.com → API Keys → **Create API Key** (sending access). Copy it.
  2. **Run** `npx wrangler secret put RESEND_API_KEY --name neuro-support-checker` and paste.
  3. **GitHub:** github.com → Settings → Developer settings → Fine-grained tokens → **Generate new token**. Repository: neuro-support-checker only. Permissions: Contents and Actions, read and write. Copy it.
  4. **Run** `npx wrangler secret put GITHUB_TOKEN --name neuro-support-checker` and paste.
  5. **Sign in** at neurosupport.labs.chrisdemetriou.com/admin with an e-mail link, then **add a passkey** there.
  6. **Tell Claude "keys moved".** Never paste a key into a chat.
- [ ] **Give Wade his sign-in link yourself** when ready: run `npm run admin -- link` with his address, then pass it on personally.

## 💭 Later

- [ ] **Try an "add several" with 5 real organisations** and check the instant results.
- [ ] **Check the score is valid** (see the Backlog: test against the register).

## ✅ Done

> [!success]- Finished (tap to open)
> - [x] **Bridge:** the old address runs today's code with its own keys, so nothing broke during the rename (18 Oct 2026).
> - [x] **Removing works first time:** the page reads the exact version just saved (18 Oct 2026).
> - [x] **Frozen column titles** and one titled column per tick on the admin table (18 Oct 2026).
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
