---
title: "Link map · nginx · Part 1"
sidebar_label: "01 · How nginx works"
sidebar_position: 1
---

# Link map · nginx · Part 1 (phases 0–2)

Covers every topic row of `docs/nginx/syllabus/01-how-nginx-works.md`: T00-01 to T00-14 (phase 0, process model), T01-01 to T01-14 (phase 1, configuration language), T02-01 to T02-18 (phase 2, server and location selection). That is 46 rows. Numbers follow the order of rows within each phase; phase 2 runs through its three tables (server 01-06, location 07-12, request phases 13-18).
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. No `#anchors` are given. Paths marked ✅ were checked to exist; where a topic shares a page with its neighbours the block says so.

🔴 **Version note.** nginx.org/en/download.html on 2026-10-12 lists mainline **1.31.6** and stable **1.30.5**; our syllabus README (2026-08-14) says 1.31.3 / 1.30.4, so the pins there are behind. The ngx_http_core_module page documents `location $variable` as new in 1.31.5. Hardening and TLS guidance (Mozilla, OWASP) is not needed in these three phases.
`github.com` returns 403 to our fetcher, so the nginx wiki is cited through the getpagespeed mirror, and the old nginx.com wiki URL now lands on the docs home page (not used).

---

## Phase 0 — The nginx process model

