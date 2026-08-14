---
title: "State outside React"
sidebar_label: "04 · State outside React"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)
> (Reference, Parameters, Caveats and Troubleshooting) and
> [Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context).
> No sandbox script backs this page; claims are cited, not measured.

**The third home for shared state is outside React entirely — a plain module-scope
store with a subscription, read through `useSyncExternalStore`. Every other
module-scope sharing scheme is a bug in four different environments.**

Some state does not belong to the tree at all: a WebSocket connection's status, the
selection an editor engine owns, a cache written by code that has never heard of
React. Putting that in a provider means React must be *told* about every change by
something that is not React, and hand-rolling that telling is where the bugs are.

## The hook, and what it demands

> `useSyncExternalStore` is a React Hook that lets you subscribe to an external store.

```js
const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot?)
```

> The `subscribe` function should subscribe to the store and return a function that
> unsubscribes.

> The `getSnapshot` function should read a snapshot of the data from the store.

The store lives in module scope, the hook is the reader, and every caller sees the
same value because **there is only one store**:

```jsx
// store.js — plain JavaScript, no React
let state = { theme: 'light' };
const listeners = new Set();

export const themeStore = {
  getSnapshot: () => state,
  setTheme(theme) {
    state = { ...state, theme };          // replace — never mutate in place
    listeners.forEach((l) => l());
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

// useTheme.js
export function useTheme() {
  return useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot);
}
```

The custom hook is doing the same job it did with context: it is the **reader**, and
it is the public API. Callers never import the store.

### The immutability contract, and both ways to break it

Two quotes, because both failures are common and they are opposites:

> The store snapshot returned by `getSnapshot` **must be immutable**. If the
> underlying store has mutable data, return a new immutable snapshot if the data has
> changed. Otherwise, **return a cached last snapshot**.

> This error means your `getSnapshot` function returns a **new object every time** it's
> called … React will re-render the component if `getSnapshot` return value is
> different from the last time. This is why, if you always return a different value,
> you will enter an **infinite loop**.

So:

- `getSnapshot: () => ({ ...state })` — a new object every call. React compares it to
  the last one, sees a difference, re-renders, calls `getSnapshot` again, sees a
  difference… **infinite loop**, with an explicit error telling you to cache.
- `getSnapshot: () => state`, where `setTheme` does `state.theme = theme` — the
  reference never changes, so React never sees an update and the component **never
  re-renders**, silently.

The store above threads the needle: mutate by **replacing** the object, and return the
same reference until it is replaced. Identity *is* the change signal.

The trap this sets: any derivation belongs outside `getSnapshot`. `getSnapshot: () =>
state.items.filter(i => i.done)` is the infinite loop again, because `filter` returns
a new array every call. Return the whole snapshot and derive in the component, with
`useMemo` if the derivation is expensive.

### `subscribe` must be stable

> If a different `subscribe` function is passed during a re-render, React will
> **re-subscribe** to the store using the newly passed `subscribe` function. You can
> prevent this by **declaring `subscribe` outside the component**.

Which is why `subscribe` above is a stable method on the store object rather than an
arrow function written inline in the hook body. An inline `(cb) => store.subscribe(cb)`
is a new function on every render, so every render tears down and rebuilds the
subscription — the external-store version of the re-subscribing effect from
[Phase 4 · 03](../../phase-4-effects/03-the-dependency-array.md).

### The server argument is not optional in practice

> The `getServerSnapshot` function is similar to `getSnapshot`, but it runs only in two
> situations: It runs on the server when generating the HTML. It runs on the client
> during hydration.

Without it, a store that touches `window`, `localStorage` or `matchMedia` throws
during SSR; with it, you must also make sure the value it returns matches what the
client will produce on its first render, or you get a hydration mismatch. The full
treatment is [Phase 5 · 15](../../phase-5-refs-context-reducers/15-usesyncexternalstore.md),
and the effect-shaped alternative is
[Phase 4 · 16](../../phase-4-effects/16-external-store.md).

## 🔴 The anti-pattern: a module-level `let`

