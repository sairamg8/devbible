---
title: "Link map · nginx · Part 2"
sidebar_label: "02 · nginx · Serving and proxying"
sidebar_position: 2
---

# Link map · nginx · Part 2 — Serving and proxying (phases 3–5)

Covers every topic row of `docs/nginx/syllabus/02-serving-and-proxying.md`: T03-01 to T03-14 (static files and SPAs), T04-01 to T04-30 (reverse proxy to Node), T05-01 to T05-16 (TLS, HTTP/2, HTTP/3). That is 60 rows. **None has a page of ours yet (🔲)**: `docs/nginx/pages` holds phases 0 to 2 only.
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. No `#anchors` are given.

🔴 **Version note.** nginx.org/en/download.html on 2026-10-12 lists **stable 1.30.5** and **mainline 1.31.6**; nginx.org/2026.html dates both 2026-09-15 (a `ngx_http_v3_module` buffer-overflow fix). Our syllabus README still says 1.30.4 / 1.31.3, so it is one security release behind. nginx.org module docs are unversioned (they describe mainline). Directive facts below were read there on 2026-10-12.
Two places where nginx.org and our syllabus differ, both "not confirmed" until a page is written: the proxy module page still lists `proxy_set_header Connection close` among the defaults for HTTP/1.x proxying, while the syllabus says `Connection` is no longer sent since 1.29.7; and nginx.org's own WebSocket page shows a literal `Connection "upgrade"` as its first example, before the `map` one.
Mozilla's SSL config generator has moved: ssl-config.mozilla.org now points to TLSRef (configurator.tlsref.org). `github.com` returns 403 to our fetcher.

---

## Phase 3 — Serving static files and SPAs

