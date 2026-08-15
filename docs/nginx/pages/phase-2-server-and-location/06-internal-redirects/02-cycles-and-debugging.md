---
title: "Cycles, SPAs and debugging"
sidebar_label: "02 · Cycles, SPAs and debugging"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html)
> — *"There is a limit of 10 internal redirects per request to prevent request
> processing cycles … If this limit is reached, the error 500 (Internal Server
> Error) is returned. In such cases, the 'rewrite or internal redirection cycle'
> message can be seen in the error log."* — plus
> [ngx_http_rewrite_module](https://nginx.org/en/docs/http/ngx_http_rewrite_module.html)
> (`rewrite_log`, and the same cap from the loop's side) and
> [ngx_http_log_module](https://nginx.org/en/docs/http/ngx_http_log_module.html)
> (`log_format`).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**Two failure modes, and they are opposites. A cycle is loud — a 500 and a clear
error-log line. An SPA fallback swallowing your API is silent — a 200 carrying the
wrong content. The silent one is worse.**

## The ten-redirect limit

Quoted from the core module:

> *"There is a limit of **10 internal redirects per request** to prevent request
> processing cycles that can occur in incorrect configurations. If this limit is
> reached, **the error 500 (Internal Server Error) is returned**. In such cases,
> the 'rewrite or internal redirection cycle' message can be seen in the error
> log."*

The rewrite module documents the same cap from its side: the location-search loop
*"is repeated if a request URI was rewritten, but not more than 10 times"*.

So the **user-visible symptom is a 500**, and the diagnosis is in the error log:

```text
rewrite or internal redirection cycle while internally redirecting to "/index.html"
```

The message names the URI it was going round on, which is usually enough on its
own.

## The three classic cycles

### 1. A `try_files` fallback to a file that is not there

```nginx
location / {
    try_files $uri $uri/ /index.html;    # ✗ if /index.html is missing on disk
}
```

`/index.html` does not exist, so it matches `location /` again, `try_files` runs
again, and round it goes.

**This is almost always a deploy problem, not a config problem.** The config is
correct; the build output is missing or the `root` points somewhere else. Check
the file exists before touching the config.

Two structural fixes if you want it to fail loudly instead:

```nginx
try_files $uri $uri/ /index.html =404;   # terminate rather than loop
try_files $uri $uri/ @app;               # a named location that terminates
```

### 2. A rewrite whose output still matches its own pattern

```nginx
rewrite ^/(.*)$ /$1 last;                # ✗ the output always matches the input
```

**Fix:** anchor so the result cannot match again, or use `break` so it does not
re-enter matching at all.

### 3. An `error_page` that errors the same way

```nginx
error_page 404 /404.html;                # ✗ if /404.html itself 404s
```

`recursive_error_pages` is **off** by default precisely to stop this — the status
of the last error is returned instead of looping. If you turned it on, this is
what you get ([page 07](../07-error-page/README.md)).

## The SPA fallback, correctly

The most common internal redirect in a MERN or PERN deployment, and the most
commonly broken.

```nginx
# ✗ WRONG — the fallback covers /api too
location / {
    try_files $uri $uri/ /index.html;
}
location /api/ {
    proxy_pass http://app;
}
```

That looks fine, and it is — `location /api/` is the longer prefix and wins
([page 03](../03-location-matching/README.md)). The failure appears when the
fallback is written at `server` level, or when `/api` has no location of its own:

```nginx
# ✗ ACTUALLY WRONG — no /api location, so everything falls through
server {
    root /srv/dist;
    location / {
        try_files $uri $uri/ /index.html;   # /api/nope → index.html, status 200
    }
}
```

**What the client sees:** it asked for JSON, received HTML, and the status code
says **200**. `fetch` does not throw. `response.ok` is `true`. `res.json()` fails
with a parse error pointing at `<`, which is why
`Unexpected token '<', "<!DOCTYPE "... is not valid JSON` is one of the most
recognisable errors in frontend development. It is this configuration, every time.

```nginx
# ✓ RIGHT
server {
    root /srv/dist;

    location /api/ {
        proxy_pass http://app;              # no try_files, no fallback
    }

    location / {
        try_files $uri $uri/ /index.html;   # frontend routes only
    }
}
```

**The rule: the SPA fallback belongs to exactly one location, and that location
must not cover anything the backend owns.**

The same mistake reaches the same place via `error_page 404 =200 /index.html;` —
different directive, identical outcome (page 07).

## Making it visible

An internal redirect leaves no trace in a default access log. Fix that once and
you never debug it blind again:

```nginx
log_format redirects '$remote_addr "$request" '
                     'req="$request_uri" uri="$uri" '
                     'status=$status rt=$request_time';

access_log /var/log/nginx/access.log redirects;
```

**When `req=` and `uri=` differ, an internal redirect happened**, and the pair
tells you where the request started and where it ended. On the SPA bug above, you
would see `req="/api/nope" uri="/index.html" status=200` — the entire diagnosis in
one line.

Two more tools:

```bash
nginx -T | grep -n 'try_files\|error_page\|rewrite\|index\|X-Accel'   # every cause
```

```nginx
rewrite_log on;      # with error_log … notice; — logs rewrite decisions
```

`rewrite_log` is verbose and per-request, so turn it on to find a cycle and turn
it straight back off ([Phase 1](../../phase-1-configuration-language/08-rewrite-and-return.md)).

## Gotchas

**Symptom:** A 500, and `rewrite or internal redirection cycle while internally
redirecting to "/index.html"` in the error log.
**Cause:** The fallback target does not exist on disk, so the request re-enters
the same location repeatedly.
**Fix:** Check the file is deployed. The config is usually right.

**Symptom:** `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` in the
browser console.
**Cause:** An API request was caught by the SPA fallback and answered with
`index.html` at status 200.
**Fix:** Give the API its own `location` with `proxy_pass` and no `try_files`.

**Symptom:** Monitoring reports 100% success while users see a broken app.
**Cause:** Same thing — every failed API call returns 200. There is nothing for a
status-code monitor to see.
**Fix:** As above, and consider asserting on content type in your checks.

**Symptom:** You fixed the fallback and some clients still get HTML.
**Cause:** A cached response. The wrong answer was cacheable and is being served
from nginx's cache or a CDN.
**Fix:** Purge or wait out the TTL, and make sure error responses are not
cacheable (Phase 6).

**Symptom:** A cycle appeared only in production.
**Cause:** A different `root`, a missing build artefact, or an extra config file
matching the include glob in that environment.
**Fix:** `nginx -T` on the production host and compare. This is what `-T` is for
([Phase 0](../../phase-0-process-model/06-testing-the-config.md)).

**Symptom:** `try_files … =404` returns 404 for routes that should work.
**Cause:** The terminator fires whenever nothing in the list exists — including
legitimate SPA routes, if `/index.html` is not in the list before it.
**Fix:** `try_files $uri $uri/ /index.html =404;` — the fallback first, the
terminator last.

## Trade-off

**The ten-redirect cap turns an infinite loop into a 500, which is the right
trade and still loses information.** Without it a misconfiguration would hang a
worker; with it you get a clear failure and a log line naming the URI. But the
error tells you *where the loop was*, not *which directive started it*, and with
several `try_files` and `error_page` rules in play that can still take a while.

The deeper trade is the silent failure: nginx cannot know that turning a backend
404 into a 200 HTML page is wrong, because for a frontend route it is exactly
right. **Only your configuration knows which paths belong to the API**, which is
why the separation has to be explicit and why logging `$uri` alongside
`$request_uri` is worth the two extra fields.

## Interview questions

**★ What causes `rewrite or internal redirection cycle`, and what does the client
see?**
A URI that keeps being redirected back to something that redirects it again. nginx
caps internal redirects at ten per request and then returns **500**, logging that
message with the URI it was looping on. The classic cause is a `try_files`
fallback to a file that does not exist on disk.

**★ Why does an SPA fallback break an API?**
Because `try_files $uri $uri/ /index.html` catches the backend's 404 and
internally redirects to `index.html`, which is served with status **200**. The
client asked for JSON and got HTML with a success code — which is why
`Unexpected token '<', "<!DOCTYPE "...` is such a common frontend error.

**★ Why is that failure worse than a cycle?**
Because it is silent. A cycle is a 500 with a clear log line. The fallback returns
200, so `fetch` does not throw, `response.ok` is true, and status-code monitoring
reports the site as healthy while every API call is broken.

**How do you make internal redirects visible in your logs?**
Log `$request_uri` and `$uri` side by side. `$request_uri` is the original and
never changes; `$uri` is where the request ended up. When they differ, an internal
redirect happened — and on the SPA bug you would see
`req="/api/nope" uri="/index.html" status=200`, which is the whole diagnosis.

**What does `try_files $uri $uri/ /index.html =404;` do differently?**
The `=404` terminator makes the list fail loudly instead of looping if nothing
matches. Order matters: the fallback must come before the terminator, or
legitimate SPA routes get a 404.

**A cycle appears in production but not locally. Where do you look?**
`nginx -T` on the production host. The usual causes are a different `root`, a
build artefact that was not deployed, or an extra config file that matches the
include glob only in that environment.

---

← Prev: [The mechanism](01-the-mechanism.md) · Index: [Internal redirects](README.md) · Next → [`error_page`](../07-error-page/README.md)
