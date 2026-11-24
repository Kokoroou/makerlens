// Theme for every page of the landing site. Same storage key and meaning as MakerLens Assets
// (same origin, so one choice for the whole family): localStorage 'theme' is 'light' or 'dark'
// only when the visitor overrode the system; otherwise tokens.css follows prefers-color-scheme.
// Loaded in <head> (applies the choice before first paint); the button wiring runs at
// DOMContentLoaded. The toggle is a button with aria-pressed (pressed = dark theme) and a
// constant label; <meta name="theme-color"> follows the shown theme.
(function () {
  var root = document.documentElement, KEY = 'theme';
  var COLORS = { light: '#f8fafc', dark: '#0b1120' };   // --bg of tokens.css
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  try {
    var saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  } catch (e) { /* storage blocked: keep the system theme */ }

  function sysDark() { return !!(mq && mq.matches); }
  function isDark() { var t = root.getAttribute('data-theme'); return t ? t === 'dark' : sysDark(); }

  var metas = [];
  function paint() {
    if (!metas.length) {
      var found = document.querySelectorAll('meta[name="theme-color"]');
      for (var i = 0; i < found.length; i++) metas.push({ el: found[i], media: found[i].getAttribute('media'), content: found[i].getAttribute('content') });
    }
    var explicit = root.getAttribute('data-theme');
    metas.forEach(function (m) {
      if (explicit) { m.el.removeAttribute('media'); m.el.setAttribute('content', COLORS[explicit]); }
      else { if (m.media) m.el.setAttribute('media', m.media); m.el.setAttribute('content', m.content); }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btns = document.querySelectorAll('[data-theme-toggle]');
    function sync() {
      for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-pressed', String(isDark()));
      paint();
    }
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var next = isDark() ? 'light' : 'dark';
        // Picking what the system already uses clears the override (as MakerLens Assets does).
        if ((next === 'dark') === sysDark()) {
          root.removeAttribute('data-theme');
          try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
        } else {
          root.setAttribute('data-theme', next);
          try { localStorage.setItem(KEY, next); } catch (e) { /* ignore */ }
        }
        sync();
      });
    }
    if (mq && mq.addEventListener) mq.addEventListener('change', sync);
    sync();
  });
}());
