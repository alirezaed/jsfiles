/*
 * v7 tracker — the pxid value is now the FingerprintJS visitorId (same "pxid" key, so the backend is unchanged).
 * Lines marked "CHANGED" differ from the original v7 script; everything else is untouched.
 *
 * FingerprintJS: if `window.FingerprintJS` already exists (bundled into the same file), it is used directly.
 * Otherwise this script loads fp.min.js itself — from data-fp-src, or from the same folder as this file.
 * Single-file build (recommended):
 *   { cat node_modules/@fingerprintjs/fingerprintjs/dist/fp.min.js; echo ';'; cat tracker-v7-fingerprint.js; } > script.js
 *
 * Optional attributes:
 *   data-fp-timeout="1500"          max ms to hold events while waiting for the ID
 *   data-fp-src="/js/fp.min.js"     where to load FingerprintJS from when it isn't bundled
 */
!function() {
    var o = window.location
      , r = window.document
      , e = r.currentScript
      , a = e.getAttribute("data-api") || new URL(e.src).origin + "/api/event"
      , s = e.getAttribute("data-domain")
      , l = e.getAttribute("data-site-key");
    function t(e, t) {
        try {
            r.cookie = e + "=" + encodeURIComponent(t || "") + "; expires=Fri, 31 Dec 9999 23:59:59 GMT; path=/"
        } catch (e) {
            console.warn("Cookie storage failed:", e)
        }
        try {
            window.localStorage.setItem(e, t)
        } catch (e) {
            console.warn("localStorage failed:", e)
        }
        try {
            window.sessionStorage.setItem(e, t)
        } catch (e) {
            console.warn("sessionStorage failed:", e)
        }
    }
    function n(e) {
        try {
            for (var t = e + "=", n = r.cookie.split(";"), i = 0; i < n.length; i++) {
                for (var o = n[i]; " " === o.charAt(0); )
                    o = o.substring(1);
                if (0 === o.indexOf(t))
                    return decodeURIComponent(o.substring(t.length))
            }
        } catch (e) {
            console.warn("Cookie read failed:", e)
        }
        try {
            var a = window.localStorage.getItem(e);
            if (a)
                return a
        } catch (e) {
            console.warn("localStorage read failed:", e)
        }
        try {
            return window.sessionStorage.getItem(e)
        } catch (e) {
            console.warn("sessionStorage read failed:", e)
        }
        return null
    }

    // ---- CHANGED: pxid comes from FingerprintJS instead of being generated + stored ----
    var fpTimeout = parseInt(e.getAttribute("data-fp-timeout") || "1500", 10)
      , c = null                // pxid = FingerprintJS visitorId; stays null if FingerprintJS fails or is too slow
      , idReady = new Promise(function(resolve) {
            var settled = !1;
            function finish() {
                settled || (settled = !0, resolve())
            }
            setTimeout(finish, fpTimeout); // never hold events longer than this
            loadFingerprintJS().then(function(FP) {
                return FP.load({ monitoring: !1 })
            }).then(function(agent) {
                return agent.get()
            }).then(function(result) {
                c = result.visitorId;
                clearLegacyPxid()
            }).catch(function(err) {
                console.warn("FingerprintJS failed:", err)
            }).then(finish)
        });
    // Use FingerprintJS if it's already on the page (bundled into this file or loaded earlier);
    // otherwise load fp.min.js from data-fp-src, or from the same folder as this script.
    function loadFingerprintJS() {
        if (window.FingerprintJS) return Promise.resolve(window.FingerprintJS);
        return new Promise(function(resolve, reject) {
            var sc = r.createElement("script");
            sc.src = e.getAttribute("data-fp-src") || new URL("fp.min.js", e.src).href;
            sc.async = !0;
            sc.onload = function() {
                window.FingerprintJS ? resolve(window.FingerprintJS) : reject(new Error("FingerprintJS not defined by " + sc.src))
            };
            sc.onerror = function() {
                reject(new Error("Failed to load " + sc.src))
            };
            (r.head || r.documentElement).appendChild(sc)
        })
    }
    function clearLegacyPxid() {
        // The random pxid stored by older versions is no longer read; remove it.
        // Remove only "pxid". pxid_session and pxid_last are still used for sessions.
        try { r.cookie = "pxid=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" } catch (e) {}
        try { window.localStorage.removeItem("pxid") } catch (e) {}
        try { window.sessionStorage.removeItem("pxid") } catch (e) {}
    }
    // Old links may still carry ?pxid=…; it's no longer used, so just strip it from the address bar.
    if (new URLSearchParams(o.search).has("pxid"))
        try {
            var i = new URL(o.href);
            i.searchParams.delete("pxid"),
            window.history.replaceState({}, r.title, i.toString())
        } catch (e) {
            console.warn("URL cleaning failed:", e)
        }
    // ---- end CHANGED ----

    var d, w = parseInt(n("pxid_last") || "0", 10), p = Date.now(), u = n("pxid_session"), g = !1;
    function h(e, t, n) {
        t && console.warn("Ignoring Event: " + t),
        n && n.callback && n.callback(),
        "pageview" === e && (d = !0)
    }
    (!u || 18e5 < p - w) && (u = p.toString(36) + Math.random().toString(36).substring(2, 10),
    g = !0),
    t("pxid_session", u),
    t("pxid_last", p.toString());
    var f = o.href
      , v = {}
      , S = -1
      , y = !1
      , m = null
      , b = 0;
    function x() {
        var e = r.body || {}
          , t = r.documentElement || {};
        return Math.max(e.scrollHeight || 0, e.offsetHeight || 0, e.clientHeight || 0, t.scrollHeight || 0, t.offsetHeight || 0, t.clientHeight || 0)
    }
    function _() {
        var e = r.body || {}
          , t = r.documentElement || {}
          , n = window.innerHeight || t.clientHeight || 0
          , t = window.scrollY || t.scrollTop || e.scrollTop || 0;
        return k <= n ? k : t + n
    }
    function I() {
        return m ? b + (Date.now() - m) : b
    }
    var k = x()
      , E = _();
    function L() {
        var e, t = I();
        !d && (S < E || 3e3 <= t) && (S = E,
        e = {},
        e = v ? "string" == typeof v ? JSON.parse(v) : v : e,   // CHANGED: no ".pxid = c" (O adds pxid)
        e.session_id = u,
        e.new_session = g ? 1 : 0,
        e = {
            n: "engagement",
            sd: Math.round(E / k * 100),
            d: s,
            u: f,
            p: JSON.stringify(e),
            e: t,
            v: 7
        },
        l && (e.sk = l),
        m = null,
        b = 0,
        O(a, e))
    }
    function C() {
        "visible" === r.visibilityState && r.hasFocus() && null === m ? m = Date.now() : "hidden" !== r.visibilityState && r.hasFocus() || (b = I(),
        m = null,
        L())
    }
    function H(e, t) {
        var n = "pageview" === e;
        if (n && y && (L(),
        k = x(),
        E = _()),
        /^localhost$|^127(\.[0-9]+){0,2}\.[0-9]+$|^\[::1?\]$/.test(o.hostname) || "file:" === o.protocol)
            return h(e, "localhost", t);
        if ((window._phantom || window.__nightmare || window.navigator.webdriver || window.Cypress) && !window.__plausible)
            return h(e, null, t);
        try {
            if ("true" === window.localStorage.plausible_ignore)
                return h(e, "localStorage flag", t)
        } catch (e) {}
        var i = {}
          , e = (i.n = e,
        i.v = 7,
        i.u = o.href,
        i.d = s,
        l && (i.sk = l),
        i.r = r.referrer || null,
        {});
        e = t && t.props ? "string" == typeof t.props ? JSON.parse(t.props) : t.props : e,   // CHANGED: no ".pxid = c"
        e.session_id = u,
        e.new_session = g ? 1 : 0,
        i.p = JSON.stringify(e),
        t && t.meta && (i.m = JSON.stringify(t.meta)),
        t && !1 === t.interactive && (i.i = !1),
        n && (d = !1,
        f = i.u,
        v = i.p,
        S = -1,
        b = 0,
        m = Date.now(),
        y || (r.addEventListener("visibilitychange", C),
        window.addEventListener("blur", C),
        window.addEventListener("focus", C),
        y = !0),
        g = !1),
        O(a, i, t)
    }

    // ---- CHANGED: every event waits (max data-fp-timeout ms) for the ID, then gets it added to its props as pxid ----
    function O(url, payload, opts) {
        idReady.then(function() {
            var props = {};
            try {
                props = payload.p ? JSON.parse(payload.p) : {}
            } catch (e) {}
            c && (props.pxid = c);
            payload.p = JSON.stringify(props);
            send(url, payload, opts)
        })
    }
    // Original O(), renamed
    function send(t, e, n) {
        window.fetch && fetch(t, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain"
            },
            keepalive: !0,
            body: JSON.stringify(e)
        }).then(function(e) {
            n && n.callback && n.callback({
                status: e.status
            })
        }).catch(function(e) {
            console.error("Fetch failed:", e);
            try {
                (new Image).src = t.replace("/api/event", "/api/error") + "?message=" + encodeURIComponent("Fetch failed: " + e.message)
            } catch (e) {}
        })
    }
    // ---- end CHANGED ----

    window.addEventListener("load", function() {
        k = x();
        var e = 0
          , t = setInterval(function() {
            k = x(),
            15 == ++e && clearInterval(t)
        }, 200)
    }),
    r.addEventListener("scroll", function() {
        k = x();
        var e = _();
        E < e && (E = e)
    });
    var D = window.plausible && window.plausible.q || [];
    window.plausible = H;
    for (var R, U = 0; U < D.length; U++)
        H.apply(this, D[U]);
    function J(e) {
        e && R === o.pathname || (R = o.pathname,
        H("pageview"))
    }
    function F() {
        J(!0)
    }
    var M, N = window.history;
    N.pushState && (M = N.pushState,
    N.pushState = function() {
        M.apply(this, arguments),
        F()
    }
    ,
    window.addEventListener("popstate", F)),
    "hidden" === r.visibilityState || "prerender" === r.visibilityState ? r.addEventListener("visibilitychange", function() {
        R || "visible" !== r.visibilityState || J()
    }) : J(),
    window.addEventListener("pageshow", function(e) {
        e.persisted && J()
    })
}();