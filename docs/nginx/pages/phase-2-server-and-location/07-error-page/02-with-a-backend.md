---
title: "error_page with a backend"
sidebar_label: "02 · With a backend"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
> (`proxy_intercept_errors`) and [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html)
> — `recursive_error_pages` (default `off`), `msie_refresh` (default `off`), the
> `error_page` inheritance sentence, *"If `uri` processing leads to an error, the
> status code of the last occurred error is returned to the client"*, and the
> ten-internal-redirect limit.
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**By default nginx passes a backend's error response straight through and your
`error_page` never fires. Turning that off is one directive, and whether you
should depends entirely on who is reading the response.**

## Intercepting upstream errors

```nginx
location /api/ {
    proxy_pass http://app;
    proxy_intercept_errors on;      # let nginx handle backend error codes
    error_page 502 503 504 /50x.html;
}
```

`proxy_intercept_errors on;` makes nginx handle upstream statuses with its own
`error_page` rules — **but only for codes an `error_page` is actually defined
for.** Anything else still passes through.

That detail matters: turning it on does not blanket-replace every backend error.
It replaces exactly the ones you listed, which makes a partial policy possible.

### Whether you should

| Turn it **on** when | Leave it **off** when |
|---|---|
| The backend's error pages are ugly or leak framework details | The client is a program |
| You want one consistent look across several backends | The backend returns structured errors worth preserving |
| The audience is a human with a browser | You need to distinguish 422 from 500 by reading the body |

🔴 **For an API, leave it off.** Your backend's carefully shaped JSON — with its
error code, message and request id — gets replaced by nginx's HTML, and the client
loses everything except the status. Frontend error handling that reads
`error.code` stops working, and so does anything correlating by request id.

The reasonable arrangement is to split by audience:

```nginx
# HTML routes — intercept, show the branded page.
location / {
    proxy_pass http://app;
    proxy_intercept_errors on;
    error_page 500 502 503 504 /_errors/50x.html;
}

# API routes — do not intercept. The backend's JSON errors pass through.
location /api/ {
    proxy_pass http://app;
    # proxy_intercept_errors stays off (the default)
}
```

A related pairing worth knowing early: `proxy_next_upstream` decides whether a
failed request is *retried on another backend* before any of this happens
(Phase 8). Interception is about presenting a failure; `proxy_next_upstream` is
about avoiding one.

## `recursive_error_pages`

```text
Syntax:  recursive_error_pages on | off;
Default: recursive_error_pages off;
```

Off by default, meaning **an error while processing an error page does not trigger
another `error_page`**. The documentation states the fallback behaviour: *"If
`uri` processing leads to an error, the status code of the last occurred error is
returned to the client."*

That default is deliberate and correct. It is what stops a missing `/404.html`
from generating a 404 that fetches `/404.html` that generates a 404. A broken
error page degrades to a plain status code rather than to a loop.

If you turn it on, the ten-internal-redirect limit is what catches you, and the
result is a **500** with `rewrite or internal redirection cycle` in the error log
([topic 06, chunk 02](../06-internal-redirects/02-cycles-and-debugging.md)).

**Leave it off unless you have a specific reason**, and if you turn it on, verify
every error page terminates.

## Inheritance

The familiar sentence applies here too:

> *"These directives are inherited from the previous configuration level if and
> only if there are no `error_page` directives defined on the current level."*

So a `location` that defines **any** `error_page` loses **all** of the ones set at
`server` level. This catches people who add one specific override — a custom 403
for an admin path, say — and silently lose their generic 50x page for that
location.

```nginx
server {
    error_page 500 502 503 504 /_errors/50x.html;
    error_page 404             /_errors/404.html;

    location /admin/ {
        error_page 403 /_errors/403.html;   # ✗ the 404 and 50x pages are now GONE here
    }
}
```

Either repeat them, or — the better habit — define every `error_page` at `server`
level and none in children. It is
[Phase 1, page 02](../../phase-1-configuration-language/02-inheritance.md) again,
and it is the third directive family on which that rule has bitten in this bible.

## `msie_refresh`

```text
Syntax:  msie_refresh on | off;
Default: msie_refresh off;
```

Issues meta-refreshes instead of redirects for MSIE clients. Documented, off by
default, and there is no reason to enable it in 2026. Listed here so you recognise
it if you inherit a config that sets it.

## A complete, safe arrangement

