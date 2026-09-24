---
name: devbible-progress
description: Live state of the devbible build — Node COMPLETE (232 pages), PostgreSQL 13 stamps left (phase-13 07-18 + phase-0 p11), Express 78 pages but only 61 lines/page and unmeasured; now has a GitHub remote and Pages deploy; standing rules, traps, index of detail files
metadata:
  type: progress
---

Live state of [[devbible-brief]]. **Kept under 300 lines on purpose** ([[devbible-memory-file-cap]]); detail lives in the children indexed at the bottom.

## Where the build is — all counts re-measured off disk 2026-08-13 (session 11)

| | |
|---|---|
| Site | Docusaurus 3.10.2, React 19, **yarn 4.18**. `yarn start` :3000 · `yarn build` |
| **Remote** | ✅ **`origin` = `git@github.com:sairamg8/devbible.git`, publishing to GitHub Pages via Actions.** The old "there is no remote" note is dead. Site serves at `https://sairamg8.github.io/devbible/` (`baseUrl: /devbible/`) — **broken links are now public** |
| Node.js syllabus | **Done** — 248 topics, 13 phases, 4 parts. Master 74 (30%) |
| Node pages | ✅ **COMPLETE — 232 pages, 13 phases, 46,686 lines (avg 201/page).** 227 carry `Verified:`; the 5 that do not are full 138–226-line phase-0 pages predating the convention, **not stamps** |
| PostgreSQL | ⏸ **PARKED 2026-08-13 (session 12) — other languages finish first, user's call.** **279 pages, 267 verified, 12 stamps left** (all phase-13 topics 07–18). **Phases 0–12 COMPLETE.** Resume via [[devbible-postgresql-rewrite-handoff]] |
| Express | 🟡 **78 pages cover all 11 phases, but only 4,807 lines — avg 61/page, a third the depth of Node/PG. Only 2 of 78 verified.** Outlines, not explanations |
| Others | JavaScript 45 pages (phases 0–3) · TypeScript 37 (0–2) · CSS 28 (0–1) · **React 60 files / 45 topics — phases 0, 1 and 2 all COMPLETE** ([[devbible-react-phase2]], 2026-08-13) · Git 14 (phase 0). Syllabus topic counts: JS 337 · TS 187 · React 244 · Git 191 · **CSS 119 (not 230 — the docs README had that wrong)** · PG 229 |
| Build | ✅ **188 → 7 broken links** (session 11), then **21 → 15 after the two branch merges** (2026-08-13). The rise to 21 was *not* a regression — merging brought the JS and React corpora in with their forward references. **6 of the 21 were real** (JS phase-3 links to `05-call-apply-bind.md` / `07-lexical-scope.md` after both became directories) and are fixed in `f719d8f`. PostgreSQL, Node, Express, CSS, React, Git remain **0**. The **15 left are not bugs** — 12 JS forward refs to unwritten phase-3 topics 08+, and 3 pre-existing TS phase-2 links neither branch touched. `onBrokenLinks: 'warn'`, so **`yarn build` exits 0 regardless — never trust the exit code**, and **strip ANSI codes before `grep -c`** or the count comes back a false 0 |
| ✅ Uncommitted | **Nothing outstanding.** Session 11's 93 files are in `2285dac`; **session 12's set is now in `9faa3e5`** (2026-08-13) — the two chunked topics, the phase-12 outbox/audit pages, `ex55`–`ex57`, `src/data/progress.js`, the repointed links, plus the previously-untracked `reviews/` and `docs/reviews/unvalidated.md`. Committed on the user's explicit instruction *"in main any uncommitted code please commit"*. Two paths left untracked on purpose: **`.claude/worktrees/`** (1.4 GB, live worktrees, not in `.gitignore`) and `sandbox/pg-api/tmp/sqlite-conc.db` (run artifact). `main` is **10 ahead of `origin/main`, unpushed** |
| ✅ Branches | **All merged to `main`** (2026-08-13): `worktree-javascript-phases` → `5650954`, `worktree-react-phases` → `e40c5b3`, both `--no-ff` and conflict-free. **Branches kept, worktrees still `locked`** — peers may be live in them ([[devbible-parallel-sessions]]) |
| Link rule | ⛔ **Write `./04-allowlists/README.md`, never `./allowlists/`.** `trailingSlash: false` makes slug links resolve one level too high **in README index pages only**. `trailingSlash: true` is worse (188→198), already tried and reverted. Full explanation: [[devbible-never-compress-to-fit-cap]] |
| **Next** | 🔴 **FINISH THE OTHER LANGUAGES FIRST — PostgreSQL is parked.** User, end of session 12: *"i will pickup this postgresql but let other existing languages should complete first"*. This **supersedes** the old "finish PG core then React" ordering. JS/TS/CSS/React/Git and Express depth are the work; PG resumes after. Sandbox `pg-api` now has **67 scripts, ex1–ex57** |
| ⛔ Constraint | **No new sandbox scripts** — [[devbible-no-new-sandbox-scripts]], a usage-cost rule set in session 12. Write from the 67 that exist; a page nothing backs gets **no `> Verified:` line** and an explicit "not measured" marker. **"Stop writing scripts" is not "invent the output."** Also: add a **"through your ORM or platform"** note where a tool-level gotcha exists — only **7 of 320** PG pages mentioned Prisma/Drizzle/Supabase/Neon |
| Also open | The 4 PostgreSQL broken chunk links above (mine to fix, unlike the JS/TS/CSS ones); Express depth; the never-run rubric review |

