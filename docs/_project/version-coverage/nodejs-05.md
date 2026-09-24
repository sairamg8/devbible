---
name: version-coverage-nodejs-05
description: nodejs version-coverage report, part 5 — §4 summary by LTS line (22 / 24 / 26 + npm + undici) and §5 hand-off to the nodejs lane (16 CONTRADICTED rows, 143 MISSING rows with tier and the existing page each sits beside, pins.js corrections)
metadata:
  type: project
---
# Node.js — version coverage vs LTS, part 5 · §4 summary · §5 hand-off

Rows are defined in [`nodejs-02.md`](./nodejs-02.md) (M, N), [`nodejs-03.md`](./nodejs-03.md) (T)
and [`nodejs-04.md`](./nodejs-04.md) (S, P, U). Baseline and stale-claim list: [`nodejs.md`](./nodejs.md).

## 4 · Summary by LTS line

| Line | Changes | COVERED | PARTIAL | MISSING | CONTRADICTED | PLANNED | Verdict |
|---|---|---|---|---|---|---|---|
| Release policy (M) | 5 | 2 | 0 | 0 | 3 (live) | 0 | The v27 model is taught; the page gets Active LTS (not frozen), maintenance length (18 mo), total life (36 mo) and 24's maintenance date (10-20) wrong |
| **22 LTS** (Maintenance; N) | 86 | 22 | 18 | 45 | 1 (live) | 0 | **Headlines complete, long tail thin**: all 22.0 headlines but `fs.glob` taught; 45 minors (22.2–22.21) missing — styleText, zstd, BlockList, built-in proxy, registerHooks, config file |
| **24 LTS** (Active; T) | 84 | 15 | 14 | 48 | 5 (live) | 2 | **Taught through 24.19, broken in 5 places**: ALS mechanism, argon2, compose stability, reporter default and `permission.drop` are stated wrong on the target; 48 missing, 12 of them the whole 24.20/24.21 minors |
| **26** (Current → LTS 2026-10-28; S) | 46 | 1 | 10 | 28 | 6 (5 latent, 1 live) | 1 | **Essentially unwritten**: only TracingChannel is taught; Temporal/`--allow-net`/undici-8 fetch appear only as "not on 24"; 5 pages will be wrong the day the pin moves |
| npm 11 (bundled with 24/26; P01–P13, P21) | 14 | 3 | 4 | 6 | 1 (live) | 0 | Supply-chain side strong (allowScripts, min-release-age, provenance); which npm Node ships is stated wrong |
| npm 12 (standalone; P14–P20) | 7 | 0 | 0 | 7 | 0 | 0 | The pin is npm 12, yet none of its 13 breaking changes except the install-script default (P12) is taught |
| undici 7 (bundled with 24; U01–U09) | 9 | 1 | 1 | 7 | 0 | 0 | Dispatcher/pool tuning taught; the interceptor model (compose, cache, retry, dns) absent |
| undici 8 (bundled with 26; U10–U13) | 4 | 0 | 2 | 2 | 0 | 0 | h2-by-default shown by measurement, never explained |
| **All** | **255** | **44** | **49** | **143** | **16** (11 live · 5 latent) | **3** | Applies up to **24.19.0**; complete for no line; 22 headlines ✓, 24 through .19 partial, 26 absent |

One sentence: **complete for the 22 LTS headlines but not its minors (45 missing); 48 missing and 5
contradicted on 24 LTS; 28 missing and 6 contradicted toward 26 LTS.**

## 5 · Hand-off to the owning lane (`nodejs`)

Tiers use the corpus labels (Master · Understand · Know · When Needed). A CONTRADICTED row keeps the
tier of the page it sits on (first `db-tier` badge, read this session). "Sits beside" paths are
under `docs/nodejs/pages/` unless marked, and each was `ls`-verified on 2026-09-24.

### 5.1 · CONTRADICTED — fix first (a live page teaches the wrong thing)

