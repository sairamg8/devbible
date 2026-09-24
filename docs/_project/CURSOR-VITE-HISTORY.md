---
name: cursor-vite-history
description: Cold history rotated out of CURSOR-VITE.md — superseded session blocks, verbatim. Opened by name or by recall.sh, never on the hot path
metadata:
  type: progress
---

# CURSOR-VITE.md — history

---

<!-- rotated out of CURSOR-VITE.md on 2026-09-08 -->

## 📎 How topic 18 was opened and planned (2026-09-08, session `6d8f8a23`)

**The user named it:** *"add a microservices architecture topic to vite deploy the agents you need
and you can monitor their progress."*

⚠️ **This supersedes the "do not invent a topic 18" line below.** That line was right on 2026-09-08
morning — it stopped a session inventing work. It is **not** a veto on the user asking for a topic
by name. Topic 18 exists because the user asked for it, in those words.

🔴 **THE NEXT FILE A COLD SESSION OPENS:**
`/mnt/Storage/Backup/Knowledge/devbible/docs/vite/pages/18-microservices-architecture/` — see the
chunk table below for which of the 13 planned files are on disk and which are still owed.

### Scope, and why it is honest

Vite builds a frontend artefact. "Microservices" reaches it in **three shapes only**, and the topic
says so rather than pretending Vite is a backend framework:
1. many backend services, one frontend — `server.proxy`, CORS, the BFF, per-service env;
2. one frontend split into independently deployed pieces — Module Federation, import maps, skew;
3. many independent frontends in one repo — workspaces, shared config, shared design system.

### 🔴 The research bank — do NOT re-derive

[[research-vite-t18-microservices]] — six fetches, banked 2026-09-08. `server.proxy` +
`server.cors`/`origin`/`allowedHosts`, backend-integration + `build.manifest`, the Environment API
(`environments`, the RC-stability quote), `@module-federation/vite` **1.21.5** and its documented
limitations, `base`/`renderBuiltUrl`/MPA/library mode, and the npm version spine. Its final section
lists **five claims the sources did NOT settle** — every writer is bound by it.

🔴 **The stale-package fact worth carrying:** `@originjs/vite-plugin-federation` last published
**2025-04-12**; `@module-federation/vite` published **2026-09-07**. Search ranks the dead one first.

### ✅ WAVE 1 CLOSED — commit `2a6c73c7a`, 2026-09-08

**14 files · 3,092 lines · 80 ★.** Four agents, eight dispatched chunks, six split siblings.
Gates at commit: `yarn mdxcheck` 14 files / **0 problems** · `yarn linkcheck docs/vite` 179 files /
**0 problems** · every page badged, `> Verified:` + `> Validated:` · positions unique and gap-free.

🔴 **RULE 7 SCORED 6 / 6 — every overshoot SPLIT, none trimmed.** Carry that line in every dispatch.

| dispatched | before | after | sibling | total |
|---|---:|---:|---|---:|
| `02` | 352 | 221 | `02b-websockets-configure-and-the-proxys-dev-only-scope.md` 222 | 443 |
| `02a` | 321 | 217 | `02a2-websocket-origin-checks-and-the-preview-verification-recipe.md` 168 | 385 |
| `03` | 472 | 288 | `03b-runtime-configuration-and-the-fix.md` 266 | 554 |
| `04` | 367 | 235 | `04b-shared-packages-and-the-deploy-decision.md` 207 | 442 |
| `05` | 375 | 215 | `05b-worked-example-and-the-version-spine.md` 189 | 404 |
| `05a` | 307 | 236 | `05a2-shared-dependency-versioning-and-the-optimizedeps-gap.md` 144 | 380 |

⚠️ **Two process facts worth reusing.** (1) **Concurrent agents cannot allocate
`sidebar_position` safely** — four of them picked against a moving target and collided on 6, 7
and 8; all four *reported* it rather than guessing, which was the right call. **Assign positions
in the dispatch, then renumber the whole directory in one coordinator pass at the end.** (2)
`05b` was taken by a split sibling, so the planned version-skew chunk became **`05c`**.

