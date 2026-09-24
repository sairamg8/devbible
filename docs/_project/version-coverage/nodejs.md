---
name: version-coverage-nodejs
description: nodejs (Node.js runtime + npm + undici) · applies up to Node 24.19.0 (floor 22.18 for phases 0–5, 24.19.0 for the whole unit) · compared 22 LTS / 24 LTS / 26 Current (LTS 2026-10-28) + npm 11/12 + undici 7/8 · 255 changes — 44 covered, 49 partial, 143 missing, 16 contradicted (11 live, 5 latent), 3 planned · 21 stale claims · report in nodejs.md + nodejs-02..05.md
metadata:
  type: project
---
# Node.js (runtime, npm, undici) — version coverage vs LTS (2026-09-24)

Unit `nodejs` = everything under `docs/nodejs/` (README, `syllabus/` 4 parts, `reviews/`, `pages/`
phases 0–12). Read-only audit — nothing under `/mnt/Storage/Backup/Knowledge/devbible` was changed.
No sandbox: every claim is a grep over the corpus or a primary source fetched this session
(2026-09-24). Out of scope: Express, database drivers, third-party libraries.

## 1 · Upstream release lines

Node.js **has an LTS concept**: even-numbered lines are promoted to LTS in October, 12 months Active
LTS then Maintenance to a fixed EOL. Changes with 27.x (below).

### Supported lines today (2026-09-24)

| Line | Codename | Status today | First release | Active LTS from | Maintenance from | EOL | Latest patch (date) | Bundled npm · undici · V8 |
|---|---|---|---|---|---|---|---|---|
| **22.x** | Jod | **Maintenance LTS** (oldest supported) | 2024-04-24 | 2024-10-29 | 2025-10-21 | **2027-04-30** | **22.23.3** (2026-09-23) | npm 10.9.9 · undici 6.28.1 · V8 12.4 |
| **24.x** | Krypton | **Active LTS** — the devbible pin (24.19.0) | 2025-05-06 | 2025-10-28 | **2026-10-20** | **2028-04-30** | **24.21.0** (2026-09-07/08) | npm 11.19.0 · undici 7.29.1 · V8 13.6 |
| **26.x** | — (codename not yet assigned) | **Current** (latest stable) | 2026-05-05 | **2026-10-28** | 2027-10-20 | **2029-04-30** | **26.10.0** (2026-09-21/22) | npm 11.19.1 · undici 8.10.2 · V8 14.6 |

Just gone EOL (not compared, listed for the floor): **25.x** EOL 2026-06-01 (last 25.9.0) ·
**20.x** Iron EOL 2026-04-30 (last 20.20.2).

### Latest stable / next LTS

- **Latest stable:** Node.js **26.10.0** (Current line, 2026-09-22 per endoflife.date; dist index
  dates it 2026-09-21).
- **Next LTS:** **26.x becomes Active LTS on 2026-10-28** (34 days from today). The same week
  **24.x drops to Maintenance LTS on 2026-10-20** (schedule.json).
- **After that:** 27.x is the first line of the **new release model** — one major per year, every
  release becomes LTS, an Alpha channel replaces odd lines. **27 Alpha opens 2026-10-28**, 27.0.0
  ships **2027-04-22** (schedule.json; blog says "April 2027"), LTS October 2027, EOL 2030-04-30.
  Announcement dated 2026-03-10. Node 26 is the last line under the old model.

### Companion tools (pinned in `src/data/pins.js`)

| Tool | Pin | Latest today | Lines bundled by Node | Support note |
|---|---|---|---|---|
| **npm** | 12.0.2 | **12.1.0** (2026-09-22); 11.20.0 same day on the `next-11` tag | 22 → 10.9.9 · 24 → 11.19.0 · 26 → 11.19.1 | **npm 12 is not bundled by any Node line yet.** npm 12.0.0 declares engines `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` |
| **undici** | 8.10.0 | **8.11.0** (2026-09-22) | 22 → 6.28.1 · 24 → 7.29.1 · 26 → 8.10.2 | Dist-tags keep `six`, `seven` alive; **undici 8 requires Node ≥ 22.19.0** (migration guide) |