### Phase 8 — Security, COMPLETE (27 pages, 2026-08-10/11)

Auth set 01–10, vulnerability set 11–16, practices 17–27. Every claim measured; scripts
`ex8`–`ex25` in `sandbox/p8-security/`, data in [[devbible-phase8-measurements]] and
[[devbible-phase8-measurements-practices]]. Sandbox has zod 4.4.3, valibot 1.4.2, redis,
helmet 8.3.0; Redis 7 container `devbible-redis` on **:6399** (podman `--rm`).

Findings worth carrying:

1. **`--allow-net` does not exist.** A `--permission` process with only `--allow-fs-read`
   still opened a TCP connection — the Permission Model cannot contain SSRF.
2. **A `Buffer` key costs 4× a `KeyObject`** in `createHmac`/`createCipheriv`.
3. **MD5 is slower than SHA-256** here (5.11 vs 3.68 µs) — the folklore is inverted.
4. **npm 12 blocks install scripts by default**; `min-release-age` is in **days**.
5. **A hash chain reports truncation as `intact`** — it needs an external anchor.
6. A custom `lookup` guard is **never called for a literal IP**, so a connect-time DNS
   check alone is not an SSRF defence.
7. scrypt plateaus at **~23 logins/sec per process** (libuv pool is 4); `JSON.stringify`
   does **not** escape `</script>`; Node sets **no `Content-Type`** by default.

Bookkeeping done; page 27's footer now links to `phase-9-testing/`.

### Express — 78 pages, verified, half-finished

Written by the co-session (Grok, follows `AGENTS.md`) in **30 minutes** on 2026-08-11,
7 pages → 78. Per phase: **0:7 · 1:7 · 2:7 · 3:8 · 4:8 · 5:6 · 6:9 · 7:6 · 8:8 · 9:6 ·
10:6**. Topics 114. No `pagesPlanned`, so the UI reports all 11 phases as *finished*.

**Content is accurate; completeness falls off a cliff after Phase 3.** Phases 0–3 (29
pages) meet the brief and need only a `Verified:` line; phases 6–10 (35 pages) are
accurate outlines, not explanations. 24 of 24 hand-checked claims held, but executing
all 39 extractable examples found **4 pages with invented console output** — one fixed
(`router.mountpath` does not exist), three open.

**User authorised me to complete Express** ("improve and complete express js fully",
"go topic by topic"), then said **"Wait"**. Paused after one page.

Full detail, the phase-by-phase table, the harness, all four errors and the three-pass
plan: **[[devbible-express-verification]]**.

**`AGENTS.md` (repo root, 2026-08-11) is the co-session's rulebook** — Grok store at
`my-learning/grok/`, 300-word memory cap, no subagents, **never delete prior work**,
build once per complete phase. Same working agreement as ours, different memory store.

Verified on **Express 5.2.1** in `sandbox/express5-check/`: `app.get('*')` **throws**
(`Missing parameter name at index 1`) and needs `/*splat`; `:id?` throws too; the
`query parser` default changed to **`simple`**, so `a[b]=1` yields the literal key
`"a[b]"` and nested query pollution is off by default; `x-powered-by` is still `true`;
`req.cookies` is `undefined` without `cookie-parser` while `res.cookie` is built in.

