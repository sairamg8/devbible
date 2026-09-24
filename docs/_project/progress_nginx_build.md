---
name: progress-nginx-build
description: devbible — Nginx track (session 21fbf27e, from 2026-08-14)
metadata:
  type: progress
---


:::danger CONSOLIDATED 2026-08-15 — THE WORKTREE IN THIS FILE NO LONGER EXISTS
Every devbible worktree and branch was **merged into `main` and DELETED** on 2026-08-15
(*"commit every uncommitted branch to main and delete everything"*). **All the content
described below is on `main`** at `/run/media/sairam/Storage/Backup/Knowledge/devbible`
— nothing was lost, every branch was verified at 0 unique commits first. Ignore any
"worktree", "branch", "not merged" or "merge at the phase close" instruction below and
**work on `main`**. `main` builds 0 warnings / 0 broken links, so a break there is yours.
Full record: `progress_worktree_consolidation_20260815.md`.
:::
# devbible — Nginx track (session `21fbf27e`, from 2026-08-14)

🔴 **The cursor.** Open this file first, start at the topic it names, do not re-derive the
position from the git log.

| | |
|---|---|
| **Resume at** | ✅ **The "commit the uncommitted phase-2 work" step below is DONE (2026-08-15).** Resume at **Phase 3 · Serving static files and SPAs (14 topics)** — `docs/nginx/pages/phase-3-static-and-spa/` |
| **Where** | 🔴 **`main`**, at `/run/media/sairam/Storage/Backup/Knowledge/devbible` — the `devbible-nginx` worktree and the `nginx` branch were merged and **DELETED 2026-08-15** |
| **Scope** | `docs/nginx/` **only**. Not JS, not React, not Express, not Docker — even to fix a link |
| **Syllabus** | ✅ complete — 4 parts, 12 phases, **210 topics** |
| **Pages** | **48 of 210 topics (23%)** — ✅ **phases 0, 1 and 2 all COMPLETE and committed** (47 files, 9,050 lines, 0 over the 300-line cap) |
| **Last commit** | `ca4c239` *Nginx phase 2: topics 06-07 (Internal redirects; error_page) + boards* — the last uncommitted work, now safe; merged to `main` as `8cb4beab` |
| **Build** | ✅ `main` rebuilds **0 warnings, 0 broken links** repo-wide (2026-08-15) |

## The order, verbatim

> *"can you work on ngnix ?"* — 2026-08-14

then, in the same session:

> *"You going to identify the syllabus just like how node and express written and also you
> need to follow instructions and there is sandboxing will verify against documentation and
> using online"*
>
> *"Create your own worktree work on there"*
>
> *"good night i am trusting that you would pick a full syllabus just like how node js is
> structured and writing style and you will work on this session till completes"*
>
> *"work on your own worktree complete in there and good night do not wait for take
> recomended action to match the goal"*
>
> *"thre is no sandboxing ****"* (emphatic, after asking twice whether the hard rules had
> been read)

**Read as:** run to completion, do not stop between topics to report or ask, work only in
the worktree, and **no sandboxing** — documentation-validated against nginx.org, source
named in every `> Verified:` line, and **no console block unless a real run produced it**.
There is no nginx sandbox in the repo and none is to be created.

## The worktree

```bash
# already created; node_modules is a symlink to the main checkout's, so no yarn install
cd /run/media/sairam/Storage/Backup/Knowledge/devbible-nginx     # branch `nginx`

# build in isolation — a bare `yarn build` collides with the other live sessions
rm -rf .docusaurus-nginx build-nginx
DOCUSAURUS_GENERATED_FILES_DIR_NAME=.docusaurus-nginx yarn build --out-dir build-nginx 2>&1 \
  | grep "source page path" | sed 's#.*/devbible/docs/##' | cut -d/ -f1 | sort | uniq -c
```

⚠️ **The branch is NOT merged into `main`.** Say so plainly at every handoff rather than
leaving it stranded — that is the React lesson (§11c). `.docusaurus-nginx/` is untracked and
not in `.gitignore` (the existing `..docusaurus-` pattern is a typo); **never `git add -A`**,
stage explicit paths.

