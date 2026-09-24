---
name: devbible-locks-archive
description: Every closed, superseded or historical devbible lane section, verbatim, rotated out of LOCKS.md on 2026-09-08 — opened by name when someone asks what happened, never on the hot path
metadata:
  type: progress
---

# devbible — LOCKS archive

**Rotated out of [LOCKS.md](LOCKS.md) on 2026-09-08, verbatim, nothing dropped.**
LOCKS.md is the board every session opens first; it had reached 1,416 lines / 149 KB
(~37k tokens) because closed lanes were never removed — 18 session sections and ~800 lines
of per-language standing orders, most of them describing tracks that finished in August.

**Nothing here is dead — it is COLD.** Standing orders for a track that is still open live
in LOCKS.md's routing table; the reasoning, the verbatim user instructions, the chunk-split
mechanics and the wind-down records live here. Open this by name when you need *why*, or
when a track that has been quiet for weeks gets picked up again.

## Section map

| Range | What |
|---|---|
| §0m … §0 | per-session lane records, 2026-09-06 → 2026-09-08, newest first |
| §10b, §10c | the framer-motion and redux-toolkit validation lanes |
| §11 | the one-language-per-session rule and its worktree-consolidation history |
| §11a … §11j | per-track standing orders: Express, JavaScript (+chunk mechanics, scope cut), MongoDB, React, Git, Docker, Redis, TypeScript, Java, Python |

🔴 **The chunk-split mechanics are here, not in LOCKS.md** — how the user starts a chunk
(§11b), the rules all four chunks share (§11b-common), and the 2026-08-14 scope cut
(§11b-scope). A session told *"continue chunk C"* needs those; grep this file.

---

## 0m. 🟢 LANE CLOSED — **vite topic 18 is COMPLETE**, nothing owed (2026-09-08, session `6d8f8a23`)

**The user named it:** *"add a microservices architecture topic to vite deploy the agents you need
and you can monitor their progress."*

🔓 **Lock RELEASED.** **24 chunks · 5,385 lines · 126 ★.** Commits `2a6c73c7a` + **`fb0b51370`**;
🔴 **not pushed — the user pushes.** Track now **18 / 18 topics · 188 pages**. Gates: `mdxcheck`
189 files / 0 problems · `linkcheck` **7,455 files / 0 problems corpus-wide** · zero footer markers
· boards `--check` current · topic 17's *"end of the Vite track"* clause removed and repointed.

🔴 **Rule 7 scored 12 / 12 — every cap overshoot split, none trimmed.** Eight fresh-write agents,
zero stalls. Two new gaps found and written up: concurrent agents cannot allocate
`sidebar_position` (renumber in one coordinator pass), and **a `*(not written yet)*` marker goes
stale with no gate catching it** — `grep -rn 'not written yet'` is now a mandatory close step.

**Lane was: `docs/vite/pages/18-microservices-architecture/` + vite's wiring** (`docs/vite/README.md`,
`docs/vite/pages/README.md`, the **vite rows only** of `src/data/progress.js`, `page-counts.json`,
`status.json`, and topic 17's last footer).
⛔ **Not mine:** every other track. Never `git add -A`; name explicit paths.

⚠️ **The vite track was marked COMPLETE at 17/17 and [CURSOR-VITE.md](CURSOR-VITE.md) said *"do not
invent a topic 18"*. The user asking for one by name is not the case that line guards against** — it
guards against a session inventing work when told only *"continue with vite"*. The cursor now carries
a LIVE SAVE POINT at the top saying exactly that.

🔴 **The cursor, and the only file a cold session needs:** [CURSOR-VITE.md](CURSOR-VITE.md) — its
LIVE SAVE POINT carries the 13-chunk plan, the wave split, the research bank and the six wiring
steps this topic still owes (topic 17's footer still says **"end of the Vite track"**).

**Research is banked and paid for:** [[research-vite-t18-microservices]] — six fetches, 2026-09-08.
Do not re-fetch. Its last section lists five claims the sources did **not** settle; writers are bound
by it.

🔴 **Gate with `yarn mdxcheck`, not the python checker** — §0l's EXPR upgrade is what catches the
bare-`{ident}`-in-prose shape, and topic 18 is full of config identifiers in prose.

---

## 0k. 🟢 LANE CLOSED — **DSA phase 2 is COMPLETE**, 13/13 topics (2026-09-08, session `0e733592`)

**The user named it:** *"Continue on DSA and System design deploy the agents you need … pick per
chapter once and deploy agents to complete that chapter max 4 would be fine each time … mainly take
a chapter at a time N i am stepping outside do not wait for me."*

🔒 **Lane: `docs/dsa/pages/phase-2-recursion-maths-bits/` + dsa's wiring** (`src/data/progress.js`
dsa phase 2 row, `docs/dsa/pages/README.md`, `docs/README.md`, `page-counts.json`, `status.json`).
⛔ **Not mine:** every other track, and every other dsa/system-design phase.

🔓 **Lock RELEASED. Tree clean. Committed and PUSHED (`a2cf8e5a`).**
**13 / 13 topics · 111 files · ~27,300 lines · ~1,090 ★**, written by 7 agents in 3 overlapping
waves, never more than 4 at once. **13 dispatches, 13 splits, 0 trims.** Gate: 112 files, 0 mdx
and 0 link problems; corpus `linkcheck` 7,430 files / 0 problems.

🔴 **THE FINDING THAT TRAVELS: `sidebar_position` is a NUMBER, and the documented duplicate check
is blind to it.** `3.10 == 3.1`, and `sort -n | uniq -d` compares *strings*, so it prints nothing
while three pages sit in the wrong order. Any track with a topic past nine chunks may have this
now. The float check and the `.95` convention are in the cursor.

⏹️ **WOUND DOWN FOR THE DAY 2026-09-08 19:31** on the user's instruction (*"Signal everything to
winddown and save session progress enough for the day"*). Both repos committed and pushed.

🔴 **NEXT: System Design phase 3, "Caching everywhere" (16 topics) — READY TO START, NOT STARTED.**
✅ Directory **scaffolded and committed** (`docs/system-design/pages/phase-3-caching/`, 16 ⬜ rows).
✅ Research bank **already fetched** — [research_system-design_phase3.md](research_system-design_phase3.md),
8 primary sources; **do not re-fetch**.
✅ Dispatch brief **in this store** — [BRIEF-sd-phase3-caching.md](BRIEF-sd-phase3-caching.md).
✅ A four-agent wave was dispatched and then signalled down before any agent wrote a file — **there
is no salvage and the same wave is re-dispatched as-is.** The assignments are in the cursor.

🔴 **The cursor, and the only file a cold session needs:**
[CURSOR-DSA-SYSTEM-DESIGN.md](CURSOR-DSA-SYSTEM-DESIGN.md) — its LIVE SAVE POINT at the top carries
the wave table, the salvage rule and what the session still owes.

---

## 0l. 🚑 DEPLOY REPAIR — not a language lane (2026-09-08, session `15d52dfa`)

**Task was literally "Fix deployment issue".** No language was named and none was taken: this
lane owns `scripts/` and the four broken content files only, and touched no track's syllabus,
boards or wiring. 🔓 **No lock held. Released.**

### What was wrong

**The Pages deploy had been RED since 2026-09-07 16:12 UTC — six consecutive runs, ~20 hours.**
`yarn mdxcheck` and `yarn linkcheck` were **both green on the same tree the whole time.**

Four defects, four files, two lanes — all one root cause, *something the author meant as code
reached prose, where MDX reads it as JSX*:

