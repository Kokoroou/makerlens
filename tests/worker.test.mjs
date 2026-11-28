// src/worker.js against a fake ASSETS binding (node --test, no dependencies).
// Like the real binding, the fake looks files up by pathname only and ignores the host.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const FILES = new Set(['/index.html', '/404.html', '/assets/index.html', '/events/index.html']);
const env = {
  ASSETS: {
    async fetch(u) {
      const { pathname } = new URL(u instanceof Request ? u.url : u);
      return FILES.has(pathname)
        ? new Response(pathname, { status: 200, headers: { 'content-type': 'text/html' } })
        : new Response('', { status: 404 });
    }
  }
};
const ORIGIN = 'https://makerlens.kokoroou.com';
const OLD = 'https://makerlens.kokoroou.workers.dev';
const hit = path => worker.fetch(new Request(ORIGIN + path), env);

test('directory URL serves its index.html', async () => {
  const res = await hit('/assets/');
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '/assets/index.html');
});

test('directory without slash redirects to the slash URL, keeping the query', async () => {
  const res = await hit('/assets?utm_source=x');
  assert.equal(res.status, 301);
  assert.equal(res.headers.get('location'), `${ORIGIN}/assets/?utm_source=x`);
});

test('miss serves 404.html with status 404', async () => {
  const res = await hit('/nope');
  assert.equal(res.status, 404);
  assert.equal(await res.text(), '/404.html');
});

for (const path of ['//evil.com/assets', '//evil.com/assets/', '///evil.com/events', '/\\evil.com/assets']) {
  test(`no open redirect: ${path}`, async () => {
    const res = await hit(path);
    const loc = res.headers.get('location');
    if (loc) assert.equal(new URL(loc).origin, ORIGIN, `redirected off-site to ${loc}`);
  });
}

test('repeated slashes collapse onto this origin', async () => {
  const res = await hit('//evil.com/assets');
  assert.equal(res.status, 301);
  assert.equal(res.headers.get('location'), `${ORIGIN}/evil.com/assets`);
  const next = await hit('/evil.com/assets');
  assert.equal(next.status, 404);
});

test('a static file is served as is', async () => {
  const res = await hit('/index.html');
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '/index.html');
});

for (const path of ['/', '/assets/', '/events/faq.html', '/privacy.html', '/nope', '/assets?utm_source=x']) {
  test(`old workers.dev URL redirects to the new domain: ${path}`, async () => {
    const res = await worker.fetch(new Request(OLD + path), env);
    assert.equal(res.status, 301);
    assert.equal(res.headers.get('location'), ORIGIN + path);
  });
}

for (const path of ['//evil.com/assets', '///evil.com/', '/\\evil.com/']) {
  test(`old host redirect stays on the new domain: ${path}`, async () => {
    const res = await worker.fetch(new Request(OLD + path), env);
    assert.equal(new URL(res.headers.get('location')).origin, ORIGIN);
  });
}
