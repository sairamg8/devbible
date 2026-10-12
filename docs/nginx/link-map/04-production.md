---
title: "Link map · nginx · Part 4"
sidebar_label: "04 · nginx · Production"
sidebar_position: 4
---

# Link map · nginx · Part 4 — Production (phases 9–10)

Covers the topic rows of `docs/nginx/syllabus/04-production.md` for phase 9 (T09-01 to T09-25, access control, rate limiting, hardening) and phase 10 (T10-01 to T10-16, logs, metrics, debugging). Phase 11 (T11-01 to T11-16) is in `04-production-b.md`, the next file. That is 57 rows in all. **None has a page of ours yet (🔲)**: `docs/nginx/pages` holds phases 0 to 2 only.
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. No `#anchors` are given.

🔴 **Version note.** nginx.org/en/download.html on 2026-10-12 lists **stable 1.30.5** and **mainline 1.31.6**; nginx.org/2026.html dates both 2026-09-15 (a `ngx_http_v3_module` buffer-overflow fix, CVE-2026-90439). Our syllabus README still says 1.30.4 / 1.31.3, one security release behind. nginx.org module docs are unversioned (they describe mainline). `github.com` returns 403 to our fetcher, so READMEs are cited as `raw.githubusercontent.com`. docs.nginx.com pages cover NGINX Plus and open source together; the Plus-only parts are marked.

---

## Phase 9 — Access control, rate limiting and hardening