### T00-01 · What nginx is — Understand · ✅ written `docs/nginx/pages/phase-0-process-model/01-what-nginx-is.md`
- **Read this:** [nginx.org home](https://nginx.org/) · nginx.org · one-sentence definition: HTTP web server, reverse proxy, content cache, load balancer, TCP/UDP and mail proxy (*read*) · covers our angle: **partial** — a definition only, nothing on why it sits in front of Node · fetched 2026-10-12
- **Also good:** [Inside NGINX: How We Designed for Performance & Scale](https://blog.nginx.org/blog/inside-nginx-how-we-designed-for-performance-scale) · NGINX blog, Jun 10, 2015 · why the architecture, not the feature list, is the point (*read*) · fetched 2026-10-12
- **Beyond the docs:** [How to Configure Nginx as a Reverse Proxy for Node.js Applications](https://betterstack.com/community/guides/scaling-nodejs/nodejs-reverse-proxy-nginx) · Ayooluwa Isaiah, Better Stack (updated Jan 28, 2026) · a Node-first walkthrough of why a reverse proxy sits in front (TLS offload, compression, caching, load balancing), which the nginx.org definition does not give · fetched 2026-10-13 (*read*)
- **Our delta:** the Node-stack reasons (TLS, static files, buffering slow clients, one public port) and the Apache comparison.

### T00-02 · Master process and worker processes — Master · ✅ written `docs/nginx/pages/phase-0-process-model/02-master-and-workers.md`
- **Read this:** [Inside NGINX: How We Designed for Performance & Scale](https://blog.nginx.org/blog/inside-nginx-how-we-designed-for-performance-scale) · NGINX blog, Jun 10, 2015 · master does privileged work (reading config, binding ports); workers are single-threaded and handle many connections (*read*) · covers our angle: **partial** — unprivileged-worker detail is not confirmed there · fetched 2026-10-12
- **Also good:** [Beginner's Guide](https://nginx.org/en/docs/beginners_guide.html) · nginx.org · master reads config and maintains workers, workers process requests (*read*) · fetched 2026-10-12
- **Beyond the docs:** [How NGINX actually works in production: a mental model for operators](https://www.netdata.cloud/guides/nginx/how-nginx-works-in-production/) · Netdata guides (no author or date shown) · operator framing of master vs workers: one blocking operation stalls every connection on that worker, and a failed reload can leave stale config running unnoticed · fetched 2026-10-13 (*read*)
- **Our delta:** which process runs as `root`, and what workers do and do not share.

### T00-03 · The event loop per worker — Understand · ✅ written `docs/nginx/pages/phase-0-process-model/02-master-and-workers.md`
- **Read this:** [nginx, AOSA volume 2](https://aosabook.org/en/v2/nginx.html) · Andrew Alexeev, in The Architecture of Open Source Applications (undated page; text refers to Apache 2.4 in February 2012) · no process or thread per connection, a run-loop per worker, contrast with Apache's style of spawning new processes or threads for each page request (*read*) · covers our angle: **partial** — dated Apache comparison, no prefork vs worker detail · fetched 2026-10-12
- **Also good:** [Inside NGINX](https://blog.nginx.org/blog/inside-nginx-how-we-designed-for-performance-scale) · NGINX blog, Jun 10, 2015 · state machines driven by events (*read*) · fetched 2026-10-12
- **Our delta:** current Apache MPMs; this page does not cover them.

### T00-04 · `worker_processes auto`, `worker_connections`, the theoretical max — Understand · ✅ written `docs/nginx/pages/phase-0-process-model/03-sizing-the-workers.md`
- **Read this:** [Core functionality](https://nginx.org/en/docs/ngx_core_module.html) · nginx.org · `worker_connections` counts all connections including proxied ones and cannot exceed the open-file limit set by `worker_rlimit_nofile` (*read*) · covers our angle: **partial** — states the limits, does not do the connections times workers arithmetic · fetched 2026-10-12
- **Beyond the docs:** [NGINX worker_rlimit_nofile: setting file descriptor limits correctly](https://www.netdata.cloud/guides/nginx/nginx-worker-rlimit-nofile/) · Netdata guides (no author or date shown) · turns the limits into a sizing floor and states that a proxied request uses two connections; it sizes per worker, so the connections times workers arithmetic is still ours · fetched 2026-10-13 (*read*)
- **Our delta:** the file-descriptor ceiling worked through, and that proxied traffic uses two connections per client.

### T00-05 · Connection processing methods — Know · ✅ written `docs/nginx/pages/phase-0-process-model/03-sizing-the-workers.md`
- **Read this:** [Connection processing methods](https://nginx.org/en/docs/events.html) · nginx.org · epoll on Linux 2.6+, kqueue on FreeBSD/OpenBSD/NetBSD/macOS, and nginx normally picks the best method itself (*read*) · covers our angle: full · fetched 2026-10-12

### T00-06 · Signals and `nginx -s` — Master · ✅ written `docs/nginx/pages/phase-0-process-model/04-signals-and-control.md`
- **Read this:** [Controlling nginx](https://nginx.org/en/docs/control.html) · nginx.org · table of TERM/INT, QUIT, HUP, USR1, USR2, WINCH and what each does (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Command-line parameters](https://nginx.org/en/docs/switches.html) · nginx.org · `-s` accepts stop, quit, reopen, reload (*read*) · fetched 2026-10-12

### T00-07 · A reload is not a restart — Master · ✅ written `docs/nginx/pages/phase-0-process-model/05-reload-and-upgrade.md`
- **Read this:** [Controlling nginx](https://nginx.org/en/docs/control.html) · nginx.org · on HUP the master checks syntax, applies it, rolls back if that fails and keeps running on the old config (*read* the Changing Configuration passage) · covers our angle: **partial** — no discussion of what a reload cannot change · fetched 2026-10-12
- **Also good:** [Inside NGINX](https://blog.nginx.org/blog/inside-nginx-how-we-designed-for-performance-scale) · NGINX blog, Jun 10, 2015 · reload forks new workers, signals old ones to exit gracefully (*read*) · fetched 2026-10-12
- **Our delta:** what a reload cannot change and which in-flight requests survive.

### T00-08 · Binary upgrade on the fly — Know · ✅ written `docs/nginx/pages/phase-0-process-model/05-reload-and-upgrade.md`
- **Read this:** [Controlling nginx](https://nginx.org/en/docs/control.html) · nginx.org · USR2 starts a new master, the old pid file gets the `.oldbin` suffix, and HUP to the old master plus QUIT to the new one rolls back (*read*) · covers our angle: full · fetched 2026-10-12

### T00-09 · `nginx -t`, `-T` and `-V` — Master · ✅ written `docs/nginx/pages/phase-0-process-model/06-testing-the-config.md`
- **Read this:** [Command-line parameters](https://nginx.org/en/docs/switches.html) · nginx.org · `-t` checks syntax and opens referenced files, `-T` also dumps the config (1.9.2), `-V` prints compiler and configure arguments (*read*) · covers our angle: full · fetched 2026-10-12

### T00-10 · Installing: distro vs nginx.org repo vs container — Understand · ✅ written `docs/nginx/pages/phase-0-process-model/07-installing.md`
- **Read this:** [Installing NGINX Open Source](https://docs.nginx.com/nginx/admin-guide/installing-nginx/installing-nginx-open-source/) · docs.nginx.com · OS repo "suitable for learning or testing", official repo recommended for production, source builds, containers (*read*) · covers our angle: **partial** — does not compare file layouts · fetched 2026-10-12
- **Also good:** [nginx: Linux packages](https://nginx.org/en/linux_packages.html) · nginx.org · supported distributions and repo setup for stable and mainline (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Installing and configuring nginx on Debian and Ubuntu](https://www.kernelhost.com/en/blog/install-nginx-on-debian-ubuntu) · KernelHost (Jul 26, 2026) · side-by-side table of the distro package vs the nginx.org package (user www-data vs nginx, sites-enabled and snippets only in the distro build), which the vendor install guide does not compare · fetched 2026-10-13 (*read*)
- **Our delta:** why the distro package's layout differs from upstream's.

### T00-11 · Static vs dynamic modules — Understand · ✅ written `docs/nginx/pages/phase-0-process-model/08-modules.md`
- **Read this:** [Building nginx from sources](https://nginx.org/en/docs/configure.html) · nginx.org · `--with-...` flags, `=dynamic` variants, `--add-dynamic-module`, `--with-compat` (*read*) · covers our angle: **partial** — build side only · fetched 2026-10-12
- **Also good:** [Dynamic Modules](https://docs.nginx.com/nginx/admin-guide/dynamic-modules/dynamic-modules/) · docs.nginx.com · `.so` files loaded with `load_module` (*read*; it is written around NGINX Plus packages) · [Core functionality](https://nginx.org/en/docs/ngx_core_module.html) · nginx.org · `load_module`, context main, since 1.9.11 (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Compiling and using dynamic nginx modules](https://lipanski.com/posts/nginx-dynamic-modules) · Florin Lipan (undated) · a worked build of a third-party dynamic module, including why `--with-compat` (1.11.5) matters and that nginx must have been built with it · fetched 2026-10-13 (*read*)
- **Our delta:** checking `nginx -V` to see whether the module you need is present.

### T00-12 · Mainline vs stable — Understand · ✅ written `docs/nginx/pages/phase-0-process-model/09-versions-and-plus.md`
- **Read this:** [Installing NGINX Open Source](https://docs.nginx.com/nginx/admin-guide/installing-nginx/installing-nginx-open-source/) · docs.nginx.com · mainline (odd middle number) every 1-2 months and recommended for production unless stability is strict; stable (even) mostly gets backports (*read*) · covers our angle: **partial** — vendor view only · fetched 2026-10-12
- **Also good:** [nginx download](https://nginx.org/en/download.html) · nginx.org · current branches: mainline 1.31.6, stable 1.30.5, legacy 1.28.3 (*read*) · fetched 2026-10-12
- **Our delta:** 🔴 the syllabus claim that "stable" is not "the safe one" conflicts with the vendor page above, which recommends mainline for most production; our page must show the source for each side. No third-party comparison of the two branches was opened — *Not opened.*

### T00-13 · nginx Open Source vs NGINX Plus — Know · ✅ written `docs/nginx/pages/phase-0-process-model/09-versions-and-plus.md`
- **Read this:** [ngx_http_upstream_module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html) · nginx.org · each commercial-only directive or parameter is marked "available as part of our commercial subscription" (*read* those passages) · covers our angle: **partial** — one module, no OSS substitutes listed · fetched 2026-10-12
- **Checked, not chosen:** [NGINX Plus product page](https://www.f5.com/products/nginx/nginx-plus) · F5 · marketing list of Plus capabilities, does not say which exist in open source (*read*).
- **Our delta:** the OSS substitute per Plus directive; no single free page maps them.

### T00-14 · Forks and derivatives — When Needed · ✅ written `docs/nginx/pages/phase-0-process-model/10-forks.md`
- **Read this:** [Nginx web server forked as Freenginx](https://www.theregister.com/software/2024/02/16/nginx-web-server-forked-as-freenginx/793091) · The Register, 2024-02-16 · why Maxim Dounin forked, and Angie's earlier fork (*read*) · covers our angle: **partial** — nothing on OpenResty or Tengine · fetched 2026-10-12
- **Also good:** [OpenResty](https://openresty.org/en/) · openresty.org · "Scalable Web Platform by Extending NGINX with Lua" (*read*) · [Angie vs nginx](https://en.angie.software/news/articles/shodstva-i-razlichiya-angie-i-nginx/) · Angie, 2023-08-25 · vendor's own comparison (*headings only*) · fetched 2026-10-12
- *Not opened:* [Tengine](https://tengine.taobao.org/) (returned 200 only); [freenginx.org](https://freenginx.org/) showed 1.31.4 mainline on 2026-09-01 (*read*, news list only).

---

## Phase 1 — The configuration language

### T01-01 · Directives and contexts — Master · ✅ written `docs/nginx/pages/phase-1-configuration-language/01-directives-and-contexts.md`
- **Read this:** [Beginner's Guide](https://nginx.org/en/docs/beginners_guide.html) · nginx.org · simple directive ends with a semicolon, block directive has braces (*read* the Configuration File's Structure section) · covers our angle: **partial** — the full context tree is not drawn · fetched 2026-10-12
- **Also good:** [Creating NGINX configuration files](https://docs.nginx.com/nginx/admin-guide/basic-functionality/managing-configuration-files/) · docs.nginx.com · directives, contexts (events, http, server, location) with a sample file (*read*) · fetched 2026-10-12
- **Our delta:** the `Context:` line of each directive page as the specification.

### T01-02 · Inheritance and the replace-not-merge rule — Master · ✅ written `docs/nginx/pages/phase-1-configuration-language/02-inheritance.md`
- **Read this:** [ngx_http_headers_module](https://nginx.org/en/docs/http/ngx_http_headers_module.html) · nginx.org · `add_header` is inherited only if the current level defines none; `add_header_inherit` (1.29.3) changes that (*read*) · covers our angle: **partial** — states the rule for one directive family · fetched 2026-10-12
- **Also good:** [Creating NGINX configuration files](https://docs.nginx.com/nginx/admin-guide/basic-functionality/managing-configuration-files/) · docs.nginx.com · child contexts inherit, some directives can be overridden (*read*) · fetched 2026-10-12
- **Beyond the docs:** [The Pitfalls of add_header in NGINX](https://www.getpagespeed.com/server-setup/nginx/the-pitfalls-of-add_header-in-nginx-solving-inheritance-issues-with-more_set_headers) · Danila Vershinin, GetPageSpeed (Sep 15, 2023; revisited Jun 6, 2026) · shows the child-block-discards-parent-headers surprise as a concrete failure, with the repeat-everything and headers-more workarounds · fetched 2026-10-13 (*read*)
- **Our delta:** the general rule and the list of directives that behave this way.

### T01-03 · `include` and the file layout — Understand · ✅ written `docs/nginx/pages/phase-1-configuration-language/03-include-and-files/01-how-include-works.md`
- **Read this:** [Core functionality](https://nginx.org/en/docs/ngx_core_module.html) · nginx.org · `include file | mask`, context any, included files must be valid directives (*read*) · covers our angle: **partial** — no `sites-enabled` discussion · fetched 2026-10-12
- **Also good:** [Creating NGINX configuration files](https://docs.nginx.com/nginx/admin-guide/basic-functionality/managing-configuration-files/) · docs.nginx.com · splitting into `conf.d` feature files (*read*) · fetched 2026-10-12
- **Our delta:** `sites-available` / `sites-enabled` is a Debian convention, not upstream.

### T01-04 · Variables — Master · ✅ written `docs/nginx/pages/phase-1-configuration-language/04-variables.md`
- **Read this:** [Alphabetical index of variables](https://nginx.org/en/docs/varindex.html) · nginx.org · every variable with its module (*headings only*; the descriptions of `$request_uri`, `$sent_http_`, `$host` *read* on the core module page) · covers our angle: **partial** — a reference, no explanation of when a variable is set · fetched 2026-10-12
- **Also good:** [agentzh's Nginx Tutorials](https://openresty.org/download/agentzh-nginx-tutorials-en.html) · Yichun Zhang, version 2020.03.19 · Nginx Variables chapters: lazy evaluation, `$arg_` groups (*read*); examples use the third-party echo module and nginx 1.7.x · fetched 2026-10-12
- **Our delta:** `$upstream_*` timing and the 1.30-era defaults.

### T01-05 · `$uri` vs `$request_uri` vs `$document_uri` — Understand · ✅ written `docs/nginx/pages/phase-1-configuration-language/04-variables.md`
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · `$request_uri` is the full original URI with arguments; `$document_uri` is the same as `$uri` (*read*) · covers our angle: **partial** — no "which to log" advice · fetched 2026-10-12
- **Our delta:** a decoded-and-rewritten vs raw comparison and the logging choice.

### T01-06 · Measurement units — Understand · ✅ written `docs/nginx/pages/phase-1-configuration-language/05-syntax-details.md`
- **Read this:** [Configuration file measurement units](https://nginx.org/en/docs/syntax.html) · nginx.org · size suffixes, time suffixes `ms s m h d w M y`, combined units (*read*) · covers our angle: full · fetched 2026-10-12

### T01-07 · `map` — Master · ✅ written `docs/nginx/pages/phase-1-configuration-language/06-map/README.md`
- **Read this:** [ngx_http_map_module](https://nginx.org/en/docs/http/ngx_http_map_module.html) · nginx.org · `default`, `hostnames`, regex keys, `volatile`, and variables evaluated only when used (*read*) · covers our angle: full for the directive, **partial** on replacing `if` · fetched 2026-10-12
- **Beyond the docs:** [NGINX map Directive: Guide to Conditional Variables](https://www.getpagespeed.com/server-setup/nginx/nginx-map-directive) · Danila Vershinin, GetPageSpeed (Jan 27, 2026; revisited Jun 3, 2026) · example-led use of `map` as the replacement for chains of `if`, with the point that maps are compiled to hash tables at config load · fetched 2026-10-13 (*read*)
- **Our delta:** worked `if` to `map` rewrites.

### T01-08 · "If is evil" — Master · ✅ written `docs/nginx/pages/phase-1-configuration-language/07-if-is-evil/README.md`
- **Read this:** [If is Evil... when used in location context](https://nginx-wiki.getpagespeed.com/config/if-is-evil/) · nginx wiki mirror (getpagespeed), published 2025-12-05, modified 2026-08-05 · only `return` and `rewrite ... last` are fully safe; use `try_files`, `return`, or `rewrite ... last` (*read*) · covers our angle: **partial** — does not mention `map` · fetched 2026-10-12
- **Also good:** [ngx_http_rewrite_module](https://nginx.org/en/docs/http/ngx_http_rewrite_module.html) · nginx.org · `if` is allowed in server and location, and the request is assigned the configuration inside it (*read*) · fetched 2026-10-12
- **Our delta:** `map` as the third replacement.

### T01-09 · `set`, `return` and `rewrite` — Understand · ✅ written `docs/nginx/pages/phase-1-configuration-language/08-rewrite-and-return.md`
- **Read this:** [ngx_http_rewrite_module](https://nginx.org/en/docs/http/ngx_http_rewrite_module.html) · nginx.org · processing order: server-level directives run sequentially, then a location search repeats at most 10 times (*read*) · covers our angle: full · fetched 2026-10-12

### T01-10 · `return` vs `rewrite` for redirects — Understand · ✅ written `docs/nginx/pages/phase-1-configuration-language/08-rewrite-and-return.md`
- **Read this:** [ngx_http_rewrite_module](https://nginx.org/en/docs/http/ngx_http_rewrite_module.html) · nginx.org · `return code URL` takes a redirect URL for 301/302/303/307/308; `permanent` flag gives 301 (*read*) · covers our angle: **partial** — the page never says return is preferable · fetched 2026-10-12
- **Our delta:** the argument for `return 301 https://$host$request_uri;` is ours.

### T01-11 · `geo` and `split_clients` — Know · ✅ written `docs/nginx/pages/phase-1-configuration-language/09-geo-and-split-clients.md`
- **Read this (1/2):** [ngx_http_geo_module](https://nginx.org/en/docs/http/ngx_http_geo_module.html) · nginx.org · CIDR prefixes and ranges, `default`, `proxy` for trusted X-Forwarded-For (*read*) · covers our angle: full for `geo` · fetched 2026-10-12
- **Read this (2/2):** [ngx_http_split_clients_module](https://nginx.org/en/docs/http/ngx_http_split_clients_module.html) · nginx.org · hashes a string with MurmurHash2 into percentage buckets, example for A/B tests (*read*) · covers our angle: **partial** — no canary routing example · fetched 2026-10-12

### T01-12 · Regular expressions in nginx — Understand · ✅ written `docs/nginx/pages/phase-1-configuration-language/08-rewrite-and-return.md`
- **Read this:** [Server names](https://nginx.org/en/docs/http/server_names.html) · nginx.org · PCRE compatible, leading `~`, named captures, braces need quoting (*read* the Regular expressions names section) · covers our angle: **partial** — server names only; `$1` captures are in the location docs · fetched 2026-10-12
- **Also good:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · captures usable later in other directives, e.g. `root /sites/$2;`, plus `~` and `~*` (*read*); the `$1 .. $9` wording is on the rewrite module page · fetched 2026-10-12
- **Beyond the docs:** [NGINX locations: performance impact and optimizations](https://www.getpagespeed.com/server-setup/nginx-locations-performance-impact-and-optimizations) · Danila Vershinin, GetPageSpeed (Dec 12, 2019; revised May 17, 2021) · says regex locations are checked sequentially so cost grows with their number, and suggests `pcre_jit on;` and exact-match locations; it gives no measurements · fetched 2026-10-13 (*read*)
- **Our delta:** the cost of a regex in a hot path — no page found that measures it.

### T01-13 · MIME types and `default_type` — Understand · ✅ written `docs/nginx/pages/phase-1-configuration-language/03-include-and-files/02-mime-types.md`
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · `default_type` defaults to `text/plain`; `types` maps case-insensitive extensions (*read*) · covers our angle: **partial** — nothing on `include mime.types` · fetched 2026-10-12

### T01-14 · Comments, quoting, and the stray `;` — Know · ✅ written `docs/nginx/pages/phase-1-configuration-language/05-syntax-details.md`
- **Read this:** [ticket 947 — missing semicolon not detected](https://trac.nginx.org/nginx/ticket/947) · nginx trac (page shows only relative ages: opened "11 years ago", maintainer reply Maxim Dounin) · variable-argument directives such as `index` and `server_name` swallow the next line, so `nginx -t` passes (*read*) · covers our angle: **partial** — one failure mode of three; comments not covered · fetched 2026-10-12
- **Also good:** [Server names](https://nginx.org/en/docs/http/server_names.html) · nginx.org · braces in a regex need quotes or nginx reports a missing `;` (*read*) · fetched 2026-10-12
- *Not opened:* a DigitalOcean syntax-error tutorial (200, date not shown).

---

## Phase 2 — How nginx picks a server and a location

### T02-01 · `listen` and the address:port match first — Understand · ✅ written `docs/nginx/pages/phase-2-server-and-location/01-choosing-the-server.md`
- **Read this:** [How nginx processes a request](https://nginx.org/en/docs/http/request_processing.html) · nginx.org · tests IP and port against `listen` first, then Host against `server_name` of those blocks (*read*) · covers our angle: full · fetched 2026-10-12

### T02-02 · `server_name` matching order — Master · ✅ written `docs/nginx/pages/phase-2-server-and-location/01-choosing-the-server.md`
- **Read this:** [Server names](https://nginx.org/en/docs/http/server_names.html) · nginx.org · exact, longest `*.` wildcard, longest trailing wildcard, first regex in file order (*read*) · covers our angle: full · fetched 2026-10-12

### T02-03 · The default server — Understand · ✅ written `docs/nginx/pages/phase-2-server-and-location/02-default-server.md`
- **Read this:** [How nginx processes a request](https://nginx.org/en/docs/http/request_processing.html) · nginx.org · default is the first block for that address:port unless `default_server` is set; a property of the listen port (*read*) · covers our angle: full · fetched 2026-10-12

### T02-04 · The catch-all that stops host-header surprises — Understand · ✅ written `docs/nginx/pages/phase-2-server-and-location/02-default-server.md`
- **Read this:** [Server names](https://nginx.org/en/docs/http/server_names.html) · nginx.org · `listen 80 default_server; server_name _; return 444;`, and `_` is just an invalid name (*read*) · covers our angle: **partial** — no security argument about leaking the app · fetched 2026-10-12
- **Also good:** [How nginx processes a request](https://nginx.org/en/docs/http/request_processing.html) · nginx.org · drop requests without a Host header with an empty `server_name` and 444 (*read*) · fetched 2026-10-12
- **Beyond the docs:** [NGINX does not drop connections on bad requests with empty host headers](https://community.nginx.org/t/nginx-does-not-drop-connections-on-bad-requests-with-empty-host-headers/2196) · NGINX community forum thread (Apr to Jul 2025) · real-world limit of the `return 444` catch-all: a missing or empty Host still gets a 400, with the `error_page 400 =444` workaround · fetched 2026-10-13 (*read*)
- **Our delta:** why a chance default exposes your app to any hostname pointed at the IP.

### T02-05 · Empty `server_name`, `$host` vs `$http_host` vs `$server_name` — Understand · ✅ written `docs/nginx/pages/phase-2-server-and-location/02-default-server.md`
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · `$host` precedence: request line, then Host header, then matching server name; empty `server_name` matches no-Host requests (*read*) · covers our angle: **partial** — does not say which is safe to trust · fetched 2026-10-12
- **Our delta:** the trust argument.

### T02-06 · HTTPS and SNI — Understand · ✅ written `docs/nginx/pages/phase-2-server-and-location/02-default-server.md`
- **Read this:** [Configuring HTTPS servers](https://nginx.org/en/docs/http/configuring_https_servers.html) · nginx.org · SNI (RFC 6066) passes the name in the handshake so the certificate is chosen before HTTP (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Server names](https://nginx.org/en/docs/http/server_names.html) · nginx.org · virtual server selection happens at the SSL handshake via SNI, first in a default server context (*read*) · fetched 2026-10-12

### T02-07 · The location matching algorithm — Master · ✅ written `docs/nginx/pages/phase-2-server-and-location/03-location-matching/01-the-algorithm.md`
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · longest prefix remembered, regexes in file order, first regex wins, else the remembered prefix (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [How nginx processes a request](https://nginx.org/en/docs/http/request_processing.html) · nginx.org · worked PHP-site example (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Untangling the nginx location block matching algorithm](https://artfulrobot.uk/blog/untangling-nginx-location-block-matching-algorithm/) · Rich Lott, Artful Robot (22 May 2018) · worked examples including the case the official page only hints at: regexes nested inside the longest matching prefix are tried before top-level regexes · fetched 2026-10-13 (*read*)
- **Our delta:** the current core page adds a step the syllabus lacks: predicate locations (`location $variable`, 1.31.5) are checked after regexes and before the remembered prefix.

### T02-08 · The modifiers — Master · ✅ written `docs/nginx/pages/phase-2-server-and-location/03-location-matching/01-the-algorithm.md`
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · syntax `= | ~ | ~* | ^~`; `=` ends the search at once (*read*) · covers our angle: full · fetched 2026-10-12

### T02-09 · Why regex order matters and prefix order does not — Master · ✅ written `docs/nginx/pages/phase-2-server-and-location/03-location-matching/02-the-asymmetry.md`
- **Read this:** [How nginx processes a request](https://nginx.org/en/docs/http/request_processing.html) · nginx.org · "first matching expression stops the search", prefix choice is by length (*read*) · covers our angle: **partial** — never names the asymmetry · fetched 2026-10-12
- **Our delta:** the asymmetry itself and its consequences.

### T02-10 · Named locations `@name` — Understand · ✅ written `docs/nginx/pages/phase-2-server-and-location/04-named-and-internal.md`
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · not for regular requests, only redirection; cannot be nested (*read*) · covers our angle: full · fetched 2026-10-12

### T02-11 · `internal` — Understand · ✅ written `docs/nginx/pages/phase-2-server-and-location/04-named-and-internal.md`
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · external requests get 404; internal ones come from `error_page`, `rewrite`, and similar (*read*) · covers our angle: **partial** — the `X-Accel-Redirect` use is in the proxy module docs · fetched 2026-10-12
- **Also good:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · lists `X-Accel-Redirect` among special response headers (*read* briefly) · fetched 2026-10-12

### T02-12 · Nested locations — Know · ✅ written `docs/nginx/pages/phase-2-server-and-location/04-named-and-internal.md`
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · "can be nested, with some exceptions"; `=` and named locations cannot contain nested ones (*read*) · covers our angle: **partial** — no advice on when nesting is clearer · fetched 2026-10-12
- **Beyond the docs:** [Nested locations blocks in NGINX configuration](https://upsun.com/blog/nginx-config-nested-locations-blocks) · Michael Sharp, Upsun (13 Feb 2024) · which nestings are allowed (no `=` parents, no prefix inside regex) and what `^~` does to nested regexes · fetched 2026-10-13 (*read*)

### T02-13 · The request-processing phases — Understand · ✅ written `docs/nginx/pages/phase-2-server-and-location/05-request-phases.md`
- **Read this:** [Development guide](https://nginx.org/en/docs/dev/development_guide.html) · nginx.org · official, current phase list (post-read, server rewrite, find config, rewrite, post-rewrite, preaccess, access, post-access, precontent, content, log) with the standard module registered in each (*read* the HTTP phases passage) · covers our angle: **partial** — written for module authors, and its list has `post-access` where the syllabus list has none · fetched 2026-10-12
- **Also good:** [agentzh's Nginx Tutorials](https://openresty.org/download/agentzh-nginx-tutorials-en.html) · Yichun Zhang, version 2020.03.19 (written against nginx 1.7.x) · Directive Execution Order chapters: 11 phases with worked examples, but it names `try-files` as a phase where the official guide has `precontent` (*read*) · fetched 2026-10-12
- **Our delta:** reconcile the syllabus list of ten with the official one of eleven before writing; a plain-language, example-led walk through the phases.

### T02-14 · Why `add_header` disappears on a 500 — Master · ✅ written `docs/nginx/pages/phase-2-server-and-location/05-request-phases.md`
- **Read this:** [ngx_http_headers_module](https://nginx.org/en/docs/http/ngx_http_headers_module.html) · nginx.org · added only for 200, 201, 204, 206, 301, 302, 303, 304, 307, 308 unless `always` (*read*) · covers our angle: full · fetched 2026-10-12
- **Beyond the docs:** [Nginx add_header not working, headers not showing up or disappearing in response](https://www.claudiokuenzler.com/blog/1177/nginx-add-header-not-working-headers-not-showing-response-always) · Claudio Kuenzler (Feb 8, 2022; updated Apr 22, 2022) · troubleshooting-first account of a header vanishing on a 404 and the `always` fix · fetched 2026-10-13 (*read*)

### T02-15 · Internal redirects — Master · ✅ written `docs/nginx/pages/phase-2-server-and-location/06-internal-redirects/README.md`
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · `try_files` falls back to an internal redirect to its last parameter (*read*) · covers our angle: **partial** — nothing on `$request_uri` staying unchanged · fetched 2026-10-12
- **Also good:** [agentzh's Nginx Tutorials](https://openresty.org/download/agentzh-nginx-tutorials-en.html) · Yichun Zhang, 2020.03.19 · internal redirection via `rewrite` shown with variables (*read*) · fetched 2026-10-12
- **Our delta:** `$request_uri` does not change.

### T02-16 · `rewrite` flags: last, break, redirect, permanent — Understand · ✅ written `docs/nginx/pages/phase-2-server-and-location/06-internal-redirects/01-the-mechanism.md`
- **Read this:** [ngx_http_rewrite_module](https://nginx.org/en/docs/http/ngx_http_rewrite_module.html) · nginx.org · `redirect` is 302, `permanent` is 301; `last` vs `break` shown in a `/download/` example (*read*) · covers our angle: full · fetched 2026-10-12
- **Beyond the docs:** [Break vs Last in nginx rewrites](https://adyxax.org/blog/2021/04/15/break-vs-last-in-nginx-rewrites) · Julien Dessaux, adyxax.org (2021-04-15) · curl-tested configs showing how `last` and `break` differ inside and outside a location · fetched 2026-10-13 (*read*)

### T02-17 · The `error_page` mechanism — Understand · ✅ written `docs/nginx/pages/phase-2-server-and-location/07-error-page/README.md`
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · `error_page code ... [= [response]] uri`, named-location fallback (*read*) · covers our angle: **partial** — upstream errors are in the proxy module · fetched 2026-10-12
- **Also good:** [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) · nginx.org · `proxy_intercept_errors` is off by default; responses of 300 and above are then passed on (*read*) · fetched 2026-10-12

### T02-18 · Rewrite loops and the internal redirection cycle error — Understand · ✅ written `docs/nginx/pages/phase-2-server-and-location/06-internal-redirects/02-cycles-and-debugging.md`
- **Read this:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · limit reached gives 500 and "rewrite or internal redirection cycle" in the error log (*read*) · covers our angle: **partial** — no fix recipe · fetched 2026-10-12
- **Also good:** [ngx_http_rewrite_module](https://nginx.org/en/docs/http/ngx_http_rewrite_module.html) · nginx.org · a loop repeats at most 10 times; switch `last` to `break` in the location (*read*) · fetched 2026-10-12
- **Beyond the docs:** [nginx rewrite or internal redirection cycle](https://rocketeersapp.com/nginx-rewrite-or-internal-redirection-cycle) · Mark van Eijk, Rocketeers (Jun 23, 2026) · the usual real cause (a looping `try_files` fallback or wrong `root`) with fix recipes, which the core page lacks · fetched 2026-10-13 (*read*)