### Phases 6, 7 and 10–12 — done 2026-08-10

Per-phase page counts: 0 · 10 | 1 · 14 | 2 · 22 | 3 · 19 | 4 · 14 | 5 · 26 | 6 · 16 |
7 · 16 | 10 · 23 | 11 · 14 | 12 · 10. Datasets in [[devbible-phase6-measurements]] and
[[devbible-phase7-measurements]]. Highlights: `node:sqlite` bundles **SQLite 3.53.3**
(the syllabus row still says 3.52 — an unfixed factual error, left alone as out of
scope); **`Temporal` is undefined on 24.19.0** without `--harmony-temporal`; **BullMQ
has no built-in DLQ**; `vm.createContext({})` breakout returned `process.version`;
`process.versions.napi` **10**; `uvwasi` **0.0.23**.

### `drafts/GROK-PROMPT.md` — the co-authoring method (settled artifact)

The single file the co-session writes from — the *method*, not a topic list. It
deliberately does not enumerate rows; the user cut an earlier version that did —
*"give a direction how a topic needs to be explained, not by naming each"* — so rows
are pasted verbatim from `docs/<lang>/syllabus/` at prompt time.

Its two load-bearing rules: **never invent numbers, versions or console output** (those
become `VERIFY` markers) and **never write `> Verified:` on an unmeasured page**. Two
passes before anything lands in `docs/`: the `docs/reviews/review-prompt.md` purpose
test **by a different model than the author** (see [[devbible-review-system]]), then
measurement of every marker in `sandbox/`. Express skipped both — see above.

### Phase 8 — pages 01–10, written 2026-08-10

**01 password storage · 02 sessions vs JWT · 03 token storage · 04 authz vs authn ·
05 session management · 06 OAuth/OIDC · 07 MFA and TOTP · 08 injection · 09 XSS ·
10 path traversal.** Facts worth keeping, all in [[devbible-phase8-measurements]]:
scrypt plateaus at **~23 logins/sec per process** (4 concurrent hashes take the same
166 ms as one — libuv pool is 4); **TOTP reproduces all 8 RFC 6238 vectors**; command
injection executed `id` through `exec` via six constructs including a bare newline, and
Node 24 emits **DEP0190** for `spawn(..., {shell: true})` with args; `JSON.stringify`
does **not** escape `</script>`; Node sets **no `Content-Type`** by default.

### Phase 10 was deleted, then re-drafted — resolved

A rollback removed Phase 10 pages 09–23 on 2026-08-10, unrecoverable (no git); all 23
were re-drafted the same day from [[devbible-phase10-verification]]. Lesson only — the
user's answer on repo-ifying is **"not critical"**, do not raise it again.

### Phase 9 — Testing — **DONE 2026-08-11. Node is complete.**

**20 pages**, 18 main + 2 contract testing, matching the syllabus sub-headings.
Full measured dataset in [[devbible-phase9-measurements]]; sandbox
`sandbox/p9-testing/ex1-discovery` … `ex18-concurrency`.

Five measured findings that contradict what is commonly written — all on the phase
README as "What the measurements changed":

1. **A forgotten `await` is NOT silent** (this corrects the old note here). The test
   prints `✔`; the runner reports `generated asynchronous activity after the test
   ended`, fails the **file**, exits 1. Silent only if the promise is `.catch()`-ed.
2. **`node --test some/dir` fails** — `MODULE_NOT_FOUND`; a directory positional is
   resolved as a module. Globs or bare `node --test` only. This bit for real inside a
   Stryker config.
3. **`--test-rerun-failures` can report a broken suite green** — the state file
   replays passes without executing; a test edited to `throw` printed
   `✔ (passed on attempt 0)` and exited 0.
4. **Tags need `tags: ['unit']`** — plural array. Singular `tag:` is silently ignored.
   Flag is `--experimental-test-tag-filter`; the syllabus row's `--test-name-tag`
   does not exist.
5. **`--test-randomize`**, not `--test-random-order`. Seeds 1/2/3/7/11 on a coupled
   suite → 2/1/1/**0**/3 failures.

Also: `*.spec.mjs` is **not** discovered (0 tests, exit 0); 100 % coverage on a
function returning `23.987999999999996`; mutation score 86.67 % on that same 100 %-covered
suite; Testcontainers under rootless podman needs **both** `DOCKER_HOST` and
`TESTCONTAINERS_RYUK_DISABLED=true`.