### 🔒 WAVE 2 IS IN FLIGHT — 5 chunks, positions 15–19

`05c-version-skew-and-the-remote-manifest.md` (15) · `06-import-maps-and-the-other-answers.md`
(16) · `07-base-and-asset-urls-across-origins.md` (17) ·
`08-the-environment-api-and-many-build-targets.md` (18) ·
`09-when-not-to-split-the-frontend.md` (19).

🔴 **If this session died here:** the 14 wave-1 files are committed and safe. Re-dispatch only
the wave-2 names above that `ls` does not find, then do the wiring list below.

### The original 13-chunk plan and its wave split

| pos | file | wave | agent |
|---:|---|---|---|
| 1 | `01-what-microservices-mean-to-a-vite-build.md` | 1 | A |
| 2 | `01a-the-bff-and-the-browser-fan-out.md` | 1 | A |
| 3 | `02-the-dev-proxy-against-many-services.md` | 1 | B |
| 4 | `02a-cors-cookies-and-websockets-through-the-proxy.md` | 1 | B |
| 5 | `03-service-urls-are-baked-in-at-build-time.md` | 1 | C |
| 6 | `04-one-repo-many-vite-apps.md` | 1 | C |
| 7 | `05-module-federation-on-vite.md` | 1 | D |
| 8 | `05a-shared-dependencies-and-singleton-breakage.md` | 1 | D |
| 9 | `05b-version-skew-and-the-remote-manifest.md` | 2 | — |
| 10 | `06-import-maps-and-the-other-answers.md` | 2 | — |
| 11 | `07-base-and-asset-urls-across-origins.md` | 2 | — |
| 12 | `08-the-environment-api-and-ssr-composition.md` | 2 | — |
| 13 | `09-when-not-to-split-the-frontend.md` | 2 | — |

### 🔴 Wiring this topic still owes, and it is easy to forget

1. **`docs/vite/pages/17-the-2026-toolchain-landscape/03-the-adjacent-toolchain.md`** ends with
   `Next → … · **end of the Vite track**`. **Repoint it at topic 18's first chunk and delete the
   "end of the Vite track" clause**, or topic 18 is unreachable by footer navigation.
2. `docs/vite/README.md` — the 17-topic table and the **"17 topics."** count line.
3. `docs/vite/pages/README.md` — the prose naming 17 as the newest topic.
4. `src/data/progress.js` — the vite row, **patched by line number** (a
   `16-migration-recipes` slug exists in both vite and webpack, so a uniqueness guard fires).
   Re-run `node scripts/status.mjs` afterwards; it goes stale the moment `progress.js` changes.
5. `_category_.json` is already written: `{"label":"18 · Microservices architecture","position":18,"collapsed":true}`.
6. Agents leave `{/* FOOTER */}`; **the coordinator wires the real `← Prev · Next →` chain.**
   🔴 A topic is not closed while one marker remains.

---

## 🟢 The 17/17 record, still true for topics 01–17 — 2026-09-08, session `82249172`

Batches 3 and 4 closed topics 01–17. A session told *"continue with vite"* with **no other
instruction** should say the track is complete and ask what to pick up — that remains right.

| | |
|---|---|
| ✅ Position, measured | **17 / 17 topics · 163 of 164 pages carry `> Validated:`** (`find docs/vite/pages -name '*.md' \| wc -l` = 164; the one without a stamp is `docs/vite/pages/README.md`, the track index, which never had one) |
| ✅ Gates at wind-down | `mdxcheck docs/vite` **0 hazards** · `yarn linkcheck` **7,279 files / 0 problems corpus-wide** · `page-counts.mjs --check` current · `status.mjs --check` up to date · **zero `{/* FOOTER */}` markers** track-wide · `sidebar_position` unique and gap-free in every topic |
| 🔴 **NOT PUSHED** | **11 commits on devbible `main`** — the user pushes. Batch 3: `92a3bdd1` `5b4a3a9b` `aeb9f869` `877b0427` `21832133` `b29b11ac`. Batch 4: `652554e5` `561a97ab` `c330436a` `4a88024f` + the status refresh |
| ⛔ CI | **Deliberately NOT watched** — the user said so twice |