So "the fetch() in Node" is **three different undici majors** across the three supported lines —
6 on 22, 7 on 24, 8 on 26.

### Sources (fetched 2026-09-24)

- endoflife.date API — `https://endoflife.date/api/nodejs.json` (cycles 20–26, lts/support/eol/latest).
- Node Release WG schedule — `https://raw.githubusercontent.com/nodejs/Release/main/schedule.json`
  (maintenance dates, v27 `alpha` 2026-10-28 / `start` 2027-04-22) and
  `https://raw.githubusercontent.com/nodejs/Release/main/README.md` (status column).
- Node dist index — `https://nodejs.org/dist/index.json` (every release's date, bundled npm, V8, LTS
  flag, security flag).
- Release-model change — `https://raw.githubusercontent.com/nodejs/nodejs.org/main/apps/site/pages/en/blog/announcements/evolving-the-nodejs-release-schedule.md`.
- Node changelogs — `https://raw.githubusercontent.com/nodejs/node/main/doc/changelogs/CHANGELOG_V22.md`,
  `…_V23.md`, `…_V24.md`, `…_V25.md`, `…_V26.md` (bundled undici versions, all feature rows in §3).
- npm — `https://registry.npmjs.org/npm` (dist-tags, publish times) and
  `https://api.github.com/repos/npm/cli/releases` (pages 1–3, plus tags v11.0.0, v11.4.0).
- undici — `https://registry.npmjs.org/undici`, `https://api.github.com/repos/nodejs/undici/releases`
  (pages 1–4, tags v7.0.0, v8.0.0) and
  `https://raw.githubusercontent.com/nodejs/undici/main/docs/docs/best-practices/migrating-from-v7-to-v8.md`.

Fetch failures: none.

## 2 · Content baseline — "applies up to"

### 2a · Version stamps (`> Verified:` lines — the unit has no `> Target:` / `> Version spine:` lines)

237 of the unit's 256 `.md` files carry a `> Verified:` line (the 19 without one are the README
files, the four syllabus parts and `reviews/syllabus-review.md`). Dates: 234 × `2026-08`,
3 × `2026-09-03` (the bcrypt chunks).

| Runtime stamp in the Verified line | Lines |
|---|---|
| **Node 24.19.0** (106 of them also say "(LTS)"; 0 say "Active LTS" — the B1 de-expiry held) | **211** |
| "Node 24" without a patch (practice / concept pages) | 8 |
| "Node.js v26.7.0 API index" (`README.md:7` only) | 1 |
| No runtime version (source-only or date-only stamps) | 17 |

Companion stamps inside those lines: **npm 12.0.2** × 6 · **undici 8.10.0** × 1
(`12-ssrf.md:9`) · **OpenSSL 3.5.7** × 2 · bcrypt 6.0.0 × 3. Body text also cites
`v24.10.0`, `v24.12.0`, `v24.15.0` (`08-running-node.md:11`, `12-typescript-natively.md:10`,
`04-cjs-esm-interop.md:11`) — the highest minor any page names is **24.15**, while the stamp is
24.19.0. The pin (`pins.js` node 24.19.0 / npm 12.0.2 / undici 8.10.0) matches the stamps exactly.

### 2b · Feature probes (full grading in §3)

