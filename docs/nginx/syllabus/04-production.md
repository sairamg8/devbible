---
title: "Part 4 — Production"
sidebar_label: "4 · Production"
sidebar_position: 4
---

> Phases 9–11 · Keeping the bad traffic out, seeing what is happening, and
> shipping the thing

> Verified: 2026-08-14 against
> [ngx_http_limit_req_module](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html),
> [ngx_http_limit_conn_module](https://nginx.org/en/docs/http/ngx_http_limit_conn_module.html),
> [ngx_http_log_module](https://nginx.org/en/docs/http/ngx_http_log_module.html),
> [ngx_http_stub_status_module](https://nginx.org/en/docs/http/ngx_http_stub_status_module.html),
> [A debugging log](https://nginx.org/en/docs/debugging_log.html),
> [Controlling nginx](https://nginx.org/en/docs/control.html) and
> [nginx news 2026](https://nginx.org/2026.html).
> **No sandbox run** — this is an inventory, not an explanation.

nginx is the first thing on the internet that touches your app and the last thing
that logs what happened. That makes it both your best security control and your
best diagnostic tool — and most teams use it as neither.

---

## Phase 9 — Access control, rate limiting and hardening

Everything here is cheaper in nginx than in Node, because nginx rejects the
request before your event loop ever hears about it.

### Rate and connection limits

| Topic | Tier |
|---|---|
| **`limit_req_zone` and `limit_req`** — a shared zone keyed on something (usually `$binary_remote_addr`), a `rate=10r/s`, and the leaky bucket that enforces it | <span className="db-tier t-master">Master</span> |
| **`burst`, `nodelay` and `delay=`** — burst queues excess requests and *delays* them; `nodelay` serves the burst immediately and rejects beyond it; `delay=N` splits the difference. Getting this wrong is why "my rate limit blocks normal users" | <span className="db-tier t-master">Master</span> |
| **`$binary_remote_addr` over `$remote_addr`** — same key, a quarter of the memory, and the zone-sizing arithmetic that follows from it | <span className="db-tier t-understand">Understand</span> |
| **`limit_req_status`** (default 503) — why 429 is the honest code, and `limit_req_log_level` | <span className="db-tier t-understand">Understand</span> |
| **`limit_req_dry_run`** — measure what a limit *would* reject before you turn it on; the only safe way to introduce one to live traffic | <span className="db-tier t-understand">Understand</span> |
| **`limit_conn_zone` and `limit_conn`** — capping concurrent connections per client, which is a different attack than request rate | <span className="db-tier t-understand">Understand</span> |
| **Rate limiting behind a proxy or CDN is a trap** — keying on `$remote_addr` when every request arrives from Cloudflare limits *Cloudflare*; the `realip` fix and the header-forgery risk | <span className="db-tier t-master">Master</span> |
| Layering limits — a strict one on `/api/login`, a loose one everywhere else, and how multiple `limit_req` directives combine | <span className="db-tier t-understand">Understand</span> |
| Where nginx rate limiting ends and a Redis-backed one begins — per-node vs global counting, and which one your SLA needs | <span className="db-tier t-know">Know</span> |

### Access control and authentication

| Topic | Tier |
|---|---|
| **`allow` / `deny`** — IP allow-lists for `/admin`, `/metrics` and staging; evaluation order and CIDR notation | <span className="db-tier t-understand">Understand</span> |
| **`auth_basic` and `auth_basic_user_file`** — the two-minute password wall for a staging environment, and its exact security value over HTTPS | <span className="db-tier t-understand">Understand</span> |
| **`auth_request`** — delegate the authorisation decision to a subrequest against your Node service; the pattern behind every "auth gateway" blog post | <span className="db-tier t-understand">Understand</span> |
| **`satisfy any` / `satisfy all`** — combining IP rules with authentication instead of choosing one | <span className="db-tier t-know">Know</span> |
| `ngx_http_secure_link_module` — signed, expiring URLs for private downloads without a backend round trip | <span className="db-tier t-know">Know</span> |
| `geo` for country or network based rules, and the honest limits of IP geolocation | <span className="db-tier t-when">When Needed</span> |
| `ngx_http_auth_jwt_module` and `ngx_http_oidc_module` — NGINX Plus; the open-source equivalents (`auth_request` to your own verifier, or njs) | <span className="db-tier t-know">Know</span> |

### Hardening the edge

| Topic | Tier |
|---|---|
| **`server_tokens off`** — and what it does and does not hide | <span className="db-tier t-understand">Understand</span> |
| **Security headers at the edge** — `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options` / `frame-ancestors`, `Referrer-Policy`, `Content-Security-Policy`, `Permissions-Policy`; which belong in nginx and which belong in the app | <span className="db-tier t-master">Master</span> |
| **`add_header` inherits by replacement, and skips error responses** — the `always` parameter, and the 1.29.3 `add_header_inherit` / `add_trailer_inherit` directives that finally address the inheritance half | <span className="db-tier t-master">Master</span> |
| **CORS at the edge** — why doing it in nginx is usually the wrong layer, and how to do it correctly if you must (including the `OPTIONS` preflight) | <span className="db-tier t-understand">Understand</span> |
| **Blocking by `Host`, method and user agent** — `return 444`, limiting methods with `limit_except`, and the difference between blocking noise and blocking an attacker | <span className="db-tier t-understand">Understand</span> |
| **Request smuggling and header hygiene** — why a proxy chain that disagrees about `Content-Length` and `Transfer-Encoding` is dangerous, and staying on a patched nginx | <span className="db-tier t-know">Know</span> |
| **Keeping up with nginx CVEs** — the 1.30.x line shipped security fixes in May, June and July 2026; how patch releases reach you, and why "it works, don't touch it" is a security decision | <span className="db-tier t-understand">Understand</span> |
| Running the worker as an unprivileged `user`, file permissions on `/var/cache/nginx`, and what still needs root | <span className="db-tier t-understand">Understand</span> |
| ModSecurity, the NGINX App Protect WAF, and Cloudflare — when a WAF is worth it and when it is theatre | <span className="db-tier t-when">When Needed</span> |

**Gate — deliverable:** a login endpoint limited to 5 requests a minute per real
client IP behind a CDN, returning 429, proven with `limit_req_dry_run` first —
plus a security-header set you can justify header by header.

---

## Phase 10 — Logs, metrics and debugging

nginx sees every request. The default log format throws away most of what it saw.

| Topic | Tier |
|---|---|
| **`log_format` and `access_log`** — the `combined` default, and the fields it omits that you will want at 3am | <span className="db-tier t-master">Master</span> |
| **The variables worth logging** — `$request_time`, `$upstream_response_time`, `$upstream_connect_time`, `$upstream_header_time`, `$upstream_addr`, `$upstream_status`, `$upstream_cache_status`, `$body_bytes_sent`, `$request_id` | <span className="db-tier t-understand">Understand</span> |
| **`$request_time` vs `$upstream_response_time`** — total including a slow client, vs time your backend actually took; confusing them sends you debugging the wrong system | <span className="db-tier t-master">Master</span> |
| **JSON access logs** — `escape=json`, a format your log pipeline can parse without a regex, and why this is the single highest-value change in the phase | <span className="db-tier t-master">Master</span> |
| **`$request_id`** — a unique id per request, forwarded to Node as a header, echoed in your app logs; end-to-end tracing for free | <span className="db-tier t-master">Master</span> |
| **Conditional logging** — `access_log … if=$condition` with a `map` to drop health checks and static assets from the log volume | <span className="db-tier t-understand">Understand</span> |
| `access_log … buffer= flush= gzip=`, `access_log off`, and the write-throughput cost of logging every request synchronously | <span className="db-tier t-understand">Understand</span> |
| **`error_log` and its levels** — `debug`, `info`, `notice`, `warn`, `error`, `crit`, `alert`, `emerg`; per-server error logs and why `warn` is the right default | <span className="db-tier t-understand">Understand</span> |
| **Reading the error log** — `upstream prematurely closed connection`, `connect() failed (111: Connection refused)`, `no live upstreams`, `client intended to send too large body`, `rewrite or internal redirection cycle`; what each one actually means | <span className="db-tier t-master">Master</span> |
| **Log rotation and `USR1`** — why moving the file is not enough, and what `nginx -s reopen` is for | <span className="db-tier t-understand">Understand</span> |
| **`stub_status`** — the seven numbers open-source nginx gives you (active, accepts, handled, requests, reading, writing, waiting) and what each one tells you | <span className="db-tier t-understand">Understand</span> |
| **Exporting metrics** — `nginx-prometheus-exporter` over `stub_status`, and deriving request rate and error rate from access logs when that is not enough | <span className="db-tier t-know">Know</span> |
| `ngx_otel_module` — OpenTelemetry tracing from nginx itself, and where the spans join your Node traces | <span className="db-tier t-know">Know</span> |
| **The debug log** — `--with-debug`, `error_log … debug`, `debug_connection` for one client only, and why you never leave it on | <span className="db-tier t-know">Know</span> |
| Logging to syslog, and shipping logs from a container where there is no file to rotate | <span className="db-tier t-know">Know</span> |
| `ngx_http_api_module` and the live activity dashboard — NGINX Plus, named so you know what you are looking at | <span className="db-tier t-when">When Needed</span> |

**Gate — deliverable:** JSON access logs carrying a request id that appears in
your Express logs for the same request, health checks excluded, and a dashboard
that can answer "is it nginx, the network, or Node?" in one query.

---

## Phase 11 — Deployment and operations

Where the config stops being a file on your laptop.

| Topic | Tier |
|---|---|
| **Config layout that scales** — `nginx.conf` for globals, one file per site in `conf.d/`, shared snippets included from both; and why `sites-available`/`sites-enabled` is a Debian convention, not an nginx feature | <span className="db-tier t-understand">Understand</span> |
| **`nginx -t` in CI** — validating a config before it reaches a server, and validating it *inside the image* where the include paths actually exist | <span className="db-tier t-master">Master</span> |
| **Reload safely** — `nginx -t && nginx -s reload`, what happens if you skip the test, and the one class of change a reload cannot apply | <span className="db-tier t-master">Master</span> |
| **nginx in a container** — the official image, `daemon off;`, config via bind mount vs baked into the image, logs to stdout/stderr, and running rootless under Podman | <span className="db-tier t-master">Master</span> |
| **nginx in Compose in front of Node** — service names as upstream hosts, the startup race when the app is not up yet, and the `resolver` fix for a container that gets a new IP | <span className="db-tier t-understand">Understand</span> |
| **Environment-specific config** — `envsubst` in the official image's `/docker-entrypoint.d`, `include` of a generated file, and why nginx has no environment variables in the config language | <span className="db-tier t-understand">Understand</span> |
| **Serving the frontend from the nginx image** — multi-stage build, `COPY --from=build /app/dist`, and the tiny final image that results | <span className="db-tier t-understand">Understand</span> |
| **Worker and OS tuning** — `worker_processes auto`, `worker_connections`, `worker_rlimit_nofile`, systemd's `LimitNOFILE`, and the kernel settings that matter before nginx's own do | <span className="db-tier t-understand">Understand</span> |
| systemd integration — the unit file, `ExecReload`, `nginx -s quit` vs `stop`, and reading `journalctl` when nginx will not start | <span className="db-tier t-understand">Understand</span> |
| **Health checks and load-balancer probes** — a `/healthz` location that answers without touching Node, and one that does touch Node; knowing which you configured | <span className="db-tier t-understand">Understand</span> |
| **Blue/green and canary at the nginx layer** — `split_clients` for a percentage rollout, weighted upstreams, and rolling back with one reload | <span className="db-tier t-know">Know</span> |
| **nginx vs the alternatives** — Caddy (automatic TLS), Traefik (service discovery), HAProxy (load balancing depth), Envoy (service mesh), and a cloud ALB; an honest account of when nginx is the wrong answer | <span className="db-tier t-know">Know</span> |
| **nginx as a Kubernetes Ingress controller** — how the same config gets generated from annotations, and why understanding the directives still matters there | <span className="db-tier t-know">Know</span> |
| **njs** — nginx's JavaScript scripting; note that **njs 1.0.0 (June 2026) deprecates the njs engine in favour of QuickJS**. Useful for auth glue and header logic, and a warning sign when it grows past that | <span className="db-tier t-when">When Needed</span> |
| Building nginx from source — `./configure` flags, adding a third-party module, and the maintenance burden you take on | <span className="db-tier t-when">When Needed</span> |
| **A production checklist** — the twenty-line audit you run against any nginx config before it takes traffic | <span className="db-tier t-master">Master</span> |

**Gate — the deliverable for the whole track:** a containerised deployment where
nginx serves a hashed React build, proxies `/api` to several Node replicas over
keep-alive connections, terminates TLS with an auto-renewing certificate, caches
what is safe to cache, rate-limits the login endpoint by real client IP, emits
JSON logs with a request id, and can be reloaded with zero dropped requests —
and you can explain every line of it.

---

## Deliberately not here

Real, documented, and out of brief for a fullstack MERN/PERN developer. Named so
you know they exist and know you are not missing them by accident.

| Left out | Why |
|---|---|
| **The mail proxy modules** (`ngx_mail_*`) | nginx proxies IMAP/POP3/SMTP. Nothing in this bible's stack does. |
| **Media streaming** (`mp4`, `flv`, `hls`, `f4f`, `dash`) | A specialist track; the `slice` module is covered because range requests are general. |
| **Response body transformation** (`xslt`, `image_filter`, `ssi`, `perl`) | Real features, and almost always the wrong layer for an app with a Node backend. |
| **Writing C modules** and the development guide | A different job from operating nginx. |
| **NGINX Plus in depth** — the API, live dashboard, active health checks, `queue`, `slow_start`, key-value store | Named where it matters so you recognise a Plus-only directive in the docs and do not copy it, but not taught. |
| **NGINX Instance Manager, Unit, Gateway Fabric, App Protect** | Separate F5 products with their own documentation. |

---

← Prev: [Part 3 — Speed and scale](03-speed-and-scale.md) · Index: [Nginx](../README.md)