**Baseline build, 2026-08-14:** clean, **0 broken links in `docs/nginx`**. The 23 reported
belong to react (17), typescript (4) and javascript (2) — other sessions' lanes, deliberately
left alone.

## The syllabus as built

| Part | Phases | Topics | File |
|---|---|---|---|
| 1 · How nginx works | 0–2 | 46 | `syllabus/01-how-nginx-works.md` |
| 2 · Serving and proxying | 3–5 | 60 | `syllabus/02-serving-and-proxying.md` |
| 3 · Speed and scale | 6–8 | 47 | `syllabus/03-speed-and-scale.md` |
| 4 · Production | 9–11 | 57 | `syllabus/04-production.md` |

| Phase | Topics | Name |
|---|---|---|
| 0 | 14 | The nginx process model |
| 1 | 14 | The configuration language |
| 2 | 18 | How nginx picks a server and a location |
| 3 | 14 | Serving static files and SPAs |
| 4 | **30** | Reverse proxy to Node |
| 5 | 16 | TLS, HTTP/2 and HTTP/3 |
| 6 | 20 | Caching at the edge |
| 7 | 13 | Compression, limits and delivery |
| 8 | 14 | Load balancing and upstream health |
| 9 | 25 | Access control, rate limiting and hardening |
| 10 | 16 | Logs, metrics and debugging |
| 11 | 16 | Deployment and operations |

Tiers: **Master 58 (28%)** · Understand 101 (48%) · Know 38 (18%) · When Needed 13 (6%).
Master concentrates in phases 2 and 4 on purpose — those two explain most production
nginx incidents.

**Deliberately out of scope** (listed in `syllabus/04-production.md`): the mail modules,
media streaming (`mp4`/`flv`/`hls`/`f4f`/`dash`), body-transform modules (`xslt`,
`image_filter`, `ssi`, `perl`), writing C modules, NGINX Plus in depth, and the separate F5
products (Instance Manager, Unit, Gateway Fabric, App Protect).

## 🔴 Version facts — verified 2026-08-14, and load-bearing

| | |
|---|---|
| Latest stable | **1.30.4**, 15 July 2026 |
| Latest mainline | **1.31.3**, 15 July 2026 |
| 1.30 branch opened | 14 April 2026 |
| Security cadence | 1.30.1 (13 May) · 1.30.2 (22 May) · 1.30.3 (17 Jun) · 1.30.4 (15 Jul) |
| Track target | **1.30.x stable** |

🔴 **THE fact the track turns on — nginx 1.29.7 changed the proxy defaults.** From
`CHANGES-1.30`, quoted:

> *"Change: now the "keepalive" directive in the "upstream" block is enabled by default."*
> *"Change: now ngx_http_proxy_module supports keepalive by default; the default value for
> "proxy_http_version" is "1.1"; the "Connection" proxy header is not sent by default
> anymore."*

So `keepalive 32 local;` is the default, and the three-line incantation every tutorial
prescribes (`proxy_http_version 1.1;` + `proxy_set_header Connection "";` + `keepalive`) is
**redundant on 1.30+ and still required on 1.28 and older**. Every proxy page must say which
side of that line it is describing.

Other 1.29.x → 1.30 features confirmed from `CHANGES-1.30`:

- `sticky` session affinity in **open source** (1.29.7); `sticky learn` OSS from 1.29.6
- Early Hints / 103 from proxied and gRPC backends, `early_hints` directive (1.29.0)
- `ngx_http_proxy_module` supports **HTTP/2 to the backend** (1.29.4)
- `ssl_certificate_compression` (1.29.1) · `ssl_ech_file` for Encrypted ClientHello (1.29.4,
  needs the OpenSSL ECH branch / OpenSSL 4.0)
- `add_header_inherit` / `add_trailer_inherit` (1.29.3) · `$request_port`, `$is_request_port`,
  `$ssl_sigalg`, `$ssl_client_sigalg` (1.29.3)