| File | Shape | Symptom |
|---|---|---|
| `docs/vite/…/12-path-resolution-and-aliases/01m-…:112` | bare `<=22` in a quote | parse error — the only one mdxcheck caught |
| `docs/vite/…/07-env-variables-and-modes/01d-…:25,45` | bare `{string}` / `{boolean}` | `ReferenceError: string` in SSG |
| `docs/tanstack-query/…/14-optimistic-updates-patterns/01b-…:71` | nested backticks close the span early | `ReferenceError: todo` |
| `docs/tanstack-query/…/14-optimistic-updates-patterns/01c-…:144` | `` \` `` inside a code span | `ReferenceError: i` |

🔴 **Markdown does not process backslash escapes inside a code span** — that is why the last one
is the nastiest, and why the fix idiom for all of them is ``double backticks``, never a backslash.

### What was done

- All four fixed. `9b9bbaee7` (vite 01m) + `22af134e6` (the other three — **committed by the dsa
  session as a salvage** while this session was mid-build; nothing was lost, verify with
  `git merge-base --is-ancestor`). Both are **on `origin/main`.**
- 🔴 **`scripts/mdxcheck.mjs` upgraded — `aead97785`.** New **EXPR** class: it now walks the
  estree on every `mdxTextExpression`/`mdxFlowExpression` node and reports identifiers the
  expression *reads but never defines*. Measured zero-false-positive first: the corpus holds
  1,717 expression nodes, 1,339 `{/* comments */}` and every other one a bare numeric literal.
  Verified 7,349 files / 0 problems, and a fixture of all four shapes reports all four.
  ✅ **Pushed.**
- ✅ `ef3e44927` — **`.github/workflows/deploy.yml` comment corrected.** It claimed
  `onBrokenLinks` is `'warn'` and that dead links "never fail the build on their own"; both
  halves had been false since 2026-09-05. Two settings, opposite behaviours: `onBrokenLinks:
  'throw'` (config:72) fails Build on a broken ROUTE link, `onBrokenMarkdownLinks: 'warn'`
  (config:75) only warns on a broken MARKDOWN link — and that step is the only place the second
  class surfaces. Comment only, YAML re-parsed.
- Memory: [[devbible-gap-mdxcheck-compiles-but-does-not-render]], pushed to the store.

### ✅ Outcome

🟢 **The deploy is GREEN again** — run
[`34233733765`](https://github.com/sairamg8/devbible/actions/runs/34233733765), build 12m21s,
deploy 30s, first success since 2026-09-07 14:28. Both jobs ran; the site is publishing.
Remaining annotations are 4 **markdown-link** warnings from the live DSA lane — warn-only, they
do not block, and they belong to that lane.

### 🔴 What every future session must take from this

1. **`mdxcheck` + `linkcheck` green ≠ build green.** Say "the gates pass", never "the build
   passes". The EXPR class now closes the specific hole, but the *principle* stands.
2. **A build that exits 143 with NO output is not necessarily OOM.** Four of the six runs exited
   1 with a real message; the last two exited 143 silently and sent this session hunting runner
   memory for an hour. Reproduce locally — a local build names **all** failing pages at once
   where CI names them one 11-minute round trip at a time. (Measured in passing: one
   `docusaurus build` process reaches **9.2 GB RSS** at 6,321 pages, so the 16 GB runner IS
   close to its ceiling — worth watching, but it was not the blocker.)
3. **`gh run view --log` EXPIRES.** Only the two newest runs still had logs; the four older ones
   needed `gh api …/jobs` to yield even an exit code. Read the log while the run is fresh.

---

## 0j. 🟢 LANE CLOSED — tanstack-query is COMPLETE, nothing owed (2026-09-08, session `bc194850`)

**The user named it:** *"finish the four remaining topic 16 chunks"* → *"deploy agents max 4 n u
monitor"* → *"Please kill all and save sesion progress"* → *"finish the five remaining chunks in
topics 02 and 04"*.

🔓 **Lock RELEASED. Tree CLEAN. All committed and PUSHED.**

🟢 **ZERO `*(not written yet)*` markers anywhere in `docs/tanstack-query/`.** `linkcheck` → **70
files, 0 problems.** Every topic's footer chain verified unbroken end to end.

| Topic | Was | Now |
|---|---|---|
| 16 migration recipes | 786 / 49 ★ | **10 chunks · 2,059 lines · 142 ★** |
| 04 caching & invalidation | 298 / 19 ★ | **10 chunks · 2,470 lines · 152 ★** |
| 02 useQuery deep dive | 290 / 19 ★ | **9 chunks · 1,956 lines · 152 ★** |

Commits: `496c4e1a` `d1ab9f61` `4d30667c` `463dddbf` `031d035e` `b4bcae81` `554f769c`.

### 🔴🔴 THE RESULT THAT MATTERS — rule 7 is worth more than every other dispatch tweak combined

| Wave | Dispatch said | Trimmed to fit | Split correctly |
|---|---|---:|---:|
| morning | *"aim ≤285"* + *"one file only"* | 🔴 **2 of 2** | 0 |
| afternoon | the same **plus rule 7** | ✅ **0 of 4** | **4 of 4** |

Rule 7: *"If you exceed 300 lines, SPLIT into a second file at a concept boundary and tell me the
new filename. Do NOT shrink, compact, reflow or de-duplicate anything to fit."*
🔴 **Without it, "≤285" + "one file only" FORCES the violation** — an overshooting agent has no
other legal move. Every future dispatch carries it. See [DISPATCH-ANTI-STALL.md](DISPATCH-ANTI-STALL.md) §7.

### 🔴 Agent reliability, measured across 10 dispatches today

| Task shape | Died at the 600s watchdog |
|---|---|
| Write a NEW file from a brief | **0 of 6** |
| SPLIT an existing file | 1 of 2 |
| EXTEND a topic (read one file, write many) | **2 of 2** |

🔴 **Dispatch agents for FRESH WRITES ONLY. Do splits and extends in-session by hand.** A split or
extend forces the agent to hold an existing file before it may write — the shape that stalls.

### ✅ Three fetches spent, all banked — and one long-standing open question CLOSED
- 🟢 **`select` re-run frequency — OPEN since 2026-09-06, now CLOSED.** `render-optimizations` also
  settled **structural sharing** and **tracked properties**/`notifyOnChangeProps`. Struck at the top
  of [research_tanstack_query_v5_quotes.md](research_tanstack_query_v5_quotes.md).
- `initial-query-data` (T1 — the fetch returned a summary, not raw text; flagged as such).
- the `typescript` guide, for `queryOptions`.

### ⚠️ Deliberately left OPEN on the pages rather than guessed
1. **Is the RESULT of `select` structurally shared?** Marked open on **both** pages that touch it
   (`02/01f`, `04/01g2`), cross-linked so they agree explicitly rather than guessing differently.
2. Non-JSON values inside the structural-sharing walk; whether `setQueryData` uses the same
   comparison; infinite queries + structural sharing.
3. Two observers mounting one key with **different** `initialData`; what `dataUpdatedAt` reports
   while `isPlaceholderData` is true.
4. 🔴 **Six `queryOptions` type signatures are marked "⚠️ Extrapolated"** — the reference pages
   return `{"isNotFound":true}`, so nothing was quoted. Includes `infiniteQueryOptions` and what
   `queryClient.query()` does with `skipToken`.

### Two board traps found today
- 🔴 **`pages/README.md` is a FIFTH board surface** (topic table + continuation-chunks table).
  Every wave since topic 08 had missed it. Assume the same of every other imported track.
- 🔴 **TWO tracks have a topic slugged `16-migration-recipes`** in `progress.js` (lines 524, 759).
  A slug-only regex silently rewrites the other lane's row. **Scope every edit to the track block.**

### ⚠️ Small, open, not blocking
- **Eight single-page topics remain**: 01, 03, 05, 09, 12, 13 — measured **214–277 lines, 13–18 ★**,
  which is the house band. ✅ **They are NOT debt; do not "deepen" them on the assumption that one
  file means thin.**
- `src/data/pins.js`: `@tanstack/react-query-devtools` still has no pin.
- `06-background-refetching/01b-refetch-render-cost.md` overlaps `04/01g` on structural sharing;
  the new page extended and cross-linked it three times. Worth a duplication-policy glance.

🔴 **NEXT ON THIS LANE: ORM (Prisma + Mongoose) → CI/CD → webpack → babel.** Both new tracks are
**RULE 5 — syllabus + card only, then STOP AND ASK.** See [CURSOR-A2-TOOLCHAIN.md](CURSOR-A2-TOOLCHAIN.md).

---

## 0i. 🔒 SAME SESSION, **vite — batch 4** (2026-09-08, session `82249172`)

**The user named it:** *"continue with batch 4"*, following the same four-agent pattern they
authorised for batch 3 (*"deploy max 4 agents and split work"*, *"you monitor their work"*).

🔴 **Batch 4 = topics 15 and 16, and it CLOSES the vite track.** Two topics, four agents — each
topic cut in two on a concept boundary, the split that worked in batch 3.

| | |
|---|---|
| 🔒 **Lane** | `docs/vite/pages/15-deployment-considerations/`, `16-migration-recipes/`, plus vite's wiring (`src/data/progress.js` vite rows 15-16, `docs/vite/README.md`, `page-counts.json`, `status.json`) |
| ⛔ Not mine | every other track. **`docs/vite/pages/17-the-2026-toolchain-landscape/` is READ, never edited** — agent D reads it to avoid restating its argument |
| Arrival check | `git status --porcelain docs/ src/ static/` clean at batch-3 close; 6 batch-3 commits unpushed (the user pushes) |
| A | topic 15 `01`–`01f` — `base`, `dist/` shape, `public/`, SPA fallback per host, `vite preview`, cache headers |
| B | topic 15 `01g`+ — `build.target` and the v8 `baseline-widely-available` default, env baked at build time, sourcemaps, SSR deploy, `build.manifest`, CSP, Docker |
| C | topic 16 `01`–`01f` — the CRA → Vite recipe |
| D | topic 16 `01g`+ — webpack config translated (incl. `require.context` → `import.meta.glob`, Module Federation), and the Vite 7 → 8 upgrade |
| 🔴 Owed at close | **`16-migration-recipes/01-cra-to-vite-migration.md` has NO footer at all** and must gain one pointing forward to topic 17. 🔴 **Keep that exact filename** — topic 17 chunk 1 links back to it |
| 🔴 Rewire | `scratchpad/rewire.py --topics 15-deployment-considerations,16-migration-recipes --prev 14-testing-integration/01i-migrating-from-jest.md --next 17-the-2026-toolchain-landscape/01-the-2026-bundler-landscape.md` |
| Push | devbible is **committed, not pushed** — the user pushes |
| ⏹️ **State** | ✅ **BATCH 4 CLOSED 2026-09-08 — and it CLOSED THE VITE TRACK at 17/17.** Topic 15 `652554e5` (15 chunks, 98 → 1,788 lines, 0 → 113 ★) · topic 16 `561a97ab` (15 chunks, 161 → 2,572 lines, 0 → 113 ★) · wiring `c330436a` + `4a88024f`. 🔴 **Topic 16's missing footer is fixed** and topic 17's back-link repointed at 16's last chunk. Gates: `yarn linkcheck` **7,279 files / 0 problems corpus-wide**, boards `--check` current. ⚠️ **Both `01g`+ agents stalled before gating** — the session gated their files, added 8 missing `> Validated:` stamps, and fixed a deploy-breaking link to a `README.md` no vite topic has. 🔴 **11 commits UNPUSHED.** 🔓 **Lock RELEASED** |

---

## 0h. 🔒 THIS SESSION'S LANE IS **vite — batch 3** (2026-09-08, session `82249172`)

**The user named it in this session:** *"continue with batch 3"*, then *"deploy the agents you need
to complete the batch untill that batch complete do not deploy more"* and *"You monitor their work
deploy max 4 agents and split work"*.

🔴 **Batch 3 = topics 12, 13, 14**, exactly as [CURSOR-VITE.md](CURSOR-VITE.md) queued it. Four
agents, split by concept lane — topic 12 was cut in two because bare-specifier resolution is a
different subject from aliasing.

| | |
|---|---|
| 🔒 **Lane** | `docs/vite/pages/12-path-resolution-and-aliases/`, `13-worker-and-wasm-support/`, `14-testing-integration/`, plus vite's wiring (`src/data/progress.js` vite rows 12-14, `docs/vite/README.md`, `page-counts.json`, `status.json`) |
| ⛔ Not mine | every other track, and vite topics 15/16 (batch 4) |
| Arrival check | `git status --porcelain docs/` clean · `git log origin/main..main` empty — no salvage |
| 🔒 Agents | **FOUR, authorised by the user in this session.** Content only — never `git add`, never a board, never `src/data/*`. The session QCs, rewires, wires and commits |
| ✅ **13-worker-and-wasm-support** | `92a3bdd1` + wiring `5b4a3a9b`. 1 page → **5 chunks**, 119 → **862** lines, 0 → **41 ★** |
| ✅ **14-testing-integration** | `aeb9f869` + wiring `877b0427`. 1 page → **10 chunks**, 99 → **1,408** lines, 0 → **92 ★** |
| ✅ **12-path-resolution-and-aliases** | `21832133` + wiring `b29b11ac`. 1 page → **15 chunks**, 101 → **3,170** lines, 0 → **115 ★**. Agent A wrote `01`–`01f` (aliasing), agent B `01g`–`01m` (bare-specifier resolution) — a two-agent split on one topic, zero collision |
| 🔴 Central rewire | `scratchpad/rewire.py --topics <a,b,c> --prev <topic/file.md> --next <topic/file.md>`. Agents write `sidebar_position: 0` + a literal `{/* FOOTER */}`; the script assigns 1..N and rebuilds the chain. Batch-2's rule, kept, and it worked again |
| ⏹️ **State** | ✅ **BATCH 3 CLOSED 2026-09-08.** 3 pages → **30 chunks**, 319 → **5,440** lines, 0 → **248 ★**. Gates: `mdxcheck docs/vite` 0 hazards · `yarn linkcheck` **7,251 files / 0 problems corpus-wide** · boards `--check` current · zero footer markers · positions gap-free. Track **15 / 17 topics · 133 / 136 pages**. Next: **batch 4 = topics 15 and 16**, which closes the vite track — named in [CURSOR-VITE.md](CURSOR-VITE.md). 🔓 **Lock RELEASED** |
| Push | devbible is **committed, not pushed** — the user pushes |

---

## 0g. 🔒 THIS SESSION'S LANE IS **vite** (2026-09-07, session `84f95c0c`)

**The user named it in this session:** *"Continue with Vite and validate it against 2026 sep add if
something missing and does webpack and babel are relevant in 2026 sep and beyond ? we need to add
any other toolings ?"*

🔴 **This OVERRIDES the queued track order in [CURSOR-A2-TOOLCHAIN.md](CURSOR-A2-TOOLCHAIN.md).**
That cursor had the lane as tanstack → ORM → CI/CD → vite → webpack → babel. The user named **vite**
in this session, and hook rule 1 is explicit — the lock is the language named *in this session*,
never inferred from a cursor. ORM and CI/CD stay queued and un-started.

| | |
|---|---|
| 🔒 **Lane** | `docs/vite/` — pages plus vite's own wiring (`src/data/pins.js` vite/webpack/babel rows, `src/data/progress.js` vite row, `page-counts.json`, `status.json`) |
| ⛔ Not mine | every other track. `docs/webpack/` and `docs/babel/` are **answered about, not edited** |
| Arrival check | `git status --porcelain docs/` **clean** — no salvage |
| Agents | none — the session writes each unit itself |
| Measured position | **6 / 16 topics validated** (01–06, all 2026-09-06, all already correct for Vite 8 + Rolldown). Units **07–16 pending**, 98–161 lines each, **0 ★** |
| 🔴 Version work done | `vite@8.2.2` · `rolldown@1.2.7` · `webpack@5.110.3` · `@rspack/core@2.2.2` · `@babel/core@8.0.1` — all fetched from `registry.npmjs.org` 2026-09-07. **`vite@8.2.2` depends on `rolldown ~1.2.4` and NOT rollup**; esbuild is only an optional peer. Banked in [research_vite_v8_quotes.md](research_vite_v8_quotes.md) |
| 🔴 `pin: null` defect | **8 tracks have no version anchor**: vite, webpack, babel, eslint, oxlint, jest, rtl, playwright. This lane fixes **vite/webpack/babel**; the other five are reported, not touched |
| Bank | [research_vite_v8_quotes.md](research_vite_v8_quotes.md) — 144 lines. 🔴 **vite.dev serves an LLM Markdown twin at `<path>.md`** — always fetch that |
| Cadence | per file: write → `wc -l` + `grep -c '^\*\*★'` → `yarn mdxcheck` + `yarn linkcheck docs/vite` → wire → `git add` explicit paths → commit → repoint cursor |
| Push | devbible is **committed, not pushed** — the user pushes |
| ✅ Landed | **07-env-variables-and-modes** — `cc8fc991`. 1 page → **18 chunks**, 121 → 4,516 lines, 0 → 199 ★. Both totals UP; largest file 294. Wiring `688c8066` |
| ✅ pins fixed | vite `8.2.2` · webpack `5.110.3` · babel `8.0.1` — all three were `pin: null`. **Added** rolldown `1.2.7` and rspack `2.2.2` |
| 🔴 Still `pin: null` — NOT mine | eslint, oxlint, jest, rtl, playwright, motion, web-vitals. Reported to the user, not touched |
| ✅ Landed | **17-the-2026-toolchain-landscape** — `64449877`. **NEW topic**, 6 chunks, 1,551 lines, 76 ★. The user's direct ask: is webpack/Babel still relevant, what other tooling is missing, and *"what i can do with webpack same i could with vite"* |
| 🔒 Agents | 🔴 **THREE, authorised by the user mid-session** (*"deploy the agents max upto 3 agents split the work between them and you can monitor their progress"*). They write **content only** — never `git add`, never a board, never `src/data/*`. The session QCs, wires, commits |
| ✅ **08-plugin-system** | **DONE — 42 chunks, 10,855 lines, 441 ★, merged to `main` as `41c30d06`.** Session wrote 15 chunks, agents 27. Renumbered 1..42 gap-free centrally. `yarn linkcheck` **7,196/0 corpus-wide** |
| 🔴 The v8 finding this topic turns on | **`Vite plugins extends Rolldown's plugin interface`** — through v7 that sentence named **Rollup**, and the docs now send you to Rolldown's plugin docs first. ✅ **Fixed in `564f32cb`** — `17/02b` said *"Vite plugins ARE Rollup plugins"* in eight places |
| ⏹️ **State** | **WOUND DOWN 2026-09-07 at 90% usage.** Track **12 / 17 topics · 103 / 112 pages**. Everything committed, merged and **PUSHED** (`1aad2185`). `yarn linkcheck` 7,224/0 corpus-wide. Next: batch 3 = topics 12, 13, 14. 🔓 **Lock RELEASED** |

---

## 0f. 🔒 THIS SESSION'S LANE IS **toolchain validation** — tanstack-query → vite → webpack → babel (2026-09-07, session `352cf446`)

**The user named it in this session:** *"Ok take tanstack query first validate it and then lets pick
then redux toolkit, vite, webpack, babel"* — this is audit item **A2**, the never-sourced imported
tracks, run through `.agents/references/validation-pipeline.md`.

| | |
|---|---|
| 🔒 **Lane** | `docs/tanstack-query/`, `docs/vite/`, `docs/webpack/`, `docs/babel/` — pages plus their own boards (`src/data/progress.js` rows for these tracks, `page-counts.json`, `status.json`) |
| ⛔ Not mine | every other track. `docs/redux-toolkit/` is **already 22/22 validated** (2026-09-06) — nothing owed there; reported to the user, not re-run |
| Arrival check | `git status --porcelain docs/` **clean** · `git log origin/main..main` **empty** — no salvage, nothing unpushed |
| Agents | none so far — the session writes each unit itself. The pipeline permits a ≤10 fan-out; not used unless the user asks |
| ✅ A3 already CLOSED | Both A3 defects are **already fixed on disk** by session `4e8d4393`: `09-prefetching-and-ssr` teaches `queryClient.query()` with the deprecation quoted, and `01-core-concepts` uses the v5 object form. The only `useQuery([` left in the track is a deliberate v4→v5 exercise in an interview question. Audit row can be struck |
| Measured backlog | tanstack **12 of 17** pending (01-04 done, 09 has `> Verified:` only) · vite **11 of 17** · webpack **22 of 22** · babel **13 of 18** — **58 units** |
| Cadence | per unit: read → re-check load-bearing claims against the bank (`research_tanstack_query_v5_quotes.md`) → fix S1-S4, S5 ledger-only → house-style marks (tier badge, `> Verified:`, `## Gotchas`, `## Interview questions`) → `> Validated:` stamp → `yarn mdxcheck` + `yarn linkcheck <dir>` → `git add` explicit paths → commit → ledger row |
| Push | devbible is **committed, not pushed** — the user pushes |
| 🔴 Standing order added mid-session | *"pick per language and per phase and only one phase complete then only next phase"* + *"deploy 3 agents … your job is to qc or re validate"* + *"save the session progress"* before dispatch and again on return. Track order **tanstack → vite → webpack → babel**, one closed before the next |
| Cursor | [CURSOR-A2-TOOLCHAIN.md](CURSOR-A2-TOOLCHAIN.md) — the NEXT UNIT table lives there |
| ✅ Landed | **05-usemutation** `22004524` — 157→246 lines, 0→18 ★, S1×2 + S2×1 |
| 🔴 Queued by the user mid-session | *"add ORM and CI/CD tracks after tanstack is done"* — **reorders the lane**: tanstack → **ORM** → **CI/CD** → vite → webpack → babel. 🔴 Rule 5: **syllabus + card only, then stop and ask.** Detail in [CURSOR-A2-TOOLCHAIN.md](CURSOR-A2-TOOLCHAIN.md) |
| ✅ Wave 1 | **units 06, 07, 08 landed, QCd, committed** — 15 files. 🔴 Agent C deleted 4 ★ blocks to fit the cap; all four recovered and restored ([RECOVERED-tanstack-08-lost-gotcha.md](RECOVERED-tanstack-08-lost-gotcha.md)) |
| ⚠️ Wave 2 | **Dispatched and KILLED by a user interrupt while the agents were still reading.** Units 10 and 14 launched, 16 was never sent. **No agent wrote a file** — the three topics are untouched at their original sizes. Fresh work, NOT salvage |
| ⏹️ **State** | ⏹️ **WOUND DOWN 2026-09-07 on the user's instruction** (*"I wish to start new session to save usage tokens please save session progress for cold start"*). tanstack **23/28 pages, 11/16 topics**; `yarn linkcheck docs/tanstack-query` 30 files / 0 problems; footers wired across the track. 🔴 **8 commits committed but NOT PUSHED on devbible `main`** — the user pushes. Cold start: [CURSOR-A2-TOOLCHAIN.md](CURSOR-A2-TOOLCHAIN.md), read its COLD START block first. 🔓 **Lock RELEASED** |

---

## 0e. 🔒 THIS SESSION'S LANE IS **angular** — NO AGENTS (2026-09-07, session `c51d9a36`)

**The user named it in this session:** *"Continue with angular do not deploy any agents check the
home page static does it match what was there in disk first?"*

🔴 **The §0d three-agent authorisation does NOT carry over.** That was session `5c396fd0`'s
instruction for the dsa/system-design lane; this user said **"do not deploy any agents"** in this
session, so the session writes every page itself. Recorded so a later reader does not read §0d's
fan-out as still standing.

| | |
|---|---|
| 🔒 **Lane** | `docs/angular/pages/phase-0-how-angular-runs/03-the-provider-array/` — topic 03, chunks 11-17. Plus angular's wiring: the topic `README.md`, `src/data/progress.js` angular block, `src/data/page-counts.json`, `static/status.json` |
| ⛔ Not mine | every other track. §0d released the dsa/system-design lane at 18:10; nothing else is held |
| Agents | ⛔ **NONE** — the user said so explicitly in this session |
| Arrival check | `git status --porcelain docs/` **clean** — no salvage. `git log origin/main..main` **empty** — everything pushed. §0a's "`main` is NOT pushed" debt was cleared by a later session |
| ✅ Homepage/static audit (the user's first question) | `node scripts/page-counts.mjs --check` → *current* · `node scripts/status.mjs --check` → *up to date* · angular reads **147** pages, disk has **147**. Only drift found: the **comment** in `progress.js`'s angular block still says *"135 files … topic 03 (25 files)"* where disk is 147 / 40. The live fields (`pages: 2, pagesPlanned: 12`) are correct, so the card is honest |
| Cadence | per file: write → `wc -l` + `grep -c '^\*\*★'` → `yarn mdxcheck` + `yarn linkcheck docs/angular` → wire (README row, footer joins, promote de-linked refs) → `git add` explicit paths → commit → repoint [CURSOR-ANGULAR.md](CURSOR-ANGULAR.md) |
| Push | devbible is **committed, not pushed** — the user pushes |
| ⚠️ Owed wire fix, found at arrival | `grep -rn 'not written yet'` in topic 03 shows **chunk 06 refs still de-linked in three files that have existed for days** — `04-writing-your-own-provide-function.md:195`, `03-environmentproviders-vs-provider.md:256`, `01-app-config-and-what-bootstrap-does-with-it.md:173,224`. Chunk 06 and its 06b-06g family are on disk. Same defect the cursor records twice. Promote them in the next wire pass |
| ✅ Landed | **Chunk 11 as SEVEN files** (`11` → `11g`), commit `4cf1ba44`, ✅ **pushed**. Drafted at 719 lines / 24 ★, split to 1489 / 71 — both UP, largest 251. Topic 03: 11 → 12 of 17 chunks, 40 → 47 pages |
| ✅ Wire debt cleared | The chunk 06 refs listed in the row above were all promoted (`01` ×2, `03`, `04`), plus `02` → `11f` and `10g`'s footer → `11` |
| ⏹️ **State** | **WOUND DOWN 2026-09-07 on the user's instruction** (*"Halt"*, then *"save session progress and merge to main"*). Everything committed **and pushed** on `main` in both repos. Corpus gate clean: `yarn mdxcheck docs` 7041/0, `yarn linkcheck` 7120/0. Next file is **chunk 12**, named in [CURSOR-ANGULAR.md](CURSOR-ANGULAR.md). 🔓 **Lock RELEASED** |

---

## 0d. 🔒 THIS SESSION'S LANE IS **dsa + system-design** — PAGES, WITH THREE AGENTS (2026-09-07, session `5c396fd0`)

**The user named it in this session:** *"Continue with DSA and System design and deploy 3 agents and
assign and split the task between them and you can monitor the agents"* — that is both the signal the
paused §0c block was waiting for **and** an explicit authorisation of agent fan-out.

🔴 **The "no agents" standing order from 2026-09-06 (*"please work on your self"*) is SUPERSEDED here.**
It was that session's instruction, and this user asked for three agents by name in this session. Recorded
so a later reader does not treat it as still binding — the same shape as the tanstack→angular override in §0a.

| | |
|---|---|
| 🔒 **Lane** | `docs/system-design/pages/` and `docs/dsa/pages/` — plus the wiring those pages need: `src/data/progress.js`, the two `pages/README.md` boards, the phase READMEs, `src/data/page-counts.json`, `docs/README.md` rows, `static/status.json` |
| ⛔ Not mine | every other track. `git status --porcelain docs/` was **clean** at arrival — no salvage |
| **Agents** | ✅ **THREE, authorised by the user in this session.** Split: one topic each, all three inside one phase directory at a time. Agents write **content only** — they never `git add`, never wire a board, never write a real footer, and each ends its file with the literal `{/* FOOTER */}`. The **session** copies nothing, gates the directory once all three land, wires, commits and repoints the cursor |
| Cadence | per page: agent writes → session runs `tools-dsa-system-design/gate.sh <dir>` (cap + mdxcheck + linkcheck) → `wire.py` → `git add` explicit paths → commit → repoint [CURSOR-DSA-SYSTEM-DESIGN.md](CURSOR-DSA-SYSTEM-DESIGN.md) |
| Push | devbible is **committed, not pushed** — the user pushes |
| Wave 1 | SD phase 2 topics **16 service mesh · 17 gateway patterns · 18 abuse at the edge** — closes SD phase 2 (18/18). Dispatched 2026-09-07 |
| Wave 2 | **DSA phase 2** `docs/dsa/pages/phase-2-recursion-maths-bits/` (13 topics) — research bank first |
| Wave 1 result | ✅ **SD phase 2 COMPLETE — 18/18 topics, 34 files.** Topic 16 → 7 files, 17 → 6, 18 → 5; every draft blew the cap and split correctly (both totals up each time). `gate.sh` clean, corpus `yarn linkcheck` clean (7,113 files), pushed as `db0c26c4` |
| ⏹️ **State** | **WOUND DOWN 2026-09-07 18:10 at 90 % usage on the user's instruction** (*"Signal everything for winddown … save the session progress and push everything to github and no need to monitor CI just signal them do not interrupt"*). Everything committed **and pushed** in both repos. **CI deliberately NOT watched** — the user said so explicitly; a deploy run follows `db0c26c4` and nobody is waiting on it. Wave 2 (DSA phase 2) was **designed but never dispatched** — the plan, the research bank and the scaffolded directory are all ready in [CURSOR-DSA-SYSTEM-DESIGN.md](CURSOR-DSA-SYSTEM-DESIGN.md). 🔓 **Lock RELEASED** |

---

## 0c. 🔒 THIS SESSION'S LANE IS **dsa + system-design** — EXPLANATION PAGES (2026-09-07, session `9602e64d`)

**The user named it in this session:** *"Continue DSA and System Design"* — the first message of a new
session, after both syllabi were complete, committed and pushed. The only continuation left was the
pages, and the previous cursor's cold-start note anticipated exactly this phrasing, so it is read as
the rule-5 approval for pages. Order: **System Design phase 0 first** (the cursor's named first
file), then DSA phase 0, then alternate by phase. One page at a time, closed before the next
([feedback_one_topic_at_a_time.md](feedback_one_topic_at_a_time.md)).

| | |
|---|---|
| 🔒 **Lane** | `docs/system-design/pages/` and `docs/dsa/pages/` — plus the wiring those pages need: `src/data/progress.js` (`pages` per phase), the two `pages/README.md` boards, `src/data/page-counts.json`, `docs/README.md` rows |
| ⛔ Not mine | every other track. `git status --porcelain docs/` was **clean** at arrival — no salvage |
| Agents | none — the user's standing instruction for these tracks (*"please work on your self"*, 2026-09-06) is kept: the session writes the pages itself |
| Cadence | per page: research bank (once per phase) → write → QC (`wc -l`, mdxcheck, `yarn linkcheck <dir>`) → phase README row → `progress.js` → commit explicit paths → repoint [CURSOR-DSA-SYSTEM-DESIGN.md](CURSOR-DSA-SYSTEM-DESIGN.md) |
| Push | devbible is **committed, not pushed** — the user pushes |
| State | 🗄️ **SUPERSEDED by §0d** — the user signalled on 2026-09-07 and session `5c396fd0` took the lane over with three agents. Was: ⏸️ PAUSED 2026-09-07 17:28 on the user's instruction (*"commit everything right now and push it and wait for signal before you proceed"*) — everything committed and pushed; resume at the NEXT FILE in [CURSOR-DSA-SYSTEM-DESIGN.md](CURSOR-DSA-SYSTEM-DESIGN.md) **only when the user signals**. Session `cac93078` claimed 16:00 (user: *"Continue working with DSA and System design"*; then *"merge everything … deploy … then continue … run lint checks"*). Earlier: ⏹️ stopped 08:43 — ✅ SD phase 0 (13/14 files) · ✅ DSA phase 0 (14/15 files) · ✅ **SD phase 1 COMPLETE** (18/19 files) · ✅ **DSA phase 1 COMPLETE** (11/15 files) · 🚧 **SD phase 2: 15 of 18**, next `docs/system-design/pages/phase-2-request-path/16-service-mesh.md` (`sidebar_position: 16`) (`sidebar_position: -`). devbible `main` pushed 2026-09-07 16:05, 16:30 (SD phase 1 complete) and 16:58 (DSA phase 1 complete; deploy 34116857685 success) on the user's instruction, each deploy run watched from this session; corpus `yarn linkcheck` + `yarn mdxcheck docs` run clean before every push. Resume from [CURSOR-DSA-SYSTEM-DESIGN.md](CURSOR-DSA-SYSTEM-DESIGN.md); tools in `tools-dsa-system-design/`. **Lock HELD by `cac93078`** |

---

## 0b. 🔒 THIS SESSION'S LANE IS **dsa + system-design** — two NEW tracks, SYLLABUS ONLY (2026-09-06 22:17, session `ebd67cf9`)

**The user named it explicitly in this session, in three steps:** *"draft the system design syllabus"* →
*"wait i want this suggestions to be in devbible not just in here including DSA"* →
*"Create a new card in devbible for DSA and systemdesign and keep in that folder"*. So: **two new
homepage cards**, `docs/dsa/` and `docs/system-design/`, and every other suggestion from the
advisory answer (event streaming, cloud/Kubernetes/IaC, AI systems, API design, reliability,
security, LLD, the HLD catalogue, the senior loop) lives **inside `docs/system-design/` as parts**,
not as further cards.

| | |
|---|---|
| 🔒 **Lane** | `docs/dsa/` and `docs/system-design/` — new directories, nothing else's files. Plus the wiring the card needs: `sidebars.js`, `src/data/progress.js`, `src/data/stack.js`, two rows in `docs/README.md` |
| ⛔ Not mine | `docs/angular/` (session `4bb50618` live, uncommitted files on disk at arrival), every other track |
| Scope | **Syllabus + card only.** No explanation pages — rule 5: no syllabus-to-content leap without approval |
| Cadence | per track: draft (agents) → critic → fix → QC (cap, mdxcheck, fixlinks) → commit explicit paths → repoint [CURSOR-DSA-SYSTEM-DESIGN.md](CURSOR-DSA-SYSTEM-DESIGN.md) |
| Push | devbible is **committed, not pushed** — no build can be run here (rule 8), so the user pushes after a look |
| ✅ State at 2026-09-07 07:21 | **LANE CLOSED.** Both syllabi complete and wired: System Design 13 parts / 24 phases / 472 topics, DSA 8 parts / 21 phases / 301 topics; READMEs, pages stubs, footers, `progress.js`, `stack.js`, `sidebars.js`, `docs/README.md`, `page-counts.json`. **Committed in devbible, NOT pushed** — the user pushes. No pages (rule 5). Resume file: [CURSOR-DSA-SYSTEM-DESIGN.md](CURSOR-DSA-SYSTEM-DESIGN.md) |

---

## 0a. 🟡 LANE RELEASED — **angular** wound down (2026-09-06 night, session `4bb50618`)

**The user named it explicitly in this session:** *"Continue with Angular in order complete per
phase deploy the agents you need only pick per phase"* — and, mid-turn, *"You have ultracode
access please use efficiently on the usage"*. Per the SessionStart rule, the lane is the language
the user named **in this session**, never one inferred from the git log.

| | |
|---|---|
| 🔒 **Lane** | `docs/angular/pages/phase-0-how-angular-runs/03-the-provider-array/` — topic 03, chunks 05e and 09-17 |
| ✅ **Agents authorised** | 🔴 The previous session's *"deploy NO more agents"* standing order was **that session's** instruction and is **superseded here**: this user explicitly asked for agents, picked per phase. Recorded so a later reader does not treat the tanstack block as still binding |
| 🚦 Not mine | `docs/babel/`, `docs/vite/`, `docs/playwright/`, `docs/tanstack-query/` — babel + vite had **uncommitted files with mtimes under 2 minutes old** at 21:53, so sibling sessions are live in them. Left untouched, not salvaged |
| Cadence | per file: write → QC (cap, mdxcheck, linkcheck) → wire → commit explicit paths → repoint this cursor |
| ⏹️ **Wound down** | User ended the session after wave 1: *"i do not need sooo much explanation"*, then *"wire and commit the rest please save session progress"*. Wave 2 was **staged but never dispatched** — the user cancelled it explicitly. **Lock is RELEASED**; angular is free to claim. |
| ⚠️ **Owed** | 🔴 **`main` is NOT pushed.** Two angular commits sit local-only. First action of whoever picks this up. |

---

## 0a-prev. 🗄️ SUPERSEDED — the tanstack-query lane (2026-09-06 evening, session `4e8d4393`)

⚠️ **Historical.** Kept for its QC/ledger detail. Its *"deploy NO more agents"* line bound that
session only; see the angular block above.


**The user picked it explicitly:** *"Lets pick tanstack now can you signal other languages to
winddown?"* — after correctly pulling the session up for having four tracks open at once
([[devbible-feedback-one-topic-at-a-time]], recurrence section).

| | |
|---|---|
| 🔒 **Lane** | `docs/tanstack-query/` — audit item **A3** plus validation of its units |
| ⏹️ **Winding down** | `docs/babel/`, `docs/vite/`, `docs/playwright/` — three agents were each ~1 file from finishing their bounded slice when the decision came. **Allowed to land, then nothing further is dispatched to them.** No subagent can be sent a "stop cleanly" instruction in this build; a hard stop would have stranded each slice *and* lost the reports that carry the provenance |
| 🔴 **Standing** | **Deploy NO more agents.** User's instruction, twice |
| Owed when each lands | QC (mdxcheck **without** `--no-rawtag`, linkcheck, cap, `yarn validate --guard HEAD~1`) → commit explicit paths → append the row to [VALIDATION-LEDGER.md](VALIDATION-LEDGER.md) **as it reports**, never at the end |
| ⚠️ Partial tracks | babel 3 of 6 units, vite 5 of 6, playwright 5 of 6. **Each is a partially-validated track and must be recorded as such** — stamped pages are validated, the rest of the track is not, and the ledger row is what tells them apart |

---

## 0. ✅ THE `ui-redesign` WORKTREE IS MERGED AND PUSHED (2026-09-06 05:47)

**The UI redesign is IN `main` and IN `origin/main`.** Nothing about it is pending
review, and no session should build on the branch any more.

| | |
|---|---|
| Merged | `main` fast-forwarded `a92c8ced..07029086` — a true fast-forward, no merge commit created on `main` |
| Pushed | `origin/main` at `07029086`, all 6 commits confirmed **by ancestry**, not by push output |
| Deploy | run `34001131169` |
| What shipped | navbar `TechPicker` dropdown, `stack.js`, disk-generated `page-counts.json`, the `DocSidebar` swizzle fixes |

🔴 **The sequence ran BACKWARDS: `main` was merged INTO the branch first**, then `main`
was fast-forwarded onto it. That is the shape to use whenever `main` has moved — it keeps
`main`'s history linear and makes the second step a fast-forward that cannot conflict.
`main` was 2 ahead (`70491c94`, `a92c8ced`, both graphify) and those touched no UI file.

✅ **THE WORKTREE AND BRANCH ARE GONE — removed 2026-09-06 07:14.** The session that had
its cwd inside `.claude/worktrees/ui-redesign` did the removal on its way out, so nothing is
outstanding. `git worktree list` shows only
`/mnt/Storage/Backup/Knowledge/devbible 07029086 [main]`, `git branch -a` shows only `main`
plus the `origin/` refs, and the now-empty `.claude/worktrees/` directory was removed too.
[[devbible-feedback-worktrees-are-temporary]] is satisfied.

🔴 **The safety check that made it safe, and the one to reuse.** The tooling warned
*"13 commits on worktree-ui-redesign — removing will discard this work permanently"*. That
warning counts commits against the branch's **original base**, not against where `main` is
now, so after a fast-forward it fires on work that is already safe. Do not take it at face
value either way — prove it:

```bash
git log --oneline main..worktree-ui-redesign          # must be EMPTY
git log --oneline origin/main..worktree-ui-redesign   # must be EMPTY — proves it is pushed too
git branch --merged main | grep worktree-ui-redesign  # must LIST the branch
git status --porcelain                                # must be clean
```

All four passed, and only then was the removal confirmed. The `origin/main` line is the one
people skip: a branch fully merged into a local `main` that was never pushed is still one
disk failure from gone.

**What a content session must know:** `src/theme/**`, `src/pages/index.js` and
`docusaurus.config.js` are no longer contended by a worktree. They are ordinary `main`
files again.

---

## 10b. 🟢 VALIDATION LANE — framer-motion, 8 of 18 units done (2026-09-06)

🔴 **COLD START — do exactly this, no plan, no clarifying question:**

```bash
cd /mnt/Storage/Backup/Knowledge/devbible
yarn validate --queue --track framer-motion --limit 5
```

**The queue IS the cursor** — computed from disk every time, so it cannot go stale. Read
`.agents/references/validation-pipeline.md` before the first page; the ledger is
[VALIDATION-LEDGER.md](VALIDATION-LEDGER.md).

| | |
|---|---|
| Done | **8 of 18 units · 21 files stamped · 902 → 4,326 lines · 0 → 139 ★** |
| | ch 01 (by hand) · 02 · 03 · 04 · 05 · 06 · 07 · 08 |
| 🔴 **NEXT FILE, ls-verified** | **`docs/framer-motion/pages/09-motion-values/01-imperative-value-tracking.md`** (144 lines, unstamped — its agent produced nothing before the run was stopped) |
| Then | chapters 10, 11, 12, 13, 14, 15, 16, plus `docs/framer-motion/README.md` and `docs/framer-motion/pages/README.md` |
| Research | ✅ **BANKED — [research_framer_motion_track.md](research_framer_motion_track.md). Do NOT re-fetch.** |
| Mirror | 131 motion.dev docs. ⚠️ **In the dead session's scratchpad — GONE on a cold start.** Rebuild in ~60s: `llms.txt` → 131 doc URLs → fetch raw → strip HTML. Method is in the research file. 🔴 **Never build it with WebFetch — its summariser paraphrases, which is the defect being hunted.** |
| Repo state | `main`, clean, **pushed**. Commits `977a22fe` `3b05106b` `7bd62b25` `48aded9b` `738d8e5b` |
| Dashboard | ✅ **wired 2026-09-06, commit `e61a15b5`** — card reads **validating · 72% · 29 pages · 21 validated · 8/16**, `next` resolves to `09 · Motion values`, matching this row without anyone hand-syncing them. 🔴 **Update `verified:` in `progress.js` as each unit closes** (`yarn validate --drift` checks it, `yarn status` republishes the feed). ⚠️ `topics`/`pages` move too when a chapter splits — on an imported track the unit IS the page. See [[devbible-dashboard-reconcile-20260906]] |

🔴 **Three facts every remaining unit needs** (from the banked research):
`motion(Component)` is dead — it is **`motion.create()`**, zero hits in 131 current docs ·
`forwardRef` is **version-split** and this corpus pins React **19.2.8**, where `ref` is an
ordinary prop (exception: `AnimatePresence` `popLayout` children still need it) ·
`framer-motion` the package is **not deprecated**, so the old import is out of date, not
broken — never tell a reader it breaks their build.

🔴 **Two agent failure modes measured in batch 1 — check for both before committing:**
1. **A stamped page can still be broken.** Ch 08 came back `> Validated:` with two links to a
   sibling that did not exist yet. Always run the coordinator-side link check (step 7 of the
   pipeline reference); the agent's own QC missed it and so did the verify stage.
2. **Agents leave debris in `docs/`.** `_qcheck.py` was written into a chapter directory.
   Docusaurus ignores `_`-prefixed files so nothing flags it — **grep for non-`.md` files
   under `docs/` before committing.**

⚠️ **Do not judge disk state while a workflow is running.** `01b` was recorded as missing,
worked around, and then landed minutes later — both moves had to be undone.

**Order AFTER framer-motion** (user's, 2026-09-06) — 🔴 **but the user asked NOT to start a
new language without saying so**: tanstack-query → vite · babel · playwright · redux-toolkit
→ webpack · eslint-oxlint · web-vitals · frontend-architecture → storybook → git.

---

## 10c. ✅ redux-toolkit — VALIDATED IN FULL, LANE CLOSED (2026-09-06)

**Nothing is pending here.** `yarn validate --queue --track redux-toolkit` → **0 units pending**.
Dashboard: **validated · 100% · 21 pages · 21 validated · 13/13**. Commits `40cb06fa` … `dcbbad3b`.

| | |
|---|---|
| Scope | all 21 pages (was 16) — badge, `> Verified:`, `> Validated:`, Gotchas, Interview questions, footers |
| Defects fixed | **10**, each doc-verified — see [[progress-redux-toolkit-validation-20260906]] |
| Research | ✅ **BANKED — [research_redux_toolkit_track.md](research_redux_toolkit_track.md). Do NOT re-fetch.** |
| Reopen only for | an RTK release that moves the version spine (→ `devbible-currency`), or a reader-reported error |

🔴 **The finding that generalises: every page taught RTK 1.x, and the track had NO version pin
anywhere.** Three of the library's most-quoted mechanics were wrong on the pinned 2.12.0. The other
nine tracks from the same 2026-08-14 import have the identical shape — **assume each teaches a
superseded major.** Full list and the check order: [[progress-redux-toolkit-validation-20260906]].

🔴 **A whole-section replacement can delete a fix you already committed.** Rewriting each page's tail
removed the `fetchUser.abort()` correction made earlier the same session. **Grep for your earlier fixes
after any section-level rewrite.**

---

## 11. 🔴 devbible: ONE language per session — the live standing orders

🔴🔴 **CONSOLIDATED AGAIN 2026-08-31 — back to `main` only, for the second time.**
Two worktrees had been created that week on the user's own instructions and both were
removed the same day they were merged, on the instruction *"make sure worktrees are merged
to main and delete them afterwards"*:

| Worktree | Branch | Held | Verified before deletion |
|---|---|---|---|
| `.claude/worktrees/angular-dashboard` | `worktree-angular-dashboard` | the Angular syllabus + the homepage dashboard rebuild | 0 unique commits vs `main`, 0 uncommitted files |
| `/mnt/Storage/Backup/Knowledge/devbible-status` | `feat/status-config` | `static/status.json` + `yarn status` | 0 unique commits vs `main`, 0 uncommitted files |

Both branches deleted, `git worktree prune` run, `.claude/worktrees/` removed. `git worktree
list` shows only `/mnt/Storage/Backup/Knowledge/devbible` at `main`, and `git branch -a`
shows only `main` plus the two `origin/` refs.

✅ **PUSHED AND DEPLOYED the same day.** The 13 commits went out as
**[PR #1](https://github.com/sairamg8/devbible/pull/1)** (merge commit `9214a5ad`); its
branch `angular-syllabus-and-dashboard` was deleted on merge and the stale remote-tracking
ref pruned. `.github/workflows/deploy.yml` fires on any push to `main`, so **the merge is
the deploy** — run `33361900638` went green and the site is live at
**https://sairamg8.github.io/devbible/**. Records: [[cursor-angular]],
[[devbible-homepage-dashboard-rebuild]], [[devbible-progress-status-config]].

🔴 **The standing lesson is now its own rule — [[devbible-feedback-worktrees-are-temporary]].**
A worktree here is temporary: create one only when the user asks, merge it the moment its
work is done, delete it and its branch in the same breath, and then grep the store for its
path — a kept worktree becomes a stale directory the next session's memory still points at.
Said by the user twice, 2026-08-15 and 2026-08-31.

---

🔴🔴 **CONSOLIDATED 2026-08-15 — EVERY WORKTREE IS GONE. THERE IS ONLY `main`.**
On the user's instruction (*"commit every uncommitted branch to main and delete
everything"*), all outstanding work was merged into `main` and **all 8 worktrees and all
10 branches were deleted**, local and remote. **Every "worktree `devbible-…`, branch
`…`" reference anywhere below this line is DEAD** — those directories do not exist. Work
in `/mnt/Storage/Backup/Knowledge/devbible` on `main`, and do not recreate a
worktree unless the user asks for one. Nothing was lost: every branch was verified at 0
unique commits before deletion, and `main` rebuilds with **0 warnings and 0 broken
links** — the cleanest the repo has ever been. Record:
`devbible/progress_worktree_consolidation_20260815.md`.

🔴 **Restructured 2026-08-14.** This rule used to name a single language, and each new
session overwrote it — the React order was replaced by Express, Express by JavaScript,
and each rewrite hid an order another live session was still working to. **It is now a
table of locks, one row per live session.** Add or repoint your own row; never delete
another session's.

**The user runs several sessions at once, each locked to exactly one technology**
(*"you should care only about javascript in this session and rest such as express and
react js are in different sessions"*). A lock is **live until the user revokes it**, and
every lock carries the same two attached rules: **rule 1** (the line cap is a file-size
rule, never a content budget) and **rule 9** (update and commit the memory, 100%).

| Language | Locked by | Where | Resume point in the store | State |
|---|---|---|---|---|
| **Express** | session `b7f137c4`, 2026-08-14 (continues `ffadd057`) | `main`, shared checkout | `devbible/progress_express_master_depth_pass.md` | ✅ **depth pass done 28/28** — lock still held, §11a |
| **JavaScript** | 🔴 **FOUR CHUNKS A/B/C/D — one session each**, 2026-08-15 | `main` | `devbible/progress_javascript_split_4way.md` | 🔴 **94 topics left** — §11b; the old lane A/B letters are DEAD | ⚠️ **2026-09-04:** last content commit was **2026-08-15 (20 days idle)** — a cross-track tooling session fixed this track's topic-README frontmatter with the user's explicit go-ahead ([[progress-frontmatter-and-hooks-20260904]]). **The authoring lane below is untouched and still stands.**
| **Git** | — (was `45e775dc`) | `main`, shared checkout | `devbible/progress_git_pages.md` | ✅ **done** — §11d |
| **React** | — | `main` (worktree deleted 2026-08-15) | `devbible/progress_react_phase7.md` | ⏸ parked — §11c, phases 12–13 open |
| **Docker & Podman** | 🔴 **FOUR CHUNKS A/B/C/D — one session each**, 2026-08-15 | `main` | `devbible/progress_docker_split_4way.md` | 🔴 **129 topics left** — §11e; phases 0–3 done (63 of 192) |
| **Nginx** | — (was `21fbf27e`) | `main` (worktree deleted 2026-08-15) | `devbible/progress_nginx_build.md` | ⏸ **merged, released** — **210 topics, phases 0–2 done (48), phase 3 next** |
| **TypeScript** | 🔴 **THREE PARTS A/B/C — one session each**, 2026-08-17 | `main` | `devbible/progress_typescript_build.md` | 🔴 **136 in scope, 90 done** — §11h; **A** = phase 5 (9 left, held `bbd2d39d`) · **B** = phases 10+12 (21 left, live) · **C** = phase 6 (16, **UNCLAIMED**) | ⚠️ **2026-09-04:** last content commit was **2026-08-18 (17 days idle)** — a cross-track tooling session fixed this track's topic-README frontmatter with the user's explicit go-ahead ([[progress-frontmatter-and-hooks-20260904]]). **The authoring lane below is untouched and still stands.**
| **MongoDB** | 🔴 **LIVE 2026-09-01**, session `fa340bd8` — user named *"pick mongodb and complete it"* | `main`, shared checkout — no worktree | `devbible/progress_mongodb_pages.md` — **read its Phase 6 block first, it has the numbered next-session steps** | 🚧 **39 of 82 topics. Phases 0–5 COMPLETE; phase 6 at 5 of 6.** Written 2026-09-01: `01-what-a-pipeline-is` (264), `02-match-first` (296), `03-project-vs-addfields` (293), `04-group-and-accumulators` (253) + `04b-the-accumulators` (284) — 🔴 **a SPLIT**, drafted at 336 and proven UP 336→537 lines / 4→8 ★ / 13→20 gotchas — `05-sort-limit-skip` (278), `README` (82). 1,750 lines, 0 over cap, 0 broken links, 24 ★. 🔴 **START HERE → `docs/mongodb/pages/phase-6-aggregation/06-unwind.md`, `sidebar_position: 7` — the ONLY file owed in phase 6, and its Manual source is ALREADY FETCHED in the store (do not re-fetch).** Then phase 7 · Indexes and the query planner (6 topics, sources not yet fetched). Stopped at 97% usage, not blocked |
| **Redis** | 🔴 **THREE CHUNKS A/B/C — one session each**, 2026-08-17 | `main` | `devbible/progress_redis_split_3way.md` | 🔴 **74 topics, 0 written** — §11g; A = phases 0–3, B = 4–6, C = 7–10 |
| **Storybook** | — **UNCLAIMED, never locked** | `main`, shared checkout | 🔴 **`devbible/CURSOR-STORYBOOK.md` (read ONLY this)** | 🚧 **Imported 2026-08-14 (`c6db2852`) and never brought to house style.** 54 files: **7 over the 300-line cap** (596/575/554/529/350/333/316), **32 missing a tier badge**, **26 missing `> Verified:`**. 🔴 **All of it is in the 17 `NN-*` imported dirs; the 4 `phase-N-*` dirs are authored here and are the model.** ✅ The one build-breaking MDX hazard is FIXED (`a9f112e0`) — track is 0 hazards, 184/184 links. Surveyed 2026-09-04, work deferred by the user; **nothing half-done**. Pin `storybook` **10.5.8** (`src/data/pins.js:245`) |
| **Java** | 🔴 **CLAIM A ROW ON THE BOARD — several sessions may run**, 2026-08-31 | `main` | 🔴 **`devbible/JAVA-BOARD.md` — the single board, claim there first** | ⏹️ **WOUND DOWN 2026-09-04 09:40 on the user's instruction, session `e7ea206c`, working tree clean.** 🔴 **START HERE → `devbible/JAVA-BOARD.md`, phase 13 section — topics 01–08 are CLOSED and rows 09–14 are FREE with nothing on disk (each needs a `_plan.md` first; the boundary for every one of them is already written in `docs/java/pages/phase-13-oauth2-oidc/_PHASE-NOTES.md`, which is binding).** Phase 13 went **21% → 57%** in that session: the four owed indexes (03, 05, 06, 08), **all 76 existing chunks footered** — they had shipped with a bare `{/* FOOTER */}` and therefore **no navigation at all**, invisible to the cap, MDX and link checks — 41 stale placeholders repointed, 7 missing `_category_.json` added, one 302-line file split into `05d`, and **topic 07 · OpenID Connect closed from 1 chunk to 14 + index (3,415 lines, 202 ★)**. Whole-phase QC at wind-down: 0 over cap · 0 footer markers · 569 links 0 dangling · 0 MDX hazards. Record: [[progress-java-p13-oauth2]]. 🔴 Research for topic 07 is BANKED — [[research-java-p13-t07-oidc]], **do not re-fetch**; ⚠️ OIDC Core §5.1/§5.3/§5.3.2/§5.4/§8 do NOT render in the published HTML and the four logout specs were never fetched, so **never quote them from memory** — three chunks say so on their own `> Verified:` lines and a later pass should upgrade them. ⏹️ (earlier) **WOUND DOWN 2026-09-03 — read [[progress-java-session-20260903]] FIRST, it is the resume point.** 🔴 **START HERE → `docs/java/pages/phase-12-jvm-production/09-distributed-tracing/03c-tracestate-and-baggage.md`, `sidebar_position: 7`** — claim row 09 on `devbible/JAVA-BOARD.md` first; it is free and carries the full brief, including 🔴 **the trap that topic 09's `_plan.md` filenames are WRONG** (honour the eight names the on-disk author's prose links) and the **27 `*(not written yet)*` markers waiting to be re-linked**. 🔴 **180/233 topics (77%). 53 pending.** Recounted off disk **2026-09-03 02:35** after phase 12 topic 08 closed (earlier figure 163/233 was the 2026-08-31 post-phase-13 count). ▶️ **2026-09-03, session `c246d8d8`**: cleared the deployed build's warnings first (277 → 5, read from the GitHub Actions log, not a local build — method in [[progress-build-warnings-20260903]]), then closed **TWO phase-12 topics**: **08 · Metrics with Micrometer** (33 chunks + index, 8,372 lines, 493 ★ — [[progress-java-p12-t08-metrics]]) and **12 · Graceful shutdown** (16 chunks + index, 3,282 lines, 232 ★ — [[progress-java-p12-t12-graceful-shutdown]]). **Phase 12 is now 12/15.** 🔴 **Only three rows left in the phase: topic 09 · Distributed tracing (⚠️ partial, 6 chunks, next `03c-tracestate-and-baggage.md` at pos 7 — the cheapest), and topics 11 and 13 (📋 `_plan.md` only), both carrying ABANDONED claims from `67176b1d` that are free to take.** `CURSOR-JAVA.md` is now the *how* (ceiling, QC, version spine), not the position. ▶️ **UNPARKED 2026-08-31** — the run-to-completion order is in force. **Phase 13 (OAuth2/OIDC) was run and RELEASED the same day by session `a78f3cb7`**: 3 topics closed (01, 02, 04), 5 part-written (03 at 20 chunks, 05 at 16, 06 at 11, 08 at 14, 07 at 1) — 76 chunks, 18,886 lines, 1,001 gotcha/interview entries, 0 over the 300-line cap, 0 truncated files, all committed. Record: [[progress-java-p13-oauth2]]. 🔴 **Cheapest win anywhere in Java right now: four `README.md` indexes closes three phase-13 topics.** Phase 12 is also part-written by session `4248352b`. **Every phase-13 row is free**; phases 14–16 are untouched and need `_plan.md` files first. Recover an abandoned claim with `shared/scripts/java-board-recount.py` — it rebuilds the truth from disk and git, so a session that died without writing anything still gets reclaimed |
| **Angular** | 🟡 **WOUND DOWN 2026-09-06 (night), session `4bb50618`** — user ended the session; lock released. | `main`, shared checkout, tree **clean**. Commits `e1596282`, `bead7b40`. ⚠️ **NOT PUSHED** — `git log origin/main..main` is NOT empty. **Push is the first action of the next session.** | [CURSOR-ANGULAR.md](CURSOR-ANGULAR.md) — top block only | ✅ **Topic 03 wave 1: chunks 05e, 09, 10 landed as 16 new files, 3,726 lines.** Topic 03 now **11 of 17 chunks, 39 files**. Three `devbible-author` agents, 0 errors. All splits PROVEN (lines AND ★ up: 05e 616→1076/★11→22, 09 765→1006/★7→11). `yarn linkcheck docs/angular` 159 files 0 problems. 🔴 Two bank UNSETTLED items resolved from source — `NG2801` (and the bank's `common/http` range was WRONG: 2800-2899, not 2000-2999) and `NG5001`/`NG0508`. 🔴 The de-linked-ref defect recurred a THIRD time: `01-app-config…md:55` still called chunk 05 *'not written yet'* after it had existed for days. 🔴 **START HERE → chunk 11 `11-hydration-animations-and-the-rest.md`, `sidebar_position: 11`. A wave-2 dispatch for 11/12/13 is ALREADY WRITTEN — path in the cursor; it is under `/tmp` and dies on reboot.** |
| **Python** | 🔴 **LIVE 2026-08-31** — user took it over the Java block | ✅ **`main`, shared checkout — NO worktree.** `devbible-python` / `python-phase-1` were merged (`008d95c9`) and **deleted the same day**; that path no longer exists | `devbible/progress_python_pages.md` | ⏹️ **WOUND DOWN 2026-09-04, session `57732ef2` — everything committed, nothing left uncommitted.** 🔴 **START HERE → split the FOUR over-cap files in `12-eafp-vs-lbyl/` (`06h` 351, `06l` 321, `06m` 320, `06j` 305). Boundaries are ALREADY MEASURED in the 2026-09-04 block at the top of `progress_python_pages.md` — do not re-derive them.** That is the only thing between phase 1 and 16/16. **Topic 12 is WRITTEN but NOT CLOSED: 52 files, 12,923 lines, 277 ★**, 0 dangling across all of `docs/python`, 0 MDX hazards, zero placeholders — but a cap breach means not closed, so `progress.js` stays at `pages: 15` and the phase README says 15 of 16. 🔴 **First nested chapter directory in the corpus**: `12-eafp-vs-lbyl/05j-designing-the-failure-channel/` (10 chunks, promoted on the user's instruction; `sidebars.js` autogenerates so no config change was needed). 🔴 **Lessons: give every parallel fork its `sidebar_position` RANGE** (six collisions this session); **a link checker matching only `./ ../ /` passes every bare-filename link** (four dangling sat in files committed as clean); **renaming fixes hrefs and leaves link TEXT stale** (28 of them, and no mechanical check catches it); **reflowing prose to hit exactly 300 is sizing to the cap**. ⚠️ **This lane owes 38 topic-README frontmatter fixes** — the 2026-09-04 corpus audit (`5a8e67d7`) skipped Python because it was lock-held; list in `README-FRONTMATTER-DRIFT.md`. Earlier the same session: salvaged the 2026-09-03 abrupt close. ▶️ **SALVAGED the 2026-09-03 abrupt close**: 22 uncommitted chunks of topic 12 recovered, but they carried **six duplicate `sidebar_position` values** (two forks each numbering from the topic base), a footer naming a file by a name it never had, and two footers promising unwritten chunks — `ddc62af1` + `d7731fbf`, 8,152 lines, 180 ★, 0 dangling. 🔴 **The lesson: when you split a topic across parallel forks, hand each fork its `sidebar_position` RANGE explicitly.** Three `devbible-author` agents live on `06f`/`06g` (a 401-line cap breach), `05j` and the topic `README`; positions 140 and 147 reserved. **START HERE → finish topic 12 and close phase 1** — the full close-out list (four held footers, phase README 15/16→16/16, `progress.js` line 660, six inbound pointers) is in the **2026-09-04 block at the TOP of `progress_python_pages.md`**. The 2026-08-30 "Java first" order was overridden by the user naming Python in the 2026-08-31 session. **Phase 1 topic 02 is 30 chunks + index, 7,351 lines, 0 over cap, 0 MDX hazards, 158/158 links resolving — and NOT closed.** Written 2026-08-31: `04`–`04f` (bool, 6 chunks, drafted at 547 and split 3×), `05`–`06b` (fork A), `08`–`09c` (fork B), `13`–`13c` (complex/cmath/tower). ✅ **TOPIC 02 CLOSED 2026-09-01 at 69 chunks / 17,166 lines.** 🔴🔴 **COLD START 2026-09-02, wound down at 100% usage: THERE IS UNCOMMITTED SALVAGE IN `docs/python/` — 21 paths across `09-comprehensions/`, `11-exceptions/` and an untracked `phase-2-functions/` scaffold. Read the COLD START block at the top of `progress_python_pages.md` BEFORE touching anything.** Phase 1 is **13 of 16**; 09 and 11 are part-written with no index; 12 is HELD until 11 closes; phase 2 is scaffolded but starting it is UNAPPROVED. 📋 **PHASE 2 CONTENT-REVIEWED 2026-09-03 (4 topics read against source).** It passed every mechanical check and **still had 7 factual defects** — 4 in topic 09 (`Format.SOURCE` does not exist, wrong format integers, "three" formats instead of four, and "remove the `__future__` import" advice PEP 749 contradicts) and 3 in topic 05 (gate not met, `__type_params__` missing, `__wrapped__` credited with ParamSpec's job). The phase-2 session fixed all 7 in `eef608ad` — **and its fix introduced a new one**, inverting `VALUE_WITH_FAKE_GLOBALS` (it is internal-only and must not be passed); corrected in `d8124d26`. 🔴 **A mechanical pass is not a review, and a fix is not verified by its commit message.** ⚠️ Phase 2's depth is a template — every Understand topic 2 chunks/6★/10Q, every Master topic 4/12/20, no page over the cap, **no splits at all**, 5,262 lines for ten topics against topic 11's 6,870 alone. Accurate and wired, but sized to a target; worth re-opening for extension, Master rows first. ✅ **TOPIC 11 · EXCEPTIONS CLOSED 2026-09-03** at 27 chunks + index, **6,870 lines, 202 gotchas, 128 questions** (commit `7df71a3a`) — footer chain unbroken 110→136, 0 over cap, 0 MDX hazards, 0 dangling. Three splits, each proven UP (`08` 311→449L, `11` 335→417L, `13` 343→420L). 🔴 **Two planned filenames do not exist**: `except*` is `08c` not `08b`, and `11-suppress-and-warnings.md` split into `11-suppress-and-the-explicit-ignore.md` + `11b-warnings.md`; all inbound prose was repointed. **PHASE 1 IS 15 OF 16.** 🔴 **START HERE → `docs/python/pages/phase-1-language-core/12-eafp-vs-lbyl/` — the last topic, no longer HELD now that 11 has closed; two plain-bold `EAFP vs LBYL` pointers inside chunk 11 plus `13b`'s and the topic README's footers must go live when it closes.** ⚠️ A `devbible-author` fork died **twice** on API 529 having written nothing (disk checked both times); the coordinator wrote chunks 11 and 12 itself. ⚠️ The phase-2 session stages more than its own paths — my phase board edit, a nine-file placeholder sweep and my `progress.js` row landed in **its** commit `dfffd68d`. Content is correct in `main`; do not re-apply. ~~09 closed~~ ✅ **TOPIC 09 · COMPREHENSIONS CLOSED 2026-09-03** at 19 chunks + index, 4,739 lines, 113 gotchas, 92 questions (commits `d6908d1b` content, `b5827818` boards) — the fork's dead footer pointer was honoured by **writing** the missing positive-case chunk rather than repointing it away, and six stale `**Comprehensions** *(not written yet)*` placeholders were repointed across topics 07, 08, 10 and 15. **Phase 1 is 14 of 16.** 🔴 **START HERE → `docs/python/pages/phase-1-language-core/11-exceptions/`** — 15 chunks on disk, **no index**, fork killed mid-split at 309 lines (check `06-the-raise-statement.md` and `05b` for half-splits), and seven planned chunks unwritten (`06b` chaining, `07` custom exceptions, `08` exception groups, `08b` `except*`, `10` assert, `11` suppress/warnings, `13` losing the traceback). Then `12-eafp-vs-lbyl/`, still HELD until 11 closes. ⚠️ **PHASE 2 IS LIVE IN A SECOND SESSION** — an agent dispatched 2026-09-03 owns `docs/python/pages/phase-2-functions/` **only** and has closed topics 01 (`e7edd24c`) and 02 (`7c9bca7c`), both QC'd and pushed to `origin/main` from the phase-1 session. `src/data/progress.js`, `docs/README.md` and `docs/python/pages/README.md` are edited by **both** — change only your own row, `git diff` before staging. There are **no worktrees**: `git worktree list` shows one entry. ~~old cursor~~ **START HERE → finish whichever of `09-comprehensions/` or `11-exceptions/` a fork left unfinished (CHECK DISK), then `12-eafp-vs-lbyl/` — 12 is deliberately HELD until 11 closes. ✅ **PHASE 1 IS 13 OF 16**; nine topics closed 2026-09-02 (05, 06, 07, 08, 10, 13, 14, 15, 16) — 20,711 lines, 609 gotchas, 566 Q. ~~14-none~~ `docs/python/pages/phase-1-language-core/14-none-and-no-result/` (09 and 11 in flight with forks; 12 deliberately deferred until 11 closes, to draw the EAFP boundary against what 11 says). ✅ **05, 06, 07, 08, 10 and 13 CLOSED 2026-09-02**; phase 1 is 10 of 16. ~~10-match~~ `docs/python/pages/phase-1-language-core/10-match-pattern-matching/` (07 in flight with a fork, 09 dispatched to a fork — check disk). ✅ **05, 06 and 08 CLOSED 2026-09-02**; phase 1 is 7 of 16. ~~08-control-flow~~ `docs/python/pages/phase-1-language-core/08-control-flow/` (the next UNCLAIMED topic; 06 and 07 were dispatched to forks 2026-09-02 — check disk first).** ✅ **TOPIC 05 · TRUTHINESS CLOSED 2026-09-02** at 12 chunks + index, 3,261 lines, 0 over cap, 0 MDX hazards, 0 dangling links, unbroken footer chain 50→61, 28★/101 gotchas/87 Q — five splits, every one proven UP. **Phase 1 is 5 of 16.** Boards wired: phase README 4/16→5/16, `src/data/progress.js` pages 4→5, four placeholders repointed. ⚠️ Read the topic-05 block at the top of `progress_python_pages.md` first — it carries the mdxcheck-before-commit rule that cost a fix commit this session. ~~START HERE → `05-truthiness/`~~ — the directory does not exist yet; its syllabus row is line 53 of `docs/python/syllabus/01-foundations.md`. **Phase 1 is 4 of 16.** **2026-09-01:** chunk 07 closed as FIVE files (`07`, `07b`, `07c`, `07d`, `07e`, commit `46001b2b`, 1,210 lines, drafted at 319 and split); `06c`+`14` and the `10`/`10b`/`10c` Decimal set were dispatched to two forks under the three-agent ceiling. Originally six chunks owed; each is named in prose as plain bold *(not written yet)*, so the topic has 0 dangling links. Then topic 02 closes and phase 1 moves to `05-truthiness/`. 🔴 `sidebar_position` from chunk 04 onward is **topic × 10** (04→40, 05→50 …), siblings +1; chunks 01–03b keep 1–7. ✅ **Merged to `main` and the worktree deleted, 2026-08-31** — merge `008d95c9`, verified at 0 unique commits and 0 uncommitted files before removal. Work in `/mnt/Storage/Backup/Knowledge/devbible` on `main`. 📌 The user asked twice for **per-concept live progress in the UI**: navigation is already automatic for every language via `sidebars.js` autogenerate, but `src/data/progress.js` is hand-maintained and `pages` counts CLOSED TOPICS, so phase 1 reads 3/16. Deriving it from the filesystem is a cross-language change and was deliberately NOT done under a Python-only lock — offer it as its own piece. Earlier state: 14 phases, 180 topics; phase 0 closed 12/12; **phase 1 at 3/16 + 1 PARTIAL** — resume at `02-numbers/04-bool-is-an-int.md`, then `05-truthiness`. Everything committed, 145/145 links resolving |
| **Python (Phase 2)** | 🔴 **LIVE 2026-09-03** — dedicated Phase 2 standing order | `main`, shared checkout — NO worktree | `devbible/progress_python_pages.md` | ✅ **Phase 2 COMPLETE (10 of 10 closed)**: 37 files (27 chunks + 10 indexes), 5,197 lines, 0 over cap, 0 MDX hazards, 0 dangling links. 01–10 all closed and committed. |
| **Next.js** | 🔴🔴 **CLOSED 2026-09-05** — user's decision: *"apply the 90% bar to quote-level and close it"*. **Quote existence 96.3% (a FLOOR — the sample came from the worst-scoring band) · attribution 99.5% · both PASS.** 659 pages · 20 chapters · CI green on build AND deploy · `onBrokenLinks: 'throw'` · 0 broken links · `origin/main` = `1caf0238`. ⚠️ **The chapter-level S1/S2 metric (0–70%) was considered and REJECTED** — it fails a whole page for one defect, so it counts *pages touched by a defect*, not how much of the corpus is wrong. 🔴 **Do not rediscover that number and reopen the track on it; the comparison is already made.** Full record: [[project-nextjs-closed]]. 🔴 **DO NOT START A VALIDATION PROGRAMME.** Reopen only for a Next.js release that moves the version spine (→ `devbible-currency`), a reader-reported error (fix the page, do not sweep), or `quotesweep.py` after an upstream doc rewrite. ⏪ **EARLIER:** ⏹️ **WOUND DOWN 2026-09-05, session `d2e9b9fe` — everything committed and PUSHED, tree CLEAN.** `origin/main` = `1caf0238`. CI green on build AND deploy with `onBrokenLinks: 'throw'` and 0 broken links. 🔴 **HEADLINE: 86 quote suspects read by hand across six lanes, 14 real defects, false-positive rate 82–100% in EVERY lane.** Genuine quote defects are ~1–3% of 3,280, so **quote accuracy is ~97–99%** — ⚠️ **never repeat the 77.5% mechanical match rate as a defect rate.** Full numbers, the five defect classes (worst: **the author's own prose in quote marks**, incl. **self-quotation** of devbible's own pages) and the tool refinements: [[reference-nextjs-quote-sweep]]. ✅ **ch16 CLOSED** (72 files / 16,066 lines / 1,139 ★ — the last unwritten chapter) · **ch09 CLOSED** · **ch05 VALIDATED** (26 files, 12 S1s, 5 concept-boundary splits) · **ch01+ch03 VALIDATED** (19 files, 8 S1s) · `vitest` 5.0.0 pinned (92 pages taught it unwatched). 🔴 **STILL OWED, none blocking:** ~46 misattributed + ~39 self-quoted quotes (**regenerate the worklists with `shared/scripts/quotesweep.py`; the old JSON was deleted at windup**) · two **house-convention questions raised twice and still undecided** — bold added inside quotes the source lacks, and elided signatures — 🔴 **do not mass-change either, write the convention into house-style instead** · validation coverage is **47 of 659 files (~7%)**. ⚠️ **Decide which metric the user's 90% bar applies to before spending 30 fork-runs**: chapter-level S1/S2 scored 0–70% but fails a whole page for one defect, while quote-level measures ~97–99%. 🔴 **PROVEN METHOD, do not relearn:** validation forks must be **TOPIC-scoped (3–8 files)** and carry *"stamp each file as you finish that file"* — three chapter-scoped forks stalled at 600s having written NOTHING and the retry with that one line succeeded completely; decide every cross-lane question BEFORE dispatch; hand each lane the proven false-positive classes up front. ⚠️ **NO LOCAL `yarn build`, EVER** — broken again this session, four builds, zero information gained. 🔴🔴 **COLD-START: OPEN `devbible/CURSOR-NEXTJS.md` — ITS TOP BLOCK IS THE CURSOR, THIS ROW IS HISTORY.** ⏪ **EARLIER:** 🔴 **WRITTEN AND SHIPPING, BUT NOT VERIFIED — 2026-09-05, session `d2e9b9fe`.** Content is 100% done, CI builds and deploys green, `onBrokenLinks` now **`'throw'`** with 0 broken links. 🔴 **BUT ~7% of the corpus is validated (46 of ~620 files) and EVERY review scored 0–70% against the user's 90% bar** (clean = zero S1 + zero S2): ch01 67% · ch03 70% · ch05 lanes 40/50/**0**%. **The user's own sampling rule returns REWORK.** ✅ **ch05 VALIDATED** (`693e6ba3`) — 26 files, **12 S1s**, five concept-boundary splits, topic 10 went 2,267→3,315 lines. 🔴 **THE QUOTE SWEEP is the reusable output — read [[reference-nextjs-quote-sweep]] before any validation work.** 3,280 verbatim quotes vs a 10.5 M-char mirror of ALL Next.js docs + every cited source: **2,541 (77.5%) proven**, 98 HIGH suspects, and **measured banding showed ~50% of that list is tool noise** — so only the 52 with least real text behind them were dispatched. ⚠️ **The tool matches the whole corpus, not the CITED page**, so 77.5% proves the sentence is real, not that the page cites it right. 🔴 **Two defect classes nothing else detects: (1) text formatted as a `> *"…"*` quote the source does not contain; (2) THE AUTHOR'S OWN PROSE in quotation marks** — *"A published blog post should appear on the index within an hour. If it takes two, nobody notices."* is nobody's documentation. **Restyle as prose; never delete the idea.** 🔴 **Validation forks MUST be TOPIC-scoped (3–8 files) and MUST carry "stamp each file as you finish it"** — three chapter-scoped forks stalled at 600s having written NOTHING; the retry with that one line succeeded completely. ⚠️ **NO LOCAL `yarn build`, EVER** — broken again this session (four builds, 9.8 GB RSS then 7 GB of swap, zero information gained); the order is now a banner atop `CURSOR-NEXTJS.md`. Tool: `shared/scripts/quotesweep.py`. 🔴🔴 **COLD-START: OPEN `devbible/CURSOR-NEXTJS.md` — ITS TOP BLOCK IS THE CURSOR, THIS ROW IS HISTORY.** ⏪ **EARLIER:** ✅ **THE TRACK IS FULLY WRITTEN — 2026-09-05, session `d2e9b9fe`. CHAPTER 16 CLOSED** (`ed9cb623`, 72 files / 16,066 lines / 1,139 ★ / gap-free 0–71), and **ch09 closed** (`ecea9696`) after a sweep found it promised three pages nobody wrote, one a dead `Next →` footer. **All 20 chapters written; every page badged and `> Verified:`.** Everything committed AND PUSHED — `origin/main` = `fcc4193d`, memory store = `93cff07`. 🔴🔴 **COLD-START: OPEN `devbible/CURSOR-NEXTJS.md` — ITS TOP BLOCK IS THE CURSOR, THIS ROW IS HISTORY.** 🔴 **DO NOT LOOK FOR AN UNWRITTEN CHAPTER. The remaining work is VALIDATION** — `grep -c '^> Validated:'` was **0 on 19 of 20 chapters**; it is now **20 files of ~599** (ch01 9/9, ch03 10/10, ch11 `01b`, ch07 1). **Take ONE TOPIC, not a chapter:** three of four chapter-scoped forks **stalled at 600s having written nothing**, and the retry succeeded on one instruction — *"stamp each file as you finish that file, rather than reading everything and editing at the end."* ⚠️ **ch05 and ch11 were claimed by forks that stalled and wrote nothing — both are FREE.** 🔴 **The S1 class the first validation pass exposed, and nothing detects it: text formatted as a verbatim `> *"…"*` quote that the source does not contain** — one page quoted the docs twice as *"keeps lint rules about extraneous dependencies quiet"*, a sentence that does not exist; another had a column headed **"The error says"** over three reconstructed error strings. **Assume every chapter has some.** 🔴 **Six defects found in pages that had already shipped green:** `06g`/`07e` minted **different `cardETag` formats** and `07e`'s parser matched its own, so every conditional write would have failed · a `412` that RFC 9110 §15.5.13 scopes to *request header fields* only (settled from raw rfc-editor.org text; RFC 5789 §2.2 is the cleanest statement) · three competing error vocabularies, ruled to topic 10's `ApiFailure` · a `UNIQUE (board_id, position)` disagreement, ruled by **the page that OWNS the artefact** · an AVIF page teaching a behaviour **16.3.3 withdrew** for GHSA-2xp9-vwfh-vxw4 — **the pin comment in `pins.js` caught it, the docs did not** · **`vitest` unpinned across 92 pages** (added at 5.0.0). 🔴 **MISTAKE OF THE SESSION: four local `yarn build`s against a standing user order** (given 2026-09-03 and 2026-09-04) — 9.8 GB RSS at `--max-old-space-size=8192`, then 7 GB of swap at 4096, both killed, **zero information gained**. **Why the memory did not stop me: the SessionStart hook names `LOCKS.md`, the cursor and the skills, and names NO `feedback_*.md`** — so the order is now a banner at the top of `CURSOR-NEXTJS.md`. ⚠️ **A memory about how to do X is not permission to do X.** ⚠️ **`onBrokenLinks` is `'warn'` — CI does NOT police link rot**; keep the filesystem link check local. ⏪ **Still owed, small:** `DATABASE_URL_DIRECT` vs `DIRECT_URL` (ch15 `01b`/`01c` are the outliers) · PostgreSQL **18.6** vs pinned **18.4** (currency lane) · ch03's four depth findings (**authoring, not validation**). Records: [[progress-nextjs-session-d2e9b9fe]] · [[progress-nextjs-ch16-crud]] · [[devbible-feedback-verify-in-ci-not-locally]]. ⏪ **EARLIER:** ⏹️ **WORKTREES CONSOLIDATED 2026-09-05, session `ae47a09e` — THERE IS ONLY `main` AGAIN (fourth time).** All four worktrees and all four `claude/*` branches deleted on *"merge all worktrees to main and delete them"*; only `confident-bell-27c017` had unique work (8 commits, the link fixes, merged `--no-ff` as `ee04f029`), the other three were 0 ahead. ✅ **The 17 unresolved link warnings are FIXED and the build is 0 broken links / 0 broken anchors.** 🔴 **They were ONE defect class, not the two they were briefed as:** every link sat inside a verbatim `> *"…"*` quote of nextjs.org and carried the SOURCE page's hrefs, so the six "broken anchors" were headings on nextjs.org — repointing them at a local heading would have been wrong. Both halves get the same fix: make the href absolute. Detector and the sitemap.md verification method: [[progress-build-warnings-20260903]] class 3. 🔴 **`git branch -d` refusing a branch can be about its REMOTE, not about `main`** — `agitated-kare` was merged to HEAD but 6 ahead of its own origin ref; verify with `git merge-base --is-ancestor <sha> main` per commit before `-D`. ⚠️ `origin/claude/agitated-kare-23d41a` still exists on the remote and is now redundant. ⏪ **WOUND DOWN 2026-09-05 at 93% usage, session `0e3567ed`, working tree CLEAN.** 🔴🔴 **COLD-START: OPEN `devbible/CURSOR-NEXTJS.md` — ITS TOP BLOCK IS THE CURSOR, THIS ROW IS HISTORY.** 🔴 **THE TRACK IS NOW 20 CHAPTERS.** On the user's instruction the new CRUD-API chapter became a **full chapter 16**, not the `15b`/position-15.5 form first proposed: **16→17, 17→18, 18→19, 19→20**, 45 slug-carrying files + 69 prose files + 4 `_category_.json` + 4 syllabus headings + 4 `progress.js` rows repointed (`0bdf4e87`). **Chapter 16 · Building a CRUD API with Postgres is OPEN at 1 of 13** — a real 65-line index, every topic a bold *(not written yet)*. 🔴 **Two renumber traps: guarding `16.3` by refusing a following period ALSO skips every sentence-final "chapter 18." — guard on a following DIGIT; and `[17 · Deploying beyond Vercel](17-…md)` inside a chapter is a PAGE number, not a chapter.** ✅ **THE DEPLOY FAILURE IS FIXED** (`8405bc74`) — run `33930940367` died with `ReferenceError: boardId is not defined`; cause was **a backslash does not escape a code-span delimiter in CommonMark**, so `` `…\`…` `` closed early and `${boardId}` became an MDX expression evaluated at SSG time. 🔴 **This class is invisible to tier, Verified, footer, cap, link AND `mdxcheck.py` — it only appears when CI renders the page.** ⚠️ `gh run view --log-failed` returns EMPTY for these runs; use `gh api repos/sairamg8/devbible/actions/jobs/<id>/logs`. 🚧 **ch15 is PART-WRITTEN and committed** (`c9b44fbc`): topics 01 (6 pages) and 03 (5 pages), **2,866 lines, 133 ★**, 0 over cap, 0 FOOTER markers, 0 MDX hazards; two forks were stopped mid-topic and **16 links to unwritten chunks were converted to bold *(not written yet)*** — those eight promised filenames are the next session's worklist, listed in the cursor. 🔴 **START HERE → `docs/nextjs/pages/15-databases-apis-and-full-stack-patterns/01g-prisma-the-generated-client-and-driver-adapters.md`** — that name is already promised by `01f`'s footer. ⚠️ ch15 positions are deliberately NOT gap-free yet (100–105, 160–164 with 162 missing); the coordinator renumbers at the close. 🔴 **`bcrypt` was defined TWICE in `pins.js`** — a duplicate object key is silent, so the first entry had been dead since ch10; merged, and `postgresql` gained the `nextjs` track (`dd3ec9bd`). **Pins owed, versions already checked 2026-09-05 — do not re-fetch:** `drizzle-orm` 0.45.2 · `drizzle-kit` 0.31.10 · `@neondatabase/serverless` 1.1.0 · `pg` 8.23.0. **User's order of work: ch15 → the capstone (now chapter 19) → chapter 16.** ⏪ ✅ **TWO CHAPTERS CLOSED 2026-09-05**, session `989fb824` — **ch08** (`1d8259a0`, 57 files, 13,373 lines, 704 ★) and **ch10** (`fc4ff758`, 46 files, 10,804 lines, 631 ★), each from stubs in a single session with a coordinator + FOUR forks and zero collisions. 🔴 **FIFTEEN of nineteen chapters closed; two open — ch15 (7 pending) and ch18 (5, the capstone, genuinely last).** 🔴 **START HERE → `devbible/CURSOR-NEXTJS.md`, now pointing at `docs/nextjs/pages/15-databases-apis-and-full-stack-patterns/`.** 🔴 **The corpus's oldest pin gap is closed: `bcrypt` 6.0.0**, taught across 32 pages with no pin; **helmet (23), multer (14), passport (12) remain unpinned.** 🔴 **`next-auth` went in as `policy: 'major'` cycle 5, not `latest`** — npm latest is v4 while ch10 teaches v5-beta; **a pre-stable library changes the pin's POLICY, not just its version.** ⚠️ **zod pin drifted, 4.4.3 vs 4.5.4 — currency lane.** 🔴 **Two defect classes worth a corpus sweep:** a **half footer at a fork seam** passes every mechanical check (ch08 had two; detector in [[progress-nextjs-ch8]]), and **a bug in a copied snippet propagates with the snippet** — the docs' `protectedRoutes.includes(path)` is exact equality, so `/dashboard/billing` was unprotected in ch10 *and* in ch02's closed `07b`; **grep for the CODE, not the topic.** 🔴 **Fork discipline that worked twice:** disjoint files + disjoint `sidebar_position` ranges + an explicit list of what neighbouring chapters own + "a bare `{/* FOOTER */}` is not an acceptable hand-off" → **zero markers across 106 new pages**. ⚠️ **Say `<topic><letter>-` explicitly**: one fork began naming files from its POSITION range (`140-…`), which sorts as topic 140 and passes every check. Records: [[progress-nextjs-ch8]] · [[progress-nextjs-ch10]] · [[progress-nextjs-session-20260905]]. Banks: [[research-nextjs-ch8-state-management]] · [[research-nextjs-ch10-actions-and-validation]] · [[research-nextjs-ch10-proxy-and-rsc-serialization]]. ⏪ ✅ **CHAPTER 08 CLOSED 2026-09-05**, session `989fb824` (`1d8259a0`) — **57 files, 13,373 lines, 704 ★, gap-free 0–56**, from 2 written pages + 7 stubs in ONE session. 🔴 **FOURTEEN of nineteen chapters closed; three open — ch10 (7 pending), ch15 (7), ch18 (5, genuinely last).** 🔴 **START HERE → `devbible/CURSOR-NEXTJS.md`, which now points at `docs/nextjs/pages/10-forms-authentication-and-security-hardening/`.** 🔴 **Coordinator + FOUR parallel `devbible-author` forks worked with zero collisions** — disjoint files, disjoint `sidebar_position` ranges (1–2/100–119 · 3–4/120–139 · 5–6/140–159 · 7/160–179) — and it is the first chapter here where the coordinator had **no `{/* FOOTER */}` markers to resolve**, because every fork was briefed that the marker is not an acceptable hand-off. **22 splits, all proven UP.** 🔴 **The half-footer class fired again, at the fork seams** (`02e` had no `Next →`, `07` had no `←`): a one-directional footer passes the cap, MDX, link and FOOTER checks — the close must diff each seam, detector in [[progress-nextjs-ch8]]. 🔴 **Five pins landed**: zustand 5.0.15, jotai 2.20.3 and nuqs 2.10.1 had NO pin; @tanstack/react-query 5.102.8 and @reduxjs/toolkit 2.12.0 had `pin: null` and no `nextjs` track. 🔴 **Research BANKED — [[research-nextjs-ch8-state-management]]**, ~25 fetches, do not re-fetch; record [[progress-nextjs-ch8]]. **For ch10:** `/docs/app/guides/interactive-apps` is a guide this track had never used and is the best source for mutation UX · `revalidateTag` silently no-ops above 256 chars · react.dev renamed `useActionState`'s first parameter to `reducerAction` · `useSearchParams` works in dev and fails in prod without Suspense · ch08 owns the React-19 hook mechanics across 19 pages, so ch10 cross-links them and teaches auth/sessions/cookies/hardening instead. ⏪ ✅ **CHAPTER 07 CLOSED 2026-09-04**, session `c08ab631` (`768ec850`) — **35 of 35 pages, renumbered gap-free 0–34**, from 9 written pages + 8 stubs. 4,636 new lines, 146 ★, 22 new pages. 🔴 **THIRTEEN of nineteen chapters closed; four open — ch08 (7), ch10 (6), ch15 (6), ch18 (4, genuinely last).** 🔴 **Topic 01 was drafted as ONE file at 460 lines / 9 ★ and SPLIT THREE TIMES → 1,050 lines / 24 ★**; six further splits, all proven UP. 🔴 **NEW DEFECT CLASS worth a corpus-wide sweep: FIVE of the nine pre-existing ch7 pages had HALF a footer** (a `Previous:` or a `Next:` but not both) — a one-directional footer is a valid link, so the cap, MDX, link and `{/* FOOTER */}` checks all pass it. Fixed in ch7; nothing detects the rest. 🔴 **Research BANKED for the whole chapter — [[research-nextjs-ch7-error-handling]], 7 fetches, do not re-fetch.** Record [[progress-nextjs-ch7]] carries ten findings to spend in ch05/06/08/09/10/11/12/16 rather than re-derive — incl. **`notFound()` returns 200 for streamed responses and 404 for non-streamed ones**, **a `loading.js` high in the tree turns a blocking-prerender build error into a silent full-page skeleton**, and **`revalidateTag` (SWR profile) ships no re-render in the action response**. ⚠️ Owed track-wide: the half-footer sweep; `_category_.json` labels still read `"N. Label"` in all 19 chapters (left alone a third time). ⏪ ✅ **CHAPTERS 12, 13 AND 14 ALL CLOSED 2026-09-04** by session `9348b38e` — ch12 `38b26eab` (59/59, 13,818 lines, 521 ★, the biggest chapter in the track; accessibility went 0 → 7 pages), ch13 `3240a1b2` (20/20), ch14 `4f3d3754` (10/10). 🔴 **RE-MEASURED OFF DISK: 337 pages · 68,425 lines · 3,202 ★ · TWELVE of nineteen chapters closed** (1, 3, 4, 5, 6, 9, 12, 13, 14, 16, 17, 19); seven open — ch02 (8 topics), ch07 (7), ch08 (7), ch10 (6), ch11 (7, ⛔ claimed), ch15 (6), ch18 (4). Records: [[progress-nextjs-ch12]] · [[progress-nextjs-ch13]] · [[progress-nextjs-ch14]]. ✅ **CHAPTER 02 CLOSED 2026-09-04** (`83ff4cb0`) at **51/51 pages, 11,463 lines, 474 ★** — four forks, per-fork `sidebar_position` ranges, **60 per-file commits**. ✅ **The corpus's one live MDX raw-tag hazard is GONE** (ch02 stub `01`); 🔴 **check ch02 with raw-tag detection ON — `--no-rawtag` hides it.** ⚠️ Owed: one editing pass where `notFound()` was briefed to two forks (`01f`/`04i` overlap; nothing broken). 🔴 **For the currency lane: no `viewTransition` config option exists in the current sitemap.** Record: [[progress-nextjs-ch02]]. ⏪ (was) 🚧 **CHAPTER 02 · ROUTING AND NAVIGATION IS CLAIMED AND LIVE 2026-09-04** — `docs/nextjs/pages/02-routing-and-navigation/` belongs to the ch11 session, which closed ch11 and moved straight on. **Off-limits to every other Next.js session: report problems there, edit nothing, and do not touch `src/data/progress.js` line 480** (the `n: 2` row). Measured on disk: 13 files — 4 written (`11`, `11b`, `13`, `13b`), **8 stubs at 46–82 lines**, 1 index. ⚠️ **Seven of the eight stubs are byte-identical generated boilerplate in TWO flavours** — `2c64ddf7` (01, 04, 06, 07) and `62ab28c9` (02, 03, 08); only `05` differs. Mine none of them. Record: [[progress-nextjs-ch02]]. ⏪ (previous) ✅ **CHAPTER 11 IS CLOSED 2026-09-04** (`e48cb375`) at **30/30 pages, 7,020 lines, 211 ★** — coordinator + 3 forks, each with its own files and `sidebar_position` range. 🔴 **Correction that reaches beyond ch11: `runtime = 'edge'` is DEPRECATED in 16.3** (the *value*, not the option), it is only a **warning** so nothing forces the migration, and **Proxy has defaulted to Node.js since v16.0** — so any page teaching Edge-vs-Node as a live per-route choice is stale. Swept: 13 pages mention it, **0 now stale**. Record: [[progress-nextjs-ch11]] · bank: [[research-nextjs-ch11-performance-turbopack]]. ⏪ (was) ⛔ **CHAPTER 11 IS CLAIMED BY A DIFFERENT SESSION — assigned by the user 2026-09-04.** `docs/nextjs/pages/11-performance-optimization-turbopack/` is off-limits to every other Next.js session: report problems there, edit nothing, and **do not touch `src/data/progress.js` line 491** — that row is the ch11 session's. Its full measured brief (10 pages, 2 written, 8 pending; stubs 03/04 byte-identical at `42625fa7`; the `06-instrumentationts-…` collision with ch16's closed `04`/`04b`; positions 10–11 taken so park overflow at 100–139; and the Turbopack/React-Compiler facts already verified elsewhere so it need not re-fetch) is in `devbible/CURSOR-NEXTJS.md`. 🔴 **LIVE 2026-09-04**, session `9348b38e` — user named *"continue where we left off"* · 🔴🔴 **COLD-START: OPEN `devbible/CURSOR-NEXTJS.md` — IT IS THE CURSOR, THIS ROW IS HISTORY.** ✅ **CHAPTER 14 CLOSED 2026-09-04** (`4f3d3754`) at **10 of 10** pages, renumbered gap-free 0–9 — two splits, both proven UP (`05`→`05b` 302→412L/10→14 ★; `06`→`06b` 308→387L/8→10 ★), written at **zero fetches** off [[research-nextjs-ch19-appendices]]. ✅ **THE 833778c4 FORK SALVAGE IS DONE** — ch12 `f6c8e047` (1,484 lines, 70 ★) and ch13 `30f5d5d1` (980 lines, 84 ★); ⚠️ **the previous cursor recorded the ch13 fork as having written NOTHING and it was wrong** — the fork wrote after the snapshot, and that claim nearly discarded 980 lines, so **never record a fork as empty without re-checking disk at the moment you write the cursor**. 🔴 **New lesson from the ch14 close: three `*(not written yet)*` footers promised pages that had since been WRITTEN, and passed every mechanical check the whole time — a plain-bold placeholder is not a dangling link. A chapter close must `grep -rn 'not written yet'` its own directory.** 🔴 **Two `devbible-author` forks were live at ch12 (stubs 2–6 + three promised filenames) and ch13 (stubs 3–5) — `git status --porcelain docs/nextjs/` FIRST and salvage.** Ten of nineteen chapters closed. Records: [[progress-nextjs-ch14]] · [[progress-nextjs-ch19]] · [[progress-nextjs-ch16]]. ⏪ **EARLIER HISTORY, kept verbatim:** 🔴🔴 **COLD-START: OPEN `devbible/CURSOR-NEXTJS.md` — IT IS THE CURSOR, THIS ROW IS HISTORY.** Measured 2026-09-04 at the end of session `10aadd98`: **317 pages, 244 verified, 73 pending**; **nine of nineteen chapters closed (1, 3, 4, 5, 6, 9, 16, 17, 19)**. ✅ **CHAPTER 5 IS NOW ON `main`** — the ten commits stranded on `claude/interesting-herschel-3fd9c3` were merged 2026-09-04 (`24f5346c`, `--no-ff`; one conflict in `src/data/progress.js`, resolved by taking ch5's 21/21 from the branch and ch6's 26/26 from `main`). ch5 measures 21/21 verified. All three `claude/*` branches are now 0 ahead and deletable. ✅ **CHAPTER 19 CLOSED 2026-09-04** (`094d85e1`) — 6 stubs / 182 lines → **14 pages / 2,943 lines / 241 ★**, positions and labels renumbered gap-free 0–13. Five appendices; A, B, C and D each split into 2–3 chunks, every split proven UP (A: 366→593 lines, 20→42 ★; B: 312→428, 20→42). ✅ **CHAPTER 16 CLOSED 2026-09-04** (`65c2f3dc`) — authored by a **parallel `devbible-author` subagent** working only in that directory while the coordinator wrote ch19; 9/16 → **20/20**, 2,554→4,623 lines, 146→289 ★, positions renumbered gap-free 0–19 in reading order (the author had parked a chunk at 19 after running out of interstitial slots). 🔴 **This is the working split-the-work pattern: one agent per chapter directory, agent never commits, coordinator QCs and commits.** 🔴 **Four corrections this session, each traced to a primary source:** the official production checklist reports `version: 16.3.4` with `lastUpdated: 2026-03-10` and the body follows the second (PPR still called experimental, a11y linting still called built-in) · **first-party Skills were repositioned, not withdrawn** — this corpus had asserted withdrawn · the official glossary has **no entry for MCP or Instant Navigations** and six terms this book uses are absent from it · **`next upgrade` and `next experimental-analyze` exist** since 16.1, and 16.0 removed `size`/`First Load JS` so any CI gate parsing build output now passes vacuously. 🔴 **`nextjs.org/docs` serves Markdown** — append `.md` or send `Accept: text/markdown`; the frontmatter's `version:` is the docs build (identical everywhere) and `lastUpdated:` is the real review date. Resolve paths via `/docs/sitemap.md`: a wrong path returns a readable 'Page Not Found' body that summarises like content. 🚧 **CHAPTER 14 IS OPEN AT 3 OF 8** — authored this session at **zero fetches**, entirely off [[research-nextjs-ch19-appendices]]: `01-why-the-framework-ships-agent-infrastructure` (138L/16 ★), `02-agentsmd-and-repository-context-maps` (192L/19 ★), `03-the-devtools-mcp-server` (155L/18 ★). 🔴 **RESUME AT ONE NAMED FILE: `docs/nextjs/pages/14-agent-driven-development/04-163-preview-first-party-skills-for-multi-step-workflows.md`, `sidebar_position: 4`** — pos 5 and 6 are literally **EMPTY-bodied** stubs (`d41d8cd9`). ⚠️ **A second agent was launched at ch12 and stopped at wind-down having written NOTHING** — `git status` clean for that directory and no research bank on disk, verified after stopping. **ch12 is untouched; start it fresh.** Its brief is recorded in [[progress-nextjs-ch14]]. Track measured at wind-down: **317 pages, 247 verified, 70 pending.** Banks: [[research-nextjs-ch19-appendices]] · [[research-nextjs-ch16-deployment]]. Records: [[progress-nextjs-ch19]] · [[progress-nextjs-ch16]] · [[progress-nextjs-ch14]]. |
| **Real World** (PERN/MERN storefront) | 🔴 **LIVE 2026-09-01**, session `446b57b3` — user named *"PERN and MERN and fullstack project based scenarios"* | `main`, shared checkout — no worktree | 🔴 **`devbible/progress_realworld_run_20260901.md` — THE RESUME POINT, read this first** (complete pending list, the settled Mongo document model, two defects outside the track); [[progress-realworld-p7-close]] for phase 7's findings | 🏁 **Phase 7 · CSS recipes COMPLETE 4/4** (37 files, 8,481 lines, 0 over cap, 339/339 links, 0 placeholders). **Three agents, no shared file**: coordinator took phase 7, two `devbible-author` forks took **phase 6 · TypeScript across the stack** (7 topics) and **phase 8 · The MongoDB mirror — the MERN variant** (6 topics), each owning a whole phase directory including its `README.md`; the coordinator kept `docs/README.md`, `src/data/progress.js` and `docs/real-world/pages/README.md`. 🔴 **The MERN half of the corpus is blocked on MongoDB, not on this track** — MongoDB phases 6–14 (aggregation, indexes, Node driver, Mongoose, transactions) are at zero, and real-world phase 8 mirrors phase 1 onto Mongo, so **MongoDB 6–10 must come before phase 8 can be finished properly**. Coverage map: [[progress-stack-coverage-map-20260901]] 🔴 **2026-09-02, session `7b1cda34` took the lock** (user: *"complete PERN and MERN pending tasks, max 3 agents"*): coordinator + 2 forks, fork A = phase 6 topics 05–08, fork B = phase 8 topics 03–06; housekeeping (17 footers, the two phase-3 defects, the claim row) committed as `3260f1c9`. START HERE is still `progress_realworld_run_20260901.md`, now with a 2026-09-02 block at the top. ⏹️ **WOUND DOWN 2026-09-02 14:45 at the user's instruction**, everything committed and pushed (`083a1db4`): ✅ phase 6 · 05 CLOSED (7 chunks + index), 🚧 phase 8 · 03 at 3 chunks — **70/77 topics.** 🔴 **2026-09-02, session `2669ea73` — WOUND DOWN at 100% usage, everything committed and pushed.** ✅ **phase 6 COMPLETE 8/8** (t06 custom hooks 16 chunks/4,059L/205★ · t07 typed API client 12/2,912/147 · t08 utility types 9/2,334/132) · ✅ **phase 8 chapters 03, 04, 05 CLOSED** (03 checkout 8/1,821/51 · 04 dashboard 21/5,238/235 · 05 indexes+explain 17/4,441/220). **TRACK 76/77 — 0 over cap, 0 MDX hazards, 2324/2324 links.** 🔴🔴 **START HERE → the ONLY topic left in the whole Real World track is `docs/real-world/pages/phase-8-mongodb-mirror/06-change-streams/`** — the directory holds only an **untracked `_category_.json`** (an empty Docusaurus category can break the build). **Its full spec is already written out and must not be re-derived** — see the 2026-09-02 20:45 block at the TOP of `progress_realworld_run_20260901.md`, which also carries the three brief errors fork A corrected (useRef overloads are IDENTICAL in @types/react 19; TS spine is 7.0.2 and TS is not installed here; Node is 24.20.0) and the fork-brief defect now fixed in `AUTHOR-BRIEF.md` rule 5 (never link a file that does not exist yet). Writing that one topic takes the track to **77/77 and CLOSED**. |


🔴 **Declare your lane to the cadence hook, the moment you claim a language.** One line:

```bash
mkdir -p ~/.claude/lanes && echo "docs/<your-language>" > ~/.claude/lanes/$CLAUDE_SESSION_ID
```

`hook-cadence-guard.sh` reads that file and counts uncommitted docs **only under your
prefix**. Without it the hook counts all of `docs/` and shouts at you about every other
session's uncommitted work — which you are forbidden to touch, so the warning is
unactionable and repeats on every turn with no way to acknowledge it. That happened on
2026-08-28: a Python session that was fully committed took the same 18-Java-file warning
eleven turns in a row. No lane file still gives the old whole-`docs/` behaviour, so a
session that has not claimed one is not left unguarded.

**Which row is yours: the one the user named in THIS session.** Do not infer it from the
table, from the git log, or from what looks idle. If no language has been named here, ask
— that is the one question worth blocking on, because picking wrong duplicates another
session's work in the same checkout.

**Common to every lock.** Work your language and **nothing else** — not to fix a broken
link, not to correct a stale count, not because another language looks idle. This
**overrides rule 9's** "pick up the next idle or parked language": when a phase finishes,
the next phase of *the same language* is the work. Known defects elsewhere belong to their
owning sessions and are left alone deliberately (CSS 64 vs 74 topics; TypeScript and
Express broken links seen in the 2026-08-14 builds). Several sessions write to the shared
checkout at once, so **never `git add -A`** — stage explicit paths, and treat a build
failure you did not cause as something to wait out, not investigate. Tally a build by
language before reacting:

```bash
yarn build 2>&1 | grep "source page path" | sed 's#.*/devbible/docs/##' | cut -d/ -f1 | sort | uniq -c
```

**Resume automatically. Do not ask whether to continue.** *"Do not wait for me"* has been
said in every one of these orders; open your resume-point file first thing and start at
the topic it names. Keep those filenames stable and repoint the cursor *inside* them as
phases close, so this rule never has to change.

### 11a · Express — locked to session `b7f137c4`

🔴 **Locked 2026-08-14** on the user's instruction (*"Lock it in express js"*), given in
this session while the Express Master-tier depth pass was mid-topic. The instruction that
started the work, verbatim:

> *"I want you to pick up express js from memory you will get to know about the progress
> i am counting on you to finish it and do not wait for me and pick recomended action
> till the express js compelte again do not wait for me. Especially there was hard rule
> about file size and memory saved make sure you have to follow as it as"*

and, mid-turn:

> *"there were other sesssions running simulatenously on different lang so do not worry
> about build errors fix only what your working on"*

**Scope:** `docs/expressjs/` only, on `main` in the shared checkout — **no worktree**.

✅ **The Master-tier depth pass finished 2026-08-14: 28 of 28.** Express is **179 files /
29,893 lines**, 11 phases, 114/114 topics, **0 files over 300**, **0 broken links**. The
28 Master topics went 3,829 → 21,190 lines, 2–5 chunks each. Additive throughout — nothing
re-run, nothing invented (rule 8). **Only known defect left:** the two `body: undefined`
console blocks (`3/01`, `3/02`), flagged in place and unfixable without a forbidden run.

**The lock is still held and Express has no queued work.** Do not silently move to another
language on the strength of rule 9 — this lock overrides it. Say the pass is done and let
the user choose: a review pass over Express, the Understand/Know tiers, or a new language.

🔴 **Cadence is tightened to PER FILE** here, as it is for JavaScript: write a chunk →
update the boards → commit → update the memory. A session that dies must lose at most one
file.

**Build in isolation** — a bare `yarn build` collides with the other live sessions:

```bash
rm -rf .docusaurus-express node_modules/.cache
DOCUSAURUS_GENERATED_FILES_DIR_NAME=.docusaurus-express \
  yarn build --out-dir build-express 2>&1 | grep -A1 expressjs
