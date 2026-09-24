---
name: version-coverage-nodejs-02
description: nodejs version-coverage report, part 2 of 4 — §3 delta table, release-policy rows and the Node 22 line (22.0 → 22.23), each change graded COVERED / PARTIAL / MISSING / CONTRADICTED / PLANNED
metadata:
  type: project
---
# Node.js — version coverage vs LTS, part 2 · §3 delta (release policy + Node 22 line)

Continues [`nodejs.md`](./nodejs.md) (§1 release lines, §2 baseline). §3 runs across this file,
[`nodejs-03.md`](./nodejs-03.md) (Node 24 line) and [`nodejs-04.md`](./nodejs-04.md) (25/26 line,
npm, undici). §4–§5 are in [`nodejs-05.md`](./nodejs-05.md).

## 3 · The delta table

**Scope.** Every teachable change from the oldest supported LTS (22.0.0) through the current LTS
(24.21.0), then through latest stable (26.10.0). Pure bug fixes, build/platform changes, V8
internals and embedder C++ APIs are skipped; security releases appear only where they change
what a developer writes or relies on. A change back-ported to 22.x is listed **once, under 22**,
with both versions in *Since* (e.g. `22.19 / 24.5`).

**Grading.** Every row was grepped case-insensitively over `docs/nodejs/` with ≥2 terms; when a
row is taught in another track, Evidence says so and the grade follows that page.
*CONTRADICTED* = a page states the old shape as current. Two flavours are marked:
**live** — false on the corpus's own target (24.19.0 / current 24.21.0);
**latent** — true on 24, false on 26, and the sentence is not scoped to 24 (it becomes live when
the pin moves to 26 on 2026-10-28). A sentence explicitly scoped to "Node 24" that is silent about
26 is graded PARTIAL, not CONTRADICTED.

**Source keys** (all fetched 2026-09-24): `CL22`…`CL26` =
`raw.githubusercontent.com/nodejs/node/main/doc/changelogs/CHANGELOG_V22.md` … `_V26.md`;
`#N` = `github.com/nodejs/node/pull/N` as listed in those changelogs; `ANN22` =
nodejs.org `v22-release-announce.md`; `DEP` = `nodejs/node` `doc/api/deprecations.md` (main);
`CLI24` / `TEST24` / `NET24` / `PERM24` / `ACTX24` = `nodejs/node` `v24.x` branch
`doc/api/cli.md` / `test.md` / `net.md` / `permissions.md` / `async_context.md`; `RWG` =
`nodejs/Release` README + `schedule.json`; `BLOG27` = nodejs.org "Evolving the Node.js Release
Schedule" (2026-03-10).

### 3.0 · Release policy (what the version page teaches)

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| M1 | 27.x (announced 2026-03-10) | One major a year (April), every line LTS, Alpha channel Oct–Mar; 27 Alpha opens 2026-10-28 | new | COVERED | `07-choosing-a-version.md:50`–`67`; `README.md:20`–`26` | BLOG27; RWG schedule.json |
| M2 | policy | Active LTS takes audited semver-minor **features** — it is not frozen | default | CONTRADICTED (live) | `07-choosing-a-version.md:22` "Frozen feature set"; `:163`; `:184` — while 24.12→24.21 shipped ~90 minors (§3 part 3) | RWG "Release Phases" |
| M3 | policy | Maintenance lasts **18** months; a line lives **36** months from first release | default | CONTRADICTED (live) | `07-choosing-a-version.md:23` "~12 months"; `:26` "30 months from first release"; `:164` | RWG "Release Plan"; endoflife.date 24.x 2025-05-06→2028-04-30 |
| M4 | schedule | 24.x Maintenance LTS begins **2026-10-20** | default | CONTRADICTED (live) | `07-choosing-a-version.md:35`, `README.md:18` "Maintenance LTS from 28 Oct 2026" | RWG schedule.json |
| M5 | 26 LTS | 26.x Active LTS 2026-10-28; EOL 2029-04-30 | new | COVERED | `07-choosing-a-version.md:34`, `:41`–`48`; `phase-0-runtime-model/README.md:9` | RWG; endoflife.date |

