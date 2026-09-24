---
name: version-coverage-nodejs-04
description: nodejs version-coverage report, part 4 of 4 for §3 — delta for the Node 25/26 line (toward the next LTS, 2026-10-28), npm 11→12 and undici 7→8, each change graded COVERED / PARTIAL / MISSING / CONTRADICTED / PLANNED
metadata:
  type: project
---
# Node.js — version coverage vs LTS, part 4 · §3 delta (Node 26 line, npm, undici)

Continues [`nodejs-03.md`](./nodejs-03.md). Method, grading rules and source keys are in
[`nodejs-02.md`](./nodejs-02.md). Extra source keys here: `NPM vX` =
`api.github.com/repos/npm/cli/releases/tags/vX` (fetched pages 1–3 of the releases list);
`UND vX` = `api.github.com/repos/nodejs/undici/releases/tags/vX`; `UNDMIG` =
`nodejs/undici` `docs/docs/best-practices/migrating-from-v7-to-v8.md`; `DIST` =
`nodejs.org/dist/index.json`.

### 3.3 · Node 25 → 26 line (25.0.0 → 26.10.0) — latest stable, Active LTS on 2026-10-28

Only changes **not** back-ported to 24 are listed; 25.x/26.x minors that also shipped in 24.x are
graded in part 3.

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| S01 | 25.0 (V8 14.1) | `Uint8Array` `toBase64` / `fromBase64` / `toHex` / `fromHex` | new | PARTIAL | named once as a `Buffer` alternative, `04-buffer-as-uint8array.md:169` (no version; absent on 24); taught in `javascript/…/26-text-encoding/02-base64.md` | CL25 25.0.0 |
| S02 | 26.0 (V8 14.6) | `Map`/`WeakMap` `getOrInsert` / `getOrInsertComputed`; `Iterator.concat` | new | MISSING | terms `getOrInsert`, `Iterator.concat` — 0 hits in every track | CL26 26.0.0 (#61898) |
| S03 | 26.0 | **Temporal enabled by default** | new | PARTIAL | `10-time-on-the-server.md:65`–`73` shows it behind `--harmony-temporal` on 24 and says "Until it is unflagged" (stale C10); API taught in `javascript/…/24-temporal/` | #61806 |
| S04 | 25.0 | `--allow-net` network permission | new | PARTIAL | named only as absent on 24: `24-permission-model.md:74`–`84`, `12-ssrf.md:211`, `:289`; `syllabus/03-application.md:122` "added v25"; usage never taught | #58517 |
| S05 | 22.4 flag → 25.0 on → 26.0 `undefined` without a file | Web Storage `localStorage` / `sessionStorage` (`--localstorage-file`) | default | MISSING | terms `localstorage-file`, `webstorage`; nodejs `localStorage` hits are browser token storage (`03-token-storage.md`) and `05-node-vs-browser.md:35` lists it as browser-only | #52435 #57666 #61333 |
| S06 | 25.0 | **Corepack no longer distributed** with Node | removed | CONTRADICTED (latent) | `11-package-managers.md:51` "Ships with Node … via Corepack"; `:63` "Node ships Corepack"; `:75` (the `node:24` Dockerfile at `03-dockerizing-node.md:20`–`29` is scoped and fine) | CL25 25.0.0 #57617 |
| S07 | 24.0 runtime → 25.0 EOL | `SlowBuffer` removed | removed | MISSING | terms `SlowBuffer` | #55175 #58220 |
| S08 | 24.0 runtime → 25.0 removed | `fs.F_OK/R_OK/W_OK/X_OK` gone — `fs.constants.*` only | removed | PARTIAL | `constants.R_OK` form taught `08-stat-and-existence.md:124`–`125`; the removal unnamed | #49686 #55862 |
| S09 | 25.0 EOL | `fs.rmdir(path, { recursive })` removed → `fs.rm` | removed | PARTIAL | `07-directories.md:124`, `:212`–`213` teach `rm` and call rmdir-recursive "⚠ Deprecated (DEP0147)" — removed on 25/26 | #58616 |
| S10 | 24.9 doc → 25.0 EOL | Letting a `FileHandle` close on GC now **throws** (DEP0137); `fs.Dir` on GC doc-deprecated (DEP0200) | removed | CONTRADICTED (latent) | `09-file-handles.md:199` symptom "Warning: Closing file descriptor on garbage collection" — an error on 25+; the fix (close explicitly, `:41`) stays right | #58536; DEP DEP0137 DEP0200 |
| S11 | 25.0 EOL | `assert.CallTracker`; multi-argument `assert.fail()` | removed | PARTIAL | single-argument `assert.fail('…')` used `02-node-assert.md:39`; removals unnamed | #58006 #58532 |
| S12 | 25.0 EOL | `process` `'multipleResolves'` event | removed | MISSING | terms `multipleResolves` (`15-unhandled-rejections.md` none) | #58707 |
| S13 | 25.0 deprecated → 26.0 removed | `res.writeHeader()` (alias) removed → `writeHead()` | removed | PARTIAL | `writeHead` is what every page uses; the alias removal unnamed | #59060 #60635 |
| S14 | 25.0 | crypto: `ECDH.setPublicKey()` runtime-deprecated; SHAKE without `outputLength` (DEP0198); `hash`/`mgf1Hash` options EOL | deprecated | MISSING | terms `setPublicKey`, `DEP0198`, `mgf1Hash` | #58620 #59008 #58706 |
| S15 | 25.0 EOL | dgram legacy APIs, `worker.terminate(cb)`, fs stream `.open()`, TLS IP `servername`, falsy `dns.lookup` host, `Module._debug`, `url.parse` bad port | removed | MISSING | terms `terminate(` + callback, `servername` + IP, `_debug` (`24-worker-threads.md:111` uses promise `terminate()` — unaffected) | #58474 #58528 #58529 #58533 #58619 #58473 #58617 |
| S16 | 24.6 doc → 25.0 → 26.0 removed | Underscore internals: `_http_*` (DEP0199), `_tls_common`/`_tls_wrap` (DEP0192), `_stream_*` deprecated 25.0 → **removed 26.0** | removed | MISSING | terms `_stream_readable`, `_http_`, `DEP0199` | #59293 #57643 #58337 #60657 |
| S17 | 25.0 | Deep equality: promises never equal; invalid `Date`s equal | default | MISSING | terms `deepStrictEqual` + `Promise`/`Invalid Date` in `02-node-assert.md` | #59448 #57627 |
| S18 | 25.0 / 26.0 | `util.inspect` colours RegExp parts; marks proxied objects | default | MISSING | terms `util.inspect` + `Proxy` | #59710 #61029 |
| S19 | 25.2 | Happy Eyeballs attempt timeout default 250 → 500 ms | default | MISSING | terms `autoSelectFamily`, `happy eyeballs`; `13-dns.md:73`–`77` still teaches the pre-20 IPv6 `ECONNREFUSED` trap (C19) | #60334; NET24 |
| S20 | 25.5 → 25.9 | SEA: `--build-sea` one-step build (25.5), **ESM entry point** (25.7), ESM code cache (25.9) | new | CONTRADICTED (latent) | `26-single-executable-applications.md:20` "ESM as the SEA entry point is not supported yet"; `:84`, `:123`; build shown with postject only (`:40`–`50`) | #61167 #61813 #62158 |
| S21 | 26.0 | Undici 8 in core → built-in `fetch` negotiates **HTTP/2** by default | default | PARTIAL | scoped: `14-http2.md:107` "Node 24's built-in `fetch` negotiates HTTP/1.1"; 26 behaviour unstated | #62384; UNDMIG §4 |
| S22 | 26.0 EOL | Short GCM auth tags need an explicit `authTagLength` (DEP0182) | removed | PARTIAL | AES-256-GCM taught with default 16-byte tags, `26-encryption-and-keys.md:12`–`62`; the short-tag rule unnamed | #61084; DEP DEP0182 |
| S23 | 26.0 runtime | Passing `CryptoKey` to `node:crypto` APIs (DEP0203); `KeyObject.from()` non-extractable (DEP0204) | deprecated | MISSING | terms `KeyObject.from`, `DEP0203` | #62453 |
| S24 | 24.15 doc → 26.0 runtime | **`module.register()` deprecated (DEP0205) → `module.registerHooks()`** | deprecated | CONTRADICTED (live) | `14-node-module-api.md:57`–`99` teaches `register()` as *the* hooks API, no deprecation note; `syllabus/01-foundations.md:63`; `phase-1-modules/README.md:57` | #62395 #62401; DEP DEP0205 |
| S25 | 26.0 | **`--experimental-transform-types` removed** | removed | CONTRADICTED (latent) | `12-typescript-natively.md:90` "There is a flag"; `:93`–`96`; `:186` "`--experimental-transform-types` works" | #61803 |
| S26 | 26.0 | `assert` printf-style messages | new | MISSING | terms `assert` + `%s` | #58849 |
| S27 | 25.8.1 / 26.0 | Extensionless files inside `"type": "module"` packages are ESM (CJS exception removed) | default | MISSING | terms `extensionless`; `05-module-resolution.md:117` table has no extensionless row | #62083 #62176 |
| S28 | 26.0 | `QuotaExceededError` is a `DOMException` subclass | new | MISSING | terms `QuotaExceededError` (javascript track: browser storage) | #62293 |
| S29 | 26.0 | ML-KEM / ML-DSA PKCS#8 export defaults to seed-only | default | MISSING | terms `seed-only`, `pkcs8` | #62178 |
| S30 | 26.0 | `readable.read()` returns one buffer at a time; ALS kept on `finished()` only when needed | default | MISSING | terms `read()` in `12-stream-events-and-modes.md` | #60441 #59873 |
| S31 | 26.0 | HTTP upgrade requests carrying a body handled per spec | default | MISSING | `11-websockets.md:101` `'upgrade'` handler; body case absent | #60016 |
| S32 | 26.1 flag → 26.9 on | **`node:ffi`** (`--experimental-ffi`, `--allow-ffi`) | new | CONTRADICTED (latent) | `06-ffi.md:9` "FFI is package-mediated on Node"; `:32`–`37` package pseudo-code | #62072 #65475 |
| S33 | 26.4 → 26.10 | `node:vfs` — mounts, `fs/promises` dispatch, module loading (26.9), FFI from VFS (26.10) | new | PARTIAL | `14-virtual-filesystems.md:11`, `:124` teach userland VFS objects; `node:vfs` absent (`syllabus/02-core-io.md:71`) | #63115 #63537 #63653 #65909 |
| S34 | 26.7 | `--test-coverage-include-all`; Perfetto tracing; `ModuleHooks` `Symbol.dispose` | new | MISSING | terms `coverage-include-all`, `perfetto` (`11-coverage.md` none) | #64830 #64565 #63928 |
| S35 | 26.8 | `diagnostics_channel.tracingChannel` stable | new | COVERED | `07-diagnostics-channel.md:68`–`73` (no stability claim either way) | #64525 |
| S36 | 26.2 | `fs.Stats` `Temporal.Instant` fields | new | MISSING | terms `Temporal.Instant`, `mtimeInstant` | #60789 |
| S37 | 26.8 → 26.10 | crypto SIV / GCM-SIV modes; generic MAC API; provider-discovered ciphers/hashes; `crypto.parsePKCS12()` | new | MISSING | terms `GCM-SIV`, `createMac`, `parsePKCS12` | #63411 #65553 #65484 #65627 |
| S38 | 26.8 | REPL syntax highlighting | new | PLANNED | `syllabus/01-foundations.md:33` (REPL, Know); no REPL page | #64591 |
| S39 | 26.8 / 26.10 | sqlite `StatementSync.close()` / `[Symbol.dispose]`; `undefined` binds as `NULL` | new | MISSING | terms `StatementSync` + `close`, `undefined` + `NULL` | #64232 #65709 |
| S40 | 26.8 | zlib `ZipFile` / `ZipEntry` / `ZipBuffer` | new | MISSING | terms `ZipFile`, `ZipEntry` (`16-zlib.md` none) | #64339 |
| S41 | 26.9 | `node:bench` | new | MISSING | terms `node:bench`; `20-benchmarking.md` uses autocannon/mitata | #65606 |
| S42 | 26.9 | Experimental DTLS API | new | MISSING | terms `DTLS` | #63182 |
| S43 | 26.9 | Web Workers (browser-shaped `Worker`) | new | MISSING | terms `Web Worker`; `24-worker-threads.md:44`, `:89` teach `worker_threads` only | #64894 |
| S44 | 26.10 | `util.throttle` / `util.debounce`; `util.markPromiseAsHandled` | new | MISSING | terms `util.throttle`, `util.debounce`, `markPromiseAsHandled` | #65899 #65805 |
| S45 | 26.10 | `fs.openAsBlobSync()`; `net.BoundSocket` transferable to threads/children | new | MISSING | terms `openAsBlob`, `BoundSocket` | #65644 #64725 |
| S46 | 26.8.2 | `net.Server.prototype._listen2` runtime-deprecated (DEP0208) | deprecated | MISSING | terms `_listen2`, `DEP0208` | #65593 |

### 3.4 · npm (22 → 10.9 · 24 → 11.x · 26 → 11.19 bundled; pin 12.0.2 → latest 12.1.0)

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| P01 | 24.0 / dist | **Which npm each Node line bundles** — 22 → 10.9.9, 24 → 11.19.0 (11.17.0 at 24.19.0), 26 → 11.19.1; npm 12 is bundled by none | new | CONTRADICTED (live) | `10-npm-day-to-day.md:9` "npm 12.0.2, the version bundled with Node 24.19.0"; `07-package-json.md:9`; `07-choosing-a-version.md:121` "(npm v12.0.2)" | DIST; #56274 |
| P02 | npm 11.0 | Publishing a pre-release needs an explicit `--tag`; `latest` only moves forward | default | COVERED | `13-publishing.md:107`–`110`, `:163`–`164` | NPM v11.0.0 |
| P03 | npm 11.0 | `--ignore-scripts` also skips `prepare` | default | PARTIAL | `--ignore-scripts` taught `23-supply-chain.md:72`, `:192`; `prepare` nuance absent | NPM v11.0.0 |
| P04 | npm 11.0 → 12.0 | `npm init`: `type` prompt (11.0), `init-private` (11.4), default license empty not ISC (12.0) | default | MISSING | terms `init-type`, `ISC`, `init-private`; `13-publishing.md:64` runs `npm init -y` only | NPM v11.0.0 v11.4.0 v12.0.0 |
| P05 | npm 11.1 | `npm undeprecate` | new | PARTIAL | `npm deprecate` taught `13-publishing.md:92`–`96`, `:180`; undeprecate absent | NPM v11.1.0 |
| P06 | npm 11.5 → 11.10 | **Trusted publishing** — OIDC from CI, no token; `npm trust` | new | PARTIAL | provenance taught `13-publishing.md:114`–`126`, `:183`; `23-supply-chain.md:104`–`126`; terms `trusted publish`, `id-token`, `npm trust` — 0 | NPM v11.5.0 v11.10.0 v11.11.0 |
| P07 | npm 11.6 | `.npmrc` optional env replacement `${VAR?}` | new | MISSING | terms `${…?}` in npmrc | NPM v11.6.0 |
| P08 | npm 11.9 → 11.15 → **12.0 default "none"** | `allow-git` / `allow-remote` / `allow-file` / `allow-directory` — git and tarball-URL deps blocked by default on 12 | default | MISSING | terms `allow-git`, `allow-remote` | NPM v11.9.0 v11.14.0 v11.15.0 v12.0.0 |
| P09 | npm 11.10 / 11.17 | `min-release-age` (+ `-exclude`) | new | COVERED | `23-supply-chain.md:135`–`141` | NPM v11.10.0 v11.17.0 |
| P10 | npm 11.12 | `npm audit --include-attestations` | new | PARTIAL | `npm audit signatures` taught `23-supply-chain.md:109`, `:123`, `:183`; the flag absent | NPM v11.12.0 |
| P11 | npm 11.15 / 12.1 | `npm stage` (staged publishing); read-write-stage-only tokens | new | MISSING | terms `npm stage`, `stage-only` | NPM v11.15.0 v12.1.0 |
| P12 | npm 11.16 → **12.0 default** | Dependency install scripts blocked unless in `allowScripts`; `npm install-scripts ls/approve` | default | COVERED | `23-supply-chain.md:38`–`69`, `:185`–`211`; `phase-8-security/README.md:56` | NPM v11.16.0 v11.18.0 v12.0.0 |
| P13 | npm 11.18 | `install-strategy=linked` stable | new | MISSING | terms `install-strategy`, `linked` (`11-package-managers.md:46` covers pnpm's store only) | NPM v11.18.0 |
| P14 | npm 12.0 | Unknown CLI flags / abbreviations **throw** (unknown `.npmrc` keys warn — pre.3) | default | MISSING | terms `unknown config`, `abbreviat` | NPM v12.0.0, v12.0.0-pre.3 |
| P15 | npm 12.0 | `npm shrinkwrap` removed; `npm-shrinkwrap.json` ignored | removed | MISSING | terms `shrinkwrap` (`09-semver-and-lockfiles.md` none) | NPM v12.0.0 |
| P16 | npm 12.0 | `npm adduser` and `star`/`stars`/`unstar` removed | removed | MISSING | terms `adduser`, `npm login` | NPM v12.0.0 |
| P17 | npm 12.0 | `npm view --json` always an array; `npm pkg` output not forced to JSON; `pack`/`publish --json` unified | default | MISSING | `10-npm-day-to-day.md:90` shows `npm view` without `--json` | NPM v12.0.0 |
| P18 | npm 12.0 | Root `preinstall` runs before dependencies install | default | MISSING | terms `preinstall` | NPM v12.0.0 |
| P19 | npm 12.0 | Engines `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` | new | MISSING | pages run npm 12.0.2 on 24.19.0 but never state the floor | NPM v12.0.0 |
| P20 | npm 12.0 (pre.1) | `npm patch` (native patching), `packageExtensions`, global npmignore, `publish --access=private` | new | MISSING | terms `npm patch`, `packageExtensions`, `patch-package` | NPM v12.0.0-pre.1 |
| P21 | npm 11.4 | `npm run` is the primary name (`run-script` the alias) | new | MISSING | terms `run-script` | NPM v11.4.0 |

### 3.5 · undici (22 → 6.28.1 · 24 → 7.29.1 · 26 → 8.10.2 bundled; pin 8.10.0 → latest 8.11.0)

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| U01 | 24.0 / 26.0 | Bundled undici per line (6 / 7 / 8) vs the npm package you install | new | PARTIAL | `07-keep-alive-and-agents.md:78`–`83` "installed version and the bundled one can differ, so pin it"; `12-ssrf.md:194`; the bundled major per line never stated, and npm 8.10 is paired with Node 24 (bundled 7.29) | CL24 #56070; CL26 #62384 |
| U02 | 7.0 | `throwOnError` dropped → `interceptors.responseError` | removed | MISSING | terms `throwOnError`, `responseError` | UND v7.0.0 |
| U03 | 7.0 | Old `interceptors` option dropped → `dispatcher.compose(…)` | removed | MISSING | terms `.compose(` on a dispatcher, `interceptors.` (the `compose` hits are `stream.compose`) | UND v7.0.0 |
| U04 | 7.0 → 7.22 | Cache interceptor (RFC 9111; memory / SQLite stores) | new | MISSING | terms `interceptors.cache`, `CacheStore` | UND v7.0.0-alpha.3, v7.22.0 |
| U05 | 7.x → 7.17 | `dns`, `retry`, `redirect`, `deduplicate` interceptors; `RetryAgent` | new | MISSING | terms `interceptors.dns`, `RetryAgent`; `08-outbound-client-discipline.md` hand-rolls retries | UND v7.0.0, v7.17.0 |
| U06 | 7.1 | HTTP/2 client stable (`allowH2`) | new | COVERED | `14-http2.md:97`–`110`, `:154` | UND v7.1.0 |
| U07 | 7.4 → 7.23 | `EnvHttpProxyAgent` stable; SOCKS5 in `ProxyAgent` | new | MISSING | terms `EnvHttpProxyAgent`, `ProxyAgent`, `SOCKS5` | UND v7.4.0 v7.23.0 |
| U08 | 7.5 / 7.13 | `MockAgent` call history; `SnapshotAgent` record/playback | new | MISSING | terms `MockAgent`, `SnapshotAgent`; `07-mocking.md:159`–`165` mocks `globalThis.fetch` instead | UND v7.5.0 v7.13.0 |
| U09 | 7.11 | `install()` puts undici's `fetch`/`WebSocket` on `globalThis`; zstd decoding | new | MISSING | terms `install()` | UND v7.11.0 |
| U10 | **8.0** | HTTP/2 negotiated **by default**; `allowH2: false` for HTTP/1.1-only | default | PARTIAL | `14-http2.md:104`–`109` shows npm 8.10 negotiating h2 by default; the fix at `:154` still says "allowH2: true" (redundant on 8); h1-only opt-out absent | UND v8.0.0; UNDMIG §4 |
| U11 | 8.0 | Legacy dispatcher handler callbacks removed (v2 handler API) | removed | MISSING | terms `onRequestStart`, `onHeaders` (hits are BullMQ `removeOnComplete`) | UNDMIG §2 |
| U12 | 8.0 | Node ≥ 22.19.0; real `Blob`/`File` only; global dispatcher v2 + v1 mirror for Node's `fetch` | removed | PARTIAL | `setGlobalDispatcher` taught `07-keep-alive-and-agents.md:68`–`83`, `:110`–`112` (consistent with the v1 mirror); Node floor and Blob rule unstated | UNDMIG §1 §5 §6 |
| U13 | 8.1 → 8.10 | WebSocket `maxPayloadSize`; `preferH2`; HTTP `QUERY` method; namespaced `h2Options` | new | MISSING | terms `maxPayloadSize`, `preferH2`, `QUERY` | UND v8.1.0 v8.4.0 v8.6.0 v8.10.0 |
