---
name: devbible-react-phase6
description: React Phase 6 (Rendering performance and the React Compiler) — COMPLETE — 17 topics, 18 files, 0 broken links, build-verified
metadata:
  type: project
---

**UI every topic, memory every 3 topics** (hard rule 9). Phase 5:
[[devbible-react-phase5]] · concepts: [[devbible-react-concepts-phase5]].

## Status — ✅ COMPLETE

**All 17 topics, 18 content files.** Concepts: [[devbible-react-concepts-phase6]].
Commits `73c18ea` `7e48f3a` `33b2b31` `e2a364d` `9a6c1fc` `6702ed8`.

**Phase close:** link walker 0 broken · 0 files over 300 · spread **78–276** ·
**full clean rebuild → 0 React broken links**.

🔴 **Next: React Phase 7 — Custom hooks and the Rules of React (12 topics).**

## 🔴 CHECK FIRST — Phase 0 · 11 already owns the Compiler, WITH measurements

`phase-0-how-react-runs/11-the-compiler.md` (252 lines) is **sandbox-measured**
against `babel-plugin-react-compiler 1.0.0` and owns: what it emits, `_c()` slot
counts, what it will and will not touch, **it is not a linter**, turning it on,
and "should you turn it on?". **Topics 07–11 must not restate it** — link to it and
cover the parts it does not: install/config detail, bail-out rules,
`eslint-plugin-react-hooks` v7, and the migration question.

## ✅ Version claims — ALL VERIFIED 2026-08-14

- **Compiler v1.0 stable** ✅ — *"React Compiler is now stable and has been tested
  extensively in production."* Phase 0 pins `babel-plugin-react-compiler 1.0.0`,
  stable since **7 Oct 2025**.
- **`eslint-plugin-react-hooks` v7** ✅ — npm shows **7.1.1** (published ~4 months
  before Aug 2026). ⚠️ Note the **19.2 release post says v6** — both are true at
  different dates; v6 shipped alongside 19.2 in Oct 2025, v7 is current now.
- **Performance Tracks in 19.2** ✅ — *"a new set of custom tracks added to **Chrome
  DevTools** performance profiles"*, tracks **Scheduler ⚛** and **Components ⚛**.
- **`<Activity>` in 19.2** ✅ — modes **`hidden`** (hides children, **unmounts
  effects**, defers updates until React has nothing left to work on) and
  **`visible`**. For topic 15.
- 🔴 **`useId` prefix DID change in 19.2** — `:r:` / `«r»` → **`_r_`**, for View
  Transitions support. **I had marked this "not confirmed" in Phase 5 topic 14 and
  have now corrected that page** (`fccfcaa`). Lesson: the release post answers
  version questions the API reference does not.

## Topics 01–03 claims

- 🔴 **`memo` addresses ONE cause of re-rendering** (a re-rendering parent, with
  stable props). Documented: a memoized component still re-renders on **its own
  state** and on **a context it reads**. That is why wrapping in `memo` so often
  changes nothing while looking like a fix.
- 🔴 *"Memoization is a performance optimization, **not a guarantee**."* React may
  re-render anyway. If code breaks without `memo`, that is a hidden bug.
- 🔴 *"`memo` is **completely useless** if the props passed to your component are
  always different"* — an inline object/arrow from the parent defeats it entirely.
- **Minimising prop changes, best to worst:** project to a value that changes less
  (`hasGroups` not `person`) > pass primitives > `useMemo` the object.
- ⚠️ **Custom `arePropsEqual` has two traps**: you must compare **every prop
  including functions** (otherwise the handler keeps a previous render's closure —
  no error, very confusing), and **deep equality can freeze the app for seconds**
  when someone nests the data one level further.
- 🔴 **`useMemo` has THREE documented reasons, and two are about IDENTITY not
  cost**: slow calculation with rarely-changing deps · prop to a `memo` component ·
  used as another Hook's dependency. *"There is no benefit … in other cases."*
- **The measurement method is documented**: `console.time` around it, treat **~1ms
  or more** as worth memoizing, then re-measure. ⚠️ `useMemo` **never makes the
  first render faster**; measure in a **production build** (StrictMode double-renders
  in dev) with **CPU throttling**.
- ⚠️ **The cache is not a guarantee** — discarded on file edit in dev, and **in dev
  and prod if the component suspends during initial mount**. For a genuinely stable
  instance use `useState`'s initializer or the `useRef` idiom.
- 🔴 **The argument against blanket memoization that actually lands:** *"a single
  value that's 'always new' is enough to break memoization for an entire
  component"* — while every `useMemo` stays in place looking like it works.
- 🔴 **react.dev's own claim: *"Most performance problems in React apps are caused
  by chains of updates originating from Effects."*** So the first profile question
  is **how many COMMITS one interaction produced**, not which component is slow.
  The fastest perf fix is often deleting an effect (Phase 4 · 06 · 02).
- **Coarse vs granular** is the best heuristic: page-replacing apps rarely need
  memoization; drawing-editor-shaped apps do.
- **Counting re-renders is not a metric. Milliseconds are.**

## Topics 04–08 claims