- OpenSSL 4.0 compatibility, AWS-LC build support
- `least_time` is **open source only from 1.31.0** — mainline, *not* on the 1.30 stable branch
- `ngx_http_acme_module` — ACMEv2 client, dynamic module `nginx-module-acme`, since 1.29.0
- njs **1.0.0** (23 June 2026) deprecates the njs engine in favour of QuickJS

⚠️ **A trap already caught:** a summary of `nginx.org/2026.html` claimed **Multipath TCP**
landed in 1.29.7/1.30.0. Checking `CHANGES-1.30` directly returned **absent** — the claim was
a summarisation artefact, not documentation. It is not in the syllabus and must not be added.
Verify feature claims against `CHANGES-1.30` or the directive page, never against a summary.

## Sources that have actually been read

`nginx.org/en/docs/` (module index) · `download.html` · `2026.html` · `CHANGES-1.30` ·
`ngx_http_core_module` (location matching, `root`/`alias`/`try_files`/`internal`/
`client_max_body_size`/`server_name`) · `ngx_http_proxy_module` (full directive list, the
`proxy_pass` URI rule, `proxy_http_version` default, buffering defaults) ·
`ngx_http_upstream_module` (full directive list, `server` parameters, `keepalive 32 local`,
`sticky`, Plus-only list, `$upstream_*` variables) · `ngx_http_limit_req_module` (syntax,
defaults, leaky bucket, `burst`/`nodelay`/`delay`, `limit_req_dry_run`) ·
`ngx_http_ssl_module` (full directive list + defaults + "appeared in" versions) ·
`ngx_http_v3_module` (the `listen … quic reuseport` example, directives, `--with-http_v3_module`) ·
`ngx_http_acme_module`.

Still to read before their phases: `ngx_http_gzip_module`, `ngx_http_headers_module`,
`ngx_http_realip_module`, `ngx_http_log_module`, `ngx_http_limit_conn_module`,
`ngx_http_auth_request_module`, `ngx_http_stub_status_module`, `websocket.html`,
`request_processing.html`, `server_names.html`, `control.html`, `debugging_log.html`.

## The per-topic loop

Cadence is **per file** (rule 9, tightened), because parallel sessions and a night run mean a
dead session must lose at most one file.

1. Read the syllabus rows for the topic; fetch the directive page(s) that back them.
2. Write the page to the depth it deserves. **Then** split at 301 lines on a concept
   boundary into `NN-topic/` with `_category_.json` + `README.md` + `NN-chunk.md`.
3. Every page/chunk: tier badge, `> Verified:` naming the nginx.org pages and the date, code,
   **Gotchas as symptom → cause → fix**, a Trade-off, and 3–8 interview questions with answers
   (★ on the frequent ones). Links end in `.md` and keep every numeric prefix.
4. Update the four boards: `src/data/progress.js` (nginx rows only — `pages` **and**
   `pagesPlanned` while mid-phase), the phase `README.md`, `docs/nginx/pages/README.md`,
   `docs/README.md`.
5. Isolated build, grep the tally by language, commit explicit paths, update this file.

## Cross-links this track owes and is owed

| Nginx | Other track |
|---|---|
| Phase 4 · `X-Forwarded-*`, `realip` | **Express** phase 9 `01-trust-proxy/README.md` — verified to exist |
| Phase 7 · `client_max_body_size` | **Express** phase 3 `03-size-limits/` — verified to exist |
| Phase 6 · response caching | **Redis** (data caching) — syllabus only, no pages yet |
| Phase 3 · hashed bundles | **Vite** / **Webpack** — imported corpus |
| Phase 11 · containers | **Docker & Podman** — *not written yet*, write as bold plain text, never a link |

⛔ A link to an unwritten track breaks the build. Bold plain text with *(not written yet)*.


---

## Written so far

### ✅ Phase 0 · The nginx process model — 14/14 topics, 10 files (2026-08-14)

`docs/nginx/pages/phase-0-process-model/`

