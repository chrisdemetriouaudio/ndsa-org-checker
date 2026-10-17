# ndsa-org-checker

Daily checks that UK neurodivergent (ND) support organisations are still running. Checks suggest a status; a person decides every closure.

## How it fits together

- `data/orgs.json` — the list. A person's decision goes in an org's `review` field: `{ "status": "Still running" | "Confirmed" | "Closed", "date": "YYYY-MM-DD", "by": "Wade" }`. Never close a listing without a person saying so.
- `npm run checks` — visits every website once, updates `data/state.json`, and rewrites `ndsa-PMO/30 Live/Live status.md`, the Live box on the Dashboard (between `<!-- live:start -->` markers) and `site/index.html`.
- `npm run render` — rewrites those files from `data/state.json` without visiting any website (use after editing `orgs.json`).
- `.github/workflows/daily-check.yml` — runs the checks at about 7am, commits the results, posts new flags to the "Services to review" issue and publishes `site/` to GitHub Pages.
- `.github/workflows/check-new.yml` — started by the admin page: checks just the new ids now (`run.ts --only=`), or re-renders.
- `worker/` — the front door (Cloudflare Worker, `wrangler.jsonc`): public directory at `/`, passkey admin at `/admin`. Admins live in D1 (`ndsa-admin-db`); manage them with `npm run admin -- add|remove|list`. Deploy with `npm run worker:deploy` (applies migrations first). Secrets: `RESEND_API_KEY`, `GITHUB_TOKEN` (fine-grained, this repo only, Contents + Actions read/write). Only admins may add or remove organisations; removing archives (`review.status = Closed`), never deletes.
- Free tier only for the prototype (GitHub Actions + Pages, Cloudflare Workers + D1).

## Before every push

Run `npm run check` (typecheck and tests, the same as CI).

## ndsa-PMO vault (the project tracker)

`ndsa-PMO/` is an Obsidian vault. The owner is neurodivergent, so follow `ndsa-PMO/00 Start here/How this vault works.md` exactly: "At a glance" box, then To do, then Done folded (`> [!success]-`); one task per line, verb first, in bold; dates as words ("17 Oct 2026"); the vault's symbols only. After every change that goes live, update the Dashboard, the phase page, the Changelog (newest on top, open), the Decision Log and the Backlog. Never hand-edit `30 Live/` or the Dashboard's Live box: the daily check overwrites them. Check a status on the live system before ticking it.
