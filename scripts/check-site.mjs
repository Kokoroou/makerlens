#!/usr/bin/env node
// Checks the assembled site in _site/ (run `npm run build` first; no dependencies).
//   1. each tool landed at its subpath (/assets/, /events/);
//   2. pages in site/ (landing, 404) have a CSP <meta> with no inline <script>
//      (script-src is 'self' only) and no external host but GoatCounter;
//   3. every local src/href in those pages resolves to a file in _site/;
//   4. JSON-LD parses;
//   5. the shared design tokens are the same in every tool (Events keeps a verbatim
//      copy of Assets' css/tokens.css so both tools share one look);
//   6. SEO basics on every page of the assembled site, tools included: the root
//      favicon exists (Google shows one per hostname, from the home page), and each
//      og:image / twitter:image / JSON-LD image on this host resolves to a file;
//   7. the IndexNow key file (<32 hex>.txt, see scripts/indexnow.mjs) is served at the root;
//   8. page basics of the pages in site/: exactly one <h1>, a title in the family format
//      ('... | MakerLens', og:title/twitter:title equal to it), the Privacy and Legal pages
//      with their anchors, the /assets/privacy.html -> /privacy.html redirect in _redirects,
//      and every sitemap URL on this host resolves to a file in _site/.
// The tools' own pages are checked in their repos.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexNowKey } from './indexnow.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '_site');
const ALLOWED_HOSTS = new Set(['makerlens.goatcounter.com']);
const errors = [];
const fail = (f, m) => errors.push(`${f}: ${m}`);

if (!existsSync(out)) { console.error('No _site/ — run `npm run build` first.'); process.exit(1); }

// 1. Tools in place
for (const p of ['index.html', 'assets/index.html', 'assets/js/site.js', 'assets/js/analytics.js', 'assets/css/tokens.css', 'events/index.html', 'events/css/tokens.css']) {
  if (!existsSync(join(out, p))) fail('_site', `missing ${p}`);
}

// 5. Shared design system: one tokens.css and one lens layer (css/lens.css + js/lens-gate.js) for the whole family
const SHARED = ['css/tokens.css', 'css/lens.css', 'js/lens-gate.js'];
for (const f of SHARED) {
  const a = join(out, 'assets', f), e = join(out, 'events', f);
  if (existsSync(a) && existsSync(e) && readFileSync(a, 'utf8') !== readFileSync(e, 'utf8')) {
    fail('events/' + f, `differs from assets/${f}; copy it from rpgmaker-assets-viewer`);
  }
}

// Pages owned by this repo
// Search-console verification files (e.g. naver<hash>.html) are plain tokens, not pages.
const VERIFY_FILE = /^(?:naver[0-9a-f]+|google[0-9a-f]+)\.html$/;
const own = [];
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) walk(f); else if (n.endsWith('.html') && !VERIFY_FILE.test(n)) own.push(relative(join(root, 'site'), f));
  }
}(join(root, 'site')));