| File | Topics | Tier | Lines |
|---|---|---|---|
| `README.md` | index + Coverage table + phase gate | — | 78 |
| `01-what-nginx-is.md` | 1 | Understand | 210 |
| `02-master-and-workers.md` | 2, 3 | Master | 246 |
| `03-sizing-the-workers.md` | 4, 5 | Understand | 229 |
| `04-signals-and-control.md` | 6 | Master | 212 |
| `05-reload-and-upgrade.md` | 7, 8 | Master | 254 |
| `06-testing-the-config.md` | 9 | Master | 224 |
| `07-installing.md` | 10 | Understand | ~215 |
| `08-modules.md` | 11 | Understand | ~215 |
| `09-versions-and-plus.md` | 12, 13 | Understand | ~215 |
| `10-forks.md` | 14 | When Needed | ~180 |

All under the 300-line cap. Every page: tier badge, `> Verified:` naming its nginx.org
sources, Gotchas as symptom → cause → fix, a Trade-off, 5–7 interview questions with ★ on
the frequent ones. **No console blocks anywhere** — nothing was run.

⚠️ **A broken *anchor* was found and fixed**: `../../../README.md#the-critical-rule--do-not-violate-this`
does not resolve because the heading starts with an emoji, which changes the generated slug.
**Link the page, not an emoji heading's anchor.**

## Facts established while writing phase 0 — reuse, do not re-derive

| Fact | Source |
|---|---|
| `worker_processes` default is **`1`**, not `auto` | ngx_core_module |
| `worker_connections` default is **`512`** | ngx_core_module |
| `accept_mutex` defaults **`off`** since 1.11.3 — `EPOLLEXCLUSIVE` made it unnecessary | ngx_core_module, events.html |
| `multi_accept` default `off`; `thread_pool default threads=32 max_queue=65536` | ngx_core_module |
| `worker_shutdown_timeout` — 1.11.11, **no default** (unlimited) | ngx_core_module |
| `user` default is **`nobody nobody`** | ngx_core_module |
| `load_module` — 1.9.11, `main` context only, **needs a restart not a reload** | ngx_core_module |
| Master signals: TERM/INT fast, QUIT graceful, HUP reconfigure, USR1 reopen logs, **USR2 upgrade binary, WINCH stop workers** | control.html |
| `WINCH` means something different to a worker (abnormal termination, needs `debug_points`) | control.html |
| Reload: master **validates first and rolls back on failure**; old workers keep serving existing clients | control.html |
| Binary upgrade: USR2 → WINCH(old) → QUIT(old); rollback is HUP(old) + QUIT(new); `.oldbin` suffix discarded automatically | control.html |
| `-T` appeared 1.9.2 · `-e` 1.19.5 · **`-l` REST API 1.29.8** | switches.html |
| `-V` writes to **stderr** — pipelines need `2>&1` | switches.html |
| Official packages: RHEL 8/9/10, Debian bullseye/bookworm/trixie, Ubuntu jammy/noble/resolute, SLES 15SP6+/16, Alpine 3.21–3.24, AL2023 | linux_packages.html |
| Dynamic module packages: njs, otel (1.25.3), **acme (1.29.1)**, geoip, image-filter, perl, xslt. **No Brotli package** | linux_packages.html |
| `sites-available`/`sites-enabled` is a **Debian convention**, not an nginx feature | linux_packages.html + core module `include` |
| Plus-only: `health_check`, `proxy_cache_purge`, `api`, `auth_jwt`, `oidc`, `keyval`, `queue`, `slow_start`, `state`, `route=`, `drain`, `$upstream_last_addr` | ngx_http_upstream_module + module index |
| 1.30.x security history: 1.30.1 (6 CVEs, 13 May) · 1.30.2 (22 May) · 1.30.3 (17 Jun) · 1.30.4 (15 Jul) | 2026.html |
| Forks: OpenResty (LuaJIT), Angie (ex-nginx devs, drop-in, Plus-style features), freenginx (Maxim Dounin, governance), Tengine (Taobao, quiet) | angie.software, GitHub, Wikipedia |

## Style settled in phase 0 — keep it

- Node.js page shape: tier badge → `> Verified:` → bold one-sentence thesis → body →
  **Gotchas** (symptom → cause → fix) → **Trade-off** → **Interview questions** (★ on
  frequent) → prev/index/next footer.
