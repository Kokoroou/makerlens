# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

The home of the MakerLens family at `https://makerlens.kokoroou.workers.dev/`: a landing page plus the build and deploy of the tools onto **one Cloudflare Worker** (a `workers.dev` hostname can only route to one Worker, so the tools cannot deploy themselves to subpaths).

```
site/                 → /         landing page, 404.html, robots.txt, sitemap.xml, llms.txt, _headers
tools/assets (CI)     → /assets/  Kokoroou/rpgmaker-assets-viewer, via its scripts/assemble-site.sh
tools/events (CI)     → /events/  Kokoroou/rpgmaker-events-viewer (formerly lore-insight), same
scripts/build.sh      assembles _site/ (ASSETS_SRC / EVENTS_SRC override the tool paths)
scripts/check-site.mjs checks _site/: tools in place, landing CSP/hosts, local links, JSON-LD
src/worker.js         runs only when no static file matches: dir/ → dir/index.html, dir → 301 dir/, else 404.html
wrangler.jsonc        Worker config; html_handling "none" keeps .html URLs (faq.html) as on the old GitHub Pages site
```

## Commands

```bash
npm ci
ASSETS_SRC=../rpgmaker-assets-viewer EVENTS_SRC=../rpgmaker-events-viewer npm run build
npm run check
npm run dev   # wrangler dev on http://localhost:8787/
```

## CI/CD

- `.github/workflows/ci.yml` — agent-toolkit quality gate; builds from the tools' `main` and runs `npm run check` (+ Gitleaks, Semgrep).
- `.github/workflows/deploy.yml` — on push to `main`, `repository_dispatch: tool-updated` (sent by each tool repo's `notify-makerlens.yml`) or by hand with optional tool refs: runs the Assets repo's own checks, builds, checks, `wrangler deploy`. Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- `wrangler` is pinned exactly in `package.json` (4.153.0+: earlier versions pull a vulnerable undici) (Dependabot updates it with a cooldown).

## Rules

- **Static and client-side only.** Same legal position as the tools (see rpgmaker-assets-viewer `LEGAL.md`): the Worker never receives game files; do not add upload or storage endpoints. `src/worker.js` only maps paths to static files.
- **No third-party hosts.** Landing CSP is `'self'` plus the GoatCounter pixel; no inline `<script>` or `style=""` (checked by `scripts/check-site.mjs`). The landing page reuses `/assets/css/tokens.css`, `/assets/js/site.js` and `/assets/js/analytics.js`, so analytics stays exactly what `/assets/privacy.html` describes.
- **Shared origin.** All tools share one origin and so one `localStorage`: keep keys distinct per tool (Assets: `theme`, `feedback`, `sidebar*`; Events: `mle-theme`). The landing page reads Assets' `theme`.
- **Brand: MakerLens.** Magnifier mark, green `--a` action colour, "Maker**Lens** + suffix" wordmark.
- **One design system.** Assets' `css/tokens.css` is the source; Events keeps a verbatim copy (each tool must also run on its own, so it cannot link `/assets/`), and `scripts/check-site.mjs` fails the build if `/events/css/tokens.css` differs from `/assets/css/tokens.css`.
