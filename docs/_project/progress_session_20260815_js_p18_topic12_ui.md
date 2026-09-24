---
name: devbible-session-20260815-js-p18-topic12-ui
description: Session 78e4bc26 (2026-08-15) — verified JS phase 11, wrote phase 18 topic 12 (long lists), created hard rule 12 + the cross-session dev-server/build registry, and fixed the progress UI so parked phases stop reading as mid-flight (JS now 100%).
metadata:
  type: progress
---

# Session `78e4bc26` — 2026-08-15

Started from *"pick phase 11, check it is complete and merged, then take phase 18 topic 12"*. Ended
with JavaScript reading **complete** on the site for the first time. Four workstreams, in order.

## 1 · Phase 11 verified and `main` pushed

**Phase 11 · Network, storage and data transfer was already complete** — 21 topic directories on
disk, `progress.js` at `topics: 21, pages: 21`, closing commit `052be55e`. Nothing was unmerged:
⛔ **there are no worktrees and only one branch** (`main`), so the "merge the worktree, delete it"
step had nothing to do. What *was* missing was a push — `main` was 4 commits ahead, so
`507d9a1f..ffeaaba8` went up.

⚠️ **In a shared checkout `git log -1` shows whatever another session just committed.** HEAD moved
under this session twice. Verify your own work with `git branch -r --contains <sha>`, not with
`git log -1`.

## 2 · Phase 18 topic 12 · Long lists without freezing — ✅ COMPLETE

**4 files, 782 lines, 0 over the 300-line cap, 0 broken links.** Understand tier,
documentation-validated against MDN. Detail and the per-file map live in
[[devbible-javascript-split-4way]]; the shape worth remembering is **earn it → build it → live with
it**:

| File | Lines | The load-bearing idea |
|---|---|---|
| `01-why-a-long-list-freezes.md` | 228 | **two freezes, not one** — a long task building the nodes, and ongoing style/layout while scrolling. Four cheaper fixes first; 🔴 **`content-visibility: auto` is the one to try before windowing**, because MDN guarantees skipped content stays available to find-in-page, tab order, focus and the a11y tree |
| `02-windowing-from-scratch.md` | 263 | empty **sizer** owns the scrollbar, a transformed **layer** holds the rows; overscan; rAF-coalesced scroll; a node **pool** whose common path writes one transform; `aria-setsize`/`aria-posinset` |
| `03-what-windowing-breaks.md` | 234 | variable heights via prefix sums + binary search, **the correction jump** anchored by hand; then the honest cost list — Ctrl+F, selection, printing, focus, sticky headers, `:nth-child`, deep links |
| `README.md` | 57 | topic index |

🔴 **The framing that made this topic worth writing:** virtualisation is the answer everyone reaches
for and the **only** fix that removes rows from the document. The syllabus row asked for *"the point
at which it beats rendering everything"* — that half was written as **signals** (visible pause after
batching, dropped frames on a mid-range device, memory that never comes back) because **no
measurement was run and inventing a row count is rule 2**.

**Claims checked against MDN before writing, not from memory:** `content-visibility` + the
find-in-page guarantee · `Scheduler.yield()` is **limited availability, not Baseline** (so the page
feature-detects) · `aria-setsize`'s exact "override the browser's incorrect count" wording · the
scroll event "can fire at a high rate" · a `transform` ancestor becomes the containing block, which
is why a sticky header inside the layer sticks to the layer · `overflow-anchor` is **not Baseline**,
so browser scroll anchoring cannot rescue a windowed list. **One claim was deliberately left
uncertain:** the maximum element height a browser will lay out — implementation-defined, no citable
number found, so the page says measure it rather than quoting a figure.

## 3 · 🔴 Hard rule 12 — the cross-session dev-server / build registry

Mid-session instruction: *"Do not start dev server … we need to find a way to communicate each
other"*, then *"make it as hard rule to communicate across sessions"*. Result:

- **[[session-build-devserver-registry]]** in `shared/` is the channel — claim a row before
  `yarn start` or `yarn build`, **delete the row the moment the process stops**, and register your
  session on arrival even when running neither.
- **Rule 12 in `~/.claude/CLAUDE.md`** (and its store backup) so it loads in every session.
  ⚠️ **`yarn build` counts** — it compiles every language, so it is as heavy as the dev server.
- **It works.** Within the hour, sessions `0e830881` (JS topic 15) and four Docker chunk sessions
  had added their own rows unprompted.
- ⚠️ **This narrows rule 4.** "A green build proves nothing" assumed a rebuild was always
  available; where it is not, the report must say **link-checked, not built** rather than implying a
  build passed. Every page this session shipped is in that category.

## 4 · The progress UI — parked ≠ mid-flight

Asked to make the UI match reality. The per-phase data was **already correct** (all 19 JS phases
audited against disk, zero drift) — the *interpretation* was wrong: phases 13–15 still carried
`pagesPlanned`, so `phaseStatus()` said `'writing'` and the site showed **89% · "In progress: Phase
13"** for a language with an empty queue.

The fix and its semantics are recorded in [[devbible-ui-progress-and-build-cadence]] §3
(`parked: true`). Outcome:

| | Before | Now |
|---|---|---|
| JavaScript | 89% · 16/19 phases · next "Phase 13" | **100% · 16/16 phases · 269/269 topics · 282 pages · 34 parked · next "Complete"** |

Also corrected, all re-derived from disk rather than trusted:

- `docs/README.md` — **282 of 316 rows / 526 leaf pages**; the **268** it claimed was inherited and
  low (each session had been adding 1 to a stale base).
- `docs/javascript/pages/README.md` — completion banner, 13–15 marked **⏸ PARKED** with real
  counts, the stale "94 in-scope topics" intro, and chunk D's "8/18, 2 left" row.
- `docs/javascript/README.md` — the tier table read **100 · 170 · 66 · 4 = 340** against a 337-row
  syllabus: it counted the **tier-legend rows** as topics. First-badge-per-row gives
  **99 · 170 · 64 · 4**, and Master by part becomes **Web APIs 17**, not 18. 🔴 This is the error
  `~/.claude/CLAUDE.md` warns not to reintroduce — it was still live in the page.

**Verification without a build:** a 20-line Python walker resolving every relative link against the
filesystem, `wc -l` for the cap, `grep -rn '</content>'` for the write-tool leak, and
`@babel/core` + `preset-react` (already in `node_modules`) to **parse-check the three changed
JS/JSX files** before committing. Then `summarise()` imported in node and printed for **all 24
languages** to prove no other language's numbers moved.

## What is open — deliberately not fixed

- 🔴 **React reads 100% (210/210) because phases 12 and 13 are ABSENT from `progress.js`** — not
  zero rows, missing rows. React's real total is ~244 topics. Belongs to whoever holds React
  (rule 11), so it was left and flagged.
- ⚠️ **A stray misplaced directory**: `docs/javascript/pages/docs/javascript/pages/phase-7-async/12-timers/`
  — untracked, another session's bad path, phase 7's owner to delete.
- **No full-site build has been run in this session**, and none is claimed.

## JavaScript's end state

**🏁 Done.** Phase 18's last three topics landed the same day, one per session — **11**
`dbaa68e7` · **12** `78e4bc26` (this one) · **15** `0e830881`, who did the phase close by the
"whichever session finishes last" rule. 269 scheduled topics across 16 phases, 526 leaf pages,
Master 99/99. The 34 remaining topics are **parked, not pending**; reopening one needs a new
instruction.
