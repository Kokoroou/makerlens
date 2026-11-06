# MakerLens

**[makerlens.kokoroou.workers.dev](https://makerlens.kokoroou.workers.dev/)** — free browser tools that look inside RPG Maker games. Files are read locally and never uploaded.

| Path | Tool | Source |
|---|---|---|
| `/` | Landing page | this repo (`site/`) |
| `/assets/` | MakerLens Assets — extract images and audio (MV, MZ, XP, VX, VX Ace) | [Kokoroou/rpgmaker-assets-viewer](https://github.com/Kokoroou/rpgmaker-assets-viewer) |
| `/events/` | MakerLens Events — event flow graph (MV, MZ) | [Kokoroou/rpgmaker-events-viewer](https://github.com/Kokoroou/rpgmaker-events-viewer) |

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
