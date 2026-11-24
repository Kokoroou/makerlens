# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

The home of the MakerLens family at `https://makerlens.kokoroou.workers.dev/`: a landing page plus the build and deploy of the tools onto **one Cloudflare Worker** (a `workers.dev` hostname can only route to one Worker, so the tools cannot deploy themselves to subpaths).

```
site/                 → /         landing page (index.html), privacy.html and legal.html (the one Privacy and the one Legal for both tools),
                                  404.html, robots.txt, sitemap.xml (the only one: lists /assets/ and /events/ too), llms.txt, _headers, _redirects,
                                  css/landing.css (shared by every page of site/), js/theme-init.js (theme toggle), js/landing.js (details start closed on phones),
                                  favicon.ico/.svg + apple-touch-icon.png (the only favicon for the whole hostname), og-image.png,
                                  <32 hex>.txt (IndexNow key: public by design, content = its name; one file only)
tools/assets (CI)     → /assets/  Kokoroou/rpgmaker-assets-viewer, via its scripts/assemble-site.sh
tools/events (CI)     → /events/  Kokoroou/rpgmaker-events-viewer (formerly lore-insight), same
scripts/build.sh      assembles _site/ (ASSETS_SRC / EVENTS_SRC override the tool paths)
scripts/check-site.mjs checks _site/: tools in place, landing CSP/hosts, local links, JSON-LD, one <h1> and the title format per page,
                      Privacy/Legal anchors, the _redirects rule, sitemap URLs exist, root favicon, and every og:image/twitter:image/JSON-LD image on this host exists
scripts/indexnow.mjs   pings IndexNow (Bing, Yandex, Naver; not Google) with the sitemap's URLs after deploy
scripts/og-images.mjs  redraws og-image.png (landing + each tool) and the icons with Playwright; output is committed
src/worker.js         runs only when no static file matches: a//b → 301 a/b, dir/ → dir/index.html, dir → 301 dir/, else 404.html
tests/worker.test.mjs src/worker.js against a fake ASSETS binding (npm test), incl. no open redirect
tests/indexnow.test.mjs the key file and the IndexNow request body (no network)
tests/site.test.mjs    site/ sources: Privacy/Legal anchors, the _redirects rule, sitemap, title format
wrangler.jsonc        Worker config (assets directory ./_site, so _site/_redirects and _headers apply); html_handling "none" keeps .html URLs (faq.html) as on the old GitHub Pages site
```

## Commands

```bash
npm ci
ASSETS_SRC=../rpgmaker-assets-viewer EVENTS_SRC=../rpgmaker-events-viewer npm run build
npm run check
npm test      # src/worker.js, scripts/indexnow.mjs
npm run dev   # wrangler dev on http://localhost:8787/
```

## CI/CD

