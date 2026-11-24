// site/ source files: the shared Privacy and Legal pages, the redirect that gives Privacy one
// home, and the sitemap (no network, no build needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'site');
const read = f => readFileSync(join(site, f), 'utf8');

test('/assets/privacy.html is redirected to /privacy.html with a 301', () => {
  assert.match(read('_redirects'), /^\/assets\/privacy\.html\s+\/privacy\.html\s+301\s*$/m);
});

test('the sitemap lists Privacy and Legal at the root, not the old Privacy URL', () => {
  const xml = read('sitemap.xml');
  assert.match(xml, /<loc>https:\/\/makerlens\.kokoroou\.workers\.dev\/privacy\.html<\/loc>/);
  assert.match(xml, /<loc>https:\/\/makerlens\.kokoroou\.workers\.dev\/legal\.html<\/loc>/);
  assert.doesNotMatch(xml, /assets\/privacy\.html/);
});

test('Privacy keeps the anchors the tools link to, Legal links both repositories', () => {
  const priv = read('privacy.html');
  for (const id of ['files', 'analytics', 'feedback', 'hosting']) assert.ok(priv.includes(`id="${id}"`), `#${id}`);
  const legal = read('legal.html');
  assert.ok(legal.includes('github.com/Kokoroou/rpgmaker-assets-viewer/blob/main/LEGAL.md'));
  assert.ok(legal.includes('github.com/Kokoroou/rpgmaker-events-viewer'));
});

test('page titles follow the family format', () => {
  for (const f of ['index.html', 'privacy.html', 'legal.html', '404.html']) {
    const t = read(f).match(/<title>([^<]*)<\/title>/)[1];
    assert.match(t, / \| MakerLens$/, f);
    assert.ok(t.length <= 65, `${f}: ${t.length} characters`);
  }
  assert.ok(existsSync(join(site, 'js', 'theme-init.js')));
});
