---
title: "A cache handler is five methods, and three of them fail in ways the type signature does not warn you about"
sidebar_label: "3c · Writing a cache handler"
sidebar_position: 7
description: "The CacheHandler interface, why set receives a promise, the three meanings of getExpiration's return value, soft tags and revalidatePath, and the asymmetry between a failing get and a failing set."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js API reference for
> [`cacheHandlers`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers)
> (page header `version: 16.3.4`, `lastUpdated: 2026-08-25`), sections *API Reference*,
> *CacheEntry Type*, *Soft Tags*, *Handling Streams* and *Error Handling*.
> Target: **Next.js 16.3.4**, App Router, Cache Components. Documentation-verified; **no sandbox run** — no handler was executed to produce any statement below.
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs · session d2e9b9fe

**If you self-host and want `use cache: remote` to mean anything, somebody has to write the
handler — and the interface is small enough to look obvious and subtle enough to get wrong
four different ways.** `set` is handed a promise, not a value. `getExpiration` has a return
value that is a mode switch rather than data. `get` is the only method the framework does not
catch exceptions from, so a bad minute in Redis is the difference between a cache miss and a
500. And the entry's payload is a one-shot stream. This chunk is the interface and those four
edges. Configuring which slot the handler fills is [chunk 3b](03b-configuring-cache-handlers.md).

## The interface

A handler is a module exporting five methods.

| Method | Signature | What it is for |
|---|---|---|
| `get` | `get(cacheKey: string, softTags: string[]): Promise<CacheEntry \| undefined>` | Return the entry, or `undefined` for miss/expired |
| `set` | `set(cacheKey: string, pendingEntry: Promise<CacheEntry>): Promise<void>` | Store it — **await the promise first** |
| `refreshTags` | `refreshTags(): Promise<void>` | Sync tag state from an external service before a request |
| `getExpiration` | `getExpiration(tags: string[]): Promise<number>` | Most recent revalidation timestamp across those tags |
| `updateTags` | `updateTags(tags: string[], durations?: { expire?: number }): Promise<void>` | Mark tags invalidated |

`refreshTags` is the only one with a documented licence to do nothing:

> *"Called periodically before starting a new request to sync with external tag services. …
> For in-memory caches, this can be a no-op."*

The other four all carry a trap.

## `set` receives a promise, because rendering has not finished

> *"The entry may still be pending when this is called (i.e., its value stream may still be
> written to). Your handler should await the promise before processing the entry."*

```js filename="cache-handlers/handler.js"
async set(cacheKey, pendingEntry) {
  const entry = await pendingEntry   // not optional
  cache.set(cacheKey, entry)
}
```

The documented in-memory example goes further and tracks pending sets, so a `get` arriving
mid-write waits rather than reporting a miss:

```js filename="cache-handlers/memory-handler.js"
const cache = new Map()
const pendingSets = new Map()

module.exports = {
  async get(cacheKey, softTags) {
    const pendingPromise = pendingSets.get(cacheKey)
    if (pendingPromise) {
      await pendingPromise
    }
    const entry = cache.get(cacheKey)
    if (!entry) return undefined
    if (Date.now() > entry.timestamp + entry.revalidate * 1000) return undefined
    return entry
  },

  async set(cacheKey, pendingEntry) {
    let resolvePending
    const pendingPromise = new Promise((resolve) => {
      resolvePending = resolve
    })
    pendingSets.set(cacheKey, pendingPromise)
    try {
      cache.set(cacheKey, await pendingEntry)
    } finally {
      resolvePending()
      pendingSets.delete(cacheKey)
    }
  },
}
```

Without that bookkeeping, two concurrent requests for a cold key both miss and both render.

## `getExpiration` returns data, or a mode

Three return values, and the third is not a number you computed:

> *"`0` if none of the tags were ever revalidated"* · *"A timestamp (in milliseconds)
> representing the most recent revalidation"* · *"`Infinity` to indicate soft tags should be
> checked in the `get` method instead"*

Returning `0` is the legitimate answer for a handler that tracks no tag timestamps at all.
Returning `Infinity` is a contract with your own `get`: you are promising to do the soft-tag
check there yourself. Returning a stale timestamp because you forgot to update it in
`updateTags` is how invalidation silently stops working.

## `CacheEntry` is a stream, which changes how you store it

```ts
interface CacheEntry {
  value: ReadableStream<Uint8Array>
  tags: string[]
  stale: number
  timestamp: number
  expire: number
  revalidate: number
}
```