- `.github/workflows/ci.yml` — agent-toolkit quality gate; builds from the tools' `main` and runs `npm run check` and `npm test` (+ Gitleaks, Semgrep).
- `.github/workflows/deploy.yml` — on push to `main`, `repository_dispatch: tool-updated` (sent by each tool repo's `notify-makerlens.yml`) or by hand with optional tool refs: runs both tool repos' own checks, `npm test`, builds, checks, `wrangler deploy`, then `node scripts/indexnow.mjs` (continue-on-error: a failed ping never fails the deploy, so a new page reaches Bing as soon as it is in `site/sitemap.xml`). Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- `wrangler` is pinned exactly in `package.json` (4.153.0+: earlier versions pull a vulnerable undici) (Dependabot updates it with a cooldown).

## Rules

- **Static and client-side only.** Same legal position as the tools (see rpgmaker-assets-viewer `LEGAL.md`): the Worker never receives game files; do not add upload or storage endpoints. `src/worker.js` only maps paths to static files; build every URL and `Location` as origin + a path with one leading `/` (never `new URL(requestPath, base)`: `//host/…` there is an open redirect).
- **No third-party hosts.** Landing CSP is `'self'` plus the GoatCounter pixel; no inline `<script>` or `style=""` (checked by `scripts/check-site.mjs`). The landing, Privacy and Legal pages reuse `/assets/css/tokens.css`, `/assets/js/site.js` and `/assets/js/analytics.js`, so analytics stays exactly what `/privacy.html` describes.
- **Landing look.** `site/css/landing.css` (landing, Privacy, Legal, 404) is a "field guide" skin on Assets' tokens: serif body, mono labels, 2px ink borders with a hard shadow, green as the only action colour, pixel-art and SVG illustrations (no images). It defines only what tokens.css lacks (pixel colours, the dark `night` band, the shadow), each with the three theme copies. Motion is CSS only and off under `prefers-reduced-motion`: a hero entrance, a slow lens drift (`scan`), and scroll-driven reveals (`animation-timeline: view()` inside `@supports`, so unsupported browsers just show the content); add no JS or inline style for it. Rules checked by hand before shipping: one `<h1>` per page, text >= 12px (body >= 16px) and >= 4.5:1, touch targets >= 44px with 8px between them on phones, `:focus-visible`, `prefers-reduced-motion`, the home page <= 5500px tall at 390px (illustrations have a compact phone form: `.only-d` / `.only-m`; optional blocks are `<details class="more" data-m="closed">`, closed on phones by `js/landing.js`).
- **Theme.** `js/theme-init.js` uses the key `theme` (`light`/`dark`, removed when the choice equals the system theme), exactly as MakerLens Assets, so the choice is shared across the family. The toggle is a button with `aria-pressed` (pressed = dark) and a constant label; `<meta name="theme-color">` follows the shown theme.
- **One Privacy, one Legal.** `/privacy.html` is the only privacy page (anchors `#files #analytics #feedback #hosting` are linked from both tools: keep them); `/legal.html` summarises LEGAL.md of Assets and points to the full texts. `site/_redirects` sends `/assets/privacy.html` to `/privacy.html` (301; verified with `wrangler dev` together with `html_handling: "none"`; the browser keeps the `#fragment`). Change Privacy only when a principle changes (see Assets' CLAUDE.md), and bump "Last updated" then; add new pages to `sitemap.xml`. Legal wording comes from the tools' LEGAL.md/README/LICENSE: do not add commitments they do not make.
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
- **Topic first** and keyword-first: what people search ("RPG Maker Asset Extractor", "RPG Maker Event Viewer", "… FAQ"). The qualifier lists what is supported or what it does (engines, `.rpgmvp, .png_`, "2000 to MZ, All Versions").
- **About 60 characters** (hard max 65) so Google does not truncate; Title Case; `&` is written `&amp;` in HTML.
- **`og:title` and `twitter:title` equal `<title>`** (set them together).
- Secondary pages keep the tool's topic: `{Topic} FAQ — {Qualifier} | MakerLens`. Utility pages are short: `Privacy — … | MakerLens`, `Page Not Found | MakerLens`.
- JSON-LD `name` is the entity name (`MakerLens`, `MakerLens Assets`, `MakerLens Events`), not the page title.

Current titles:

| Page | Title |
|---|---|
| `/` | RPG Maker Tools Online — Extractor & Event Viewer \| MakerLens |
| `/assets/` | RPG Maker Asset Extractor — 2000 to MZ, All Versions \| MakerLens |
| `/assets/faq.html` | RPG Maker Extractor FAQ — .rpgmvp, .png_, .rgss3a \| MakerLens |
| `/privacy.html` (the old `/assets/privacy.html` redirects here) | Privacy — Anonymous Stats, No Uploads \| MakerLens |
| `/legal.html` | Legal — Intended Use & Takedowns \| MakerLens |
| `/events/` | RPG Maker Event Viewer — 2000 to MZ, Graph & Scenes \| MakerLens |
| `/events/faq.html` | RPG Maker Event Viewer FAQ — Folders, Scenes, Saves \| MakerLens |
| 404 | Page Not Found \| MakerLens |

## Releases

`.github/workflows/release.yml` (release-please, via agent-toolkit's shared `release.yml@v0`, same as rpgmaker-web-toolkit) keeps a `chore(main): release X.Y.Z` PR up to date from the Conventional Commits on `main` (`feat:` → minor, `fix:` → patch, `feat!:` → major; `docs:` `ci:` `chore:` `refactor:` `test:` alone make no release). Merging it tags `vX.Y.Z` and creates the GitHub Release; nothing is attached (the site is deployed by makerlens' `deploy.yml`). The first release is `v1.0.0` (`initial-version`). So squash-merge PRs with a Conventional Commit title, and never edit `CHANGELOG.md` or `version.txt` by hand.