### T09-01 · `limit_req_zone` and `limit_req` — Master · 🔲 not written
- **Read this:** [ngx_http_limit_req_module](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html) · nginx.org · "leaky bucket" method, zone syntax with `rate=`, key as one variable (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Limiting Access to Proxied HTTP Resources](https://docs.nginx.com/nginx/admin-guide/security-controls/controlling-access-proxied-http/) · docs.nginx.com, modified 2026-07-02 · connection and request-rate limits in one admin guide (*headings only*)

### T09-02 · `burst`, `nodelay` and `delay=` — Master · 🔲 not written
- **Read this:** [ngx_http_limit_req_module](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html) · nginx.org · burst queue, `nodelay`, `delay` (1.15.7), default burst 0 (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Rate Limiting with NGINX](https://blog.nginx.org/blog/rate-limiting-nginx) · NGINX Community Blog, 2017-06-12 · worked examples; its own editor's note says the burst/delay description is inaccurate and points to nginx.org, so use it for examples only (*read*)
- **Our delta:** the "my limit blocks normal users" diagnosis, with a request timeline for each of the three modes.

### T09-03 · `$binary_remote_addr` over `$remote_addr` — Understand · 🔲 not written
- **Read this:** [ngx_http_limit_req_module](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html) · nginx.org · key size 4 or 16 bytes, state 64 or 128 bytes, about 16 thousand 64-byte states per megabyte, least-recently-used eviction (*read*) · covers our angle: full · fetched 2026-10-12

### T09-04 · `limit_req_status` and `limit_req_log_level` — Understand · 🔲 not written
- **Read this:** [ngx_http_limit_req_module](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html) · nginx.org · `limit_req_status` default 503 (since 1.3.15); delays log one level below refusals (*read*) · covers our angle: **partial** — does not argue for 429 · fetched 2026-10-12
- **Also good:** [429 Too Many Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429) · MDN · the status code itself (*headings only*)

### T09-05 · `limit_req_dry_run` — Understand · 🔲 not written
- **Read this:** [ngx_http_limit_req_module](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html) · nginx.org · appeared in 1.17.1; rate is not limited but excess requests are still counted in the zone (*read*) · covers our angle: **partial** — no recipe for reading the dry-run results from the log · fetched 2026-10-12
- **Our delta:** the "log it, count it, then switch it on" procedure from the Gate.

### T09-06 · `limit_conn_zone` and `limit_conn` — Understand · 🔲 not written
- **Read this:** [ngx_http_limit_conn_module](https://nginx.org/en/docs/http/ngx_http_limit_conn_module.html) · nginx.org · a connection counts only with a request in process and the whole header read; has its own `limit_conn_status` (*read*) · covers our angle: **partial** — no contrast with request-rate attacks · fetched 2026-10-12

### T09-07 · Rate limiting behind a proxy or CDN is a trap — Master · 🔲 not written
- **Read this:** [ngx_http_realip_module](https://nginx.org/en/docs/http/ngx_http_realip_module.html) · nginx.org · `set_real_ip_from` defines trusted addresses, `real_ip_header`, `real_ip_recursive`; not built by default (*read*) · covers our angle: **partial** — says nothing about rate limiting or forged headers · fetched 2026-10-12
- **Also good:** [Restoring original visitor IPs](https://developers.cloudflare.com/support/troubleshooting/restoring-visitor-ips/restoring-original-visitor-ips/) · Cloudflare, updated 2026-04-23 · nginx section uses `set_real_ip_from` plus `real_ip_header CF-Connecting-IP` and says the prefix list needs regular updates (*read*)
- **Our delta:** the proof that unkeyed limits hit the CDN, and the trust boundary: only listed proxies may set the header.

### T09-08 · Layering limits — Understand · 🔲 not written
- **Read this:** [ngx_http_limit_req_module](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html) · nginx.org · several `limit_req` in one location, and inheritance only when none is set at the current level (*read*) · covers our angle: **partial** — no strict-login / loose-elsewhere layout · fetched 2026-10-12

### T09-09 · nginx limits vs a Redis-backed limiter — Know · 🔲 not written
- **Read this:** [NGINX Redis Rate Limit Module](https://www.getpagespeed.com/server-setup/nginx-redis-rate-limit-module) · GetPageSpeed, 2026-03-19 (updated 2026-06-07) · each server keeps its own counters in local shared memory, so 100 req/s spread over 5 servers shows 20 each (*read* the opening) · covers our angle: **partial** — vendor page selling a module; no SLA guidance · fetched 2026-10-12
- **Our delta:** the per-node vs global decision table; no neutral source found for it.

### T09-10 · `allow` / `deny` — Understand · 🔲 not written
- **Read this:** [ngx_http_access_module](https://nginx.org/en/docs/http/ngx_http_access_module.html) · nginx.org · rules checked in sequence until the first match; IPv4, IPv6 and CIDR example (*read*) · covers our angle: full · fetched 2026-10-12

### T09-11 · `auth_basic` and `auth_basic_user_file` — Understand · 🔲 not written
- **Read this:** [ngx_http_auth_basic_module](https://nginx.org/en/docs/http/ngx_http_auth_basic_module.html) · nginx.org · directives and the `htpasswd` file example (*read*) · covers our angle: **partial** — no statement of its security value over HTTPS · fetched 2026-10-12
- **Also good:** [Restricting Access with HTTP Basic Authentication](https://docs.nginx.com/nginx/admin-guide/security-controls/configuring-http-basic-authentication/) · docs.nginx.com, modified 2026-10-07 · creating the password file, combining with IP rules (*read* the `satisfy` part)

### T09-12 · `auth_request` — Understand · 🔲 not written
- **Read this:** [ngx_http_auth_request_module](https://nginx.org/en/docs/http/ngx_http_auth_request_module.html) · nginx.org · 2xx allows, 401 or 403 denies, anything else is an error; the `/auth` location example (*read*) · covers our angle: **partial** — no Node verifier · fetched 2026-10-12
- **Also good:** [Authentication Based on Subrequest Result](https://docs.nginx.com/nginx/admin-guide/security-controls/configuring-subrequest-authentication/) · docs.nginx.com, modified 2026-07-02 (*headings only*)

### T09-13 · `satisfy any` / `satisfy all` — Know · 🔲 not written
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · `satisfy all | any`, default `all`, covers the access, basic, request and JWT modules (*read* the directive entry) · covers our angle: full · fetched 2026-10-12

### T09-14 · `ngx_http_secure_link_module` — Know · 🔲 not written
- **Read this:** [ngx_http_secure_link_module](https://nginx.org/en/docs/http/ngx_http_secure_link_module.html) · nginx.org · MD5-checked links with a lifetime; `$secure_link_expires`; no expiry means unlimited (*read*) · covers our angle: full · fetched 2026-10-12

### T09-15 · `geo` and the limits of IP geolocation — When Needed · 🔲 not written
- **Read this:** [ngx_http_geo_module](https://nginx.org/en/docs/http/ngx_http_geo_module.html) · nginx.org · variables chosen by client address (*read* the intro) · covers our angle: **partial** — nothing on geolocation accuracy · fetched 2026-10-12
- **Also good:** [Restricting Access by Geographical Location](https://docs.nginx.com/nginx/admin-guide/security-controls/controlling-access-by-geoip/) · docs.nginx.com, modified 2026-07-02 · MaxMind databases; its GeoIP2 steps are written for NGINX Plus (*read* the intro)

### T09-16 · `ngx_http_auth_jwt_module` and `ngx_http_oidc_module` (Plus) — Know · 🔲 not written
- **Read this:** [ngx_http_auth_jwt_module](https://nginx.org/en/docs/http/ngx_http_auth_jwt_module.html) · nginx.org · "available as part of our commercial subscription"; algorithm list (*read*) · covers our angle: **partial** — no open-source equivalent · fetched 2026-10-12
- **Also good:** [ngx_http_oidc_module](https://nginx.org/en/docs/http/ngx_http_oidc_module.html) · nginx.org · same commercial note (*read*)
- **Our delta:** the open-source route: `auth_request` to your own verifier, or njs.

### T09-17 · `server_tokens off` — Understand · 🔲 not written
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · version on error pages and the `Server` header; `build` and string forms (*read*) · covers our angle: **partial** — does not list what it leaves visible · fetched 2026-10-12

### T09-18 · Security headers at the edge — Master · 🔲 not written
- **Read this:** [HTTP Security Response Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html) · OWASP · HSTS value `max-age=63072000; includeSubDomains; preload`, `frame-ancestors` over X-Frame-Options, `nosniff` (*read* those three; the rest *headings only*) · covers our angle: **partial** — framework-neutral; no nginx-vs-app split · fetched 2026-10-12
- **Also good:** [NGINX Security Headers, the right way](https://www.getpagespeed.com/server-setup/nginx-security-headers-the-right-way) · GetPageSpeed, 2020-05-31 (updated 2026-09-14) · `add_header` and module routes (*read* the inheritance part)
- **Our delta:** which headers live in nginx and which in Express (Helmet), and justifying each one.

### T09-19 · `add_header` inheritance, `always`, `add_header_inherit` — Master · 🔲 not written
- **Read this:** [ngx_http_headers_module](https://nginx.org/en/docs/http/ngx_http_headers_module.html) · nginx.org · inherited only if the level has no `add_header`; `always` (1.7.5); `add_header_inherit on | off | merge` (1.29.3); the status-code list (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [NGINX CORS: Why the Config You Copied Is Broken](https://www.getpagespeed.com/server-setup/nginx/nginx-cors) · GetPageSpeed, 2026-01-24 (updated 2026-09-14) · one unrelated `add_header` in a location silently drops three CORS headers (*read*)

### T09-20 · CORS at the edge — Understand · 🔲 not written
- **Read this:** [NGINX CORS: Why the Config You Copied Is Broken](https://www.getpagespeed.com/server-setup/nginx/nginx-cors) · GetPageSpeed, 2026-01-24 (updated 2026-09-14) · `map $http_origin`, `OPTIONS` returning 204, missing `Vary: Origin`, header inheritance (*read*) · covers our angle: **partial** — does not argue for doing it in the app · fetched 2026-10-12
- **Also good:** [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) · MDN · what the preflight is (*read* the intro)

### T09-21 · Blocking by `Host`, method and user agent — Understand · 🔲 not written
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · `limit_except` limits methods in a location (*read*) · covers our angle: **partial** — no Host or user-agent recipes · fetched 2026-10-12
- **Also good:** [ngx_http_rewrite_module](https://nginx.org/en/docs/http/ngx_http_rewrite_module.html) · nginx.org · "The non-standard code 444 closes a connection without sending a response header" (*read*)

### T09-22 · Request smuggling and header hygiene — Know · 🔲 not written
- **Read this:** [HTTP request smuggling](https://portswigger.net/web-security/request-smuggling) · PortSwigger Web Security Academy · `Content-Length` vs `Transfer-Encoding` as two ways to end a request (*read* the intro) · covers our angle: **partial** — not nginx-specific · fetched 2026-10-12
- **Our delta:** nginx's side of it and "stay patched"; no nginx-specific explainer found.

### T09-23 · Keeping up with nginx CVEs — Understand · 🔲 not written
- **Read this:** [nginx security advisories](https://nginx.org/en/security_advisories.html) · nginx.org · per-advisory severity, vulnerable and fixed versions (*read* the 2026 entries) · covers our angle: full · fetched 2026-10-12
- **Also good:** [nginx news 2026](https://nginx.org/2026.html) · nginx.org · 2026-09-15 release of 1.30.5 and 1.31.6 (*read*)
- **Our delta:** syllabus says fixes in May, June, July; the news page adds 2026-09-15. Update the count.

### T09-24 · Unprivileged worker `user` and file permissions — Understand · 🔲 not written
- **Read this:** [Core functionality](https://nginx.org/en/docs/ngx_core_module.html) · nginx.org · `user user [group]`, default `nobody nobody` (*read*) · covers our angle: **partial** — nothing on `/var/cache/nginx` or what needs root · fetched 2026-10-12
- **Also good:** [nginx (Docker Official Image)](https://hub.docker.com/_/nginx) · Docker Hub · running as a non-root user needs changes, or use the unprivileged image (*read*)

### T09-25 · ModSecurity, App Protect and Cloudflare — When a WAF is worth it — When Needed · 🔲 not written
- **Read this:** [ModSecurity-nginx README (raw)](https://raw.githubusercontent.com/owasp-modsecurity/ModSecurity-nginx/master/README.md) · github (raw) · the connector's compile steps and `modsecurity_rules_file` directives (*read*) · covers our angle: **partial** — how to run it, not whether it is worth it · fetched 2026-10-12
- *Not opened:* [OWASP CRS](https://owasp.org/projects/crs) (200).
- **Our delta:** the worth-it / theatre judgement; no neutral source found.

---

## Phase 10 — Logs, metrics and debugging

### T10-01 · `log_format` and `access_log` — Master · 🔲 not written
- **Read this:** [ngx_http_log_module](https://nginx.org/en/docs/http/ngx_http_log_module.html) · nginx.org · `access_log` syntax, default `combined`, `log_format` and its variables (*read*) · covers our angle: **partial** — no list of what `combined` omits · fetched 2026-10-12
- **Also good:** [Configuring Logging](https://docs.nginx.com/nginx/admin-guide/monitoring/logging/) · docs.nginx.com, modified 2026-07-02 · error log, access log, conditional logging, syslog in one guide (*headings only*)

### T10-02 · The variables worth logging — Understand · 🔲 not written
- **Read this:** [ngx_http_upstream_module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html) · nginx.org · `$upstream_connect_time`, `$upstream_response_time`, `$upstream_cache_status` values (*read*) · covers our angle: **partial** — no "which to log" advice · fetched 2026-10-12

### T10-03 · `$request_time` vs `$upstream_response_time` — Master · 🔲 not written
- **Read this:** [ngx_http_log_module](https://nginx.org/en/docs/http/ngx_http_log_module.html) · nginx.org · `$request_time`: processing time, first bytes read to last bytes sent (*read*) · covers our angle: **partial** — the upstream half is on the upstream page · fetched 2026-10-12
- **Also good:** [ngx_http_upstream_module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html) · nginx.org · `$upstream_response_time` is time spent receiving the upstream response (*read*)
- **Our delta:** the slow-client example showing the two numbers diverging.

### T10-04 · JSON access logs — Master · 🔲 not written
- **Read this:** [ngx_http_log_module](https://nginx.org/en/docs/http/ngx_http_log_module.html) · nginx.org · `log_format name [escape=default|json|none]`, `escape` since 1.11.8 (*read*) · covers our angle: **partial** — no JSON format example · fetched 2026-10-12
- **Also good:** [How to Configure Nginx Logging and Monitoring](https://oneuptime.com/blog/post/2026-02-20-nginx-logging-monitoring/view) · OneUptime, 2026-02-20 (*headings only*)
- **Our delta:** a complete format; note `error_log` also takes a `json` parameter.

### T10-05 · `$request_id` end to end — Master · 🔲 not written
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · `$request_id`: 16 random bytes in hex (1.11.0); `error_log_tag request_id $request_id` (*read*) · covers our angle: **partial** — nothing on forwarding or Express · fetched 2026-10-12
- **Our delta:** `proxy_set_header`, echoing it in Express logs, and returning it to the client.

### T10-06 · Conditional logging — Understand · 🔲 not written
- **Read this:** [ngx_http_log_module](https://nginx.org/en/docs/http/ngx_http_log_module.html) · nginx.org · `if=condition`; example `map $status $loggable` skipping 2xx and 3xx (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** the health-check and static-asset `map`.

### T10-07 · `buffer=`, `flush=`, `gzip=`, `access_log off` — Understand · 🔲 not written
- **Read this:** [ngx_http_log_module](https://nginx.org/en/docs/http/ngx_http_log_module.html) · nginx.org · syntax `buffer=size gzip[=level] flush=time if=condition`; `access_log off` (*read*) · covers our angle: **partial** — no cost numbers · fetched 2026-10-12
- **Also good:** [Tuning NGINX for Performance](https://www.f5.com/company/blog/nginx/tuning-nginx) · F5 · has an "Access Logging" section (*headings only*)

### T10-08 · `error_log` and its levels — Understand · 🔲 not written
- **Read this:** [Core functionality](https://nginx.org/en/docs/ngx_core_module.html) · nginx.org · `error_log file [level] [json]`, default level `error`, order `debug` to `emerg` (*read*) · covers our angle: **partial** — does not argue for `warn` · fetched 2026-10-12
- **Also good:** [Configuring Logging](https://docs.nginx.com/nginx/admin-guide/monitoring/logging/) · docs.nginx.com, modified 2026-07-02 · severity, formats, inheritance (*headings only*)

### T10-09 · Reading the error log — Master · 🔲 not written
- **Read this:** [nginx upstream prematurely closed connection](https://www.netdata.cloud/guides/nginx/nginx-upstream-prematurely-closed-connection/) · Netdata guides, undated · backend closed the socket; crash, restart or stale keepalive; 502 (*read*) · covers our angle: **partial** — one of the five messages · fetched 2026-10-12
- **Also good:** [nginx no live upstreams](https://www.netdata.cloud/guides/nginx/nginx-no-live-upstreams/) · Netdata guides, undated (*headings only*)
- *Checked, not chosen:* guessed Netdata URLs for `111`, "too large body" and the redirection cycle returned 404; none found for those three.

### T10-10 · Log rotation and `USR1` — Understand · 🔲 not written
- **Read this:** [Controlling nginx](https://nginx.org/en/docs/control.html) · nginx.org · `USR1` re-opens log files; `nginx -s reopen` (*read*) · covers our angle: **partial** — no logrotate recipe · fetched 2026-10-12
- **Also good:** [Control NGINX Processes at Runtime](https://docs.nginx.com/nginx/admin-guide/basic-functionality/runtime-control/) · docs.nginx.com, modified 2026-09-03 (*headings only*)

### T10-11 · `stub_status` — Understand · 🔲 not written
- **Read this:** [ngx_http_stub_status_module](https://nginx.org/en/docs/http/ngx_http_stub_status_module.html) · nginx.org · sample output: active connections, accepts, handled, requests, Reading, Writing, Waiting (*read*) · covers our angle: **partial** — meaning of each field is on the same page; no diagnosis guidance · fetched 2026-10-12

### T10-12 · Exporting metrics to Prometheus — Know · 🔲 not written
- **Read this:** [nginx-prometheus-exporter README (raw)](https://raw.githubusercontent.com/nginx/nginx-prometheus-exporter/main/README.md) · github (raw) · reads `stub_status`; `--nginx.scrape-uri=http://<host>:8080/stub_status` (*read*) · covers our angle: **partial** — no log-derived rates · fetched 2026-10-12
- **Our delta:** request and error rate from JSON logs.

### T10-13 · `ngx_otel_module` — Know · 🔲 not written
- **Read this:** [ngx_otel_module](https://nginx.org/en/docs/ngx_otel_module.html) · nginx.org · OpenTelemetry tracing, W3C context propagation, OTLP/gRPC export; `otel_trace`, `otel_trace_context` (*read* the intro) · covers our angle: **partial** — nothing on joining Node spans · fetched 2026-10-12
- **Also good:** [Traces](https://opentelemetry.io/docs/concepts/signals/traces/) · OpenTelemetry (*headings only*)

### T10-14 · The debug log — Know · 🔲 not written
- **Read this:** [A debugging log](https://nginx.org/en/docs/debugging_log.html) · nginx.org · `./configure --with-debug`, `error_log … debug`, `debug_connection`, memory buffer (*read*) · covers our angle: full · fetched 2026-10-12

### T10-15 · Logging to syslog and from containers — Know · 🔲 not written
- **Read this:** [Logging to syslog](https://nginx.org/en/docs/syslog.html) · nginx.org · `error_log syslog:server=…`, `access_log syslog:…`, since 1.7.1 (*read*) · covers our angle: **partial** — container stdout is not covered · fetched 2026-10-12

### T10-16 · `ngx_http_api_module` and the live dashboard (Plus) — When Needed · 🔲 not written
- **Read this:** [ngx_http_api_module](https://nginx.org/en/docs/http/ngx_http_api_module.html) · nginx.org · "available as part of our commercial subscription" (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Live Activity Monitoring](https://docs.nginx.com/nginx/admin-guide/monitoring/live-activity-monitoring/) · docs.nginx.com (*headings only*)
