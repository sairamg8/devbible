---
title: "Measure before you optimise"
sidebar_label: "05 · Measure before you optimise"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<Profiler>`](https://react.dev/reference/react/Profiler),
> [`useMemo`](https://react.dev/reference/react/useMemo)
> (§ How to tell if a calculation is expensive?) and the **React 19.2 release
> post** (1 Oct 2025) for Performance Tracks.
> The DevTools Profiler UI itself is
> [Phase 0 · 12](../phase-0-how-react-runs/12-devtools-and-profiler.md).
> No sandbox script backs this page.

**Three instruments, each answering a different question. Reaching for the wrong
one is why so many optimisations are aimed at components that were never the
problem.**

| Instrument | Answers |
|---|---|
| `console.time` | is *this specific calculation* slow? |
| `<Profiler>` | how long did *this subtree* take, mount vs update, and is memoization helping? |
| **Performance Tracks** (19.2) | what was React doing, at what priority, and what blocked it? |
| DevTools Profiler | which component in which commit, and why did it render? |

## `console.time` — the cheapest question

```jsx
console.time('filter array');
const visibleTodos = filterTodos(todos, tab);
console.timeEnd('filter array');
```

> If the overall logged time adds up to a significant amount (say, **`1ms` or
> more**), it might make sense to memoize that calculation.

A documented threshold, and a before/after method: wrap it in `useMemo` and check
the total dropped. Nothing else on this page is needed to answer "is this
calculation expensive" — and the docs' prior is that it usually is not:

> In general, **unless you're creating or looping over thousands of objects, it's
> probably not expensive.**

## `<Profiler>` — programmatic subtree timing

```jsx
<Profiler id="App" onRender={onRender}>
  <App />
