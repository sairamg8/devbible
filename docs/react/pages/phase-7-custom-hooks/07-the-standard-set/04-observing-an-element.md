---
title: "Observing an element — useIntersectionObserver"
sidebar_label: "04 · Observing an element"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Common components → `ref` callback](https://react.dev/reference/react-dom/components/common)
> (parameters, returns, the React 19 cleanup note, and the Strict Mode caveat) and MDN
> [`IntersectionObserver`](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver).
> No sandbox script backs this page; claims are cited, not measured.

**This hook gets its own page because the observer is the easy half. The hard half is
getting hold of the DOM node at the right moment — and a ref object is the wrong tool
for that, in a way that React 19's ref-callback cleanup finally fixes properly.**

## The API being wrapped

> The **`IntersectionObserver`** interface … provides a way to asynchronously observe
> changes in the intersection of a target element with an ancestor element or with a
> top-level document's viewport. **The ancestor element or viewport is referred to as
> the root.**

```js
new IntersectionObserver(callback, options)
```

> **`root`** … The `Element` or `Document` whose bounds are used as the bounding box when
> testing for intersection. If no `root` value was passed to the constructor or its value
> is `null`, **the top-level document's viewport is used.**
>
> **`rootMargin`** … An offset rectangle applied to the root's bounding box … Each offset
> can be expressed in pixels (`px`) or percentages (`%`). The default is
> `"0px 0px 0px 0px"`.
>
> **`threshold`** … a ratio of intersection area to bounding box area of an observed
> target. Notifications for a target are generated when any of the thresholds are
> crossed … If no value was passed to the constructor, **0 is used.**

> **`observe()`**: Tells the `IntersectionObserver` a target element to observe.
> **`unobserve()`**: Tells the `IntersectionObserver` to stop observing a particular
> target element. **`disconnect()`**: Stops the `IntersectionObserver` object from
> observing any target.

Three options and three methods. Nothing here is hard; the hook is hard because of
*when* you can call `observe`.

## 🔴 Why the ref-object version is broken

This is the implementation in most articles:

```jsx
// 🔴 fragile
export function useIntersectionObserver(ref, options) {
  const [entry, setEntry] = useState(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;                        // ← and nothing re-runs when it appears
    const io = new IntersectionObserver(([e]) => setEntry(e), options);
    io.observe(el);
    return () => io.disconnect();
  }, [ref, options]);

  return entry;
}
```

**A ref is not reactive.** Assigning `ref.current` does not re-render and does not re-run
effects — that is stated plainly in the `useRef` caveats and is the whole point of a ref
([Phase 5 · 08](../../phase-5-refs-context-reducers/08-when-a-ref-is-wrong.md)). So the
effect runs once, on mount, with whatever `ref.current` happens to be at that moment, and
never again. That produces three distinct bugs:

| Situation | What happens |
|---|---|
| Element rendered conditionally (`{visible && <div ref={ref} />}`) | The effect ran while `ref.current` was `null`, hit the early return, and nothing re-runs when the element appears — **the sentinel silently never works** |
| Element arrives after a Suspense boundary resolves | Same — the first commit had no node |
| The element is replaced by a different node | The observer is still watching the **old, detached** node; callbacks stop firing |

The classic presentation is "infinite scroll works on first load and stops after
navigating" — because on the first load the node happened to exist in the first commit,
and after navigation it did not.

The usual patch is to add `ref.current` to the dependency array. That does not work
either: dependencies are compared at render time, `ref.current` is not part of render,
and the linter cannot see through it. It is a lie that happens to be quiet.

## The ref-callback version

React calls a ref callback at exactly the two moments this hook needs:

> When the `<div>` DOM node is added to the screen, React will call your `ref` callback
> with the DOM `node` as the argument. When that `<div>` DOM node is removed, React will
> call your the cleanup function returned from the callback.

> **React 19 added cleanup functions for `ref` callbacks.** To support backwards
> compatibility, if a cleanup function is not returned from the `ref` callback, `node`
> will be called with `null` when the `ref` is detached. **This behavior will be removed
> in a future version.**

```jsx
import { useState, useCallback } from 'react';

export function useIntersectionObserver({ root = null, rootMargin, threshold } = {}) {
  const [entry, setEntry] = useState(null);

  const ref = useCallback((node) => {
    if (!node) return;                                   // detach is the cleanup's job
    const io = new IntersectionObserver(
      ([e]) => setEntry(e),
      { root, rootMargin, threshold },
    );
    io.observe(node);
    return () => io.disconnect();                        // React 19 cleanup
  }, [root, rootMargin, threshold]);

  return [ref, entry];
}
```

```jsx
function LoadMore({ onVisible }) {
  const [sentinelRef, entry] = useIntersectionObserver({ rootMargin: '200px' });
  useEffect(() => { if (entry?.isIntersecting) onVisible(); }, [entry, onVisible]);
  return <div ref={sentinelRef} />;
}
```

Now the observer's lifetime is tied to the **node's** lifetime rather than to a render.
Conditional rendering, Suspense and node replacement all work, because React tells you
about each of them.

Returning the callback is also the better API by the standard of
[Phase 7 · 06](../06-designing-a-hooks-api/README.md): the caller spreads it onto the
element and cannot forget to attach it, there is no ref object for anyone to read during
render, and the hook can change its internals — swap `IntersectionObserver` for
`ResizeObserver`, add `unobserve` bookkeeping — without touching a call site.

## The identity trap

The one thing that makes this version subtly expensive:

> React will also call your `ref` callback whenever you pass a **different** `ref`
> callback. … the **previous** function will be called with `null` as the argument, and
> the **next** function will be called with the DOM node.

> Unless you pass the same function reference for the `ref` callback on every render, the
> callback will get temporarily cleanup and re-create during every re-render of the
> component.

An inline `ref={(node) => …}` is a new function every render, so React detaches and
reattaches every render — which here means **destroying and constructing an
`IntersectionObserver` on every render**, and losing the observer's accumulated state
each time. `useCallback` on the options is what keeps it stable.

Note that the hook **destructures** its options rather than taking the object through:

- `useIntersectionObserver({ rootMargin: '200px' })` creates a new object every render.
- Destructuring means the `useCallback` depends on `root`, `rootMargin` and `threshold`
  — primitives — so the identity is stable across renders even though the argument object
  is not.

**`threshold` is the exception, because it is an array.** `threshold: [0, 0.5, 1]` written
inline is a new array each render, which puts you straight back into the identity trap.
Either require callers to pass a memoized array, or depend on a serialised form
(`threshold?.join()`) and reconstruct inside — the second is uglier and does not push a
requirement onto the caller, which usually makes it the right choice for a shared hook.

## `StrictMode`, and reading it correctly

> When Strict Mode is on, React will **run one extra development-only setup+cleanup
> cycle** before the first real setup. This is a **stress-test that ensures that your
> cleanup logic "mirrors" your setup logic** and that it stops or undoes whatever the
> setup is doing. If this causes a problem, implement the cleanup function.

So in development you will see an observer constructed, disconnected, and constructed
again. That is correct. The conclusions to draw:

- **An extra construct/disconnect pair is not a leak.** It is the check passing.
- **A hook that misbehaves under it has a cleanup bug** — most commonly `io.unobserve(node)`
  where `io.disconnect()` was needed, or state left behind that the second setup then
  double-counts.
- **Anything expensive or observable in setup should not be in setup.** If constructing
  the observer had a side effect beyond observing — a network call, an analytics event —
  the doubling would be visible to users' data, which means it was never setup code.

## Gotchas

**Symptom:** an intersection sentinel works on first load and not after navigating.
**Cause:** a ref object is not reactive, so the effect ran once with `ref.current` null
and never re-ran when the node appeared.
**Fix:** a ref callback — the observer's lifetime follows the node.

**Symptom:** `ref.current` is added to the dependency array and nothing changes.
**Cause:** dependencies are compared at render time; `ref.current` is not part of render.
**Fix:** it cannot work. Use a ref callback.

**Symptom:** the observer keeps firing for an element that is gone, or stops firing after
a list re-orders.
**Cause:** it is still watching a detached node.
**Fix:** cleanup tied to the node, which the ref callback gives you.

**Symptom:** an `IntersectionObserver` is created and destroyed on every render.
**Cause:** an inline ref callback, or an options object passed through to `useCallback`.
**Fix:** memoize on destructured primitives.

**Symptom:** `threshold: [0, 1]` reintroduces the churn even with `useCallback`.
**Cause:** an array literal is a new value each render.
**Fix:** serialise it for the dependency, or require a memoized array.

**Symptom:** the observer fires twice on mount in development only.
**Cause:** `StrictMode`'s extra setup+cleanup cycle.
**Fix:** nothing — that is the stress test confirming your cleanup mirrors your setup.

**Symptom:** the callback never fires at all, even though the element is visible.
**Cause:** usually a `root` that is not an ancestor of the target, which makes the
intersection permanently empty.
**Fix:** leave `root` null to use the viewport unless you specifically need a scrolling
container, and check the ancestry when you do.

## Interview questions

**★ Why should this hook take a ref callback rather than a ref object?**
Because a ref object is not reactive: assigning `ref.current` neither re-renders nor
re-runs effects, so an effect reading it runs once — possibly before the node exists —
and never again when the element appears, is replaced, or arrives after a Suspense
boundary resolves. A ref callback runs exactly when the node attaches, and since React 19
its returned cleanup runs when the node detaches, so the observer's lifetime is bound to
the element's rather than to a render.

**★ Someone adds `ref.current` to the dependency array to fix it. What do you say?**
That it cannot work. Dependency arrays are compared during render, and `ref.current` is
not part of render — mutating it produces no re-render, so there is no moment at which
React would compare the new value. The linter cannot see through it either, so it is a
silent lie rather than a caught one.

**★ What is the identity trap with ref callbacks?**
React calls the ref callback again whenever a *different* callback is passed: the
previous one is cleaned up and the next is called with the node. An inline arrow is a new
function every render, so the observer is destroyed and rebuilt on every render, losing
its state. Memoize the callback on primitive options — passing an options object or an
inline `threshold` array through defeats the memoization.

**★ What does `StrictMode` do here, and what should you conclude?**
It runs one extra development-only setup+cleanup cycle before the first real setup, as a
stress test that cleanup mirrors setup. Seeing an observer constructed and disconnected
one extra time in development is correct. A hook that breaks under it has a cleanup bug —
typically `unobserve` where `disconnect` was needed — and any setup with a user-visible
side effect was never setup code in the first place.

**Why destructure the options instead of passing the object through?**
Because the argument object is re-created on every render by the caller, so depending on
it would defeat the memoization. Destructuring to `root`, `rootMargin` and `threshold`
means the callback depends on primitives, which are stable across renders. `threshold` is
the exception, being an array, and needs either a memoized value from the caller or a
serialised dependency inside the hook.

**What does returning the ref callback buy the API?**
The caller spreads it directly onto the element, so it cannot be forgotten or attached to
the wrong node; there is no ref object anyone can read during render, which keeps the
component pure; and the implementation can change entirely — a different observer,
different bookkeeping — without touching a single call site.

---

← Prev: [Listeners](03-events-and-the-dom.md) ·
Index: [The standard set](README.md) ·
Next → [Timers and lifecycle](05-timers-and-lifecycle.md)
