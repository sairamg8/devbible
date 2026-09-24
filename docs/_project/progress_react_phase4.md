---
name: devbible-react-phase4
description: React Phase 4 (Effects and synchronization) — COMPLETE, 18 topics, 27 files, 0 broken links, build-verified
metadata:
  type: project
---

**Saved every 3 files** (hard rule 9). Phase 3: [[devbible-react-phase3]].
Phase 3 concepts: [[devbible-react-concepts-phase3]].
Validation: [[devbible-react-validation-status]].
UI cadence: [[devbible-ui-progress-and-build-cadence]].

## Status — ✅ COMPLETE

**All 18 topics written, 27 content files.** Concepts:
[[devbible-react-concepts-phase4]].

`docs/react/pages/phase-4-effects/`. Committed in batches on `main`:
`be0c6e8` (01–03), `4277725` (04), `2dcc89e` (05–06), `66b0dd1` (07–08),
`d903422` (09–10), `356862f` (11), `1d41fcb` (12–13), `ae75cb5` (14–15).

**Phase-close verification:** link walker over all 28 files → **0 broken links**;
**0 files over 300 lines**; line spread **159–294**.

🔴 **React is now PARKED at phases 0–4 complete (106 files).** Phases 5–14 remain
= **161 topics**. Free for any session to pick up — see the claims table.

Chunked topics: **04 Cleanup** (3), **06 You might not need an effect** (3),
**11 Removing dependencies** (3).

## File sizes so far — the spread is honest

| Topic | Files | Lines |
|---|---|---|
| 01 what an effect is for | 1 | 219 |
| 02 useEffect anatomy | 1 | 255 |
| 03 the dependency array | 1 | 249 |
| 04 cleanup | 3 + README | 262 / 294 / 228 (+47) |
| 05 StrictMode | 1 | 273 |
| 06 you might not need an effect | 3 + README | 227 / 250 / 289 (+98) |
| 07 fetching data | 1 | 281 |
| 08 race conditions | 1 | 250 |
| 09 effect lifecycle | 1 | 240 |
| 10 useEffectEvent | 1 | 242 |
| 11 removing dependencies | 3 + README | 244 / 262 / 210 (+93) |

**Both chunked topics were drafted whole and split after measuring**, never sized
to fit. Topic 06 chunk 01 hit **308** and split again at the case-7 boundary.

## Topic 04 as built — 3 chunks, not 1 file

Drafted as one file, measured at **363 lines over cap after the first split**, so
it split twice on concept boundaries. Final: 262 / 294 / 228 (+47 README).

| Chunk | Content |
|---|---|
| `01-the-cleanup-contract.md` | The invariant; cleanup is **not** unmount code (3 occasions); the old-values closure; "symmetrical" + setup→inverse table; the ref anti-fix; cleanup-without-setup smell |
| `02-cleanup-recipes.md` | react.dev's 5 cases — widgets (both answers), events, animations, fetching, analytics — plus the 3 no-cleanup-needed shapes |
| `03-when-cleanup-is-not-the-answer.md` | Buying a product; the remount principle; initializing the application; the 4-question decision order |

**The split was load-bearing, not cosmetic.** Chunk 03 is a genuinely different
claim from 01–02: not "how to write cleanup" but "this was never an effect".

## 🔴 Topics 05 and 06 — check what earlier phases already own FIRST

**Both topics turned out to be largely covered elsewhere, and finding that out
before writing changed their shape completely.** Do this check for every
remaining topic.

**Topic 05 (`StrictMode`)** — two pages already existed:
`phase-0-how-react-runs/07-strictmode.md` (247 lines, **sandbox-measured**, owns
the dev-vs-prod console output, bundle size, wrong-fix/right-fix) and
`phase-2-components/02-purity/03-strictmode-and-the-compiler.md` (229 lines, owns
purity + the Compiler). So phase 4's version is **the effects half only**, one
file, 273 lines. Its genuinely new material:
- 🔴 **`StrictMode` only doubles the *mount*.** The caveat says the extra cycle
  runs *"before the first real setup"* — not before every setup. So an effect
  whose cleanup is wrong on the **dependency-change** path passes cleanly and
  still leaks. A green `StrictMode` proves the mount path only. **This is the
  most useful non-obvious claim in the topic.**
