// webtracker: pageview tracker.
//
//   <script defer src="https://STATS_HOST/js/script.js" data-site-key="SITE_KEY" data-domain="example.com"></script>
//
// Optional attributes: data-api (custom endpoint), data-hash (hash-based routing), data-manual (no
// automatic pageviews). Custom events: webtracker('Signup', {props: {plan: 'pro'}, callback: fn}).
// Old Plausible snippets keep working: data-domain without data-site-key, and window.plausible(...).
//
// Every event carries a browser fingerprint (FingerprintJS, bundled in front of this file as a
// private variable) and is sent with credentials, so the server can give the same browser the same
// pxid on every site: from its own cookie where the browser allows it, from the fingerprint otherwise.
(function () {
  'use strict';

  var w = window;
  var d = document;
  var loc = w.location;
  var script = d.currentScript;
  var injected = w.__webtrackerConfig || {};
  var legacy = (w.plausible && w.plausible.o) || {};

  function attr(name) {
    return script ? script.getAttribute(name) : null;
  }

  var scriptSrc = (script && script.src) || '';
  var siteKey = injected.siteKey || attr('data-site-key');
  var domain = injected.domain || attr('data-domain') || loc.hostname.replace(/^www\./, '');
  var endpoint = attr('data-api') || legacy.endpoint || origin(scriptSrc) + '/api/event';
  var hashMode = attr('data-hash') !== null || legacy.hashBasedRouting === true || /\.hash\./.test(scriptSrc);
  var autoPageviews = attr('data-manual') === null && legacy.autoCapturePageviews !== false;

  function origin(url) {
    var a = d.createElement('a');
    a.href = url || loc.href;
    return a.protocol + '//' + a.host;
  }

  function ignoreReason() {
    if (/^localhost$|^127(\.[0-9]+){0,2}\.[0-9]+$|^\[::1?\]$/.test(loc.hostname) || loc.protocol === 'file:') {
      return 'localhost';
    }
    if (w._phantom || w.__nightmare || w.navigator.webdriver || w.Cypress) {
      return 'automation';
    }
    try {
      if (w.localStorage.webtracker_ignore === 'true' || w.localStorage.plausible_ignore === 'true') {
        return 'opted out';
      }
    } catch (e) {
      // storage blocked: not opted out
    }
    return null;
  }

  function send(name, options) {
    options = options || {};
    var done = function () {
      if (options.callback) options.callback();
    };
    var reason = ignoreReason();
    if (reason) {
      if (w.console && w.console.warn) w.console.warn('[webtracker] Ignoring event: ' + reason);
      done();
      return;
    }

    var payload = { n: name, u: options.u || options.url || loc.href, d: domain, r: d.referrer || null };
    if (siteKey) payload.k = siteKey;
    if (hashMode) payload.h = 1;
    if (options.interactive === false) payload.i = false;
    if (options.props) payload.p = options.props;

    if (fingerprintReady) {
      transmit(payload, done);
    } else {
      pending.push([payload, done]);
    }
  }

  function transmit(payload, done) {
    if (fingerprint) payload.f = fingerprint;
    var body = JSON.stringify(payload);

    // text/plain keeps this a "simple" cross-origin request, so the browser sends no preflight.
    // credentials: the server's pxid cookie (where the browser allows third-party cookies).
    if (w.fetch) {
      w.fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        credentials: 'include',
        keepalive: true,
        body: body
      }).then(done, done);
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint, true);
      xhr.withCredentials = true;
      xhr.setRequestHeader('Content-Type', 'text/plain');
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) done();
      };
      xhr.send(body);
    }
  }

  // Events wait for the fingerprint, but never longer than 1.5 s or past the page being left. A
  // fingerprint that arrives late is still used for later events.
  var fingerprint = null;
  var fingerprintReady = false;
  var pending = [];

  function fingerprintDone(value) {
    if (value) fingerprint = value;
    if (fingerprintReady) return;
    fingerprintReady = true;
    var queued = pending;
    pending = [];
    for (var i = 0; i < queued.length; i++) {
      transmit(queued[i][0], queued[i][1]);
    }
  }

  try {
    // monitoring: false turns off FingerprintJS's own usage ping to its vendor.
    FingerprintJS.load({ monitoring: false })
      .then(function (agent) {
        return agent.get();
      })
      .then(
        function (result) {
          fingerprintDone(result && result.visitorId);
        },
        function () {
          fingerprintDone(null);
        }
      );
  } catch (e) {
    fingerprintDone(null);
  }
  w.setTimeout(function () {
    fingerprintDone(null);
  }, 1500);
  w.addEventListener('pagehide', function () {
    fingerprintDone(null);
  });

  var lastPath = null;

  function pageview(force) {
    // A pushState that only changes the query string is not a new page.
    if (!force && !hashMode && lastPath === loc.pathname) return;
    lastPath = loc.pathname;
    send('pageview');
  }

  if (autoPageviews) {
    var history = w.history;
    if (history.pushState) {
      var push = history.pushState;
      history.pushState = function () {
        push.apply(this, arguments);
        pageview(false);
      };
      w.addEventListener('popstate', function () {
        pageview(false);
      });
    }
    if (hashMode) {
      w.addEventListener('hashchange', function () {
        pageview(true);
      });
    }
    w.addEventListener('pageshow', function (e) {
      if (e.persisted) pageview(true); // restored from the back/forward cache
    });

    if (d.visibilityState === 'hidden' || d.visibilityState === 'prerender') {
      // Don't count prerendered pages until the visitor actually sees them.
      var onVisible = function () {
        if (d.visibilityState === 'visible') {
          d.removeEventListener('visibilitychange', onVisible);
          pageview(true);
        }
      };
      d.addEventListener('visibilitychange', onVisible);
    } else {
      pageview(true);
    }
  }

  function api(name, options) {
    send(name, options);
  }
  api.init = function () {}; // old Plausible snippets call plausible.init()

  var queued = [].concat((w.webtracker && w.webtracker.q) || [], (w.plausible && w.plausible.q) || []);
  w.webtracker = api;
  w.plausible = api;
  for (var i = 0; i < queued.length; i++) {
    api.apply(null, queued[i]);
  }
})();
