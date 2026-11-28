// src/redirect.js: the old workers.dev address sends everything to the new home.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/redirect.js';

const OLD = 'https://makerlens.kokoroou.workers.dev';
const HOME = 'https://makerlens.kokoroou.com';
const env = { SITE: { fetch: async req => new Response('site:' + new URL(req.url).pathname) } };
const hit = (base, path) => worker.fetch(new Request(base + path), env);

for (const path of ['/', '/assets/', '/events/faq.html', '/privacy.html', '/nope', '/assets?utm_source=x']) {
  test(`old URL redirects to the same path on the new home: ${path}`, async () => {
    const res = await hit(OLD, path);
    assert.equal(res.status, 301);
    assert.equal(res.headers.get('location'), HOME + path);
    assert.match(res.headers.get('cache-control'), /max-age=\d+/);
  });
}

for (const path of ['//evil.com/assets', '///evil.com/', '/\\evil.com/']) {
  test(`no open redirect: ${path}`, async () => {
    const res = await hit(OLD, path);
    assert.equal(new URL(res.headers.get('location')).origin, HOME);
  });
}

test('the new home, if still attached here, is served by makerlens-site', async () => {
  const res = await hit(HOME, '/assets/');
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'site:/assets/');
});