- Callback refs get their own extra setup+cleanup cycle (→ topic 15).
- **Partial `StrictMode` is not per-subtree**: *"React will only enable behaviors
  that are possible in production"*, so wrapping one component gives you **no**
  extra effect cycle on initial mount. It must be at the root.
- DevTools **dims** second-render logs (and can suppress them) — so log count is
  never a measurement. Effect-setup logs are *not* dimmed, which is why those are
  the ones people notice.

**Topic 06 (You might not need an effect)** — react.dev has **12 cases, not 8**.
🔴 **Phase 3 already owns cases 1–4 in full** (`06-derived-state.md` covers the
antipattern, `useMemo`, *and* both escape hatches; `07-resetting-state-with-key`,
`16-updating-state-during-render`). Case 8 is owned by topic 04 chunk 03; 11 and
12 belong to topics 16 and 07. So this topic is **an index of all 12 with depth
only on 5, 6, 7, 9, 10, 11** — 3 chunks, no duplication.

## Sources for topic 04 (fetched and quoted this session)

- react.dev **[Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)**
  § *How to handle the Effect firing twice in development* — all five recipes
  verbatim, the 🚩 ref anti-fix, both "Not an Effect" sections.
- react.dev **[`useEffect` reference](https://react.dev/reference/react/useEffect)**
  — Parameters (cleanup with old values), Caveats (the StrictMode extra cycle
  wording), Troubleshooting (*"My cleanup logic runs even though my component
  didn't unmount"*, *"cleanup code without corresponding setup … is usually a
  code smell"*).

## Topics 09–11 claims

- 🔴 **Effects do not mount/update/unmount — they only start and stop.** *"An
  Effect can only do two things."* One mount can contain many start/stop cycles.
  This is the framing that makes "cleanup is not unmount code" follow rather than
  need memorising. Read every effect by answering only: what does **start** mean,
  what does **stop** mean.
- **The door-lock analogy** for StrictMode: *"opening a door and closing it an
  extra time to check if the door lock works."* It tests the pairing, not a rare
  journey.
- **Not reactive, two reasons:** mutable-outside-React (`location.pathname`,
  `ref.current` — nothing meaningful to compare between renders) and module-scope
  constants (never differ between renders).
- 🔴 **`useEffectEvent` re-verified stable** — reference page has **no**
  experimental/canary banner (checked 2026-08-14). Safe to write straight.
- 🔴 **Effect Event identity is intentionally UNSTABLE** — *"acts as a runtime
  assertion: if your code incorrectly depends on the function identity, you'll see
  the Effect re-running on every render."* Never put one in a dependency array,
  never `useCallback` it. A stable identity would have made the misuse silent.
- **Never pass an Effect Event to another component or Hook** (react.dev's
  `useTimer(onTick, 1000)` counter-example). It belongs inside the hook that calls
  it.
- 🔴 **Topic 11 has EIGHT documented moves, not four** (syllabus said four): move
  outside the component · move inside the effect · read primitives from an object ·
  calculate primitives from a **pure** function prop · updater form · Effect Event ·
  move to a handler · split the effect.
- **Move 3 (destructure an object prop to primitives during render)** is the one
  that works **without the parent changing anything** — the common real-world case.
  ⚠️ It must happen *during render*, not inside the setup.
- ⚠️ **Move 4 requires purity** — calling `getOptions()` in the render body. For an
  **impure** function prop the answer is `useEffectEvent` instead.
- 🔴 **The suppression bug, worked:** a suppressed `[]` keeps the initial render's
  `onTick` forever, so with `count === 0` and `increment === 1` it calls
  `setCount(0 + 1)` every second — the counter **always shows 1**, frozen at the
  first render's arithmetic while appearing to run. Not "lagging".
- **A ref hiding a dependency is worse than eslint-disable** — same lie, no
  evidence in the code, because refs are non-reactive so nothing is ever flagged.
  Test: replace the ref with the value and see if the linter objects.
- react.dev: *"There's always a better solution than ignoring the linter!"* — a
  claim about **coverage**, backed by the eight moves.

**Fetched for topics 07–08:** the `useEffect` deep dive *What are good
alternatives to data fetching in Effects?* (the four downsides, verbatim) and MDN
**`AbortController`** / **`AbortSignal`**.

Still to fetch: **Lifecycle of Reactive Effects** (09), **Separating Events from
Effects** (10), **Removing Effect Dependencies** (11), **`useLayoutEffect`** (12),
**`useInsertionEffect`** (17).

## Topics 07–08 claims

- 🔴 **The four fetching downsides are not React's fault** — *"This list of
  downsides is not specific to React. It applies to fetching data on mount with
  any library."* The weak strategy is **fetching on mount**; effects are just the
  most direct way to express it. Every recommended alternative changes **when the
  request starts**, not how the effect is written.
- **The waterfall is structural**: an effect runs after its component renders, and
  a child renders after its parent, so requests serialise along tree depth even
  when independent. Cannot be fixed by writing the effect better.
- **Extracting a `useData` hook fixes ergonomics ONLY** — no cache, no dedup, still
  post-mount. Worth saying explicitly; it is widely believed to be the fix.
- **`setBio(null)` at the top of the setup** is a separate fix from `ignore`: the
  flag stops the wrong response being *applied*, the reset stops the old data being
  *displayed* meanwhile.
- **Six concerns to build yourself**: dedup, cache, waterfall avoidance
  (preload/hoist to routes) — react.dev's list — **plus error handling and loading
  state**, which the documented example omits.
- 🔴 **`ignore` does not cancel** — the request completes and is discarded.
  `AbortController` cancels but its fetch rejects with a **`DOMException` named
  `AbortError`** (MDN), so a `.catch` that treats all rejections as failures turns
  the fix into a visible error. `err.name === 'AbortError'` is mandatory.
- `ignore` works with **any promise**; a signal only works with APIs that accept
  one. They compose — abort guards the network, ignore guards the state update.
- MDN extras worth keeping: `signal.aborted`, `signal.reason`,
  `throwIfAborted()`, `AbortSignal.timeout(ms)`, **`AbortSignal.any([...])`** (compose
  a timeout with the cleanup signal).
- ⚠️ **Could not confirm** MDN's default `abort()` reason from the pages fetched —
  left out of the page rather than guessed.

## Claims worth reusing

- 🔴 **The invariant is testable, not stylistic:** *"the user shouldn't be able to
  distinguish between the setup being called once (as in production) and a setup
  → cleanup → setup sequence (as in development)."* Every recipe is that one
  question re-answered.
- 🔴 **Cleanup is tied to dependencies, not to the component's lifetime** — it
  runs on every dependency change while the component is alive. react.dev has a
  troubleshooting entry for people who assume this is a bug.
- **Same HTTP verb, opposite answers.** Analytics POST needs no cleanup (caused
  by rendering, duplicate is dev-only and harmless); a purchase POST must move to
  an event handler (caused by an interaction, duplicate costs money). The test is
  **causation and consequence**, never the method name. This is the sharpest
  worked example in the phase.
- **The remount is a real user journey**, not a synthetic one — visit, navigate
  away, press Back. It remounts in *production*, `StrictMode` absent. So "works
  only the first time" was always broken.
- **No effect can promise "once"** — application init belongs at module level with
  a `typeof window` guard, because the module is also evaluated during SSR.
- **A cleanup added where none was needed is not free** — resetting what the next
  setup re-sets introduces a visible flicker. Cleanup is not a safe default.
- ⚠️ The ref-guard anti-fix generalises: `hasRun`, `isFirstRender`, `didInit`, a
  module-level boolean — all the same mistake. react.dev: *"The right question
  isn't 'how to run an Effect once', but 'how to fix my Effect so that it works
  after remounting'."*
- 🔴 **"By the time an Effect runs, you don't know *what* the user did."** The
  defining property, not a limitation. Every case in topic 06 chunk 01 is that
  sentence. **A guard clause at the top of an effect** (`if (product.isInCart)`,
  `if (jsonToSubmit !== null)`) is intent being reconstructed after the fact —
  a reliable smell for misplaced event logic.
- **State used as a message queue** — a handler sets state purely so an effect
  will notice and act. Delete both; the handler can call the function.
- 🔴 **An effect chain cannot be replayed.** It is attached to *state changing*,
  not *the user acting*, so undo, history, session restore and tests that seed
  state all re-fire the cascade. react.dev leads with the render cost but this is
  the bigger argument. Handler logic is **inert until called**.
- **A chain of effects is usually a chain of derived values that were stored** —
  `isGameOver` was always `round > 5`. Delete the storage and the maintaining
  effect goes with it.
- **Collapsing a chain reintroduces the snapshot trap**: the links had been
  getting fresh values only because each ran in a *later render*. In one handler
  you must name intermediates (`const nextRound = round + 1`).
- **Batching cannot merge across a render boundary.** Child-sets-state +
  effect-notifies-parent is two commits, so no amount of batching helps; both
  calls in one handler is one render. Better still, lift the state up — then
  there is no second copy to synchronise.
- **`subscribe` for `useSyncExternalStore` must be module-scope** or React
  resubscribes every render.
- ⚠️ **Do not over-apply "requests don't go in effects"** — the analytics ping in
  react.dev's `Form` example deliberately *stays* in the effect.

## 🔴 UI progress — the rule that was being missed

The user interrupted this session to say so: **"make sure you guys are updating
UI as well, exact progress what was completed."** Phase 4 had sat at `pages: 0`
in `src/data/progress.js` while 3 topics were already written and committed.

Per [[devbible-ui-progress-and-build-cadence]] the bump is **per page, not per
phase**. For a mid-flight phase that means **both** fields:

```js
{n: 4, slug: 'phase-4-effects', …, topics: 18, pages: 4, pagesPlanned: 18},
```

`pagesPlanned` is what makes `phaseStatus()` return `'writing'` instead of
`'written'`, so the bar shows partial credit (`topics * pages / pagesPlanned`).
**Setting `pages` without `pagesPlanned` would mark the phase complete.** Drop
`pagesPlanned` only at phase end.

`pages` counts **topics done, not files** — phase 3 is `pages: 17` for 17 topics
across 19 files.

Three places to update together, every time:
1. `src/data/progress.js` — the react row only (rule 10).
2. `docs/react/pages/README.md` — the phase table row.
3. `docs/README.md` — both the claims-table row (line ~15) and the technology
   row (line ~98). File count there = **content files excluding phase READMEs**
   (phases 0–3 = 79; +12 for phase 4 so far = 91).
4. `phase-4-effects/README.md` — the 🚧 count, the topic row (add its link), and
   the Coverage block (topic→file count and the chunked-topics table).

## Phase-close checklist (not yet done)

Link walker to 0 · `src/data/progress.js` react phase 4 → `pages: 18`, **drop
`pagesPlanned`** · phase README un-🚧'd with every row linked ·
`docs/react/pages/README.md` → ✅ Written · `docs/README.md` both rows ·
`wc -l` check · clean rebuild + ANSI strip grep · concept record
`reference_react_concepts_phase4`.

## Coordination

`docs/README.md` claims table: **React is held by session `52a29103`.**
🟢 **PostgreSQL is COMPLETE and RELEASED (298 pages) — free to pick up.**
JavaScript is active on phase 7. MongoDB, Docker, Redis, Nginx still unclaimed
with zero pages. Standing instruction: finish React, then take remaining/parked
languages one at a time, **checking no active session holds them first**.