- Phase README shape: target-version note → framing paragraph → page table with
  tier + one-liner → **Coverage** table mapping every syllabus row to a page →
  **Phase gate** → **Where this connects** → syllabus/start footer.
- nginx **config blocks are fine** (they are source, not output). **Terminal output is
  not** — no `$ nginx -t` transcripts anywhere.
- Every page that touches proxying must state which side of the **1.29.7** line it
  describes.


### ✅ Phase 1 · The configuration language — 14/14 topics, 15 files (2026-08-15)

`docs/nginx/pages/phase-1-configuration-language/`

| File | Topics | Tier |
|---|---|---|
| `README.md` | index, Coverage, phase gate | — |
| `01-directives-and-contexts.md` | 1 | Master |
| `02-inheritance.md` | 2 | Master |
| `03-include-and-files/` **(2 chunks)** | 3, 13 | Understand |
| `04-variables.md` | 4, 5 | Master |
| `05-syntax-details.md` | 6, 14 | Understand |
| `06-map/` **(2 chunks)** | 7 | Master |
| `07-if-is-evil/` **(2 chunks)** | 8 | Master |
| `08-rewrite-and-return.md` | 9, 10, 12 | Understand |
| `09-geo-and-split-clients.md` | 11 | Know |

🔴 **Three topics went over the 300-line cap and were CHUNKED, not trimmed** — the
first real exercise of rule 1 on this track. They came in at 304, 339 and 324 lines.
Concept boundaries used: include mechanics / MIME types · the map mechanism / using it
instead of `if` · what `if` does / what to use instead.

⚠️ **Chunking means fixing inbound links in three places every time:** the previous
page's `Next →` footer, the next page's `← Prev` footer, and the phase README's page
table **and** Coverage table. `grep -rn "NN-topic.md" .` after each split catches
strays — it caught one on the map split that the scripted replace had missed.

## Facts established while writing phase 1 — reuse, do not re-derive

| Fact | Source |
|---|---|
| `add_header` applies **only** to 200, 201, 204, 206, 301, 302, 303, 304, 307, 308 unless `always` | ngx_http_headers_module |
| The inheritance sentence, verbatim: *"These directives are inherited from the previous configuration level if and only if there are no `add_header` directives defined on the current level."* | ngx_http_headers_module |
| **`add_header_inherit on \| off \| merge`, default `on`, since 1.29.3** — `merge` is the direct fix for the replace rule. No equivalent for `proxy_set_header` | ngx_http_headers_module |
| `types` documented default is only `text/html html; image/gif gif; image/jpeg jpg;` | ngx_http_core_module |
| 🔴 **`default_type` defaults to `text/plain`**, NOT `application/octet-stream` — the octet-stream line in every config is a deliberate override | ngx_http_core_module |
| A second `types` block **merges** by extension — the one exception to replace-not-merge | ngx_http_core_module |
| `types_hash_bucket_size` 64 · `types_hash_max_size` 1024 | ngx_http_core_module |
| `include` context is **`any`**; substitution is textual at parse time | ngx_core_module |
| `$request_uri` = full original **with** arguments, never changes · `$uri` = current, normalized, **no** arguments, changes on rewrite · `$document_uri` = same as `$uri` | ngx_http_core_module |
| `$host` order: request line → `Host` header → **the matching server name** | ngx_http_core_module |
| `$request_id` = 16 random bytes in hex, since 1.11.0 | ngx_http_core_module |
| Size suffixes: `k`/`K`, `m`/`M`; **`g`/`G` for offsets only**. Time: `ms s m h d w M y`, **`M` = 30 days**, no suffix = **seconds** | syntax.html |
| Time units combine most-to-least significant: `1h 30m` == `90m` == `5400s` | syntax.html |
| `map` search order: exact → longest prefix mask → longest suffix mask → **first regex in file order** → `default`. String keys are **case-insensitive** | ngx_http_map_module |
| `map` with no `default` yields an **empty string** | ngx_http_map_module |
| `map` results are **cached per request** unless `volatile` | ngx_http_map_module |
| `map_hash_max_size` 2048 · `map_hash_bucket_size` 32/64/128 by cache-line size | ngx_http_map_module |
| `if` — *"the request is assigned the configuration inside the `if` directive"*; only **this module's** directives are defined inside it. No `and`/`or`/`else` | ngx_http_rewrite_module |
| Rewrite module = *"a simple virtual stack machine"*, compiled at config stage, run in the rewrite phase; the location-search loop repeats **not more than 10 times** | ngx_http_rewrite_module |
| `rewrite` flags: `last` (re-search location) · `break` (stay) · `redirect` (302) · `permanent` (301). A replacement starting `http://`, `https://` or `$scheme` is an **external redirect with or without a flag** | ngx_http_rewrite_module |
| `return 444` closes the connection with **no response header** | ngx_http_rewrite_module |
| `rewrite_log` default `off`, logs at `notice` level | ngx_http_rewrite_module |
| `geo` — default source `$remote_addr`; params `default` (absent ⇒ empty string; `0.0.0.0/0` works instead), `include`, `ranges` (**must be first**), `proxy`, `proxy_recursive`, `delete`. IPv6 supported | ngx_http_geo_module |
| `split_clients` hashes with **MurmurHash2**; 0.5% == hash 0–21,474,835. The doc example salts the key (`"${remote_addr}AAA"`) | ngx_http_split_clients_module |
| A `limit_req_zone` key evaluating to an **empty string is not counted** — the documented way to exempt a client | (applied in phase 1, confirm again in phase 9) |
| nginx **omits a response header whose value is an empty string** — the conditional-header pattern without `if` | (applied in phase 1) |

