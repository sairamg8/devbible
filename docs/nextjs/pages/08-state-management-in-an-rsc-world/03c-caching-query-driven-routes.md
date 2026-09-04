---
title: "A cached function cannot read the request, so query-driven caching is a two-layer split: an uncached component extracts the values and a use cache function takes them as arguments, which is what makes them the cache key"
sidebar_label: "03c · Caching query-driven routes"
sidebar_position: 121
description: "How use cache keys on extracted searchParams values, why the in-memory default betrays you on serverless, what use cache: remote and use cache: private each change, and how to choose a cache key by cardinality and ownership."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Caching](https://nextjs.org/docs/app/getting-started/caching) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8**. Cache Components (`cacheComponents: true`) assumed throughout.
> Documentation-verified; **no sandbox run**.

**Pushing the `await` into a leaf restores the static shell but does nothing for the database: every request still runs the query. The next move is to give the query-derived data a lifetime, and it has a shape you cannot improvise, because a `use cache` function has no request to read from. The pattern is a two-layer split — an uncached component awaits `searchParams` and extracts the values, then calls a cached function with those values as arguments, which is what makes them the cache key. Get it wrong in one direction and you get a build error; get it wrong in the other and you get an unbounded cache, or one user's board served to another.**

## The two-layer split

```tsx filename="app/[tenant]/board/task-list.tsx"
async function TaskList({
  searchParams,
}: Pick<PageProps<'/[tenant]/board'>, 'searchParams'>) {
  const { status = 'open', sort = 'age' } = await searchParams   // uncached layer
  const tasks = await queryTasks(status, sort)
  return <TaskTable tasks={tasks} />
}

async function queryTasks(
  status: string | string[] | undefined,
  sort: string | string[] | undefined,
) {
  'use cache'                                                     // cached layer
  return db.tasks.list({ status, sort })
}
```

> *"You can extract values from runtime APIs and pass them as arguments to cached functions"*
> — [Caching, Passing runtime values to cached functions](https://nextjs.org/docs/app/getting-started/caching#passing-runtime-values-to-cached-functions)

> *"`sessionId` becomes part of the cache key"*
> — same section, on the equivalent `cookies()` example

> *"At request time, `<CachedContent />` executes if no matching cache entry is found, and stores the result for future requests with the same `sessionId`."*
> — same section

**Only the value crosses the boundary, never the request.** `queryTasks` cannot call `cookies()`, `headers()` or read `searchParams`; it is a cached function and there is no request in scope. If the result depends on who is asking, that identity must be an argument too — and then it is part of the key, which is a design decision with a memory cost and a security consequence, not a formality.

The docs' own search example is worth reading in full because it composes the shell fix and the cache fix in one file:

```tsx filename="app/search/page.tsx"
import { Suspense } from 'react'

export default function SearchPage(props: PageProps<'/search'>) {
  return (
    <Suspense fallback={<p>Loading results...</p>}>
      <Results searchParams={props.searchParams} />
    </Suspense>
  )
}

async function Results({
  searchParams,
}: Pick<PageProps<'/search'>, 'searchParams'>) {
  const { q } = await searchParams
  const results = await search(q)
  return (
    <ul>
      {results.map((result) => (
        <li key={result.id}>{result.title}</li>
      ))}
    </ul>
  )
}

async function search(query: string | string[] | undefined) {
  'use cache'
  return db.search(query)
}
```

— reproduced from [Caching, Prefetching](https://nextjs.org/docs/app/getting-started/caching#prefetching).

## The in-memory default is the trap

Adding `'use cache'` and seeing no change in database load is the most common disappointment here, and the docs explain it in one sentence:

> *"Because `<CachedContent />` is gated behind request data, it isn't added to the prerendered static shell. At runtime it's cached in-memory by default, which doesn't persist across serverless requests, so it may re-evaluate on each request. Reach for `'use cache: remote'` for durable, shared caching."*
> — [Caching, Passing runtime values to cached functions](https://nextjs.org/docs/app/getting-started/caching#passing-runtime-values-to-cached-functions)

Two facts in that sentence, both load-bearing:

1. **A cached function gated behind request data is not in the static shell.** It cannot be — its arguments do not exist until the request does. `use cache` bought you a lifetime, not a prerender. The shell fix and the cache fix are independent; you need both.
2. **The default cache is in-memory, so on serverless it is per-instance.** A fresh instance is a cold cache. If the goal was "stop hitting the database", the durable variant is what does that:

```ts filename="app/[tenant]/board/queries.ts"
export async function queryTasks(status: string, sort: string) {
  'use cache: remote'
  return db.tasks.list({ status, sort })
}
```

## The third variant: `use cache: private`

There is a directive that reads runtime data *directly* and still gets a lifetime:

> *"Runtime-dependent data can still be given a cache lifetime with `"use cache: private"`, another variant that ships with Cache Components. It gives a lifetime to a function that reads cookies, headers, or `searchParams` directly, so it can be included in a prefetch."*
> — [Caching, Working with runtime APIs](https://nextjs.org/docs/app/getting-started/caching#working-with-runtime-apis)

> *"`use cache: private` executes on the server, reads runtime data directly, and caches the result in the browser as part of the per-link prefetch"*
> — [Caching, Prefetching](https://nextjs.org/docs/app/getting-started/caching#prefetching)

The choice between the three is not stylistic:

| Variant | Reads the request? | Where the result lives | Use it when |
|---|---|---|---|
| `use cache` | No — arguments only | Server-side cache, in-memory by default | The value is enumerable and shared between users |
| `use cache: remote` | No — arguments only | Durable, shared store | Same, but it must survive across instances |
| `use cache: private` | Yes, directly | The requesting browser, via the per-link prefetch | The result is specific to this user and must not be shared |

The word *private* is the guarantee: it caches **in the browser**, so a per-user result cannot be handed to a different user by a shared cache. The trade is that nothing is shared, so there is no cross-user hit rate to win.

## Choosing the cache key

The argument list *is* the key, which makes cardinality your problem.

| Dimension | Distinct values | Cache it? |
|---|---|---|
| `status` (`open`/`blocked`/`done`/`archived`) | 4 | ✅ |
| `sort` (`age`/`priority`/`title`) × direction | 6 | ✅ |
| `page` (offset) | bounded by dataset size | ✅ with a short lifetime |
| `q` (free-text search) | unbounded — one per keystroke, per user | ❌ |
| `assignee` (user id) | one per member of the workspace | ⚠️ fine at 30 people, not at 30,000 |

A free-text query as a cache key mints an entry per distinct string anyone has ever typed, and the hit rate approaches zero while memory approaches infinity. Split it: cache the enumerable scope, run the text search uncached against that scope.

```tsx filename="app/[tenant]/board/task-list.tsx"
async function TaskList({ searchParams }: Pick<PageProps<'/[tenant]/board'>, 'searchParams'>) {
  const { q, status = 'open' } = await searchParams
  const scope = await cachedScope(status)                  // 4 keys, cached
  const tasks = await db.tasks.search(q, scope)            // free text, uncached
  return <TaskTable tasks={tasks} />
}

async function cachedScope(status: string | string[] | undefined) {
  'use cache'
  return db.scopes.resolve(status)
}
```

## Gotchas

**★ Symptom: a `use cache` function that reads `searchParams` fails.** Cause: `searchParams` is request-time data and a cached function has no request to read from. Fix: extract the value in the *uncached* caller and pass it as an argument, so it becomes part of the cache key.

```tsx
async function Results({ searchParams }: Pick<PageProps<'/board'>, 'searchParams'>) {
  const { q } = await searchParams          // uncached — reads the request
  return <List rows={await search(q)} />
}

async function search(q: string | string[] | undefined) {
  'use cache'                                // cached — receives only the value
  return db.tasks.search(q)
}
```

**★ Symptom: you added `'use cache'` and database load did not move on your serverless host.** Cause: the function is gated behind request data, so it is not in the shell, and its default cache is in-memory — which does not persist across serverless requests. Fix: make the cache durable.

```ts
async function search(q: string | undefined) {
  'use cache: remote'
  return db.tasks.search(q)
}
```

**★ Symptom: memory grows without bound after caching the search.** Cause: the free-text query is the cache key and its cardinality is unbounded. Fix: cache only the enumerable dimensions and run the text search uncached against the cached scope.

```tsx
const scope = await cachedScope(status)          // ✅ 4 keys
const tasks = await db.tasks.search(q, scope)    // ✅ never keyed on q
```

**★ Symptom: two users see each other's data on a page you cached "for performance".** Cause: you extracted a per-user value into a `use cache` function without including the user identity in the arguments, so one user's result was stored under a key that did not distinguish them. Fix: either make identity part of the key, or use the variant that caches in the browser instead of on the server.

```ts
// ✅ identity is part of the key
async function myTasks(userId: string, status: string) {
  'use cache'
  return db.tasks.list({ userId, status })
}

// ✅ or: read the request directly, cache the result in this browser only
async function myTasksPrivate(status: string) {
  'use cache: private'
  const session = (await cookies()).get('session')?.value
  return db.tasks.list({ session, status })
}
```

**★ Symptom: the cached component still runs on every request in production, but the cache "works" locally.** Cause: local development runs a single long-lived process, so the in-memory cache appears to persist; a serverless deployment spreads requests across instances that each start cold. Fix: never validate a cache in dev. Move it to `'use cache: remote'` if the requirement is durability, and treat the in-memory default as a per-render deduplication tool rather than a cache.

**★ Symptom: a normalised value and a raw value produce two cache entries for the same logical filter.** Cause: the key is the argument list, verbatim — `'open'` and `['open']` are different arguments even though your code treats them identically. Fix: normalise *before* the cached call, never inside it.

```tsx
const status = Array.isArray(raw.status) ? raw.status[0] : raw.status ?? 'open'
const tasks = await queryTasks(status)   // ✅ one key per logical filter
```

## Interview questions

**★ How does `use cache` interact with a query-string-driven page?**
A cached function cannot read request-time APIs, so it cannot read `searchParams`. The pattern is a two-layer split: an uncached component awaits `searchParams` and extracts the values, then calls a `'use cache'` function passing those values as arguments, which makes them part of the cache key. That gives you a per-filter-combination cache without the cached function ever touching the request. Two caveats follow immediately: such a function is gated behind request data so it is not in the static shell, and its default in-memory cache does not survive across serverless instances, which is what `'use cache: remote'` fixes.

**★ When would you use `use cache: private` instead of passing the value as an argument?**
When the result is specific to one user and must never be served to another. `use cache` with an extracted argument caches on the server keyed by that argument — correct, but it means a per-user entry on shared infrastructure, and a mistake in the key is a data leak with a blast radius the size of your traffic. `use cache: private` executes on the server, reads cookies, headers or `searchParams` directly, and caches the result **in that browser** as part of the per-link prefetch, so a key mistake affects one browser. The trade is that nothing is shared and there is no cross-user hit rate to win.

**★ How do you choose what goes in the cache key?**
By cardinality and by ownership. Enumerable dimensions — status, sort, direction, page — are good keys: a handful of entries, high hit rate, shared across all users. Unbounded dimensions — free text, timestamps, anything derived from a keystroke — are bad keys, because you mint an entry per distinct value while the hit rate approaches zero. And anything identifying a user must either be in the key deliberately, accepting a per-user entry, or handled by `use cache: private`; the failure mode of getting that wrong is not a slow page but one user seeing another's data.

**★ Does `use cache` also fix the static shell problem?**
No, and conflating the two is the most common misreading of the caching guide. The shell problem is about *where in the tree* the request-time read happens, and it is fixed by making the page synchronous and putting the `await` behind a `Suspense` boundary. The cache problem is about *how often the query runs*, and it is fixed by giving the derived data a lifetime. A cached function gated behind request data is explicitly not added to the prerendered shell, so caching alone leaves you with a shell-less page that happens to be fast on a warm instance. You want both fixes, and they are independent.

**★ Your cache works perfectly in development and does nothing in production. Why?**
Because the default `use cache` store is in-memory, and development is one long-lived process while production is many short-lived ones. Locally, every request hits the same warm map; on serverless, each instance starts cold and the entry you wrote in the previous request may be on a machine that no longer exists. The in-memory default is best understood as request-scoped-to-instance-scoped deduplication rather than a cache you can plan capacity around. `'use cache: remote'` is the variant with durable, shared semantics, and it is the one to reach for the moment the requirement is expressed as a hit rate.

---

← [03b · URL state and the static shell](03b-url-as-state-and-the-static-shell.md) · [Chapter 8 overview](01-explanation.md) · Next → [03d · Prefetching query-driven routes, and opting out](03d-prefetching-query-driven-routes-and-opting-out.md)
