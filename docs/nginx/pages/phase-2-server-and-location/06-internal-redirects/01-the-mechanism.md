---
title: "Internal redirects — the mechanism"
sidebar_label: "01 · The mechanism"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against [njs reference](https://nginx.org/en/docs/njs/reference.html)
> — *"In a new location, all request processing is repeated starting from
> `NGX_HTTP_SERVER_REWRITE_PHASE` for ordinary locations and from
> `NGX_HTTP_REWRITE_PHASE` for named locations"* —
> [ngx_http_rewrite_module](https://nginx.org/en/docs/http/ngx_http_rewrite_module.html)
> (the four flags), [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html)
> (`try_files`, `index`, `error_page`, `$request_uri` vs `$uri`) and
> [How nginx processes a request](https://nginx.org/en/docs/http/request_processing.html)
> (the `index` → `/index.php` worked example).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**The client asks for one thing. nginx decides a different URI should be served,
rewrites the URI, and runs location selection again. The browser is never told.**

## Where processing restarts

Quoted, and this is the precise mechanic:

> *"In a new location, all request processing is repeated starting from
> `NGX_HTTP_SERVER_REWRITE_PHASE` for ordinary locations and from
> `NGX_HTTP_REWRITE_PHASE` for named locations."*

- **Ordinary URI → the pipeline restarts earlier**, re-running server-level
  rewrites.
- **Named location (`@name`) → it restarts later**, skipping them. Less re-runs,
  so there is less to loop with — which is why a named location is the safer
  fallback target ([page 04](../04-named-and-internal.md)).

## The five causes

| Cause | Example |
|---|---|
| **`try_files`** | `try_files $uri $uri/ /index.html;` |
| **`index`** | `index index.html index.php;` |
| **`error_page`** | `error_page 404 /404.html;` |
| **`rewrite … last`** | `rewrite ^/api/(.*)$ /v2/$1 last;` |
| **`X-Accel-Redirect`** | a header in the upstream's response ([page 04](../04-named-and-internal.md)) |

The documentation's own worked example is `index`, and it is the one nobody
expects:

> a request for `/` matches `location /`, whose `index` directive finds
> `index.php`, so *"an internal redirect to `/index.php` occurs, and nginx
> searches locations again"* — this time reaching the `\.php$` regex block.

**`index` is a redirect.** So is `error_page`. Neither reads like one.

## `$uri` changes; `$request_uri` does not

This is the practical fingerprint, and the reason the distinction from
[Phase 1](../../phase-1-configuration-language/04-variables.md) matters here.

For `GET /old/thing?x=1` internally redirected to `/new/thing`:

| Variable | Value |
|---|---|
| `$request_uri` | `/old/thing?x=1` — **the original, always** |
| `$uri` before | `/old/thing` |
| `$uri` after | `/new/thing` |
| `$args` | `x=1` — carried across |

Three rules follow:

- **Log `$request_uri`** to record what the client asked for.
- **Log `$uri` as well** when debugging. Differing values are the signature of an
  internal redirect.
- **Never build a client-facing redirect from `$uri`** — you drop the query string
  and may expose an internal path.

**Regex captures do not survive.** `$1` from before a `rewrite … last` is gone
afterwards, because the new round of matching produces new captures. Capture into
a named variable first if the value is needed downstream.

## `last` versus `break`

| Flag | Stays inside nginx? | Effect |
|---|---|---|
| `last` | **yes** | stop this rewrite set, **search locations again** with the new URI |
| `break` | **yes** | stop this rewrite set, **stay in this location** with the new URI |
| `redirect` | no | **302** to the client |
| `permanent` | no | **301** to the client |

**`last` is the internal redirect. `break` is not** — it changes the URI without
re-entering matching, so the current location's `root`, `proxy_pass` and headers
still apply.

```nginx
location /legacy/ {
    rewrite ^/legacy/(.*)$ /$1 break;   # strip the prefix, STAY here
    proxy_pass http://app;              # this location's proxy_pass still applies
}
```

With `last` instead, the rewritten URI would go back through matching and land in
`location /` — and this block's `proxy_pass` would never run. That single
substitution is the most common `rewrite` bug in a proxy config.

**Choose by destination:** `last` when a *different* location should handle the
new URI; `break` when *this* one should.

## Gotchas

**Symptom:** A rewrite before `proxy_pass` sent the request somewhere else
entirely.
**Cause:** `last` re-entered location matching, a different location won, and this
one's `proxy_pass` never ran.
**Fix:** `break`.

**Symptom:** `$1` is empty after a `rewrite … last`.
**Cause:** Captures do not survive an internal redirect.
**Fix:** Capture into a named variable before the rewrite.

**Symptom:** A `server`-level `rewrite` appears to run twice for one request.
**Cause:** An internal redirect to an ordinary URI restarts at the server-rewrite
phase, so server-level rewrites run again.
**Fix:** Expected. Target a named location if the restart should skip them, or
make the rewrite idempotent.

**Symptom:** The access log shows the original URL, so you cannot tell where the
request was actually served from.
**Cause:** `$request_uri` never changes; that is its job.
**Fix:** Log `$uri` alongside it — chunk 02 has the format.

**Symptom:** A redirect built in the config lost the query string.
**Cause:** It was built from `$uri`, which never contains arguments.
**Fix:** `$request_uri`, which is the full original including them.

## Trade-off

**Internal redirects are invisible, and that is both the feature and the cost.**
The client sees one request and one response — no extra round trip, no redirect
chain, and the URL in the address bar stays put. That is what makes the SPA
fallback and `X-Accel-Redirect` work at all.

The cost is that a request's path through your configuration is no longer
readable from the access log: one line can represent a journey through three
locations. Chunk 02 is what to do about that.

## Interview questions

**★ What is an internal redirect in nginx?**
A change of the request's URI followed by a fresh location search, entirely inside
nginx — no response to the client, no second request. Processing repeats from the
server-rewrite phase for an ordinary URI, or from the rewrite phase for a named
location.

**★ Which directives cause one?**
`try_files`, `index`, `error_page`, `rewrite … last`, and an upstream response
carrying `X-Accel-Redirect`. `index` is the one people never think of as a
redirect — the documented example is `/` finding `index.php` and re-entering
matching, ending at the PHP location.

**★ What is the difference between `rewrite … last` and `rewrite … break`?**
`last` re-enters location matching with the new URI, so a different location may
handle the request. `break` changes the URI but stays in the current location, so
this location's `proxy_pass`, `root` and headers still apply. Use `break` when
rewriting a path just before proxying it upstream.

**★ What happens to `$request_uri` and `$uri` during an internal redirect?**
`$request_uri` is the full original URI including the query string and never
changes. `$uri` is the current normalized URI and is updated. When they differ, an
internal redirect happened — which is why logging both makes the mechanism
visible.

**Do regex captures survive an internal redirect?**
No. The new round of location matching produces new captures, so `$1` from before
a `rewrite … last` is gone. Capture the value into a named variable first if it is
needed downstream.

**Why does a named location restart processing later than an ordinary URI?**
The documentation states that processing repeats from the server-rewrite phase for
ordinary locations and from the rewrite phase for named ones. Skipping the
server-rewrite stage means less of the pipeline re-runs, which is part of why a
named location is the safer fallback target.

---

← Index: [Internal redirects](README.md) · Next → [Cycles, SPAs and debugging](02-cycles-and-debugging.md)
