#!/usr/bin/env node
// Checks the assembled site in _site/ (run `npm run build` first; no dependencies).
//   1. each tool landed at its subpath (/assets/, /events/);
//   2. pages in site/ (landing, 404) have a CSP <meta> with no inline <script>
//      (script-src is 'self' only) and no external host but GoatCounter;
//   3. every local src/href in those pages resolves to a file in _site/;
//   4. JSON-LD parses.
// The tools' own pages are checked in their repos.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '_site');
const ALLOWED_HOSTS = new Set(['kokoroou.goatcounter.com']);
const errors = [];
const fail = (f, m) => errors.push(`${f}: ${m}`);

if (!existsSync(out)) { console.error('No _site/ — run `npm run build` first.'); process.exit(1); }

// 1. Tools in place
for (const p of ['index.html', 'assets/index.html', 'assets/js/site.js', 'assets/js/analytics.js', 'assets/css/tokens.css', 'events/index.html']) {
  if (!existsSync(join(out, p))) fail('_site', `missing ${p}`);
}

// Pages owned by this repo
const own = [];
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) walk(f); else if (n.endsWith('.html')) own.push(relative(join(root, 'site'), f));
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

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`OK: ${own.length} pages checked, tools at /assets/ and /events/.`);