### What batch 4 landed (2026-09-08)

| Topic | Commit | Split proof |
|---|---|---|
| **15-deployment-considerations** | `652554e5` | 1 page → **15 chunks**, 98 → **1,788** lines, 0 → **113 ★** |
| **16-migration-recipes** | `561a97ab` | 1 page → **15 chunks**, 161 → **2,572** lines, 0 → **113 ★** |

**Batches 3 + 4 together: 5 pages → 60 chunks, 578 → 9,800 lines, 0 → 474 ★.**

🔴 **Topic 16's missing footer is FIXED.** It had no footer on any page; it now has a full chain,
and **topic 17's back-link was repointed** from 16's first chunk to its last
(`01n-module-federation-migration.md`). That back-link repoint is a step batch 3 never needed —
the rewire script gained it for batch 4.

### 🔴 Two failures in batch 4 worth carrying forward

1. ⚠️ **Both `01g`+ agents STALLED** (`no progress for 600s`) after writing every file but **before
   running their gates or reporting**. Their content was complete and good; what was missing was
   process. The session found and fixed it: **8 files in topic 15 had no `> Validated:` stamp**, and
   **15 files had no `---` rule before `{/* FOOTER */}`**. ➜ **A stalled agent's files are salvage,
   not rubbish — gate them yourself rather than re-running the agent.** The rewire script's footer
   regex now treats the `---` rule as optional for exactly this reason.
2. 🔴 **A sibling agent's cross-check caught a deploy-breaking dangling link** the author never saw:
   `16/01h` linked `../12-path-resolution-and-aliases/README.md`. **No vite topic has a `README.md`**
   — the track uses `_category_.json` plus numbered chunks. Repointed to `01-resolve-options.md`.
   ➜ Keep telling agents to report defects outside their lane, found not fixed. It works.
3. ⚠️ **`src/data/progress.js` has a `16-migration-recipes` row in TWO tracks** (vite at line 524,
   webpack at 759). A `count(old) == 1` uniqueness guard fires on it. **Patch the vite rows by line
   number**, and re-run `node scripts/status.mjs` afterwards — it goes stale the moment
   `progress.js` changes.

---

## ✅ BATCH 3 CLOSED — session `82249172`, 2026-09-08

**The user named it:** *"continue with batch 3"*, then *"deploy the agents you need to complete the
batch untill that batch complete do not deploy more"*, *"You monitor their work deploy max 4 agents
and split work"* and *"finish batch 3 and save progress"*. Four agents, content only; the session
QCd, rewired, wired and committed every unit.

| Agent | Lane | Result |
|---|---|---|
| A | topic 12 `01`–`01f` — aliasing | 7 files, 2,032 lines |
| B | topic 12 `01g`–`01m` — bare-specifier resolution | 8 files, 1,958 lines (split `01g` → `01ga` at 337 lines) |
| C | topic 13 — workers & WASM | 5 chunks |
| D | topic 14 — Vitest 5 on Vite 8 | 10 chunks |

| Topic | Commit | Split proof |
|---|---|---|
| **12-path-resolution-and-aliases** | `21832133` + wiring `b29b11ac` | 1 page → **15 chunks**, 101 → **3,170** lines, 0 → **115 ★** |
| **13-worker-and-wasm-support** | `92a3bdd1` + wiring `5b4a3a9b` | 1 page → **5 chunks**, 119 → **862** lines, 0 → **41 ★** |
| **14-testing-integration** | `aeb9f869` + wiring `877b0427` | 1 page → **10 chunks**, 99 → **1,408** lines, 0 → **92 ★** |

**Batch 3 total: 3 pages → 30 chunks, 319 → 5,440 lines, 0 → 248 ★.**

✅ Gates at close: `mdxcheck docs/vite` **0 hazards** · `yarn linkcheck docs/vite` **137/0** ·
`yarn linkcheck` **7,251 files / 0 problems corpus-wide** · `page-counts.mjs --check` current ·
`status.mjs --check` up to date · **zero `{/* FOOTER */}` markers left** · `sidebar_position`
1..N unique and gap-free in all three topics.
🔴 **Committed, NOT pushed** — the user pushes. Six commits: `92a3bdd1` `5b4a3a9b` `aeb9f869`
`877b0427` `21832133` `b29b11ac`.