| Line | Headline features (release notes) | Taught? |
|---|---|---|
| **22.0** | require(esm) · WebSocket client · `node --run` · watch mode stable · `fs.glob` · stream HWM 64 KiB · V8 12.4 (Array.fromAsync, Set methods, iterator helpers) | 6 / 7 — `fs.glob` only named once (`20-shell-injection.md:131`); V8 12.4 language features are taught in `docs/javascript` |
| **22.x minors** | type stripping (22.6 → default 22.18) · node:sqlite (22.5 → unflagged 22.13) · snapshot tests · `mock.module` · compile cache · `partialDeepStrictEqual` · `.env` stable (22.21) | all taught |
| **24.0** | V8 13.6 (`using`, RegExp.escape, Error.isError, Float16Array) · npm 11 · ALS on AsyncContextFrame · global URLPattern · `--permission` · runner auto-awaits subtests · undici 7 | `--permission` ✓; V8 13.6 in `docs/javascript` ✓; **ALS mechanism CONTRADICTED**; npm 11, URLPattern, auto-await, undici 7 ✗ |
| **24.1 – 24.19** | 24.12 type stripping stable ✓ · 24.14 sqlite defensive default ✓ · 24.15 require(esm) stable ✓, `mock.module({exports})` ✓ · 24.16 `--test-randomize` ✓ · 24.18 `Buffer.poolSize` 64 KiB ✓, `--test-rerun-failures` ✓ · **24.19 test tags ✓** | the newest taught feature is **24.19.0** (`--experimental-test-tag-filter`, `14-runner-flags.md:104`) |
| **24.20 – 24.21** | `permission.drop()` · `--permission-audit` · package maps · `node:stream/iter` · `t.log()` · ALS `using` scopes · STORE key loaders · `MIMEType.parse` | **0 taught**; `permission.drop` is **contradicted** (`24-permission-model.md:193`) |
| **25.x → 26.0** | Temporal on · V8 14.1/14.6 (Uint8Array base64, getOrInsert, Iterator.concat) · undici 8 (h2 default) · `--allow-net` · Web Storage on · Corepack dropped · SlowBuffer/`fs.F_OK` removed · `module.register()` runtime-deprecated · transform-types removed | Temporal shown **behind a flag** (`10-time-on-the-server.md:68`); `--allow-net` named as absent on 24; npm `undici@8` used as a library; **5 pages still state the 24-only shape as current** (Corepack, SEA ESM entry, transform-types, FFI, FileHandle-on-GC) |
| **26.1 – 26.10** | `node:ffi` · `node:vfs` · `util.throttle/debounce` · crypto MAC API · ZipFile · DTLS · `node:bench` | **0 taught** |

**Floor.** The runtime/module phases (0–5) hold back to **22.18** — the first 22.x with type
stripping on by default; `require(esm)` needs 22.12 and `.env` loses its experimental label at
22.21. They do **not** hold on 22 for the Permission Model page (22 still spells it
`--experimental-permission`; the rename is 24.0) or for phase 9, which uses 24.14–24.19 runner
features (`mock.module({exports})` 24.15, `--test-randomize` 24.16, `--test-rerun-failures`
24.18, tags 24.19). So the whole unit's floor is **24.19.0**; the core-runtime floor is 22.18.

**Verdict — Content applies up to Node.js 24.19.0 (floor 22.18 for phases 0–5; 24.19.0 for the
whole unit).** Every 24.x minor through 24.19 has at least one feature taught and nothing from
24.20/24.21 or 26.x is taught, while one page contradicts a 24.20 API. Node 26 — Active LTS in 34
days — appears only as a date; its runtime changes are untaught and five pages state the
24-only behaviour unscoped.

### 2c · Stale claims (false today, 2026-09-24)

