// Runs only when no static file matches the request (assets are served first,
// run_worker_first is off), i.e. for directory URLs and real misses:
//   /assets/      → /assets/index.html  (200, the URL stays as is)
//   /assets       → 301 /assets/        (when that directory has an index.html)
//   anything else → /404.html with status 404
// html_handling is "none" so .html URLs stay exactly as on the old GitHub Pages
// site (canonicals, sitemaps and links all use /assets/faq.html).
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const get = path => env.ASSETS.fetch(new URL(path, url.origin), request);

    if (url.pathname.endsWith('/')) {
      const res = await get(url.pathname + 'index.html');
      if (res.ok) return res;
    } else if (!/\.[a-z0-9]+$/i.test(url.pathname)) {
      const res = await get(url.pathname + '/index.html');
      if (res.ok) return Response.redirect(new URL(url.pathname + '/' + url.search, url.origin), 301);
    }

    const notFound = await get('/404.html');
    return new Response(notFound.body, { status: 404, headers: notFound.headers });
  }
};
