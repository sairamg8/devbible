---
title: "use(promise)"
sidebar_label: "04 · use(promise)"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`use`](https://react.dev/reference/react/use) (parameters, caveats, and the
> promise-caching section),
> [`<Suspense>`](https://react.dev/reference/react/Suspense) (the retry-from-scratch
> caveat), and [`lazy`](https://react.dev/reference/react/lazy) (the caching precedent).
> No sandbox script backs this page; claims are cited, not measured.

**`use(promise)` reads a promise during render, and suspends until it resolves. The
entire difficulty is one requirement: the promise must be the *same object* on every
render, which means your component must not be the thing that creates it.**

## The API

> `use` is a React API that lets you read the value of a **Promise** or **context**.

```js
const value = use(resource);
```

> **`promise`**: A Promise whose resolved value you want to read. **The Promise must be
> cached so that the same instance is reused across re-renders.**

`use` is the mechanism the rest of Suspense is built on.
[Topic 03](03-what-can-suspend.md) noted that a Suspense-enabled framework *"maintains a
cache of Promises and calls `use` to suspend on a Promise"* — so understanding this one
API is understanding how every framework loader works underneath.

Its Rules-of-Hooks exemption — it may be called inside conditions and loops — is
[Phase 7 · 10](../phase-7-custom-hooks/10-use-breaks-the-rule.md); this page is about the
promise.

## 🔴 Why an inline promise never terminates

```jsx
// 🔴 An infinite loop, not a slow load
function Profile({ id }) {
  const user = use(fetch(`/api/users/${id}`).then(r => r.json()));
  return <h1>{user.name}</h1>;
}
```

Follow it through with the boundary's documented behaviour
([topic 02 · 02](02-suspense/02-state-effects-and-resuspending.md)):

> React does not preserve any state for renders that got suspended before they were able
> to mount for the first time. When the component has loaded, React will **retry rendering
> the suspended tree from scratch.**

1. Render 1 calls `fetch`, gets promise **A**, and suspends on it.
2. A resolves. React **retries the tree from scratch**.
3. Render 2 calls `fetch` again — a *new* request, promise **B** — and suspends on it.
4. B resolves. React retries. Render 3 creates promise C…

The component never renders content, and it issues a network request per attempt. This is
not a subtle performance problem; it is a hang plus a request flood, and it is the single
most common way `use` is misused.

The rule follows directly: **`use` needs to be able to recognise "this is the promise I
was already waiting for."** A promise created during render is by definition new every
time, so it can never be recognised.

## Where a stable promise comes from

Three legitimate sources, in the order you will meet them.

**1. A Server Component created it and passed it down.** The pattern `use` was designed
around:

```jsx
// Server Component — starts the work, does not await it
function Page({ id }) {
  const userPromise = fetchUser(id);          // not awaited
  return <Profile userPromise={userPromise} />;
}

// Client Component — reads it during render
'use client';
function Profile({ userPromise }) {
  const user = use(userPromise);
  return <h1>{user.name}</h1>;
}
```

The server starts the request and streams; the client suspends on it. One caveat applies:

> When passing a Promise from a Server Component to a Client Component, its **resolved
> value must be serializable**.

So plain data crosses — no class instances, no functions, no `Date` surviving as a `Date`
unless the framework's serializer handles it. Phase 10 covers the boundary properly.

**2. A cache outside the component.** Any store that returns the *same* promise for the
same key:

```jsx
const cache = new Map();

function fetchUser(id) {
  if (!cache.has(id)) {
    cache.set(id, fetch(`/api/users/${id}`).then(r => r.json()));
  }
  return cache.get(id);                        // ← same instance for the same id
}

function Profile({ id }) {
  const user = use(fetchUser(id));             // ✅ stable across renders
  return <h1>{user.name}</h1>;
}
```

This is the minimum viable version and it is deliberately naive — it never evicts, never
revalidates, and never retries. It is here to show the *shape*, not as something to ship;
a real query library is the honest answer
([topic 05](05-request-waterfalls.md); the planned Phase 12 on client-side caching was
dropped, so the server-side answer in Phase 10 is the one this bible gives).

**3. A framework loader.** Which, per the docs, is option 2 with the hard parts written.

**And one that is not a source: `useMemo`.** A memo is a cache React may discard —
memoization is not a guarantee
([Phase 6 · 03](../phase-6-performance/03-usememo.md)) — and a discarded memo here means
a fresh promise and a fresh suspension. Worse, the docs specifically note that a cache is
*discarded on suspend*, so the one moment you need the memo to hold is the moment it does
not.

## The same rule you have already met twice

This is `lazy`'s rule, restated for data:

> Both the returned Promise and the Promise's resolved value will be **cached, so React
> will not call `load` more than once.**

`lazy` caches for you, because you hand it a `load` function once at module scope. `use`
cannot cache for you, because you hand it a *promise* — an object it has no key for. So
the caching becomes your responsibility, and the discipline is identical: **create it
once, outside the render that consumes it.**

That is the through-line of this whole phase's first four topics:

| API | The thing that must be stable | Created where |
|---|---|---|
| `lazy(load)` | The returned component | Module scope |
| `use(promise)` | The promise instance | A cache, a framework, or a Server Component |
| `useSyncExternalStore` | `subscribe` and the snapshot reference | Outside the component |

## Errors and the missing `try`/`catch`

> `use` **cannot be called inside a try-catch block.** Instead, wrap your component in an
> **Error Boundary** to catch errors.

So a rejected promise is not yours to handle at the call site. It propagates to the
nearest error boundary, exactly as a rejected `lazy` import does. The consequence for
design is that **a Suspense boundary without an error boundary above it has no failure
path** — the UI shows the fallback and then the tree throws. Topic 16 is that pairing.

The reason the `try`/`catch` ban is different from the Rules-of-Hooks one is worth
carrying: for ordinary hooks a `try` makes the hook *count* conditional; for `use`,
suspension is signalled by throwing, so a `catch` would intercept the pause itself
([Phase 7 · 05 · 02](../phase-7-custom-hooks/05-why-the-rules-exist/02-deriving-the-forbidden-places.md)).

## Gotchas

**Symptom:** a component using `use` never renders and the network tab fills with
identical requests.
**Cause:** the promise is created during render, so each retry creates a new one.
**Fix:** cache it, or receive it as a prop from a Server Component.

**Symptom:** `useMemo` is used to stabilise the promise and it still refetches
occasionally.
**Cause:** memoization is not a guarantee, and the cache is discarded on suspend.
**Fix:** a real cache outside React, keyed by the request.

**Symptom:** a rejected promise crashes the app instead of showing an error state.
**Cause:** `use` cannot be wrapped in `try`/`catch`; rejection goes to the nearest error
boundary, and there wasn't one.
**Fix:** pair every Suspense boundary with an error boundary.

**Symptom:** data from a Server Component arrives mangled — a `Date` is a string, a class
instance is a plain object.
**Cause:** the resolved value must be serializable to cross the boundary.
**Fix:** send plain data and reconstruct on the client if needed.

**Symptom:** the naive `Map` cache serves stale data forever.
**Cause:** it was the minimum viable shape, not a cache — no eviction, no revalidation,
no retry.
**Fix:** a query library, or accept and document the staleness deliberately.

**Symptom:** changing the id does not refetch.
**Cause:** the cache key does not include the id, so the same promise is returned.
**Fix:** key the cache by every input the request depends on.

## Interview questions

**★ Why must the promise passed to `use` be cached?**
Because a suspended tree that had not yet mounted is retried **from scratch** — so a
promise created during render is re-created on the retry, suspends again, and the cycle
never terminates while issuing a request per attempt. React has no key for a promise
object, so it can only recognise "the one I was already waiting for" by identity. The
promise must therefore come from somewhere stable: a Server Component, a cache outside
the component, or a framework loader.

**★ Can you use `useMemo` to stabilise it?**
No. Memoization is not a guarantee — React may discard a memo — and the docs note the
cache is discarded on suspend, which is precisely the moment you need it. The cache has
to live outside React.

**★ How does `use` relate to `lazy` and to framework data loading?**
They are the same discipline. `lazy` caches both the promise and its resolved value for
you because you hand it a `load` function once at module scope; `use` cannot, because you
hand it a promise object it has no key for, so caching becomes yours. And a
"Suspense-enabled framework" is not a separate mechanism at all — it maintains a cache of
promises and calls `use`.

**★ How do you handle a rejected promise read with `use`?**
With an error boundary. `use` cannot be called inside a `try`/`catch` — and the reason is
specific: suspension is signalled by throwing, so a `catch` would intercept the pause
rather than an error. That is why a Suspense boundary without an error boundary above it
has no failure path at all.

**What is the Server Component pattern `use` was designed for?**
The server starts the request without awaiting it and passes the promise to a Client
Component, which reads it with `use` and suspends. The server streams, the client shows a
fallback, and there is no client-side waterfall. The one constraint is that the resolved
value must be serializable to cross the boundary.

---

← Prev: [What can actually suspend](03-what-can-suspend.md) ·
Index: [Phase 8](README.md) ·
Next → [Request waterfalls](05-request-waterfalls.md)
