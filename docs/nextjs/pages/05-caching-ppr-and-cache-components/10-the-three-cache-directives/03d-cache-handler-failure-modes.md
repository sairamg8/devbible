---
title: "A correct-looking cache handler still has three runtime failure modes, and one of them takes the site down"
sidebar_label: "3d · Cache handler failure modes"
sidebar_position: 9
description: "Soft tags and why revalidatePath needs them, the asymmetry between a failing get and a failing set, partial writes, and how far refreshTags can be trusted."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js API reference for
> [`cacheHandlers`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers)
> (page header `version: 16.3.4`, `lastUpdated: 2026-08-25`), sections *Soft Tags*,
> *Handling Streams*, *Error Handling* and `refreshTags()`.
> Target: **Next.js 16.3.4**, App Router, Cache Components. Documentation-verified; **no sandbox run** — no handler was executed and no failure below was reproduced locally.
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs · session d2e9b9fe

**A cache handler that implements all five methods, stores entries and returns them can still
be wrong in three ways that no test written against the happy path will find.** It can ignore
the `softTags` argument, in which case `revalidatePath` silently stops working while
`revalidateTag` keeps working. It can throw from `get`, which — uniquely among the five
methods — is not caught by the framework and becomes a render error. And it can persist an
entry whose stream errored mid-render, caching a truncated page until it expires. The
interface itself is [chunk 3c](03c-writing-a-cache-handler.md); this chunk is what goes wrong
after it compiles.

## Soft tags, and why `revalidatePath` works at all

`revalidatePath` has no separate mechanism. It rides the tag system on tags Next.js generates
for you:

> *"Soft tags are implicit tags that Next.js automatically generates based on the route path.
> Every segment in the path gets a layout tag, plus the leaf route itself. For example, the
> route `/blog/hello` generates soft tags for `/layout`, `/blog/layout`, `/blog/hello/layout`,
> and `/blog/hello`. These tags are prefixed internally with `_N_T_`."*

> *"Soft tags enable `revalidatePath()` to work through the same tag-based cache system.
> When `revalidatePath('/blog/hello')` is called, it invalidates all cache entries associated
> with that path's soft tags."*

They arrive as the second argument to `get`, and the handler is expected to act on them:

> *"Your handler should check whether any soft tag has been invalidated (via `getExpiration()`
> or direct timestamp comparison) after the cache entry's `timestamp`. If a soft tag was
> invalidated more recently than the entry was created, the entry should be treated as stale."*

A handler that ignores that argument still compiles, still caches, still passes a smoke
test — and silently makes `revalidatePath` a no-op against that store. Note the granularity
this buys: because *every* segment gets a layout tag, revalidating `/blog/hello` also
invalidates entries held by `/blog/layout` and the root `/layout`, which is why a path
revalidation can clear more than the leaf page you named.

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

The design reason for the asymmetry is worth stating, because it tells you where to spend
defensive effort: `set` is off the critical path by construction — it is called after the
response stream is already flowing — while `get` sits directly in front of the render. Every
line of `get` is production-critical; `set` is best-effort.

## Partial writes are the third failure, and they are sticky

The stream can error partway through rendering, and the handler decides what to do about it:

> *"**Partial writes**: the stream may error partway through rendering. Your handler should
> decide whether to keep partial entries or discard them. Discarding is safer, as partial
> entries can produce incomplete pages."*

> *"**Partial writes**: if a cache entry is partially written and then read, the behavior is
> undefined. Use atomic writes or a write-then-rename pattern to avoid serving partial
> entries."*

The word doing the work is *cached*. A truncated render served once is an incident; a
truncated render stored under a cache key is the same incident on every request until the
entry expires, which under a long `cacheLife` can be a very long time. Discard, and write
atomically so a concurrent reader cannot observe a half-written value.

## How far `refreshTags` can be trusted

> *"Called periodically before starting a new request to sync with external tag services."*

That is the whole specification. It is a hook for pulling external tag state into a local
copy, and the documentation gives no frequency, no ordering guarantee and no delivery
guarantee. Treat it as a warm-up, and put the actual correctness check where it is
synchronous with the read — in `get`, or in `getExpiration` against the shared store.

## Gotchas

### A `get` that throws

**Symptom.** The cache backend has a bad minute and the route 500s instead of rendering fresh.