### T03-01 · `root` vs `alias` — Master · 🔲 not written
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · `alias` replaces the matched location (`/i/top.gif` becomes `/data/w3/images/top.gif`); regex-location rules (*read* the `alias` entry) · covers our angle: **partial** — the trailing-slash trap is not spelled out as a bug · fetched 2026-10-12
- **Also good:** [X-Accel and X-Sendfile](https://nginx-wiki.getpagespeed.com/config/examples/x-accel/) · NGINX Wiki (GetPageSpeed-hosted community docs), 2025-12-05 (updated 2026-08-05) · has "Using alias" and "Using root" sections (*headings only*) · fetched 2026-10-12
- **Our delta:** the missing-slash `alias` bug, with a before/after request trace.

### T03-02 · `try_files` — Master · 🔲 not written
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · ordered existence check, trailing slash tests a directory, last argument is an internal redirect or `=code` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [NGINX try_files: Complete Guide](https://www.getpagespeed.com/server-setup/nginx/nginx-try-files) · GetPageSpeed, 2026-01-30 (updated 2026-06-03) · patterns for static, WordPress, Laravel, SPA, named location (*read* the `=404` and SPA parts) · fetched 2026-10-12
- **Our delta:** the named-location terminator and `$uri/` interplay with `index`.

### T03-03 · The SPA fallback and why not `/api` — Master · 🔲 not written
- **Read this:** [NGINX try_files: Complete Guide](https://www.getpagespeed.com/server-setup/nginx/nginx-try-files) · GetPageSpeed, 2026-01-30 (updated 2026-06-03) · SPA section: serve `index.html` for all client routes (*read*) · covers our angle: **partial** — its example does not carve out `/api`, so backend 404s would become HTML 200s · fetched 2026-10-12
- **Also good:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · `try_files` semantics (*read*) · fetched 2026-10-12
- **Our delta:** the whole "do not apply to `/api`" half, plus the Gate's JSON 404 from Node.

### T03-04 · Serving a built React/Vite bundle (hashed vs `index.html`) — Master · 🔲 not written
- **Read this:** [Prevent unnecessary network requests with the HTTP Cache](https://web.dev/articles/http-cache) · web.dev · versioned URLs get a year-long `max-age`, `immutable` as extra, unversioned URLs need revalidation (*read*) · covers our angle: **partial** — no Vite, no nginx config · fetched 2026-10-12
- **Also good:** [HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching) · MDN · `max-age=31536000, immutable` and why it stops reload revalidation (*read*) · fetched 2026-10-12
- *Checked, not chosen:* [Vite: Deploying a Static Site](https://vite.dev/guide/static-deploy.html) · fetched, no nginx or hashed-asset caching text found.
- **Our delta:** the nginx `location` split between `/assets/` and `index.html`.

### T03-05 · `expires` and `Cache-Control` — Master · 🔲 not written
- **Read this:** [ngx_http_headers_module](https://nginx.org/en/docs/http/ngx_http_headers_module.html) · nginx.org · `expires` sets `Expires` and `Cache-Control` for listed status codes; `epoch`, `max`, `-1`; `add_header` rules (*read*) · covers our angle: **partial** — no `immutable` recipe · fetched 2026-10-12
- **Also good:** [Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control) · MDN · directive reference incl. `immutable` (*headings only*) · fetched 2026-10-12
- **Our delta:** matching policy to filename; `add_header` replace-not-merge between levels.

### T03-06 · `index`, `autoindex`, directory redirect — Understand · 🔲 not written
- **Read this:** [ngx_http_index_module](https://nginx.org/en/docs/http/ngx_http_index_module.html) · nginx.org · files checked in order; using an index file causes an internal redirect to another location (*read*) · covers our angle: **partial** — the trailing-slash redirect is not on this page · fetched 2026-10-12
- **Also good:** [ngx_http_autoindex_module](https://nginx.org/en/docs/http/ngx_http_autoindex_module.html) · nginx.org · `autoindex`, formats `html|xml|json|jsonp` (*read*) · fetched 2026-10-12
- **Our delta:** the directory-request 301 that adds a slash.

### T03-07 · MIME types — Understand · 🔲 not written
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · `types` maps extensions, full table ships in `conf/mime.types`; `default_type` is `text/plain` (*read*) · covers our angle: **partial** — nothing on `.mjs`, `.wasm`, `.avif` · fetched 2026-10-12
- **Also good:** [MIME types](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/MIME_types) · MDN · what the browser does with a type (*headings only*) · fetched 2026-10-12
- **Our delta:** the entries you must add yourself.

### T03-08 · `sendfile`, `tcp_nopush`, `tcp_nodelay` — Understand · 🔲 not written
- **Read this:** [Serving Static Content](https://docs.nginx.com/nginx/admin-guide/web-server/serving-static-content/) · docs.nginx.com · has "Optimize Performance for Serving Content" with Enable sendfile, tcp_nopush, tcp_nodelay (*headings only*) · covers our angle: full (by headings) · fetched 2026-10-12
- **Also good:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · `tcp_nopush` only takes effect with `sendfile`; header and file start in one packet (*read*) · fetched 2026-10-12
- **Our delta:** why the trio is quoted together; defaults (`sendfile off`, read there).

### T03-09 · `open_file_cache` — Know · 🔲 not written
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · caches descriptors, sizes, mtimes, directory existence; `max`, `inactive` (*read* the first half) · covers our angle: **partial** — validity-window text not read · fetched 2026-10-12
- **Our delta:** the staleness window after a deploy.

### T03-10 · Pre-compressed assets — Understand · 🔲 not written
- **Read this:** [ngx_http_gzip_static_module](https://nginx.org/en/docs/http/ngx_http_gzip_static_module.html) · nginx.org · `gzip_static on|off|always`, checks for a `.gz` beside the file (*read*) · covers our angle: **partial** — `.br` needs a separate module, not covered · fetched 2026-10-12
- **Our delta:** Vite emitting `.gz` and `.br`; mtime advice on the page.

### T03-11 · Range requests and `$slice` — Know · 🔲 not written
- **Read this:** [ngx_http_slice_module](https://nginx.org/en/docs/http/ngx_http_slice_module.html) · nginx.org · `slice`, `$slice_range`, cache-key and 206 caching requirement (*read*) · covers our angle: **partial** — no client-side range explanation · fetched 2026-10-12
- **Also good:** [HTTP range requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests) · MDN · `Range`, 206, `Content-Range`, `Accept-Ranges` (*read*) · fetched 2026-10-12
- **Our delta:** nginx's July 2026 slice memory-disclosure fix (CVE-2026-60005, per nginx.org/2026.html) is not on the module page.

### T03-12 · `X-Accel-Redirect` — Understand · 🔲 not written
- **Read this:** [X-Accel and X-Sendfile](https://nginx-wiki.getpagespeed.com/config/examples/x-accel/) · NGINX Wiki (GetPageSpeed-hosted community docs), 2025-12-05 (updated 2026-08-05) · backend sends the header, nginx serves the file from an internal location (*read*) · covers our angle: **partial** — PHP backend example, not Node · fetched 2026-10-12
- **Also good:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · `internal` lists "X-Accel-Redirect" among internal requests (*read*) · fetched 2026-10-12
- **Our delta:** an Express handler that authorises then sets the header.

### T03-13 · `error_page` for static sites — Understand · 🔲 not written
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · `error_page 404 /404.html;` internal redirect, `=response` changes the status (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** keeping the 404 status honest; our existing page on `error_page` (phase 2) covers the mechanism.

### T03-14 · Serving a Next.js / Nuxt hybrid — Know · 🔲 not written
- **Read this:** [Next.js: Self-Hosting](https://nextjs.org/docs/app/guides/self-hosting) · nextjs.org · recommends a reverse proxy such as nginx in front; sections on static assets caching and immutable assets (*read* the proxy section, rest *headings only*) · covers our angle: **partial** — no nginx config; Nuxt is on the Also-good page · fetched 2026-10-12
- **Also good:** [Nuxt: Deployment](https://nuxt.com/docs/4.x/getting-started/deployment) · nuxt.com · run the Nitro server behind a reverse proxy like nginx; `nuxt generate` emits `/200.html` and `/404.html` fallbacks for static hosts (*read* those passages) · fetched 2026-10-12
- **Our delta:** which paths nginx can serve from disk; no nginx config on either page.

---

## Phase 4 — Reverse proxy to Node

### T04-01 · `proxy_pass` with a URI vs without — Master · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · with a URI the matched part is replaced; without, the URI passes unchanged (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [proxy_pass Trailing Slash: Complete Guide](https://www.getpagespeed.com/server-setup/nginx/nginx-proxy-pass-trailing-slash) · GetPageSpeed, 2026-01-26 (updated 2026-06-07) · six scenarios and a decision flowchart (*headings only*) · fetched 2026-10-12

### T04-02 · The trailing slash — Understand · 🔲 not written
- **Read this:** [proxy_pass Trailing Slash: Complete Guide](https://www.getpagespeed.com/server-setup/nginx/nginx-proxy-pass-trailing-slash) · GetPageSpeed, 2026-01-26 (updated 2026-06-07) · quick-reference table of scenarios incl. double-slash problem (*headings only*) · covers our angle: full by headings · fetched 2026-10-12
- **Also good:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · the two official examples (*read*) · fetched 2026-10-12
- *Checked, not chosen:* linuxcapable.com guide, 403.

### T04-03 · `proxy_pass` in regex locations and with variables — Understand · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · in regex and named locations the replaced part cannot be determined, so give no URI; a variable address needs a `resolver` for names (*read*) · covers our angle: **partial** — runtime DNS consequences not read · fetched 2026-10-12
- **Our delta:** the resolver and caching of DNS at startup.

### T04-04 · Proxying to a Unix socket — Know · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · `proxy_pass http://unix:/tmp/backend.socket:/uri/;` (*read*) · covers our angle: **partial** — nothing on when a socket beats TCP · fetched 2026-10-12

### T04-05 · `proxy_set_header Host $host` — Master · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · documented default is `Host $proxy_host` (*read*) · covers our angle: **partial** — no Express viewpoint · fetched 2026-10-12
- **Also good:** [Host](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Host) · MDN (*headings only*) · fetched 2026-10-12

### T04-06 · `X-Forwarded-For`, `-Proto`, `-Host` — Master · 🔲 not written
- **Read this:** [X-Forwarded-For](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Forwarded-For) · MDN · syntax `<client>, <proxy>`, each proxy appends (*read*) · covers our angle: **partial** — no nginx variables · fetched 2026-10-12
- **Also good:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · `$proxy_add_x_forwarded_for` is the incoming header plus `$remote_addr` (*read*) · fetched 2026-10-12

### T04-07 · The `trust proxy` handshake with Express — Master · 🔲 not written
- **Read this:** [Express behind proxies](https://expressjs.com/en/guide/behind-proxies/) · expressjs.com · `trust proxy` values, default `false` uses the socket address; subnet names (*read*) · covers our angle: **partial** — no nginx side, no cookie angle · fetched 2026-10-12
- **Our delta:** the matching nginx config, and `secure` cookies when `X-Forwarded-Proto` is missed.

### T04-08 · `ngx_http_realip_module` — Master · 🔲 not written
- **Read this:** [ngx_http_realip_module](https://nginx.org/en/docs/http/ngx_http_realip_module.html) · nginx.org · `set_real_ip_from`, `real_ip_header` (default `X-Real-IP`), `real_ip_recursive`, `$realip_remote_addr` (*read*) · covers our angle: full · fetched 2026-10-12

### T04-09 · The forwarded-header trust chain — Master · 🔲 not written
- **Read this:** [X-Forwarded-For](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Forwarded-For) · MDN · security section: unforgeable only for entries added by trusted proxies; misuse allows rate-limiter avoidance (*read*) · covers our angle: **partial** — nginx and Express not named · fetched 2026-10-12
- **Also good:** [Express behind proxies](https://expressjs.com/en/guide/behind-proxies/) · expressjs.com · warning that the last trusted proxy must overwrite the three headers (*read*) · fetched 2026-10-12
- *Checked, not chosen:* express-rate-limit error pages, they only redirect to its wiki.

### T04-10 · The `Forwarded` header (RFC 7239) — Know · 🔲 not written
- **Read this:** [Forwarded](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Forwarded) · MDN · `by`, `for`, `host`, `proto`; names `X-Forwarded-*` as the de-facto alternative (*read*) · covers our angle: **partial** — "why the old ones won" is not argued · fetched 2026-10-12
- **Also good:** [RFC 7239](https://datatracker.ietf.org/doc/html/rfc7239) · IETF, June 2014 (*read* the abstract) · fetched 2026-10-12

### T04-11 · `proxy_hide_header`, `proxy_pass_header` — Understand · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · by default `Date`, `Server`, `X-Pad`, `X-Accel-...` are not passed on; hide adds, pass_header permits (*read*) · covers our angle: **partial** — `X-Powered-By` not named · fetched 2026-10-12

### T04-12 · Inheritance trap for `proxy_set_header` — Understand · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · inherited "if and only if" the current level defines none (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** our page on inheritance (phase 1) is the general rule.

### T04-13 · `proxy_redirect` — Understand · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · rewrites `Location` and `Refresh`; `default`, `off`, replacement forms (*read*) · covers our angle: full · fetched 2026-10-12

### T04-14 · `proxy_cookie_path`, `_domain`, `_flags` — Know · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · `proxy_cookie_flags` since 1.19.3 sets `secure`, `httponly`, `samesite` (*read* flags, domain/path headings only) · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) · MDN (*headings only*) · fetched 2026-10-12

### T04-15 · Upstream keep-alive default since 1.29.7 — Master · 🔲 not written
- **Read this:** [ngx_http_upstream_module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html) · nginx.org · `keepalive 32 local;` default, cache active and not shared between locations since 1.29.7 (*read*) · covers our angle: **partial** — `Connection` header change is on the proxy page · fetched 2026-10-12
- **Also good:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · `proxy_http_version` default 1.1 since 1.29.7, 1.0 before; value 2 since 1.29.4 (*read*) · fetched 2026-10-12
- **Our delta:** the 1.28-and-older side of the line. See the version note about `Connection`.

### T04-16 · Keep-alive timeouts vs Node's — Understand · 🔲 not written
- **Read this:** [Reverse Proxy, HTTP Keep-Alive Timeout, and sporadic HTTP 502s](https://iximiuz.com/en/posts/reverse-proxy-http-keep-alive-and-502s/) · iximiuz, 30 Sep 2021 (updated 5 May 2024) · the race when a backend closes an idle connection as the proxy reuses it (*read* the lead) · covers our angle: **partial** — no nginx or Node settings (the page text has no "nginx") · fetched 2026-10-12
- **Also good:** [Node http](https://nodejs.org/api/http.html) · Node docs · `server.keepAliveTimeout` and `keepAliveTimeoutBuffer` are listed (*headings only*) · fetched 2026-10-12
- **Our delta:** concrete numbers: nginx upstream `keepalive_timeout` 60s, `keepalive_requests` 1000, `keepalive_time` 1h (*read* on the upstream module page); Node `server.keepAliveTimeout` default 5000 ms (*read*). The race and the right ordering of the two are not on a nginx.org page.

### T04-17 · The four timeouts — Understand · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · `proxy_connect_timeout` 60s (cannot usually exceed 75s), `proxy_read_timeout` 60s between two reads (*read*) · covers our angle: **partial** — `proxy_send_timeout` and `send_timeout` not read · fetched 2026-10-12
- **Our delta:** which timeout maps to which 504.

### T04-18 · `proxy_buffering` — Master · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · default `on`, spills to a temp file, `X-Accel-Buffering` yes/no override (*read*) · covers our angle: full · fetched 2026-10-12

### T04-19 · `proxy_buffers`, `proxy_buffer_size`, temp files — Understand · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · `proxy_buffers` default `8 4k|8k` (*read* that entry) · covers our angle: **partial** — other three directives and the warning text not read · fetched 2026-10-12

### T04-20 · `proxy_request_buffering` — Understand · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · default `on`, the whole body is read before the request goes upstream (*read*) · covers our angle: **partial** — cost of turning it off not read · fetched 2026-10-12

### T04-21 · `proxy_next_upstream` — Understand · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · default `error timeout`; list incl. `http_502`, `non_idempotent`, `off` (*read* the list) · covers our angle: **partial** — the `_tries` and `_timeout` text and the danger paragraph not read · fetched 2026-10-12

### T04-22 · Reading 502 vs 504 vs 499 — Understand · 🔲 not written
- **Read this:** [nginx 499 status code](https://www.netdata.cloud/guides/nginx/nginx-499-client-closed-connection/) · Netdata guide, undated · sections: what it means, causes, quick checks, fixes (*headings only*) · covers our angle: **partial** — 499 only · fetched 2026-10-12
- **Also good:** [502 Bad Gateway](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/502) and [504 Gateway Timeout](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/504) · MDN (*headings only*) · fetched 2026-10-12
- *Checked, not chosen:* MDN has no page for 499 (404).

### T04-23 · `proxy_intercept_errors` — Understand · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · default `off`; responses at or above 300 go to `error_page` when on (*read*) · covers our angle: **partial** — "when not to" is ours · fetched 2026-10-12

### T04-24 · `proxy_ignore_client_abort` and 499 — Know · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · default `off`; whether the upstream connection closes when the client leaves (*read*) · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [nginx 499 status code](https://www.netdata.cloud/guides/nginx/nginx-499-client-closed-connection/) · Netdata (*headings only*) · fetched 2026-10-12

### T04-25 · WebSocket proxying — Master · 🔲 not written
- **Read this:** [WebSocket proxying](https://nginx.org/en/docs/http/websocket.html) · nginx.org · `Upgrade` is hop-by-hop; `map $http_upgrade $connection_upgrade`; 60s idle close, `proxy_read_timeout` (*read*) · covers our angle: **partial** — see the version note: the page's first example uses a literal `Connection "upgrade"` · fetched 2026-10-12
- **Also good:** [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455.html) · IETF (*headings only*) · fetched 2026-10-12

### T04-26 · Server-Sent Events — Understand · 🔲 not written
- **Read this:** [How to Configure Server-Sent Events Through Nginx](https://oneuptime.com/blog/post/2025-12-16-server-sent-events-nginx/view) · OneUptime, 2025-12-16 · `proxy_buffering off`, `proxy_cache off`, `X-Accel-Buffering: no`, long read timeout, Node backend (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) · MDN · `text/event-stream`, `retry` (*read*) · fetched 2026-10-12
- **Our delta:** its config still uses the pre-1.29.7 `Connection ''` lines.

### T04-27 · HTTP/2 to the backend — Know · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · `proxy_http_version` accepts `2` since 1.29.4 and needs the v2 module (*read*) · covers our angle: **partial** — "when it helps" is not covered · fetched 2026-10-12

### T04-28 · `proxy_ssl_*` — Understand · 🔲 not written
- **Read this:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · `proxy_ssl_server_name` default `off` (SNI), `proxy_ssl_verify` default `off` (*read*) · covers our angle: **partial** — trusted CA setup not read · fetched 2026-10-12

### T04-29 · `grpc_pass` — When Needed · 🔲 not written
- **Read this:** [ngx_http_grpc_module](https://nginx.org/en/docs/http/ngx_http_grpc_module.html) · nginx.org · `grpc_pass` address, `unix:` path, `grpc://` scheme (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Introduction to gRPC](https://grpc.io/docs/what-is-grpc/introduction/) · grpc.io (*headings only*) · fetched 2026-10-12

### T04-30 · The `stream` module — Know · 🔲 not written
- **Read this:** [ngx_stream_core_module](https://nginx.org/en/docs/stream/ngx_stream_core_module.html) · nginx.org · `listen ... udp`, `proxy_pass` to TCP or UDP, Unix socket (*read* the example) · covers our angle: **partial** — Postgres/Redis/MQTT are ours · fetched 2026-10-12
- **Also good:** [ngx_stream_ssl_preread_module](https://nginx.org/en/docs/stream/ngx_stream_ssl_preread_module.html) · nginx.org · `ssl_preread`, `$ssl_preread_server_name` (*read*) · fetched 2026-10-12

---

## Phase 5 — TLS, HTTP/2 and HTTP/3

### T05-01 · The TLS server block — Master · 🔲 not written
- **Read this:** [Configuring HTTPS servers](https://nginx.org/en/docs/http/configuring_https_servers.html) · nginx.org · `ssl` on `listen`, certificate and key paths (*read* the opening) · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [ngx_http_v2_module](https://nginx.org/en/docs/http/ngx_http_v2_module.html) · `http2 on|off`, default `off`, since 1.25.1 (*read*) · fetched 2026-10-12

### T05-02 · Certificate chain order — Master · 🔲 not written
- **Read this:** [Configuring HTTPS servers](https://nginx.org/en/docs/http/configuring_https_servers.html) · nginx.org · "SSL certificate chains": server certificate must appear before the chain in the combined file (*read*) · covers our angle: **partial** — the curl symptom is ours · fetched 2026-10-12

### T05-03 · HTTP to HTTPS redirect — Understand · 🔲 not written
- **Read this:** [TLS configuration](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/TLS) · MDN · port 80 should only redirect to the same resource on HTTPS, which lets HSTS take over (*read*) · covers our angle: **partial** — no nginx `return 301` · fetched 2026-10-12

### T05-04 · `ssl_protocols`, `ssl_ciphers` — Understand · 🔲 not written
- **Read this:** [ngx_http_ssl_module](https://nginx.org/en/docs/http/ngx_http_ssl_module.html) · nginx.org · `ssl_protocols TLSv1.2 TLSv1.3`, `ssl_ciphers HIGH:!aNULL:!MD5`, `ssl_prefer_server_ciphers off` defaults (*read*) · covers our angle: **partial** — the TLS 1.3 reasoning is ours · fetched 2026-10-12
- **Also good:** [TLSRef Server-Side TLS](https://docs.tlsref.org/server-side-tls.html) · TLSRef (where Mozilla's SSL config generator now points) · Modern profile: TLS 1.3 only, ECDSA P-256 certificates; Intermediate also offered (*read*) · fetched 2026-10-12

### T05-05 · Session resumption — Understand · 🔲 not written
- **Read this:** [Configuring HTTPS servers](https://nginx.org/en/docs/http/configuring_https_servers.html) · nginx.org · shared cache, about 4000 sessions per megabyte, 5 minute default (*read*) · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [ngx_http_ssl_module](https://nginx.org/en/docs/http/ngx_http_ssl_module.html) · `ssl_session_cache` default `none`, `ssl_session_tickets` default `on` (*read*) · fetched 2026-10-12
- **Our delta:** the forward-secrecy case against tickets is not on either page.

### T05-06 · Certificates with ACME (Certbot) — Master · 🔲 not written
- **Read this:** [Certbot User Guide](https://eff-certbot.readthedocs.io/en/stable/using.html) · EFF · `--webroot` with `--webroot-path`, `--nginx`, `--deploy-hook` after a successful renewal (*read*) · covers our angle: **partial** — nginx reload hook recipe not shown · fetched 2026-10-12
- **Also good:** [Challenge Types](https://letsencrypt.org/docs/challenge-types/) · Let's Encrypt (*headings only*) · fetched 2026-10-12

### T05-07 · `ngx_http_acme_module` — Understand · 🔲 not written
- **Read this:** [ngx_http_acme_module](https://nginx.org/en/docs/http/ngx_http_acme_module.html) · nginx.org · `acme_issuer`, `acme_certificate`, `acme_shared_zone`, `state_path` (*read*) · covers our angle: **partial** — "dynamic module" claim not confirmed on the page · fetched 2026-10-12

### T05-08 · HSTS — Understand · 🔲 not written
- **Read this:** [Strict-Transport-Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security) · MDN · `max-age`, `includeSubDomains`, `preload` (*read*) · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [HSTS Preload](https://hstspreload.org/) · hstspreload.org (*headings only*: submission requirements, removal) · fetched 2026-10-12

### T05-09 · HTTP/2 — Understand · 🔲 not written
- **Read this:** [HTTP/2](https://hpbn.co/http2/) · High Performance Browser Networking (Ilya Grigorik), © 2013 · multiplexing; HTTP/1.x workarounds (concatenation, sprites, domain sharding) can go (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [ngx_http_v2_module](https://nginx.org/en/docs/http/ngx_http_v2_module.html) · nginx.org (*read*) · fetched 2026-10-12
- *Checked, not chosen:* web.dev/articles/http2, 404.

### T05-10 · HTTP/3 and QUIC — Know · 🔲 not written
- **Read this:** [Support for QUIC and HTTP/3](https://nginx.org/en/docs/quic.html) · nginx.org · since 1.25.0; OpenSSL 3.5.1+ recommended; `quic` listen with `reuseport`; needs TLS 1.3 (*read*) · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [ngx_http_v3_module](https://nginx.org/en/docs/http/ngx_http_v3_module.html) · example has `listen 8443 quic reuseport;`, `listen 8443 ssl;`, `add_header Alt-Svc` (*read*) · fetched 2026-10-12
- **Our delta:** the UDP firewall rule is not on either page (not confirmed). Per nginx.org/2026.html a v3 buffer overflow was fixed in 1.30.5 / 1.31.6.

### T05-11 · `ssl_reject_handshake on` — Understand · 🔲 not written
- **Read this:** [ngx_http_ssl_module](https://nginx.org/en/docs/http/ngx_http_ssl_module.html) · nginx.org · since 1.19.4; the `listen 443 ssl default_server` example (*read*) · covers our angle: full · fetched 2026-10-12

### T05-12 · OCSP stapling — Know · 🔲 not written
- **Read this:** [ngx_http_ssl_module](https://nginx.org/en/docs/http/ngx_http_ssl_module.html) · nginx.org · `ssl_stapling` default `off`, needs a `resolver` (*read*) · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [Ending OCSP Support in 2025](https://letsencrypt.org/2024/12/05/ending-ocsp) · Let's Encrypt, 2024-12-05 · timeline: OCSP URLs dropped from certificates on 7 May 2025 (*read* the timeline) · fetched 2026-10-12
- **Our delta:** for Let's Encrypt certificates stapling now has nothing to staple.

### T05-13 · `ssl_early_data` — Know · 🔲 not written
- **Read this:** [ngx_http_ssl_module](https://nginx.org/en/docs/http/ngx_http_ssl_module.html) · nginx.org · default `off`; early-data requests can be replayed (*read*) · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [Introducing 0-RTT](https://blog.cloudflare.com/introducing-0-rtt/) · Cloudflare, 2017-03-15 (updated 2026-07-15) · has a "What's the catch?" section (*headings only*) · fetched 2026-10-12

### T05-14 · Client certificates / mTLS — When Needed · 🔲 not written
- **Read this:** [ngx_http_ssl_module](https://nginx.org/en/docs/http/ngx_http_ssl_module.html) · nginx.org · `ssl_verify_client on|off|optional|optional_no_ca`, result in `$ssl_client_verify` (*read*) · covers our angle: **partial** — service-to-service use is ours · fetched 2026-10-12

### T05-15 · Newer TLS knobs — When Needed · 🔲 not written
- **Read this:** [ngx_http_ssl_module](https://nginx.org/en/docs/http/ngx_http_ssl_module.html) · nginx.org · `ssl_certificate_compression` (1.29.1, OpenSSL 3.2+), `ssl_ech_file` (1.29.4, OpenSSL 4.0+), `ssl_conf_command` (*read*) · covers our angle: full · fetched 2026-10-12

### T05-16 · Testing TLS honestly — Know · 🔲 not written
- **Read this:** [openssl-s_client](https://docs.openssl.org/master/man1/openssl-s_client/) · OpenSSL docs · the `s_client` options (*headings only*) · covers our angle: **partial** — no SSL Labs or "A+" discussion · fetched 2026-10-12
- **Also good:** [SSL/TLS Deployment Best Practices](https://www.ssllabs.com/projects/best-practices/) · Qualys SSL Labs, © 2009-2026 (*read* the intro) · fetched 2026-10-12
- *Not opened:* ssllabs.com/ssltest, testssl.sh.
