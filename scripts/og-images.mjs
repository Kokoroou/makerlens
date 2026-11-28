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
const HOST = 'makerlens.kokoroou.com';

const ICON = {
  folder: '<path d="M3 17V7.5A2.5 2.5 0 015.5 5H9l2 2.5h6A2.5 2.5 0 0119.5 10v.5"/><path d="M3 17l2.2-5.6A2 2 0 017.1 10H20a1 1 0 01.9 1.4l-2.4 6A2.5 2.5 0 0116.2 19H5a2 2 0 01-2-2z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="9.5" r="1.8"/><path d="M21 16l-5.5-5.5L5 20"/>',
  flow: '<rect x="3" y="3" width="7" height="6" rx="1.5"/><rect x="14" y="15" width="7" height="6" rx="1.5"/><path d="M6.5 9v3.5a2 2 0 002 2h6"/><path d="M12.5 12.5l2 2-2 2"/>',
  walk: '<circle cx="13" cy="4.5" r="2"/><path d="M9 21l2.5-6 2.5 2v4M8 12l2-4.5h4l2.5 3.5 2.5 1M11.5 15L10 9.5"/>',
  filter: '<path d="M4 5h16l-6 7.5V19l-4 2v-8.5z"/>',
  play: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M10 9v6l5-3z"/>',
  save: '<path d="M5 3h11l4 4v12a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 011-2z"/><path d="M8 3v5h7V3M8 21v-6h8v6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  monitor: '<rect x="2.5" y="4" width="19" height="12.5" rx="1.5"/><path d="M8.5 20.5h7M12 16.5v4"/>',
  laptop: '<rect x="4.5" y="5" width="15" height="10" rx="1.5"/><path d="M2 19h20"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
  tablet: '<rect x="4.5" y="2.5" width="15" height="19" rx="2"/><path d="M11 18.5h2"/>',
};
const MARK = '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/><path d="M7.5 12.5l2-2.5 1.5 1.8 1-1.3 1.5 2" stroke-width="1.6"/>';
const svg = (paths, size, sw = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Shared by the three cards. Versions in release order (2000 → MZ); the platforms the site
// runs on; the ways a game opens (the window bar's tabs). No folder or file names of a game,
// and no "download"/ZIP: the cards sell looking inside a game, not taking files out of it.
const VERSIONS = ['2000', '2003', 'XP', 'VX', 'VX Ace', 'MV', 'MZ'];
const PLATFORMS = [['monitor', 'Windows'], ['laptop', 'macOS'], ['phone', 'Android'], ['tablet', 'iOS']];
const CARDS = {
  family: {
    suffix: '', path: '/',
    title: 'Look inside your <em>RPG&nbsp;Maker</em> game',
    sub: 'Its images, sounds, dialogue and cutscenes, from 2000 to MZ. No install, no account.',
    tabs: ['Folder', 'Archive', 'Files', 'Link'],
    items: [
      ['image', 'MakerLens Assets', 'Encrypted images and audio, in one grid'],
      ['flow', 'MakerLens Events', 'Dialogue and choices as a graph'],
      ['play', 'Play the cutscenes', 'Pictures, faces, music, line by line'],
      ['eye', 'Read-only', 'The game is never changed'],
    ],
  },
  assets: {
    suffix: 'Assets', path: '/assets/',
    title: 'Every image &amp; sound, in <em>one grid</em>',
    sub: 'Preview the encrypted images and audio of any RPG Maker game, right in your browser.',
    tabs: ['Folder', 'Archive', 'Files', 'Link'],
    items: [
      ['folder', 'Open it any way', '.rpgmvp · .png_ · .rgss3a · .xyz', true],
      ['image', 'Images &amp; audio, decrypted', 'Shown and played in memory'],
      ['walk', 'Watch characters walk', 'Sprite sheets come to life'],
      ['filter', 'Filter &amp; spot duplicates', 'By size, length or identical content'],
    ],
  },
  events: {
    suffix: 'Events', path: '/events/',
    title: 'Follow the story<br><em>as a map</em>',
    sub: 'Dialogue, choices and switches of every event as a flow graph. Play the cutscenes.',
    tabs: ['Folder', 'Archive', 'Data', 'Link'],
    items: [
      ['flow', 'Every event as a graph', 'Switch, variable and actor names resolved'],
      ['play', 'Play the cutscenes', 'Pictures, faces, music, line by line'],
      ['save', 'Start from your save', 'Scenes follow your own progress'],
      ['folder', 'Open it any way', '.json · .rvdata2 · .rgss3a · .lmu', true],
    ],
  },
};

// The share card wears the site's "field guide" look (site/css/landing.css): paper with a
// faint grid, serif title, mono labels, 2px ink borders with a hard shadow, green as the
// only accent, the lens mark with three green pixels and the pixel-art hero of the landing
// page (its <symbol id="s-hero"> is reused). No URL on the card: the link preview shows it.
const SPRITES = readFileSync(join(root, 'site/index.html'), 'utf8').match(/<symbol id="s-hero"[\s\S]*?<\/symbol>/)[0];
const LENS = '<svg width="56" height="56" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="#0f172a" stroke-width="2"/><path d="M15 15l6 6" stroke="#0f172a" stroke-width="2.6" stroke-linecap="round"/><rect fill="#15803d" x="7" y="7" width="2" height="2"/><rect fill="#15803d" x="9" y="9" width="2" height="2"/><rect fill="#15803d" x="11" y="7" width="2" height="2"/></svg>';

function cardHTML(c) {
  const word = `Maker<i>Lens</i>${c.suffix ? ` <span class="sfx">${c.suffix}</span>` : ''}`;
  const items = c.items.map(([ic, h, p, mono]) =>
    `<div class="item"><span class="ic">${svg(ICON[ic], 22)}</span><div><b>${h}</b><small class="${mono ? 'mono' : ''}">${p}</small></div></div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  :root{--serif:Charter,'Bitstream Charter',Georgia,serif;--mono:'DejaVu Sans Mono',monospace;--ink:#0f172a;--t2:#475569;--g:#15803d}
  body{width:1200px;height:630px;overflow:hidden;font-family:var(--serif);color:var(--ink);background-color:#f8fafc;
    background-image:linear-gradient(rgba(15,23,42,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(15,23,42,.06) 1px,transparent 1px);
    background-size:28px 28px;border:10px solid var(--ink);position:relative}
  .wrap{display:flex;gap:44px;padding:50px 56px 0 62px}
  .left{flex:1;display:flex;flex-direction:column;height:520px}
  .brand{display:flex;align-items:center;gap:12px}
  .word{font-size:42px;font-weight:700;letter-spacing:-.02em}.word i{color:var(--g)}.sfx{color:var(--t2)}
  .kicker{align-self:flex-start;margin-top:30px;font:700 18px/1 var(--mono);color:var(--g);border:2.5px solid var(--g);background:#fff;border-radius:999px;padding:9px 18px;transform:rotate(-1.5deg)}
  h1{font-size:62px;line-height:1.02;letter-spacing:-.03em;font-weight:700;margin-top:22px}
  h1 em{font-style:italic;color:var(--g)}
  p{font-size:24px;line-height:1.36;color:var(--t2);margin-top:16px;max-width:580px}
  .rows{margin-top:auto;display:grid;gap:12px}
  .row{display:flex;align-items:center;gap:8px}
  .row>span{width:104px;flex:none;font:700 15px/1 var(--mono);color:var(--t2);text-transform:uppercase;letter-spacing:.04em}
  .row li{list-style:none;white-space:nowrap;display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border:2.5px solid var(--ink);border-radius:7px;background:#fff;font:700 18px/1 var(--mono)}
  .row li svg{color:var(--g)}
  .row ul{display:flex;gap:8px;padding:0}
  .right{width:430px;padding-top:6px}
  .card{background:#fff;border:3px solid var(--ink);border-radius:10px;box-shadow:9px 9px 0 var(--ink);overflow:hidden}
  .bar{display:flex;align-items:center;gap:14px;padding:0 0 0 18px;height:52px;border-bottom:3px solid var(--ink);background:#f1f5f9;font:700 15px var(--mono);color:var(--t2)}
  .tabs{display:flex;margin-left:auto;height:100%}.tabs i{font-style:normal;display:grid;place-items:center;padding:0 13px;border-left:2px solid var(--ink)}.tabs i:first-child{background:#fff;color:var(--ink);box-shadow:inset 0 -4px 0 var(--g)}
  .item{display:flex;gap:16px;align-items:center;padding:16px 20px;border-top:1.5px solid #cbd5e1}
  .item:first-of-type{border-top:0}
  .ic{width:44px;height:44px;flex:none;border-radius:8px;display:grid;place-items:center;background:var(--g);color:#fff;border:2.5px solid var(--ink)}
  b{display:block;font-size:22px;font-weight:700;line-height:1.2}small{display:block;font-size:17px;color:var(--t2);margin-top:3px}
  small.mono{font-family:var(--mono);font-size:15px}
  .stamp{position:absolute;left:1004px;top:448px;width:140px;height:140px;transform:rotate(-10deg)}
  .pk{fill:#0f172a}.ph{fill:#7b3f1d}.ps{fill:#efc59a}.pc{fill:#15803d}.pb{fill:#1d4ed8}.pw{fill:#f8fafc}
  .hero{position:absolute;left:900px;top:486px;width:72px;height:84px}
  </style></head><body><svg width="0" height="0" style="position:absolute">${SPRITES}</svg><div class="wrap">
  <div class="left"><div class="brand">${LENS}<span class="word">${word}</span></div>
  <span class="kicker">Free · In your browser · Nothing uploaded</span>
  <h1>${c.title}</h1><p>${c.sub}</p>
  <div class="rows"><div class="row ver"><span>RPG Maker</span><ul>${VERSIONS.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
  <div class="row"><span>Runs on</span><ul>${PLATFORMS.map(([ic, x]) => `<li>${svg(ICON[ic], 20)}${x}</li>`).join('')}</ul></div></div></div>
  <div class="right"><div class="card"><div class="bar"><span>Open</span><span class="tabs">${c.tabs.map(x => `<i>${x}</i>`).join('')}</span></div>${items}</div>
  <svg class="hero" viewBox="0 0 12 14" shape-rendering="crispEdges"><use href="#s-hero"/></svg>
  <svg class="stamp" viewBox="0 0 200 200"><circle cx="100" cy="100" r="94" fill="#f8fafc" stroke="#15803d" stroke-width="7"/><circle cx="100" cy="100" r="78" fill="none" stroke="#15803d" stroke-width="2.5" stroke-dasharray="3 5"/><circle cx="94" cy="62" r="21" fill="none" stroke="#15803d" stroke-width="7"/><path d="M110 78l23 23" stroke="#15803d" stroke-width="9" stroke-linecap="round"/><text x="100" y="130" text-anchor="middle" font-family="DejaVu Sans Mono" font-weight="700" font-size="21" fill="#15803d">STAYS HERE</text><text x="100" y="152" text-anchor="middle" font-family="DejaVu Sans Mono" font-size="13" fill="#15803d">0 bytes uploaded</text></svg>
  </div></div></body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
async function shot(html, file, clip) {
  // nosemgrep: javascript.playwright.security.audit.playwright-setcontent-injection.playwright-setcontent-injection -- HTML built from constants in this file and site/favicon.svg, no user data
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
// nosemgrep: javascript.playwright.security.audit.playwright-setcontent-injection.playwright-setcontent-injection -- HTML built from constants in this file and site/favicon.svg, no user data
const png = async s => { await page.setContent(iconPage(s)); return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: s, height: s }, omitBackground: true }); };
// nosemgrep: javascript.playwright.security.audit.playwright-setcontent-injection.playwright-setcontent-injection -- HTML built from constants in this file and site/favicon.svg, no user data
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
