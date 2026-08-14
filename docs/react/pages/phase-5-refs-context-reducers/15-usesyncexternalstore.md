---
title: "useSyncExternalStore"
sidebar_label: "15 · useSyncExternalStore"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore).
> 🔴 **The argument for *why* this hook exists — tearing, and why a correct
> subscribing effect is still wrong — is
> [Phase 4 · 16](../phase-4-effects/16-external-store.md).** This page is the
> reference half. No sandbox script backs this page.

**Reading a value that lives outside React, without keeping a copy of it. Three
arguments, each with a requirement that will bite you if you get it wrong.**

```jsx
const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot?);
```

## `subscribe`

> A function that takes a single `callback` argument and subscribes it to the store.
> When the store changes, it should invoke the provided `callback`, which will cause
> React to **re-call `getSnapshot`** and (if needed) re-render the component. The
> `subscribe` function should **return a function that cleans up the subscription.**

Same start/stop contract as an effect
([Phase 4 · 04](../phase-4-effects/04-cleanup/01-the-cleanup-contract.md)). Note
what the callback does *not* do: it carries no value. It only tells React
"something changed, ask again", which is the whole design — React reads the value
when it needs it rather than being pushed a copy.

### 🔴 It must have a stable identity

> If a different `subscribe` function is passed during a re-render, React will
> **re-subscribe** to the store using the newly passed `subscribe` function. **You
> can prevent this by declaring `subscribe` outside the component.**

```jsx
// 🚩 Always a different function, so React will resubscribe on every re-render
function ChatIndicator() {
  function subscribe() { /* ... */ }
  const isOnline = useSyncExternalStore(subscribe, getSnapshot);
}
```

```jsx
// ✅ Always the same function, so React won't need to resubscribe
function subscribe() { /* ... */ }

function ChatIndicator() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot);
}
```

Module scope is the default answer. When `subscribe` must close over something,
`useCallback` with that as a dependency:

```jsx
function ChatIndicator({ userId }) {
  // ✅ Same function as long as userId doesn't change
  const subscribe = useCallback(() => {
    // ...
  }, [userId]);

  const isOnline = useSyncExternalStore(subscribe, getSnapshot);
}
```

There is no dependency array on the hook itself, so this is the only place to
express "resubscribe when the user changes" — which makes `useCallback` load-bearing
here rather than an optimisation.

## `getSnapshot`

> A function that returns a snapshot of the data in the store that's needed by the
> component. **While the store has not changed, repeated calls to `getSnapshot` must
> return the same value.** If the store changes and the returned value is different
> (as compared by `Object.is`), React re-renders the component.

> The store snapshot returned by `getSnapshot` **must be immutable.**

### 🔴 The caching error

Return a fresh object each call and you get an infinite loop:

```jsx
function getSnapshot() {
  // 🔴 Do not return always different objects from getSnapshot
  return { todos: myStore.todos };
}
```

> if you always return a different value, you will enter an infinite loop and get
> this error — **"The result of `getSnapshot` should be cached to avoid an infinite
> loop"**

The mechanism is straightforward once you see it: React compares with `Object.is`,
sees a change, re-renders, calls `getSnapshot` again, sees another change, and so
on.

Two correct shapes. If the store already holds immutable data, return it directly:

```jsx
function getSnapshot() {
  // ✅ You can return immutable data
  return myStore.todos;
}
```

If the store is mutable, the docs' instruction is to cache:

> it *does* need to create new objects, but **it shouldn't do this for every single
> call.** Instead, it should **store the last calculated snapshot, and return the
> same snapshot as the last time** if the data in the store has not changed.

So the memoization lives in the *store*, not in the component. That is usually a
sign this hook is meant to be used by a library rather than written inline — and
indeed most people meet it through one.

## `getServerSnapshot`

> A function that returns the initial snapshot of the data in the store. It will be
> used **only during server rendering and during hydration** of server-rendered
> content on the client.

> **If you omit this argument, rendering the component on the server will throw an
> error.**

> Make sure that `getServerSnapshot` returns **the same exact data** on the initial
> client render as it returned on the server.

Omitting it is an error, not a graceful degradation — so a hook that works fine in a
client-only app breaks the moment the app is server-rendered. The docs' suggested
transport is a `<script>` tag emitting a global that `getServerSnapshot` reads on
the client, so both sides genuinely see the same bytes.

This is also why [Phase 4 · 12](../phase-4-effects/12-uselayouteffect.md) lists this
hook among the ways out of the `useLayoutEffect` server warning: it is the one
external-data mechanism with a defined server story.