| Property | Meaning |
|---|---|
| `value` | The cached data as a stream |
| `tags` | Cache tags, **excluding soft tags** |
| `stale` | Client-side staleness, **seconds** |
| `timestamp` | When the entry was created, **milliseconds** |
| `expire` | How long the entry may be used, **seconds** |
| `revalidate` | How long until it should be revalidated, **seconds** |

`value` is a one-shot resource. You cannot store it and return it; reading it once consumes it.

> *"**Use `.tee()`** if you need to both store and return the stream. One branch goes to
> storage, the other is returned to the caller."*

> *"**Partial writes**: the stream may error partway through rendering. Your handler should
> decide whether to keep partial entries or discard them. Discarding is safer, as partial
> entries can produce incomplete pages."*

For external storage the stream has to be serialized both ways — read to bytes on `set`,
reconstructed as a `ReadableStream` on `get`. The documented Redis pattern base64-encodes the
concatenated chunks and stores the six fields as JSON, using the entry's `expire` as the Redis
TTL. The framework does not do any of that for you; a handler that stores the stream object
itself stores nothing usable.

## Soft tags, and why `revalidatePath` works at all

`revalidatePath` has no separate mechanism. It rides the tag system on tags Next.js generates
for you:

> *"Soft tags are implicit tags that Next.js automatically generates based on the route path.
> Every segment in the path gets a layout tag, plus the leaf route itself. For example, the
> route `/blog/hello` generates soft tags for `/layout`, `/blog/layout`, `/blog/hello/layout`,
> and `/blog/hello`. These tags are prefixed internally with `_N_T_`."*

They arrive as the second argument to `get`:

> *"Your handler should check whether any soft tag has been invalidated (via `getExpiration()`
> or direct timestamp comparison) after the cache entry's `timestamp`. If a soft tag was
> invalidated more recently than the entry was created, the entry should be treated as stale."*

A handler that ignores that argument still compiles, still caches, still passes a smoke
test — and silently makes `revalidatePath` a no-op against that store.

## Error handling is asymmetric between `get` and `set`

This is the part worth memorising, because the two failures have opposite blast radii:

> *"**`set()` failure**: the response is still served to the user because `set()` is called
> asynchronously after the response stream is already flowing. The cache entry is lost, and
> the next request triggers a fresh render."*

> *"**`get()` failure**: your handler should catch internal errors and return `undefined` (the
> "cache miss" signal). The framework does not wrap `get()` in a try/catch, so an unhandled
> exception from `get()` will propagate as a render error."*

A Redis outage in `set` costs you cache hits. The same outage in `get` takes the page down —
unless you wrote the try/catch.

```js filename="cache-handlers/remote-handler.js"
module.exports = {
  async get(cacheKey, softTags) {
    try {
      return await readFromStore(cacheKey, softTags)
    } catch {
      return undefined // a miss, not a 500
    }
  },
  // ...
}
```

The third documented rule closes the loop: *"if a cache entry is partially written and then
read, the behavior is undefined. Use atomic writes or a write-then-rename pattern to avoid
serving partial entries."*

## Gotchas

### A `get` that throws

**Symptom.** The cache backend has a bad minute and the route 500s instead of rendering fresh.

**Cause.** The framework does not wrap `get()` in a try/catch, so anything it throws
propagates as a render error. Every other method is forgiving; this one is not.

**Fix.** Catch everything inside `get` and return `undefined` — the miss signal — as in the
handler above. A cache that is down should degrade to no cache, never to no site.

### Storing the entry without awaiting `pendingEntry`

**Symptom.** Cached pages come back truncated, or the stored entry is empty.

**Cause.** `set` is handed a `Promise<CacheEntry>` whose value stream may still be being
written. Treating it as a value stores something that is not finished.

**Fix.** `const entry = await pendingEntry` before touching any field on it.

### Reading `value` twice

**Symptom.** The first request after a store gets an empty body, or the handler throws about a
locked stream.

**Cause.** `value` is a `ReadableStream`. Consuming it to serialize into Redis consumes it for
the caller too.

**Fix.** `.tee()` it: one branch to storage, one back to the framework.

### Ignoring `softTags` in `get`

**Symptom.** `revalidatePath('/blog/hello')` appears to do nothing against your handler while
`revalidateTag` works fine.

**Cause.** `revalidatePath` invalidates through the implicit `_N_T_`-prefixed path tags handed
to `get` as `softTags`. A handler that never checks them never notices the invalidation.