## Resume handoff — PostgreSQL (the current priority)

1. Read `instructions.md`, this file, then [[devbible-postgresql-pages-validation]] —
   it carries the full audit, so **do not re-audit the pages**. There are only five
   distinct bodies across 216 files; reading page 47 tells you what page 48 says.
2. The user's method instruction: **do not review page-by-page then fix.** Work
   mechanically across the corpus, then rewrite by priority.
3. Named must-land-well topics: **schema creation with raw `pg` from Node, soft delete,
   filtering, sorting.** All four are currently stamps with none of the substance.
4. Bar to hit is the **Node.js corpus**, ~200 lines/page — not the current 77.
5. Sandbox measurements go in `sandbox/pg-*/` per the rule below; PG 18.4 on
   `127.0.0.1:55432` (never `localhost` — IPv6 trap).

## Resume handoff — any Node phase

1. Read `instructions.md` in the project root, then this file and
   [[devbible-ui-progress-and-build-cadence]].
2. Check [[devbible-scope-boundaries]] for where the phase's rows stop — several
   have an explicit Node/Express line that must not be crossed.
3. Create `docs/nodejs/pages/phase-N-slug/` with a `_category_.json` and a
   `README.md` index (table of page · tier · one-line hook, plus a "Where this
   connects" section and prev/next footer links).
4. Sandbox in **`sandbox/pN-slug/` inside the project** (user's request, 2026-08-10, so
   scripts survive the session). Outside `docs/`/`src/`, verified invisible to
   `yarn build`; each folder is its own **npm** project — the site is yarn 4, keep them
   apart. `sandbox/README.md` indexes them and carries the container commands. Still
   write the numbers into a `reference_phaseN_measurements.md` here as you go — that is
   what pages are written from, and what survives if the folder is lost. **Phases 0–6
   scripts are gone** (they predate the folder); their measurements files are enough.
5. When the phase lands: set `pages` in `src/data/progress.js`, drop any
   *(in progress)* marker in `docs/nodejs/pages/README.md`, re-link any forward
   references that were flattened to plain text, then `yarn build` **and grep the
   output for `warning|broken`**.

**Budget:** roughly a quarter of a context window per ~14-page phase when the
measurements already exist. Phase 5's 26 pages took about half a window including
sandbox work — measuring is the expensive half, not writing.

## Standing rules

- **300 lines per file is a HARD cap. Chunk means split, never condense.** A topic
  needing 1000 lines becomes four files of ≤300 under a topic-index directory —
  never one trimmed file, and never a relaxed rule. User instruction 2026-08-12
  after I did both. Layout and the route-prefix trap:
  [[devbible-never-compress-to-fit-cap]] and `instructions.md` §6.

- **Target the current Active LTS — Node 24** until Oct 2026, then 26. Never use an
  API the target LTS lacks. Facts *about* newer lines still belong on the pages; it
  is the build target that stays on LTS.
- **Run every example before pasting it.** Timings, error text and command output
  are real, produced on 24.19.0. This has repeatedly contradicted folklore and has
  twice corrected pages already written — see [[devbible-phase-findings]].
- **Build once per phase, not per page** — [[devbible-ui-progress-and-build-cadence]].
- **`src/data/progress.js` is the single source of truth** for the progress UI.
  Bump `pages` when a phase lands and every indicator follows.
- **Ask before editing `instructions.md`** — the user pushed back once on it being
  changed without asking, even when stale.
- Reviews are **historical records**: never edited after the fact, a new dated file
  instead.

## Traps — each of these cost real time once

- **MDX: an escaped backtick inside inline code ends the code span**, so `${x}` reaches
  MDX as a JSX expression and the build fails with `ReferenceError`. Use double-backtick
  inline code. A build **error**, not a warning. Likewise use `{/* VERIFY */}`, never an
  HTML comment, inside a blockquote.

- **`onBrokenLinks` is not `throw` here.** A green `[SUCCESS]` line does **not** mean
  the links are good. Always grep the build output for `warning|broken`.
- **A newly created `README.md` needs the cache cleared.** Adding
  `phase-8-security/README.md` and rebuilding still reported
  `linking to ./README.md … couldn't be resolved`, *and* generated its `index.html` in
  the same run. `rm -rf .docusaurus build node_modules/.cache` → zero warnings. Note
  this is the **opposite** of the prefix trap below: the link was correct and the cache
  was genuinely at fault. Rule of thumb — wrong prefix on an *existing* file, stale
  cache on a *newly created* index page.
- **Use `./` on relative markdown links.** `[x](15-process.md)` was reported broken
  although the file existed and its route built fine; clearing `.docusaurus`,
  `build` and `node_modules/.cache` changed nothing, and `./15-process.md` fixed it
  instantly. Suspect the prefix before you suspect a cache.
- **Restart the dev server after any config change.** `yarn start` hot-reloads
  content but **not `docusaurus.config.js`**, which produced
  `can't access property "id", props.content.metadata is undefined` while
  `yarn build` was perfectly clean. Kill it, `rm -rf .docusaurus`, restart. Check
  `pgrep -af docusaurus` before debugging content that builds fine.
- **Do not add a second docs plugin instance.** Two instances mean two sidebars, so
  explanations become unreachable from the syllabus and links must be absolute. This
  was tried and abandoned; the settled layout is one docs tree, one folder per
  language, `syllabus/` and `pages/` nested inside it.
- **`exclude` replaces Docusaurus's defaults.** `reviews/` is hidden from the site
  via `exclude: ['**/reviews/**', …]`, so the four default patterns must be spelled
  out alongside it or they stop applying.
- **Verifying "is it hidden?" needs the build, not the dev server** — `yarn start`
  answers 200 with an SPA shell for every path, including routes that do not exist.
  Check `.docusaurus/routes.js` or `build/`.
- **The tier CSS class for the fourth tier is `t-when`**, not `t-whenneeded`. Only
  four exist: `t-master`, `t-understand`, `t-know`, `t-when`
  (`src/css/custom.css:235-260`).

## Outstanding

**Debt cleared 2026-08-10** — the three adjudicated Phase 0 Majors and both false
version claims are fixed and the build is clean. Details in
[[devbible-phase-findings]].

Still open:

- **Express is 78 unmeasured pages** (2 of 78 verified, 0 VERIFY markers). Biggest
  open item in the repo; needs a user decision — backfill measurement, backfill
  markers, or accept as-is. Not mine to start unilaterally.
- **8 Node files hold open `VERIFY` markers** — phases 10 and 12, all version pins.
- **Phase 0 review Minors 1–3 and two nits** — `04:29` "Everything in `node:fs`"
  needs to exclude `fs.watch`/`FSWatcher`; `09:36` TypeScript row underspecified;
  `08:102` `--env-file` exit code is 9; page 04 "addresses will vary"; page 01
  missing a `Verified:` line.
- **Two review homes coexist** — `docs/nodejs/reviews/syllabus-review.md` predates
  the `docs/reviews/<language>/<phase>/` convention. **Do not tidy this
  unilaterally**; the per-language placement was an explicit user choice.
- **Phase 5 has not been reviewed.** Deliberately deferred — the next review is
  better spent on a whole part (end of Part 3) than on one phase.

**devbible IS a git repo as of 2026-08-11** — one commit, `8fac674 "before on
postgresql"`, created by the user or the co-session mid-session. This **supersedes** the
old note that it was deliberately not a repo (raised 2026-08-10, answered "not
critical"); do not act on that note any more.

**Still: I do not commit there.** Only this store is mine to commit
([[devbible-scope-boundaries]] / the root MEMORY.md rule). Ask before committing devbible
work — worth asking now that history exists, because it makes edits revertible.

**Settled unless reopened:** Phase 7 stays after Data Access, not after Testing.

## Detail files — open only what matches the task

- **[[devbible-phase-findings]]** — the verified sandbox findings worth keeping,
  phase by phase, plus what the debt fixes changed. **Open when writing or
  defending a page**, or when a page disagrees with common advice and you need to
  know why.
- **[[devbible-review-system]]** — how a phase gets reviewed: the reusable prompt,
  the output path convention, the read-only rule, and the Grok/Gemini adjudication
  that set the calibration bar. **Open only when running or judging a review.**

Also in this folder: [[devbible-brief]] (scope and tiers),
[[devbible-scope-boundaries]] (where each technology stops),
[[devbible-palette]], [[devbible-incremental-scope]],
[[devbible-audit-external-reviews]], [[devbible-memory-file-cap]].