✅ **Track position, measured 2026-09-08: 15 / 17 topics · 133 of 136 pages carry `> Validated:`.**
The 3 unvalidated pages are exactly `15-deployment-considerations/01`, `16-migration-recipes/01` and
the `README.md` at `docs/vite/pages/`. Only **15-deployment-considerations**
(98 lines) and **16-migration-recipes** (161) remain — that is batch 4, and it closes the vite track.

### 🔴 Facts bought in batch 3 — do NOT re-derive

1. **`resolve.tsconfigPaths` is a REAL first-party Vite 8 option** — `boolean`, default `false`,
   *"Enables the tsconfig paths resolution feature. `paths` option in `tsconfig.json` will be used to
   resolve imports."* Verified by the session against `https://vite.dev/config/shared-options.md`.
   It removes the need for `vite-tsconfig-paths` in the common case. 🔴 Documented exception: it
   **does not apply inside `.less` files**.
2. Defaults confirmed verbatim on that same page: `resolve.extensions`
   `['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']` · `resolve.mainFields`
   `['browser', 'module', 'jsnext:main', 'jsnext']` · `resolve.conditions`
   `['module', 'browser', 'development|production']` · `resolve.preserveSymlinks` `false`.
   🔴 **There is no `resolve.builtins` option** — agent B confirmed its absence; the seed-era
   assumption that one exists is wrong.
3. **`worker.format` defaults to `'iife'`, not `'es'`.** The seed page asserted `'es'` was "the
   modern default". `worker.rollupOptions` is now `worker.rolldownOptions` (old name a deprecated
   alias), and `worker.plugins` is a **factory** because worker builds run as parallel Rolldown
   worker builds.
4. **`vite --debug resolve` is not a documented namespace.** The real channel, read out of Vite's
   own resolve plugin source, is **`vite:resolve-details`**.
5. ⚠️ **Vitest's `/config/deps` page still says "esbuild"** with no mention of Rolldown. Treat that
   as possible doc lag, not as evidence that Vitest bypasses Vite 8's pipeline — the page says so
   explicitly rather than resolving it.

### 🔴 Dispatch corrections confirmed again in batch 3

- ✅ `sidebar_position: 0` + literal `{/* FOOTER */}` + **central rewire** worked a third time. The
  script is `scratchpad/rewire.py --topics <a,b,c> --prev <topic/file.md> --next <topic/file.md>`;
  it assigns 1..N in natural chunk order (`01`, `01a`, `01ga`, `01h` sort correctly as plain
  lexicographic), rebuilds the chain, and repoints the previous topic's last footer. 🔴 **The
  scratchpad is session-local and this script does NOT survive** — batch 4 rewrites it. ~90 lines.
- ✅ "Aim ≤ 250 lines" landed: 30 chunks, largest **291**, none over the cap, one agent split its own
  file mid-write at 337.
- ✅ Splitting **one topic across two agents on a concept boundary** (aliasing vs bare-specifier
  resolution) worked with zero collision — give each a disjoint letter range and say who owns what.
- ✅ `SendMessage` was **not needed**: all four agents ran to completion. Committing per topic as it
  landed meant topic 12's long tail never put 13 and 14 at risk.

---

## 🔴 NEXT — in this order

| # | What | Exact file |
|---|---|---|
| 1 | ✅ batch 3 | **CLOSED** 2026-09-08 — topics 12, 13, 14. 30 chunks, 5,440 lines, 248 ★ |
| 2 | 🟡 **BATCH 4 — IN FLIGHT** since 08:41 IST 2026-09-08, session `82249172`. Four agents dispatched, still in the research phase; **nothing on disk yet**. Lane detail in [LOCKS.md](LOCKS.md) §0i. It CLOSES the vite track | `15-deployment-considerations/01-shipping-the-build.md` (98 lines, 0 ★) · `16-migration-recipes/01-cra-to-vite-migration.md` (161, 0 ★). 🔴 **16 has NO footer at all** and must gain one pointing forward to `../17-the-2026-toolchain-landscape/`. Two topics → two agents is the natural split; `15` also wants the deploy-target matrix (static hosts, `base`, SPA fallback, preview) |