**Fix.** Compare the soft tags' invalidation timestamps against the entry's `timestamp` and
treat the entry as stale if any is newer — or return `Infinity` from `getExpiration` and do
that check inside `get` deliberately.

### Mixing seconds and milliseconds in an expiry check

**Symptom.** Entries expire instantly, or never.

**Cause.** `CacheEntry.timestamp` is milliseconds; `revalidate`, `expire` and `stale` are
seconds. The documented check is `now > entry.timestamp + entry.revalidate * 1000`.

**Fix.** Multiply. Every duration on the entry needs `* 1000` before it meets `Date.now()`.

### Keeping a partially written entry

**Symptom.** Users occasionally get a page that stops halfway through, and it is *sticky* —
the same broken page comes back until the entry expires.

**Cause.** The value stream can error partway through rendering. If your `set` stores what it
got, the truncation is now cached.

**Fix.** Discard partial entries — the documentation says discarding is safer — and use atomic
writes or write-then-rename so a reader never observes a half-written entry.

### A `updateTags` that forgets to touch the timestamps `getExpiration` reads

**Symptom.** `revalidateTag` returns, the mutation is committed, and the page keeps serving
the old value.

**Cause.** The two methods are two halves of one mechanism: `updateTags` records that a tag was
invalidated, `getExpiration` reports when. Implementing one without the other leaves the
handler internally inconsistent, and nothing type-checks that relationship.

**Fix.** Write them together. Either delete matching entries in `updateTags` — the documented
in-memory approach — or record a timestamp per tag that `getExpiration` then reports.

### Assuming `refreshTags` is called often enough to be your only sync

**Symptom.** In a multi-instance deployment, one instance keeps serving data another instance
invalidated.

**Cause.** `refreshTags` is documented as *"called periodically before starting a new
request"*. That is the framework's hook for pulling external tag state; it is not a
subscription, and the documentation does not specify a frequency you can build a guarantee on.

**Fix.** Make the shared store the source of truth — check tag state in `get` or
`getExpiration` against it — and treat `refreshTags` as an optimisation that warms a local
copy, not as the invalidation path itself.

## Interview questions

**★ Why does `set` take a promise rather than a cache entry?**
Because the entry's value stream may still be being written when `set` is called — the response
is already flowing to the user. The handler must await it before storing, or it stores an
unfinished entry.

**★ What are the three return values of `getExpiration` and what does each mean?**
`0` — none of these tags was ever revalidated, the honest answer if you track nothing. A
millisecond timestamp — the most recent revalidation across the tags. `Infinity` — a
declaration that you will check soft tags inside `get` instead.

**★ What are soft tags?**
Implicit tags Next.js derives from the route path — a layout tag per segment plus the leaf
route, prefixed `_N_T_` — passed to `get` as `softTags`. They are the mechanism
`revalidatePath` invalidates through, so a handler that ignores them breaks `revalidatePath`
without breaking `revalidateTag`.

**★ Which is more dangerous, a failing `get` or a failing `set`?**
`get`. `set` runs asynchronously after the response stream is already flowing, so a failure
only loses the entry and the next request re-renders. `get` is not wrapped in a try/catch by
the framework, so an unhandled exception becomes a render error — your handler must catch and
return `undefined`.

**★ Why must a handler `tee()` the entry's `value`?**
`value` is a `ReadableStream<Uint8Array>`, consumable once. To both persist it and hand it back
to the framework you need two branches.

**★ Which units does `CacheEntry` use?**
`timestamp` is in milliseconds; `stale`, `revalidate` and `expire` are in seconds. The
documented expiry check multiplies the duration by 1000 before comparing it against
`Date.now()`.

**★ Should a handler store a partially written entry?**
No. The stream can error mid-render, and the documentation is explicit that discarding is
safer because partial entries produce incomplete pages — and a cached incomplete page is
served repeatedly, not once.

**★ Which of the five methods may legitimately be a no-op?**
`refreshTags`, for an in-memory cache — it exists to sync tag state from an external service
before a request, which a purely local cache has nothing to do about.

**★ What does the `tags` field on `CacheEntry` contain, and what does it not?**
The cache tags applied by `cacheTag` or `next.tags`. It **excludes** soft tags, which are
delivered separately as the `softTags` argument to `get`.

---

**Previous:** [3b · Configuring `cacheHandlers`](03b-configuring-cache-handlers.md) · **Next:** [4 · `use cache: private`](04-use-cache-private.md)
