---
title: "Browser state — useLocalStorage, useMediaQuery"
sidebar_label: "02 · Browser state"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)
> (parameters, the immutability requirement, the cached-snapshot error, `subscribe`
> stability, `getServerSnapshot`), MDN
> [`Window.matchMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia)
> and [`Window: storage` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event).
> No sandbox script backs this page; claims are cited, not measured.

**Both of these read state that belongs to the browser rather than to React, and both
have the same two failure modes: they do not exist on the server, and two callers
holding `useState` copies drift apart. `useSyncExternalStore` is the answer to both at
once, which is why they share a page.**

## The shape both hooks want

Three parts, and the whole of this page is filling them in:

```js
useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
```

> The `subscribe` function should subscribe to the store and return a function that
> unsubscribes.

> The `getSnapshot` function should read a snapshot of the data from the store.

> The `getServerSnapshot` function is similar to `getSnapshot`, but it runs only in two
> situations: It runs on the server when generating the HTML. It runs on the client
> during hydration.

The browser *is* the external store. `localStorage` and `matchMedia` are not React
state; they are values living outside the tree that can change without React's
knowledge. Once you see them that way, both hooks write themselves.

## `useMediaQuery`

The easier of the two, because the browser gives you a real subscription.

> The `matchMedia()` method returns a new `MediaQueryList` object that can then be used
> to determine if the `document` matches the media query string, as well as to
> **monitor the document to detect when it matches (or stops matching)** that media
> query.

> If you need to be kept aware of whether or not the document matches the media query at
> all times, you can instead **watch for the `change` event** to be delivered to the
> object.

```jsx
import { useSyncExternalStore, useMemo, useCallback } from 'react';

export function useMediaQuery(query, serverValue = false) {
  const mql = useMemo(() => window.matchMedia(query), [query]);

  const subscribe = useCallback((onChange) => {
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [mql]);

  const getSnapshot = useCallback(() => mql.matches, [mql]);

  return useSyncExternalStore(subscribe, getSnapshot, () => serverValue);
}
```

**Gotcha 1 — the naive version misses changes that happen before the effect runs.** The
`useState` + `useEffect` implementation reads `matches` during render (or in an
initialiser) and subscribes afterwards; a rotation or resize in that gap is lost, and
the value stays wrong until the next change. `useSyncExternalStore` closes that window
by design — it re-reads the snapshot when it subscribes.

**Gotcha 2 — `subscribe` must be stable.** From the docs:

> If a **different `subscribe` function is passed during a re-render, React will
> re-subscribe** to the store using the newly passed `subscribe` function. You can
> prevent this by declaring `subscribe` outside the component.

Here it cannot be declared outside, because it closes over `query`. `useCallback` keyed
on the memoized `mql` is the equivalent: the identity changes when — and only when — the
query does, which is exactly when a re-subscribe is correct.

**Gotcha 3 — `window.matchMedia` does not exist on the server.** Hence the third
argument. Note that it is a *caller-supplied* default rather than a guess: a
`prefers-reduced-motion` hook should serve `false`, and a `min-width` hook for a
mobile-first layout probably should too, but the hook has no business deciding.
Whatever it returns must match the client's first render or hydration mismatches.

**Gotcha 4 — the boolean flips after hydration, and that is not a bug.** The server
cannot know the viewport. Design the UI so the server value is a usable state, not a
flash: render both layouts with CSS where you can, and reserve the hook for behaviour
CSS cannot express.

(On `MediaQueryList.addListener`/`removeListener`: those are the legacy methods that
predate `EventTarget` support on `MediaQueryList`. MDN documents `addEventListener` as
the way to watch for `change`; if you need to support an engine old enough to lack it,
that is a compatibility decision to make deliberately rather than a React concern.)

## `useLocalStorage`

[Phase 7 · 03 · 02](../03-share-logic-not-state/02-the-localstorage-trap.md) took the
naive version apart: two callers agree on mount and diverge on the first write, because
each holds its own `useState` and `localStorage` has no change notification for the
document that wrote to it. Here is the version that does not have that problem.

The trick is that **you must supply the notification yourself**, because the browser
will not:

```jsx
// store.js — one module-level store, shared by every caller
const listeners = new Set();
const cache = new Map();          // key → the parsed snapshot (cached, per the docs)

function emit() { listeners.forEach((l) => l()); }

export function subscribe(listener) {
  listeners.add(listener);
  window.addEventListener('storage', onStorage);      // other tabs
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function onStorage(e) {
  if (e.key === null) cache.clear();                  // storage was cleared
  else cache.delete(e.key);
  emit();
}

export function readKey(key, fallback) {
  if (!cache.has(key)) {
    const raw = window.localStorage.getItem(key);
    cache.set(key, raw === null ? fallback : JSON.parse(raw));
  }
  return cache.get(key);                              // ← same reference every call
}

export function writeKey(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
  cache.set(key, value);
  emit();                                             // ← the part the browser won't do
}
```

```jsx
// useLocalStorage.js
import { useSyncExternalStore, useCallback } from 'react';
import { subscribe, readKey, writeKey } from './store';

export function useLocalStorage(key, initialValue) {
  const value = useSyncExternalStore(
    subscribe,
    () => readKey(key, initialValue),
    () => initialValue,                                // server snapshot
  );
  const set = useCallback((next) => writeKey(key, next), [key]);
  return [value, set];
}
```

**Gotcha 1 — `emit()` on write is the entire fix.** Everything else is plumbing. The
naive hook's bug is that a write notified nobody; `writeKey` notifies every subscriber
in this document, so all callers re-render with the new value. The `storage` listener is
a *separate* feature for cross-tab sync, since MDN is explicit that the event *"is not
fired on the window that made the change"*.

**Gotcha 2 — the cache is mandatory, not an optimisation.** `getSnapshot` must return
the same reference until the data changes:

> This error means your `getSnapshot` function returns a **new object every time** it's
> called … if you always return a different value, you will enter an **infinite loop**.

`JSON.parse` produces a new object on every call, so `() => JSON.parse(localStorage
.getItem(key))` is an infinite render loop for any object value. Caching the parsed
result — and invalidating it on write and on a `storage` event — is what makes the
snapshot stable.

**Gotcha 3 — the server snapshot must be the initial value, not a storage read.**
`localStorage` does not exist during SSR, and the first client render must agree with
the HTML. That means the persisted value appears *after* hydration, which is a visible
flash for something like a theme. The usual answer is out of React's hands — a cookie or
an inline script that sets a class before hydration — and it is worth knowing that the
hook cannot solve it.

**Gotcha 4 — `localStorage` can throw.** Private-mode restrictions, disabled storage and
quota exhaustion all raise; a `setItem` that throws inside `writeKey` will propagate into
an event handler. Wrap the reads and writes if the feature must degrade rather than
fail.

**Gotcha 5 — it is not JSON-safe.** `JSON.stringify` turns `undefined` into nothing,
`Date` into a string and `Map`/`Set` into `{}`. `useLocalStorage('lastSeen', new Date())`
returns a string on the next load. Either constrain the hook to JSON-shaped values in its
name and types, or serialize explicitly.

## Gotchas

**Symptom:** a media query hook is briefly wrong after mount.
**Cause:** the naive version reads once and subscribes in an effect, missing changes in
the gap.
**Fix:** `useSyncExternalStore`, which re-reads on subscribe.

**Symptom:** the media query hook re-subscribes on every render.
**Cause:** an inline `subscribe`, so a different function is passed each render.
**Fix:** memoize it on the `MediaQueryList`; the identity should change only when the
query does.

**Symptom:** `window is not defined` during SSR.
**Cause:** `matchMedia` or `localStorage` touched on the server.
**Fix:** `getServerSnapshot`, returning a value the client's first render will agree
with.

**Symptom:** "The result of getSnapshot should be cached to avoid an infinite loop."
**Cause:** `JSON.parse` in `getSnapshot` — a new object every call.
**Fix:** cache the parsed value; invalidate on write and on `storage`.

**Symptom:** two components using `useLocalStorage` still disagree.
**Cause:** the write does not notify subscribers in this document.
**Fix:** emit from the writer. `storage` covers other tabs only.

**Symptom:** the stored theme flashes the default on every page load.
**Cause:** the server snapshot cannot read storage, so hydration starts from the default.
**Fix:** not solvable inside the hook — use a cookie or a pre-hydration script.

**Symptom:** a stored `Date` comes back as a string.
**Cause:** JSON round-tripping.
**Fix:** serialize explicitly, or restrict the hook to JSON-shaped values.

## Interview questions

**★ Why is `useSyncExternalStore` the right base for both of these?**
Because both read state that lives outside React and can change without React knowing —
the browser is the external store. It gives you the three things the naive versions get
wrong: a subscription so changes propagate, a snapshot re-read at subscribe time so no
change is missed in the gap, and a server snapshot so SSR and hydration agree. It also
guarantees no tearing under concurrent rendering, which a hand-rolled `useState` plus
`useEffect` cannot.

**★ Write `useLocalStorage` so two components stay in sync. What is the key line?**
The `emit()` in the writer. `localStorage` has no change notification for the document
that wrote to it — the `storage` event is explicitly not fired on the window that made
the change — so the store must notify its own subscribers. The `storage` listener is
then an addition for cross-tab sync, not the fix.

**★ Why must `getSnapshot` cache the parsed value?**
Because React re-renders whenever the snapshot's identity differs from last time.
`JSON.parse` returns a new object on every call, so an uncached `getSnapshot` is an
infinite loop — React even reports it as "the result of getSnapshot should be cached".
The store keeps the parsed value and invalidates it on write or on a `storage` event.

**★ What does `getServerSnapshot` have to return, and what is the consequence?**
Something the client's first render will produce too, since it is used both for the
server HTML and during hydration. For `useLocalStorage` that means the initial value,
not a storage read — so the persisted value appears only after hydration, which is a
visible flash for a theme. The hook cannot fix that; a cookie or a pre-hydration script
can.

**Why does `subscribe` need a stable identity, and how do you get one when it closes
over a query?**
If a different `subscribe` is passed during a re-render, React re-subscribes with the
new one, so an inline arrow tears down and rebuilds the subscription every render. When
it must close over an argument, memoize it on that argument — the identity then changes
exactly when a re-subscribe is genuinely correct.

**What does `useLocalStorage` silently do to your data?**
JSON round-trips it. `undefined` disappears, `Date` becomes a string, `Map` and `Set`
become `{}`, and anything with a prototype loses it. It can also throw outright in
private mode or on quota exhaustion, in an event handler where nothing catches it.

---

← Prev: [Value helpers](01-value-helpers.md) ·
Index: [The standard set](README.md) ·
Next → [Events and the DOM](03-events-and-the-dom.md)
