# neuro-support-checker

Keeps a directory of UK neurodivergent (ND) support organisations up to date. Every morning it visits each organisation's website and suggests a status. **A person decides every closure.**

- **Public directory:** https://chrisdemetriouaudio.github.io/neuro-support-checker/
- **What it spots:** the web address no longer exists, the site is down 3 times in a week, "we have closed" wording, parked or for-sale domains, and moves to a new domain.
- **Statuses:** Looks active · Needs a check · Likely closed (hidden from the directory) · Closed (only by a person) · Confirmed (by the organisation).
- **Polite:** one visit a day per site, a named user agent, and it follows robots.txt.
- **Free:** GitHub Actions and GitHub Pages.

```bash
npm ci
npm run checks   # visit every site and rewrite the outputs
npm run check    # typecheck and tests
```

Project notes and the live status board are in `NeuroSupport-PMO/`, an Obsidian vault.