## The remaining caveats

**Transitions become blocking if the store moves.** Quoted in full at
[Phase 4 · 16](../phase-4-effects/16-external-store.md) — React re-reads
`getSnapshot` just before applying changes to the DOM and restarts the update as
blocking if the value changed, *"to ensure that every component on screen is
reflecting the same version of the store."* That is the consistency guarantee, and
its cost.

**Do not suspend on a store value.**

> It's not recommended to *suspend* a render based on a store value returned by
> `useSyncExternalStore`. The reason is that mutations to the external store cannot
> be marked as non-blocking Transition updates, so they will **trigger the nearest
> `Suspense` fallback, replacing already-rendered content on screen with a loading
> spinner**, which typically makes a poor UX.

## When you will actually write one

Rarely, and that is the honest framing. You will meet this hook:

- **inside a library** — most state libraries use it, which is how they stay
  tear-free under concurrent rendering;
- **wrapping a browser API** — `navigator.onLine`, `matchMedia`, `localStorage`,
  the URL, anything mutable that lives outside React;
- **wrapping a pre-existing non-React store** during a migration.

If the state is yours and lives in React, `useState` or `useReducer` is correct and
this hook is the wrong tool.

## Gotchas

**Symptom:** `The result of getSnapshot should be cached to avoid an infinite loop`.
**Cause:** `getSnapshot` builds a new object every call, so `Object.is` reports a
change each time.
**Fix:** return the store's immutable data directly, or cache the last snapshot in
the store and return it unchanged when nothing moved.

**Symptom:** the store resubscribes on every render.
**Cause:** `subscribe` declared inside the component.
**Fix:** module scope, or `useCallback` with what it closes over.

**Symptom:** the component throws during server rendering.
**Cause:** `getServerSnapshot` omitted — documented as an error.
**Fix:** provide it, or render the component client-only deliberately.

**Symptom:** hydration mismatch around a store-driven value.
**Cause:** `getServerSnapshot` returned different data on the client's first render
than the server produced.
**Fix:** transport the server's value to the client and read it, rather than
recomputing.

**Symptom:** a `Suspense` fallback replaces working content whenever the store
changes.
**Cause:** suspending on a store value; store mutations cannot be non-blocking
transitions.
**Fix:** do not suspend on store values.

**Symptom:** `useSyncExternalStore` used for state the app owns.
**Cause:** reaching for it because it sounds authoritative.
**Fix:** if the state lives in React, `useState` or `useReducer`. This hook is for
data that lives outside.

## Interview questions

**★ What are the three arguments and what does each require?**
`subscribe` registers a callback and returns a cleanup, and must have a stable
identity or React resubscribes on every render. `getSnapshot` returns the value and
must return the *same* value while the store has not changed, and an immutable one —
otherwise you get the infinite-loop error. `getServerSnapshot` supplies the value
during server rendering and hydration, must return exactly the same data on both
sides, and omitting it makes server rendering throw.

**★ Why does returning a new object from `getSnapshot` cause an infinite loop?**
Because React compares snapshots with `Object.is`. A fresh object each call always
compares unequal, so React re-renders, calls `getSnapshot` again, sees another
change, and repeats. The fix is to return the store's immutable data directly, or —
if the store is mutable — to cache the last computed snapshot in the store and
return it unchanged until the data actually moves.

**★ Why must `subscribe` be declared outside the component?**
Because React resubscribes whenever a different `subscribe` function is passed, and
an inline definition is a new function every render. There is no dependency array on
the hook, so `useCallback` is the only way to express "resubscribe when this
changes" — which makes it load-bearing here rather than an optimisation.

**What happens if you omit `getServerSnapshot`?**
Server rendering of that component throws. It is not a graceful fallback, so a hook
that works in a client-only app will break the moment the app is server-rendered.
The value must also match the server's exactly on the first client render, which
usually means transporting it rather than recomputing it.

**When would you write this hook yourself?**
Rarely. It appears inside state libraries, wrapping browser APIs such as
`navigator.onLine` or `matchMedia`, and when integrating a pre-existing non-React
store during a migration. The caching requirement on `getSnapshot` naturally belongs
to the store rather than the component, which is itself a hint that this is library
territory. State that lives in React should use `useState` or `useReducer`.

---

← Prev: [`useId`](14-useid.md) · Index: [Phase 5](README.md) · Next → [`useDebugValue`](16-usedebugvalue.md)
