---
title: "Link map · nginx · Part 3"
sidebar_label: "03 · Speed and scale"
sidebar_position: 3
---

# Link map · nginx · Part 3 (phases 6–8)

Covers every topic row of `docs/nginx/syllabus/03-speed-and-scale.md`: T06-01 to T06-20 (caching; the three tables run on 01-05, 06-11, 12-20), T07-01 to T07-13 (compression, limits, delivery), T08-01 to T08-14 (load balancing). That is 47 rows. **None has a page of ours yet (🔲)**: `docs/nginx/pages/` holds phases 0–2 only.
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. No `#anchors` are given.

🔴 **Version note.** nginx.org/en/download.html on 2026-10-12 lists mainline **1.31.6** and stable **1.30.5** (the syllabus pins 1.31.3 / 1.30.4). The nginx.org module pages are the live reference and carry no page date. Two syllabus details to watch: `early_hints` is documented in `ngx_http_core_module` (since 1.29.0), not on the proxy page; and the upstream page shows `sticky` with no commercial-subscription note, but the release in which it became open source is not confirmed there (the syllabus says the 1.29.x line). `queue` is still marked commercial on that page. `github.com` returns 403 to our fetcher, so READMEs are cited as `raw.githubusercontent.com` copies.

---

## Phase 6 — Caching at the edge

