// The Worker "makerlens" (wrangler.redirect.jsonc): the old address
// makerlens.kokoroou.workers.dev answers every request with a 301 to the same path
// and query on https://makerlens.kokoroou.com (the browser carries the #fragment over).
// The host is fixed and the path starts with exactly one "/", so no request path can
// send the redirect off-site ("//evil.com" becomes "/evil.com").
// Any other host (the custom domain, while it is still attached to this Worker) is
// passed to makerlens-site through the SITE service binding.
const HOME = 'https://makerlens.kokoroou.com';
// Permanent move: let browsers keep the redirect for 30 days, so a bookmark goes
// straight to the new home without asking this Worker again.
const MAX_AGE = 60 * 60 * 24 * 30;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname.endsWith('.workers.dev') || !env.SITE) {
      const path = url.pathname.replace(/\/{2,}/g, '/');
      return new Response(null, {
        status: 301,
        headers: { location: HOME + path + url.search, 'cache-control': `public, max-age=${MAX_AGE}` }
      });
    }
    return env.SITE.fetch(request);
  }
};