⚠️ **Two claims still to re-verify when their phase arrives** (marked above): the
empty-key `limit_req` exemption in phase 9, and the empty-value header omission.
Both are used in phase 1 examples and should be confirmed against their own module
pages before phase 9 relies on them again.


---

## 🔴🔴 STOP — read this first (state as of 2026-08-15, session `21fbf27e` ended here)

The user ended the session with *"save current session progress to memory and enough"* /
*"I mean save to memory and enough"*. **Phase 2 is fully written but the close-out steps
were not run.** Nothing is lost — it is all on disk in the worktree — but it is not all
committed.

### ✅ RESOLVED 2026-08-15 — all of the below is committed and merged

**Everything in this section is DONE.** The listed files were committed as `ca4c239`
(1,044 insertions: `06-internal-redirects/` 4 files/499 lines, `07-error-page/` 4
files/528 lines, plus the boards and the two footer fixes) and merged into `main` as
`8cb4beab`. All three "close-out steps that did NOT run" have now run: the commit
happened, the boards were carried in with it, and `main` rebuilds **0 warnings / 0 broken
links** repo-wide. The isolated-build command below is obsolete — the `.docusaurus-nginx`
cache and the worktree are gone; just run `yarn build` on `main`.

*Kept below as the historical record of what was at risk.*

### Exactly what WAS uncommitted in `devbible-nginx` (branch `nginx`) — now committed

```
 M docs/nginx/pages/README.md
 M docs/nginx/pages/phase-2-server-and-location/03-location-matching/01-the-algorithm.md
 M docs/nginx/pages/phase-2-server-and-location/05-request-phases.md
 M docs/nginx/pages/phase-2-server-and-location/README.md
 M src/data/progress.js                      (nginx phase 2 already set to pages: 18)
?? docs/nginx/pages/phase-2-server-and-location/06-internal-redirects/     ← NEW, 3 files
?? docs/nginx/pages/phase-2-server-and-location/07-error-page/             ← NEW, 3 files
```

### The three close-out steps that did NOT run

1. ❌ **No commit** of the above. Do this first — `git add` those explicit paths only,
   never `git add -A` across the repo.
2. ❌ **Boards not fully updated.** `src/data/progress.js` **is** done (phase 2 → `pages: 18`).
   **Still to do:** `docs/nginx/pages/README.md` (the state line and the phase-2 row) and
   `docs/README.md` (the coverage row and the claim row). Target numbers: **46 of 210 topics
   (22%), 41 files, phases 0–2 complete, phase 3 next**.
