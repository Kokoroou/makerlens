// Runs only when no static file matches the request (assets are served first,
// run_worker_first is off), i.e. for directory URLs and real misses:
//   /assets/      → /assets/index.html  (200, the URL stays as is)
//   /assets       → 301 /assets/        (when that directory has an index.html)
//   /a//b         → 301 /a/b            (repeated slashes collapsed)
//   anything else → /404.html with status 404
// html_handling is "none" so .html URLs stay exactly as on the old GitHub Pages
// site (canonicals, sitemaps and links all use /assets/faq.html).
//
// Every path and Location is built as origin + a path that starts with exactly one
// "/". Never pass a request path to new URL(path, base): "//evil.com/assets" is a
// protocol-relative URL there, which made /assets → /assets/ an open redirect.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const at = p => new URL(url.origin + p);
    const get = p => env.ASSETS.fetch(at(p), request);
    const redirect = p => Response.redirect(at(p + url.search), 301);

    const clean = path.replace(/\/{2,}/g, '/');
    if (clean !== path) return redirect(clean);

    if (path.endsWith('/')) {
      const res = await get(path + 'index.html');
      if (res.ok) return res;
    } else if (!/\.[a-z0-9]+$/i.test(path)) {
      const res = await get(path + '/index.html');
      if (res.ok) return redirect(path + '/');
    }

    const notFound = await get('/404.html');
    return new Response(notFound.body, { status: 404, headers: notFound.headers });
  }
};
