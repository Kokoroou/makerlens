# MakerLens

**[makerlens.kokoroou.workers.dev](https://makerlens.kokoroou.workers.dev/)** — free browser tools that look inside RPG Maker games. Files are read locally and never uploaded.

| Path | Tool | Source |
|---|---|---|
| `/` | Landing page | this repo (`site/`) |
| `/assets/` | MakerLens Assets — extract images and audio (MV, MZ, XP, VX, VX Ace) | [Kokoroou/rpgmaker-assets-viewer](https://github.com/Kokoroou/rpgmaker-assets-viewer) |
| `/events/` | MakerLens Events — event flow graph (MV, MZ) | [Kokoroou/rpgmaker-events-viewer](https://github.com/Kokoroou/rpgmaker-events-viewer) |

## Direction

MakerLens is a **free community toolkit for reading RPG Maker games**, not a business: no paid tier, no ads, no account (at most a shared donate link). Running cost is 0. The tools are easy to copy, so what the family defends is trust and one brand: no install, no upload, the whole game with one drag and drop, read-only.

| Tool | Main job | Audience |
|---|---|---|
| Assets | See, filter and save a game's images and music | Modders and translators with permission; creators recovering their own work |
| Events | Understand how a game works: ending and route conditions, branches, switches | Guide and wiki writers, dataminers, speedrunners; translators and developers as secondary |

Events lives under the MakerLens name, not alone, because it shares the audience and the gesture with Assets and a separate brand would split small traffic. Each tool has its own 8-week measurement and stop rule in its `docs/ROADMAP.md`. Out of scope for every tool: editing, repackaging or redistributing games, uploads, paid features.

This repo holds the landing page and builds/deploys the whole site to one Cloudflare Worker (static assets).

## Local preview

```bash
npm ci
ASSETS_SRC=../rpgmaker-assets-viewer EVENTS_SRC=../rpgmaker-events-viewer npm run build
npm run check
npm run dev      # http://localhost:8787/
```

## Deploy

`.github/workflows/deploy.yml` deploys on a push to `main`, when a tool repo pushes to its `main` (`repository_dispatch: tool-updated`), or by hand (Actions → Deploy, optionally with other tool refs). It needs the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## License

[MIT](LICENSE)
