---
title: "Ref callbacks"
sidebar_label: "06 · Ref callbacks"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Common components (`ref` callback)](https://react.dev/reference/react-dom/components/common)
> and [Manipulating the DOM with Refs](https://react.dev/learn/manipulating-the-dom-with-refs).
> **The argument for *when* to use one over an effect is
> [Phase 4 · 15](../phase-4-effects/15-effects-and-refs.md)**, and the list-of-refs
> `Map` pattern is [topic 02 · 01](02-dom-refs/01-attaching-and-using.md); this page
> is the API in full. No sandbox script backs this page.

**A function in the `ref` position instead of a ref object. React calls it when the
node attaches and calls its cleanup when the node goes — which makes it a start/stop
pair tied to the node's lifetime rather than the component's.**

## The signature

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

Same shape as an effect: the body is *start*, the returned function is *stop*
([Phase 4 · 04](../phase-4-effects/04-cleanup/01-the-cleanup-contract.md)). The
difference is what the pair is attached to — a node, not a render.

## 🔴 React 19: return a cleanup

> **React 19 added cleanup functions for `ref` callbacks.**
>
> To support backwards compatibility, **if a cleanup function is not returned from
> the `ref` callback, `node` will be called with `null`** when the `ref` is
> detached. **This behavior will be removed in a future version.**

Two forms, one of them on notice:

```jsx
// ✅ React 19 — cleanup form
ref={(node) => {
  observer.observe(node);
  return () => observer.disconnect();
}}

// ⚠️ legacy — null-on-detach, deprecated
ref={(node) => {
  if (node === null) {
    observer.disconnect();
  } else {
    observer.observe(node);
  }
}}
```

The cleanup form is better on its own merits, not just because the other is
deprecated: **the cleanup closes over the node**. The `null` form is called without
it, so anything it needs to release has to have been stashed somewhere — which is
exactly the awkwardness the effect version has.

⚠️ **In TypeScript, returning something accidentally is now a real hazard.** A
concise arrow body returns its expression, so `ref={node => map.set(key, node)}`
returns the `Map`, which React will try to call as a cleanup. Use a block body.

## What happens when the callback's identity changes

> React also calls your `ref` callback **whenever you pass a *different* `ref`
> callback.** In the above example, `(node) => { ... }` is a different function on
> every render. When your component re-renders, the *previous* function will be
> called with `null` as the argument, and the *next* function will be called with
> the DOM node.

And with cleanups in play:

> When you pass a *different* `ref` callback, React will call the *previous*
> callback's cleanup function if provided. If no cleanup function is defined, the
> `ref` callback will be called with `null` as the argument. The *next* function
> will be called with the DOM node.

So the sequence on every render with a new callback identity is **previous cleanup →
next callback(node)**. Identical ordering to an effect's cleanup-then-setup
([Phase 4 · 02](../phase-4-effects/02-useeffect-anatomy.md)).

The practical consequence: **an inline arrow detaches and reattaches on every
render.** For a `console.log` that is invisible. For an observer, a subscription or
a measurement it means tearing down and rebuilding continuously — the identity
problem from
[Phase 4 · 11 · 01](../phase-4-effects/11-removing-dependencies/01-objects-and-functions.md),
in a place with no dependency array to inspect and no linter rule to warn you.

If the callback does real work, give it a stable identity with `useCallback`, or
define it outside the component when it closes over nothing.

## `StrictMode` checks them

> When Strict Mode is enabled, **ref callbacks will run twice in development.** This
> helps find bugs in callback refs.

The same stress test effects get ([Phase 4 · 05](../phase-4-effects/05-strictmode-double-invocation.md)),
and the same diagnostic: a callback that registers a node somewhere without
unregistering it ends up with **double the entries** — ten items reading as twenty.

## On your own components

Since [React 19 made `ref` a regular prop](02-dom-refs/02-crossing-boundaries.md), a
callback works wherever a ref object does:

```jsx
<MyInput ref={(node) => { /* ... */ }} />
```

What arrives is whatever that component puts in the `ref` position — the DOM node if
it forwards to a built-in element, or the custom handle if it uses
`useImperativeHandle` ([topic 07](07-useimperativehandle.md)).

## Callback or object?

| | Ref object (`useRef`) | Ref callback |
|---|---|---|
| Get the node | `ref.current`, after commit | passed to you, as it attaches |
| Know *when* it attaches | ❌ | ✅ |
| Works for conditional nodes | ⚠️ needs a stand-in dependency | ✅ |
| Works for a list of unknown length | ❌ one hook per item is illegal | ✅ |
| Needs a stable identity | — | ✅ if it does real work |
| Reading it later | ✅ trivially | you must store it yourself |

**The question is what owns the lifetime.** If the node is always there and the
work belongs to the component — focus on mount, measure once — a ref object and an
effect are simpler. If the work belongs to *the node*, the callback says so
directly.

## Gotchas

**Symptom:** an observer or subscription in a ref callback tears down and rebuilds
every render.
**Cause:** an inline arrow — a new identity each render, so React runs the previous
cleanup and calls the new one.
**Fix:** `useCallback`, or define it outside the component.

**Symptom:** React errors that a ref cleanup is not a function.
**Cause:** a concise arrow body returned a value by accident — `node => map.set(k,
node)` returns the `Map`.
**Fix:** use a block body and return nothing, or return a real cleanup.

**Symptom:** a registry ends up with double the expected entries.
**Cause:** no cleanup, so `StrictMode`'s extra attach/detach cycle doubles them.
**Fix:** return a cleanup that unregisters.

**Symptom:** legacy code checks `if (node === null)` and a reviewer calls it wrong.
**Cause:** it is the pre-19 form. Still supported, and documented as scheduled for
removal.
**Fix:** migrate to returning a cleanup; it also closes over the node, which the
null form cannot.

**Symptom:** the callback fires with `null` unexpectedly in React 19 code.
**Cause:** no cleanup was returned, so React fell back to the compatibility
behaviour.
**Fix:** return one.

**Symptom:** a ref callback is used where a ref object would do, and the code is
harder to read.
**Cause:** reaching for the callback by default.
**Fix:** if the node is unconditional and the work is the component's, `useRef` plus
an effect is simpler.

## Interview questions

**★ What is a ref callback and how does its lifecycle differ from a ref object?**
A function in the `ref` position. React calls it with the node when the node
attaches and calls its returned cleanup when the node is removed — so it is a
start/stop pair tied to **the node's** lifetime, not the component's. A ref object
just gets `.current` populated during the commit, with no notification, which is
why an effect cannot react to a node appearing.

**★ What changed for ref callbacks in React 19, and what is deprecated?**
They can return a cleanup function. The previous behaviour — calling the callback
again with `null` on detach — is kept only for backwards compatibility and the docs
say it will be removed in a future version. The cleanup form is also better in
itself, because it closes over the node instead of requiring you to have stored it.

**★ Why does an inline arrow ref callback cause repeated attach and detach?**
Because it is a different function on every render, and React runs the previous
callback's cleanup and then calls the new one with the node whenever the identity
changes. The ordering is the same cleanup-then-setup as an effect. There is no
dependency array and no lint rule here, so the cost is easy to miss — give the
callback a stable identity if it does anything beyond logging.

**How would you spot a ref callback missing its cleanup?**
The counts double. `StrictMode` runs ref callbacks twice in development
specifically to find this, so a callback that adds a node to a map without removing
it shows twenty entries for ten items. That doubling is the intended diagnostic,
not a bug in React.

**What is the TypeScript hazard with ref callbacks?**
A concise arrow body returns its expression, so `ref={node => map.set(key, node)}`
returns the `Map` and React treats it as the cleanup function. Use a block body when
you are not deliberately returning a cleanup.

**When would you choose a ref object over a callback?**
When the node is unconditional and the work belongs to the component rather than the
node — focusing an input on mount, measuring once. A ref object plus an effect is
simpler to read and easier to consume elsewhere, since you can read `.current` later
without storing anything yourself. The callback earns its complexity when the node
is conditional, replaceable, or one of many.

---

← Prev: [The context re-render problem](05-context-re-render-problem.md) · Index: [Phase 5](README.md) · Next → [`useImperativeHandle`](07-useimperativehandle.md)