- 🔴 **`useCallback` does NOT prevent creating the function** — *"You're always
  creating a function (and that's fine!), but React ignores it."* It buys
  **referential stability only**. Two valid reasons: a `memo` child, or a Hook
  dependency. A plain `onClick` gains nothing.
- 🔴 **The documented debugging recipe** for "my memo never caches": log the deps
  array, right-click → **"Store as a global variable"** for two renders, then
  `Object.is(temp1[i], temp2[i])` per element. Otherwise memoization failures are
  **invisible** — no error, linter satisfied.
- **Omitting the deps array entirely** returns a new function every render, silently.
- 🔴 **`<Profiler>`'s `actualDuration` ÷ `baseDuration` is a memoization score** —
  close to 1 means nothing was skipped. **The only way to tell a working `memo`
  from a defeated one.** `phase: "nested-update"` = a state update from the commit
  phase = the effect-chain fingerprint.
- ⚠️ `<Profiler>` is **disabled in production builds by default**; needs a special
  profiling-enabled production build.
- **Performance Tracks add priority and blocking**, which the React Profiler cannot
  show — "blocked waiting for a different priority", "waiting for paint".
- 🔴 **The memoization trap**: memoization is a **chain**; one always-new value
  breaks it entirely while every call stays in place looking like it works. The fix
  is **composition** (`children`), which is **enforced by structure** and cannot be
  silently broken by a later refactor. **The Compiler automates the memoization
  column, NOT the composition column.**
- 🔴 **Compiler limits**: only memoizes **components and hooks**, and **memoization
  is NOT shared across components** — a shared expensive fn runs once per component.
  Fix is a module-level cache, outside React.
- 🔴 **`babel-plugin-react-compiler` must run FIRST** in the Babel pipeline —
  *"needs the original source information"*. Misconfiguration has **no error**; the
  tell is the missing **"Memo ✨" badge** in DevTools.
- **`target` accepts `'17' | '18' | '19'`** — below 19 you must also install
  **`react-compiler-runtime`**. So the Compiler does **not** require React 19.
- Adoption options: `compilationMode: 'annotation'` (`"use memo"` opt-in),
  `panicThreshold: 'none'` (skip instead of failing the build), `gating` (runtime
  flag), `logger` (count `CompileSuccess`).
- **Existing memoization: leave it.** *"removing it can change compilation output"* —
  your `useMemo` is an **input to the analysis**, not just redundant work.

## Topics 09–13 claims

- 🔴 **Compiler bail-outs are SILENT and per-function** — *"no speed-up here, never
  a broken build."* So you can have it installed and getting almost nothing with no
  signal. The **"Memo ✨" badge** + a `CompileSuccess` logger are the only coverage
  check.
- 🔴 **The asymmetry:** it **skips** what it cannot analyse, but **compiles
  rule-violating code it CAN analyse** (Phase 0 measured a prop-mutating component
  compiled into 4 slots, nothing reported). Bail-out ≠ bug detection.
- **The linter's compiler rule names are the clearest published list of what the
  Compiler must prove**: `immutability` `purity` `globals` `refs`
  `set-state-in-render` `set-state-in-effect` `static-components` `error-boundaries`
  `component-hook-factories` `unsupported-syntax` `incompatible-library`
  `preserve-manual-memoization` `use-memo` `config` `gating`.
- 🔴 **Compiler diagnostics work WITHOUT adopting the Compiler** — *"can be used
  even if your app hasn't adopted the compiler yet."* Inverts the usual adoption
  order: linter first, no build change, real bugs found.
- **v6 vs v7 is not a contradiction** — v6 shipped with 19.2 (Oct 2025) and brought
  compiler rules + flat-config-by-default; **npm shows 7.1.1** now. ⚠️ react.dev's
  reference page is published against an `rc` channel.
- **`preserve-manual-memoization` is the mechanism** behind "removing memoization
  can change compilation output" — your `useMemo` is an **input to the analysis**.
- 🔴 **The one surviving hand-written case:** a memoized value used as an **effect
  dependency**. It survives because it is a **correctness** concern (stable identity
  so a subscription does not rebuild), not a performance one.
- 🔴 **`lazy()` inside a component resets ALL state below it on every render** — it
  returns a new component *type* each call. Same failure as defining a component
  inside a component (hence the `static-components` rule).
- **`lazy` caches both the promise and its resolved value**; a rejected chunk is
  **thrown to the nearest error boundary** — the post-deploy stale-hash failure.
- **Preload on intent** (`onMouseEnter` + **`onFocus`**) is a *community pattern on
  documented behaviour*, not a React API. Page says so.
- 🔴 **Why `children` works, stated precisely:** React skips a child when the
  element is *identical*; `children` from a parent that did not re-render **is** the
  same element object. Nothing clever is compared.
- **Structural beats memoized on two decisive rows:** it helps the **first render**
  (memoization explicitly does not), and the **Compiler does not automate it**.
- **Only 2 of the 5 "make memoization unnecessary" principles are about
  memoization** — the other three are purity and effects.

## Coordination

React claimed by session `6ffd754d`; phases 0–5 complete (124 files).
⚠️ **MongoDB was trimmed by another session** from 204 → **82 topics**
(critical-path only, Master rows capped at 6/phase). Counts resynced in
`progress.js`, `docs/README.md` and the MongoDB README; the claim notice was
corrected to 🟢 unclaimed. See [[devbible-mongodb-syllabus]].