for (const page of own) {
  const html = readFileSync(join(out, page), 'utf8');
  // 2. CSP + inline scripts
  const csp = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i);
  if (!csp) fail(page, 'no Content-Security-Policy <meta> tag');
  else for (const m of csp[1].matchAll(/https?:\/\/([^\s;'"]+)/g)) {
    if (!ALLOWED_HOSTS.has(m[1])) fail(page, `CSP allows external host '${m[1]}'`);
  }
  for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1] || '';
    if (/type="application\/ld\+json"/.test(attrs)) {
      try { JSON.parse(m[2]); } catch (e) { fail(page, `invalid JSON-LD: ${e.message}`); }
    } else if (!/\bsrc=/.test(attrs)) fail(page, 'inline <script> (CSP script-src is \'self\' only; move it to a file)');
  }
  if (/\sstyle="/.test(html)) fail(page, 'inline style attribute (CSP style-src is \'self\' only)');
  // 3. Local references
  for (const m of html.matchAll(/\s(?:src|href)="([^"]+)"/g)) {
    if (/^(?:[a-z]+:|\/\/|#)/i.test(m[1])) continue;
    let ref = m[1].split(/[?#]/)[0];
    ref = ref.startsWith('/') ? ref.slice(1) : posix.join(posix.dirname(page), ref);
    const target = join(out, ref === '' || ref.endsWith('/') ? ref + 'index.html' : ref);
    if (!existsSync(target)) fail(page, `missing local file '${m[1]}'`);
  }
}

// 6. Favicon and share images, over every page in _site/ (tools included)
for (const f of ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png']) {
  if (!existsSync(join(out, f))) fail('_site', `missing ${f}`);
}
const ORIGIN = 'https://makerlens.kokoroou.com/';
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) { if (n !== 'vendor') walk(f); continue; }
    if (!n.endsWith('.html') || VERIFY_FILE.test(n)) continue;
    const html = readFileSync(f, 'utf8'), page = relative(out, f);
    const urls = new Set([
      ...[...html.matchAll(/<meta\s+(?:property|name)="(?:og:image|twitter:image)"\s+content="([^"]+)"/g)].map(m => m[1]),
      ...[...html.matchAll(/"(?:image|screenshot)":\s*"([^"]+)"/g)].map(m => m[1]),
    ]);
    for (const u of urls) {
      if (u.startsWith(ORIGIN) && !existsSync(join(out, u.slice(ORIGIN.length)))) fail(page, `share image ${u} is not in _site/`);
    }
  }
}(out));

// 7. IndexNow key file at the root
try {
  const key = indexNowKey();
  if (!existsSync(join(out, key + '.txt'))) fail('_site', `missing IndexNow key file ${key}.txt`);
} catch (e) { fail('site', e.message); }

// 8. Page basics
const decode = t => t.replace(/&amp;/g, '&');
for (const page of own) {
  const html = readFileSync(join(out, page), 'utf8');
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) fail(page, `expected exactly one <h1>, found ${h1}`);
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
  if (!title || !/ \| MakerLens$/.test(title)) fail(page, `title must end with ' | MakerLens' (got '${title}')`);
  else if (title.length > 65) fail(page, `title is ${title.length} characters (max 65)`);
  for (const p of ['og:title', 'twitter:title']) {
    const m = html.match(new RegExp(`<meta\\s+(?:property|name)="${p}"\\s+content="([^"]*)"`));
    if (m && m[1] !== title) fail(page, `${p} differs from <title>`);
  }
}
const REQUIRED = { 'privacy.html': ['files', 'analytics', 'feedback', 'hosting'], 'legal.html': ['does', 'use', 'not', 'you', 'rights', 'takedown'] };
for (const [page, ids] of Object.entries(REQUIRED)) {
  if (!existsSync(join(out, page))) { fail('_site', `missing ${page}`); continue; }
  const html = readFileSync(join(out, page), 'utf8');
  for (const id of ids) if (!html.includes(`id="${id}"`)) fail(page, `missing anchor #${id}`);
}
if (!existsSync(join(out, '_redirects')) || !/^\/assets\/privacy\.html\s+\/privacy\.html\s+301\s*$/m.test(readFileSync(join(out, '_redirects'), 'utf8'))) {
  fail('_site', '_redirects must send /assets/privacy.html to /privacy.html (301): Privacy has one home');
}
const sitemap = readFileSync(join(out, 'sitemap.xml'), 'utf8');
for (const m of sitemap.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
  if (!m[1].startsWith(ORIGIN)) continue;
  const path = m[1].slice(ORIGIN.length);
  if (!existsSync(join(out, path === '' || path.endsWith('/') ? path + 'index.html' : path))) fail('sitemap.xml', `${m[1]} is not in _site/`);
}

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`OK: ${own.length} pages checked, tools at /assets/ and /events/.`);