## 🔴 DISPATCH CORRECTIONS — learned in batch 1, apply to every batch from now on

1. **Tell agents to aim ≤ 250 lines, not ≤ 285.** All three overshot: drafts came in at 403, 382,
   360, 347. Every one had to split. 2 dispatched chunks became **42**.
2. ⛔ **"Never reflow markdown across the `---` fences."** An agent's reflow pass destroyed the
   frontmatter of two files and **both gates passed them**. See
   [gap_gates_do_not_validate_frontmatter.md](gap_gates_do_not_validate_frontmatter.md).
3. ⛔ **Do NOT dispatch exact footer strings.** All three agents' splits invalidated the strings
   they were given — a planning error, not theirs. **The session owns the footer chain centrally**
   and rebuilds it after the batch lands, with `scratchpad/rewire.py`.
4. **Do NOT let agents choose `sidebar_position`.** They used fractional slots (15.3 … 20.5)
   because the letter→number scheme leaves no integer room. Tell them to write `sidebar_position: 0`
   and let the rewire script assign 1..N.
5. ✅ **`sidebar_position: 0` + central rewire WORKED.** Batch 2 produced zero fractional slots and
   zero footer-chain repairs beyond the scripted one. Keep it.
6. ⚠️ **`SendMessage` is DISABLED in this session type.** You cannot ask an agent to wind down —
   `TaskStop` is the only lever, and it is abrupt. Dispatch smaller units so a stop is cheap.
7. ✅ **Keep** the three rules that worked: list scratchpad files · never delete a `★` block, move it
   and name the destination · report the TOPIC's before/after totals, not per-file. All three agents
   complied, and agent cross-checking caught two real defects in the session's own work.

## Position — `grep -rl '^> Validated:' | wc -l`, measured 2026-09-08

**vite 15 / 17 topics · 133 of 136 pages.** Topics 01–06 were validated 2026-09-06 by session
`4e8d4393` and are **genuinely good** — already correct for Vite 8 and Rolldown. Do not re-run them.
07 (18 chunks), 08 (42), 09 (10), 10 (11), 11 (10), 17 (6, new) landed 2026-09-07; **12 (15), 13 (5)
and 14 (10) landed 2026-09-08 as batch 3**.

⬜ Pending, with current sizes: **15 (98) · 16 (161)** — both at **0 ★**, no tier badge, no
`> Verified:`. That is the whole remaining backlog on this track.

## 🔴 Facts already bought — do NOT re-derive these

**Bank: [research_vite_v8_quotes.md](research_vite_v8_quotes.md)** (144 lines) — every load-bearing
quote for env/modes, `loadEnv`, `define`, `envPrefix`/`envDir`, HTML `%VAR%`, TS augmentation, plus
the v8 Rolldown/Oxc migration lines. **Write from the bank; do not re-fetch per chunk.**

0. 🔴 **The plugin API is ROLLDOWN's on v8, not Rollup's.** *"Vite plugins extends Rolldown's plugin
   interface with a few extra Vite-specific options."* Through v7 that sentence named Rollup, and the
   docs now say *"It is recommended to go through Rolldown's plugin documentation first."* Naming
   convention changed with it: `rolldown-plugin-` prefix for anything using no Vite-specific hook.
   The v8-documented hook shape is `transform: { filter: { id }, handler }`, not a bare function.
1. 🔴 **vite.dev serves an LLM-optimised Markdown twin at `<path>.md`** — `https://vite.dev/guide/env-and-mode.md`,
   `.../guide/migration.md`, `.../config/shared-options.md`. Fetch **those**; the HTML page says so
   itself. ⚠️ `https://vite.dev/config/` has **no** `.md` twin — use the HTML for `loadEnv`.
