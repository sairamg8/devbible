---
title: "DevTools and the Profiler"
sidebar_label: "12 · DevTools and Profiler"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> 🧪 **Sandbox-proven** — every console block on this page came from a script that was
> actually run. Verified: 2026-08 against **react-dom 19.2.8** in **Firefox 153.0**. Timings and
> mark counts come from `sandbox/react-p0/ex12-profiler.mjs`, which runs the same
> app in a development and a production build.

**React DevTools is a browser extension; `<Profiler>` is an API in React itself;
Performance Tracks is a 19.2 feature that writes into the browser's own
performance panel. All three are development-only, and that is the fact people
get wrong.**

## The extension

Install React DevTools for Chrome, Firefox or Edge. It adds two panels.

**Components** — the tree as React sees it, with props, state and hooks for the
selected component, editable live. Three settings worth turning on immediately:

- **Highlight updates when components render.** A visual flash on every
  re-render. The fastest way to see that typing in one field is re-rendering an
  entire page.
- **Hide logs during additional invocations** — collapses StrictMode's doubled
  console output.
- The **filter** box, to hide host elements (`div`, `span`) so the tree shows
  only your components.

**Profiler** — record an interaction, get a flamegraph of what rendered, how long
each component took, and *why* it re-rendered ("Why did this render?" must be
enabled in settings first).

The console message you see on every dev page comes from the absence of the
extension:

```console
[info] Download the React DevTools for a better development experience:
https://react.dev/link/react-devtools
```

## `<Profiler>` — the API

The extension needs a human. `<Profiler>` is programmatic, so it can go into a
test or an automated benchmark.

```jsx
<Profiler id="list" onRender={(id, phase, actualDuration, baseDuration, startTime, commitTime) => {
  console.log(id, phase, actualDuration.toFixed(1) + 'ms', baseDuration.toFixed(1) + 'ms');
}}>
  <List items={items} />
</Profiler>
```

| Argument | Meaning |
|---|---|
| `id` | The `id` prop, so one handler can serve several boundaries |
| `phase` | `"mount"`, `"update"` or `"nested-update"` |
| `actualDuration` | Time spent rendering **this commit**. Falls as memoization takes effect |
| `baseDuration` | Estimated time to render the whole subtree **with no memoization** |
| `startTime`, `commitTime` | Timestamps for correlating with other measurements |

The pair `actualDuration` versus `baseDuration` is the useful signal: `actual`
well below `base` means memoization is doing work.

## What it measures, measured

A 400-row list where each row does real arithmetic:

```console
$ node ex12-profiler.mjs
=== <Profiler onRender> — development build, Firefox 153 ===
  id=list phase=mount  actualDuration=50.0ms baseDuration=34.0ms

  -- re-render, same props, WITHOUT memo --
  id=list phase=update actualDuration=26.0ms baseDuration=24.0ms

  -- re-render, same props, WITH memo --
  id=list phase=update actualDuration=31.0ms baseDuration=22.0ms

  -- another re-render, still memoised --
  id=list phase=update actualDuration=8.0ms baseDuration=21.0ms
```

Read those four lines carefully, because the third one is a trap:

- **Mount** costs more than `baseDuration` — first render includes creating DOM.
- **Update without `memo`**: 26 ms actual against 24 ms base. Actual ≈ base means
  nothing is being skipped; every row re-rendered.
- **The switch to `memo`**: 31 ms, *higher*. This is **not** memo being slow.
  Swapping `Cell` for `MemoCell` changes the component type, so
  [reconciliation](04-reconciliation.md) unmounts and remounts all 400 rows. It
  is measuring a remount, not a memoised update.
- **The next memoised update**: **8 ms actual against 21 ms base**. That gap is
  what a working memoization looks like.

That third line is exactly the kind of confounded measurement that gets quoted as
"memo made it slower". The fix was to take a second measurement after the type
change had settled.

**A caveat on precision:** every number is a whole millisecond because Firefox
clamps `performance.now()` resolution for privacy. Chrome reports finer values.
Compare numbers within one browser, never across.

## Profiling is off in production

```console
=== <Profiler onRender> — production build, Firefox 153 ===
  -- re-render, same props, WITHOUT memo --
  -- re-render, same props, WITH memo --
  -- another re-render, still memoised --
  (no onRender calls at all — see below)
```

**`onRender` never fired.** In a standard production build `<Profiler>` is inert:
the component renders its children and measures nothing, so there is no runtime
cost — and no data.

