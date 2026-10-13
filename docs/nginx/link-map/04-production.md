---
title: "Link map · nginx · Part 4"
sidebar_label: "04 · Production"
sidebar_position: 4
---

# Link map · nginx · Part 4 — Production (phases 9–11)

Covers the topic rows of `docs/nginx/syllabus/04-production.md` for phase 9 (T09-01 to T09-25, access control, rate limiting, hardening), phase 10 (T10-01 to T10-16, logs, metrics, debugging) and phase 11 (T11-01 to T11-16, deployment and operations). That is 57 rows. **None has a page of ours yet (🔲)**: `docs/nginx/pages` holds phases 0 to 2 only.
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. No `#anchors` are given.

🔴 **Version note.** nginx.org/en/download.html on 2026-10-12 lists **stable 1.30.5** and **mainline 1.31.6**; nginx.org/2026.html dates both 2026-09-15 (a `ngx_http_v3_module` buffer-overflow fix, CVE-2026-90439). Our syllabus README still says 1.30.4 / 1.31.3, one security release behind on stable and three releases behind on mainline (1.31.4 to 1.31.6). nginx.org module docs are unversioned (they describe mainline). `github.com` returns 403 to our fetcher, so READMEs are cited as `raw.githubusercontent.com`. docs.nginx.com pages cover NGINX Plus and open source together; the Plus-only parts are marked.

---

## Phase 9 — Access control, rate limiting and hardening