3. ❌ **No clean build after phase 2.** The last verified-clean build was at the end of
   phase 1. Run the isolated build and grep before trusting the link state:
   ```bash
   rm -rf .docusaurus-nginx && DOCUSAURUS_GENERATED_FILES_DIR_NAME=.docusaurus-nginx \
     yarn build --out-dir build-nginx 2>&1 | grep "source page path" \
     | sed 's#.*/devbible/docs/##' | cut -d/ -f1 | sort | uniq -c
   ```
   Link edits for the two new chunked topics **were** made and `grep -rn` reported no stale
   `06-internal-redirects.md` / `07-error-page.md` references, so it is expected to be clean —
   but that is unverified.

⚠️ **The branch `nginx` is still NOT merged into `main`.** Say so at every handoff.

---

### ✅ Phase 2 · How nginx picks a server and a location — 18/18 topics, 13 files (2026-08-15)

`docs/nginx/pages/phase-2-server-and-location/`

| File | Topics | Tier |
|---|---|---|
| `README.md` | index, Coverage, phase gate | — |
| `01-choosing-the-server.md` | 1, 2, 3 | Master |
| `02-default-server.md` | 4, 5, 6 | Understand |
| `03-location-matching/` **(2 chunks)** | 7, 8, 9 | Master |
| `04-named-and-internal.md` | 10, 11, 12 | Understand |
| `05-request-phases.md` | 13, 14 | Understand |
| `06-internal-redirects/` **(2 chunks)** | 15, 16, 18 | Master |
| `07-error-page/` **(2 chunks)** | 17 | Understand |

Chunk names: `03-location-matching/{01-the-algorithm,02-the-asymmetry}` ·
`06-internal-redirects/{01-the-mechanism,02-cycles-and-debugging}` ·
`07-error-page/{01-the-directive,02-with-a-backend}`.

🔴 **Topic 03 was planned as a chunked topic from the start** rather than split after the
fact — the better pattern, now that three phase-1 topics had to be split retroactively.
Topics 06 (306 lines) and 07 (313) still overflowed and were split afterwards.

## 🔴 A rule-8 judgement call made in phase 2 — do not undo it

`05-request-phases.md` carries an explicit **scope note**. The development guide's *Phases*
section (`development_guide.html#http_phases`) **would not retrieve** — the page is large and
WebFetch truncates before it, and three separate attempts plus a site-restricted WebSearch all
failed. Rather than reproduce the `NGX_HTTP_*_PHASE` list from memory (rule 2: never invent),
the page teaches the ordering through behaviours that each have their own documented source,
and says so in the Verified block.

**If a later session can retrieve that section, the page can be deepened — but the current
form is deliberate and correct, not a gap to paper over.**

Verified phase anchors that WERE obtained, and are quoted on the page:

| Fact | Source |
|---|---|
| `ngx_http_core_run_phases()` runs phases **from `NGX_HTTP_POST_READ_PHASE` to `NGX_HTTP_CONTENT_PHASE`**; *"the last phase is intended to generate a response and pass it along the filter chain"* | development_guide.html (the part that did load) |
| *"In a new location, all request processing is repeated starting from `NGX_HTTP_SERVER_REWRITE_PHASE` for **ordinary** locations and from `NGX_HTTP_REWRITE_PHASE` for **named** locations."* | njs/reference.html |
| `js_access` *"sets an njs function as a handler in the **access phase**"* | ngx_http_js_module |
| a variable referenced only in `log_format` *"will not be executed until the **log phase**"* | ngx_http_js_module |

## Facts established while writing phase 2 — reuse, do not re-derive

