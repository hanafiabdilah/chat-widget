/*
 * The file a site pastes: `<script src="https://…/widget.js" data-app-id="…">`.
 *
 * It is deliberately tiny and deliberately separate from the widget bundle,
 * because the two want opposite caching. This address is written into other
 * people's HTML and can never change, so it is served with a short cache and
 * revalidated; the bundle it points at carries a content hash in its name and
 * is cached forever. Shipping a new widget then costs every visitor one small
 * revalidation instead of a full re-download, and no site has to touch the
 * snippet it pasted months ago.
 *
 * What it does, in order: find its own tag, collect settings, install the
 * queueing `window.PinglyChat` stub so a click during loading still opens the
 * widget, and pull in the bundle.
 *
 * `__PINGLY_BUNDLE__` is replaced at build time with the hashed bundle path,
 * relative to this file — see scripts/build-embed.mjs.
 */
(function () {
  var W = window;
  var D = document;

  function warn(message) {
    if (W.console && W.console.warn) W.console.warn('[pingly-chat] ' + message);
  }

  if (W.__pinglyChatLoader) {
    warn('the script is on this page twice — the second copy does nothing.');
    return;
  }
  W.__pinglyChatLoader = true;

  // `currentScript` is the tag being executed, which is exactly the tag whose
  // attributes we want. The fallback covers tag-injecting CMS plugins, which
  // sometimes run the code in a context where it is null.
  var script = D.currentScript;
  if (!script) {
    var candidates = D.querySelectorAll('script[data-app-id], script[src*="widget.js"]');
    script = candidates.length ? candidates[candidates.length - 1] : null;
  }

  // Everything is resolved against this file's own URL, so the widget follows
  // wherever it is served from without a rebuild.
  var here = (script && script.src) || '';
  var base = here.replace(/[^/]*(\?.*)?$/, '');
  var origin = '';
  var query = null;
  try {
    var parsed = new URL(here, W.location.href);
    origin = parsed.origin;
    query = parsed.searchParams;
  } catch (err) { /* file:// or an ancient browser — settings still work */ }

  var settings = {};

  function absorb(source) {
    if (!source) return;
    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) settings[key] = source[key];
    }
  }

  // Three ways in, most casual first. A site that only wants the bubble
  // writes one attribute; a site that wants a name on the conversation
  // declares an object. The object wins, because it is the deliberate one.
  if (script) {
    var data = script.dataset || {};
    if (data.appId) settings.appId = data.appId;
    if (data.apiUrl) settings.apiUrl = data.apiUrl;
    if (data.template) settings.template = data.template;
    if (data.zIndex) settings.zIndex = data.zIndex;
    if (data.locale) settings.locale = data.locale;
    if (data.accent) settings.accent = data.accent;
    if (data.appearance) settings.appearance = data.appearance;
    if (data.logoUrl) settings.logoUrl = data.logoUrl;
    if (data.open === 'true') settings.open = true;
    if (data.debug === 'true') settings.debug = true;
    // Only the negative is read. The home screen is the default, so an
    // attribute is how a site turns it off — never how it turns it on.
    if (data.home === 'false') settings.home = false;
  }
  // `?id=` on the script URL, for page builders that strip unknown attributes.
  if (query && query.get('id')) settings.appId = query.get('id');
  absorb(W.pinglyChatSettings);
  // A site may have declared its settings as `window.PinglyChat = { appId }`
  // instead — that name is about to become the API object, so read it first.
  if (W.PinglyChat && typeof W.PinglyChat === 'object' && !W.PinglyChat.__api && !W.PinglyChat.q) {
    absorb(W.PinglyChat);
  }

  if (!settings.appId) {
    warn('no app id. Add data-app-id="…" to the script tag (Pingly → Connections → your widget).');
    return;
  }

  // The API, before the bundle exists. Calls are recorded and replayed by the
  // bundle the moment it mounts, so a visitor clicking the site's own "Chat
  // with us" button one second after page load is not ignored.
  var queue = [];
  var stub = { q: queue, __stub: true };
  ['open', 'close', 'toggle', 'identify', 'destroy', 'on', 'off'].forEach(function (name) {
    stub[name] = function () {
      queue.push([name, Array.prototype.slice.call(arguments)]);
    };
  });
  stub.isOpen = function () { return false; };
  W.PinglyChat = stub;

  // The origin this file came from is, by construction, the origin that
  // answers /widget-api: Caddy serves both from the platform host. Handing it
  // over means the widget talks to whoever served it, instead of to whatever
  // address happened to be compiled in — which is the difference between a
  // mis-built bundle failing loudly here and failing on a customer's site.
  W.__pinglyChatBoot = { settings: settings, base: base, origin: origin };

  // The widget's first act is `GET /widget-api/config/{appId}` to a different
  // origin; warming the connection here overlaps DNS and TLS with the bundle
  // download instead of paying for them afterwards.
  var apiOrigin = settings.apiUrl || origin;
  if (apiOrigin) {
    try {
      var link = D.createElement('link');
      link.rel = 'preconnect';
      link.href = apiOrigin;
      link.crossOrigin = 'anonymous';
      (D.head || D.documentElement).appendChild(link);
    } catch (err) { /* a warm connection is an optimisation, never a blocker */ }
  }

  var bundle = D.createElement('script');
  // Bare identifier on purpose: the build replaces it with the hashed file
  // name. Inside a string it would ship to production as the literal text.
  bundle.src = base + __PINGLY_BUNDLE__;
  bundle.async = true;
  bundle.onerror = function () { warn('could not load the widget bundle from ' + bundle.src); };
  (D.head || D.documentElement).appendChild(bundle);
})();