| # | Page (tier) | Wrong now | The fix |
|---|---|---|---|
| T27 | `phase-8-security/01-password-storage.md:50`, `:58` (Master); `28-bcrypt/README.md:16` (Understand) | argon2id "Needs the `argon2` package" | `crypto.argon2()` / `argon2Sync()` are core since 24.7.0, stable 24.19.0 — argon2id is now the zero-dependency answer |
| T01 | `phase-9-testing/01-node-test-runner.md:194` (Master) | spec is default "when attached to a TTY" | spec is the default everywhere since 23.0.0 |
| P01 | `phase-1-modules/10-npm-day-to-day.md:9`, `07-package-json.md:9` (Master); `phase-0-runtime-model/07-choosing-a-version.md:121` (Understand) | npm 12.0.2 is "the version bundled with Node 24.19.0" | 24.19.0 bundles npm 11.17.0 (24.21.0 → 11.19.0); npm 12 is a separate install on every line |
| T14 | `phase-2-async/20-asynclocalstorage.md:76` (Understand); `21-async-hooks.md:13` (When Needed) | ALS runs on `async_hooks` | ALS runs on AsyncContextFrame since 24.0.0; async_hooks is the `--no-async-context-frame` fallback |
| M2 | `phase-0-runtime-model/07-choosing-a-version.md:22`, `:163`, `:184` (Understand) | Active LTS has a "frozen feature set" | Active LTS receives audited semver-minors (24.12→24.21 prove it) |
| M3 | same page `:23`, `:26`, `:164` | Maintenance ~12 mo; life 30 mo from release | Maintenance 18 mo; 36 mo from first release (30 from LTS start) |
| M4 | same page `:35`; `docs/nodejs/README.md:18` | 24 Maintenance from 28 Oct 2026 | 2026-10-20 |
| T68 | `phase-3-buffers-streams/18-stream-promises-and-compose.md:141`, `:217`, `:231` (Know) | `compose` is "Stability 1 – Experimental in the Node 24 docs" | Marked stable in 24.19.0 — the verified version itself |
| T77 | `phase-8-security/24-permission-model.md:193` (Know) | "no runtime API on Node 24, verified" | `process.permission.drop()` since 24.20.0 (narrowing only — re-granting is still impossible) |
| N74 | same page `:64`, `:153`, `:180` | the child runs "with no permission model at all" | Since 24.4.0 spawned/forked **Node** children inherit the flags via `NODE_OPTIONS`; only non-Node children are unrestricted |
| S24 | `phase-1-modules/14-node-module-api.md:57`–`99` (When Needed); `syllabus/01-foundations.md:63`; `phase-1-modules/README.md:57` | `module.register()` is *the* hooks API | Doc-deprecated 24.15.0, runtime-deprecated 26.0.0 (DEP0205) → teach `module.registerHooks()` (row N59) |
| S06 | `phase-1-modules/11-package-managers.md:51`, `:63`, `:75` (Know) — latent | "Node ships Corepack" | Only through 24.x; not distributed from 25.0.0 |
| S20 | `phase-5-http-processes/26-single-executable-applications.md:20`, `:84`, `:123` (When Needed) — latent | ESM entry "not supported yet" | Supported from 25.7.0; `--build-sea` from 25.5.0 |
| S25 | `phase-1-modules/12-typescript-natively.md:90`–`96`, `:186` (Understand) — latent | `--experimental-transform-types` "works" | Removed in 26.0.0 — say so, keep the erasable-syntax advice |
| S32 | `phase-12-native/06-ffi.md:9` (When Needed) — latent | "FFI is package-mediated on Node" | `node:ffi` since 26.1.0, on by default 26.9.0 |
| S10 | `phase-4-filesystem/09-file-handles.md:199` (Understand) — latent | symptom is a GC "Warning" | On 25+ closing a `FileHandle` on GC throws (DEP0137 EOL) |

Also fix the stale lines in §2c that are not rows: C1 (`README.md:7`, `:17` 26.7.0), C18 (syllabus
flag names), C19 (`13-dns.md` pre-20 IPv6 trap — pairs with S19), C21 (`15-web-streams.md:95`).

### 5.2 · MISSING — Node 22 line (oldest LTS)

