---
title: "A cache handler is five methods, and the framework's own advice is that you probably should not write one — but if you run more than one instance the default in-memory LRU is the reason your revalidations do not propagate, and this is the interface that fixes it"
sidebar_label: "05e · Writing a custom cache handler"
sidebar_position: 59
description: "The `get`/`set`/`refreshTags`/`getExpiration`/`updateTags` contract, the `CacheEntry` shape, what soft tags are and why your handler receives them, and the named-handler mechanism behind `use cache: <name>`."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js 16.3.4 documentation — [`cacheHandlers`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers) (introduced `v16.0.0`), [`use cache: remote`](https://nextjs.org/docs/app/api-reference/directives/use-cache-remote), [How revalidation works](https://nextjs.org/docs/app/guides/how-revalidation-works).
> Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4** · React 19.2.8 · Node 24.20.0.

**The framework opens its own documentation for this feature by telling you not to use it: *"Most applications don't need custom cache handlers. The default in-memory cache works well in the typical use case."* Take that seriously — and then read the sentence that follows it, because it defines exactly which applications are not typical: *"The default in-memory cache is isolated to each Next.js process. If you're running multiple servers or containers, each instance will have its own cache that isn't shared with others and is lost on restart."* If you run one instance, stop here. If you run several, this interface is the mechanism by which they agree on anything, and [05h](05h-a-shared-cache-across-instances.md) is what happens when they do not.**

## What is configured, and what the names mean

> *"**`default`**: Used by the `'use cache'` directive. **`remote`**: Used by the `'use cache: remote'` directive."*
> *"If you don't configure `cacheHandlers`, Next.js uses an in-memory LRU (Least Recently Used) cache for both `default` and `remote`."*
> — [Next.js · `cacheHandlers`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers)

Two things there are worth pausing on.

**Unconfigured, `remote` is not remote.** Both directives fall back to the same in-memory LRU, so `'use cache: remote'` in an application with no `cacheHandlers` config buys you nothing at all — it is an instruction with no implementation behind it. That is a reasonable default and a genuinely surprising one, because the directive reads like a promise about storage.

**You are not limited to those two names.**

> *"You can also define additional named handlers (e.g., `sessions`, `analytics`) and reference them with `'use cache: <name>'`."*

Which is more useful than it first appears: it lets one application route different cached values to different backends by *characteristic* rather than by call site. Small, hot, short-lived values to Redis; large rendered fragments to object storage; everything else in memory. The directive at the call site names a policy, and the config decides what that policy is.

⚠️ **One exception, stated flatly:** *"Note that `'use cache: private'` does not use cache handlers and cannot be customized."* Private caching is not a storage decision you get to make.

```ts
// next.config.ts
export default {
  cacheHandlers: {
    default: require.resolve('./cache-handlers/memory-with-shared-tags.ts'),
    remote: require.resolve('./cache-handlers/redis.ts'),
    analytics: require.resolve('./cache-handlers/s3.ts'),   // 'use cache: analytics'
  },
}
```

## The five methods

```ts
get(cacheKey: string, softTags: string[]): Promise<CacheEntry | undefined>
set(cacheKey: string, pendingEntry: Promise<CacheEntry>): Promise<void>
refreshTags(): Promise<void>
getExpiration(tags: string[]): Promise<number>
updateTags(tags: string[], durations?: { expire?: number }): Promise<void>
```

They divide cleanly into two jobs, and conflating them is the most common way a handler ends up half-working.

**Storage** is `get` and `set`. This is the easy half and the half people implement.

**Tag coordination** is `refreshTags`, `getExpiration` and `updateTags`. This is the half that makes invalidation cross an instance boundary, and a handler that omits it has built shared storage that never invalidates — which [05h](05h-a-shared-cache-across-instances.md) argues is worse than no sharing at all, because it makes every instance consistently stale rather than only some of them.

### The entry

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

`value` is a **stream**, not a buffer, and that single fact drives most of the implementation difficulty on this page. The three numbers `stale`, `revalidate` and `expire` are the same three from `cacheLife` in [ch05](../05-caching-ppr-and-cache-components/02-the-use-cache-directive-and-custom-cachelife-profiles.md); `timestamp` is when the entry was produced, and it is what `getExpiration` gets compared against.

### `set` receives a promise, and the entry may not be finished

> *"The entry may still be pending when this is called (i.e., its value stream may still be written to). Your handler should await the promise before processing the entry."*

So `set` is handed a `Promise<CacheEntry>` rather than an entry, because the framework calls it while the render that produces the value is still running. Awaiting it is not optional bookkeeping — it is how you get an entry whose stream is actually complete.

### `getExpiration` has three return values and they mean different things

> *"`getExpiration` returns: `0` if none of the tags were ever revalidated; a timestamp (in milliseconds) representing the most recent revalidation; `Infinity` to indicate soft tags should be checked in the `get` method instead."*

`0` means "nothing to compare against, the entry is fine". A timestamp means "compare it with `entry.timestamp` — older loses". `Infinity` is an opt-out: it tells the framework you will handle soft-tag checking yourself inside `get`, which is why `get` receives `softTags` as its second argument at all.

### Soft tags, which you did not ask for and will receive anyway

> *"Soft tags are implicit tags that Next.js automatically generates based on the route path. Every segment in the path gets a layout tag, plus the leaf route itself. For example, the route `/blog/hello` generates soft tags for `/layout`, `/blog/layout`, `/blog/hello/layout`, and `/blog/hello`. These tags are prefixed internally with `_N_T_`."*

That is how `revalidatePath()` works: a path revalidation stamps the soft tag for that path, and every entry rendered under it is invalidated without anyone having tagged anything explicitly. Two consequences for a handler author. Your tag ledger has to hold far more tags than the application ever names — one per layout segment per route. And revalidating a top-level layout tag invalidates a very large subtree, which is correct and is also why `revalidatePath('/')` is not the harmless debugging tool it looks like.

## A handler, end to end

```ts
// cache-handlers/redis.ts — the storage half plus the coordination half
import { createClient } from 'redis'

const redis = createClient({ url: process.env.REDIS_URL })
await redis.connect()

let tagStamps = new Map<string, number>()   // tag -> last revalidation, ms

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = []
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

export default {
  async get(cacheKey: string, softTags: string[]) {
    try {
      const raw = await redis.get(`entry:${cacheKey}`)
      if (!raw) return undefined
      const meta = JSON.parse(raw) as Omit<CacheEntry, 'value'> & { body: string }

      const invalidatedAt = await this.getExpiration([...meta.tags, ...softTags])
      if (invalidatedAt !== 0 && meta.timestamp < invalidatedAt) return undefined

      return {
        ...meta,
        value: new Blob([Buffer.from(meta.body, 'base64')]).stream(),
      } as CacheEntry
    } catch {
      return undefined            // 🔴 a miss, never a throw
    }
  },

  async set(cacheKey: string, pendingEntry: Promise<CacheEntry>) {
    try {
      const entry = await pendingEntry            // may still be streaming until awaited
      const body = await readAll(entry.value)
      await redis.set(
        `entry:${cacheKey}`,
        JSON.stringify({
          tags: entry.tags,
          stale: entry.stale,
          timestamp: entry.timestamp,
          expire: entry.expire,
          revalidate: entry.revalidate,
          body: body.toString('base64'),
        }),
        { EX: Math.ceil(entry.expire) },
      )
    } catch (err) {
      metrics.increment('cache.set.failed')      // 🔴 nothing else will tell you
      report(err)
    }
  },

  async updateTags(tags: string[]) {
    const now = Date.now()
    await redis.hSet('tagstamps', Object.fromEntries(tags.map((t) => [t, now])))
  },

  async refreshTags() {
    try {
      const all = await redis.hGetAll('tagstamps')
      tagStamps = new Map(Object.entries(all).map(([t, v]) => [t, Number(v)]))
    } catch (err) {
      report(err)                                 // 🔴 must not throw — see 05h
    }
  },

  async getExpiration(tags: string[]) {
    let latest = 0
    for (const t of tags) latest = Math.max(latest, tagStamps.get(t) ?? 0)
    return latest
  },
}
```

Note what `refreshTags` is doing: pulling the shared ledger into a local map so that `getExpiration` — which is called on the hot path, per entry — is a memory lookup rather than a network round trip. The documentation describes `refreshTags` as *"Called periodically before starting a new request to sync with external tag services"*, and that cadence is what makes the trade work.

⚠️ **The example buffers the whole entry, which the docs explicitly caution against for large pages** — see [05f](05f-streams-and-failure-semantics-in-a-handler.md) for `.tee()`, streaming straight to storage, and what to do about partial writes. Buffering is the right starting point and the wrong ending point.

## Gotchas

**★ Symptom: `'use cache: remote'` was added everywhere and nothing became shared.** Cause: no `cacheHandlers` were configured, and *"If you don't configure `cacheHandlers`, Next.js uses an in-memory LRU cache for both `default` and `remote`."* The directive named a policy with no implementation behind it. Fix: configure the `remote` handler in `next.config.ts` — the directive is the call-site half, the config is the other half, and neither works alone.

**★ Symptom: the handler stores and reads entries correctly, and `revalidateTag()` still does not propagate.** Cause: only the storage half was implemented. Tag coordination is a separate trio — `updateTags` to publish, `refreshTags` to subscribe, `getExpiration` to compare — and without it every instance shares entries that nothing invalidates. Fix: implement all five methods; see [05h](05h-a-shared-cache-across-instances.md) for why the half-implementation is worse than none.

**★ Symptom: entries are stored with an empty or truncated body.** Cause: `set` treated its argument as an entry rather than a promise, or read `entry.value` without draining the stream. The docs warn that *"The entry may still be pending when this is called (i.e., its value stream may still be written to)"*. Fix: `await pendingEntry` first, then read the stream to completion before writing anything.

**★ Symptom: `revalidatePath('/')` in a debugging session wiped the entire cache.** Cause: soft tags. Every path segment generates a layout tag, so the root layout's tag is carried by essentially every entry in the application. Fix: nothing is broken — but treat path revalidation as a blunt instrument and prefer explicit tags for anything you invalidate routinely.

**★ Symptom: the tag ledger grows without bound.** Cause: soft tags are generated per route segment per route, so the tag space is much larger than the set of tags your code ever names, and stamps are never removed by the framework. Fix: expire stamps yourself. A stamp older than the longest `expire` in your application cannot invalidate anything, because no surviving entry predates it.

**★ Symptom: `getExpiration` is called constantly and cache reads are dominated by network latency.** Cause: it was implemented as a live query against the shared store, and it runs per entry on the read path. Fix: that is what `refreshTags` exists to prevent — sync the ledger into memory periodically, and make `getExpiration` a local lookup, as above.

**★ Symptom: named handlers were configured and `'use cache: private'` still goes to memory.** Cause: it is documented as outside the mechanism — *"`'use cache: private'` does not use cache handlers and cannot be customized."* Fix: none available; treat private caching as a fixed behaviour rather than a backend choice.

**★ Symptom: a handler works in `next dev` and behaves differently in production.** Cause: development includes an HMR refresh hash in the cache key, and the dev server is one long-lived process while production is many. A handler exercised only in dev has never had two instances disagree, which is the entire problem it exists to solve. Fix: test with at least two instances against one shared store — a single-instance test cannot detect the defect class.

## Interview questions

**★ When should you write a custom cache handler?**
When you run more than one instance and need revalidation to propagate between them, or need entries to survive a restart. The framework's own framing is that *"Most applications don't need custom cache handlers"* and that the default is *"isolated to each Next.js process"* — which makes the deciding question purely operational rather than architectural. One instance: do not write one. Several: the default is the reason your invalidations are inconsistent.

**★ What are the two halves of the interface, and why does implementing one produce a worse system?**
Storage is `get` and `set`; tag coordination is `updateTags`, `refreshTags` and `getExpiration`. Implementing storage alone makes every instance share the same entries with nothing to invalidate them, so where previously some instances were accidentally fresh, now all of them are uniformly stale. It is a genuine regression dressed as an improvement, which is why the coordination trio is not optional.

**★ What are soft tags and why does your handler receive them?**
They are tags Next.js generates from the route path — a layout tag per segment plus the leaf route, internally prefixed `_N_T_` — and they are the mechanism behind `revalidatePath()`. Your handler receives them in `get` so it can decide whether a stored entry was invalidated by a path revalidation it never explicitly tagged. It also explains why `getExpiration` can return `Infinity`: that is the signal that you would rather check soft tags yourself inside `get`.

**★ Why does `set` receive a promise rather than an entry?**
Because the framework calls it while the render producing the value is still streaming, so there is no complete entry to hand over yet. The documentation says the entry *"may still be pending when this is called"* and that the handler *"should await the promise before processing"*. A handler that skips the await stores whatever existed at that instant, which is usually nothing.

**★ Why route different cached values to different named handlers?**
Because their storage characteristics genuinely differ. Small, hot, short-lived values suit an in-memory or Redis backend where the round trip is cheap relative to the value; large rendered fragments suit object storage where per-item cost matters more than latency. Named handlers let the call site declare a policy — `'use cache: analytics'` — and the config decide the backend, which keeps the choice in one place instead of scattered through the application.

**★ Why is `getExpiration` a bad place to query your shared store?**
Because it runs on the read path, per entry, and it is a comparison rather than a fetch. Making it a network call puts a round trip in front of every cache read, which can easily cost more than the render it was avoiding. `refreshTags` exists to move that cost off the hot path — it syncs the ledger periodically, before requests, so `getExpiration` can be a local map lookup.

**★ A handler passes all its tests in `next dev` and misbehaves in production. What is the most likely reason?**
That the tests never had two instances. The dev server is a single long-lived process, so a handler with no tag coordination at all looks perfectly correct there — the one instance is always consistent with itself. The defect only appears when a second instance holds its own copy and never hears about an invalidation, which is precisely the condition the handler exists to address and the one a single-process test cannot create.

---

← [05d · `Vary`, `_rsc` and CDN forwarding](05d-vary-rsc-and-what-a-cdn-must-forward.md) · [Topic index](05-edge-functions-and-custom-cache-structures-for-global-comput.md) · Next → [05f · Streams and failure semantics](05f-streams-and-failure-semantics-in-a-handler.md)