### 3.1 · Node 22 line (22.0.0 → 22.23.3) — oldest supported LTS

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| N01 | 22.0 | V8 12.4 language: `Array.fromAsync`, Set methods, iterator helpers | new | COVERED | other track: `javascript/…/phase-5-built-in-library/17-set.md`, `…/phase-6-…/11-iterator-helpers/01-the-helper-set.md`, `…/22-array-likes-and-iterables/02-converting-correctly.md` | ANN22 |
| N02 | 22.0 flag → 22.12 default → 24.15 stable | `require()` of synchronous ESM graphs; `ERR_REQUIRE_ASYNC_MODULE` | new | COVERED | `04-cjs-esm-interop.md:10`–`11`, `:124`, `:203`–`229`; `13-publishing.md:195` | #51977 #55085 #60959 |
| N03 | 22.10 / 23.0 | `"module-sync"` exports condition | new | MISSING | terms `module-sync`, `"module-sync"`; the condition table `08-exports-map.md:106` omits it | #54648 |
| N04 | 22.0 · stable 22.10 | `node --run <script>` (no pre/post, `NODE_RUN_*` env, walks parents 22.3) | new | COVERED | `07-package-json.md:101`–`104`; `08-running-node.md:148`–`151` (env vars not named) | #52190 #53763 #53154 |
| N05 | 22.0 | Stream default `highWaterMark` 16 KiB → 64 KiB; `setDefaultHighWaterMark` | default | COVERED | `19-highwatermark-tuning.md:19`–`37`; `09-backpressure.md:20`; `07-why-streams.md:145` | #52037; ANN22 |
| N06 | 22.0 | Watch mode (`--watch`, `--watch-path`) stable | new | COVERED | `08-running-node.md:43` ("`--watch` — nodemon, built in") | #52074 |
| N07 | 22.0 · stable 22.4 | Global `WebSocket` client | new | COVERED | `11-websockets.md:12`, `:75`, `:168` | #51594 #53352 |
| N08 | 22.0 · stable 22.17 / 24.1 | `fs.glob` / `globSync` / `fsPromises.glob` (`exclude` globs 22.14) | new | PARTIAL | named once as a fix, `20-shell-injection.md:131`; no page shows the API (`07-directories.md` teaches `readdir` recursive only) | #51912 #58236 #56489 |
| N09 | 22.0 drop · 22.12 stable | `assert {type}` removed → import attributes `with {type:'json'}` | removed | COVERED | `04-cjs-esm-interop.md:176`, `:213`–`215`, `:250` | #52104 #55333 |
| N10 | 22.0 · stable 22.13 | `util.styleText()` (formats array; `'none'` 24.2; hex 24.16) | new | MISSING | terms `styleText`, `util.styleText`, `ansi` colour | #52040 #56265 #58437 #61556 |
| N11 | 22.0 · stable 24.13.1 | `v8.queryObjects()` for leak-regression tests | new | MISSING | terms `queryObjects`, `v8.query`; `17-memory-leaks.md` uses heap snapshots only | #51927 #60957 |
| N12 | 22.0 runtime → 23.0 EOL | `util.isArray/isDate/…`, `util._extend`, `util.log` gone on 24 | removed | MISSING | terms `util.isArray`, `util._extend`, `util.log` | #50488 #52744 |
| N13 | 22.0 EOL | `crypto.createCipher` / `createDecipher` removed | removed | PARTIAL | replacement `createCipheriv` taught (`20-node-crypto.md`); the removal never named — terms `createCipher(`, `createDecipher` | #50973 |
| N14 | 22.0 runtime | `new Hash()` / `new Hmac()` constructors deprecated (DEP0179/0181) | deprecated | PARTIAL | factories `createHash`/`createHmac` taught (`20-node-crypto.md`); DEP numbers not named | #51880 #52071; DEP |
| N15 | 22.0 | Runner: `suite()`, `--test-name-pattern` single test, `--test-force-exit` | new | COVERED | `14-runner-flags.md:125`–`136`; `01-node-test-runner.md:218`, `:223` (`suite()` alias not shown) | #52127 #51577 #52038 |
| N16 | 22.2 | `--inspect-wait` | new | MISSING | terms `inspect-wait`, `--inspect-wait`; `--inspect` pages (`19-cpu-heap-profiling.md`) predate it | #52734 |
| N17 | 22.2 | `--experimental-policy` (integrity manifests) removed | removed | MISSING | terms `experimental-policy`, `policy.json` | #52583 |
| N18 | 22.2 · stable 22.13 | Runner test plans `t.plan(n)` | new | MISSING | terms `t.plan`, `.plan(` | #52860 #55895 |
| N19 | 22.2 | `zlib.crc32()` | new | MISSING | terms `crc32`, `zlib.crc32` (`16-zlib.md` has none) | #52692 |
| N20 | 22.3 · stable 22.13 | Snapshot testing `t.assert.snapshot`, `--test-update-snapshots` | new | COVERED | `15-snapshot-testing.md:9`–`63` | #53169 #55897 |
| N21 | 22.3 | `mock.module()` (`--experimental-test-module-mocks`) | new | COVERED | `08-module-mocking.md` whole page | #52848 |
| N22 | 22.3 | `process.getBuiltinModule(id)` | new | MISSING | terms `getBuiltinModule`, `builtin module` | #52762 |
| N23 | 22.3 | Global `EventSource` client (`--experimental-eventsource`) | new | PARTIAL | browser `EventSource` taught `10-streaming-and-sse.md:106`–`108`; Node's flagged client not | #51575 |
| N24 | 22.3 | `Blob.prototype.bytes()` | new | MISSING | terms `.bytes()`, `blob.bytes` | #53221 |
| N25 | 22.4 | `util.parseArgs` `--no-` negation (`allowNegative`) | new | PARTIAL | `22-parseargs.md:12`–`49` teaches parseArgs; `allowNegative` / `--no-` absent | #53107 |
| N26 | 22.5 → unflagged 22.13 → RC 24.15 | `node:sqlite` (`DatabaseSync`) | new | COVERED | `12-node-sqlite.md` whole page; `syllabus/03-application.md:31` | #53752 #55890 #61262 |
| N27 | 22.5 · stable 22.20 | `path.matchesGlob()` | new | MISSING | terms `matchesGlob`, `path.matchesGlob` (`03-path.md` none) | #52881 #59572 |
| N28 | 22.5 | `worker.postMessageToThread()` | new | MISSING | terms `postMessageToThread`, `threadId` messaging | #53682 |
| N29 | 22.6 flag → 22.18 default → 24.12 stable | TypeScript type stripping | new | COVERED | `12-typescript-natively.md:9`–`37`; `syllabus/01-foundations.md:57` | #56350 #58643 #60600 |
| N30 | 22.6 · h2 24.8 | DevTools network inspection (`--experimental-network-inspection`) | new | MISSING | terms `network-inspection`, `Network tab` | CL22 22.6.0; #59611 |
| N31 | 22.6 | `--experimental-network-imports` (https: imports) dropped | removed | MISSING | terms `network-imports`, `from 'https:` | #53822 |
| N32 | 22.6 | `stream.duplexPair()` | new | MISSING | terms `duplexPair`, `DuplexPair` | #34111 |
| N33 | 22.7 | `--experimental-transform-types` (enums, namespaces) | new | COVERED | `12-typescript-natively.md:90`–`96`, `:186` (its 26.0 removal: row S29) | CL22 22.7.0 |
| N34 | 22.7 / 20.19 | Module syntax detection on by default (typeless `.js`) | default | COVERED | `05-module-resolution.md:117`, `:124`, `:181` | CL22 22.7.0 |
| N35 | 22.8 · stable 24.15 | `module.enableCompileCache()` / `NODE_COMPILE_CACHE`; `flushCompileCache` 22.10 | new | COVERED | `23-startup-time.md:9`, `:29`; `14-node-module-api.md` compile-cache section; `09-startup-snapshots.md:20` | CL22 22.8.0; #54971 #60971 |
| N36 | 22.8 | Runner coverage thresholds `--test-coverage-lines/branches/functions` | new | COVERED | `11-coverage.md:48`, `:57`, `:123` | CL22 22.8.0 |
| N37 | 22.8 | `performance.uvMetricsInfo()` | new | MISSING | terms `uvMetricsInfo`, `loopCount` (`12-perf-hooks.md` none) | #54413 |
| N38 | 22.8 | `vm.constants.DONT_CONTEXTIFY` (freezable `globalThis`) | new | MISSING | terms `DONT_CONTEXTIFY`, `freeze` in `01-node-vm.md` | CL22 22.8.0 |
| N39 | 22.9 · renamed 22.12 · old name removed 24.10 | `util.getCallSites()` (`getCallSite` removed) | new | MISSING | terms `getCallSites`, `getCallSite` | CL22 22.9.0; #59980 |
| N40 | 22.9 | `--env-file-if-exists` | new | COVERED | `08-running-node.md:10`, `:103`, `:111`, `:218` | CL22 22.9.0 |
| N41 | 22.9 / 24.0 | zlib and REPL classes without `new` deprecated (DEP0184/0185) | deprecated | MISSING | terms `DEP0184`, `DEP0185`, `without new` | #54708 #54842 #55718 |
| N42 | 22.10 | `process.features.require_module` / `.typescript` | new | MISSING | terms `features.require_module`, `features.typescript` | #55241 #54295 |
| N43 | 22.10 | `KeyObject.toCryptoKey()`; X509 `validFromDate`/`validToDate` | new | MISSING | terms `toCryptoKey`, `validToDate` | #55262 #54159 |
| N44 | 22.10 | Runner `run()` API: `'test:summary'`, `coverage`, custom `argv` | new | MISSING | terms `test:summary`, `run({` from `node:test` | #54851 #53937 #55126 |
| N45 | 22.12 | `Buffer` over a resizable `ArrayBuffer` tracks its length | new | MISSING | terms `resizable`, `maxByteLength` | #55377 |
| N46 | 22.12 | `node:sqlite` Session extension (`createSession`, `applyChangeset`) | new | PARTIAL | one line, `12-node-sqlite.md:56`; no example | #54181 |
| N47 | 22.13 stable · flag renamed 24.0 | Permission Model stable; `--permission` (22 keeps `--experimental-permission`) | new | COVERED | `24-permission-model.md:18`–`40`; `12-ssrf.md:212` | #56201 #56240 |
| N48 | 22.13 · stable 22.17/24.0 | `assert.partialDeepStrictEqual` | new | COVERED | `02-node-assert.md:83`–`88`, `:205`; `15-snapshot-testing.md:100` | #54630 #57370 |
| N49 | 22.13 | `--trace-env` | new | MISSING | terms `trace-env`, `--trace-env-js-stack` | #55604 |
| N50 | 22.13 → 22.19 → RC 24.19 | `net.BlockList` in `net.connect`/`Server`/UDP; `SocketAddress.parse`; save/load | new | MISSING | terms `BlockList`, `blockList`, `SocketAddress` (the `blocklist` hits are prose in `20-shell-injection.md`, `12-ssrf.md`) | #56075 #56079 #56076 #58087 #63050 |
| N51 | 22.13 | `module.stripTypeScriptTypes()` | new | PARTIAL | one table row, `14-node-module-api.md:114` | #55282 |
| N52 | 22.13 → 22.18 | sqlite `StatementSync.iterate()`, `.columns()`, DB-level `readBigInts` | new | PARTIAL | `12-node-sqlite.md:98`, `:221` teach `stmt.setReadBigInts`; `iterate`/`columns`/DB option absent | #54213 #57490 #58697 |
| N53 | 22.13 | Web Crypto `Ed25519` / `X25519` stable | new | COVERED | `25-web-crypto.md:82`; `26-encryption-and-keys.md:90`–`101` | #56142 |
| N54 | 22.14 | `module.findPackageJSON()` | new | PARTIAL | one table row, `14-node-module-api.md:113` | #55412 |
| N55 | 22.14 | `process.ref()` / `process.unref()` | new | MISSING | terms `process.ref(`, `process.unref(` | #56400 |
| N56 | 22.14 | Runner `t.waitFor()`, `t.assert.fileSnapshot()`, `assert.register()` | new | MISSING | terms `waitFor`, `fileSnapshot`, `assert.register` (other-track `waitFor` hits are RTL) | #56595 #56459 #56434 |
| N57 | 22.14 | TypeScript via `--eval`/stdin (`--input-type=module-typescript`); `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` | new | PARTIAL | error code taught `12-typescript-natively.md:85`–`87`, `:206`; eval input type absent | #56359 #56610 |
| N58 | 22.14 | `--disable-sigusr1` (no inspector via signal) | security | MISSING | terms `disable-sigusr1`, `SIGUSR1` | #56441 |
| N59 | 22.15 | `module.registerHooks()` — synchronous, in-thread hooks | new | MISSING | terms `registerHooks`, `in-thread hooks`; `14-node-module-api.md:57` teaches only `register()` (row S28) | #55698 |
| N60 | 22.15 | `process.execve()` | new | MISSING | terms `process.execve`; the `execve` hits are the syscall (`19-child-process.md:70`) | #56496 |
| N61 | 22.15 | zlib **zstd** (`zstdCompress`; dictionaries 22.19) | new | MISSING | terms `zstd`, `zstdCompress` (`16-zlib.md` covers gzip/brotli) | #52100 #59240 |
| N62 | 22.15 → 22.19 | System CA store: `--use-system-ca`, `NODE_USE_SYSTEM_CA=1`, `tls.getCACertificates()`, `tls.setDefaultCACertificates()` | new | PARTIAL | CA trust taught only via `NODE_EXTRA_CA_CERTS`, `09-https-and-tls.md:77`–`81`, `:166`, `:187` | #56833 #56599 #57107 #59276 #58822 |
| N63 | 22.15 | `util.diff()` | new | MISSING | terms `util.diff`, `diff(` | #57462 |
| N64 | 22.15 / 22.19 | `--cpu-prof*` allowed in `NODE_OPTIONS`; `${pid}` in `--cpu-prof-name` | new | PARTIAL | `--cpu-prof` taught `19-cpu-heap-profiling.md:21`–`24`; `NODE_OPTIONS` use and `${pid}` absent | #57018 #59072 |
| N65 | 22.16 → 24.2 → 24.12 → 24.19 | Config file `node.config.json` (`--experimental-config-file`, namespaces, `watch`) | new | MISSING | terms `node.config.json`, `config-file` | #57016 #57171 #58073 #60178 #61610 |
| N66 | 22.16 / 24.0 | `import.meta.dirname` / `.filename` stable | new | COVERED | `06-globals.md:144`–`149`, `:225`; `03-path.md:161`, `:223` | #58011 |
| N67 | 22.16 → 24.9 | Worker diagnostics: `worker.getHeapStatistics()`, CPU/heap profile APIs | new | MISSING | terms `worker.getHeapStatistics`, `startCpuProfile`, `startHeapProfile` | #57888 #59428 #59846 |
| N68 | 22.17 deprecate · 24.2 remove | HTTP/2 priority signalling (DEP0194) | removed | MISSING | terms `priority signal`, `DEP0194`; `14-http2.md` none | #58293 |
| N69 | 22.17 / 24.2 | `node:http` classes without `new` deprecated (DEP0195) | deprecated | MISSING | terms `DEP0195`, `without new` | #58518 |
| N70 | 22.17 / 24.2 | `child_process` `options.shell = ""` deprecated (DEP0196) | deprecated | MISSING | terms `DEP0196`, `shell: ''` (`08-injection.md` covers DEP0190 only) | #58564 |
| N71 | 22.17 → 24.4 | ERM in core: `fs.Dir`, `mkdtempDisposableSync`, async-disposable `Worker`, `Symbol.dispose` graduates | new | PARTIAL | 0 `using`/`Symbol.asyncDispose` hits in nodejs; one fs example in `javascript/…/07-throw-try-catch/02-finally.md:148` | #58206 #58516 #58385 #58467 |
| N72 | 22.17 / 24.2 | Permission model grants implicit read of the entry file | default | MISSING | terms `entrypoint`, `entry file`, `implicit` in `24-permission-model.md` | #58579 |
| N73 | 22.18 / 24.2 | `import.meta.main` | new | PARTIAL | only a table cell, `javascript/…/15-commonjs-today/02-interop-both-ways.md:78`; nodejs none | #57804 |
| N74 | 22.18 / 24.4 | Permission flags **propagate** to spawned Node children; `permission.has('addon')` | security | CONTRADICTED (live) | `24-permission-model.md:64` "no permission model at all"; `:153`; `:180` "the child runs unrestricted" | #58853 #58951; CLI24 `--allow-child-process` |
| N75 | 22.18 / 24.4 | `--watch-kill-signal` | new | MISSING | terms `watch-kill-signal`, `kill signal` | #58719 |
| N76 | 22.19 | `process.threadCpuUsage()` | new | MISSING | terms `threadCpuUsage`, `cpuUsage` per thread | #56467 |
| N77 | 22.19 / 24.5 | `.wasm` ES-module imports unflagged (source phase 24.0) | new | PARTIAL | `02-webassembly.md:32`–`33`, `:77` teach `WebAssembly.instantiate` on bytes; `import … from './x.wasm'` absent | #57038 #56919 |
| N78 | 22.19 / 24.6 · 22.20 / 24.7 | `server.keepAliveTimeoutBuffer`; `Agent.agentKeepAliveTimeoutBuffer` | new | PARTIAL | idle-timeout race taught `07-keep-alive-and-agents.md:131`–`141`; the new buffer options absent | #59243 #59315 |
| N79 | 22.19 / 24.5 | `dns` resolver `maxTimeout` | new | MISSING | terms `maxTimeout`, `Resolver({` (`keepAliveMaxTimeout` hits are unrelated) | #58440 |
| N80 | 22.20 / 24.7 | SEA `execArgv` / `execArgvExtension` | new | MISSING | terms `execArgvExtension`, `"execArgv"` in sea-config (`26-single-executable-applications.md:30`–`34`) | #59314 #59560 |
| N81 | 22.20 / 24.7 | `CompressionStream` / `DecompressionStream` **brotli** | new | PARTIAL | `15-web-streams.md:94`–`95` "gzip and deflate" only | #59464 |
| N82 | 22.20 / 24.3 | Runner `mock.property()` | new | MISSING | terms `mock.property`, property mocking | #58438 |
| N83 | 22.21 / 24.5 → 24.14 | Built-in proxy: `NODE_USE_ENV_PROXY`, `--use-env-proxy`, `Agent({proxyEnv})`, fetch proxy (24.0), `http.setGlobalProxyFromEnv()` | new | MISSING | terms `NODE_USE_ENV_PROXY`, `HTTPS_PROXY`, `proxyEnv`, `setGlobalProxyFromEnv` | #57165 #58980 #59151 #60953 |
| N84 | 22.21 / 24.9 | `http` `shouldUpgradeCallback` | new | MISSING | terms `shouldUpgradeCallback`; `11-websockets.md:101` uses the `'upgrade'` event only | #59824 |
| N85 | 22.21 / 24.6 | `--max-old-space-size` accepts a percentage | new | PARTIAL | flag taught in MB, `08-running-node.md:122`; `03-v8-flags.md:19`; `%` form absent | #59082 |
| N86 | 22.21 / 24.10 | `.env` support (`--env-file`, `loadEnvFile`) stable | new | COVERED | `08-running-node.md:10`–`11`, `:72`, `:245`–`246` | #59925 |
