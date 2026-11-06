// Apply the theme the visitor picked in MakerLens Assets (same origin, same
// localStorage key), before first paint. Without a choice, tokens.css follows
// prefers-color-scheme.
(function () {
  try {
    var t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* storage blocked: keep the system theme */ }
}());
