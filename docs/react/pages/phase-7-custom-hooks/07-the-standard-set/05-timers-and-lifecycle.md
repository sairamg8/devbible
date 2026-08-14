---
title: "Timers and lifecycle — useInterval, useIsMounted"
sidebar_label: "05 · Timers and lifecycle"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useEffectEvent`](https://react.dev/reference/react/useEffectEvent) (the interval
> example and caveats) and
> [`useEffect`](https://react.dev/reference/react/useEffect) (cleanup).
> The removal of the "setState on an unmounted component" warning is React 18's
> behaviour change, recorded in the React Working Group discussion
> [reactwg/react-18#82](https://github.com/reactwg/react-18/discussions/82) —
> **not sandbox-reproduced here**, and no console block appears on this page.
> No sandbox script backs this page; claims are cited, not measured.

**The last two hooks of the standard set. One is the textbook stale-closure problem with
a documented answer; the other is a hook you should usually delete, because it exists to
silence a warning React removed in 2022.**

## `useInterval`

react.dev's own `useEffectEvent` reference uses this exact shape as its example, which
makes it the rare community hook with a documented canonical form:

```js
const onTick = useEffectEvent(() => {
  setCount(count + increment);
});

useEffect(() => {
  const id = setInterval(() => {
    onTick();
  }, 1000);
  return () => clearInterval(id);
}, []);
```

Generalised into the hook:

```jsx
import { useEffect, useEffectEvent } from 'react';