| Fact | Source |
|---|---|
| Server selection is **two stages**: IP:port from `listen` **first**, then `Host` against `server_name` among the survivors | request_processing.html |
| `server_name` order: exact → longest `*.` leading wildcard → longest `.*` trailing wildcard → **first regex in file order**. Terminates on first match | server_names.html |
| Performance, fastest→slowest: exact, leading wildcard, trailing wildcard, **regex ("slowest and non-scalable", tested sequentially)** | server_names.html |
| Regex `server_name` named captures become variables — `~^(www\.)?(?<domain>.+)$` → `$domain` | server_names.html |
| `server_names_hash_bucket_size` 32/64 by cache line · `server_names_hash_max_size` **512** | server_names.html |
| **The default server is a property of the listen PORT, not of a name**; by default it is the first block for that socket | request_processing.html |
| `_` as a server name is **not special** — *"just one of a myriad of invalid domain names"* | server_names.html |
| `server_name ""` matches requests with no `Host`; **since 0.8.48 `""` is `server_name`'s default** | request_processing.html |
| `ssl_reject_handshake on` is the correct HTTPS default-server behaviour (refuses the handshake instead of leaking a cert for unknown SNI) | ngx_http_ssl_module |
| Location algorithm (verbatim): most specific **prefix** *"regardless of the listed order"* → regexes *"in the order listed"* → *"terminates on the first match"* → else the remembered prefix | request_processing.html |
| Modifiers: `=` exact, terminates immediately · `^~` longest prefix, **skips the regex step** · `~` / `~*` regex · bare prefix · `@name` never URI-matched | ngx_http_core_module |
| **Locations test only the URI, without arguments** | request_processing.html |
| `internal` — reachable only via `error_page`, `index`, `random_index`, `try_files`, `rewrite`, `X-Accel-Redirect`; external requests get **404** | ngx_http_core_module |
| **Named locations cannot be nested and cannot contain nested locations** | ngx_http_core_module |
| 🔴 **"There is a limit of 10 internal redirects per request … If this limit is reached, the error 500 (Internal Server Error) is returned"** — so a cycle is a **500**, not a hang | ngx_http_core_module |
| `error_page` internal redirect changes **the method to `GET`** for anything other than GET/HEAD | ngx_http_core_module |
| `error_page 404 /x;` keeps 404 · `=200` forces 200 · **bare `=` takes the handler's status** · `= @named` **preserves URI and method** | ngx_http_core_module |
| `error_page` to a **URL** sends a real redirect, **302 by default**, changeable only to 301/302/303/307/308 (307 not a redirect before 1.1.16/1.0.13; 308 not before 1.13.0) | ngx_http_core_module |
| `recursive_error_pages` default **off**; *"If uri processing leads to an error, the status code of the last occurred error is returned"* | ngx_http_core_module |
| `msie_refresh` default **off** — recognise it in inherited configs, never enable it | ngx_http_core_module |
| `proxy_intercept_errors` only handles codes that **have an `error_page` defined**; the rest pass through | ngx_http_proxy_module |
| `error_page` is **multi-valued** → the replace-not-merge rule applies (third directive family in this bible where it bites) | ngx_http_core_module |

## Running totals at end of session `21fbf27e`

| | |
|---|---|
| Topics written | **46 of 210 (22%)** |
| Files | **41** |
| Files over the 300-line cap | **0** |
| Topics chunked so far | **6** — phase 1: `03-include-and-files`, `06-map`, `07-if-is-evil` · phase 2: `03-location-matching`, `06-internal-redirects`, `07-error-page` |
| Phases complete | **0, 1, 2** (all of Part 1 · How nginx works, 46/46 topics) |
| Next | **Phase 3 · Serving static files and SPAs (14 topics)** — starts Part 2 |

**Part 1 of the syllabus is now complete.** Phase 3 begins Part 2 (Serving and proxying),
which is the part the track exists for — and Phase 4 (Reverse proxy to Node, **30 topics**,
the largest in the syllabus) is where the 1.29.7 keep-alive fact finally gets used.

### Pattern that has held for three phases — keep it

- Write the topic at the depth it deserves, **then** split at 301 lines on a concept boundary.
  Topics likely to run long (anything Master-tier with 3+ syllabus rows) are better **planned**
  as a chunked directory up front — `03-location-matching` was, and it was cleaner.
- After every chunk split, fix inbound links in **four** places: previous page's `Next →`,
  next page's `← Prev`, the phase README's page table, and its Coverage table. Then
  `grep -rn "NN-topic.md" .` to catch strays — it has caught one every single time.
- Fetch the directive page(s) for a topic **before** writing it, not after. Every page's
  `> Verified:` line names only pages actually read in-session.
