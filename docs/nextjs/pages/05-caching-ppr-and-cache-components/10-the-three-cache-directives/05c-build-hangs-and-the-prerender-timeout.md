---
title: "A build that hangs and a build that fails instantly are two different bugs, and the error you get tells you which"
sidebar_label: "5c · Build hangs and the prerender timeout"
sidebar_position: 12
description: "The 50-second cache-fill timeout, the three ways a runtime Promise crosses into a cached scope, and how to tell a timeout apart from next-request-in-use-cache."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js API reference for
> [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache)
> (page header `version: 16.3.4`, `lastUpdated: 2026-08-25`), sections *Build Hangs (Cache
> Timeout)* and *Request-time APIs*.
> Target: **Next.js 16.3.4**, App Router, Cache Components. Documentation-verified; **no sandbox run** — the error text below is quoted from the documentation, not from a build that was run here.
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs · session d2e9b9fe

**Two failures live in the same neighbourhood and get diagnosed as each other constantly: a
cached scope that reads request data *directly*, which fails at once, and a cached scope that
awaits a Promise carrying request data *indirectly*, which hangs and then times out.** The
first is a one-line fix at the call site. The second is a hunt for where a Promise crossed a
boundary. The distinguishing evidence is free: one of them produces an error immediately, the
other produces roughly fifty seconds of nothing. This chunk is the timeout half; the lifetime
rules that surround it are [chunk 5](05-revalidation-and-lifetimes.md).

## The 50-second prerender timeout

If a build hangs, the cause is a cached scope awaiting a Promise that resolves to uncached or
runtime data created **outside** the cache boundary. It cannot resolve during the build, and
the fill times out after **50 seconds**.

> *"If your build hangs, you're accessing Promises that resolve to uncached or runtime data,
> created outside a `use cache` boundary. The cached function waits for data that can't resolve
> during the build, causing a timeout after 50 seconds."*
> — [`use cache` › Build Hangs (Cache Timeout)](https://nextjs.org/docs/app/api-reference/directives/use-cache)

The message, quoted from the documentation rather than from a build run here:

> *"Error: Filling a cache during prerender timed out, likely because request-specific
> arguments such as params, searchParams, cookies() or uncached data were used inside "use
> cache"."*

Note what the message does **not** tell you: which cached scope, or which Promise. It names the
category and leaves you the search. That is why knowing the three shapes below is worth more
than the error text.

## Three ways it happens

> *"Common ways this happens: passing such Promises as props, accessing them via closure, or
> retrieving them from shared storage (Maps)."*

**1 · Passing a runtime Promise as a prop**

```tsx
async function Dynamic() {
  const cookieStore = cookies()          // not awaited
  return <Cached promise={cookieStore} /> // build hangs
}

async function Cached({ promise }: { promise: Promise<unknown> }) {
  'use cache'
  const data = await promise             // waits for runtime data during build
  return <p>..</p>
}
```

Await the store in `Dynamic` and pass a **value** into `Cached`. The documentation's own
instruction is exactly that: *"Await the `cookies` store in the `Dynamic` component, and pass a
cookie value to the `Cached` component."*

**2 · Reaching it through a closure** — the same problem with the Promise captured rather than
passed. Nothing in the signature of the cached function shows it, which is what makes this the
hardest of the three to find. It is also the mirror image of the cache-key rule in
[chunk 1c](01c-slots-and-cache-keys.md): a captured variable is bound as an argument, so a
captured *Promise* is awaited as one.

**3 · Retrieving it from shared storage**

```tsx
const cache = new Map<string, Promise<string>>()

async function Dynamic({ id }: { id: string }) {
  cache.set(id, fetch(`https://api.example.com/${id}`).then((r) => r.text()))
  return <p>Dynamic</p>
}