| # | Tier | Sits beside | # | Tier | Sits beside |
|---|---|---|---|---|---|
| N03 | Know | `phase-1-modules/08-exports-map.md` | N50 | Understand | `phase-8-security/12-ssrf.md` |
| N10 | Know | `phase-5-http-processes/22-parseargs.md` | N55 | When Needed | `phase-5-http-processes/15-process.md` |
| N11 | When Needed | `phase-10-observability/17-memory-leaks.md` | N56 | Know | `phase-9-testing/15-snapshot-testing.md` |
| N12 | When Needed | `phase-2-async/13-callbacks-and-promisify.md` | N58 | Know | `phase-11-deployment/04-pid1-and-signals.md` |
| N16 | Know | `phase-10-observability/19-cpu-heap-profiling.md` | N59 | When Needed | `phase-1-modules/14-node-module-api.md` (replaces S24's `register()`) |
| N17 | When Needed | `phase-8-security/24-permission-model.md` | N60 | When Needed | `phase-5-http-processes/19-child-process.md` |
| N18 | Know | `phase-9-testing/06-async-testing.md` | N61 | Know | `phase-3-buffers-streams/16-zlib.md` |
| N19 | When Needed | `phase-3-buffers-streams/16-zlib.md` | N63 | When Needed | `phase-9-testing/02-node-assert.md` |
| N22 | Know | `phase-1-modules/03-node-prefix.md` | N65 | Know | `phase-0-runtime-model/08-running-node.md` |
| N24 | When Needed | `phase-3-buffers-streams/15-web-streams.md` | N67 | When Needed | `phase-10-observability/19-cpu-heap-profiling.md` |
| N27 | Know | `phase-4-filesystem/03-path.md` | N68 | When Needed | `phase-5-http-processes/14-http2.md` |
| N28 | When Needed | `phase-5-http-processes/24-worker-threads.md` | N69 | When Needed | `phase-5-http-processes/01-http-server.md` |
| N30 | Know | `phase-10-observability/19-cpu-heap-profiling.md` | N70 | Know | `phase-8-security/08-injection.md` |
| N31 | When Needed | `phase-1-modules/01-esm.md` | N72 | Know | `phase-8-security/24-permission-model.md` |
| N32 | When Needed | `phase-3-buffers-streams/08-stream-types.md` | N75 | Know | `phase-0-runtime-model/08-running-node.md` |
| N37 | Know | `phase-10-observability/09-event-loop-lag.md` | N76 | Know | `phase-10-observability/13-process-metrics.md` |
| N38 | When Needed | `phase-12-native/01-node-vm.md` | N79 | When Needed | `phase-5-http-processes/13-dns.md` |
| N39 | Know | `phase-10-observability/06-error-tracking.md` | N80 | When Needed | `phase-5-http-processes/26-single-executable-applications.md` |
| N41 | When Needed | `phase-3-buffers-streams/16-zlib.md` | N82 | Know | `phase-9-testing/07-mocking.md` |
| N42 | Know | `phase-1-modules/04-cjs-esm-interop.md` | N83 | **Understand** | `phase-5-http-processes/08-outbound-client-discipline.md` |
| N43 | When Needed | `phase-8-security/25-web-crypto.md` | N84 | Know | `phase-5-http-processes/11-websockets.md` |
| N44 | Know | `phase-9-testing/14-runner-flags.md` | N45 | When Needed | `phase-3-buffers-streams/04-buffer-as-uint8array.md` |
| N49 | Know | `phase-8-security/18-secrets.md` | | | |

### 5.3 · MISSING — Node 24 line (current LTS)

| # | Tier | Sits beside | # | Tier | Sits beside |
|---|---|---|---|---|---|
| T03 | Know | `phase-0-runtime-model/07-choosing-a-version.md` | T50 | When Needed | `phase-8-security/26-encryption-and-keys.md` |
| T04 | Know | `phase-2-async/06-timers.md` | T52 | When Needed | `phase-5-http-processes/14-http2.md` |
| T05 | When Needed | `phase-0-runtime-model/06-globals.md` | T54 | When Needed | `phase-3-buffers-streams/15-web-streams.md` |
| T07 | Know | `phase-1-modules/04-cjs-esm-interop.md` | T57 | When Needed | `phase-9-testing/14-runner-flags.md` |
| T15 | Know | `phase-2-async/20-asynclocalstorage.md` | T58 | **Understand** | `phase-8-security/20-node-crypto.md` |
| T16 | **Understand** | `phase-9-testing/06-async-testing.md` | T59 | When Needed | `phase-10-observability/15-finding-the-bottleneck.md` |
| T22 | **Understand** | `phase-8-security/20-node-crypto.md` | T62 | Know | `phase-9-testing/06-async-testing.md` |
| T24 | When Needed | `phase-5-http-processes/25-shared-memory.md` | T64 | Know | `phase-5-http-processes/03-http-fundamentals.md` |
| T25 | When Needed | `phase-10-observability/02-pino-in-practice.md` | T65 | When Needed | `phase-8-security/20-node-crypto.md` |
| T26 | Know | `phase-8-security/26-encryption-and-keys.md` | T66 | Know | `phase-5-http-processes/01-http-server.md` |
| T28 | Know | `phase-8-security/25-web-crypto.md` | T69 | When Needed | `phase-3-buffers-streams/15-web-streams.md` |
| T29 | Know | `phase-5-http-processes/09-https-and-tls.md` | T70 | Know | `phase-1-modules/04-cjs-esm-interop.md` |
| T31 | Know | `phase-6-data-access/12-node-sqlite.md` | T71 | When Needed | `phase-4-filesystem/01-fs-promises.md` |
| T32 | When Needed | `phase-10-observability/01-structured-logging.md` | T73 | When Needed | `phase-5-http-processes/09-https-and-tls.md` |
| T33 | When Needed | `phase-5-http-processes/01-http-server.md` | T75 | Know | `phase-2-async/20-asynclocalstorage.md` |
| T34 | When Needed | `phase-1-modules/13-publishing.md` | T76 | When Needed | `phase-3-buffers-streams/01-buffer-basics.md` |
| T36 | Know | `phase-10-observability/19-cpu-heap-profiling.md` | T78 | Know | `phase-1-modules/05-module-resolution.md` |
| T37 | When Needed | `phase-10-observability/23-startup-time.md` | T79 | Know | `phase-8-security/24-permission-model.md` |
| T38 | Know | `phase-8-security/24-permission-model.md` | T80 | Know | `phase-3-buffers-streams/18-stream-promises-and-compose.md` |
| T40 | When Needed | `phase-2-async/21-async-hooks.md` | T81 | Know | `phase-9-testing/01-node-test-runner.md` |
| T41 | When Needed | `phase-10-observability/18-common-leak-sources.md` | T82 | When Needed | `phase-12-native/02-webassembly.md` |
| T42 | Know | `phase-4-filesystem/12-watching.md` | T83 | When Needed | `phase-8-security/26-encryption-and-keys.md` |
| T46 | Know | `phase-9-testing/14-runner-flags.md` | T84 | When Needed | `phase-5-http-processes/02-request-bodies.md` |
| T48 | Know | `phase-12-native/03-v8-flags.md` | T49 | Know | `phase-1-modules/04-cjs-esm-interop.md` |

### 5.4 · MISSING — Node 26 line (next LTS)

| # | Tier | Sits beside | # | Tier | Sits beside |
|---|---|---|---|---|---|
| S02 | Know | `docs/javascript/pages/phase-5-built-in-library/10-map-vs-object/`, `…/phase-6-iteration-and-destructuring/11-iterator-helpers/` (javascript lane) | S29 | When Needed | `phase-8-security/26-encryption-and-keys.md` |
| S05 | Know | `phase-0-runtime-model/05-node-vs-browser.md` | S30 | When Needed | `phase-3-buffers-streams/12-stream-events-and-modes.md` |
| S07 | When Needed | `phase-3-buffers-streams/03-alloc-vs-allocunsafe.md` | S31 | When Needed | `phase-5-http-processes/11-websockets.md` |
| S12 | When Needed | `phase-2-async/15-unhandled-rejections.md` | S34 | Know | `phase-9-testing/11-coverage.md` |
| S14 | When Needed | `phase-8-security/20-node-crypto.md` | S36 | When Needed | `phase-4-filesystem/08-stat-and-existence.md` |
| S15 | When Needed | `phase-0-runtime-model/07-choosing-a-version.md` | S37 | When Needed | `phase-8-security/26-encryption-and-keys.md` |
| S16 | When Needed | `phase-1-modules/03-node-prefix.md` | S39 | Know | `phase-6-data-access/12-node-sqlite.md` |
| S17 | Know | `phase-9-testing/02-node-assert.md` | S40 | Know | `phase-3-buffers-streams/16-zlib.md` |
| S18 | When Needed | `phase-10-observability/01-structured-logging.md` | S41 | Know | `phase-10-observability/20-benchmarking.md` |
| S19 | **Understand** | `phase-5-http-processes/13-dns.md` (also fixes C19) | S42 | When Needed | `phase-5-http-processes/12-net-and-dgram.md` |
| S23 | When Needed | `phase-8-security/25-web-crypto.md` | S43 | Know | `phase-5-http-processes/24-worker-threads.md` |
| S26 | When Needed | `phase-9-testing/02-node-assert.md` | S44 | Know | `phase-2-async/14-concurrency-control.md` |
| S27 | Know | `phase-1-modules/05-module-resolution.md` | S45 | When Needed | `phase-4-filesystem/09-file-handles.md` |
| S28 | When Needed | `phase-0-runtime-model/06-globals.md` | S46 | When Needed | `phase-5-http-processes/12-net-and-dgram.md` |

### 5.5 · MISSING — npm and undici

| # | Tier | Sits beside | # | Tier | Sits beside |
|---|---|---|---|---|---|
| P04 | Know | `phase-1-modules/07-package-json.md` | P20 | Know | `phase-1-modules/10-npm-day-to-day.md` |
| P07 | When Needed | `phase-1-modules/10-npm-day-to-day.md` | P21 | When Needed | `phase-1-modules/07-package-json.md` |
| P08 | **Understand** | `phase-8-security/23-supply-chain.md` | U02 | When Needed | `phase-5-http-processes/05-fetch.md` |
| P11 | Know | `phase-1-modules/13-publishing.md` | U03 | Know | `phase-5-http-processes/08-outbound-client-discipline.md` |
| P13 | Know | `phase-1-modules/11-package-managers.md` | U04 | Know | `phase-10-observability/16-caching-strategy.md` |
| P14 | **Understand** | `phase-1-modules/10-npm-day-to-day.md` | U05 | **Understand** | `phase-5-http-processes/08-outbound-client-discipline.md` |
| P15 | Know | `phase-1-modules/09-semver-and-lockfiles.md` | U07 | Know | `phase-5-http-processes/08-outbound-client-discipline.md` |
| P16 | When Needed | `phase-1-modules/13-publishing.md` | U08 | Know | `phase-9-testing/07-mocking.md` |
| P17 | When Needed | `phase-1-modules/10-npm-day-to-day.md` | U09 | When Needed | `phase-5-http-processes/05-fetch.md` |
| P18 | When Needed | `phase-1-modules/07-package-json.md` | U11 | When Needed | `phase-5-http-processes/07-keep-alive-and-agents.md` |
| P19 | Know | `phase-1-modules/11-package-managers.md` | U13 | When Needed | `phase-5-http-processes/14-http2.md` |

PARTIAL rows (49) extend the page already cited in their Evidence cell: N08 N13 N14 N23 N25 N46
N51 N52 N54 N57 N62 N64 N71 N73 N77 N78 N81 N85 · T02 T06 T11 T21 T35 T39 T43 T45 T47 T51 T53 T60
T72 T74 · S01 S03 S04 S08 S09 S11 S13 S21 S22 S33 · P03 P05 P06 P10 · U01 U10 U12.
PLANNED (3): T20 and S38 (REPL — `syllabus/01-foundations.md:33`), T56 (worker IDs —
`syllabus/03-application.md:146`).

### 5.6 · `src/data/pins.js` — proposed corrections (report only, not edited)

1. **node** — `pin: '24.19.0'` vs latest 24.21.0 is **minor** drift, not patch: 24.20.0 and
   24.21.0 are semver-minor releases (permission.drop, `--permission-audit`, package maps,
   `node:stream/iter`, STORE loaders, `MIMEType.parse`) and 24.20 already falsifies
   `24-permission-model.md:193`. Fix T77 first, then bump to 24.21.0 and `checked` to the bump date.
   Add to the `note` that **24 enters Maintenance on 2026-10-20** (RWG schedule.json), eight days
   before 26's promotion; the cycle flip to 26 on 2026-10-28 stands.
2. **npm** — `pin: '12.0.2'` is a standalone install; no Node line bundles npm 12 (22 → 10.9.9,
   24 → 11.19.0, 26 → 11.19.1; DIST). Either record the bundled line (e.g. a `bundled: {22, 24,
   26}` note) or keep 12 as the teaching target and state it on the pages; latest is **12.1.0**
   (minor). npm 12 needs Node `^22.22.2 || ^24.15.0 || >=26.0.0` — worth a `note`.
3. **undici** — `pin: '8.10.0'` is the npm package; Node 24's built-in `fetch` runs **7.29.1**,
   Node 26's runs **8.10.2**. Record that split in `note`; latest is **8.11.0** (minor).
4. **drift label** — `static/currency.json` (generated 2026-09-24) already classes node as
   `drift: 'minor'`, correctly; the audit brief that dispatched this unit called it "patch". No
   tool change needed — but the lane should treat node as a minor bump (a re-read of the pages
   that 24.20/24.21 touch), not a stamp-only patch sweep.
