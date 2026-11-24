#!/usr/bin/env node
// Tell IndexNow search engines (Bing, Yandex, Naver, Seznam…; not Google) that the
// pages in site/sitemap.xml changed. Run by .github/workflows/deploy.yml after
// `wrangler deploy`; no dependencies.
//
// The key is not a secret: IndexNow proves ownership by fetching
// https://<host>/<key>.txt, whose content must be the key. It lives in site/ as
// <32 hex>.txt; this script finds it there, so the key is written in one place only.
//
//   node scripts/indexnow.mjs            # submit
//   node scripts/indexnow.mjs --dry-run  # print the request body only
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'site');
const HOST = 'makerlens.kokoroou.workers.dev';
export const KEY_FILE = /^([0-9a-f]{32})\.txt$/;

export function indexNowKey(dir = site) {
  const keys = readdirSync(dir).map(n => n.match(KEY_FILE)).filter(Boolean);
  if (keys.length !== 1) throw new Error(`expected one IndexNow key file (<32 hex>.txt) in site/, found ${keys.length}`);
  const key = keys[0][1];
  if (readFileSync(join(dir, keys[0][0]), 'utf8').trim() !== key) throw new Error(`site/${key}.txt must contain the key`);
  return key;
}

export function sitemapURLs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]).filter(u => new URL(u).host === HOST);
}

export function indexNowBody(key, urls) {
  return { host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList: urls };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const body = indexNowBody(indexNowKey(), sitemapURLs(readFileSync(join(site, 'sitemap.xml'), 'utf8')));
  if (process.argv.includes('--dry-run')) { console.log(JSON.stringify(body, null, 2)); process.exit(0); }
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  // 200 = accepted, 202 = accepted, key not verified yet (first submissions)
  console.log(`IndexNow: HTTP ${res.status} for ${body.urlList.length} URLs`);
  if (res.status !== 200 && res.status !== 202) { console.error(await res.text()); process.exit(1); }
}
