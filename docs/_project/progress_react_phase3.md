---
name: devbible-react-phase3
description: React Phase 3 (State and the render cycle) — COMPLETE, 17 topics, build-verified
metadata:
  type: project
---

**Saved every 3 files** (hard rule 9, set 2026-08-13). Phase 2: [[devbible-react-phase2]].
Concepts: [[devbible-react-concepts-phase2]]. Validation: [[devbible-react-validation-status]].

## Status — COMPLETE

**All 17 topics written, build-verified, committed `91b17dd` on `main`.** 19 content
files + phase README. Concepts: [[devbible-react-concepts-phase3]].

🔴 **Next: React Phase 4 — Effects and synchronization (18 topics), no sandbox.**

`docs/react/pages/phase-3-state/`. Committed in three batches: `f08d9ff` (01–05),
`7ea8bdf` (06–11), `ff64267` (12–15).

| # | Topic | Tier | Done |
|---|---|---|---|
| 01 | `useState` | Master | ✅ |
| 02 | State is a snapshot | Master | ✅ |
| 03 | Updater functions | Master | ✅ |
| 04 | Automatic batching | Master | ✅ |
| 05 | Immutable updates | Master | ✅ **dir, 2 chunks** |
| 06 | Derived state | Master | ✅ |
| 07 | Resetting state with `key` | Master | ✅ |
| 08 | What triggers a re-render | Master | ✅ |
| 09 | Lazy initial state | Understand | ✅ |
| 10 | Structuring state | Understand | ✅ |
| 11 | Bailing out | Understand | ✅ |
| 12 | Render order | Understand | ✅ |
| 13 | The update queue | Understand | ✅ |
| 14 | State in lists | Understand | ✅ |
| 15 | Preserving and resetting across the tree | Understand | ✅ |
| 16 | Updating state during render | Understand | ✅ |
| 17 | Infinite render loops | Understand | ✅ |

**Phase-close checklist — all done:** phase README, `docs/react/pages/README.md` row,
claims table in `docs/README.md`, `src/data/progress.js` → `pages: 17`, clean rebuild +
grep, concept record.

**Only topic 05 needed chunking.** Line spread **189–300**; topic 06 landed exactly at
300 (at the cap, not over). Wider spread than Phase 2's 221–288, which is the right
shape — real topic lengths vary.

**Build:** 20 HTML routes under `phase-3-state`, **zero React warnings, zero MDX
failures**. The 15 remaining warnings are other sessions' areas (JavaScript 7,
TypeScript 4, PostgreSQL 3).

🔴 **Two link bugs the Python walker caught that a build would have too, but slower:**
a chunk linking `11-bailing-out.md` without `../`, and a **react.dev path quoted from the
docs as a site-relative link** (`/learn/choosing-the-state-structure#…`) — quoting doc
prose verbatim can import their absolute paths, which Docusaurus then treats as internal.
**Check quoted blocks for bare `/`-rooted links.**

## Sources used (all doc-validated, no sandbox)

react.dev **Learn**: State as a Snapshot · Queueing a Series of State Updates · Updating
Objects in State · Updating Arrays in State · Choosing the State Structure · You Might Not
Need an Effect · Render and Commit · Preserving and Resetting State · State: A Component's
Memory · Rendering Lists.
react.dev **Reference**: `useState` (caveats are the richest single source in the phase) ·
`flushSync`.
**Blog**: React v18 §Automatic batching.
**MDN**: `Array.prototype.toSorted` for the ES2023 methods, noted as such on the page.

## Findings worth reusing

- 🔴 **The `useState` reference caveats carry most of this phase's precision.** The
  bail-out wording — *"Although in some cases React may still need to call your component
  before skipping the children"* — is the bit everyone gets wrong; a bail-out is **not** a
  promise your function will not run.
- **Batching and the snapshot are different things** and are constantly conflated.
  Batching decides how many renders; the snapshot decides what the value is. Turning
  batching off would not fix three `setCount(count+1)` calls.
- **The updater form is often the fix for a *dependency array* problem**, not just a value
  problem — `setCount(c => c+1)` removes `count` from the effect deps entirely.
- **Derived state costs a visible frame**, not just tidiness: render with stale value →
  commit → effect → set state → render again. react.dev spells the sequence out.
- **`useRef` has no lazy form** — the `if (ref.current === null)` idiom is the workaround,
  and `useRef(new Thing())` constructing every render is a real mistake.
- **Index keys do not remount** — Phase 1's measurement. State stays with the *position*
  while data moves, so the symptom is corrupted data, not lost state. Worse than a reset.
- **The missing-key warning is deduped** (Phase 1 measurement) — its absence proves
  nothing.
- **A conditional wrapper element changes position** and wipes the subtree. Keep one tree
  shape, vary the `className`.

## Coordination (hard rule 10)

`docs/README.md` now carries a **claims table** and `docs/react/pages/README.md` a claim
notice naming this session (`52a29103`) as owner of all of `docs/react/`. Other sessions
adopted it immediately and added their own rows — **PostgreSQL is now COMPLETE (289
pages)** and **JavaScript is on phase 4**. MongoDB, Docker, Redis and Nginx remain
unclaimed with zero pages.

The user's standing instruction: finish React, then pick up remaining and parked
languages **one at a time, checking no active session holds that language first**.
