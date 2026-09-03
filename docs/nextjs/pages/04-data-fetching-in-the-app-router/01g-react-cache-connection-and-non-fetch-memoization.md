---
title: "`React.cache()` is the memoization primitive for everything Next.js did not patch — and it compares arguments with shallow `Object.is` equality, which means an object literal at the call site guarantees a miss every single time"
sidebar_label: "01g · React.cache and connection"
sidebar_position: 1.1
description: "Deduplicating ORM and database work with React.cache(): the argument-identity rule, why calling cache() in the wrong place creates a fresh table, cached errors, the preload pattern, and how connection() interacts with all of it."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [`cache`](https://react.dev/reference/react/cache) on react.dev, [Fetching Data · Reusing data with React.cache](https://nextjs.org/docs/app/getting-started/fetching-data) (docs `lastUpdated` 2026-08-25) and [`connection`](https://nextjs.org/docs/app/api-reference/functions/connection) (`lastUpdated` 2026-06-25).
> Target: **Next.js 16.3.4**, **React 19.2.8**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**Next.js patched `fetch`. It did not patch Prisma, Drizzle, `pg`, `better-sqlite3`, the AWS SDK, your Redis client or the `stripe` package. Everything covered in [01](01-fetch-in-server-components-automatic-request-deduplication.md) — the automatic, invisible collapsing of identical calls in one render — stops at the edge of `fetch`, and for most production applications the majority of the data comes from the other side of that edge. `React.cache()` is the primitive that closes the gap, and it has exactly two rules people get wrong: where you are allowed to call `cache()` itself, and how it compares the arguments you pass the function it returns. Both failures produce the same symptom — the query runs every time — and neither produces an error.**

## The gap, concretely

```tsx
// app/orgs/[id]/layout.tsx
const org = await db.org.findUnique({ where: { id } })

// app/orgs/[id]/page.tsx
const org = await db.org.findUnique({ where: { id } })
```

Two `SELECT`s. Next.js has no idea these are the same query — there is no URL, no method, no options object, nothing to key on, and no patched function in the path. The documentation's own ORM example is a bare `await db.select().from(posts)` inside a Server Component, with no deduplication claimed for it anywhere.

## `cache(fn)` — the shape

```ts
// lib/orgs.ts — module scope, exported once, imported everywhere
import { cache } from 'react'
import { db } from '@/lib/db'

export const getOrg = cache(async (orgId: string) => {
  const org = await db.org.findUnique({
    where: { id: orgId },
    include: { plan: true },
  })
  if (!org) throw new Error(`org ${orgId} not found`)
  return org
})
```

Every Server Component in the request that calls `getOrg('acme')` gets the same result, and the query runs once. React's own description of the mechanism: on call, it checks for a cached result for those arguments; on a miss it calls `fn`, stores the result, and returns it.

Two constraints that come with it:

- **Server Components only.** `cache` is documented as being for Server Components. In a Client Component the call does not use the cache; `useMemo` is the Client Component tool, and it caches across renders of one component, not across components.
- **The cache is per request.** Next.js states it plainly: `React.cache` is scoped to the current request, with each request getting its own memoization scope and no sharing between requests. React states the same from its side — the cache is invalidated for all memoized functions on each server request. This is a deduplication tool, not a caching tool. If you want the result to survive to the next request, you want `use cache` or the Data Cache — [chapter 5](../05-caching-ppr-and-cache-components/01-explanation.md).

## The argument-identity rule, which is where it actually breaks

> *"React will use shallow equality of the arguments to determine if there is a cache hit."*

Shallow equality means `Object.is` on each argument. For strings, numbers, booleans and `null` that is exactly what you want. For an object, an array or a function it means **reference** identity — and a fresh object literal written at the call site is a new reference every time.

```ts
// 🔴 Never hits. Each caller constructs a new object, so Object.is is false.
export const getOrders = cache(async (filter: { userId: string; status: string }) => {
  return db.order.findMany({ where: filter })
})

// call site A
await getOrders({ userId, status: 'open' })
// call site B — identical fields, different reference, second query
await getOrders({ userId, status: 'open' })
```

There are two correct shapes, and the first is almost always the right one.

**Take primitives.** Reconstruct the object inside the memoized function, where it is created once per distinct key:

```ts
export const getOrders = cache(async (userId: string, status: string) => {
  return db.order.findMany({ where: { userId, status } })
})

await getOrders(userId, 'open') // hits on the second call, in any component
```

**Or hoist the object to a stable reference**, when the argument genuinely is a shared configuration rather than a key:

```ts
// The same reference is passed by every caller, so Object.is holds.
export const DEFAULT_SCOPE = { includeArchived: false, locale: 'en-GB' } as const

export const getProjects = cache(
  async (orgId: string, scope: typeof DEFAULT_SCOPE) => {
    return db.project.findMany({ where: { orgId, archived: scope.includeArchived } })
  }
)

await getProjects(orgId, DEFAULT_SCOPE)
```

The primitive form is better because it cannot be got wrong by a future caller. The hoisted-object form silently degrades the moment somebody spreads it — `{ ...DEFAULT_SCOPE }` is a new reference and a new query.

## Where you call `cache()` matters as much as what you pass it

React is explicit that each call to `cache` creates a new function, and two memoized functions produced from the same original do not share a cache. That makes the following a no-op with a convincing shape:

```tsx
// 🔴 A brand-new memoized function on every render of this component.
// The table is empty every time; nothing is ever reused.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const getUser = cache(async (id: string) => db.user.findUnique({ where: { id } }))
  const { id } = await params
  const user = await getUser(id)
  return <Profile user={user} />
}
```

And the same mistake, one level less obvious, inside a factory:

```ts
// 🔴 Every call to makeLoader() returns a memoized function with its own table.
export function makeLoader(db: Db) {
  return cache(async (id: string) => db.user.findUnique({ where: { id } }))
}
```

**The rule is: call `cache()` exactly once, at module scope, and export the result.** Sharing then happens by import, which is the only mechanism that guarantees every caller holds the same function reference.

```ts
// lib/users.ts
import { cache } from 'react'
import { db } from '@/lib/db'

export const getUser = cache(async (id: string) => db.user.findUnique({ where: { id } }))
```

React adds one more boundary worth knowing: calling a memoized function *outside* a component does not use the cache. In practice that means the value you get in a plain server-side helper invoked from a component is fine — it is on the render's stack — but a call made from module initialisation, or from code that is not running inside the render, is not.

## Errors are cached too

React documents this and it is not a corner case: if `fn` throws for certain arguments, the error is cached and re-thrown for the same arguments. Within a render pass this is a correctness property — every component sees the same failure rather than some seeing data and some seeing an error — and it is a trap for anyone who writes retries at the call site.

```ts
// 🔴 The second attempt gets the cached rejection back instantly. No retry happens.
try {
  return await getUser(id)
} catch {
  return await getUser(id)
}
```

Put the retry inside the boundary that is memoized, so the memo table holds the outcome of the whole attempt sequence:

```ts
import { cache } from 'react'
import { db } from '@/lib/db'

async function loadUser(id: string, attempts = 3) {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await db.user.findUnique({ where: { id } })
    } catch (error) {
      lastError = error
      await new Promise((r) => setTimeout(r, 2 ** i * 50))
    }
  }
  throw lastError
}

export const getUser = cache(loadUser)
```

Note `cache(loadUser)` rather than `cache((id) => loadUser(id))`: the default parameter `attempts` is preserved, and callers pass one argument, so `Object.is` compares one string.

Because `cache` stores the *result* of calling `fn` — and for an async function that result is the pending promise, not the resolved value — a memoized loader can also be used to start work early and await it much deeper in the tree. That belongs with the shape of the call site: [01i](01i-co-location-preloading-and-where-the-fetch-call-belongs.md).

## `connection()` — where the render stops being a prerender

`React.cache()` says "do this once per request". `connection()` says "do not do this until there *is* a request". They solve adjacent problems and get confused with each other.

```ts
// app/lib/data.ts
import { connection } from 'next/server'
import Database from 'better-sqlite3'

const db = new Database('app.db')

export async function getVisitorCount() {
  await connection()
  return db.prepare('SELECT value FROM counters WHERE name = ?').get('visitors')
}
```

The problem it solves is specific: a **synchronous** database driver completes during prerendering, so a component that reads it produces a build-time snapshot with nothing to signal that it should not have. The same applies to `Math.random()` and `new Date()` — output that must differ per request but reads nothing request-scoped. `connection()` returns a `Promise<void>` that is not meant to be consumed; awaiting it is the whole API. Everything after it runs only at request time, and every component that calls the function is excluded from prerendering along with the rest of its output.

Three facts to keep straight:

- It **replaces `unstable_noStore()`**, which the docs describe as the alignment reason. Stabilised in `v15.0.0`.
- It is only needed when dynamic rendering is required **and** the common Request-time APIs are not used. If you already `await cookies()` or `await headers()`, the route is request-time anyway and `connection()` adds nothing.
- Under Cache Components, the docs direct you to [`io()`](https://nextjs.org/docs/app/api-reference/functions/io) instead for excluding content from the static shell — it works the same way but can also be cached and prefetched. `connection()` is for when rendering genuinely must wait for a real user request.

Memoization does not stop at `connection()`, and `connection()` does not clear a memo table. They compose: `cache(async (id) => { await connection(); return db.get(id) })` runs the query once per request, at request time. What `connection()` stops is *prerendering*, which is a rendering-mode decision and belongs with [03](03-static-vs-dynamic-rendering-force-dynamic-force-static-reval.md).

## Gotchas

**★ Symptom: you wrapped the query in `React.cache()` and the database still shows one query per component.** Cause: the memoized function takes an object, and each call site builds a fresh object literal, so shallow `Object.is` equality never matches. Fix: take primitives and build the object inside.

```ts
// before: cache(async (where: { userId: string }) => db.order.findMany({ where }))
export const getOrders = cache(async (userId: string) =>
  db.order.findMany({ where: { userId } })
)
```

**★ Symptom: `cache()` appears to do nothing at all, and every call is a miss.** Cause: `cache()` is being called inside a component, a hook, a factory or a request handler, so a new memoized function — with a new, empty table — is created each time. Each call to `cache` creates a new function, and two of them never share a table. Fix: one `cache()` call at module scope, exported.

```ts
// lib/users.ts — created once when the module is first evaluated
export const getUser = cache(async (id: string) => db.user.findUnique({ where: { id } }))
```

**★ Symptom: a transient database error takes down every component in the render, and your retry never runs.** Cause: `cachedFn` caches errors; the same error is re-thrown for the same arguments. A `catch` at the call site that calls the loader again gets the cached rejection. Fix: retry inside the function you memoize, as shown above.

**★ Symptom: `React.cache()` in a Client Component compiles fine and deduplicates nothing.** Cause: `cache` is for Server Components only. There is no per-request server scope in the browser for it to key against. Fix: pass the promise down from a Server Component and read it with `use()`, or use a client data library.

```tsx
// app/dashboard/page.tsx (Server Component)
import { Suspense } from 'react'
import { StatsChart } from './stats-chart'
import { getStats } from '@/lib/stats'

export default function Dashboard() {
  const statsPromise = getStats() // not awaited here
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <StatsChart dataPromise={statsPromise} />
    </Suspense>
  )
}
```

**Symptom: deduplication worked, then someone added a `{ ...options }` spread at one call site and the query count went back up.** Cause: spreading produces a new object reference, defeating `Object.is`. Fix: do not accept objects as cache keys at all — the primitive-argument form cannot be broken this way.

**Symptom: `React.cache()` is treated as the app's caching layer and production load never drops.** Cause: it is scoped to the current request; each request gets its own memoization scope with no sharing between requests. It deduplicates within one render, it does not cache across requests. Fix: if you want cross-request reuse of a non-`fetch` result, that is `use cache` with a `cacheLife` profile — [chapter 5](../05-caching-ppr-and-cache-components/01-explanation.md).

**Symptom: a page shows the same random value or timestamp to every visitor after deploying.** Cause: nothing on the route reads a Request-time API, so the route prerendered at build and `Math.random()` / `new Date()` ran once, at build time. Fix: `await connection()` before the non-deterministic work.

```tsx
import { connection } from 'next/server'

export default async function Page() {
  await connection()
  return <span>{new Date().toISOString()}</span>
}
```

**Symptom: a `better-sqlite3` (or other synchronous driver) query returns build-time data in production.** Cause: synchronous drivers complete during prerendering, so there is nothing asynchronous for the framework to notice. Fix: `await connection()` at the top of the data function, not at the top of the page — then every component that calls it is excluded from prerendering.

**Symptom: you added `connection()` everywhere and lost all prerendering.** Cause: it is only necessary when dynamic rendering is required and Request-time APIs are not used; on a route that already awaits `cookies()` it is redundant, and on one that did not need to be dynamic it is a regression. Fix: remove it from any function whose output does not actually have to differ per request, and under Cache Components reach for `io()` when you want the content excluded from the static shell but still cacheable and prefetchable.

## Interview questions

**★ Why does `React.cache()` exist when `fetch` is already deduplicated?**
Because `fetch` deduplication is a Next.js patch on one global function, and most production data does not come through it. Prisma, Drizzle, `pg`, Redis, S3 and every vendor SDK are ordinary function calls with nothing for the framework to key on. `cache` is React's own request-scoped memoization primitive and works for any function, which is why the `fetch` behaviour can be described as an instance of the same idea rather than a separate feature.

**★ Your memoized loader still runs once per component. What are the two things to check, in order?**
First, where `cache()` was called. Each call to `cache` produces a new memoized function with its own table, so a `cache()` inside a component body, a hook or a factory creates a fresh, empty table on every render. It must be called once at module scope and shared by import. Second, the arguments. React compares them with shallow equality via `Object.is`, so any object, array or function argument built at the call site is a new reference and a guaranteed miss. Between them these two account for nearly every "cache does nothing" report.

**★ What happens when the memoized function throws?**
The error is cached and re-thrown for the same arguments for the rest of the request. Within one render that is the behaviour you want — every component sees the same failure and the page does not show a half-succeeded state. It breaks call-site retry logic, though: catching the rejection and calling the loader again returns the cached rejection immediately. Retries must live inside the function being memoized.

**How is `React.cache()` different from `useMemo`?**
`useMemo` is a Client Component hook that caches an expensive computation across renders of one component instance, keyed on a dependency array, and it is a performance hint React may discard. `cache` is a Server Component utility that shares one result across *different components* within a single server request, keyed on the arguments, and is invalidated for every memoized function at the end of each request. Different scope, different key, different lifetime, and they are not substitutes for one another.

**Is `React.cache()` a cache?**
Not in the sense anyone means when they ask for caching. It is scoped to the current request; each request gets a fresh memoization scope with nothing shared between them. If your load-reduction plan is `React.cache()`, your origin still takes one query per request per distinct key, which is exactly what it took before. Cross-request reuse is `use cache`, a `cacheLife` profile, or the Data Cache — a different chapter and a different set of trade-offs.

**★ What problem does `connection()` solve that `cookies()` does not?**
`cookies()` makes a route request-time as a side effect of reading something request-scoped. `connection()` makes it request-time *deliberately*, for code that reads nothing request-scoped but must still produce different output per request — `Math.random()`, `new Date()`, or a synchronous database driver whose query would otherwise simply complete during prerendering. It is documented as only necessary when dynamic rendering is required and the common Request-time APIs are not in use, which is the test for whether it is doing anything for you.

**Why would a `better-sqlite3` query need `connection()` when a Postgres query does not?**
Because it is synchronous. Prerendering does not stall on it — the statement executes and returns during the build, and the resulting value is baked into the prerendered output with nothing to indicate it should not have been. An asynchronous driver's I/O gives the framework something to notice. The documented remedy is to call `await connection()` inside the data function itself, so every component calling it inherits the exclusion from prerendering.

**Where does `connection()` sit relative to Cache Components?**
The docs steer you toward `io()` under Cache Components for the case of excluding content from the static shell — it behaves the same way but can additionally be cached and prefetched. `connection()` remains the right call only when rendering genuinely should wait for a real incoming user request. It also replaces `unstable_noStore()`, which is the migration most existing codebases are actually looking for.

---

← [01 · fetch and deduplication](01-fetch-in-server-components-automatic-request-deduplication.md) · Next → [01h · parallel and sequential fetching](01h-parallel-and-sequential-fetching-and-the-shape-of-a-route.md)
