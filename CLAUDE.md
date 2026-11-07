# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

The home of the MakerLens family at `https://makerlens.kokoroou.workers.dev/`: a landing page plus the build and deploy of the tools onto **one Cloudflare Worker** (a `workers.dev` hostname can only route to one Worker, so the tools cannot deploy themselves to subpaths).

```
site/                 → /         landing page, 404.html, robots.txt, sitemap.xml (the only one: lists /assets/ and /events/ too), llms.txt, _headers,
                                  favicon.ico/.svg + apple-touch-icon.png (the only favicon for the whole hostname), og-image.png
tools/assets (CI)     → /assets/  Kokoroou/rpgmaker-assets-viewer, via its scripts/assemble-site.sh
tools/events (CI)     → /events/  Kokoroou/rpgmaker-events-viewer (formerly lore-insight), same
scripts/build.sh      assembles _site/ (ASSETS_SRC / EVENTS_SRC override the tool paths)
scripts/check-site.mjs checks _site/: tools in place, landing CSP/hosts, local links, JSON-LD,
                      root favicon, and every og:image/twitter:image/JSON-LD image on this host exists
scripts/og-images.mjs  redraws og-image.png (landing + each tool) and the icons with Playwright; output is committed
src/worker.js         runs only when no static file matches: a//b → 301 a/b, dir/ → dir/index.html, dir → 301 dir/, else 404.html
tests/worker.test.mjs src/worker.js against a fake ASSETS binding (npm test), incl. no open redirect
wrangler.jsonc        Worker config; html_handling "none" keeps .html URLs (faq.html) as on the old GitHub Pages site
```

## Commands

```bash
npm ci
ASSETS_SRC=../rpgmaker-assets-viewer EVENTS_SRC=../rpgmaker-events-viewer npm run build
npm run check
npm test      # src/worker.js
npm run dev   # wrangler dev on http://localhost:8787/
```

## CI/CD

- `.github/workflows/ci.yml` — agent-toolkit quality gate; builds from the tools' `main` and runs `npm run check` and `npm test` (+ Gitleaks, Semgrep).
- `.github/workflows/deploy.yml` — on push to `main`, `repository_dispatch: tool-updated` (sent by each tool repo's `notify-makerlens.yml`) or by hand with optional tool refs: runs both tool repos' own checks, `npm test`, builds, checks, `wrangler deploy`. Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- `wrangler` is pinned exactly in `package.json` (4.153.0+: earlier versions pull a vulnerable undici) (Dependabot updates it with a cooldown).

## Rules

- **Static and client-side only.** Same legal position as the tools (see rpgmaker-assets-viewer `LEGAL.md`): the Worker never receives game files; do not add upload or storage endpoints. `src/worker.js` only maps paths to static files; build every URL and `Location` as origin + a path with one leading `/` (never `new URL(requestPath, base)`: `//host/…` there is an open redirect).
- **No third-party hosts.** Landing CSP is `'self'` plus the GoatCounter pixel; no inline `<script>` or `style=""` (checked by `scripts/check-site.mjs`). The landing page reuses `/assets/css/tokens.css`, `/assets/js/site.js` and `/assets/js/analytics.js`, so analytics stays exactly what `/assets/privacy.html` describes.
- **Shared origin.** All tools share one origin and so one `localStorage`: keep keys distinct per tool (Assets: `theme`, `feedback`, `sidebar*`; Events: `mle-theme`, `mle-feedback`). The landing page reads Assets' `theme`.
- **Brand: MakerLens.** Magnifier mark, green `--a` action colour, "Maker**Lens** + suffix" wordmark.
- **One design system.** Assets' `css/tokens.css` is the source; Events keeps a verbatim copy (each tool must also run on its own, so it cannot link `/assets/`), and `scripts/check-site.mjs` fails the build if `/events/css/tokens.css` differs from `/assets/css/tokens.css`.
- **One entity graph (SEO).** JSON-LD uses shared `@id`s: `/#website`, `/#author`, `/assets/#app` (MakerLens Assets), `/events/#app` (MakerLens Events). The landing page declares all four; each tool page repeats its own `@id` and links back with `isPartOf`. Keep names and `applicationCategory` the same on both sides.

## Page titles (all MakerLens pages, this repo and both tools)

One format, so search results look like one family:

```
<title>{Topic} — {Qualifier} | MakerLens</title>
```

- **Brand last, always `| MakerLens`** (never "MakerLens Events/Assets" as the suffix: the tool name is already in the topic or the entity graph). Inside the title use an em dash ` — ` between topic and qualifier, never `:`; no other separators.
- **Topic first** and keyword-first: what people search ("RPG Maker Asset Extractor", "RPG Maker Event Viewer", "… FAQ"). The qualifier lists what is supported or what it does (engines, `.rpgmvp, .png_`, "MV & MZ Event Graph").
- **About 60 characters** (hard max 65) so Google does not truncate; Title Case; `&` is written `&amp;` in HTML.
- **`og:title` and `twitter:title` equal `<title>`** (set them together).
- Secondary pages keep the tool's topic: `{Topic} FAQ — {Qualifier} | MakerLens`. Utility pages are short: `Privacy — … | MakerLens`, `Page Not Found | MakerLens`.
- JSON-LD `name` is the entity name (`MakerLens`, `MakerLens Assets`, `MakerLens Events`), not the page title.

Current titles:

| Page | Title |
|---|---|
| `/` | RPG Maker Tools Online — Extractor & Event Viewer \| MakerLens |
| `/assets/` | RPG Maker Asset Extractor — MV, MZ, XP, VX Ace \| MakerLens |
| `/assets/faq.html` | RPG Maker Extractor FAQ — .rpgmvp, .png_, .rgss3a \| MakerLens |
| `/assets/privacy.html` | Privacy — Anonymous Stats, No Uploads \| MakerLens |
| `/events/` | RPG Maker Event Viewer — MV & MZ Event Graph \| MakerLens |
| `/events/faq.html` | RPG Maker Event Viewer FAQ — MV & MZ Events \| MakerLens |
| 404 | Page Not Found \| MakerLens |
