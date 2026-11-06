#!/usr/bin/env node
// Renders the MakerLens share images and icons with Playwright (Chromium), so they
// can be redrawn when a tool, a URL or the brand changes. Not part of the build:
// the PNG/ICO files it writes are committed.
//
//   node scripts/og-images.mjs              # site/og-image.png, favicon.ico, apple-touch-icon.png
//   ASSETS_SRC=../rpgmaker-assets-viewer EVENTS_SRC=../rpgmaker-events-viewer node scripts/og-images.mjs
//                                           # also <tool>/og-image.png in each tool repo
//
// Needs `playwright` resolvable (preinstalled in Claude Code cloud sessions; else
// `npm i --no-save playwright && npx playwright install chromium`) and the Inter font
// for the closest match to system-ui on the share card. Then shrink the share images
// (~210 KB → ~80 KB, no visible change) with Pillow:
//   python3 -c "from PIL import Image as I; import sys; [I.open(p).convert('RGB').quantize(256, dither=I.Dither.FLOYDSTEINBERG).save(p, optimize=True) for p in sys.argv[1:]]" site/og-image.png …
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'makerlens.kokoroou.workers.dev';

const ICON = {
  folder: '<path d="M3 17V7.5A2.5 2.5 0 015.5 5H9l2 2.5h6A2.5 2.5 0 0119.5 10v.5"/><path d="M3 17l2.2-5.6A2 2 0 017.1 10H20a1 1 0 01.9 1.4l-2.4 6A2.5 2.5 0 0116.2 19H5a2 2 0 01-2-2z"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 002 2h10a2 2 0 002-2V9M10 13h4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="9.5" r="1.8"/><path d="M21 16l-5.5-5.5L5 20"/>',
  flow: '<rect x="3" y="3" width="7" height="6" rx="1.5"/><rect x="14" y="15" width="7" height="6" rx="1.5"/><path d="M6.5 9v3.5a2 2 0 002 2h6"/><path d="M12.5 12.5l2 2-2 2"/>',
  choice: '<path d="M12 3v6M12 9l-6 6M12 9l6 6"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
};
const MARK = '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/><path d="M7.5 12.5l2-2.5 1.5 1.8 1-1.3 1.5 2" stroke-width="1.6"/>';
const svg = (paths, size, sw = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const CARDS = {
  family: {
    suffix: '', path: '/',
    title: 'Look inside<br>RPG Maker games',
    sub: 'Free tools that open a game folder right in your browser. Nothing to install.',
    chips: ['MV', 'MZ', 'XP', 'VX', 'VX Ace'],
    items: [
      ['image', 'MakerLens Assets', 'Extract encrypted images and audio'],
      ['flow', 'MakerLens Events', 'Event dialogue and choices as a graph'],
      ['eye', 'Read-only', 'The game is never changed'],
      ['folder', 'No install, no account', 'Works in Chrome, Edge and Firefox'],
    ],
  },
  assets: {
    suffix: 'Assets', path: '/assets/',
    title: 'View &amp; extract<br>RPG Maker assets',
    sub: 'Preview encrypted images and audio, then download them — right in your browser.',
    chips: ['MV', 'MZ', 'XP', 'VX', 'VX Ace'],
    items: [
      ['folder', 'Open a game folder', '.rpgmvp · .png_ · .rpgmvo · .ogg_', true],
      ['archive', 'Open RGSSAD archives', '.rgssad · .rgss2a · .rgss3a', true],
      ['search', 'Search &amp; preview', 'Images, OGG and M4A audio in-browser'],
      ['download', 'Download as ZIP', 'Single files or a whole folder'],
    ],
  },
  events: {
    suffix: 'Events', path: '/events/',
    title: 'RPG Maker events<br>as a flow graph',
    sub: 'Dialogue, choices, conditions and jumps of every event — right in your browser.',
    chips: ['MV', 'MZ'],
    items: [
      ['folder', 'Open a game folder', 'or just its data/ folder', false],
      ['flow', 'Maps &amp; common events', 'Every page as an interactive flow graph'],
      ['choice', 'Choices &amp; conditions', 'Switch, variable and actor names resolved'],
      ['key', 'Find what unlocks it', 'Endings, hidden routes, labels and jumps'],
    ],
  },
};

function cardHTML(c) {
  const word = `Maker<span class="g">Lens</span>${c.suffix ? ` <span class="sfx">${c.suffix}</span>` : ''}`;
  const items = c.items.map(([ic, h, p, mono]) =>
    `<div class="item"><span class="ic">${svg(ICON[ic], 20)}</span><div><b>${h}</b><small class="${mono ? 'mono' : ''}">${p}</small></div></div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#f1f5f9;
    background:radial-gradient(520px 360px at 300px 260px,rgba(34,197,94,.13),transparent 70%),
      radial-gradient(circle,rgba(148,163,184,.09) 1px,transparent 1.2px) 0 0/24px 24px,#0b1120}
  .wrap{display:flex;gap:48px;padding:72px 80px 0}
  .left{flex:1;display:flex;flex-direction:column;height:530px}
  .brand{display:flex;align-items:center;gap:18px}
  .mark{width:64px;height:64px;border-radius:16px;display:grid;place-items:center;background:rgba(34,197,94,.12);border:1.5px solid rgba(34,197,94,.3);color:#4ade80}
  .word{font-size:40px;font-weight:700;letter-spacing:-.02em}.g{color:#4ade80}.sfx{color:#94a3b8;font-weight:600}
  h1{font-size:58px;line-height:1.08;letter-spacing:-.035em;font-weight:800;margin-top:56px}
  p{font-size:25px;line-height:1.35;color:#94a3b8;margin-top:22px;max-width:500px}
  .chips{display:flex;gap:10px;margin-top:auto;padding:0}
  .chips li{list-style:none;padding:7px 16px;border-radius:999px;background:#1e293b;border:1px solid #334155;color:#cbd5e1;font-weight:600;font-size:19px}
  .url{font-family:'DejaVu Sans Mono',monospace;color:#64748b;font-size:16px;margin-top:22px}
  .right{width:440px;display:flex;flex-direction:column;gap:14px;padding-top:32px}
  .item{display:flex;gap:16px;align-items:center;padding:17px 20px;border-radius:12px;background:rgba(15,23,42,.85);border:1px solid #1e293b}
  .ic{width:40px;height:40px;flex:none;border-radius:9px;display:grid;place-items:center;background:rgba(34,197,94,.1);color:#4ade80}
  b{display:block;font-size:20px;font-weight:600}small{display:block;font-size:15.5px;color:#94a3b8;margin-top:3px}
  small.mono{font-family:'DejaVu Sans Mono',monospace;font-size:14px}
  .safe{display:flex;gap:12px;align-items:center;padding:14px 20px;border-radius:12px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.3);color:#4ade80;font-weight:600;font-size:19px}
  </style></head><body><div class="wrap">
  <div class="left"><div class="brand"><span class="mark">${svg(MARK, 34)}</span><span class="word">${word}</span></div>
  <h1>${c.title}</h1><p>${c.sub}</p>
  <ul class="chips">${c.chips.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
  <div class="url">${HOST}${c.path}</div></div>
  <div class="right">${items}<div class="safe">${svg(ICON.shield, 20)}Your files never leave your device</div></div>
  </div></body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
async function shot(html, file, clip) {
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(file, await page.screenshot({ type: 'png', clip, omitBackground: !!clip }));
  console.log('wrote', file);
}

await shot(cardHTML(CARDS.family), join(root, 'site/og-image.png'));
for (const [name, env] of [['assets', 'ASSETS_SRC'], ['events', 'EVENTS_SRC']]) {
  if (process.env[env]) await shot(cardHTML(CARDS[name]), join(resolve(process.env[env]), 'og-image.png'));
}

// Icons from site/favicon.svg: apple-touch-icon (180, opaque) and favicon.ico (16/32/48 PNGs).
const fav = readFileSync(join(root, 'site/favicon.svg'), 'utf8');
const iconPage = s => `<!doctype html><body style="margin:0;background:transparent"><div style="width:${s}px;height:${s}px">${fav.replace('<svg ', `<svg width="${s}" height="${s}" `)}</div></body>`;
const png = async s => { await page.setContent(iconPage(s)); return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: s, height: s }, omitBackground: true }); };
const touch = (await page.setContent(`<!doctype html><body style="margin:0;background:#15803d"><div style="width:180px;height:180px;display:grid;place-items:center">${fav.replace('<svg ', '<svg width="150" height="150" ').replace(/<rect[^>]*\/>/, '')}</div></body>`),
  await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 180, height: 180 } }));
writeFileSync(join(root, 'site/apple-touch-icon.png'), touch);
console.log('wrote site/apple-touch-icon.png');

const sizes = [16, 32, 48];
const images = [];
for (const s of sizes) images.push(await png(s));
// ICO container with embedded PNGs (supported by every current browser and by Google).
const head = Buffer.alloc(6 + 16 * sizes.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
let offset = head.length;
sizes.forEach((s, i) => {
  const e = 6 + 16 * i;
  head.writeUInt8(s, e); head.writeUInt8(s, e + 1); head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3);
  head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
  head.writeUInt32LE(images[i].length, e + 8); head.writeUInt32LE(offset, e + 12);
  offset += images[i].length;
});
writeFileSync(join(root, 'site/favicon.ico'), Buffer.concat([head, ...images]));
console.log('wrote site/favicon.ico');
await browser.close();