2. 🔴 **`vite@8.2.2` depends on `rolldown ~1.2.4` and NOT on rollup.** esbuild is only an *optional
   peer*. `lightningcss` and `postcss` are hard deps. `engines.node` `^20.19.0 || >=22.12.0`. That
   manifest is the evidence v8 unified on Rolldown — not a blog post.
3. Versions, `registry.npmjs.org` 2026-09-07: vite **8.2.2** · rolldown **1.2.7** · rollup 4.63.1 ·
   esbuild 0.28.2 · webpack **5.110.3** · @rspack/core **2.2.2** · @babel/core **8.0.1** ·
   vitest 5.0.0 · eslint 10.10.0 · oxlint 1.81.0 · @biomejs/biome 2.5.12 · typescript 7.0.2 ·
   pnpm 12.3.4 · playwright 1.63.0 · @swc/core 1.16.2.
4. ⚠️ **webpack's npm `next` dist-tag reads `5.0.0-rc.6`** — a stale tag, NOT a newer line. Never
   report it as drift.
5. 🔴 **`docs/vite/pages/16-migration-recipes/01-cra-to-vite-migration.md` has NO FOOTER** (it is
   still an unvalidated import). Topic 17's chunk 1 links *back* to it and resolves fine, but when
   16 is validated it must gain a footer pointing forward to topic 17.
6. **Module Federation is no longer webpack-only.** `@module-federation/vite` **1.21.5** published
   **2026-09-07** by the official MF org. 🔴 The plugin most tutorials link —
   `@originjs/vite-plugin-federation` **1.4.1** — last shipped **2025-04-12**, ~17 months stale.
   webpack/rspack side is `@module-federation/enhanced` 2.9.0. `@vitejs/plugin-legacy` is 8.2.3.

## The webpack framing, agreed with the user 2026-09-07 (both sessions)

The user asked *"world has moved on webpack right? everything webpack does vite does it better?"*
and then *"i [am] hoping what i can do with webpack same i could with vite"*. The answer given:
**half right.** Vite won greenfield; it did not replace webpack. The drop-in successor for a
**webpack-shaped config** is **Rspack**, not Vite; Next.js went to **Turbopack**. The ecosystem
fragmented rather than consolidating.
➜ Write webpack as *"the model everything else implements"* (entry/output/loaders/plugins/chunk
graph) and *"how to read a config you inherited"* — never as the recommended tool for new work, and
never as a 2019 track.

## Tooling gaps reported to the user 2026-09-07 (measured, not guessed)

| Gap | Evidence | Where it belongs |
|---|---|---|
| **Rspack 2.2.2** | 🔴 **zero** mentions corpus-wide | inside `docs/webpack/` |
| **Rolldown 1.2.7** | 7 files name it; ✅ pin added this session | `docs/vite/` |
| **Biome 2.5.12** | 25 files name it, **no pin**, absent from `docs/eslint-oxlint/` | that track |
| **pnpm 12.3.4 / corepack** | 44 + 3 mentions, only `npm` pinned | nodejs |
| **ORM (Prisma+Mongoose) · CI/CD** | zero pages; user queued both | new cards, **rule 5: syllabus first** |

Turbopack is fine (97 files via `docs/nextjs/`). TypeScript correctly pinned at 7.0.2.

## Cadence
per file: write → `wc -l` + `grep -c '^\*\*★'` → `yarn mdxcheck docs/vite` + `yarn linkcheck docs/vite`
→ wire (README ✅ row + chunk count, `progress.js`, `page-counts.mjs`, `status.mjs`) → `git add`
explicit paths → commit → repoint this file.
🔴 **Never `git add -A`.** devbible is **committed, not pushed** — the user pushes.

⚠️ `graphify-out/cache/last_query_stamp` is permanently dirty and is **not ours**. Never commit it.

Related: [[devbible-locks]] · [[cursor-a2-toolchain]] · [[research-vite-v8-quotes]] · [[devbible-validation-ledger]]

Superseded blocks from [CURSOR-VITE.md](CURSOR-VITE.md), verbatim, newest first. Nothing here was dropped;
it was moved so the live file stays inside its 160-line budget.

Search rather than read: `shared/scripts/recall.sh --cold <terms>`