async function Cached({ id }: { id: string }) {
  'use cache'
  return <p>{await cache.get(id)}</p>    // build hangs
}
```

The cached function's arguments are entirely serializable here — `id` is a string — and it
still hangs, because the Promise arrived through the module scope. The documented remedy is to
*"use Next.js's built-in `fetch()` deduplication or use separate Maps for cached and uncached
contexts."*

## The other failure: an immediate error

🔴 **Directly calling `cookies()` or `headers()` inside `use cache` fails immediately with
`next-request-in-use-cache` — a different error, not a timeout.**

> *"Directly calling `cookies()` or `headers()` inside `use cache` fails immediately with a
> different error, not a timeout."*
> — [`use cache` › Build Hangs (Cache Timeout)](https://nextjs.org/docs/app/api-reference/directives/use-cache)

A hang means an *indirect* dependency on runtime data; an immediate failure means a direct
read. The two have different fixes, and the error you get tells you which you have.

There is a third timing to keep straight, from [chunk 1](01-choosing-a-directive.md): on a
**dynamically rendered** route the direct read is not reached during the build at all, so it
neither hangs nor fails there — it passes `next build` and throws under `next start`. So:

| What you observe | What it means |
|---|---|
| Immediate `next-request-in-use-cache` **during the build** | A direct request-API read in a scope the build prerenders |
| Build sits, then fails at ~50 seconds | A Promise carrying runtime or uncached data crossed into a cached scope |
| Build green, route 500s in production | A direct request-API read on a route that is only rendered at request time |

## Draft Mode is the one runtime read that is allowed

Worth knowing before you go hunting, because it looks like a violation and is not:

> *"You can read `isEnabled` from `draftMode()` inside a `use cache` scope, however, other
> runtime APIs like `cookies()` and `headers()` are not allowed, even when Draft Mode is
> active."*
> — [`use cache` › Draft Mode](https://nextjs.org/docs/app/api-reference/directives/use-cache)

Calling `enable()` or `disable()` inside a caching directive scope does throw, though — those
belong in a Route Handler or a Server Action.

## Gotchas

### Reading a build hang as a slow build

**Symptom.** The build sits still, then fails after roughly 50 seconds.

**Cause.** A cached scope is awaiting a Promise for runtime or uncached data created outside
the boundary — passed as a prop, captured in a closure, or fetched from a shared Map.

**Fix.** Resolve the Promise **outside** the cached scope and pass the resulting value in.

### Confusing the timeout with the direct-read error

**Symptom.** You search for the wrong problem.

**Cause.** Two distinct failures. A direct `cookies()`/`headers()` call inside `use cache`
fails **immediately** with `next-request-in-use-cache`. An indirect dependency on runtime data
**hangs and times out** after 50 seconds.

**Fix.** Read the error. Immediate → find the direct read. Timeout → find the Promise crossing
the boundary.

### Using a shared `Map` to deduplicate across cached and uncached code

**Symptom.** Intermittent build hangs that depend on render order.

**Cause.** The Map hands a dynamic Promise to cached code, which then awaits something that
cannot resolve at build time.

**Fix.** Use `fetch` deduplication, or keep cached and uncached contexts in separate stores.

### Auditing arguments and concluding the cached function is clean

**Symptom.** Every argument to the cached function is a string or a plain object, and it still
hangs.

**Cause.** Two of the three routes in do not go through the parameter list at all — a closure
capture and a module-scope Map both reach into the cached scope invisibly.

**Fix.** Audit what the function *awaits*, not what it *accepts*. Anything awaited that was not
created inside the cache boundary is a suspect.

### Adding `await` to the wrong side of the boundary

**Symptom.** You await the Promise inside the cached function to "resolve it first", and the
hang does not move.

**Cause.** Awaiting inside the boundary is exactly what hangs. The Promise cannot resolve
during prerendering wherever it is awaited from inside a cached scope.

**Fix.** Await it in the uncached component and pass the resolved value across — the value is
serializable, the Promise is a trap.

### Assuming a green build means no cached scope reads request data

**Symptom.** CI passes for weeks; the failure arrives with the first production request to a
dynamic route.

**Cause.** Nothing forces a dynamically rendered route's code path to run during the build.

**Fix.** Treat dynamic routes as unverified by the build. Exercise them against a production
build before shipping, and prefer hoisting request reads to the component boundary where the
constraint is visible in the source.

## Interview questions

**★ A build hangs and fails after ~50 seconds. What is happening?**
A cached scope is awaiting a Promise that resolves to runtime or uncached data created outside
the cache boundary, so it cannot resolve during prerendering.

**★ How do you tell that apart from a direct request-API read?**
A direct `cookies()`/`headers()` call inside `use cache` fails **immediately** with
`next-request-in-use-cache`. The indirect case **times out**.

**★ Three ways a runtime Promise reaches a cached scope?**
Passed as a prop, captured through a closure, or retrieved from shared storage such as a Map.

**★ Why is the closure case the hardest to find?**
Because nothing in the cached function's signature reveals it. Its arguments can all be
serializable strings while the Promise it awaits arrived from an enclosing scope.

**★ Does a green `next build` prove no cached scope reads request data?**
No. On a dynamically rendered route the read is only reached when the route runs, so the build
never exercises it and the failure surfaces under `next start`.

**★ Which runtime API may be read inside `use cache`?**
`draftMode()` — specifically `isEnabled`. `cookies()` and `headers()` remain banned even while
Draft Mode is active, and calling `enable()` or `disable()` inside a cache scope throws.

**★ What is the documented fix for a shared `Map` that hands Promises to cached code?**
Use the built-in `fetch` deduplication instead, or keep separate Maps for cached and uncached
contexts so a dynamic Promise can never be read from inside a cache boundary.

---

**Previous:** [5b · `revalidateTag` vs `updateTag`](05b-revalidatetag-and-updatetag.md)