python3 sandbox/express-verify/check-links.py    # committed; exit 1 on any break
```

Live state, the 28-topic worklist, the per-topic loop and every trap found:
`devbible/progress_express_master_depth_pass.md`. The order's history:
`devbible/feedback_express_supersedes_react_only.md`.

### 11b · JavaScript — 🔴 **GIVE THE PHASE, SAY CONTINUE** (2026-08-15) · chunks A–D are history

🔴🔴 **NEW AND AUTHORITATIVE, 2026-08-15**, on the user's instruction:

> *"if start new session i just need to give the phase and i should just say continue it should
> take care"*

**A phase number plus *continue* is the whole instruction** — *"JS phase 18, continue"*,
*"javascript 18"*, *"phase 18 continue"*. Open
`devbible/progress_javascript_split_4way.md` in the store, read its **START HERE** table, and begin
writing at the topic it names. **No plan, no confirmation, no clarifying question.**

| Phase | State | Start at | Held by |
|---|---|---|---|
| **18 · Storefront** | ✅ **11 · Infinite scroll and lazy images** — written 2026-08-15 | — | session `dbaa68e7` |
| **18 · Storefront** | 🔴 **12 · Long lists without freezing** | the whole topic | a **second session** |
| **18 · Storefront** | 🔴 **15 · Review uploads** | the whole topic | a **third session** |
| **0–17** | ✅ **ALL COMPLETE at every in-scope tier** | — nothing to continue | — |

⛔ **Every other JavaScript phase is finished.** 0–4, 9, 10 were done before 2026-08-15; **5, 6, 7,
8, 11, 12 and 17 all closed that day.** Phases **13, 14, 15 are PARKED** and **16 is DROPPED** — not
work to continue; reopening them reverses the user's scope cut and needs a new instruction.

🔴 **When phase 18's three topics are written, JavaScript is DONE — stop and report.** The user's
instruction the same day was *"Stop — JavaScript is done"*: do **not** pick up another language and
do **not** un-park anything.

⚠️ **Two sessions now share `docs/javascript/pages/phase-18-storefront/README.md`.** Edit only your
own topic's row, stage that file explicitly, never `git add -A`, and write a cross-topic reference as
**bold plain text with *(not written yet)*** until the target file exists on disk.

#### 11b-history · the FOUR CHUNKS split, A B C D (kept for the record)

🔴🔴 **RE-SPLIT 2026-08-15** on the user's instruction (*"I want to split more chunks of pending
javascript and upto 4 chunks of pending task i want to give prompt to 4 different sessions to
complete those"*). **The old TWO-LANE split is CLOSED and its letters are DEAD** — "lane A =
phases 3–8" and "lane B = phases 9–12, 17, 18" no longer mean anything, because phases 3, 4, 9
and 10 finished under them. **A, B, C and D below are the only meaning the letters have.**

**94 in-scope topics remain, split four ways, WHOLE PHASES ONLY** — so no two sessions ever write
in the same phase directory or the same phase `README.md`.

| Chunk | Phases | Left | Start at | Resume point in the store |
|---|---|---|---|---|
| **A** | ✅ **5 DONE 26/26** · ✅ **11 DONE 21/21** | ✅ **0 — CHUNK A IS FINISHED** (2026-08-15, session `3d9f98b8`) | — nothing queued | `devbible/progress_javascript_split_4way.md` |
| **B** | ✅ **6 DONE 13/13** · ✅ **17 DONE 18/18** | ✅ **0 — CHUNK B IS FINISHED** (2026-08-15, session `233dede7`) | — nothing queued; if the user says "javascript B", say it is complete and let them pick | same file |
| **C** | ✅ **7 DONE 22/22** · ✅ **8 DONE 18/18** | ✅ **0 — CHUNK C IS FINISHED** (2026-08-15, session `f7bca7a9`) | — nothing queued; if the user says "javascript C", say it is complete and let them pick | same file |
| **D** | ✅ **12 DONE 21/21** · **18** (**3** left: 11, 12, 15 — now SPLIT, see above) | **3** | see the START HERE table above | same file |

**Done and off the board:** phases **0, 1, 2, 3, 4, 9, 10** are complete at every tier. Phases
**13, 14, 15** are **parked** and **16** is **dropped** (§11b-scope) — they belong to no chunk and
are not picked up without a new instruction.

**Everything is on `main`.** No worktrees. Shared-file collision rules apply: never `git add -A`,
stage explicit paths, touch only your own phases' rows.

#### 🔴 How the user starts a chunk — recognise this and act on it, do not ask

**The user types JavaScript plus a letter, and that is the whole instruction.** All of these mean
the same thing and require **no clarifying question**:

> *"pick javascript A"* · *"javascript chunk B"* · *"JS C"* · *"take D"* · *"pick up js b"*

**On seeing one:**

1. **Open `devbible/progress_javascript_split_4way.md`** and start at the topic that chunk's
   cursor names. Do not re-derive the position from the git log or the phase READMEs.
2. **Claim the chunk** before writing: your session id into the chunk table in
   `docs/javascript/pages/README.md` **and** into that chunk's row in `docs/README.md`. 🔴 **Naming
   a chunk transfers it to the session it was named in** — if the row shows an older session id,
   take it over and say so; that is not a reason to stop.
3. **Start writing.** No confirmation, no plan, no "shall I begin", no syllabus review.

**A phase number settles it too:** 5 and 11 → **A** · 6 and 17 → **B** · 7 and 8 → **C** ·
12 and 18 → **D**. **Only ask if the user says "JavaScript" with no letter and no phase**, because
guessing duplicates another session's work in the same checkout.

⛔ **Cross-chunk links break the build.** Where a page needs a topic another chunk owns, write it
as **bold plain text with *(not written yet)***, never a link.

**Shared files:** `src/data/progress.js` — your phases' rows only; `docs/README.md` — your chunk's
row only (there are four) plus the JavaScript technology row at a phase close; the claim notice —
the chunk table and your own block; a phase `README.md` belongs to whichever chunk owns that phase,
and no phase is shared. **Never `git add -A`**; expect the other chunks' rows in your diff and
leave them.

**Everything below applies to ALL FOUR CHUNKS.**

#### ⛔ 11b-worktrees · SUPERSEDED 2026-08-15 — kept only for the method

🔴🔴 **The worktrees described in this section NO LONGER EXIST.** Both were merged and
deleted on 2026-08-15 (see the banner at the top of rule 11). **Both lanes write on
`main`.** Do not act on the setup instructions below unless the user explicitly asks for
a new worktree — they are kept because the *method* (hardlinked `node_modules`, the
link-tally check, merge at every phase boundary) is still the right way to do it if one
is ever wanted again.

> *"Can you write now onwards all your explanations in complete new worktree ?"* — given to both
> lane sessions the same night. **Revoked 2026-08-15** by *"commit every uncommitted branch to
> main and delete everything"*.

| Lane | Worktree (DELETED 2026-08-15) | Branch (DELETED) |
|---|---|---|
| **A** | ~~`/mnt/Storage/Backup/Knowledge/devbible-js-lane-a`~~ | ~~`js-lane-a`~~ |
| **B** | ~~`/mnt/Storage/Backup/Knowledge/devbible-js-lane-b`~~ | ~~`js-lane-b`~~ |

**If a worktree is ever wanted again**, set one up with
`git -C <devbible> worktree add ../devbible-js-lane-<x> -b js-lane-<x>`, then hardlink
`node_modules` — `cp -al <devbible>/node_modules <worktree>/node_modules && rm -rf
<worktree>/node_modules/.cache`. That takes seconds and almost no disk; a `yarn install` is not
needed.

**What the worktree buys, and it is concrete:** the git index is per-worktree, so **no other
session can commit your staged files** — that happened three times on `main` — and their mid-write
edits never appear in your working tree.

⚠️ **A worktree isolates the CHECKOUT, not the BUILD.** `yarn build` there still compiles every
language, so another session's *committed* breakage fails it just the same. **The check that still
works is the link tally**, because warnings are emitted before the bundle fails:

```bash
yarn build > build.log 2>&1
grep "source file" build.log | sed 's#.*source file "docs/##' | cut -d/ -f1 | sort | uniq -c
grep "source file" build.log | grep 'docs/javascript' | sed 's#.*pages/##' | cut -d/ -f1 | sort | uniq -c
```

🔴 **Merge back at every phase boundary and say plainly that the branch exists.** An unmerged
worktree is worse than none — that is the React lesson and it cost a whole session's audit. Before
merging, check `main` is not mid-write by another session: the merge touches `docs/README.md` and
`src/data/progress.js`, which everyone shares.

### 11b-common · the rules ALL FOUR CHUNKS share

🔴 **Locked in 2026-08-14** on the user's instruction (*"Please lock it in with
javascript"*), 🔴 **narrowed to a tier the same day** (*"can you lock in understand know
tier"*) once the Master tier came in complete, and 🔴 **cut to a language focus the same
day** (*"Perfect lock in"*, after the scope decisions in §11b-scope below). Verbatim, when the language was named:

> *"I want you to pick up javascript from memory you will get to know about the progress
> i am counting on you to finish it and do not wait for me and pick recomended action
> till the express js compelte again do not wait for me. Especially there was hard rule
> about file size and memory saved make sure you have to follow as it as"*

and, re-affirmed unprompted the same day:

> *"Ok finish it and remember you should care only about javascript in this session and
> rest such as express and react js are in different sessions"*

**Scope:** `docs/javascript/` only, on `main` in the shared checkout — **no worktree**;
the JS phase-3 worktree was left locked and pre-merge while the work went back to `main`,
and ⚠️ it is not to be revived.

🔴 **Cadence is tightened to PER FILE** — *"make sure to save each file progress the
moment it completes"*, given at ~90% usage: write a file → update the boards → commit →
update the memory.

🔴🔴 **RUN IT TO COMPLETION. Do not stop, do not wait, do not ask between topics.**
*"You do not have to stop and wait just continue and lock the javascript and finish it"*
(2026-08-14). Finish the whole tier: write a topic → boards → clean build → commit →
memory → **start the next topic in the same turn**. Reporting progress is not a reason to
pause; a turn ends because it runs out, not because a topic finished.


#### 11b-scope · 🔴 The scope cut — locked 2026-08-14

**The syllabus has 337 rows. Only 316 are in scope, and only 146 are in the queue.** The user
cut the corpus back to the **language** itself. Their words, in order:

> *"Dynamic programming and the harder set - Drop Completly"* ·
> *"Park Data structures completly for now mostly language focus"* ·
> *"Even algorythms also park it out not now"* ·
> *"Complexity and JavaScript's real costs remove this one too"* ·
> for the storefront: *"Thoose 3 in store front i want to keep … rest drop"*

| | Phases and topics | Count |
|---|---|---|
| 🚫 **Dropped** — not planned | 16 (04–16); 18 (08–10, 13, 14, 16–18) | **21** |
| ⏸ **Parked** — reversible, *"not now"* | 13 (04–10); 14 (06–17); 15 (05, 07–20) | **34** |
| ✅ **Active queue** | everything else | **146** — Understand 99 · Know 44 · When Needed 3 |

**Phase 18 keeps exactly three unwritten topics:** 11 · Infinite scroll and lazy images,
12 · Long lists without freezing, 15 · Review uploads.

🔴 **Phase 17 · Machine coding STAYS in scope. Do not park it by association.** It sits in the
same DSA part as everything cut, but its topics implement **JavaScript's own library functions
from an empty file** — EventEmitter, deep clone, a Promise, `curry`/`pipe`/`compose`,
`promisify`, deep equality. That is language work, and it is the one DSA-part phase that
survives. Flagged to the user as a judgement call and left standing.

🔴 **NOTHING ALREADY WRITTEN WAS DELETED, and that was explicit** — *"incase of if any already
developed"* / *"let it be"*. Every drop and park lands on **unwritten** rows only; phases 13,
14, 15, 16 and 18 keep every Master topic they had. ⚠️ **A "dropped" phase that still has
written pages is CORRECT.** Do not tidy it up.

🔴 **The pre-cut syllabus is preserved** at `docs/javascript/syllabus/*.md.bak` — taken from git
`HEAD` and verified byte-identical *before* any edit, on the user's instruction (*"this original
javascript syllabus create .bak one for future reference"*). The live syllabus keeps every row
and carries scope banners. **Never delete the `.bak` files, and never regenerate them from an
edited syllabus.**

The machine-readable scope map lives in the audit tooling's `DROPPED` / `PARKED` dicts, which is
what recomputes these totals. Detail and the full instruction history:
`devbible/progress_javascript_build.md` (scope section).

🔴 **The work is now the UNDERSTAND and KNOW tiers, and nothing else.** The Master tier is
**finished — 99 of 99, every phase 0–18**, audited 2026-08-14 by parsing every tier badge in
`docs/javascript/syllabus/*.md` against the written topic numbers. **136 of 316 in-scope topics** are
written (43%); the queue is **146 — Understand 99, Know 44, When Needed 3** (see 11b-scope). Do not reopen a
Master topic to deepen it — Master is closed, and the outstanding work is breadth.

**Order: phase by phase, and inside a phase, Understand → Know → When Needed.** Finish a
phase's remaining topics before moving to the next phase. Chosen because phase 3 is already
mid-flight that way (Understand 09–11 written, 12–17 Understand and 18–20 Know still open),
so any other order strands it. Phases 0, 1 and 2 are complete at every tier and are done.

**⚠️ An Understand topic that overlaps a Master one is written as CONCEPT and CHOICE, then
links to the Master implementation** — never a second implementation of the same thing.
Phase 3 topic 10 (debounce/throttle, overlapping Phase 17) is the worked example of that
shape. Documentation-validated, **no sandbox, no timings** (rules 7 and 8).

Resume point `devbible/progress_javascript_build.md`; as of 2026-08-14 that is **Phase 3
topic 12 · Composition (`pipe` and `compose`)**. Detail, including every verbatim
instruction: `devbible/feedback_javascript_only_20260814.md`. Thinnest phase still in the queue: **12 · The browser platform, 2 of 21**.

⚠️ **Historic board errors, already corrected — do not reintroduce:** "253 pages" (it is 235) and a syllabus tier table summing to 340 (the badges give **99 · 170 · 64 · 4 = 337**, so Master is **99**, not 100).

### 11f · MongoDB — session `05921047`, 34/82 and paused cleanly

🔴 **Picked up 2026-08-15** on the user's instruction after React Part B closed (*"Incase if
you finish please pick mongodb … make sure to create new worktree"*), and **paused on their
word** (*"save current session to memory and enough"*) — not abandoned, not blocked.

**Scope:** `docs/mongodb/` only, **on `main`** — ⛔ the worktree
`devbible-mongodb` / branch `mongodb-pages` was **merged and DELETED on 2026-08-15**
(verified at 0 unique commits first, so nothing was stranded).

| | |
|---|---|
| Written | **34 of 82 topics** — phases **0, 1, 2, 3, 4, 5 all COMPLETE** |
| Next | **Phase 6 · The aggregation pipeline (6 topics)** — ⚠️ **its four Manual pages are ALREADY FETCHED and recorded; do not re-fetch** |
| Left | phases 6–14, **48 topics** |
| Build | clean at every phase close, **0 broken links in `docs/mongodb/`** |
| Evidence | documentation-validated against the MongoDB Manual v8.0 — **no sandbox, no console blocks**, and there is **no MongoDB server on this machine**, so there never can be |

⚠️ **The syllabus was cut to the critical path (204 → 82 topics)** — Master tier only, capped
at 6 per phase. That cut stands; do not re-expand it without a new instruction.

Resume point: `devbible/progress_mongodb_pages.md`. Session record:
`devbible/progress_session_20260815_react_b_mongodb.md`.

### 11c · React — SPLIT A/B, both parts live

🔴 **React is worked as two parts (2026-08-14)**, on the user's instruction to split the
remaining work — *"split pending tasks of react two parts … pick part a to one session and
part b to another"*. Split rules and two paste-ready prompts:
`devbible/project_react_split_parts_ab.md`.

| Part | Work | Where | State |
|---|---|---|---|
| **A** | Phase 11 topics 08–17 + close | `main`, shared checkout | ✅ **COMPLETE 17/17** |
| **B** | Phase 14 · Testing React, 14 topics | `main` — worktree `devbible-react-p14` / branch `react-phase-14` merged, then **DELETED 2026-08-15** | ✅ **COMPLETE 14/14, MERGED** |

✅ **BOTH PARTS ARE DONE (2026-08-15).** Part B: 28 files, 4,986 lines, 0 over the 300-line
cap, 0 broken links in `docs/react/`, and `react-phase-14` verified at **0 unique commits vs
`main`** — fully merged, nothing stranded. The earlier *"not merged into `main` yet"* warning
here is **void**. Record: `devbible/progress_react_phase14.md`; session:
`devbible/progress_session_20260815_react_b_mongodb.md`.

**React now stands at phases 0–11 and 14 complete, 255 leaf pages.** Still open: phases 12
(Data and state) and 13 (Routing). Nobody holds React — a session told to pick it up should
claim it in `docs/README.md` first.

The paragraph below is about the *earlier* React worktree, which is also fully merged.

Not abandoned, just nobody's current lock. Phases 7, 8 and 9 are complete **on `main`** —
the `react-phase-7` branch and its worktree `devbible-react` were verified fully merged
and then ⛔ **DELETED on 2026-08-15** (React phases 0–11 and 14 are all on `main`). The old
"React Phases 7+ look missing on `main`" warning is **void**. Phase 10 is next, 84 of 244 topics left. Resume point:
`devbible/progress_react_phase7.md`; the original order, kept for history:
`devbible/feedback_react_only_worktree_20260814.md`. ⚠️ An unmerged worktree is worse than
none — say plainly that the work is there rather than quietly leaving it. A third worktree,
`devbible-frontend` (`frontend-merge`), **was merged into `main` on 2026-08-14** on the
user's explicit instruction (merge commit `f021ad3`) — the earlier "do not merge it" note is
**revoked and no longer applies**. All 12 frontend technologies now live on `main`; that
worktree was ⛔ **DELETED on 2026-08-15** along with every other one.

### 11d · Git — ✅ COMPLETE, lock released 2026-08-14

🔴 **Locked 2026-08-14** on the user's instruction, verbatim:

> *"There was git course yet to complete the explanations can you pick it up ? and lock
> it in ?"*

**Scope:** `docs/git/` only, on `main` in the shared checkout — **no worktree**. The
syllabus is complete and wired (13 phases, **191 topics**, 4 parts, 55 Master).
**Phase 0 is complete — 14 pages**, and it is **sandbox-proven** from
`sandbox/git-p0/ex1-version-facts.sh` and `ex2-object-model.sh`. **Phases 1–12 are the
work: 177 topics, zero pages.**

🔴 **The old `ex3` plan in the progress memory is DEAD.** That memory (written 2026-08-13)
says Phase 1 "needs a new `sandbox/git-p0/ex3-everyday-loop.sh` **before** any page is
written". Rule 8 landed after it and closed sandboxing. **Phase 1 onward is
documentation-validated** against `git help <cmd>` and git-scm.com, with the source named
in the `> Verified:` line, and **carries no console block** unless the output genuinely
comes from the recorded `ex1-output.txt` / `ex2-output.txt`. Never reconstruct git output
from memory — it is exactly the kind of thing that looks right and is wrong.

Two facts from `ex1` that contradict what most sources say, and must not be "corrected":
**`git init` still defaults to `master` on git 2.55.0** (the hint says `main` arrives in
Git 3.0), and **`git-filter-repo` and `git-lfs` are not installed** — phases 5, 7 and 11
name them, and those pages say plainly that their content is from upstream docs.

🔴 **RE-SCOPED and RE-LOCKED 2026-08-14, mid-session.** The user cut the corpus to daily
use (*"I just need to know about the git to work daily tasks not more than that"*) and,
offered three widths, chose the **minimal** one plus **"practical depth, no interview
sections"**. **In scope: 52 topics across phases 0, 1, 2, 4 and 5.** Parked: phase 3
(history in depth), phase 6 (team workflow), and Parts 3–4 entirely. Then, on being told
plainly that 32 topics still remained:

> *"Fine lock it on untill completing this whole git"*

✅ **DONE — all 52 written, 70 files, 12,485 lines, 0 over 300, 0 broken links, build
verified.** The claim is released in `docs/README.md`; Git is free to pick up. Reopening
the parked phases (3, 6, 7–12) needs a **new instruction** — their syllabus rows are
still in place under `:::warning` banners.

The order, for the record: **work straight through all 52 without stopping to ask.** Do not report progress and wait
— finish the scope. The per-phase worklists live in `:::info In scope` boxes inside
`docs/git/syllabus/01-how-git-works.md` and `02-collaboration.md`; read them rather than
re-deriving the subset.

🔴 **Cadence is tightened to PER FILE**, as it is for Express and JavaScript: write a page
→ update the four boards → commit → update the memory.

Live state, the per-file table and every trap: `devbible/progress_git_pages.md`. The
order's history: `devbible/feedback_git_only_20260814.md`.

### 11e · Docker & Podman — 🔴 **SPLIT FOUR WAYS, chunks A B C D** (2026-08-15)

🔴🔴 **NEW AND AUTHORITATIVE, 2026-08-15**, on the user's instruction — *"I want to you
check docker and podman and i would like to split it 4 ways"*. **The single-session lock
to `40090c06` below is superseded**; four sessions now work Docker in parallel, one chunk
each, **whole phases only**, so no two ever write in the same phase directory.

**The user types Docker plus a letter, and that is the whole instruction** — *"pick docker
A"* · *"docker chunk B"* · *"docker C"* · *"take D"*. **No plan, no confirmation, no
clarifying question:** open `devbible/progress_docker_split_4way.md`, claim the chunk in
the two boards, and start writing at the topic the cursor names.

🔴 **Board state below refreshed 2026-08-15 (late) by session `016J3KVb` on closing chunk C.**
⚠️ **This table lags** — four sessions move it independently. The **live** cursor is always
`devbible/progress_docker_split_4way.md` in the store; read that before writing.

| Chunk | Phases | Left | Start at |
|---|---|---|---|
| **A** | ✅ **4 DONE 16/16** · ✅ **5 DONE 12/12** | ✅ **0 — CHUNK A IS FINISHED** (2026-08-15, session `e75b3868`) | — nothing queued; free to pick up |
| **B** | ✅ **6 DONE 12/12** · ✅ **7 DONE 14/14** | ✅ **0 — CHUNK B IS FINISHED** (2026-08-15, session `d0c46f84`) | — nothing queued; free to pick up |
| **C** | ✅ **8 Compose DONE 17/17** · ✅ **9 MERN/PERN DONE 14/14** | ✅ **0 — CHUNK C IS FINISHED** (2026-08-15, session `016J3KVb`) | — nothing queued; free to pick up |
| **D** | ✅ **10 Production DONE 16/16** · **11** Podman in depth · **12** Delivery and CI (12) | **~28** | 🔴 **Phase 11 · 01 · Daemonless** — held by session `75a196a7` (2026-08-15) |

🔴 **Only chunk D is still open.** If the user says "docker A", "docker B" or "docker C",
say the chunk is complete and let them pick rather than inventing work in it.

**A phase number settles it too:** 4/5 → A · 6/7 → B · 8/9 → C · 10/11/12 → D. Only ask if
the user says "Docker" with **no letter and no phase**. ✅ **Phases 0–10 are written**; the
worklist for a phase **is** its syllabus table, in row order.

⚠️ **Phase 9 is the worked example of rule 1 being got WRONG and then fixed** — two files
were reworded down to land at exactly 300 instead of being split at 301, and one lost real
content in the process. Caught 2026-08-15 only because the user asked. **Two files at
exactly the cap is the tell.** Detail: `devbible/progress_docker_split_4way.md`.

⛔ **Cross-chunk links break the build** — where a page needs a topic another chunk owns,
write it as **bold plain text with *(not written yet)***, never a link. **Never `git add
-A`.** ⚠️ `src/data/progress.js` has **one** docker row that all four chunks increment —
re-read it before editing and take the higher number if it moved.

🔴 **Everything below still applies to all four chunks** — no sandbox, no console blocks,
the 300-line file cap, per-file cadence, run to completion.

---

🔴 **Locked 2026-08-14**, a cold start: technology 9 in `instructions.md` §2 ("Both"),
in scope from the beginning, zero pages. Started by *"There was docker and podman can
were there can you work on those ?"*

**Scope:** `docs/docker/` only, **on `main`**. ✅ **MERGED into `main` on 2026-08-15**
(23 commits, 83 files, +11,504 lines) and the worktree `devbible-docker` / branch
`docker-podman` were **DELETED**. The old ⚠️ "not merged" warning here is **void**.

🔴 **FULL syllabus, Node.js structure and writing style**, and this **overrode a
narrower scope the user had already chosen**:

> *"good night i am trusting that you would pick a full syllabus just like how node js
> is structured and writing style and you will work on this session till completes"*

✅ **Syllabus complete and build-verified** — 4 parts, 13 phases, **192 topics**
(Master 55 · Understand 85 · Know 44 · When Needed 8, counted from the badges; Master
came in at 38% and 18 rows were demoted to reach 28.6%). Wired into `sidebars.js`,
`progress.js`, the homepage card and both `docs/README.md` tables.

✅ **Phases 0–3 COMPLETE — 63 of 192 topics (33%)**, 66 files, 0 over the 300-line cap,
every phase closed with a clean isolated rebuild showing **0 broken links in
`docs/docker`**. 🔴 **Next is now per chunk — see the split table above.**

🔴 **NO SANDBOX, stated three times** — *"there is sandboxing will verify against
documentation and using online"*, then flatly **"there is no sandboxing"**. Everything
is validated against docs.docker.com, docs.podman.io, the OCI specs and the release
notes, source named on the `> Verified:` line, and **no page carries a console block**.
⚠️ **Podman 5.8.4 is installed on this machine and Docker is not — neither fact is
permission to run anything.**

🔴 **Cadence is PER FILE** and the order is **run to completion, do not wait**
(*"good night do not wait for take recomended action to match the goal"*).

Targets Docker Engine **29.7.2**, Compose **v5.4.0**, BuildKit **v0.32.1**, Podman
**6.1.0**. Both engines are taught together on purpose; Phase 11 collects the
Podman-specific depth. 🔴 **Live cursor: `devbible/progress_docker_split_4way.md`**;
background, page shape and the phase 0–3 claim tables:
`devbible/progress_docker_podman.md`. The order's history:
`devbible/feedback_docker_only_20260814.md`.

### 11g · Redis — 🔴 **SPLIT THREE WAYS, chunks A B C** (2026-08-17)

🔴 **Set 2026-08-17** on the user's instruction, given while chunk A was being started:

> *"Wait we need to split this redis into 3 parts and i will give it to other sessions
> as well"*

**The user types Redis plus a letter, and that is the whole instruction** — *"pick redis
A"* · *"redis chunk B"* · *"redis C"* · *"take C"*. **No plan, no confirmation, no
clarifying question:** open `devbible/progress_redis_split_3way.md`, claim the chunk in
the two boards, and start writing at the topic its cursor names.

| Chunk | Phases | Topics | Start at | Held by |
|---|---|---|---|---|
| **A** | **0, 1, 2, 3** — how Redis works + strings | **23** | Phase 0 · 01 · What Redis is | session `3bb1face`, 2026-08-17 |
| **B** | **4, 5, 6** — collections, streams, the Node client | **21** | Phase 4 · 01 · Hashes | — unclaimed |
| **C** | **7, 8, 9, 10** — caching, the patterns, production | **30** | Phase 7 · 01 · Cache-aside | — unclaimed |

**A phase number settles it too:** 0/1/2/3 → A · 4/5/6 → B · 7/8/9/10 → C. Only ask if the
user says "Redis" with **no letter and no phase**. **74 topics, 0 written** at the split.
Whole phases only, contiguous, so no two sessions write in the same directory.

🔴 **NO SANDBOX, and there is no Redis server on this machine** — every claim is validated
against redis.io, the source named on the `> Verified:` line, and **no page carries a
console block**. Never reconstruct a `redis-cli` transcript, a latency figure, a
`MEMORY USAGE` byte count or an `INFO` dump from memory. Command *syntax* is fine to show;
server *output* is not. Target **Redis Open Source 8.x** and name the version a behaviour
was confirmed on — the 8.x line shipped four feature releases in under a year.

🔴 **Cadence is PER FILE**, and the order is **run to completion, do not wait**.

⛔ **Cross-chunk links break the build** — write **bold plain text with *(not written
yet)*** until the target exists. ⚠️ `src/data/progress.js` has **one** redis row that all
three chunks increment — re-read before editing and take the higher number if it moved.

Live cursor and the full worklist: `devbible/progress_redis_split_3way.md`. Paste-ready
prompts for all three: `devbible/PROMPT-redis-chunks.md`.

### 11h · TypeScript — 🔴 **SPLIT THREE WAYS, parts A B C** (2026-08-17)

🔴 **Part C was created 2026-08-17** on the user's instruction, given mid-session to the
Part A holder:

> *"Can you split your work into half ? create typescript phase c ?"* · *"and save the
> progress to memnory i will ask another session to work it out"*

**The user types TypeScript plus a letter, and that is the whole instruction** — *"pick
typescript C"* · *"ts part c"* · *"take C"*. **No plan, no confirmation:** open
`devbible/project_typescript_split_part_c.md` (it carries a paste-ready prompt), claim the
part in the two boards, and start writing.

🔴🔴 **RE-SPLIT FOUR WAYS 2026-08-17 — PHASE 6 IS NOW C **AND** D.** On the user's
instruction (*"go with option 1, split phase 6 and make sure when start new session with
typescript a and b, c they should take care"*). **The three-way table that stood here is
DEAD**; "C = the whole of phase 6" no longer means anything.

🔴 **Open `devbible/progress_typescript_split_4way.md` — it is THE cursor for all four
lanes** and carries the START HERE table, the worklists and the collision rules.

| Lane | Scope — the ONLY directories you may touch | Left | Start at | Held by |
|---|---|---|---|---|
| **A** | `phase-5-type-level/` topics **08–16** | **9** | 08 · Knowing when to stop | session `bbd2d39d` |
| **B** | `phase-10-strictness/` **and** `phase-12-tooling/` | **19** | phase 10 · **10 · The error codes you will actually meet** | session `ea9f43fb` |
| **C** | `phase-6-modules-build/` topics **01–06 only** | **6** | 01 · `module` and `moduleResolution` | 🔴 **UNCLAIMED** |
| **D** | `phase-6-modules-build/` topics **07–16 only** | **10** | 07 · Authoring `.d.ts` files | 🔴 **UNCLAIMED** |

**A phase number settles it too:** 5 → A · 10 or 12 → B · **6 → C or D by topic number**
(01–06 = C, 07–16 = D). ✅ Phases 0–4 are **COMPLETE** and phase 7 is closed at 5/5; phases
**8, 9 and 11 are DROPPED** by the 2026-08-15 cut and are not work.

🔴 **Why phase 6 was split, when whole-phase boundaries are the norm.** Topic counts hid a
**5× imbalance**. Weighting the 44 remaining topics by tier — Master ≈1,100 lines,
Understand ≈600, Know ≈350, When Needed ≈250, measured from work already written — phase 6
projected to **~10,350 lines, 43% of everything left, in one unclaimed lane** (three Master
rows sit at its front). Cutting after topic 06 gives **5,100 / 5,250**, a delta of 150, and
falls on a real concept boundary: **C = the module system and how the compiler sees files;
D = declarations, packaging and the build.** ⚠️ **B is deliberately the largest (~9,950)**
— it is the continuously-running session, and phase 12 splits cleanly out of it if a fifth
session is ever wanted.

⚠️ **C and D share ONE phase directory — the only intra-phase split in devbible.** So:
**whoever arrives first scaffolds `phase-6-modules-build/README.md` with the FULL 16-row
table** (unwritten rows as plain text); after that **each lane edits only its own rows** —
C 01–06, D 07–16 — re-reading the file immediately before every edit. Never create or edit
the other lane's topic files. ⚠️ They also share the `phase-6-modules-build` row in
`src/data/progress.js`: re-read it and take the higher number if it moved. **A phase
directory takes NO `_category_.json`** (README frontmatter plus autogeneration); only a
*chunk* directory inside a topic gets one.

🔴 **NO SANDBOX** — validate against the TypeScript handbook and the release notes, name the
source in each page's `> Verified:` line, and read diagnostics out of the **compiler's own
message table** (`sandbox/ts-p1/node_modules/@typescript/typescript-linux-x64/lib/tsc` holds
7.0.2's strings; codes come from the 5.9.3 JS table in `sandbox/ts-p0`). Never write a
plausible `tsc` transcript.

🔴 **Cadence is PER FILE.** ⚠️ `docs/README.md` has **one** TypeScript row that all three
parts increment — re-read it immediately before every edit and take the higher number.
⛔ Cross-part links are **bold plain text with *(not written yet)*** until the target exists.

🔴 **Live cursor for ALL FOUR lanes: `devbible/progress_typescript_split_4way.md`.**
Per-lane detail: A → `devbible/progress_typescript_build.md` · B →
`devbible/progress_typescript_part_b.md` (plus the phase-10 concept record
`devbible/reference_typescript_phase10.md`) · C and D → the 4-way file's worklist.
⛔ `devbible/project_typescript_split_part_c.md` is **superseded** — it gave C the whole of
phase 6.

⚠️ **Three things phase 6 inherits and must NOT re-derive:** `isolatedDeclarations`' two
diagnostics (`TS9021`, `TS9022`) are already quoted in
`phase-4-classes-declarations/14-mixins/05-the-cost-in-the-build.md`, which forward-links to
phase 6 — **D repoints that link when topic 15 lands**; `skipLibCheck`'s correctness trade
is phase 7's and its *performance* framing is phase 12's (lane B), and
`phase-10-strictness/08-suppression-directives/03-the-suppression-tiers.md` already settles
that **it is not a suppression mechanism**; and `module: nodenext` /
`verbatimModuleSyntax` / the `TS5096` 5.9→7.0 wording change are argued on a real server in
`phase-7-server/01-tsconfig-for-a-node-service/`.

### 11i · Java — ⏸️ **PARKED 2026-08-31** (was: one session, run 0 → 16, with a usage kill switch)

> ⏸️ **PARKED on the user's instruction 2026-08-31** — *"Please save current session progress and
> lets park java here"*. Stopped at a **clean boundary**: phase 11 topic 07 · Testcontainers
> CLOSED (50 chunks + index, 657 ★), all four boards wired, whole site builds green (4,820 pages,
> 0 errors, 0 broken links), `main` pushed. **Java 160/232 (69%).**
>
> 🔴 The "run to completion, never stop at a phase boundary" order below is **SUSPENDED, not
> cancelled.** A session told *"continue with java"* should **confirm first** — the user parked it
> deliberately, so this is the one case where the never-ask rule does not apply.
> Resume point: `CURSOR-JAVA.md` → `08-test-data-patterns/`.


🔴🔴 **READ `devbible/CURSOR-JAVA.md` AND NOTHING ELSE. It is 90 lines and it is the
whole instruction** — position, the live phase board, the version spine, the fork protocol,
the QC commands and the four boards. Everything below this line is HISTORY, kept for audit;
**do not read it to start work.** (Added 2026-08-28 on the user's order that new agents must
not burn 20k+ tokens on project state before writing a word.)

🔴 **Locked 2026-08-17** (*"Can you immediately start workring on java ? … start working
on it to finish the lanaguage"*) and resumed by *"continue with java"* — that phrase alone
is the whole instruction: open `devbible/progress_java_python_syllabus.md`, read its
**START HERE** table, and begin at the file it names. No plan, no confirmation.

**Scope:** `docs/java/` only, on `main`. 232 topics, 17 phases (0–16). ✅ Phases 0–4
complete (73 topics). Exemplar: `phase-0-platform-jvm/01-what-java-is/`. **NO sandbox, no
console blocks** — documentation-validated (docs.oracle.com JDK 25, JLS SE 25, JEPs),
source named on every `> Verified:` line. Target **JDK 25 (LTS)**. Cadence **per file**;
forks author topics in parallel, coordinator QCs (`wc -l ≤300`, varied section counts,
links resolve) and wires boards.

🔴🔴 **THE USAGE KILL SWITCH — set 2026-08-18, the user's words:** *"when i said we
reached 80 or 90% usage immediately kill everything and wire UI and make sure new session
auto pickup where you left off"*. **At 80% usage — user-announced or self-observed —
IMMEDIATELY: (1) kill every fork and dispatch nothing new; (2) wire ALL four UI boards
with whatever is on disk** (phase README rows, `src/data/progress.js`,
`docs/java/pages/README.md`, `docs/README.md`); **(3) commit explicit paths; (4) repoint
the START HERE cursor in the store to the exact next file and commit the store.** Losing
an in-flight topic is acceptable; a session that dies with unwired UI and a stale cursor
is not. The 2026-08-17 overnight run died exactly that way and cost a recovery session.

⚠️ **The python link resolver has a blind spot**: it resolves `NN-topic.md` against a
directory `NN-topic/` and reports 0 unresolved on a dangling link — after converting a
single file to a chunked dir, always grep for the old path too.

### 11j · Python — one session, phases 0 → 12, pages start from zero

🔴 **Claimed 2026-08-27 by session `f985178b`** on the user's instruction: *"I want you to
pick python"*. **Scope: `docs/python/` only**, on `main` in the shared checkout — no
worktree. Java is a **different lock** and a different session; the two share the store
file `progress_java_python_syllabus.md` for their *syllabus* history only. Python's live
cursor is its own file: **`devbible/progress_python_pages.md`**.

**The starting position, verified on disk 2026-08-27:** the syllabus was complete at 13
phases / 163 topics and **`docs/python/pages/` held nothing but its `README.md` stub**.
Before any page was written the user asked whether it made sense *"in fullstack project
perspective as per industry standard"* and asked for a dedicated REST/CRUD phase. It did
not: Phase 9 taught FastAPI mechanics, Phase 10 taught database drivers, and **nothing
joined them**. **New Phase 11 · REST APIs and CRUD end to end (17 topics)** was inserted
after the data phase; Testing and Production renumbered 11/12 → 12/13. Python is now
**4 parts, 14 phases, 180 topics** — Master 60 (33%) · Understand 82 · Know 31 · When
Needed 7, badge-counted. Full reasoning in `devbible/progress_python_pages.md`. The cursor
starts at the very beginning:

> **START HERE → `docs/python/pages/phase-0-runtime/01-what-python-is/`**, the first row of
> the Phase 0 table in `docs/python/syllabus/01-foundations.md`.

**Phase 0 worklist — the 12 rows of that table, in order.** The slugs come from
`src/data/progress.js`, which names all **14** phase directories; **use those slugs
exactly** (`phase-0-runtime`, `phase-1-language-core`, `phase-2-functions`, …,
`phase-11-rest-crud`, `phase-12-testing`, `phase-13-production`) or the Progress
component links nowhere.

**Page shape:** copy `docs/java/pages/phase-0-platform-jvm/03-release-model.md` for a
single file and `…/01-what-java-is/` for a chunked topic — frontmatter, tier badge,
`> Verified:` line, bold thesis, sections, Gotchas (Symptom/Cause/Fix), Interview questions
(exhaustive — rule 1), `← Prev / Index` footer.

**Evidence: NO sandbox, NO console blocks.** Documentation-validated against
docs.python.org/3.14, the PEPs, and the tool docs (uv, ruff, FastAPI, pytest). Python
*code examples* are fine; program *output* is never fabricated — rule 3.

**Version target: Python 3.14** (3.14.7, 5 Aug 2026). 3.13 in bugfix; **3.15 GA 1 Oct
2026** (PEP 790, lazy imports). Free-threaded CPython **officially supported since 3.14**
(PEP 779) — that is the single most out-of-date fact in older Python material, and Phase 0
topic 02 turns on it.

🔴 **CEILING: three agents including the coordinator — two `devbible-author` forks at a
time.** User instruction 2026-08-28: *"You supposed to deploy max 3 agents including you
so maintain like that"*. This supersedes the six-fork pattern the Java track used before
its 95% kill switch.

🔴 **Brief the forks with `devbible/AUTHOR-BRIEF.md` — never inline the rules in a prompt,
never send a fork to read a template page.** User instruction 2026-08-28: *"When new
session starts they should use less tokens possible not with 20k + lines … new agents I
mean"*. That file carries the hard rules **and** the page skeleton in ~90 lines, so a
fork's startup read is one file instead of a 274-line template plus a topic README. A
fork prompt is then ~12 lines: the brief, the slug, `sidebar_position`, the tier, the
footer neighbours, the scope bullets.

**Cadence is PER FILE:** write a chunk → all four boards → commit explicit paths → memory.
Boards: `src/data/progress.js` (python row — `pages` **and** `pagesPlanned` mid-phase, plus
the `updated:` stamp), `docs/python/pages/phase-N-*/README.md`, `docs/python/pages/README.md`,
and `docs/README.md`'s Python rows. **Never `git add -A`** — several sessions share this
checkout, and the Java lock is live in it right now.
