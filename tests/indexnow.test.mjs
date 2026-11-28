// scripts/indexnow.mjs: the key file in site/ and the request body (no network).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { indexNowKey, indexNowBody, sitemapURLs } from '../scripts/indexnow.mjs';

test('site/ holds exactly one key file whose content is its name', () => {
  assert.match(indexNowKey(), /^[0-9a-f]{32}$/);
});

test('a key file with other content is refused', () => {
  const dir = mkdtempSync(join(tmpdir(), 'indexnow-'));
  writeFileSync(join(dir, 'a'.repeat(32) + '.txt'), 'b'.repeat(32));
  assert.throws(() => indexNowKey(dir), /must contain the key/);
});

test('URLs come from the sitemap, this host only', () => {
  const xml = '<loc>https://makerlens.kokoroou.com/</loc><loc> https://makerlens.kokoroou.com/assets/faq.html </loc><loc>https://example.com/</loc>';
  assert.deepEqual(sitemapURLs(xml), ['https://makerlens.kokoroou.com/', 'https://makerlens.kokoroou.com/assets/faq.html']);
});

test('body names the host and the key location on it', () => {
  const b = indexNowBody('0'.repeat(32), ['https://makerlens.kokoroou.com/']);
  assert.equal(b.host, 'makerlens.kokoroou.com');
  assert.equal(b.keyLocation, `https://makerlens.kokoroou.com/${'0'.repeat(32)}.txt`);
});
