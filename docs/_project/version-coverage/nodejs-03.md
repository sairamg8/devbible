---
name: version-coverage-nodejs-03
description: nodejs version-coverage report, part 3 of 4 — §3 delta for the Node 24 line (23.x semver-majors that reached 24, 24.0 → 24.21), each change graded COVERED / PARTIAL / MISSING / CONTRADICTED / PLANNED
metadata:
  type: project
---
# Node.js — version coverage vs LTS, part 3 · §3 delta (Node 24 line)

Continues [`nodejs-02.md`](./nodejs-02.md) (method, source keys, release policy, Node 22 line).
Changes back-ported to 22.x are **not** repeated here — see rows N01–N86. Rows below first reached
an LTS line on 24 (23.x semver-majors ship on 24; 24.x minors not back-ported to 22).

### 3.2 · Node 24 line (23.0 semver-majors → 24.0.0 → 24.21.0) — current LTS

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| T01 | 23.0 → 24 | Runner: `spec` is the default reporter on **non-TTY** stdout too | default | CONTRADICTED (live) | `01-node-test-runner.md:194` "the default when attached to a TTY" | #54548; TEST24 reporters |
| T02 | 23.0 → 24 | `.only` honoured without `--test-only` when a file runs directly, or with isolation off | default | PARTIAL | `01-node-test-runner.md:156`–`161` "only requires the `--test-only` flag" — true only under `--test` with process isolation | #54881; TEST24 "`only` tests" |
| T03 | 23.0 / 24.0 | Legacy removals: `process.assert`; `--no-experimental-fetch/-global-webcrypto/-global-customevent`; `tls.createSecurePair`; `fs.truncate(fd)`; `OutgoingMessage._headers`; `timers.enroll/unenroll/active`; `crypto.fips` + invalid `existsSync` args deprecated | removed | MISSING | terms `process.assert`, `no-experimental-fetch`, `createSecurePair`, `_headers`, `enroll`, `crypto.fips`, `DEP0187` | #55035 #52611 #52564 #57361 #57567 #57551 #56966 #55019 #55753 |
| T04 | 23.0 → 24 | Negative / NaN timer delay → `TimeoutNegativeWarning`, clamped to 1 ms | default | MISSING | terms `TimeoutNegativeWarning`, `negative delay`; `06-timers.md:43` covers only the >2³¹ overflow | #46678 |
| T05 | 23.0 / 25.0 | Globals `CloseEvent` (23.0) and `ErrorEvent` (25.0) | new | MISSING | terms `CloseEvent`, `ErrorEvent` (javascript track: browser only) | #53355; CL25 25.0.0 |
| T06 | 23.0 runtime → 24.0 removed | `dirent.path` removed → `dirent.parentPath` | removed | PARTIAL | `07-directories.md:25`, `:55`–`61` teach `parentPath`, but say `path` "is deprecated" — it is removed on 24 | #51050 #55548 |
| T07 | 23.0 → 24 | ESM import of CJS exposes a `'module.exports'` export name | new | MISSING | terms `'module.exports'` as an import name | #53848 |
| T08 | 23.1 → 24 | `MockTimers` stable | new | COVERED | `06-async-testing.md:167`–`171`, `:247`; `07-mocking.md:12` | #55398 |
| T09 | 23.5 → 24 | `module.builtinModules` lists prefix-only modules | new | COVERED | `03-node-prefix.md:52`–`59` | #56185 |
| T10 | 23.6 → 24 | `--test-isolation` stable | new | COVERED | `01-node-test-runner.md:115`–`116`, `:170`, `:239` | #56298 |
| T11 | 23.8 → global 24.0 | `URLPattern` | new | PARTIAL | nodejs 0 hits; taught for the browser in `javascript/…/08-history-and-routing/02-building-a-router.md`; the Node global is never stated | #56950 |
| T12 | 24.0 (V8 13.6) | Explicit resource management — `using` / `await using` | new | COVERED | other track: `javascript/…/phase-8-modules-errors/07-throw-try-catch/02-finally.md:148` (core disposables: row N71) | #58154; CL24 24.0.0 |
| T13 | 24.0 (V8 13.6) | `RegExp.escape`, `Error.isError`, `Float16Array` | new | COVERED | other track: `javascript/…/15-regex-syntax/01-characters-and-quantifiers.md`, `…/13-instanceof-and-hasinstance/02-where-it-fails.md`, `…/25-typed-arrays/01-buffers-and-views.md` | CL24 24.0.0 |
| T14 | 24.0 | `AsyncLocalStorage` backed by **AsyncContextFrame**; async_hooks only under `--no-async-context-frame` | default | CONTRADICTED (live) | `20-asynclocalstorage.md:76` "The mechanism underneath is `async_hooks`"; `21-async-hooks.md:13` | #55552; CLI24 `--no-async-context-frame` |
| T15 | 24.0 | `new AsyncLocalStorage({ defaultValue, name })` | new | MISSING | terms `defaultValue`, `new AsyncLocalStorage({` | #57766 |
| T16 | 24.0 | Runner auto-awaits subtests; `test()` / `t.test()` return `undefined` | default | MISSING | terms `await t.test`, `subtest`, `auto-wait` | #56664 |
| T17 | 24.0 | `--test-global-setup` (`globalSetup` / `globalTeardown`) | new | COVERED | `14-runner-flags.md:145`–`154` | #57438 |
| T18 | 24.0 | `url.parse()` runtime-deprecated (DEP0169, application code); `URL.parse` / `canParse` | deprecated | COVERED | `05-url.md:15`, `:130`, `:186`–`205`; `09-xss.md:106` | #55017; DEP |
| T19 | 24.0 | `spawn`/`execFile` args with `shell: true` deprecated (DEP0190) | deprecated | COVERED | `08-injection.md:131`–`145`, `:177`–`178` | #57199 |
| T20 | 24.0 → 25.0 | REPL: multiline history; instantiating without `new` runtime-deprecated (EOL 25.0); 25.9 custom error handling | new | PLANNED | `syllabus/01-foundations.md:33` "The REPL …" (Know), mapped to page 08 by `phase-0-runtime-model/README.md:48`; `08-running-node.md` has no REPL section | #57400 #54869 #59495 #62188 |
| T21 | 24.2 | `util.types.isNativeError` deprecated → `Error.isError` (DEP0197) | deprecated | PARTIAL | `Error.isError` taught in `javascript/…/13-instanceof-and-hasinstance/02-where-it-fails.md`; DEP0197 never named | #58262 |
| T22 | 24.4 · stable 24.13.1 | `crypto.hash()` one-shot; `outputLength` for XOF (SHAKE default length DEP0198, 25.0) | new | MISSING | terms `crypto.hash(`, `outputLength` (the hits are zlib `maxOutputLength`) | #58121 #60994 #59008 |
| T23 | 24.5 / 22.19 | OpenSSL 3.5 bundled | new | COVERED | `01-what-node-is.md:10`, `:50`–`58`; `20-node-crypto.md:9` | #58100 |
| T24 | 24.5 | Web Locks API (`navigator.locks`) | new | MISSING | terms `navigator.locks`, `LockManager` (javascript track: browser) | #58666 |
| T25 | 24.6 | `fs.Utf8Stream` (SonicBoom in core) | new | MISSING | terms `Utf8Stream`, `SonicBoom` (`02-pino-in-practice.md` none) | #58897 |
| T26 | 24.6 → 24.8 · stable 24.19 | Post-quantum `node:crypto`: ML-KEM `encapsulate`/`decapsulate`, ML-DSA, SLH-DSA | new | MISSING | terms `ML-KEM`, `encapsulate`, `post-quantum` | #59259 #59491 #59537 #63924 |
| T27 | 24.7 · stable 24.19 | **`crypto.argon2()` / `argon2Sync()` built in** | new | CONTRADICTED (live) | `01-password-storage.md:50` argon2id "Needs the `argon2` package"; `:58`; `28-bcrypt/README.md:16` "scrypt if you want zero dependencies" | #50353 #63924; crypto.md v24 "added: v24.7.0" |
| T28 | 24.7 → 24.8 | Web Crypto modern algorithms: AES-OCB, ChaCha20-Poly1305, ML-DSA/ML-KEM, SHA-3, SHAKE, KMAC, Argon2, `getPublicKey`, `SubtleCrypto.supports` | new | MISSING | terms `ChaCha20-Poly1305`, `SubtleCrypto.supports`, `getPublicKey` (ChaCha hits are TLS cipher names, `19-https-hsts-cookies.md:22`) | #59365 #59569 #59461 #59539 #59647 #59544 |
| T29 | 24.7 | Root store NSS 3.114 drops old roots (Baltimore, GlobalSign R1, Go Daddy Class 2 …) | security | MISSING | terms `Baltimore`, `NSS`, `root store` | CL24 24.7.0 |
| T30 | 24.7 | `--test-rerun-failures` (state file) | new | COVERED | `14-runner-flags.md:46`–`51`, `:195`; `phase-9-testing/README.md:61` | #59443 |
| T31 | 24.9 → 24.10 | sqlite tagged-template store (`createTagStore`), ERM, `Session` export, `setAuthorizer` | new | MISSING | terms `createTagStore`, `SQLTagStore`, `setAuthorizer` | #58748 #58378 #59928 |
| T32 | 24.10 | `console` per-stream `inspectOptions` | new | MISSING | terms `inspectOptions` | #60082 |
| T33 | 24.12 | http server `optimizeEmptyRequests` | new | MISSING | terms `optimizeEmptyRequests` | #59778 |
| T34 | 24.12 | `util.deprecate(fn, msg, code, { modifyPrototype })` options | new | MISSING | terms `util.deprecate` | #59982 |
| T35 | 24.12 / 25.0 | `--allow-inspector` | new | PARTIAL | only listed in the flag set, `24-permission-model.md:31` | #59711 |
| T36 | 24.12 | `v8.startCpuProfile()` in-process CPU profile | new | MISSING | terms `startCpuProfile`, `v8.startCpu` | #59807 |
| T37 | 24.12 | Portable compile cache | new | MISSING | terms `portable`, `NODE_COMPILE_CACHE_PORTABLE`; `23-startup-time.md` none | #58797 |
| T38 | 24.13 (security) | Permission model: symlink APIs need full read+write, `futimes` disabled; `TLSSocket` default `'error'` handler; async_hooks stack-overflow rethrown | security | MISSING | terms `futimes`, symlink + permission, `TLSSocket` error handler | CL24 24.13.0 (CVE-2025-55130/-55132/-59465/-59466) |
| T39 | 24.13.1 | `--heapsnapshot-near-heap-limit`, `--build-snapshot` marked stable | new | PARTIAL | `--build-snapshot` named `26-single-executable-applications.md:77`, `09-startup-snapshots.md`; `--heapsnapshot-near-heap-limit` absent (`17-memory-leaks.md` uses `writeHeapSnapshot`) | #60956 #60954 |
| T40 | 24.14 | `async_hooks.createHook({ trackPromises })` | new | MISSING | terms `trackPromises` | #61415 |
| T41 | 24.14 | `events.listenerCount()` accepts `EventTarget` | new | MISSING | terms `listenerCount` | #60214 |
| T42 | 24.14 | `fs.watch` `ignore` option | new | MISSING | terms `ignore:` in `12-watching.md` | #61433 |
| T43 | 24.14 | Subpath imports may start with `"#/"` | new | PARTIAL | `imports` field taught `08-exports-map.md:175`; the `#/` form absent | #60864 |
| T44 | 24.14 | `node:sqlite` defensive mode on by default | default | COVERED | `12-node-sqlite.md:130`–`150`, `:229`, `:270` | #61266 |
| T45 | 24.14 | `stream/consumers` `bytes()` | new | PARTIAL | `02-request-bodies.md:116`–`117` lists text/json/buffer/arrayBuffer/blob — not `bytes` | #60426 |
| T46 | 24.14 | Runner `run({ env })`; `expectFailure` | new | MISSING | terms `expectFailure`, `run({` | #61367 #60669 |
| T47 | 24.14 | `util.convertProcessSignalToExitCode()` | new | PARTIAL | 128 + signal taught (143/137) in `16-signals.md`; the util absent | #60963 |
| T48 | 24.15 | `--max-heap-size` | new | MISSING | terms `max-heap-size`; `03-v8-flags.md:19` shows only `--max-old-space-size` | #58708 |
| T49 | 24.15 | `--require-module` / `--no-require-module` | new | MISSING | terms `require-module` | #60959 |
| T50 | 24.15 / 26.0 | `KeyObject` raw formats (`raw-public` / `raw-private` / `raw-seed`) | new | MISSING | terms `raw-public`, `raw-seed` | #62240 |
| T51 | 24.15 → 24.16 | `fs.stat` `throwIfNoEntry` (async) and `signal`; `statfs.frsize` | new | PARTIAL | catch-`ENOENT` shape taught `08-stat-and-existence.md:23`, `:105`–`115`; new options absent | #61178 #57775 #62277 |
| T52 | 24.15 | `http2` `http1Options`; `socket.setTOS()` / `getTOS()` | new | MISSING | terms `http1Options`, `setTOS` | #61713 #61503 |
| T53 | 24.15 | `node:sqlite` → Release Candidate; `db.limits` | new | PARTIAL | `12-node-sqlite.md:9`–`10` "no flag … no experimental warning"; RC status and `limits` unnamed | #61262 #61298 |
| T54 | 24.15 → 26.0 runtime | `Duplex.toWeb({ type })` → `readableType` (DEP0201) | deprecated | MISSING | terms `readableType`; `15-web-streams.md:108`–`123` calls `toWeb` without options | #61632 #62173 |
| T55 | 24.15 | `mock.module({ exports })`; `namedExports` / `defaultExport` deprecated | deprecated | COVERED | `08-module-mocking.md:19`, `:57`, `:81`, `:94`–`97` | #61727 |
| T56 | 24.15 | Runner worker ID for concurrent files | new | PLANNED | `syllabus/03-application.md:146` "per-worker IDs"; no page | #61394 |
| T57 | 24.15 | Runner reports the interrupted test on SIGINT | new | MISSING | terms `interrupted`, SIGINT in phase 9 | #61676 |
| T58 | 24.16 | `crypto.randomUUIDv7()` | new | MISSING | terms `randomUUIDv7`, `UUIDv7` (`20-node-crypto.md` teaches v4 `randomUUID`) | #62553 |
| T59 | 24.16 | `node inspect` edit-free runtime probes | new | MISSING | terms `node inspect`, `probe` (hits are health probes) | #62713 |
| T60 | 24.16 | `IncomingMessage` `req.signal` (aborts when the client leaves) | new | PARTIAL | used, never introduced: `phase-5-http-processes/README.md:101`, `06-outbound-timeouts.md:60` — `undefined` before 24.16 | #62541 |
| T61 | 24.16 | `--test-randomize` / `--test-random-seed` | new | COVERED | `14-runner-flags.md:16`–`40`, `:213`–`215` | #61747 |
| T62 | 24.16 | Mock timers cover `AbortSignal.timeout`; aligned timeout API | new | MISSING | terms `AbortSignal.timeout` + `mock.timers` | #60751 #62820 |
| T63 | 24.18 | `Buffer.poolSize` 8 KiB → **64 KiB** | default | COVERED | `03-alloc-vs-allocunsafe.md:95`–`115` ("65536 in Node 24") | #63597 |
| T64 | 24.18 | `res.writeInformation()` for any 1xx (and `writeEarlyHints`) | new | MISSING | terms `writeInformation`, `writeEarlyHints`, `103 Early` | #63155 |
| T65 | 24.18 | `crypto.diffieHellman()` takes key data; TurboSHAKE, KangarooTwelve | new | MISSING | terms `diffieHellman`, `TurboSHAKE` | #62527 #62183 |
| T66 | 24.18.1 (security) | http rejects requests over the header-count limit; permission covers trace events / report path | security | MISSING | terms `maxHeadersCount`, `header count` | CL24 24.18.1 (CVE-2026-58044/-56847/-58039) |
| T67 | 24.19 | Runner test **tags** + `--experimental-test-tag-filter` | new | COVERED | `14-runner-flags.md:104`–`107`; `01-node-test-runner.md:184` | #63221 |
| T68 | 24.19 | **`stream.compose` stable** | new | CONTRADICTED (live) | `18-stream-promises-and-compose.md:141` "`compose` is **Stability 1 – Experimental** in the Node 24 docs"; `:217`, `:231` | #62562; stream.md v24 "v24.19.0 Marking the API stable" |
| T69 | 24.19 | `ReadableStreamTee` exposed; `Blob.textStream()` | new | MISSING | terms `ReadableStreamTee`, `textStream` | #64195 #64036 |
| T70 | 24.19 | `--experimental-import-text` | new | MISSING | terms `import-text`, `type: 'text'` | #62300 |
| T71 | 24.19 | `fs.readFile` into a caller buffer; http `httpValidation` | new | MISSING | terms `httpValidation`, `readFile(` + `buffer:` | #63634 #61597 |
| T72 | 24.19 | `setKeepAlive` `TCP_KEEPINTVL` / `TCP_KEEPCNT` | new | PARTIAL | `12-net-and-dgram.md:88`, `:151` — `setKeepAlive(true, ms)` only | #63825 |
| T73 | 24.19 | TLS `certificateCompression`; negotiated group reporting | new | MISSING | terms `certificateCompression`, `negotiated group` | #62217 #64119 |
| T74 | 24.2 → 24.21 | perf_hooks: disposable ELD histogram, per-iteration sampling, histogram statistics | new | PARTIAL | `monitorEventLoopDelay` taught `03-blocking-the-event-loop.md:94`–`96`, `09-event-loop-lag.md:18`–`60`; new histogram features absent | #58384 #62935 #65416 |
| T75 | 24.20 | `AsyncLocalStorage` `using` scopes | new | MISSING | terms `withScope`, `using` + ALS | #61674 |
| T76 | 24.20 | `Buffer` search methods take an `end` parameter | new | MISSING | terms `indexOf(` + `end` | #62390 |
| T77 | 24.20 / 26.3 | **`process.permission.drop()`** — shed granted permissions at runtime | new | CONTRADICTED (live) | `24-permission-model.md:193` "there is no runtime API on Node 24, verified" | #62672; PERM24 "Dropping a permission" |
| T78 | 24.20 / 26.4 | Package maps (loader) | new | MISSING | terms `package map`, `packageMap` | #62239 |
| T79 | 24.20 | `--permission-audit` (log, do not deny) | new | MISSING | terms `permission-audit`, `audit mode` | #61869 |
| T80 | 24.20 | `node:stream/iter` iterator-first stream API | new | MISSING | terms `stream/iter`; `18-stream-promises-and-compose.md:166`–`169` maps the syllabus's "Iterable Streams API" to the `Readable` helpers | #62066 |
| T81 | 24.20 | Runner `t.log()` + `test:log` event; `entryFile` in events | new | MISSING | terms `t.log(`, `test:log` | #64389 #64309 |
| T82 | 24.20 / 25.0 | WebAssembly JSPI enabled | new | MISSING | terms `JSPI`, `WebAssembly.promising` | #59941 |
| T83 | 24.21 | Private keys through OpenSSL STORE loaders | new | MISSING | terms `STORE loader` | #63949 |
| T84 | 24.21 | `util.MIMEType.parse()` (non-throwing) | new | MISSING | terms `MIMEType` | #64965 |

Two 24.0 bundling changes are graded with their tools in part 4: **npm 11** (row P01) and
**undici 7** (rows U01–U09).
