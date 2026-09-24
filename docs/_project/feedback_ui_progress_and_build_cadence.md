---
name: devbible-ui-progress-and-build-cadence
description: Standing rule (2026-08-10) — every completed topic appears in the site UI immediately; at phase end save progress to memory, then build once and fix what it reports
metadata:
  type: feedback
---

Two instructions the user gave mid-session on **2026-08-10**, while Phase 3 was
being written. Both are standing rules for [[devbible-brief]], not one-offs.

## 1. Completed topics show up in the UI

> "Add to UI I can see the progress" · "Once topic completion add to UI"

The site must make progress visible without the user asking. As each topic/page
lands, update the progress data so the homepage and the docs overview move.

**Where it lives:** `src/data/progress.js` is the single source of truth —
per-phase `topics`, `pages` written, and `pagesPlanned` for the phase currently
in flight. `src/components/Progress/` renders it (bar, counters, phase grid);
it is used on `src/pages/index.js`, `docs/nodejs/README.md` and
`docs/nodejs/pages/README.md`. Bumping the `pages` number is the whole update —
nothing else is hand-maintained, so the numbers can never disagree.

**Why:** the user is often away while a phase is being written and wants to open
the site and see how far it has got, rather than reading the transcript.

**How to apply:** after each page is written, bump that phase's `pages` count.
At phase end, set `pages` to the final count and drop `pagesPlanned`.

A topic that is written must be visible to the user **regardless of whether the
build is currently clean** — the UI update is not gated on anything.

## 2. The end-of-phase sequence, in this order

> "once complete phase or chapter make sure to save the progress to memory and
> always then check for build errors … once phase complete ran build check for
> issues fix it and continue"

Per page, while writing: bump the UI count. Nothing else.

At the end of each phase, in order:

1. **Finish every page** in the phase, plus its index README and the coverage
   table.
2. **Set the final counts** in `src/data/progress.js` (drop `pagesPlanned`) and
   update `docs/nodejs/pages/README.md`.
3. **Save progress to the memory store** — update
   [[devbible-progress]] with what landed, the verified findings from the
   sandbox, and anything left undone. Commit and push the store.
4. **`yarn build`**, then fix everything it reports, in one pass.
5. Continue to the next phase.

**Why:** the user is often away for a whole phase. Memory has to be written
before the build step so that a crash or interruption during the build never
loses the record of what was done.

**How to apply:** do not run `yarn build` between pages — it is slow and the
per-page check was eating time that belongs to content. One build per phase.
Grep the output for `warning|broken`: `onBrokenLinks` is not `throw` here, so a
green `[SUCCESS]` line alone does not mean the links are good (see
[[devbible-progress]]).

⛔ **Step 4 is now GATED — see [[session-build-devserver-registry]] and hard rule 12.** A build
holds a large Node heap and compiles every language, and several sessions run at once, so
`yarn build` needs a claimed row in the registry first. With no claim available, verify by
resolving every relative link against the filesystem and say plainly in the report that the
pages were **link-checked, not built**. The dev server is effectively banned.

## 3. `parked: true` — a phase that is set aside is NOT mid-flight (added 2026-08-15)

`src/data/progress.js` now supports a third state. Before this, a phase that was **parked** still
carried `pagesPlanned`, so `phaseStatus()` returned `'writing'`, the Progress block labelled it
**Writing**, and `nextPhase` pointed at it — the site claimed work was in flight on a language
whose scheduled work was finished. JavaScript sat at **89% with "In progress: Phase 13"** for
exactly that reason.

**The shape:** put `parked: true` on the phase (and drop `pagesPlanned`). `phaseStatus()` returns
`'parked'`; `summarise()` leaves parked phases out of `percent`, `topicsTotal`, `topicsDone`,
`phasesTotal`, `phasesDone`, `inFlight` and `nextPhase`, and exposes `parkedPhases` /
`parkedTopicsLeft` instead. Pages written inside a parked phase still count in `pagesWritten`.

**Set on:** JavaScript phases **13, 14, 15** (the DSA track, kept at Master only). JavaScript then
reads **100% · 16/16 phases · 269/269 scheduled topics · 282 pages · 34 parked · next Complete**.
⚠️ **No other language has a parked phase**, so nothing else moved — verified across all 24 by
importing `summarise()` in node before committing.

**How to apply:** use `parked` for a phase the user has said *"not now"* about; use a dropped
phase's **in-scope `topics` count** (phase 16's pattern — `topics: 3` for 16 rows) when rows were
cut outright. Never leave `pagesPlanned` on something nobody is writing.

⚠️ **A real gap this exposed, left alone deliberately:** React reads **100% (210/210)** because
**phases 12 and 13 are missing from `progress.js` entirely** — they are not zero rows, they are
absent. That belongs to whoever holds React (rule 11), not to a JavaScript session.
