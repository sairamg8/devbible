---
title: "cache and cacheSignal"
sidebar_label: "13 · cache and cacheSignal"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`cache`](https://react.dev/reference/react/cache) (definition, parameters, returns,
> the full Caveats list, and the module-scope guidance) and
> [`cacheSignal`](https://react.dev/reference/react/cacheSignal) (definition, returns,
> abort conditions, caveats).
> ⚠️ react.dev **does not state which version introduced `cacheSignal`**; this page does
> not claim one.
> No sandbox script backs this page; claims are cited, not measured.

**`cache` deduplicates a function across one server render, so three components asking for
the same user make one request. `cacheSignal` tells you when that render is over — which
is what lets you cancel work React has already decided it does not need.**

Both are **Server Components only**, which is the first thing to establish because both
look like general-purpose tools.

## `cache`

> `cache` lets you cache the result of a data fetch or computation. It is **only for use
> with React Server Components**.

```js
const cachedFn = cache(fn);
```

> `cache` returns a cached version of `fn` with the same type signature. **It does not
> call `fn` in the process.**

> When calling `cachedFn` with given arguments, it first checks if a cached result exists
> in the cache. If a cached result exists, it returns the result. If not, it calls `fn`
> with the arguments, stores the result in the cache, and returns the result. **The only
> time `fn` is called is when there is a cache miss.**

The problem it solves is the one [topic 05](05-request-waterfalls.md) creates when you fix
a waterfall by letting several components each ask for what they need: three components
calling `getUser(7)` would make three requests. Wrap it in `cache` and they make one — and
crucially, they can each ask independently, so you keep colocated data reads *and* avoid
duplication.

### 🔴 Call it at module scope

> **Call `cache` at module scope (outside components), not inside components.**

```js
// ✅ Correct: Module scope
import {cache} from 'react';
import calculateMetrics from 'lib/metrics';

const getMetrics = cache(calculateMetrics);

function Chart({data}) {
  const report = getMetrics(data);
}
```

```js
// 🚩 Wrong: Inside component creates new memoized function each render
function Temperature({cityData}) {
  const getWeekReport = cache(calculateWeekReport);
  const report = getWeekReport(cityData);
}
```

> Calling `cache` at module scope ensures **multiple components can share the same cache**,
> maximizing cache hits and reducing duplicate work.

And the caveat that makes the wrong version *silently useless* rather than broken:

> **Each call to `cache` creates a new function.** This means that calling `cache` with
> the same function multiple times will return **different memoized functions that do not
> share the same cache.**

So `cache(fn)` inside a component produces a fresh, empty cache on every render. Nothing
errors; you simply get no deduplication at all, and the "optimisation" is pure overhead.

This is the *third* time this phase has produced the same rule — `lazy` at module scope
([topic 03](03-what-can-suspend.md)), a promise created outside render
([topic 04](04-use-promise.md)), and now `cache`. **The stable thing is created once,
outside the render that consumes it**, every time.

### The two other caveats

> React will **invalidate the cache for all memoized functions for each server request.**

That is the scoping guarantee, and it is what makes `cache` safe where a module-level
`Map` is not: the cache is per-request, so one user's data cannot be served to the next —
the cross-user leak from
[Phase 7 · 03 · 04](../phase-7-custom-hooks/03-share-logic-not-state/04-external-stores.md)
does not apply. It is also the limit: **`cache` is not a data cache between requests.** It
deduplicates within one render, nothing more.

> `cachedFn` **will also cache errors.** If `fn` throws an error for certain arguments, it
> will be cached, and the **same error is re-thrown** when `cachedFn` is called with those
> same arguments.

Consistent — every component asking the same question gets the same answer, including when
the answer is a failure — and worth knowing, because it means a transient failure is not
retried within a render. Retrying is the caller's business, above the cached function.

## `cacheSignal`

> `cacheSignal` allows you to know when the `cache()` **lifetime is over**. It returns an
> `AbortSignal` that aborts when React has finished rendering, allowing you to **cancel
> any in-flight work that is no longer needed.**

```js
const signal = cacheSignal();
```

> `cacheSignal` returns an `AbortSignal` **if called during rendering. Otherwise
> `cacheSignal()` returns `null`.**

The abort conditions are the useful part, because they cover more than success:

> The `AbortSignal` will be aborted when:
> - React has **successfully completed** rendering
> - the render was **aborted**
> - the render has **failed**

The middle one is the reason this API exists. [Topic 06](06-what-concurrent-rendering-means.md)
established that React may abandon an in-progress render — and until now, work started by
that render carried on regardless. A server render that is discarded leaves its database
queries and HTTP requests running, consuming connections for a response nobody will read.
`cacheSignal` is the hook that lets that work be cancelled:

```js
import { cache, cacheSignal } from 'react';

const getUser = cache(async (id) => {
  const res = await fetch(`/api/users/${id}`, { signal: cacheSignal() });
  return res.json();
});
```