| # | file:line | Claim (≤15 words) | Why it is false today |
|---|---|---|---|
| C1 | `README.md:7`, `:17`, `:91` | "Newest major line **Node.js 26** (26.7.0)"; "Verified against the Node.js v26.7.0 API index" | Latest is **26.10.0** (2026-09-22); three minors newer |
| C2 | `README.md:18`; `07-choosing-a-version.md:35` | "Maintenance LTS from 28 Oct 2026" | schedule.json: 24.x Maintenance starts **2026-10-20** |
| C3 | `07-choosing-a-version.md:22`, `:163`, `:184` | Active LTS: "Frozen feature set" / "twelve months of frozen features" | Release WG: Active LTS takes audited **new features**; 24.12→24.21 shipped ~90 semver-minors |
| C4 | `07-choosing-a-version.md:23` | Maintenance LTS "~12 months" | Release README: maintenance is **18 months** |
| C5 | `07-choosing-a-version.md:26`, `:164` | "Total supported life: **30 months** from first release" | 24.x: 2025-05-06 → 2028-04-30 = **36 months** (30 = from LTS start) |
| C6 | `07-choosing-a-version.md:121` | "Now using node v24.19.0 (npm v12.0.2)" | dist index: 24.19.0 bundles **npm 11.17.0** |
| C7 | `10-npm-day-to-day.md:9`; `07-package-json.md:9` | "npm 12.0.2, the version bundled with Node 24.19.0" | No Node line bundles npm 12 (22→10.9.9, 24→11.19.0, 26→11.19.1) |
| C8 | `11-package-managers.md:51`, `:63`, `:75` | "Node ships Corepack"; "Ships with Node … via Corepack" | Node **25.0** stopped distributing Corepack (semver-major, #57617); false on 26 |
| C9 | `26-single-executable-applications.md:20`, `:84` | "ESM as the SEA entry point is not supported yet" | ESM SEA entry landed **25.7.0** (#61813) → on 26 |
| C10 | `10-time-on-the-server.md:73` | "Until it is unflagged, use `date-fns-tz` or Luxon" | Temporal **enabled by default in 26.0.0** |
| C11 | `24-permission-model.md:193` | "there is no runtime API on Node 24, verified" | `process.permission.drop()` added **24.20.0** (#62672) |
| C12 | `24-permission-model.md:64`, `:153`, `:180` | child "with no permission model at all"; "the child runs unrestricted" | **24.4.0** (#58853): Node children inherit permission flags via NODE_OPTIONS |
| C13 | `01-node-test-runner.md:194` | spec reporter is "the default when attached to a TTY" | **23.0.0** (#54548): spec is the default on non-TTY too |
| C14 | `20-asynclocalstorage.md:76`; `21-async-hooks.md:13` | "The mechanism underneath is `async_hooks`" | **24.0.0**: ALS is backed by AsyncContextFrame; async_hooks is the `--no-async-context-frame` fallback |
| C15 | `14-node-module-api.md:57`–`99`; `syllabus/01-foundations.md:63` | `module.register()` taught as *the* customization-hooks API | **DEP0205**: doc-deprecated **24.15.0**, runtime-deprecated 26.0.0 → `module.registerHooks()` |
| C16 | `12-typescript-natively.md:90`, `:186` | "There is a flag" — `--experimental-transform-types` works | Flag **removed in 26.0.0** (#61803) |
| C17 | `06-ffi.md:9` | "FFI is package-mediated on Node" | `node:ffi` since **26.1.0**, on by default 26.9.0 |
| C18 | `syllabus/03-application.md:146` | lists `--test-random-order` and `--test-name-tag` | Neither exists; the flags are `--test-randomize` (24.16) and `--experimental-test-tag-filter` (24.19) — the unit's own `14-runner-flags.md:18`,`:104` say so |
| C19 | `13-dns.md:75`–`77`, `:118` | localhost → `::1` first, "the connection is refused … ECONNREFUSED" | `autoSelectFamily` defaults to **true since v20.0.0** (net.md) — `net.connect` tries both families; a pre-floor behaviour |
| C20 | `07-directories.md:124` | `rmdir` recursive option "⚠ Deprecated (DEP0147)" | End-of-Life (**removed**) in 25.0.0 (#58616) — deprecated only on 22/24 |
| C21 | `15-web-streams.md:95` | CompressionStream "(gzip and deflate … available in Node 24)" | Incomplete, not false: **brotli** added 24.7.0 / 22.20.0 (#59464) |

Scoped statements that are **true** and were left out of the list: "Node 24's built-in `fetch`
negotiates HTTP/1.1" (`14-http2.md:107`), "Node 24 has no `--allow-net`" (`12-ssrf.md:211`),
"on 24.19.0 `Temporal` is undefined without the flag" (`10-time-on-the-server.md:68`). Each is
correct for 24 and silent about 26 — graded PARTIAL in §3, not stale.

---

**Continues:** §3 delta table in [`nodejs-02.md`](./nodejs-02.md) (method, release policy, Node 22
line), [`nodejs-03.md`](./nodejs-03.md) (Node 24 line), [`nodejs-04.md`](./nodejs-04.md) (Node 26 line, npm,
undici); §4 summary and §5 hand-off in [`nodejs-05.md`](./nodejs-05.md).
