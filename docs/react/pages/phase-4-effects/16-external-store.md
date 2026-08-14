---
title: "Subscribing to an external store"
sidebar_label: "16 · Subscribing to an external store"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)
> and [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
> (§ Subscribing to an external store).
> The hook's full reference is Phase 5; this page covers the effect pattern, why
> it fails, and what replaces it.
> No sandbox script backs this page; claims are cited, not measured.

**The one place in this phase where a *correct* effect is still the wrong answer.
Nothing about the cleanup, the dependencies or the ordering is wrong — the problem
is that the effect keeps a copy, and a copy can disagree.**

## The pattern, written correctly

```jsx
function useOnlineStatus() {
  // Not ideal: Manual store subscription in an Effect
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    function updateState() {
      setIsOnline(navigator.onLine);
    }
    updateState();
    window.addEventListener('online', updateState);
    window.addEventListener('offline', updateState);
    return () => {
      window.removeEventListener('online', updateState);
      window.removeEventListener('offline', updateState);
    };
  }, []);
  return isOnline;
}
```

Check it against everything in the phase: the handler is declared inside the setup
so removal matches ([topic 14](14-timers-listeners-observers.md)), the cleanup is
symmetrical ([topic 04](04-cleanup/01-the-cleanup-contract.md)), the dependency
array is honest ([topic 03](03-the-dependency-array.md)), and `updateState()` is
called once up front so the initial value is not stale.

react.dev still labels it **"Not ideal"**, and the reason is not any of those
things.

## The problem: the effect keeps a copy

The external value lives in `navigator.onLine`. The component renders from
`isOnline` — **a copy of it, held in React state**, updated by an effect that runs
*after* the commit.

So there is a window in which the store has changed and the copy has not. Under
synchronous rendering that window is short and every component crosses it
together. Under concurrent rendering React can render part of the tree, yield to
the browser, and continue later ([topic 13](13-effect-ordering.md)) — and the
store can change in the gap.

The result is **tearing**: one screen showing two different versions of the same
value. The header says online, a panel rendered a moment later says offline, and
both are rendering exactly what they were given. No component is buggy; the
*screen* is inconsistent.

This is why it is not a cleanup problem and cannot be fixed by writing the effect
better. The copy is the defect.

## What `useSyncExternalStore` guarantees

```jsx
function subscribe(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function useOnlineStatus() {
  // ✅ Good: Subscribing to an external store with a built-in Hook
  return useSyncExternalStore(
    subscribe,               // React won't resubscribe for as long as you pass the same function
    () => navigator.onLine,  // How to get the value on the client
    () => true               // How to get the value on the server
  );
}
```

There is no `useState` and no copy. React calls `getSnapshot` when it needs the
value, which is what removes the window.

The consistency guarantee is documented as a caveat, and the final clause is the
whole point:

> If the store is mutated during a non-blocking Transition update, React will fall
> back to performing that update as blocking. Specifically, for every Transition
> update, **React will call `getSnapshot` a second time just before applying
> changes to the DOM.** If it returns a different value than when it was called
> originally, React will **restart the update from scratch**, this time applying
> it as a blocking update, **to ensure that every component on screen is
> reflecting the same version of the store.**

React re-reads the store immediately before committing, and if it moved, throws
the work away and redoes it synchronously. That is a guarantee an effect cannot
offer at any price — the effect does not run until after the commit that already
went out.

## The three parameters, and what each must satisfy

**`subscribe`** — takes a callback, subscribes it, returns a cleanup. Same
start/stop contract as an effect. But:

> If a different `subscribe` function is passed during a re-render, React will
> **re-subscribe** to the store using the newly passed `subscribe` function. You
> can prevent this by declaring `subscribe` outside the component.

Declared inline it is a new function every render, so React tears down and rebuilds
the subscription continuously — the identity problem from
[topic 11 · 01](11-removing-dependencies/01-objects-and-functions.md) with no
dependency array to inspect. Module scope, or `useCallback` when it must close over
something:

```jsx
function ChatIndicator({ userId }) {
  // ✅ Same function as long as userId doesn't change
  const subscribe = useCallback(() => {
    // ...
  }, [userId]);

  const isOnline = useSyncExternalStore(subscribe, getSnapshot);
}
```

**`getSnapshot`** — returns the value. The hard requirement:

> While the store has not changed, repeated calls to `getSnapshot` **must return
> the same value.** If the store changes and the returned value is different (as
> compared by `Object.is`), React re-renders the component.

> The store snapshot returned by `getSnapshot` **must be immutable.**

Return a fresh object each call and React sees a change every time:

```jsx
function getSnapshot() {
  // 🔴 Do not return always different objects from getSnapshot
  return { todos: myStore.todos };
}
```

> if you always return a different value, you will enter an infinite loop and get
> this error — **"The result of `getSnapshot` should be cached to avoid an
> infinite loop"**

For mutable store data the documented fix is to cache: *"it should store the last
calculated snapshot, and return the same snapshot as the last time if the data in
the store has not changed."*

**`getServerSnapshot`** — the initial value during server rendering and hydration.

> If you omit this argument, rendering the component on the server will throw an
> error.

> Make sure that `getServerSnapshot` returns **the same exact data** on the initial
> client render as it returned on the server.

This is the answer to the client-only limitation that has run through the whole
phase ([topic 01](01-what-an-effect-is-for.md)) — and it is why
[topic 12](12-uselayouteffect.md) lists this hook among the ways out of the
`useLayoutEffect` server warning.

One further caveat worth knowing before you build on it:

> It's not recommended to *suspend* a render based on a store value returned by
> `useSyncExternalStore` … mutations to the external store cannot be marked as
> non-blocking Transition updates, so they will trigger the nearest `Suspense`
> fallback, replacing already-rendered content on screen with a loading spinner.

## Gotchas

**Symptom:** two components show different values for the same external source in
one render.
**Cause:** tearing — each reads a copy held in its own state, updated by an effect
after commit, and concurrent rendering opened a window between them.
**Fix:** `useSyncExternalStore`. The effect pattern cannot be fixed into
correctness here.

**Symptom:** `The result of getSnapshot should be cached to avoid an infinite
loop`.
**Cause:** `getSnapshot` builds a new object on every call, so `Object.is` reports
a change every time and React re-renders forever.
**Fix:** return the store's immutable data directly, or cache the last computed
snapshot and return it unchanged when nothing moved.

**Symptom:** the store resubscribes on every render.
**Cause:** `subscribe` declared inside the component, so it has a new identity each
render.
**Fix:** module scope, or `useCallback` with the values it closes over.

**Symptom:** the component throws during server rendering.
**Cause:** `getServerSnapshot` omitted. The docs say this is an error, not a
fallback to client-only.
**Fix:** provide it — or deliberately render the component on the client only.

**Symptom:** hydration mismatch warnings around a store-driven value.
**Cause:** `getServerSnapshot` returned different data on the client's first render
than the server produced.
**Fix:** transfer the server's value to the client and read it there, rather than
recomputing.

**Symptom:** a Suspense fallback replaces working content whenever the store
changes.
**Cause:** suspending on a `useSyncExternalStore` value — store mutations cannot be
non-blocking transitions.
**Fix:** do not suspend on store values. The docs advise against it explicitly.

## Interview questions

**★ What is tearing, and why does subscribing in an effect cause it?**
Tearing is one screen showing two different versions of the same value — a header
saying online and a panel saying offline, with neither component buggy. It happens
because the effect keeps a *copy* of the external value in React state, updated
after the commit. Under concurrent rendering React can render part of the tree,
yield, and continue later, and the store can change in that gap, so different parts
of one render read different versions.

**★ Why can't you fix it by writing the effect better?**
Because nothing about the effect is wrong. react.dev's own example has a
symmetrical cleanup, a handler declared inside the setup, an honest dependency
array and an initial read — and is still labelled "not ideal". The copy is the
defect, and an effect necessarily produces one, because it does not run until after
the commit that already went out.

**★ What guarantee does `useSyncExternalStore` add?**
That every component on screen reflects the same version of the store. The
documented mechanism is that for every Transition update React calls `getSnapshot`
a second time just before applying changes to the DOM, and if the value moved it
restarts the update from scratch as a blocking update. React re-reads the store
immediately before committing — which is precisely what an effect cannot do.

**What are the two rules for `getSnapshot`?**
It must return the same value while the store has not changed, compared with
`Object.is`, and the snapshot must be immutable. Returning a fresh object each call
means React sees a change every time and re-renders forever, which produces the
"result of getSnapshot should be cached to avoid an infinite loop" error. For
mutable store data, cache the last computed snapshot and return it unchanged until
the data actually moves.

**Why must `subscribe` be declared outside the component?**
Because React resubscribes whenever a different `subscribe` function is passed. An
inline definition is a new function every render, so the subscription is torn down
and rebuilt continuously. Module scope gives it a stable identity; `useCallback` is
the option when it must close over a prop such as a user id.

**What does `getServerSnapshot` do, and what happens without it?**
It supplies the value during server rendering and during hydration. Omitting it
makes server rendering of the component throw. It must return exactly the same data
on the client's first render as the server produced, which usually means
transferring the value rather than recomputing it — otherwise you get a hydration
mismatch.

---

← Prev: [Effects and refs together](15-effects-and-refs.md) · Index: [Phase 4](README.md) · Next → [`useInsertionEffect`](17-useinsertioneffect.md)