Sooner or later someone tries the shortest possible thing:

```jsx
// 🔴 Do not do this
let sharedTheme = 'light';

export function useTheme() {
  const [, forceRender] = useState(0);
  return [
    sharedTheme,
    (next) => { sharedTheme = next; forceRender((n) => n + 1); },
  ];
}
```

It is not merely inelegant. It is wrong in four independent ways, and **each one fails
in a different environment**, which is exactly why it survives for months:

1. **It does not re-render the other components.** The setter force-renders its own
   caller only. Everyone else keeps their stale render output — the bug from
   [chunk 02](02-the-localstorage-trap.md), now with an extra variable and no
   `localStorage` to blame. Fails in development, if you look.
2. **It tears under concurrent rendering.** A render can be interrupted and resumed;
   if the variable changes in between, two components **in the same commit** can
   display different values for one piece of state. Preventing exactly this is why
   `useSyncExternalStore` is a built-in hook and not a userland pattern. Fails rarely,
   under load, and is close to undebuggable from a bug report.
3. **It reads a mutable value during render**, which breaks the Rules of React — render
   must be pure and idempotent ([Phase 7 · 04](../04-rules-of-react-beyond-hooks/README.md)).
   Code the Compiler cannot prove pure is not reported, it is **silently skipped**
   ([Phase 6 · 09](../../phase-6-performance/09-how-the-compiler-bails-out.md)), so
   this quietly opts the component out of the optimisation everyone else gets. Fails
   as an absence — nothing breaks, you just do not get the win.
4. **On the server it is shared between requests.** Module scope is per-process, not
   per-request: whatever the last request wrote is what the next user's HTML renders
   with. That is a cross-user data leak, and it is invisible in development where you
   are the only request. Fails in production, at the worst possible severity.

If module-level state is genuinely what you want — and it often legitimately is —
`useSyncExternalStore` **is** that, done safely. The store is a module-level variable,
with subscription, immutable snapshots and a server snapshot wrapped around it.

The same reasoning rules out the two neighbouring hacks:

- **A module-level `Map` keyed by component id.** All four problems above, plus a
  memory leak: nothing deletes the entry when the component unmounts, and ids are
  usually derived from props, so a list of 10,000 rows leaves 10,000 entries.
- **A shared ref-holder passed around by import.** A ref never re-renders anything at
  all, so callers simply never update
  ([Phase 5 · 08](../../phase-5-refs-context-reducers/08-when-a-ref-is-wrong.md)).
  This one at least fails loudly and immediately.

## What about a query cache?

For **server** state — data you fetched — the honest answer is a fourth option that is
really the third one with the work already done. A query library keeps one cache
outside React and hands you a hook over it, so two components calling `useUser(7)`
share one entry, including its loading and error status, plus deduplication of
in-flight requests, invalidation, retries and garbage collection.

That is precisely the "state lives in a store, the hook is a reader" shape of this
chunk. React's own docs stop short of endorsing a particular library, and the
comparison belongs with data fetching rather than here — Phase 12 covers it properly.

The point for *this* topic is narrow but load-bearing: **"these two components need the
same data" is frequently not a shared-state problem at all.** Lifting a fetch into a
common parent so both children can receive the result is the wrong reflex — it couples
two components through a third, re-fetches on every remount, and puts loading and
error states in a component that does not render either of them. The thing you are
trying to share is a cache, and caches have their own answer.

## Gotchas

**Symptom:** "The result of getSnapshot should be cached to avoid an infinite loop."
**Cause:** `getSnapshot` builds a new object or array on every call.
**Fix:** return the stored reference and replace it only when the data actually
changes. Never `filter`, `map` or spread inside `getSnapshot` — derive in the
component instead.

**Symptom:** an external store's components stop updating after a refactor.
**Cause:** the store started mutating its snapshot in place, so the reference never
changes and React sees no update.
**Fix:** replace, do not mutate. Object identity is the change signal.