**Cause.** The framework does not wrap `get()` in a try/catch, so anything it throws
propagates as a render error. Every other method is forgiving; this one is not.

**Fix.** Catch everything inside `get` and return `undefined` — the miss signal — as in the
handler above. A cache that is down should degrade to no cache, never to no site. That
includes the deserialization path: a `JSON.parse` on a corrupted value throws exactly like a
connection failure does.

### Ignoring `softTags` in `get`

**Symptom.** `revalidatePath('/blog/hello')` appears to do nothing against your handler while
`revalidateTag` works fine.

**Cause.** `revalidatePath` invalidates through the implicit `_N_T_`-prefixed path tags handed
to `get` as `softTags`. A handler that never checks them never notices the invalidation.

**Fix.** Compare the soft tags' invalidation timestamps against the entry's `timestamp` and
treat the entry as stale if any is newer — or return `Infinity` from `getExpiration` and do
that check inside `get` deliberately.

### Keeping a partially written entry

**Symptom.** Users occasionally get a page that stops halfway through, and it is *sticky* —
the same broken page comes back until the entry expires.

**Cause.** The value stream can error partway through rendering. If your `set` stores what it
got, the truncation is now cached.

**Fix.** Discard partial entries — the documentation says discarding is safer — and use atomic
writes or write-then-rename so a reader never observes a half-written entry.

### Assuming `refreshTags` is called often enough to be your only sync

**Symptom.** In a multi-instance deployment, one instance keeps serving data another instance
invalidated.

**Cause.** `refreshTags` is documented as *"called periodically before starting a new
request"*. That is the framework's hook for pulling external tag state; it is not a
subscription, and the documentation does not specify a frequency you can build a guarantee on.

**Fix.** Make the shared store the source of truth — check tag state in `get` or
`getExpiration` against it — and treat `refreshTags` as an optimisation that warms a local
copy, not as the invalidation path itself.

### Testing the handler only against the happy path

**Symptom.** The handler passes review, ships, and produces its first incident during an
unrelated backend degradation.

**Cause.** All three failures in this chunk are invisible when the store is healthy and the
render completes: the `softTags` bug needs a `revalidatePath` call to surface, the `get` bug
needs the store to fail, and the partial-write bug needs a render to error mid-stream.

**Fix.** Exercise them deliberately — a handler whose `get` throws on demand, a store made
unreachable, a `revalidatePath` against a path you have a cached entry for. None of these
needs the real backend to misbehave on its own schedule.

## Interview questions

**★ What are soft tags?**
Implicit tags Next.js derives from the route path — a layout tag per segment plus the leaf
route, prefixed `_N_T_` — passed to `get` as `softTags`. They are the mechanism
`revalidatePath` invalidates through, so a handler that ignores them breaks `revalidatePath`
without breaking `revalidateTag`.

**★ Why does revalidating one path sometimes clear more than that page?**
Because every segment in the path gets its own layout soft tag. `revalidatePath('/blog/hello')`
touches `/layout`, `/blog/layout`, `/blog/hello/layout` and `/blog/hello`, so entries held by
any of those layouts are invalidated too.

**★ Which is more dangerous, a failing `get` or a failing `set`?**
`get`. `set` runs asynchronously after the response stream is already flowing, so a failure
only loses the entry and the next request re-renders. `get` is not wrapped in a try/catch by
the framework, so an unhandled exception becomes a render error — your handler must catch and
return `undefined`.

**★ Should a handler store a partially written entry?**
No. The stream can error mid-render, and the documentation is explicit that discarding is
safer because partial entries produce incomplete pages — and a cached incomplete page is
served repeatedly, not once.

**★ What guarantee does `refreshTags` give you?**
Very little by specification: it is *"called periodically before starting a new request to sync
with external tag services"*, with no stated frequency. It is a warm-up hook, not the
invalidation path; correctness has to live in `get` or `getExpiration`.

**★ Why write-then-rename rather than write-in-place?**
Because a partially written entry read by a concurrent request has undefined behaviour. An
atomic swap means a reader sees either the previous complete entry or the new complete one,
never half of either.

---

**Previous:** [3c · Writing a cache handler](03c-writing-a-cache-handler.md) · **Next:** [4 · `use cache: private`](04-use-cache-private.md)
