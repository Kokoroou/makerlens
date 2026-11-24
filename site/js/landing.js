// Landing page only: on a phone the optional detail blocks (<details class="more">, the FAQ)
// start closed to keep the page short; on a wide screen they start open. Nothing here is
// needed to read the page: without JS every block stays open.
(function () {
  var narrow = window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
  var items = document.querySelectorAll('details[data-m="closed"]');
  for (var i = 0; i < items.length; i++) {
    if (narrow) items[i].removeAttribute('open');
  }
}());