Because `fetch` already accepts an `AbortSignal`, wiring it in is one argument. Anything
else that takes a signal — a database driver, a timeout, an SDK — takes it the same way.

### The two caveats

> `cacheSignal` is **currently for use in React Server Components only.** In Client
> Components, it will **always return `null`.** In the future it will also be used for
> Client Components when a client cache refreshes or invalidates.

> If called **outside of rendering**, `cacheSignal` will return `null` to make it clear
> that the **current scope isn't cached forever.**

Both mean the same practically: **`cacheSignal()` can be `null`, and your code must
handle that.** Passing `null` as a `signal` to `fetch` is harmless — it behaves as no
signal — but code that calls `signal.addEventListener` directly must guard.

The "isn't cached forever" phrasing is a deliberate signal in itself: returning `null`
rather than a never-aborting signal makes it obvious you are outside the scope this API
describes, instead of silently giving you something that looks right.

## Where this sits

Both APIs belong to the server half of the story, and this page is their concurrency
context rather than their full treatment — Phase 10 covers Server Components properly. The
reason they appear in Phase 8 is that both exist *because* rendering is concurrent and
per-request: `cache` because one render may ask the same question several times, and
`cacheSignal` because a render may be thrown away with work still in flight.

## Gotchas

**Symptom:** `cache` is used and requests are still duplicated.
**Cause:** `cache(fn)` was called inside a component, so each render creates a new
memoized function with its own empty cache.
**Fix:** module scope. It fails silently — no error, just no deduplication.

**Symptom:** two modules wrap the same function and share nothing.
**Cause:** each call to `cache` creates a new function with a separate cache.
**Fix:** export the one cached function and import it everywhere.

**Symptom:** stale data is expected between requests and never appears.
**Cause:** React invalidates the cache for all memoized functions on each server request.
**Fix:** correct — `cache` deduplicates within a render, it is not a data cache. Use a real
cache for cross-request storage.

**Symptom:** a transient failure is not retried within a render.
**Cause:** `cachedFn` caches errors and re-throws the same one for the same arguments.
**Fix:** retry above the cached function, not inside it.

**Symptom:** `cacheSignal()` returns `null` and a listener throws.
**Cause:** it returns `null` outside rendering and always in Client Components.
**Fix:** guard before using it. Passing `null` to `fetch` is fine; calling methods on it is
not.

**Symptom:** an abandoned server render leaves queries running.
**Cause:** nothing was told the render was discarded.
**Fix:** pass `cacheSignal()` to anything that accepts an `AbortSignal` — the signal aborts
on abandonment as well as on success.

**Symptom:** `cache` is used in a Client Component and nothing works as expected.
**Cause:** it is for Server Components only.
**Fix:** a client-side query cache is the equivalent there.

## Interview questions

**★ What does `cache` do and what problem does it solve?**
It returns a memoized version of a function so that repeated calls with the same arguments
within one server render hit the cache and only a miss calls the original. That lets
several components each ask independently for the same data — keeping colocated reads —
without producing duplicate requests, which is exactly the tension fixing a waterfall
creates.

**★ Why must `cache` be called at module scope?**
Because each call to `cache` creates a new function with its own cache. Calling it inside a
component produces a fresh empty cache on every render, so you get no deduplication at all
— and nothing errors, so the optimisation is silently pure overhead. Module scope also lets
multiple components share one cache, which is where the hits come from.

**★ What is the lifetime of a `cache` entry?**
One server request. React invalidates the cache for all memoized functions on each server
request, which is what makes it safe — one user's data cannot leak into the next request,
unlike a hand-rolled module-level `Map`. It is also the limit: this deduplicates within a
render and is not a data cache between requests.

**★ What is `cacheSignal` for?**
Knowing when the cache's lifetime is over. It returns an `AbortSignal` that aborts when
React has completed rendering, when the render was aborted, or when it failed — so
in-flight work belonging to a render React has thrown away can be cancelled instead of
holding connections for a response nobody will read. Since `fetch` takes an `AbortSignal`,
wiring it in is a single argument.

**When does `cacheSignal()` return `null`, and why is that the design?**
Outside rendering, and always in Client Components — where the docs say it may be used in
future when a client cache refreshes. Returning `null` rather than a signal that never
aborts is deliberate: it makes it obvious the current scope is not cached forever, instead
of handing you something that looks correct and never fires.

**Does `cache` cache failures?**
Yes — an error thrown for particular arguments is cached and the same error is re-thrown
for those arguments. That keeps every component's answer consistent within a render, and
it means retrying belongs above the cached function rather than inside it.

---

← Prev: [`use(context)`](12-use-context.md) ·
Index: [Phase 8](README.md) ·
Next → [`<Activity>`](14-activity.md)