If you need production profiling, build against `react-dom/profiling`, which
re-enables the instrumentation and its overhead. Most teams profile in
development and accept that development is slower across the board.

## Performance Tracks (19.2)

React 19.2 writes its own timeline into the browser's performance panel, so a
React render shows up beside layout, paint and network instead of as an
anonymous block of scripting.

```console
=== console.timeStamp marks emitted — development ===
  timeStamp entries captured  837
  distinct track names        Blocking Track, Transition Track, Suspense Track,
                              Idle Track, Render, Commit, Waiting for Paint,
                              App, List, Cell, Remaining Effects

=== console.timeStamp marks emitted — production ===
  timeStamp entries captured  0
```

837 marks in development, **zero** in production. The mechanism is
`console.timeStamp`, which is why they were capturable from a script at all.

The track names are the interesting part:

- **Blocking / Transition / Suspense / Idle** — the priority lanes. This is where
  you can see whether an update was urgent or a transition
  ([Phase 8](../../syllabus/03-concurrent-and-server.md)).
- **Render / Commit / Waiting for Paint / Remaining Effects** — the phases from
  [page 03](03-render-reconcile-commit.md), as measurable spans.
- **App / List / Cell** — your own component names.

To use it: open the browser's Performance panel, record, and look for the React
tracks alongside the main thread.

## A workflow that works

1. **Reproduce** the slow interaction and record it in the Profiler.
2. **Look at the flamegraph** for the commit, not the average — one bad commit is
   the problem, not the mean.
3. **Ask "why did this render?"** for the widest bar. It is one of: state
   changed, parent re-rendered, context changed, or hooks changed.
4. **Fix the cause**, which is often structural (move state down, pass
   `children`) rather than a `memo`.
5. **Re-record** and compare. If `actualDuration` did not move, you fixed the
   wrong thing.

Step 5 is the one people skip. Phase 6 covers the fixes properly.

## Gotchas

**Symptom:** `<Profiler onRender>` never fires in the deployed app.
**Cause:** profiling is compiled out of the production build.
**Fix:** profile in development, or build against `react-dom/profiling` and
accept the overhead.

**Symptom:** every duration is a whole number of milliseconds.
**Cause:** the browser clamps timer precision — Firefox does this by default.
**Fix:** none needed; do not compare across browsers, and do not read
significance into sub-millisecond differences.

**Symptom:** adding `memo` made the profile *worse*.
**Cause:** likely a confounded measurement — the first render after swapping the
component type is a remount, not an update. Measured above: 31 ms, then 8 ms.
**Fix:** take the measurement after the change has settled, and compare
like with like.

**Symptom:** the Components panel shows `Anonymous` everywhere.
**Cause:** arrow functions assigned to unnamed exports, or an over-aggressive
minifier in a development build.
**Fix:** named function declarations, or set `displayName`.

**Symptom:** development feels far slower than production, and you profile
anyway.
**Cause:** the development build carries warnings, double rendering and
instrumentation.
**Fix:** use development profiling to find *relative* hotspots; confirm absolute
numbers with a production build and browser-level tooling.

## Interview questions

**★ How do you find out why a component re-rendered?**
React DevTools Profiler with "Record why each component rendered" enabled. It
attributes each render to state, props, parent, context or hooks. Guessing
before doing this is the most common wasted effort in React performance work.

**★ What is the difference between `actualDuration` and `baseDuration`?**
`actualDuration` is what this commit cost; `baseDuration` estimates what the
subtree would cost with no memoization at all. `actual` far below `base` means
memoization is working — measured here as 8 ms against 21 ms.

**★ Does `<Profiler>` slow down production?**
No, because it does nothing there — `onRender` is never called in a standard
production build. That also means you get no production data unless you build
against `react-dom/profiling`.

**What are React Performance Tracks?**
A React 19.2 feature that emits `console.timeStamp` marks so React's own
scheduling — priority lanes, render, commit, waiting for paint, and individual
component names — appears in the browser's performance panel. Development only:
837 marks in dev, 0 in production.

**Why might a profiling result be misleading?**
Because something else changed at the same time. The measurement above showed
`memo` apparently costing 5 ms more, when the run being measured was actually a
remount caused by swapping the component type. Always ask what else differs
between the two sides.

---

← Prev: [The React Compiler](11-the-compiler.md) · Index: [Phase 0](README.md) · Next → [React on other renderers](./13-other-renderers.md)