```nginx
server {
    root /srv/dist;

    # Shared error pages, defined ONCE at server level.
    error_page 404             /_errors/404.html;
    error_page 500 502 503 504 /_errors/50x.html;

    location ^~ /_errors/ {
        internal;                       # not reachable from outside
        root /srv/static;
    }

    # API: no interception, no error_page of its own.
    location /api/ {
        proxy_pass http://app;
    }

    # HTML: SPA fallback; a genuine miss reaches the shared 404 page.
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Three deliberate decisions in that config:

1. **`/api/` sets no `error_page`** — both because the backend's errors should
   reach the client, and because defining one there would discard the
   server-level pair.
2. **`^~ /_errors/`** so no regex location can intercept the error pages
   ([page 03](../03-location-matching/02-the-asymmetry.md)), and `internal` so
   nobody can request them.
3. **`recursive_error_pages` is left at its default** of `off`.

## Gotchas

**Symptom:** A custom error page is configured and the backend's error page is
still shown.
**Cause:** The error came from the upstream, and `proxy_intercept_errors` is off
by default.
**Fix:** Turn it on for that location — and only if you actually want nginx's page
instead of the backend's.

**Symptom:** You turned on `proxy_intercept_errors` and only some backend errors
changed.
**Cause:** It only handles codes you have an `error_page` for. The rest pass
through.
**Fix:** List every code you intend to intercept.

**Symptom:** API clients cannot distinguish a 422 from a 500; every error is the
same HTML.
**Cause:** `proxy_intercept_errors on;` on an API location, replacing structured
JSON bodies.
**Fix:** Leave it off for `/api/`. Intercept HTML routes only.

**Symptom:** Adding one `error_page` in a `location` lost the generic 50x page
there.
**Cause:** The replace rule — defining any `error_page` at a level discards the
inherited set.
**Fix:** Define them all at `server` level and none in children, or repeat the
inherited ones.

**Symptom:** A 500 with `rewrite or internal redirection cycle` pointing at your
error page.
**Cause:** The error page itself errors, with `recursive_error_pages on;`.
**Fix:** Turn recursion off (the default) and make sure the error page exists.

**Symptom:** The error page is served but with the wrong `root`.
**Cause:** The internal redirect went through location matching and landed
somewhere with a different `root` — often `location /`.
**Fix:** Give error pages their own `^~` location with an explicit `root`, as in
the arrangement above.

## Trade-off

**`error_page` lets nginx present a consistent face for failures, at the cost of
hiding what actually happened.** A branded 500 page is better for a human than a
raw framework stack trace, and `proxy_intercept_errors` is the only way to get one
consistently across several backends.

But every layer of prettying loses information: the backend's status code, its
error body, its request id. For anything a human reads that is a good trade; for
anything a program reads it is a bad one. **Split the configuration by audience —
HTML routes get error pages, API routes get the truth** — and keep the shared
pages defined once, at `server` level, so the inheritance rule never gets a chance
to quietly remove them.

## Interview questions

**★ Why does a custom `error_page` not fire for backend errors?**
Because upstream error responses are passed through untouched by default.
`proxy_intercept_errors on;` makes nginx handle them with its own `error_page`
rules — and only for the codes you have actually defined an `error_page` for.

**★ Why should you not intercept errors on an API location?**
Because it replaces the backend's structured error response — code, message,
request id — with nginx's HTML. The client keeps the status and loses everything
else, so frontend handling that reads `error.code` and any correlation by request
id both break.

**★ What is `recursive_error_pages`, and why is it off by default?**
It allows an error occurring while processing an error page to trigger another
`error_page`. It defaults to off so a broken error page degrades to a plain status
code — the documentation says the status of the last error is returned — rather
than looping until the ten-redirect limit produces a 500.

**★ What happens if you define one `error_page` inside a `location`?**
You lose every `error_page` inherited from `server` level. It is multi-valued, so
the replace-not-merge rule applies. The safe habit is to define them all at
`server` level and none in children.

**How would you lay out error pages for a site with both HTML routes and an API?**
Define the shared pages once at `server` level; put them in a `^~ /_errors/`
location marked `internal` with its own `root`; enable `proxy_intercept_errors`
only on the HTML locations; and give the API location no `error_page` at all, so
its backend errors reach the client intact.

**Your error page is served with the wrong `root`. Why?**
Because the internal redirect goes through normal location matching, and the error
URI landed in a location with a different `root` — often `location /`. Give the
error pages their own location with an explicit `root`, protected with `^~`.

---

← Prev: [The directive and its forms](01-the-directive.md) · Index: [`error_page`](README.md) · Syllabus → [Part 1 — How nginx works](../../../syllabus/01-how-nginx-works.md)