**Symptom:** the store re-subscribes on every render, and listeners pile up if the
unsubscribe is wrong.
**Cause:** `subscribe` is an inline arrow function, so a different function is passed
each render and React re-subscribes.
**Fix:** declare it outside the component — a stable method on the store object.

**Symptom:** SSR throws `window is not defined`, or hydration warns of a mismatch.
**Cause:** no `getServerSnapshot`, or one that returns something the client's first
render disagrees with.
**Fix:** supply `getServerSnapshot` and make it agree with the client's initial value.

**Symptom:** on the server, one user sees another user's data.
**Cause:** per-user state held in module scope, which is per-process, not per-request.
**Fix:** never put request-scoped state in a module. The store pattern is for state
that is genuinely global to the process, or client-only.

**Symptom:** components briefly show inconsistent values under heavy load.
**Cause:** tearing — a mutable module value read directly during render while an
interrupted render resumes.
**Fix:** `useSyncExternalStore`. This is the failure it exists to prevent, and it is
not reproducible on demand.

**Symptom:** the Compiler memoizes most of the app but skips a few components.
**Cause:** those components read or write something it cannot prove pure — a
module-level mutable being the classic case.
**Fix:** move that read behind `useSyncExternalStore` and the component becomes
provably pure again.

**Symptom:** a `Map` keyed by id grows without bound in a long-lived tab.
**Cause:** a hand-rolled per-instance store with no unmount cleanup.
**Fix:** the entry must be removed when the last subscriber unsubscribes — which is
what the `subscribe` return value is for.

## Interview questions

**★ Why is a module-level `let` shared between hook calls wrong?**
Four separate reasons, and they fail in four different places. It re-renders only the
component that wrote to it, so everyone else is stale. It tears under concurrent
rendering, because a value read mid-render can change before the commit and two
components in one commit can disagree. Reading a mutable module value during render
breaks the Rules of React, so the Compiler silently skips that component rather than
reporting it. And on the server, module scope is per-process, so one request's state
leaks into the next user's HTML. `useSyncExternalStore` is the same idea with
subscription, immutable snapshots and a server snapshot.

**★ What does `getSnapshot` have to guarantee, and what happens if it doesn't?**
It must return an immutable snapshot, and the *same reference* until the data actually
changes. Build a new object every call and React sees a change every time — an
infinite render loop, with an explicit error saying the result should be cached.
Mutate the existing object instead and the reference never changes, so React never
re-renders at all. The corollary is that derivations — `filter`, `map`, spreads —
belong in the component, not in `getSnapshot`.

**★ Why must `subscribe` be declared outside the component?**
Because if a different `subscribe` function is passed during a re-render, React
re-subscribes to the store with the new one. An inline arrow is a new function every
render, so every render tears down and rebuilds the subscription. Declaring it outside
— typically as a method on the store — keeps the identity stable.

**★ When is "these two components need the same data" *not* a shared-state problem?**
When it is server state. Two components calling `useUser(7)` should hit one cache
entry owned outside React, with deduplication of in-flight requests, invalidation and
shared loading and error status. Lifting a fetch into a common parent is a common
wrong reflex: it couples the children through a third component, re-fetches on
remount, and strands the loading and error states in a component that renders neither.

**What does `getServerSnapshot` do, and when do you need it?**
It is the snapshot used in exactly two situations — on the server when generating HTML,
and on the client during hydration. You need it whenever the store touches something
that does not exist on the server, and its return value has to agree with the client's
first render or hydration will mismatch.

**How do you choose between context and an external store?**
Ask who owns the state. If React owns it and it changes as part of the UI's own
lifecycle, context is simpler and integrates with transitions and Suspense. If the
state is written by something outside React — a socket, an editor engine, a browser
API, another framework on the page — or must outlive the tree, an external store is
the honest model, and `useSyncExternalStore` is how React reads it without tearing.

---

← Prev: [When you actually wanted shared state](03-when-you-wanted-shared-state.md) ·
Index: [Share logic, not state](README.md) ·
Next → [The Rules of React beyond hooks](../04-rules-of-react-beyond-hooks/README.md)