### T06-01 · `proxy_cache_path` — Master · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · full syntax: `levels`, `use_temp_path`, `keys_zone`, `inactive`, `max_size`, `min_free` (*read*) · covers our angle: **partial** — a reference, no shared-memory versus disk walkthrough · fetched 2026-10-12
- **Also good:** [A Guide to Caching with NGINX](https://blog.nginx.org/blog/nginx-caching-guide) · NGINX blog, Jul 23, 2015 · worked `proxy_cache_path` with `use_temp_path=off` (*read*) · fetched 2026-10-12

### T06-02 · `proxy_cache` and `proxy_cache_valid` — Master · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · both directives and the header rules that override `proxy_cache_valid` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [A Guide to Caching with NGINX](https://blog.nginx.org/blog/nginx-caching-guide) · NGINX blog, Jul 23, 2015 · (*read*) · fetched 2026-10-12

### T06-03 · `proxy_cache_key` — Understand · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · default `$scheme$proxy_host$request_uri` (*read*) · covers our angle: **partial** — no cardinality discussion · fetched 2026-10-12
- **Also good:** [A Guide to Caching with NGINX](https://blog.nginx.org/blog/nginx-caching-guide) · NGINX blog, Jul 23, 2015 · answers "can I use a cookie as part of my cache key" (*read*) · fetched 2026-10-12
- **Our delta:** the two failure modes (missing dimension, exploding cardinality).

### T06-04 · `$upstream_cache_status` — Understand · 🔲 not written
- **Read this:** [A Guide to Caching with NGINX](https://blog.nginx.org/blog/nginx-caching-guide) · NGINX blog, Jul 23, 2015 · `add_header X-Cache-Status $upstream_cache_status` and the value list (*read*) · covers our angle: **partial** — access-log format is not confirmed there · fetched 2026-10-12
- **Also good:** [ngx_http_upstream_module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html) · nginx.org · the variable and its seven values: `MISS`, `BYPASS`, `EXPIRED`, `STALE`, `UPDATING`, `REVALIDATED`, `HIT` (*read*) · fetched 2026-10-12
- **Our delta:** a `log_format` that records it and a hit-rate one-liner.

### T06-05 · Cache manager and cache loader — Understand · 🔲 not written
- **Read this:** [NGINX Content Caching](https://docs.nginx.com/nginx/admin-guide/content-cache/content-caching/) · F5 docs · manager trims past `max_size`; loader runs once after start and fills the shared zone (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · the `manager_*` and `loader_*` parameters of `proxy_cache_path` (*read*) · fetched 2026-10-12

### T06-06 · Which upstream headers nginx obeys — Master · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · `Set-Cookie` blocks caching, `Vary: *` blocks it, other `Vary` values key the entry, `X-Accel-Expires` outranks the directive (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Vary](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary) · MDN · (*read*) · fetched 2026-10-12

### T06-07 · `proxy_ignore_headers` — Understand · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · the fields it can disable (`X-Accel-Expires`, `Expires`, `Cache-Control`, `Set-Cookie`, `Vary`) (*read*) · covers our angle: **partial** — the risk you accept is not spelled out · fetched 2026-10-12
- **Our delta:** why ignoring `Set-Cookie` can leak one user's response to another.

### T06-08 · `proxy_no_cache` vs `proxy_cache_bypass` — Master · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · one defines when a response is not saved, the other when it is not taken from cache (*read*) · covers our angle: **partial** — does not say you need both · fetched 2026-10-12
- **Also good:** [NGINX Content Caching](https://docs.nginx.com/nginx/admin-guide/content-cache/content-caching/) · F5 docs · has a "Limit or Disable Caching" section (*headings only*) · fetched 2026-10-12

### T06-09 · Never cache an authenticated response — Master · 🔲 not written
- **Read this:** [HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching) · MDN · private versus shared caches; `public` makes a response storable even with `Authorization` (*read*; page shows last modified Aug 14, 2026) · covers our angle: **partial** — HTTP rules, not the nginx directives · fetched 2026-10-12
- **Also good:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · `proxy_cache_bypass` example uses `$http_authorization` (*read*) · fetched 2026-10-12
- **Our delta:** the session-cookie bypass/no_cache pair.

### T06-10 · `proxy_cache_methods`, `proxy_cache_convert_head`, `proxy_cache_min_uses` — Understand · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · defaults `GET HEAD`, HEAD-to-GET conversion on (*read*) · covers our angle: full · fetched 2026-10-12

### T06-11 · `Vary` done right — Understand · 🔲 not written
- **Read this:** [Vary](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary) · MDN · `Vary: *` implies uncacheable; header builds the cache key (*read*) · covers our angle: **partial** — hit-rate cost of `User-Agent` or `Cookie` is not confirmed there · fetched 2026-10-12
- **Also good:** [ngx_http_gzip_module](https://nginx.org/en/docs/http/ngx_http_gzip_module.html) · nginx.org · `gzip_vary` adds `Vary: Accept-Encoding` (*read*) · fetched 2026-10-12

### T06-12 · `proxy_cache_use_stale` — Master · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · the full parameter list incl. `updating`, `http_429` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [A Guide to Caching with NGINX](https://blog.nginx.org/blog/nginx-caching-guide) · NGINX blog, Jul 23, 2015 · serve stale on error, timeout, 5xx (*read*) · fetched 2026-10-12

### T06-13 · `proxy_cache_background_update` — Understand · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · background subrequest refreshes while stale is returned; pair with `updating` (*read*) · covers our angle: full · fetched 2026-10-12

### T06-14 · `proxy_cache_lock` — Understand · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · one request populates, the others wait; `_timeout` and `_age` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [The Benefits of Microcaching with NGINX](https://blog.nginx.org/blog/benefits-of-microcaching-nginx) · NGINX blog, Dec 18, 2015 · (*read*) · fetched 2026-10-12

### T06-15 · `proxy_cache_revalidate` — Understand · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · conditional requests with `If-Modified-Since` and `If-None-Match` (*read*) · covers our angle: full · fetched 2026-10-12

### T06-16 · Purging on open source nginx — Understand · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · `proxy_cache_purge` is marked as part of the commercial subscription (*read*) · covers our angle: **partial** — no open-source options · fetched 2026-10-12
- **Also good:** [ngx_cache_purge README (raw)](https://raw.githubusercontent.com/nginx-modules/ngx_cache_purge/master/README.md) · github (raw), a maintained fork of FRiCKLE's module, tested on 1.20 to 1.29; undated (*read*) · [NGINX Content Caching](https://docs.nginx.com/nginx/admin-guide/content-cache/content-caching/) · F5 docs · the Plus purge setup (*read*) · fetched 2026-10-12
- **Our delta:** the bypass-header trick and deleting files; no page found for them.

### T06-17 · Cache-busting by filename — Understand · 🔲 not written
- **Read this:** [Love your cache](https://web.dev/articles/love-your-cache) · web.dev, updated 2020-12-11 · hashed asset URLs with `max-age=31536000,immutable` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching) · MDN · cache busting with a version or hash in the URL (*read*) · fetched 2026-10-12

### T06-18 · Microcaching — Understand · 🔲 not written
- **Read this:** [The Benefits of Microcaching with NGINX](https://blog.nginx.org/blog/benefits-of-microcaching-nginx) · NGINX blog, Dec 18, 2015 · `proxy_cache_valid 200 1s` with a benchmark (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [nginx proxy cache microcaching](https://www.getpagespeed.com/server-setup/nginx/nginx-proxy-cache-microcaching) · GetPageSpeed, published 2026-01-26, modified 2026-06-07 · says tested on nginx 1.26 (*headings only*) · fetched 2026-10-12
- **Our delta:** the arithmetic of one refresh per second against N requests.

### T06-19 · Where nginx caching stops and Redis begins — Know · 🔲 not written
- **Read this:** [Redis cache-aside](https://redis.io/docs/latest/develop/use-cases/cache-aside/) · Redis docs · caching database reads with TTL-bounded staleness (*read*) · covers our angle: **partial** — Redis side only, nothing on nginx · fetched 2026-10-12
- **Our delta:** responses versus data; no single page compares them.

### T06-20 · `fastcgi_cache` / `uwsgi_cache` / `scgi_cache` — When Needed · 🔲 not written
- **Read this:** [ngx_http_fastcgi_module](https://nginx.org/en/docs/http/ngx_http_fastcgi_module.html) · nginx.org · `fastcgi_cache_path` and the same family (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [ngx_http_uwsgi_module](https://nginx.org/en/docs/http/ngx_http_uwsgi_module.html) · [ngx_http_scgi_module](https://nginx.org/en/docs/http/ngx_http_scgi_module.html) · nginx.org · each has its own `*_cache_path` (*headings only*) · fetched 2026-10-12

---

## Phase 7 — Compression, limits and delivery

### T07-01 · `gzip on` and `gzip_types` — Master · 🔲 not written
- **Read this:** [ngx_http_gzip_module](https://nginx.org/en/docs/http/ngx_http_gzip_module.html) · nginx.org · `gzip_types` default is `text/html` only (*read*) · covers our angle: full · fetched 2026-10-12

### T07-02 · `gzip_comp_level`, `gzip_min_length`, `gzip_vary`, `gzip_proxied` — Understand · 🔲 not written
- **Read this:** [ngx_http_gzip_module](https://nginx.org/en/docs/http/ngx_http_gzip_module.html) · nginx.org · defaults: level 1, min length 20, `gzip_vary off`, `gzip_proxied off` (*read*) · covers our angle: **partial** — no advice on which level is worth the CPU · fetched 2026-10-12

### T07-03 · `gzip_static` — Understand · 🔲 not written
- **Read this:** [ngx_http_gzip_static_module](https://nginx.org/en/docs/http/ngx_http_gzip_static_module.html) · nginx.org · `on | off | always` checks for precompressed files (*read*) · covers our angle: full · fetched 2026-10-12

### T07-04 · Brotli and zstd — Know · 🔲 not written
- **Read this:** [ngx_brotli README (raw)](https://raw.githubusercontent.com/google/ngx_brotli/master/README.md) · github (raw), undated · build with `--add-dynamic-module`; `brotli_static` (*read*) · covers our angle: **partial** — no ratio comparison, zstd absent · fetched 2026-10-12
- **Also good:** [zstd-nginx-module README (raw)](https://raw.githubusercontent.com/tokers/zstd-nginx-module/master/README.md) · github (raw), undated · states the module is experimental (*read*) · fetched 2026-10-12
- **Our delta:** gzip versus brotli versus zstd ratios for text; none confirmed on these pages.

### T07-05 · Never compress what is already compressed — Understand · 🔲 not written
- **Read this:** [ngx_http_gzip_module](https://nginx.org/en/docs/http/ngx_http_gzip_module.html) · nginx.org · `gzip_types` is an allowlist of MIME types (*read*) · covers our angle: **partial** — never says why images and `.woff2` should stay out · fetched 2026-10-12
- **Our delta:** the content-type list and the CPU argument.

### T07-06 · `client_max_body_size` — Master · 🔲 not written
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · default `1m`, over the limit gives 413 (*read*) · covers our angle: **partial** — the Node side is elsewhere · fetched 2026-10-12
- **Also good:** [body-parser](https://expressjs.com/en/resources/middleware/body-parser/) · Express docs · `limit` defaults to `100kb` (*read*) · fetched 2026-10-12

### T07-07 · Client body and header buffers and timeouts — Understand · 🔲 not written
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · `client_body_buffer_size`, `client_body_timeout` 60s, `client_header_timeout` 60s (408), `large_client_header_buffers` (*read*) · covers our angle: **partial** — status 494 not found on this page, not confirmed · fetched 2026-10-12

### T07-08 · File uploads through a proxy — Understand · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · `proxy_request_buffering` (default on) and `proxy_temp_path` (*read*) · covers our angle: **partial** — a default path under `/var/lib/nginx` is not shown · fetched 2026-10-12
- **Also good:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · `client_body_temp_path` (*read*) · fetched 2026-10-12

### T07-09 · `limit_rate`, `limit_rate_after` — Know · 🔲 not written
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · bytes per second, per connection; initial amount before throttling (*read*) · covers our angle: full · fetched 2026-10-12

### T07-10 · Client-side `keepalive_timeout` and `keepalive_requests` — Understand · 🔲 not written
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · defaults 75s and 1000 requests (*read*) · covers our angle: **partial** — no mobile-client behaviour · fetched 2026-10-12

### T07-11 · Early Hints (103) — Know · 🔲 not written
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · `early_hints`, since 1.29.0; upstream 103 responses are passed on as is (*read*) · covers our angle: **partial** — gRPC backends are not confirmed there, and no cost discussion · fetched 2026-10-12
- **Also good:** [Early Hints](https://developer.chrome.com/docs/web-platform/early-hints) · Chrome for Developers, updated 2026-07-10 · preconnect/preload benefits (*read*) · [103 Early Hints](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/103) · MDN · advises HTTP/2 or later (*read*) · fetched 2026-10-12

### T07-12 · `ngx_http_sub_module` — When Needed · 🔲 not written
- **Read this:** [ngx_http_sub_module](https://nginx.org/en/docs/http/ngx_http_sub_module.html) · nginx.org · `sub_filter`, `sub_filter_once`, `sub_filter_types` (*read*) · covers our angle: **partial** — no argument against using it · fetched 2026-10-12

### T07-13 · `ngx_http_mirror_module` — When Needed · 🔲 not written
- **Read this:** [ngx_http_mirror_module](https://nginx.org/en/docs/http/ngx_http_mirror_module.html) · nginx.org · `mirror` and `mirror_request_body`; mirror responses are ignored (*read*) · covers our angle: full · fetched 2026-10-12

---

## Phase 8 — Load balancing and upstream health

### T08-01 · The `upstream` block — Master · 🔲 not written
- **Read this:** [Using nginx as HTTP load balancer](https://nginx.org/en/docs/http/load_balancing.html) · nginx.org · a named group of servers behind `proxy_pass` (*read*) · covers our angle: full · fetched 2026-10-12

### T08-02 · Balancing methods — Master · 🔲 not written
- **Read this:** [Using nginx as HTTP load balancer](https://nginx.org/en/docs/http/load_balancing.html) · nginx.org · round-robin default, `least_conn`, `ip_hash`, weights (*read*) · covers our angle: **partial** — `hash` and `random` are not on it · fetched 2026-10-12
- **Also good:** [ngx_http_upstream_module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html) · nginx.org · `hash key [consistent]`, `random [two]` (*read*) · fetched 2026-10-12
- **Our delta:** choosing by workload.

### T08-03 · `server` parameters — Understand · 🔲 not written
- **Read this:** [ngx_http_upstream_module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html) · nginx.org · `weight`, `max_conns`, `max_fails`, `fail_timeout`, `backup`, `down`, `resolve` (*read*) · covers our angle: full · fetched 2026-10-12

### T08-04 · Passive health checks only — Master · 🔲 not written
- **Read this:** [Using nginx as HTTP load balancer](https://nginx.org/en/docs/http/load_balancing.html) · nginx.org · `max_fails` default 1; active checks listed as NGINX Plus (*read*) · covers our angle: **partial** — no open-source alternative to active probes · fetched 2026-10-12
- **Also good:** [ngx_http_upstream_hc_module](https://nginx.org/en/docs/http/ngx_http_upstream_hc_module.html) · nginx.org · the Plus `health_check` directive, to recognise it (*headings only*) · fetched 2026-10-12

### T08-05 · `keepalive` in the upstream block — Understand · 🔲 not written
- **Read this:** [ngx_http_upstream_module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html) · nginx.org · `keepalive 32 local;` default since 1.29.7; `keepalive_requests` 1000, `keepalive_time` 1h (*read*) · covers our angle: full · fetched 2026-10-12

### T08-06 · Session affinity in open source — Understand · 🔲 not written
- **Read this:** [ngx_http_upstream_module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html) · nginx.org · `sticky cookie`, `sticky route`, `sticky learn` (*read*) · covers our angle: **partial** — release it became open source is not confirmed, and the stateless argument is absent · fetched 2026-10-12
- **Also good:** [PM2 cluster mode](https://pm2.keymetrics.io/docs/usage/cluster-mode/) · PM2 docs · advice to keep the app stateless and share state via Redis or a database (*read*) · fetched 2026-10-12

### T08-07 · `ip_hash` is not session affinity — Understand · 🔲 not written
- **Read this:** [ngx_http_upstream_module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html) · nginx.org · adding or removing a server may remap most keys; `hash … consistent` (*read*) · covers our angle: full · fetched 2026-10-12

### T08-08 · `zone` — Understand · 🔲 not written
- **Read this:** [ngx_http_upstream_module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html) · nginx.org · shared memory for group config and run-time state across workers; `max_conns` is per worker without it (*read*) · covers our angle: full · fetched 2026-10-12

### T08-09 · DNS and upstreams — Master · 🔲 not written
- **Read this:** [ngx_http_upstream_module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html) · nginx.org · `resolve` needs a shared-memory zone and a `resolver` (*read*) · covers our angle: **partial** — startup-only resolution is not stated here · fetched 2026-10-12
- **Also good:** [nginx's proxy_pass DNS caching problem](https://joshua.hu/nginx-dns-caching) · Joshua Rogers, undated page · hostnames resolved at startup; fix with `resolver` and a variable (*read*) · fetched 2026-10-12

### T08-10 · Zero-downtime deploys — Understand · 🔲 not written
- **Read this:** [Controlling nginx](https://nginx.org/en/docs/control.html) · nginx.org · `HUP` starts new workers and gracefully stops old ones (*read*) · covers our angle: **partial** — no drain or weight-shift recipe · fetched 2026-10-12
- **Also good:** [PM2 cluster mode](https://pm2.keymetrics.io/docs/usage/cluster-mode/) · PM2 docs · `pm2 reload` for a zero-second reload (*read*) · fetched 2026-10-12

### T08-11 · `least_time` — Know · 🔲 not written
- **Read this:** [ngx_http_upstream_module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html) · nginx.org · "Prior to version 1.31.0" it was commercial only (*read*) · covers our angle: full · fetched 2026-10-12

### T08-12 · Node cluster vs PM2 vs container replicas — Know · 🔲 not written
- **Read this:** [Cluster](https://nodejs.org/api/cluster.html) · Node.js docs, v26.11.1 · primary process distributes connections round-robin (*read*) · covers our angle: **partial** — no comparison with PM2 or containers · fetched 2026-10-12
- **Also good:** [PM2 cluster mode](https://pm2.keymetrics.io/docs/usage/cluster-mode/) · PM2 docs · built on the Node cluster module (*read*) · fetched 2026-10-12
- **Our delta:** which layer owns the job; no page compares all three.

### T08-13 · NGINX Plus feature set — Know · 🔲 not written
- **Read this:** [ngx_http_upstream_module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html) · nginx.org · `queue`, `slow_start`, `state`, `health_check` and the commercial-subscription notes (*read*) · covers our angle: **partial** — `queue` is still marked commercial here; syllabus lists it correctly · fetched 2026-10-12
- **Also good:** [Using nginx as HTTP load balancer](https://nginx.org/en/docs/http/load_balancing.html) · nginx.org · closing note on what needs Plus (*read*) · fetched 2026-10-12

### T08-14 · TCP load balancing with `stream` — When Needed · 🔲 not written
- **Read this:** [ngx_stream_ssl_preread_module](https://nginx.org/en/docs/stream/ngx_stream_ssl_preread_module.html) · nginx.org · routes by SNI with `map $ssl_preread_server_name`; not built by default (*read*) · covers our angle: **partial** — no Postgres or Redis example · fetched 2026-10-12
- **Also good:** [ngx_stream_upstream_module](https://nginx.org/en/docs/stream/ngx_stream_upstream_module.html) · nginx.org · `hash`, `least_conn`, `max_fails` for TCP groups (*read*) · fetched 2026-10-12