</Profiler>
```

```jsx
function onRender(id, phase, actualDuration, baseDuration, startTime, commitTime) {
  // Aggregate or log render timings...
}
```

The two duration arguments are the interesting pair:

> **`actualDuration`**: The number of milliseconds spent rendering the `<Profiler>`
> and its descendants for the current update. **Indicates how well the subtree uses
> memoization.**

> **`baseDuration`**: The number of milliseconds estimating how much time it would
> take to re-render the entire `<Profiler>` subtree **without any optimizations.**
> Represents worst-case rendering cost.

🔴 **`actualDuration` ÷ `baseDuration` is a memoization score.** Close to 1 means
your memoization is doing nothing — everything re-rendered anyway. Far below 1
means renders are being skipped. That single ratio answers "is the `memo` I added
actually working?", which is otherwise invisible.

> **`phase`**: `"mount"`, `"update"` or `"nested-update"`.

`"nested-update"` is worth knowing on sight — it means a render triggered by a
state update from within the commit phase, which is the fingerprint of the effect
chain from [topic 01](01-why-did-this-re-render.md).

And the caveat that decides where you can use it:

> **Profiling adds some additional overhead, so it is disabled in the production
> build by default.** To opt into production profiling, you need to enable a special
> production build with profiling enabled.

> Although `<Profiler>` is a lightweight component, it should be used **only when
> necessary**, as each use adds some CPU and memory overhead.

Profilers nest, and `id` is how you tell them apart — a `Sidebar`, a `Content`, and
an `Editor` inside `Content`, each reporting separately, with `commitTime` shared
across all profilers in one commit so you can correlate them.

## Performance Tracks — new in 19.2

The most capable of the three, and the newest:

> A new set of custom tracks added to **Chrome DevTools performance profiles**.

**Scheduler ⚛**

> Shows what React is working on for different priorities (e.g., **"blocking"** for
> user interactions, **"transition"** for updates inside `startTransition`) …
> information about when an update is **blocked waiting for a different priority**,
> or when React is **waiting for paint** before continuing.

**Components ⚛**

> Shows the tree of components React is working on to render or run effects …
> labels such as **"Mount"** for when children mount or effects are mounted, or
> **"Blocked"** for when rendering is blocked due to yielding to work outside React.

What these give you that the React Profiler does not: **priority and blocking**.
The React Profiler tells you a commit took 40ms; the Scheduler track tells you the
update sat waiting behind a higher-priority one, or behind work that was not
React's at all. That distinction changes the fix entirely — from "make this
component faster" to "stop blocking the main thread".

Because they live in the browser's own performance panel, they line up with layout,
paint and long tasks on the same timeline, which is where a React-only profile stops
being enough.

## The conditions for trusting any of it

Three, all documented, all routinely ignored:

> **`useMemo` won't make the *first* render faster.** It only helps you skip
> unnecessary work on updates.

> your machine is probably faster than your users' so it's a good idea to test the
> performance with an **artificial slowdown** … Chrome offers a CPU Throttling
> option.

> measuring performance in development will not give you the most accurate results.
> (For example, when Strict Mode is on, **you will see each component render twice**
> rather than once.) To get the most accurate timings, **build your app for
> production** and test it on a device like your users have.

A development-build measurement on a fast laptop is wrong in three directions at
once, and the errors do not cancel.

## The order

1. **Reproduce the slow interaction** and confirm it is perceptible.
2. **Performance Tracks or the DevTools Profiler** — how many commits, which
   subtree, what priority.
3. **`console.time`** on the specific suspect calculation.
4. **Change one thing.**
5. **Re-measure the same way.** A fix you cannot demonstrate is a guess you have
   committed.

Step 5 is the one that gets skipped, and it is the one that separates an
optimisation from a superstition. `<Profiler>`'s `actualDuration`/`baseDuration`
ratio is the cheapest way to do it for a memoization change.

## Gotchas

**Symptom:** a `memo` was added and nobody can say whether it helped.
**Cause:** no before/after measurement.
**Fix:** `<Profiler>` around the subtree; compare `actualDuration` against
`baseDuration` before and after.

**Symptom:** timings look fine locally, users report lag.
**Cause:** development build, StrictMode double-rendering, faster machine.
**Fix:** production build, real device, CPU throttling.

**Symptom:** `<Profiler>` reports nothing in production.
**Cause:** profiling is disabled in the production build by default.
**Fix:** the special profiling-enabled production build — and remove it afterwards.

**Symptom:** `phase` is `"nested-update"` and nobody knows what that means.
**Cause:** a state update triggered from within the commit phase.
**Fix:** look for an effect chain
([Phase 4 · 06 · 02](../phase-4-effects/06-you-might-not-need-an-effect/02-chains-of-effects.md)).

**Symptom:** the React Profiler says the commit was fast and the interaction still
feels slow.
**Cause:** the cost is outside React — a long task, layout, or a higher-priority
update blocking this one.
**Fix:** Performance Tracks, which show blocking and priority alongside browser
work.

**Symptom:** `<Profiler>` components left in the tree permanently.
**Cause:** treating it as monitoring.
**Fix:** each adds CPU and memory overhead; the docs say use it only when
necessary.

## Interview questions

**★ How do you tell whether memoization is actually working?**
`<Profiler>`'s `onRender` gives both `actualDuration` — the time this update
actually spent — and `baseDuration`, the estimated cost of re-rendering the whole
subtree with no optimizations. The ratio is effectively a memoization score: close
to 1 means nothing was skipped and your `memo` is inert; well below 1 means renders
are genuinely being avoided. Without that comparison, an added `memo` is unfalsifiable.

**★ What do Performance Tracks add over the React Profiler?**
Priority and blocking. Introduced in 19.2 as custom tracks in Chrome DevTools
performance profiles: the **Scheduler** track shows what React is working on at
which priority — blocking for user interactions, transition for `startTransition` —
and when an update is waiting on a different priority or on paint. The
**Components** track shows the tree being rendered with labels like "Mount" and
"Blocked". And because they sit in the browser's own timeline, they line up with
layout, paint and long tasks.

**★ Why must you measure in a production build?**
Because a development build is slower, StrictMode renders every component twice, and
your machine is faster than your users'. All three distort the numbers, in different
directions, so they do not cancel out. The docs recommend a production build, a
device like your users have, and CPU throttling.

**What is the documented bar for "expensive enough to memoize"?**
Roughly **1ms or more**, measured with `console.time` around the calculation while
performing the interaction — then re-measured after wrapping it in `useMemo` to
confirm the total dropped. The docs' prior is that unless you are creating or
looping over thousands of objects, it is probably not expensive.

**What does a `phase` of `"nested-update"` tell you?**
That the render was triggered by a state update originating from within the commit
phase — the signature of an effect that sets state, and therefore of the effect
chains react.dev names as the cause of most React performance problems. It points
you at Phase 4 rather than at memoization.

---

← Prev: [`useCallback`](04-usecallback.md) · Index: [Phase 6](README.md) · Next → [The memoization trap](06-the-memoization-trap.md)
