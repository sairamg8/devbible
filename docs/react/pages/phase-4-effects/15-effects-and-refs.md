---
title: "Effects and refs together"
sidebar_label: "15 · Effects and refs together"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Common components (`ref` callback)](https://react.dev/reference/react-dom/components/common),
> [`useLayoutEffect`](https://react.dev/reference/react/useLayoutEffect) and
> [`StrictMode`](https://react.dev/reference/react/StrictMode).
> No sandbox script backs this page; claims are cited, not measured.

**Effects are where a ref becomes usable, and also where refs run out. The
missing piece is the ref callback — which in React 19 gained a cleanup function
and became a proper start/stop pair.**

## Why effects are where refs work

`ref.current` is `null` during render and populated by the time effects run,
because effects run children-before-parents after the commit
([topic 13](13-effect-ordering.md)). So the two classic uses live in effects:

```jsx
// Focus on mount
useEffect(() => {
  inputRef.current.focus();
}, []);

// Measure before the user sees anything
useLayoutEffect(() => {
  const { height } = ref.current.getBoundingClientRect();
  setHeight(height);
}, []);
```

Measuring belongs in `useLayoutEffect` when the measurement changes what is
rendered, so the intermediate state never paints
([topic 12](12-uselayouteffect.md)). Focusing does not — nothing visual is wrong
in the frame before focus lands, so `useEffect` is correct and cheaper.

**Capture the node into a `const`** if the cleanup needs it
([topic 14](14-timers-listeners-observers.md)) — `ref.current` may be a different
node, or `null`, by cleanup time.

## Where refs run out

A ref is **not reactive** ([topic 09](09-effect-lifecycle.md)): it cannot be a
dependency, and changing `ref.current` does not re-render or re-run anything. So
an effect cannot *react* to a node arriving.

With `[]` the effect runs once, after the first commit. If the node it wants is
conditionally rendered, arrives later, or is replaced by a different element,
the effect has already run and will not run again:

```jsx
// 🔴 if `isOpen` starts false, ref.current is null here and stays unobserved
useEffect(() => {
  if (!panelRef.current) return;
  observer.observe(panelRef.current);
  return () => observer.disconnect();
}, []);
```

Adding `panelRef.current` to the array does not help — it is not a reactive value,
so React has nothing to compare. Adding `isOpen` works only because you happened
to know which state controls the node, which does not generalise to a list.

## The ref callback

Pass a function instead of a ref object, and React tells you when the node
arrives and when it leaves:

```jsx
<div ref={(node) => {
  console.log('Attached', node);

  return () => {
    console.log('Clean up', node);
  };
}}>
```

> When the DOM node is added to the screen, React calls your `ref` callback with
> the DOM `node` as the argument. When that DOM node is removed, React calls your
> cleanup function returned from the callback.

This is the [topic 04](04-cleanup/01-the-cleanup-contract.md) contract in a
different place: attach is *start*, the returned function is *stop*. And it is
tied to **the node's** existence rather than the component's — which is exactly
what the effect above could not express.

So the observer example becomes:

```jsx
<div ref={(node) => {
  if (!node) return;
  const observer = new ResizeObserver(/* … */);
  observer.observe(node);
  return () => observer.disconnect();
}} />
```

No dependency array, no guard on `isOpen`, and it works for a node that appears
later or is replaced.

## React 19 added the cleanup function

> **React 19 added cleanup functions for `ref` callbacks.**
>
> To support backwards compatibility, **if a cleanup function is not returned
> from the `ref` callback, `node` will be called with `null`** when the `ref` is
> detached. **This behavior will be removed in a future version.**

Two things follow.

**The old shape is deprecated, not merely older.** A callback that handles
detachment by checking `if (node === null)` still works and is explicitly on
notice. New code should return a cleanup.

**The returned cleanup closes over the node**, which is strictly better than the
`null` version — the old shape had to stash the node somewhere to know what to
clean up, exactly the problem the effect version has.

## The identity trap

> React also calls your `ref` callback whenever you pass a *different* `ref`
> callback. In the above example, `(node) => { ... }` is a different function on
> every render. When your component re-renders, the *previous* function will be
> called with `null` as the argument, and the *next* function will be called with
> the DOM node.

An inline arrow is a new function every render, so **the ref detaches and
reattaches on every render**. For a `console.log` that is invisible; for an
observer or a subscription it means tearing down and rebuilding continuously — the
identity problem from
[topic 11 · 01](11-removing-dependencies/01-objects-and-functions.md), in a place
with no dependency array to inspect.

If the callback does real work, give it a stable identity — `useCallback`, or a
function defined outside the component if it closes over nothing.

## `StrictMode` checks these too

> When Strict Mode is on, React will run one extra development-only setup+cleanup
> cycle before the first real setup.

Ref callbacks get their own extra cycle, listed alongside effects in the
`StrictMode` reference ([topic 05](05-strictmode-double-invocation.md)). The tell
for a missing ref cleanup is a registry that ends up with double the entries — add
ten, and the count reads twenty rather than ten.

## Choosing between the two

| Use | When |
|---|---|
| **Effect + ref object** | the node is always there, and the work is tied to the component — focus on mount, measure once |
| **Ref callback** | the work is tied to **the node** — conditional nodes, lists, anything that can be replaced or appear later |

The question is *what owns the lifetime*. If the answer is "the node", the ref
callback is the honest expression of it, and the effect version will always need a
dependency that stands in for the node's existence.

## Gotchas

**Symptom:** `ref.current` is `null` inside an effect.
**Cause:** the node is conditionally rendered and was not present at the commit
the effect ran for.
**Fix:** a ref callback, which fires when the node actually arrives.

**Symptom:** adding `ref.current` to a dependency array changes nothing.
**Cause:** refs are not reactive — there is nothing for React to compare between
renders.
**Fix:** the ref callback. This is the case it exists for.

**Symptom:** an observer or listener attached in a ref callback tears down and
rebuilds constantly.
**Cause:** an inline arrow ref callback — a new function each render, so React
detaches and reattaches every time.
**Fix:** give the callback a stable identity.

**Symptom:** a ref-callback registry ends up with twice the expected entries.
**Cause:** no cleanup, so `StrictMode`'s extra attach/detach cycle doubles it.
**Fix:** return a cleanup function from the callback.

**Symptom:** measuring in `useEffect` produces a visible jump.
**Cause:** the measurement changes what renders, and `useEffect` may run after
paint.
**Fix:** `useLayoutEffect` ([topic 12](12-uselayouteffect.md)).

**Symptom:** a cleanup calls `observer.unobserve(ref.current)` and misses.
**Cause:** `ref.current` has already changed by cleanup time.
**Fix:** capture the node in a `const` in the setup — or use a ref callback, whose
cleanup closes over the right node by construction.

## Interview questions

**★ Why is a ref usable in an effect but not during render?**
Because `ref.current` is only populated after the commit, and effects run after
the commit — children before parents, so a parent's effect sees its children's
attached refs. During render the DOM for that update does not exist yet, so the
ref is `null`.

**★ What can a ref callback do that an effect with a ref object cannot?**
React to the node itself. A ref is not reactive, so it cannot be a dependency and
an effect cannot re-run when a node appears, is replaced, or is removed — an
effect with `[]` has already run. A ref callback fires when the node attaches and
its cleanup when the node detaches, so it works for conditionally rendered nodes
and for lists without needing a stand-in dependency.

**★ What changed for ref callbacks in React 19?**
They can return a cleanup function, which React calls when the node is removed.
The old behaviour — calling the callback again with `null` on detach — is retained
only for backwards compatibility and the docs say it will be removed in a future
version. The cleanup form is also better in itself, because it closes over the
node rather than requiring you to have stashed it somewhere.

**Why does an inline arrow as a ref callback cause repeated attach/detach?**
Because it is a different function on every render, and React calls the previous
callback's cleanup (or passes it `null`) and then calls the new one with the node
whenever the callback identity changes. For logging that is harmless; for an
observer or subscription it means tearing down and rebuilding every render. Give
it a stable identity if it does real work.

**Where should a measurement go, and why?**
In `useLayoutEffect` if the measurement changes what is rendered, so the
pre-measurement state never paints and the user sees no jump. In `useEffect` if
nothing visual depends on it. Focusing on mount is the common case that does *not*
need the layout variant, because nothing is visibly wrong in the frame before
focus lands.

**How would you know a ref callback is missing its cleanup?**
The counts double. `StrictMode` runs one extra setup+cleanup cycle for ref
callbacks just as it does for effects, so a callback that registers a node into a
map without unregistering it ends up with two entries per node in development —
which is the whole point of the extra cycle.

---

← Prev: [Timers, listeners and observers](14-timers-listeners-observers.md) · Index: [Phase 4](README.md) · Next → [Subscribing to an external store](16-external-store.md)