export function useInterval(callback, delay) {
  const onTick = useEffectEvent(callback);

  useEffect(() => {
    if (delay == null) return;                 // null pauses the interval
    const id = setInterval(() => onTick(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
```

**Gotcha 1 — the stale closure, which is the whole reason this hook exists.** The naive
version passes the callback straight to `setInterval`:

```jsx
// 🔴 the callback is frozen at the render that created the interval
useEffect(() => {
  const id = setInterval(callback, delay);
  return () => clearInterval(id);
}, [delay]);
```

`callback` closes over the props and state of the render in which the interval was
created. Because the effect does not re-run — `callback` is deliberately not a dependency
— the interval keeps calling that first version forever. A counter reads `count` as `0`
on every tick; a poller sends the `userId` the component mounted with, not the current
one. Adding `callback` to the dependency array is the obvious fix and is worse: the
caller's inline arrow is new every render, so the interval is cleared and recreated on
every render and **the timer never reaches its delay** — a 1-second interval in a
component that re-renders every 300 ms never fires at all.

`useEffectEvent` resolves the dilemma exactly: `onTick` always sees the latest values,
and it is not a dependency, so the interval survives re-renders.

**Gotcha 2 — never put `onTick` in the dependency array.** From the caveats:

> **Effect Event functions do not have a stable identity. Their identity intentionally
> changes on every render.**

Listing it would recreate the interval every render, which is the bug you just fixed. The
linter enforces this; it is worth understanding rather than obeying, because an
`eslint-disable` here reintroduces the failure silently.

**Gotcha 3 — `delay` must be a dependency, and `null` should pause.** The interval's
period is a genuine reason to tear down and rebuild, so `delay` belongs in the array.
Accepting `null` to pause is the conventional signature and is better than the caller
conditionally calling the hook — which would break the Rules of Hooks
([Phase 7 · 05](../05-why-the-rules-exist/README.md)).

**Gotcha 4 — `setInterval` does not guarantee the period.** It is a minimum, not a
schedule: background tabs are throttled hard, and a tick that takes longer than the delay
causes callbacks to queue. For anything where elapsed time matters — a countdown, a clock
— compute from `Date.now()` at each tick rather than counting ticks, or the display
drifts whenever the tab is backgrounded.

**Gotcha 5 — `StrictMode` will create the interval twice.** Setup → cleanup → setup leaves
exactly one live interval, so a correct hook is unaffected. If you see two timers, the
cleanup is not clearing what the setup created — the symmetry requirement from
[Phase 4 · 04](../../phase-4-effects/04-cleanup/README.md).

## `useIsMounted` — the hook to delete

```jsx
// 🔴 In almost every case, this should not exist
export function useIsMounted() {
  const ref = useRef(false);
  useEffect(() => {
    ref.current = true;
    return () => { ref.current = false; };
  }, []);
  return useCallback(() => ref.current, []);
}
```

Used as:

```jsx
const isMounted = useIsMounted();
const data = await fetchThing();
if (isMounted()) setData(data);        // 🔴 guarding the wrong thing
```

**Gotcha 1 — it exists to silence a warning that no longer exists.** React ≤ 17 warned
*"Can't perform a React state update on an unmounted component."* **React 18 removed
that warning**, on the grounds that it was widely misunderstood and misleading: setting
state on an unmounted component is a no-op, not a leak. The hook is therefore solving a
problem the runtime stopped reporting years ago — and if it is still in a codebase, it is
usually because someone copied it from an article written before 2022.

**Gotcha 2 — it hides the real bug instead of fixing it.** The genuine problem behind
"set state after unmount" is almost always a **race condition**: two requests in flight,
and the slower one resolving last. `isMounted()` does nothing about that — both responses
arrive while the component is very much mounted, and the stale one wins. The documented
fix is an ignore flag or an `AbortController` in the effect's cleanup
([Phase 4 · 08](../../phase-4-effects/08-race-conditions.md)), which fixes the
out-of-order case *and* the unmounted case together:

```jsx
useEffect(() => {
  let ignore = false;
  fetchThing(id).then((data) => { if (!ignore) setData(data); });
  return () => { ignore = true; };
}, [id]);
```

**Gotcha 3 — a real leak is not fixed by not calling `setState`.** If a subscription, a
timer or a listener is still running after unmount, the leak is the subscription. Guarding
the `setState` leaves it running and merely makes it quiet. The cleanup function is the
fix.

**Gotcha 4 — it reads a ref where a closure is clearer.** The `ignore` flag above is a
plain variable scoped to one effect run, so it is impossible to get wrong; the ref is
shared across every effect and every call in the component, so it cannot distinguish
"this request is stale" from "the component is gone".

**When something like it is legitimate:** integrating with an imperative library that
insists on calling back after teardown and offers no unsubscribe. That is rare, and it
should be named for what it guards — not `useIsMounted`, which is a lifecycle name and
falls foul of
[Phase 7 · 06 · 01](../06-designing-a-hooks-api/01-the-name-and-the-arguments.md).

## Gotchas

**Symptom:** an interval callback always sees the initial state.
**Cause:** the callback is frozen in the render that created the interval.
**Fix:** wrap it in `useEffectEvent`; do not add it to the dependency array.

**Symptom:** an interval never fires in a frequently re-rendering component.
**Cause:** the callback is in the dependency array, so the timer is cleared and recreated
before it elapses.
**Fix:** the same one — that is precisely what effect events are for.

**Symptom:** a countdown drifts after the tab is backgrounded.
**Cause:** `setInterval` is a minimum delay, and background tabs are throttled.
**Fix:** compute elapsed time from `Date.now()` rather than counting ticks.

**Symptom:** two intervals run in development.
**Cause:** the cleanup does not clear the id the setup created.
**Fix:** `clearInterval(id)` for the id from *that* setup — `StrictMode` is reporting a
real asymmetry.

**Symptom:** a codebase is full of `isMounted()` guards.
**Cause:** cargo-culting a fix for a React ≤ 17 warning that React 18 removed.
**Fix:** delete them and handle the actual race with an ignore flag or `AbortController`.

**Symptom:** stale data appears after switching quickly between items.
**Cause:** an `isMounted` guard cannot help — both responses arrive while mounted.
**Fix:** an ignore flag keyed to the effect run, so only the latest request's result is
accepted.

**Symptom:** a subscription keeps running after unmount but nothing warns.
**Cause:** the `setState` was guarded rather than the subscription cleaned up.
**Fix:** return a cleanup function. The guard hides the leak; it does not fix it.

## Interview questions

**★ Why does `useInterval` need `useEffectEvent`?**
Because of a dilemma with no good answer without it. Passing the callback straight to
`setInterval` freezes it in the render that created the interval, so it reads stale props
and state forever. Adding it to the dependency array makes the caller's inline arrow
recreate the interval on every render, so a timer in a busy component never reaches its
delay. An effect event always calls the latest version without being a dependency, which
is why react.dev's own reference uses an interval as its example.

**★ Why must an effect event never appear in a dependency array?**
Because its identity intentionally changes on every render, so listing it recreates the
effect every render — reintroducing exactly the bug it was added to fix. The linter
enforces the rule, and an `eslint-disable` here fails silently rather than loudly.

**★ What is wrong with `useIsMounted`?**
Three things. The warning it was written to silence — "Can't perform a React state update
on an unmounted component" — was removed in React 18 because setting state after unmount
is a harmless no-op, not a leak. It does not fix the real bug behind those warnings, which
is a race between two in-flight requests where both resolve while mounted. And if there is
a genuine leak, the leak is the subscription or timer that is still running; guarding the
`setState` just makes it quiet.

**★ What should you use instead?**
An ignore flag or an `AbortController` set up and torn down in the effect's cleanup. It is
scoped to a single effect run, so it distinguishes "this response is stale" from "this
response is current" — which an `isMounted` ref cannot — and it handles the unmount case
as a side effect of handling the ordering case.

**Why is `setInterval` unreliable for a countdown?**
Because the delay is a minimum, not a schedule. Background tabs are throttled aggressively
and a slow tick pushes the next one out, so counting ticks drifts. Compute the remaining
time from a timestamp on each tick and the display self-corrects.

**How should a hook let the caller pause a timer?**
By accepting `null` (or `undefined`) as the delay and returning early inside the effect.
The alternative — the caller wrapping the hook call in a condition — breaks the Rules of
Hooks, because the hook count would then depend on whether the timer is running.

---

← Prev: [Observing an element](04-observing-an-element.md) ·
Index: [The standard set](README.md) ·
Next → [Hooks that wrap effects](../08-hooks-that-wrap-effects/README.md)
