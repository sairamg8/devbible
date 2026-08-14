---
title: "Data fetching in RSC"
sidebar_label: "15 · Data fetching in RSC"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`cache`](https://react.dev/reference/react/cache) (parameters, returns, all caveats, both
> pitfalls, and the comparison with `useMemo`),
> [`cacheSignal`](https://react.dev/reference/react/cacheSignal) (the signature, the three
> ways a render finishes, and both caveats), and
> [Server Components](https://react.dev/reference/rsc/server-components).
> No sandbox script backs this page; claims are cited, not measured.

**Fetch where the data is used, not where it is convenient.** RSC removes the reason
components were forced to hoist their data requirements upward — and then hands you two
tools, `cache` and `cacheSignal`, to make that safe.

## The waterfall that disappears, and the one that does not

**Gone: the client waterfall.** A component that fetched in an effect could not start until
its parent had rendered, which could not start until *its* parent's fetch resolved. Each
level cost a round trip from the browser. On the server the data is fetched during the same
render pass, at server-to-database latency
([topic 08](08-async-components.md)).

**Still there: the sequential-`await` waterfall**, and it is yours:

```jsx
// ✖ serialized
const user  = await getUser(id);
const posts = await getPosts(id);

// ✅ parallel
const [user, posts] = await Promise.all([getUser(id), getPosts(id)]);
```

Sequential is correct only when the second genuinely needs the first. The rule is the same
one from [Phase 8 · 05](../phase-8-concurrent-suspense/05-request-waterfalls.md); only the
latency changed.

⚠️ **Sibling components each awaiting their own data are already parallel** — React renders
them in the same pass. The waterfall only appears when the `await`s are *in one function
body*, one after another.

## `cache` — deduplicate a query across one request

The problem it solves: with data fetched where it is used, three components on one page can
each ask for the current user. That is three identical queries per request.

```js
const cachedFn = cache(fn);
```

> `cache` **returns a cached version of `fn` with the same type signature. It does not call
> `fn` in the process.**
>
> When calling `cachedFn` with given arguments, it **first checks if a cached result exists
> in the cache. If a cached result exists, it returns the result.** If not, it calls `fn`,
> stores the result, and returns it.

### The four caveats, each with a consequence

> **React will invalidate the cache for all memoized functions for each server request.**

**Per request, not global.** It is a request-scoped deduplication tool, not an application
cache. Nothing survives to the next request, so it can never serve stale data across users —
and it can never save you a query on the *next* page load either.

> **Each call to `cache` creates a new function. Calling `cache` with the same function
> multiple times will return different memoized functions that do not share the same cache.**

🔴 **This is the mistake to internalise.** `cache(getUser)` written in two files gives you two
caches and zero deduplication. React states the fix as a pattern:

```js
// getUser.js — the memoized function lives in one module
import { cache } from 'react';
import { fetchUser } from './db';

export default cache(fetchUser);
```

Every component imports **that module**. The shared cache is the shared *identity*.

> **`cachedFn` will also cache errors.** If `fn` throws an error for certain arguments, it
> will be cached, and the same error is re-thrown when `cachedFn` is called with those same
> arguments.

Within one request, a failure is a result. Usually what you want — three components should
not each retry a failing query — but it means a transient failure is not retried by a later
call in the same render.

> **`cache` is for use in Server Components only.**

### Calling it outside a component does nothing

> **React only provides cache access to the memoized function in a component. Cache access is
> provided through a context which is only accessible from a component.**

```jsx
// 🚩 outside a component — not memoized
getUser('demo-id');

async function DemoProfile() {
  const user = await getUser('demo-id');   // ✅ memoized
  return <Profile user={user} />;
}
```

A module-level warm-up call is not a warm-up. It runs the function and caches nothing.

### `cache` is not `useMemo`

| | `useMemo` | `cache` |
|---|---|---|
| Where | Client Components | **Server Components only** |
| Scope | local to one component | **shared across components** |
| Keeps | only the last computation | results per argument set |
| Invalidated | on dependency change | **each server request** |
| Intended for | expensive computation | **data fetches** |

They are not variants of one idea. `useMemo` is about avoiding recomputation across renders
of one component; `cache` is about one request asking for the same thing once.

## `cacheSignal` — stop work nobody is waiting for

> **`cacheSignal` allows you to know when the `cache()` lifetime is over.** Call `cacheSignal`
> to get an `AbortSignal`.
>
> **When React has finished rendering, the `AbortSignal` will be aborted. This allows you to
> cancel any in-flight work that is no longer needed.**

Rendering is finished when — and all three matter:

> - **React has successfully completed rendering**
> - **the render was aborted**
> - **the render has failed**

The second and third are the point. A render that was **interrupted** — a transition
restarted, a request abandoned — leaves queries in flight that nobody will read. Without a
signal, the server does the work anyway.

```js
import { cache, cacheSignal } from 'react';
const dedupedFetch = cache(fetch);

async function Component() {
  await dedupedFetch(url, { signal: cacheSignal() });
}
```

The second documented use is quieter and just as valuable — **not logging cancellations as
errors**:

```js
async function getData(id) {
  try {
    return await queryDatabase(id);
  } catch (x) {
    if (!cacheSignal()?.aborted) {
      logError(x);   // only log if it's a real error and not due to cancellation
    }
    return null;
  }
}
```

An aborted query throws. Treating that as a failure fills your error tracker with noise from
renders that were legitimately abandoned.

### Its two caveats

> **`cacheSignal` is currently for use in React Server Components only. In Client Components,
> it will always return `null`. In the future it will also be used for Client Component when a
> client cache refreshes or invalidates. You should not assume it'll always be null on the
> client.**

Note the forward-looking half: **do not write `if (cacheSignal() === null)` as a "we are on
the client" test.** It is documented as a value that will change.

> **If called outside of rendering, `cacheSignal` will return `null` to make it clear that the
> current scope isn't cached forever.**

Hence `cacheSignal()?.aborted` — optional chaining, always.

## Putting it together

```js
// data/user.js
import { cache, cacheSignal } from 'react';

export const getUser = cache(async (id) => {
  const res = await fetch(`${API}/users/${id}`, { signal: cacheSignal() });
  return res.json();
});
```

- **One module** → one memoized identity → real deduplication.
- **`cacheSignal()`** → abandoned renders stop costing.
- **Imported by any component that needs a user** → fetch where used, without paying for it
  repeatedly.

And note what is *not* here: no Server Function. Reads belong in Server Components, because
Server Functions process one action at a time and cannot cache their return value
([topic 04](04-use-server.md)).

## Gotchas

**Symptom:** `cache` deduplicates nothing.
**Cause:** `cache(fn)` was called in more than one place — each call creates a different
memoized function with its own cache.
**Fix:** export one memoized function from one module and import it everywhere.

**Symptom:** a module-level call was added to "warm the cache" and nothing changed.
**Cause:** cache access is provided through a context only available inside a component.
**Fix:** delete it; call from within the component.

**Symptom:** a transient failure sticks for the whole page.
**Cause:** `cachedFn` caches errors and re-throws the same one for the same arguments.
**Fix:** expected within a request; handle failure where you can render around it.

**Symptom:** the cache is expected to help across requests or users.
**Cause:** React invalidates it for every server request.
**Fix:** use a real cache for that; `cache` is request-scoped deduplication.

**Symptom:** the error tracker fills with aborted-query noise.
**Cause:** an interrupted render aborts in-flight work and the rejection is logged.
**Fix:** guard with `if (!cacheSignal()?.aborted)`.

**Symptom:** `cacheSignal()` throws on `.aborted`.
**Cause:** it returns `null` outside rendering, and on the client.
**Fix:** optional chaining, always.

**Symptom:** `cacheSignal() === null` used as a "this is the client" check.
**Cause:** documented to change — it will be used on the client when a client cache refreshes.
**Fix:** do not branch on it.

## Interview questions

**★ Which waterfall does RSC remove, and which does it not?**
It removes the **client** waterfall — a component fetching in an effect could not start until
its parent's fetch resolved, each level costing a browser round trip. It does not remove
sequential `await`s inside one function body; those still serialize and want `Promise.all`.
Sibling components each awaiting their own data are already parallel.

**★ What does `cache` actually do, and what is its scope?**
It returns a memoized version of a function, checking for a cached result before calling
through. Its scope is **one server request** — React invalidates the cache for all memoized
functions on each request — so it is deduplication, not an application cache. Server
Components only.

**★ Why does `cache` often appear to do nothing?**
Two documented reasons. Each call to `cache` creates a **new** function with its own cache,
so `cache(getUser)` in two files deduplicates nothing — the memoized function has to live in
one module that everyone imports. And calling it **outside a component** does not use the
cache at all, because cache access comes through a context only available inside a component.

**★ How is `cache` different from `useMemo`?**
Different sides of the boundary and different jobs. `useMemo` caches an expensive computation
locally to one Client Component and keeps only the last result, invalidated by dependencies.
`cache` shares memoized work **across components** in Server Components, is intended for data
fetches, and is invalidated per server request.

**What is `cacheSignal` for?**
Knowing when the `cache()` lifetime is over. It returns an `AbortSignal` that React aborts
when rendering finishes — whether it **completed, was aborted, or failed**. Two uses: pass it
to `fetch` so an abandoned render stops costing, and check `cacheSignal()?.aborted` before
logging an error so cancellations are not reported as failures.

**What are the traps with `cacheSignal`?**
It returns `null` outside rendering and in Client Components, so always use optional chaining
— and do **not** treat `null` as "we are on the client", because the docs say it will be used
on the client in future when a client cache refreshes or invalidates.

---

← Prev: [The renderer packages](14-renderer-packages.md) ·
Index: [Phase 10](README.md) ·
Next → [Next.js App Router vs React Router](16-nextjs-vs-react-router.md)
