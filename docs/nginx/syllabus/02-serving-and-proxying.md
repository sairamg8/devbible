---
title: "Part 2 — Serving and proxying"
sidebar_label: "2 · Serving and proxying"
sidebar_position: 2
---

> Phases 3–5 · Static files and SPAs, the reverse proxy in front of Node, and TLS

> Verified: 2026-08-14 against
> [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html),
> [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html),
> [ngx_http_ssl_module](https://nginx.org/en/docs/http/ngx_http_ssl_module.html),
> [ngx_http_v3_module](https://nginx.org/en/docs/http/ngx_http_v3_module.html),
> [ngx_http_acme_module](https://nginx.org/en/docs/http/ngx_http_acme_module.html),
> [WebSocket proxying](https://nginx.org/en/docs/http/websocket.html) and
> [CHANGES-1.30](https://nginx.org/en/CHANGES-1.30).
> **No sandbox run** — this is an inventory, not an explanation.

This is the part you were actually hired for. In a MERN or PERN deployment nginx
does three jobs: it hands the browser your built React bundle, it forwards
`/api` to Node, and it terminates TLS. Phases 3–5 are those three jobs, in that
order.

---

## Phase 3 — Serving static files and SPAs

Nothing in nginx is faster than the thing it was written to do. This phase is
also where the two most common config bugs in existence live: `alias` with a
missing slash, and an SPA fallback that swallows your 404s.

| Topic | Tier |
|---|---|
| **`root` vs `alias`** — `root` *appends* the URI to the path, `alias` *replaces* the matched location; the trailing-slash rule that makes `alias` bite | <span className="db-tier t-master">Master</span> |
| **`try_files`** — the ordered existence check, `$uri`, `$uri/`, a named location, and the `=404` terminator | <span className="db-tier t-master">Master</span> |
| **The SPA fallback**: `try_files $uri $uri/ /index.html;` — why it works, and **why it must not be applied to `/api`**, or every backend 404 becomes an HTML page with status 200 | <span className="db-tier t-master">Master</span> |
| **Serving a built React/Vite bundle** — hashed assets cached for a year, `index.html` never cached, and why getting this backwards ships a stale app to every user | <span className="db-tier t-master">Master</span> |
| **`expires` and `Cache-Control` for static assets** — `expires max`, `expires -1`, `add_header Cache-Control "public, immutable"`, and matching the policy to the filename | <span className="db-tier t-master">Master</span> |
| `index`, `autoindex`, and the directory-request redirect that adds a trailing slash | <span className="db-tier t-understand">Understand</span> |
| **MIME types** — `include mime.types`, `default_type`, and the `.mjs`/`.wasm`/`.avif` entries you may have to add yourself | <span className="db-tier t-understand">Understand</span> |
| **`sendfile`, `tcp_nopush`, `tcp_nodelay`** — zero-copy delivery, filling packets before sending, and why the trio is quoted together in every tuning post | <span className="db-tier t-understand">Understand</span> |
| `open_file_cache` — caching file descriptors and stat results; the staleness window it introduces | <span className="db-tier t-know">Know</span> |
| **Pre-compressed assets** — `gzip_static`, serving `app.js.br` / `app.js.gz` built by Vite instead of compressing on every request | <span className="db-tier t-understand">Understand</span> |
| **Range requests and `$slice`** — how video and large-file seeking works, and what `ngx_http_slice_module` is for | <span className="db-tier t-know">Know</span> |
| Protected downloads with **`X-Accel-Redirect`** — let Node authorise, let nginx send the bytes | <span className="db-tier t-understand">Understand</span> |
| `error_page` for static sites — a real 404 page, and keeping the status code honest | <span className="db-tier t-understand">Understand</span> |
| Serving a Next.js / Nuxt hybrid — what is genuinely static, what must reach Node, and where the line falls | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** a config that serves a Vite build where `index.html`
revalidates on every load, hashed assets are cached for a year, deep links work
on refresh, and `GET /api/nope` returns a JSON 404 from Node — not HTML.

---

## Phase 4 — Reverse proxy to Node

The core of the track. 🔴 **This phase changed materially in the 1.29.x line** —
the defaults everybody memorised are no longer the defaults.

### `proxy_pass` and the URI rule

| Topic | Tier |
|---|---|
| **`proxy_pass` with a URI vs without one** — with a URI, the part of the request matching the location is *replaced*; without one, the request URI is passed through unchanged. This one rule explains most double-prefix bugs | <span className="db-tier t-master">Master</span> |
| **The trailing slash**: `proxy_pass http://app:3000;` vs `proxy_pass http://app:3000/;` — the same URL, two different results | <span className="db-tier t-understand">Understand</span> |
| **`proxy_pass` inside a regex location, and with a variable** — both disable the URI-replacement rule, and the variable form forces runtime DNS resolution | <span className="db-tier t-understand">Understand</span> |
| Proxying to a **Unix socket** (`proxy_pass http://unix:/run/app.sock;`) and when it beats a TCP port | <span className="db-tier t-know">Know</span> |

### Headers, in both directions

| Topic | Tier |
|---|---|
| **`proxy_set_header Host $host`** — nginx defaults `Host` to the `proxy_pass` value, which is almost never what Express should see | <span className="db-tier t-master">Master</span> |
| **`X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host`** — what each carries, and why appending with `$proxy_add_x_forwarded_for` is not the same as setting it | <span className="db-tier t-master">Master</span> |
| **The `trust proxy` handshake with Express** — nginx sets the headers, Express must be told to believe them, and the two must agree or you get the wrong client IP and broken secure cookies | <span className="db-tier t-master">Master</span> |
| **`ngx_http_realip_module`** — `set_real_ip_from`, `real_ip_header`, `real_ip_recursive`; rewriting `$remote_addr` so *nginx's own* logs and rate limits see the real client | <span className="db-tier t-master">Master</span> |
| **The forwarded-header trust chain** — why `X-Forwarded-For` is client-controlled and forgeable unless every hop is explicitly trusted; the rate-limit bypass this creates | <span className="db-tier t-master">Master</span> |
| The standard `Forwarded` header (RFC 7239) vs the `X-Forwarded-*` convention — and why the old ones won | <span className="db-tier t-know">Know</span> |
| **`proxy_hide_header`, `proxy_pass_header`, `proxy_set_header … ""`** — removing `X-Powered-By`, forwarding what nginx hides by default, dropping a header entirely | <span className="db-tier t-understand">Understand</span> |
| **Inheritance trap**: setting *any* `proxy_set_header` in a `location` discards every one inherited from `server` — the replace-not-merge rule biting where it hurts most | <span className="db-tier t-understand">Understand</span> |
| `proxy_redirect` — rewriting `Location` and `Refresh` headers when the backend does not know its public URL | <span className="db-tier t-understand">Understand</span> |
| `proxy_cookie_path`, `proxy_cookie_domain`, `proxy_cookie_flags` — fixing cookies from a backend mounted under a different path | <span className="db-tier t-know">Know</span> |

### Connections, buffering and failure

| Topic | Tier |
|---|---|
| 🔴 **Upstream keep-alive is on by default since 1.29.7** — `keepalive 32 local;`, `proxy_http_version` defaults to `1.1`, and the `Connection` header is no longer sent. The famous three-line keep-alive incantation is now redundant on 1.30+, and still required on 1.28 and older | <span className="db-tier t-master">Master</span> |
| `keepalive_requests`, `keepalive_time`, `keepalive_timeout` in the upstream block — and matching them to Node's own `server.keepAliveTimeout` to avoid 502s on idle sockets | <span className="db-tier t-understand">Understand</span> |
| **The four timeouts**: `proxy_connect_timeout` (60s), `proxy_send_timeout` (60s), `proxy_read_timeout` (60s), plus `send_timeout` to the client — which one your 504 came from | <span className="db-tier t-understand">Understand</span> |
| **`proxy_buffering`** (default `on`) — nginx reads the whole response as fast as the backend can produce it, freeing the Node handler early; and why you must turn it **off** for SSE and streaming responses | <span className="db-tier t-master">Master</span> |
| `proxy_buffers`, `proxy_buffer_size`, `proxy_busy_buffers_size`, `proxy_max_temp_file_size` — where a large response actually lands, and the "buffered to a temporary file" warning | <span className="db-tier t-understand">Understand</span> |
| **`proxy_request_buffering`** (default `on`) — nginx reads the entire upload before Node sees a byte; turning it off for streaming uploads and what that costs you | <span className="db-tier t-understand">Understand</span> |
| **`proxy_next_upstream`** — which failures retry on another server, the danger of retrying non-idempotent requests, `proxy_next_upstream_tries` and `_timeout` | <span className="db-tier t-understand">Understand</span> |
| **Reading a 502 vs 504 vs 499** — bad gateway, gateway timeout, and the client-closed-connection code nginx invented; what each tells you about Node | <span className="db-tier t-understand">Understand</span> |
| `proxy_intercept_errors` — replacing an upstream error page with your own, and when *not* to | <span className="db-tier t-understand">Understand</span> |
| `proxy_ignore_client_abort`, and why a cancelled fetch shows up as a 499 in your logs | <span className="db-tier t-know">Know</span> |

### Beyond plain HTTP

| Topic | Tier |
|---|---|
| **WebSocket proxying** — `proxy_set_header Upgrade $http_upgrade;` plus the `map $http_upgrade $connection_upgrade` block; why the `map` is mandatory and a literal `Connection: upgrade` is wrong | <span className="db-tier t-master">Master</span> |
| **Server-Sent Events** — `proxy_buffering off`, `proxy_cache off`, `X-Accel-Buffering: no`, and a `proxy_read_timeout` long enough to survive a quiet stream | <span className="db-tier t-understand">Understand</span> |
| **HTTP/2 to the backend** — `proxy_http_version 2` support arrived in 1.29.4; when it helps and when HTTP/1.1 keep-alive is already enough | <span className="db-tier t-know">Know</span> |
| `proxy_ssl_*` — proxying to an HTTPS upstream, verifying its certificate, and SNI with `proxy_ssl_server_name` | <span className="db-tier t-understand">Understand</span> |
| `grpc_pass` and the gRPC module — the shape of it, for the day a service is not HTTP | <span className="db-tier t-when">When Needed</span> |
| **The `stream` module** — proxying raw TCP/UDP (Postgres, Redis, MQTT) and `ssl_preread` for SNI routing without terminating TLS | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** React on `/`, Express on `/api`, a working WebSocket
upgrade, correct `req.ip` inside Express, and a streaming SSE endpoint that does
not buffer — all in one config you can explain line by line.

---

## Phase 5 — TLS, HTTP/2 and HTTP/3

Free certificates removed the excuse. What is left is knowing which defaults are
wrong and which are already right.

| Topic | Tier |
|---|---|
| **The TLS server block** — `listen 443 ssl;` plus `ssl_certificate` and `ssl_certificate_key`; and that since 1.25.1 `http2` is its own directive, not a `listen` parameter | <span className="db-tier t-master">Master</span> |
| **Certificate chain order** — `ssl_certificate` takes leaf **then** intermediates in one file; the "works in Chrome, fails in curl" symptom of getting it wrong | <span className="db-tier t-master">Master</span> |
| **The HTTP → HTTPS redirect** — a port-80 server that does nothing but `return 301 https://$host$request_uri;`, and why an `if` is not needed | <span className="db-tier t-understand">Understand</span> |
| **`ssl_protocols TLSv1.2 TLSv1.3`** — already the default; `ssl_ciphers` (default `HIGH:!aNULL:!MD5`) and why `ssl_prefer_server_ciphers off` is correct for TLS 1.3 | <span className="db-tier t-understand">Understand</span> |
| **Session resumption** — `ssl_session_cache shared:SSL:10m` (default is `none`, which is a real cost), `ssl_session_timeout`, and the forward-secrecy argument against `ssl_session_tickets` | <span className="db-tier t-understand">Understand</span> |
| **Certificates with ACME** — Certbot's webroot and nginx plugins, the `.well-known/acme-challenge` location, renewal, and the reload hook that actually picks up the new cert | <span className="db-tier t-master">Master</span> |
| **`ngx_http_acme_module`** — nginx's own ACMEv2 client (dynamic module, `nginx-module-acme`, since 1.29.0): `acme_issuer`, `acme_certificate`, `acme_shared_zone`, and `$acme_certificate` in place of a file path | <span className="db-tier t-understand">Understand</span> |
| **HSTS** — `Strict-Transport-Security`, `includeSubDomains`, `preload`, and why it is the one header you cannot take back | <span className="db-tier t-understand">Understand</span> |
| **HTTP/2** — multiplexing over one connection, what it does and does not fix, and why domain sharding and asset concatenation became anti-patterns | <span className="db-tier t-understand">Understand</span> |
| **HTTP/3 and QUIC** — `listen 443 quic reuseport;` alongside `listen 443 ssl;`, the mandatory `Alt-Svc` header that advertises it, `--with-http_v3_module`, and the UDP firewall rule everybody forgets | <span className="db-tier t-know">Know</span> |
| **`ssl_reject_handshake on;`** — the correct default-server behaviour for HTTPS: refuse unknown SNI instead of serving a random site's certificate | <span className="db-tier t-understand">Understand</span> |
| OCSP stapling — `ssl_stapling`, `ssl_stapling_verify`, `ssl_trusted_certificate`, and the resolver it quietly needs | <span className="db-tier t-know">Know</span> |
| `ssl_early_data` (0-RTT) — the latency win and the replay-attack caveat that makes it unsafe for non-idempotent requests | <span className="db-tier t-know">Know</span> |
| Client certificates — `ssl_verify_client`, `ssl_client_certificate`, and mTLS between services | <span className="db-tier t-when">When Needed</span> |
| Newer TLS knobs: `ssl_certificate_compression` (1.29.1), `ssl_ech_file` for Encrypted ClientHello (1.29.4), `ssl_conf_command` for raw OpenSSL settings | <span className="db-tier t-when">When Needed</span> |
| Testing TLS honestly — `openssl s_client`, SSL Labs, and what "A+" is and is not worth | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can issue and auto-renew a certificate, score well
on a TLS audit without pasting a config you do not understand, and explain what
`Alt-Svc` has to do with HTTP/3.

---

← Prev: [Part 1 — How nginx works](01-how-nginx-works.md) · Index: [Nginx](../README.md) · Next → [Part 3 — Speed and scale](03-speed-and-scale.md)