### T09-01 · `limit_req_zone` and `limit_req` — Master · 🔲 not written
- **Read this:** [ngx_http_limit_req_module](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html) · nginx.org · "leaky bucket" method, zone syntax with `rate=`, key as one variable (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Limiting Access to Proxied HTTP Resources](https://docs.nginx.com/nginx/admin-guide/security-controls/controlling-access-proxied-http/) · docs.nginx.com, modified 2026-07-02 · connection and request-rate limits in one admin guide (*headings only*)
- **Beyond the docs:** [Nginx Rate Limiting: The Complete Guide](https://www.getpagespeed.com/server-setup/nginx/nginx-rate-limiting) · GetPageSpeed, 2026-01-22 (updated 2026-07-14) · walks burst, nodelay and delay with a worked timing (a burst of 20 takes about 2 seconds) and gives copy-ready zones, which the reference page does not · fetched 2026-10-13 (*read*)

### T09-02 · `burst`, `nodelay` and `delay=` — Master · 🔲 not written
- **Read this:** [ngx_http_limit_req_module](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html) · nginx.org · burst queue, `nodelay`, `delay` (1.15.7), default burst 0 (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Rate Limiting with NGINX](https://blog.nginx.org/blog/rate-limiting-nginx) · NGINX Community Blog, 2017-06-12 · worked examples; its own editor's note says the burst/delay description is inaccurate and points to nginx.org, so use it for examples only (*read*)
- **Beyond the docs:** [NGINX rate-limiting in a nutshell](https://www.freecodecamp.org/news/nginx-rate-limiting-in-a-nutshell-128fe9e0126c/) · freeCodeCamp, Sébastien Portebois, 2017-03-24 · explains burst as a queue size and not a rate, and what nodelay changes, step by step with a lab to try · fetched 2026-10-13 (*read*)
- **Our delta:** the "my limit blocks normal users" diagnosis, with a request timeline for each of the three modes.

### T09-03 · `$binary_remote_addr` over `$remote_addr` — Understand · 🔲 not written
- **Read this:** [ngx_http_limit_req_module](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html) · nginx.org · key size 4 or 16 bytes, state 64 or 128 bytes, about 16 thousand 64-byte states per megabyte, least-recently-used eviction (*read*) · covers our angle: full · fetched 2026-10-12

### T09-04 · `limit_req_status` and `limit_req_log_level` — Understand · 🔲 not written
- **Read this:** [ngx_http_limit_req_module](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html) · nginx.org · `limit_req_status` default 503 (since 1.3.15); delays log one level below refusals (*read*) · covers our angle: **partial** — does not argue for 429 · fetched 2026-10-12
- **Also good:** [429 Too Many Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429) · MDN · the status code itself (*headings only*)
- **Beyond the docs:** [NGINX rate limiting returns 503 not 429: limit_req_status explained](https://www.netdata.cloud/guides/nginx/nginx-rate-limiting-503-not-429/) · Netdata guides, undated · argues for 429 over 503 (5xx alerts, client backoff) and names the tradeoffs, which the directive reference does not · fetched 2026-10-13 (*read*)

### T09-05 · `limit_req_dry_run` — Understand · 🔲 not written
- **Read this:** [ngx_http_limit_req_module](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html) · nginx.org · appeared in 1.17.1; rate is not limited but excess requests are still counted in the zone (*read*) · covers our angle: **partial** — no recipe for reading the dry-run results from the log · fetched 2026-10-12
- **Our delta:** the "log it, count it, then switch it on" procedure from the Gate.

### T09-06 · `limit_conn_zone` and `limit_conn` — Understand · 🔲 not written
- **Read this:** [ngx_http_limit_conn_module](https://nginx.org/en/docs/http/ngx_http_limit_conn_module.html) · nginx.org · a connection counts only with a request in process and the whole header read; has its own `limit_conn_status` (*read*) · covers our angle: **partial** — no contrast with request-rate attacks · fetched 2026-10-12

### T09-07 · Rate limiting behind a proxy or CDN is a trap — Master · 🔲 not written
- **Read this:** [ngx_http_realip_module](https://nginx.org/en/docs/http/ngx_http_realip_module.html) · nginx.org · `set_real_ip_from` defines trusted addresses, `real_ip_header`, `real_ip_recursive`; not built by default (*read*) · covers our angle: **partial** — says nothing about rate limiting or forged headers · fetched 2026-10-12
- **Also good:** [Restoring original visitor IPs](https://developers.cloudflare.com/support/troubleshooting/restoring-visitor-ips/restoring-original-visitor-ips/) · Cloudflare, updated 2026-04-23 · nginx section uses `set_real_ip_from` plus `real_ip_header CF-Connecting-IP` and says the prefix list needs regular updates (*read*)
- **Beyond the docs:** [Restoring Real Visitor IPs with Cloudflare and Nginx](https://kbeezie.com/cloudflare-real-ip-nginx) · kbeezie.com, 2026-05-11 · says that without the real-IP setup your rate limits throttle Cloudflare's IPs instead of attackers, and that keying on the proxy address puts all visitors behind one edge in one bucket · fetched 2026-10-13 (*read*)
- **Our delta:** the proof that unkeyed limits hit the CDN, and the trust boundary: only listed proxies may set the header.

### T09-08 · Layering limits — Understand · 🔲 not written
- **Read this:** [ngx_http_limit_req_module](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html) · nginx.org · several `limit_req` in one location, and inheritance only when none is set at the current level (*read*) · covers our angle: **partial** — no strict-login / loose-elsewhere layout · fetched 2026-10-12
- **Beyond the docs:** [Nginx Rate Limiting: The Complete Guide](https://www.getpagespeed.com/server-setup/nginx/nginx-rate-limiting) · GetPageSpeed, 2026-01-22 (updated 2026-07-14) · shows several zones applying at once (per-IP plus per-server, "both limits must be satisfied") and recommends layering for defence in depth · fetched 2026-10-13 (*read*)

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
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · version on error pages and the `Server` header; `build` form; the explicit-string form is commercial-subscription only (*read*) · covers our angle: **partial** — does not list what it leaves visible · fetched 2026-10-12
- **Beyond the docs:** [Hiding the nginx version number](https://linux-audit.com/hiding-nginx-version-number/) · linux-audit.com, updated 2025-03-12 · states what the directive hides (version) and what stays visible (the nginx name), plus how to go further with headers-more · fetched 2026-10-13 (*read*)

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
- **Beyond the docs:** [HTTP Request Smuggling: Abusing Reverse Proxies](https://www.sans.org/blog/http-request-smuggling-abusing-reverse-proxies) · SANS blog, Chris Elgee, 2020-06-22 · explains with a proxy-plus-backend picture how Content-Length and Transfer-Encoding disagreement lets a request prefix attach to another user · fetched 2026-10-13 (*read*)
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
- **Beyond the docs:** [Nginx Logging: A Comprehensive Guide](https://betterstack.com/community/guides/logging/how-to-view-and-configure-nginx-access-and-error-logs/) · Better Stack, Ayooluwa Isaiah, updated 2026-01-17 · one walkthrough of access and error logs, custom formats, JSON, conditional logging and the Docker stdout symlinks · fetched 2026-10-13 (*read*)

### T10-02 · The variables worth logging — Understand · 🔲 not written
- **Read this:** [ngx_http_upstream_module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html) · nginx.org · `$upstream_connect_time`, `$upstream_response_time`, `$upstream_cache_status` values (*read*) · covers our angle: **partial** — no "which to log" advice · fetched 2026-10-12

### T10-03 · `$request_time` vs `$upstream_response_time` — Master · 🔲 not written
- **Read this:** [ngx_http_log_module](https://nginx.org/en/docs/http/ngx_http_log_module.html) · nginx.org · `$request_time`: processing time, first bytes read to last bytes sent (*read*) · covers our angle: **partial** — the upstream half is on the upstream page · fetched 2026-10-12
- **Also good:** [ngx_http_upstream_module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html) · nginx.org · `$upstream_response_time` is time spent receiving the upstream response (*read*)
- **Beyond the docs:** [NGINX $request_time vs $upstream_response_time: isolating where latency lives](https://www.netdata.cloud/guides/nginx/nginx-request-time-vs-upstream-response-time/) · Netdata guides, undated · gives the slow-client case (50 ms backend, 5 s request) and how to read the gap, which the variable reference lacks · fetched 2026-10-13 (*read*)
- **Our delta:** the slow-client example showing the two numbers diverging.

### T10-04 · JSON access logs — Master · 🔲 not written
- **Read this:** [ngx_http_log_module](https://nginx.org/en/docs/http/ngx_http_log_module.html) · nginx.org · `log_format name [escape=default|json|none]`, `escape` since 1.11.8 (*read*) · covers our angle: **partial** — no JSON format example · fetched 2026-10-12
- **Also good:** [How to Configure Nginx Logging and Monitoring](https://oneuptime.com/blog/post/2026-02-20-nginx-logging-monitoring/view) · OneUptime, 2026-02-20 (*headings only*)
- **Our delta:** a complete format; note `error_log` also takes a `json` parameter.

### T10-05 · `$request_id` end to end — Master · 🔲 not written
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · `$request_id`: 16 random bytes in hex (1.11.0); `error_log_tag` (1.29.8) is marked commercial-subscription only on that page (*read*) · covers our angle: **partial** — nothing on forwarding or Express, and the error-log tag is not open source · fetched 2026-10-12
- **Beyond the docs:** [How to Use Sentry & nginx to Trace Errors](https://blog.sentry.io/using-nginx-sentry-trace-errors-logs/) · Sentry blog, Matt Robenolt, 2019-01-31 · shows the whole chain: log `$request_id` in nginx, pass it as `X-Request-Id`, read it in the app and tie logs and errors together · fetched 2026-10-13 (*read*)
- **Our delta:** `proxy_set_header`, echoing it in Express logs, and returning it to the client.

### T10-06 · Conditional logging — Understand · 🔲 not written
- **Read this:** [ngx_http_log_module](https://nginx.org/en/docs/http/ngx_http_log_module.html) · nginx.org · `if=condition`; example `map $status $loggable` skipping 2xx and 3xx (*read*) · covers our angle: full · fetched 2026-10-12
- **Beyond the docs:** [Nginx Logging: A Comprehensive Guide](https://betterstack.com/community/guides/logging/how-to-view-and-configure-nginx-access-and-error-logs/) · Better Stack, Ayooluwa Isaiah, updated 2026-01-17 · worked `if=` plus `map` on `$status` example that skips 2xx and 3xx, with a pointer to log sampling · fetched 2026-10-13 (*read*)
- **Our delta:** the health-check and static-asset `map`.

### T10-07 · `buffer=`, `flush=`, `gzip=`, `access_log off` — Understand · 🔲 not written
- **Read this:** [ngx_http_log_module](https://nginx.org/en/docs/http/ngx_http_log_module.html) · nginx.org · syntax `buffer=size gzip[=level] flush=time if=condition`; `access_log off` (*read*) · covers our angle: **partial** — no cost numbers · fetched 2026-10-12
- **Also good:** [Tuning NGINX for Performance](https://www.f5.com/company/blog/nginx/tuning-nginx) · F5 · has an "Access Logging" section (*headings only*)
- **Beyond the docs:** [NGINX access log performance: buffering, sampling, and the event loop](https://www.netdata.cloud/guides/nginx/nginx-access-log-performance/) · Netdata guides, undated · explains the cost tradeoffs of `buffer`, `flush` and `gzip` (memory, delay, CPU) that the directive page only lists · fetched 2026-10-13 (*read*)

### T10-08 · `error_log` and its levels — Understand · 🔲 not written
- **Read this:** [Core functionality](https://nginx.org/en/docs/ngx_core_module.html) · nginx.org · `error_log file [level] [json]`, default level `error`, order `debug` to `emerg` (*read*) · covers our angle: **partial** — does not argue for `warn` · fetched 2026-10-12
- **Also good:** [Configuring Logging](https://docs.nginx.com/nginx/admin-guide/monitoring/logging/) · docs.nginx.com, modified 2026-07-02 · severity, formats, inheritance (*headings only*)
- **Beyond the docs:** [NGINX Logs: Access, Error Logs, and Monitoring](https://signoz.io/blog/nginx-logging/) · SigNoz blog, undated · lists the eight error levels with a use case for each, and splitting files by severity · fetched 2026-10-13 (*read*)

### T10-09 · Reading the error log — Master · 🔲 not written
- **Read this:** [nginx upstream prematurely closed connection](https://www.netdata.cloud/guides/nginx/nginx-upstream-prematurely-closed-connection/) · Netdata guides, undated · backend closed the socket; crash, restart or stale keepalive; 502 (*read*) · covers our angle: **partial** — one of the five messages · fetched 2026-10-12
- **Also good:** [nginx no live upstreams](https://www.netdata.cloud/guides/nginx/nginx-no-live-upstreams/) · Netdata guides, undated (*headings only*)
- *Checked, not chosen:* guessed Netdata URLs for `111`, "too large body" and the redirection cycle returned 404; none found for those three.

### T10-10 · Log rotation and `USR1` — Understand · 🔲 not written
- **Read this:** [Controlling nginx](https://nginx.org/en/docs/control.html) · nginx.org · "Rotating Log-files" section: rename the file, then send `USR1` to re-open (*read*) · covers our angle: **partial** — no logrotate recipe and no mention of `nginx -s reopen` · fetched 2026-10-12
- **Also good:** [Control NGINX Processes at Runtime](https://docs.nginx.com/nginx/admin-guide/basic-functionality/runtime-control/) · docs.nginx.com, modified 2026-09-03 · lists `reopen` as the `USR1` signal (*read* the signal list)
- **Beyond the docs:** [NGINX Log Rotation with USR1 Signal and Logrotate](https://nginx-wiki.getpagespeed.com/config/examples/log-rotation/) · NGINX Wiki (GetPageSpeed mirror), undated · a ready logrotate recipe with the USR1 postrotate step and why the old file descriptor keeps being written until the signal · fetched 2026-10-13 (*read*)

### T10-11 · `stub_status` — Understand · 🔲 not written
- **Read this:** [ngx_http_stub_status_module](https://nginx.org/en/docs/http/ngx_http_stub_status_module.html) · nginx.org · sample output: active connections, accepts, handled, requests, Reading, Writing, Waiting (*read*) · covers our angle: **partial** — meaning of each field is on the same page; no diagnosis guidance · fetched 2026-10-12
- **Beyond the docs:** [NGINX active connections climbing: reading, writing, waiting explained](https://www.netdata.cloud/guides/nginx/nginx-active-connections-high/) · Netdata guides, undated · turns the three stub_status states into diagnosis ratios, for example high Reading hinting at slow or stalled clients · fetched 2026-10-13 (*read*)

### T10-12 · Exporting metrics to Prometheus — Know · 🔲 not written
- **Read this:** [nginx-prometheus-exporter README (raw)](https://raw.githubusercontent.com/nginx/nginx-prometheus-exporter/main/README.md) · github (raw) · reads `stub_status`; `--nginx.scrape-uri=http://<nginx>:8080/stub_status` (*read*) · covers our angle: **partial** — no log-derived rates · fetched 2026-10-12
- **Beyond the docs:** [Monitor Nginx with Prometheus and Grafana](https://computingforgeeks.com/monitor-nginx-prometheus-grafana/) · ComputingForGeeks, updated 2026-03-24 · end-to-end setup: local stub_status server, exporter as a systemd service, Prometheus scrape job, alert rules and PromQL · fetched 2026-10-13 (*read*)
- **Our delta:** request and error rate from JSON logs.

### T10-13 · `ngx_otel_module` — Know · 🔲 not written
- **Read this:** [ngx_otel_module](https://nginx.org/en/docs/ngx_otel_module.html) · nginx.org · OpenTelemetry tracing, W3C context propagation, OTLP/gRPC export; `otel_trace`, `otel_trace_context` (*read* the intro) · covers our angle: **partial** — nothing on joining Node spans · fetched 2026-10-12
- **Also good:** [Traces](https://opentelemetry.io/docs/concepts/signals/traces/) · OpenTelemetry (*headings only*)
- **Beyond the docs:** [How to Configure the NGINX ngx_otel_module for Distributed Tracing](https://oneuptime.com/blog/post/2026-02-06-nginx-otel-module-distributed-tracing/view) · OneUptime, 2026-02-06 · a worked config with `otel_trace_context` propagate and a traceparent test; covers the nginx side only, not the Node side · fetched 2026-10-13 (*read*)

### T10-14 · The debug log — Know · 🔲 not written
- **Read this:** [A debugging log](https://nginx.org/en/docs/debugging_log.html) · nginx.org · `./configure --with-debug`, `error_log … debug`, `debug_connection`, memory buffer (*read*) · covers our angle: **partial** — does not say why to switch it off again · fetched 2026-10-12

### T10-15 · Logging to syslog and from containers — Know · 🔲 not written
- **Read this:** [Logging to syslog](https://nginx.org/en/docs/syslog.html) · nginx.org · `error_log syslog:server=…`, `access_log syslog:…`, since 1.7.1 (*read*) · covers our angle: **partial** — container stdout is not covered · fetched 2026-10-12
- **Beyond the docs:** [Nginx Logging: A Comprehensive Guide](https://betterstack.com/community/guides/logging/how-to-view-and-configure-nginx-access-and-error-logs/) · Better Stack, Ayooluwa Isaiah, updated 2026-01-17 · explains how the official Docker image symlinks the logs to stdout and stderr, which the syslog page does not cover · fetched 2026-10-13 (*read*)

### T10-16 · `ngx_http_api_module` and the live dashboard (Plus) — When Needed · 🔲 not written
- **Read this:** [ngx_http_api_module](https://nginx.org/en/docs/http/ngx_http_api_module.html) · nginx.org · "available as part of our commercial subscription" (*read*) · covers our angle: **partial** — the REST API only; the dashboard is on the Also good page · fetched 2026-10-12
- **Also good:** [Live Activity Monitoring](https://docs.nginx.com/nginx/admin-guide/monitoring/live-activity-monitoring/) · docs.nginx.com, modified 2026-09-02 · has a "Using the Dashboard" section (*headings only*)

---

## Phase 11 — Deployment and operations

### T11-01 · Config layout that scales — Understand · 🔲 not written
- **Read this:** [Create NGINX Plus and NGINX Configuration Files](https://docs.nginx.com/nginx/admin-guide/basic-functionality/managing-configuration-files/) · docs.nginx.com, modified 2026-10-07 · split into feature files under `/etc/nginx/conf.d` pulled in by `include` (*read*) · covers our angle: **partial** — no word on `sites-available` being a Debian convention · fetched 2026-10-12
- **Beyond the docs:** [Nginx Config File Structure Explained](https://www.virtua.cloud/learn/en/concepts/nginx-config-file-structure) · Virtua Cloud, undated · says Debian and Ubuntu use sites-available and sites-enabled alongside conf.d, offers conf.d alone as the simpler alternative, and warns against conflicting server blocks in both · fetched 2026-10-13 (*read*)
- **Our delta:** the `sites-available` / `sites-enabled` point; no source found that states it.

### T11-02 · `nginx -t` in CI — Master · 🔲 not written
- **Read this:** [Command-line parameters](https://nginx.org/en/docs/switches.html) · nginx.org · `-t` checks syntax, then tries to open the files the config refers to (*read*) · covers our angle: **partial** — nothing on running it inside the image · fetched 2026-10-12
- **Also good:** [Automate Nginx conf file validation using Docker](https://dev.to/idevkamboj/validate-nginx-conf-file-using-docker-ki4) · DEV Community, 2019-12-04 · mounts the config into the `nginx` image and runs `nginx -t`; old, so check flags (*read*)

### T11-03 · Reload safely — Master · 🔲 not written
- **Read this:** [Controlling nginx](https://nginx.org/en/docs/control.html) · nginx.org · `HUP` makes the master check syntax, try the new config, roll back and keep working if that fails (*read*) · covers our angle: **partial** — the "one class of change a reload cannot apply" is not named there; not confirmed · fetched 2026-10-12
- **Also good:** [Beginner's Guide](https://nginx.org/en/docs/beginners_guide.html) · nginx.org · starting, stopping and reloading (*headings only*)

### T11-04 · nginx in a container — Master · 🔲 not written
- **Read this:** [nginx (Docker Official Image)](https://hub.docker.com/_/nginx) · Docker Hub · custom `CMD` needs `-g daemon off;`; config by bind mount or baked in; non-root notes (*read*) · covers our angle: **partial** — log-to-stdout and Podman not found there · fetched 2026-10-12
- **Also good:** [Deploying NGINX and NGINX Plus with Docker](https://docs.nginx.com/nginx/admin-guide/installing-nginx/installing-nginx-docker/) · docs.nginx.com, modified 2026-10-07 (*headings only*)

### T11-05 · nginx in Compose in front of Node — Understand · 🔲 not written
- **Read this:** [Control startup and shutdown order in Compose](https://docs.docker.com/compose/how-tos/startup-order/) · Docker Docs · `depends_on` with `service_started` or `service_healthy` conditions (*read*) · covers our angle: **partial** — nothing on nginx DNS caching · fetched 2026-10-12
- **Also good:** [How to Fix 'host not found in upstream' Nginx Startup Errors](https://oneuptime.com/blog/post/2025-12-16-fix-host-not-found-in-upstream-nginx/view) · OneUptime, 2025-12-16 (*headings only*)
- *Checked, not chosen:* nginx.org `resolver` entry in ngx_http_core_module (*read*: `resolver address … [valid=time]`); directive reference only.
- **Our delta:** the variable-in-`proxy_pass` plus `resolver` pattern for a changing container IP. Whether nginx retries inside the TTL window is not confirmed.

### T11-06 · Environment-specific config with `envsubst` — Understand · 🔲 not written
- **Read this:** [nginx (Docker Official Image)](https://hub.docker.com/_/nginx) · Docker Hub · `/etc/nginx/templates/*.template` rendered with `envsubst` into `/etc/nginx/conf.d`; `NGINX_ENVSUBST_TEMPLATE_DIR` and related variables (*read*) · covers our angle: full · fetched 2026-10-12

### T11-07 · Serving the frontend from the nginx image — Understand · 🔲 not written
- **Read this:** [React.js language-specific guide](https://docs.docker.com/guides/reactjs/) · Docker Docs, updated 2026-07-21 · multi-stage build and a custom NGINX config (*read* the intro; rest *headings only*) · covers our angle: **partial** — not our hashed-asset cache split · fetched 2026-10-12
- **Also good:** [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/) · Docker Docs · `COPY --from` copies a built artifact into a small final image (*read*)
- **Beyond the docs:** [How to Containerize React Applications with Multi-Stage Docker Builds](https://oneuptime.com/blog/post/2026-01-15-containerize-react-multi-stage-docker/view) · OneUptime, 2026-01-15 · shows the nginx side of the split we want: `try_files` for the SPA, one-year immutable cache for hashed assets, no-store for the HTML · fetched 2026-10-13 (*read*)

### T11-08 · Worker and OS tuning — Understand · 🔲 not written
- **Read this:** [Tuning NGINX for Performance](https://www.f5.com/company/blog/nginx/tuning-nginx) · F5 · Linux backlog queue, file descriptors, ephemeral ports; `worker_processes`, `worker_connections` (*read* the backlog and `worker_connections` passages) · covers our angle: **partial** — no `worker_rlimit_nofile` or systemd `LimitNOFILE`; its `limits.conf` advice does not apply to systemd services (see Also good) · fetched 2026-10-12
- **Also good:** [NGINX worker_rlimit_nofile](https://www.netdata.cloud/guides/nginx/nginx-worker-rlimit-nofile/) · Netdata guides, undated · systemd `LimitNOFILE` floor; "A reload is not sufficient" for limit changes (*read*)

### T11-09 · systemd integration — Understand · 🔲 not written
- **Read this:** [systemd.service](https://man7.org/linux/man-pages/man5/systemd.service.5.html) · man7.org · `ExecReload=` and service types (*read* the `ExecReload` passage) · covers our angle: **partial** — generic, no nginx unit · fetched 2026-10-12
- **Also good:** [NGINX worker_rlimit_nofile](https://www.netdata.cloud/guides/nginx/nginx-worker-rlimit-nofile/) · Netdata guides, undated · a drop-in `limits.conf` for the nginx service (*read*)
- **Beyond the docs:** [NGINX Systemd Service File Configuration](https://nginx-wiki.getpagespeed.com/config/examples/systemd/) · NGINX Wiki (GetPageSpeed mirror), undated · a complete nginx unit with a key-directives table: Type forking, a config test before start, `nginx -s reload` as ExecReload · fetched 2026-10-13 (*read*)
- *Not opened:* freedesktop.org systemd man pages returned 418 to our fetcher.

### T11-10 · Health checks and load-balancer probes — Understand · 🔲 not written
- **Read this:** [How to Implement Health Checks in Nginx](https://oneuptime.com/blog/post/2026-01-25-nginx-health-checks/view) · OneUptime, 2026-01-25 · a local `location` with `access_log off; return 200` for external monitors (*read* that example) · covers our angle: **partial** — its full example shows a local `/nginx-health` and a proxied `/health` side by side but never explains the difference · fetched 2026-10-12
- **Also good:** [HTTP load balancing](https://docs.nginx.com/nginx/admin-guide/load-balancer/http-load-balancer/) · docs.nginx.com (*headings only*)
- **Our delta:** the two-endpoint pattern (nginx-alive vs backend-alive).

### T11-11 · Blue/green and canary with `split_clients` — Know · 🔲 not written
- **Read this:** [ngx_http_split_clients_module](https://nginx.org/en/docs/http/ngx_http_split_clients_module.html) · nginx.org · hashes a string with MurmurHash2 into percentage buckets, e.g. `0.5%`, `2.0%`, `*` (*read*) · covers our angle: **partial** — an A/B example, not an upstream switch · fetched 2026-10-12
- **Also good:** [NGINX Load Balancing](https://nginx-wiki.getpagespeed.com/config/load-balancing/) · NGINX Wiki mirror, 2025-12-05 (updated 2026-08-05) · upstream methods and server parameters (*headings only*)

### T11-12 · nginx vs the alternatives — Know · 🔲 not written
- **Read this:** [Top 5 Reverse Proxies: Which One Should You Choose?](https://sliplane.io/blog/top-5-reverse-proxies-which-one-should-you-choose) · Sliplane, 2024-10-05 (updated 2026-07-07) · Caddy for automatic HTTPS, Traefik for Docker and Kubernetes, HAProxy for load balancing (*read* the quick picks) · covers our angle: **partial** — no Envoy or cloud ALB depth · fetched 2026-10-12
- **Also good:** [Automatic HTTPS](https://caddyserver.com/docs/automatic-https) · Caddy docs (*headings only*)
- *Not opened:* Envoy [what is Envoy](https://www.envoyproxy.io/docs/envoy/latest/intro/what_is_envoy), [Traefik docs](https://doc.traefik.io/traefik/).

### T11-13 · nginx as a Kubernetes Ingress controller — Know · 🔲 not written
- **Read this:** [Advanced configuration with Annotations](https://docs.nginx.com/nginx-ingress-controller/configuration/ingress-resources/advanced-configuration-with-annotations/) · docs.nginx.com, F5 NGINX Ingress Controller (*headings only*) · covers our angle: **partial** — F5's controller, not the community one · fetched 2026-10-12
- **Also good:** [Ingress NGINX Retirement: What You Need to Know](https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/) · kubernetes.io, 2025-11-11 (modified 2026-01-03) · "Best-effort maintenance will continue until March 2026" (*read*)
- **Our delta:** 🔴 the community `ingress-nginx` project is retired; the syllabus row should say which controller it means.

### T11-14 · njs — When Needed · 🔲 not written
- **Read this:** [njs scripting language](https://nginx.org/en/docs/njs/) · nginx.org · "The built-in njs JavaScript engine is deprecated since 1.0.0"; new configs should use QuickJS (*read*) · covers our angle: **partial** — no auth-glue examples · fetched 2026-10-12
- **Also good:** [njs changes](https://nginx.org/en/docs/njs/changes.html) · nginx.org · 1.0.1 (2026-09-02, per nginx.org/2026.html) fixes an access-control bypass in `js_access` (*read*)

### T11-15 · Building nginx from source — When Needed · 🔲 not written
- **Read this:** [Building nginx from sources](https://nginx.org/en/docs/configure.html) · nginx.org · the `--with-` / `--without-` module flags and path options (*read*) · covers our angle: **partial** — third-party modules and upkeep cost not covered · fetched 2026-10-12
- **Also good:** [Installing NGINX Open Source](https://docs.nginx.com/nginx/admin-guide/installing-nginx/installing-nginx-open-source/) · docs.nginx.com, modified 2026-10-07 · has "Dynamic modules" and "Compile and install from source" sections (*headings only*)

### T11-16 · A production checklist — Master · 🔲 not written
- **Read this:** [25 NGINX Directives to Audit Before Opening a Support Ticket](https://www.netdata.cloud/academy/25-nginx-directives-to-audit/) · Netdata academy, undated · core, performance, security, proxy directive groups (*headings only*) · covers our angle: **partial** — written for support triage, not go-live · fetched 2026-10-12
- *Checked, not chosen:* [nginx hardening checklist](https://stackharbor.com/en/knowledge-base/nginx-hardening-checklist/) (200, vendor page); gixy README (raw) shows a 2019 maintenance badge, so currency is not confirmed.
- **Our delta:** the twenty-line audit is ours to write; pull each line from the pages above.
