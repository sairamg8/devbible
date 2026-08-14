---
title: "Part 3 — Speed and scale"
sidebar_label: "3 · Speed and scale"
sidebar_position: 3
---

> Phases 6–8 · Caching responses, compressing and shaping delivery, and spreading
> load across more than one Node process

> Verified: 2026-08-14 against
> [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html),
> [ngx_http_gzip_module](https://nginx.org/en/docs/http/ngx_http_gzip_module.html),
> [ngx_http_upstream_module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html),
> [Using nginx as HTTP load balancer](https://nginx.org/en/docs/http/load_balancing.html) and
> [CHANGES-1.30](https://nginx.org/en/CHANGES-1.30).
> **No sandbox run** — this is an inventory, not an explanation.

Part 2 got the stack correct. This part makes it fast and makes it survive more
than one box. The order matters: **caching is the biggest win available to a
fullstack app and the easiest to get subtly wrong**, so it comes first.

---

## Phase 6 — Caching at the edge

A response nginx can answer itself never reaches Node. That is the whole idea,
and every difficulty is about knowing *when it is allowed to*.

### The cache itself

| Topic | Tier |
|---|---|
| **`proxy_cache_path`** — `levels`, `keys_zone=name:size`, `inactive`, `max_size`, `use_temp_path=off`; what lives in shared memory and what lives on disk | <span className="db-tier t-master">Master</span> |
| **`proxy_cache` and `proxy_cache_valid`** — turning it on per location, and setting a TTL per status code (`200 302 10m`, `404 1m`) | <span className="db-tier t-master">Master</span> |
| **`proxy_cache_key`** — the default `$scheme$proxy_host$request_uri`, and the two ways to break your cache: forgetting a dimension, or adding one that explodes cardinality | <span className="db-tier t-understand">Understand</span> |
| **`$upstream_cache_status`** — `MISS`, `HIT`, `BYPASS`, `EXPIRED`, `STALE`, `UPDATING`, `REVALIDATED`; putting it in a header and in the access log so you can prove the cache works | <span className="db-tier t-understand">Understand</span> |
| The cache manager and cache loader processes — eviction by `max_size`, expiry by `inactive`, and the startup scan of a large cache | <span className="db-tier t-understand">Understand</span> |

### Deciding what may be cached

| Topic | Tier |
|---|---|
| **Which upstream headers nginx obeys** — `Cache-Control`, `Expires`, `Set-Cookie` (which disables caching outright), `X-Accel-Expires`, and `Vary` | <span className="db-tier t-master">Master</span> |
| **`proxy_ignore_headers`** — the override that makes an uncooperative backend cacheable, and the risk you accept when you use it | <span className="db-tier t-understand">Understand</span> |
| **`proxy_no_cache` vs `proxy_cache_bypass`** — one refuses to *store*, the other refuses to *serve*; you almost always need both, and for the same condition | <span className="db-tier t-master">Master</span> |
| **Never cache an authenticated response by accident** — keying on the session cookie, or bypassing whenever `$http_authorization` or a session cookie is present | <span className="db-tier t-master">Master</span> |
| `proxy_cache_methods`, `proxy_cache_convert_head`, and `proxy_cache_min_uses` — caching only what is worth caching | <span className="db-tier t-understand">Understand</span> |
| **`Vary` done right** — `Vary: Accept-Encoding` is fine, `Vary: User-Agent` destroys your hit rate, `Vary: Cookie` means no cache at all | <span className="db-tier t-understand">Understand</span> |

### Staleness, stampedes and invalidation

| Topic | Tier |
|---|---|
| **`proxy_cache_use_stale`** — serving stale content on `error`, `timeout`, `updating`, `http_500`; the cheapest availability win nginx offers | <span className="db-tier t-master">Master</span> |
| **`proxy_cache_background_update`** with `updating` — refresh behind the scenes while the current visitor gets an instant stale answer | <span className="db-tier t-understand">Understand</span> |
| **`proxy_cache_lock`** (plus `_timeout`, `_age`) — one request populates the cache, the rest wait; the built-in answer to a cache stampede | <span className="db-tier t-understand">Understand</span> |
| **`proxy_cache_revalidate`** — conditional revalidation with `If-Modified-Since` / `If-None-Match` so a still-fresh object costs a 304, not a full body | <span className="db-tier t-understand">Understand</span> |
| **Purging on open source nginx** — `proxy_cache_purge` is NGINX Plus; the OSS options are the `ngx_cache_purge` third-party module, a `proxy_cache_bypass` secret header, deleting cache files, or designing so you never need to purge | <span className="db-tier t-understand">Understand</span> |
| **Cache-busting by filename** is the real invalidation strategy — why hashed asset names beat every purge mechanism | <span className="db-tier t-understand">Understand</span> |
| **Microcaching** — caching even a dynamic page for one second, and the arithmetic that shows why 1s absorbs a traffic spike | <span className="db-tier t-understand">Understand</span> |
| Where nginx caching stops and Redis begins — nginx caches *responses*, Redis caches *data*; the two are not substitutes | <span className="db-tier t-know">Know</span> |
| `fastcgi_cache` / `uwsgi_cache` / `scgi_cache` — the same machinery under other names | <span className="db-tier t-when">When Needed</span> |

**Gate — deliverable:** an API endpoint cached for 60 seconds that serves stale
on backend failure, never caches a logged-in user's data, survives a stampede,
and whose hit rate you can read off the access log.

---

## Phase 7 — Compression, limits and delivery

The small directives that decide whether a slow connection feels slow, and the
ones that stop a single client from ruining the day.

| Topic | Tier |
|---|---|
| **`gzip on` and `gzip_types`** — the default only compresses `text/html`, which is why "I enabled gzip and nothing changed" is so common | <span className="db-tier t-master">Master</span> |
| **`gzip_comp_level`, `gzip_min_length`, `gzip_vary`, `gzip_proxied`** — the level that is actually worth the CPU, the size below which compression makes files bigger, and the header a shared cache needs | <span className="db-tier t-understand">Understand</span> |
| **`gzip_static`** — serve `file.gz` your build already produced; zero CPU per request and a better ratio than any on-the-fly level | <span className="db-tier t-understand">Understand</span> |
| **Brotli and zstd** — not in open-source nginx by default; `ngx_brotli` / `zstd-nginx-module` as dynamic modules, and how the ratio compares to gzip for text | <span className="db-tier t-know">Know</span> |
| **Never compress what is already compressed** — images, video, `.woff2`, and the CPU you waste trying | <span className="db-tier t-understand">Understand</span> |
| **`client_max_body_size`** (default `1m`) — the 413 that makes every file upload fail, and why the limit must be set on nginx *and* on the Node body parser | <span className="db-tier t-master">Master</span> |
| `client_body_buffer_size`, `client_body_timeout`, `client_header_timeout`, `large_client_header_buffers` — the `413`, `408` and `494` family and what each one means | <span className="db-tier t-understand">Understand</span> |
| **File uploads through a proxy** — buffering to disk vs streaming to Node, temp-path permissions, and why a large upload can silently land in `/var/lib/nginx` | <span className="db-tier t-understand">Understand</span> |
| **`limit_rate`, `limit_rate_after`** — bandwidth shaping per connection; letting the first megabyte fly and throttling the rest | <span className="db-tier t-know">Know</span> |
| `keepalive_timeout` and `keepalive_requests` on the *client* side — distinct from the upstream ones, and what mobile clients do to them | <span className="db-tier t-understand">Understand</span> |
| **Early Hints (103)** — supported from proxy and gRPC backends since 1.29.0 via the `early_hints` directive; what it buys a React app and what it costs | <span className="db-tier t-know">Know</span> |
| `ngx_http_sub_module` — rewriting response bodies on the fly, and the strong argument for never doing it | <span className="db-tier t-when">When Needed</span> |
| `ngx_http_mirror_module` — shadow a copy of live traffic at a second backend for testing | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can say, for a given asset, whether it should be
compressed on the fly, pre-compressed, or left alone — and defend the answer with
its content type and size.

---

## Phase 8 — Load balancing and upstream health

One Node process is one CPU core. This phase is how you use the rest of the box,
and how nginx behaves when one of those processes dies.

| Topic | Tier |
|---|---|
| **The `upstream` block** — naming a pool of `server` entries and pointing `proxy_pass` at the name instead of a host | <span className="db-tier t-master">Master</span> |
| **Balancing methods** — round-robin (the default), `least_conn`, `ip_hash`, `hash $key [consistent]`, `random [two]`; choosing by workload rather than by habit | <span className="db-tier t-master">Master</span> |
| **`server` parameters** — `weight`, `max_fails=1`, `fail_timeout=10s`, `max_conns`, `backup`, `down`, `resolve` | <span className="db-tier t-understand">Understand</span> |
| **Passive health checks are all open-source nginx has** — `max_fails` + `fail_timeout` mark a server down *after* real requests fail; there is no active probe without NGINX Plus, and what to do instead | <span className="db-tier t-master">Master</span> |
| **`keepalive` in the upstream block** — since 1.29.7 the default is `keepalive 32 local;`; what `local` changes, plus `keepalive_requests` and `keepalive_time` | <span className="db-tier t-understand">Understand</span> |
| **Session affinity in open source** — the `sticky` directive landed in the 1.29.x line; `sticky cookie`, `sticky route`, `sticky learn`, and the strong argument for stateless sessions instead | <span className="db-tier t-understand">Understand</span> |
| **`ip_hash` is not session affinity** — what happens to a hashed client when you add or remove a server, and why `hash … consistent` behaves better | <span className="db-tier t-understand">Understand</span> |
| **`zone`** — a shared memory zone so all workers share upstream state rather than each keeping its own; required for anything counted across workers | <span className="db-tier t-understand">Understand</span> |
| **DNS and upstreams** — nginx resolves a hostname **once at startup** unless you use `resolve` with a `resolver`; the classic failure when a container or an ELB changes IP | <span className="db-tier t-master">Master</span> |
| **Zero-downtime deploys** — `down`, drain, weight-shifting and reload; how far you can get without Kubernetes | <span className="db-tier t-understand">Understand</span> |
| **`least_time`** — open source from 1.31.0 (mainline), so *not* on the 1.30 stable branch; know which release you are targeting before you write it | <span className="db-tier t-know">Know</span> |
| Balancing to a Node cluster vs PM2 vs container replicas — three places the same job can be done, and which one owns it | <span className="db-tier t-know">Know</span> |
| `queue`, `slow_start`, `state` and active health checks — the NGINX Plus feature set, named so you recognise it in a doc page and do not copy it into an OSS config | <span className="db-tier t-know">Know</span> |
| Load balancing raw TCP with the `stream` module — Postgres read replicas, Redis, and the `ssl_preread` trick | <span className="db-tier t-when">When Needed</span> |

**Gate — deliverable:** four Node instances behind one nginx, where killing one
costs at most a handful of failed requests, a rolling restart costs none, and you
can prove which upstream served a request from the log.

---

← Prev: [Part 2 — Serving and proxying](02-serving-and-proxying.md) · Index: [Nginx](../README.md) · Next → [Part 4 — Production](04-production.md)
