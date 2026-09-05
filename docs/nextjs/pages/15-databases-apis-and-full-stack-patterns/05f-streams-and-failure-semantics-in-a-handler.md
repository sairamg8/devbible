---
title: "A cache entry's value is a stream you can only read once, and the three ways a handler can fail are not symmetric — a throwing `get()` takes the page down, a throwing `refreshTags()` fails unrelated requests, and a failing `set()` tells nobody at all"
sidebar_label: "05f · Streams and failure semantics"
sidebar_position: 304
description: "Why `.tee()` is the answer to storing and returning the same entry, what a partial write does to a page, and the three failure rules that decide whether a cache outage degrades your site or takes it offline."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js 16.3.4 documentation — [`cacheHandlers`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers), [How revalidation works](https://nextjs.org/docs/app/guides/how-revalidation-works).
> Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4** · React 19.2.8 · Node 24.20.0.

**[05e](05e-writing-a-custom-cache-handler.md) gave the five methods and a handler that buffers every entry into memory before storing it. That handler is correct and it is also the version the documentation warns you about, because a cache entry's `value` is a `ReadableStream` and large pages produce large entries. This page is the remaining half: how to store a stream you also have to return, what happens when a render errors halfway through writing one, and the three failure rules — which point in three different directions and decide whether a Redis outage makes your site slower or makes it unavailable.**

## A stream can only be read once

`CacheEntry.value` is a `ReadableStream<Uint8Array>`, and streams are consumed. Read it to store it and you have nothing left to return to the render that asked for it; return it and you have stored nothing. The documented answer is the standard one:

> *"**Use `.tee()`** if you need to both store and return the stream."*
> — [Next.js · `cacheHandlers`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers)

`tee()` splits one stream into two independent branches, each readable in full:

```ts
async set(cacheKey: string, pendingEntry: Promise<CacheEntry>) {
  const entry = await pendingEntry
  const [toStore, toReturn] = entry.value.tee()

  // one branch goes to storage, streamed rather than buffered
  await storage.putStream(`entry:${cacheKey}`, toStore, { meta: metaOf(entry) })

  return { ...entry, value: toReturn }
}
```

⚠️ **One caveat about `tee()` that is easy to meet and hard to diagnose:** the two branches are fed from one source, so if one is read much faster than the other, the slower branch's unread chunks are held in memory. Streaming to slow object storage while the render consumes its branch immediately means the storage branch backs up, and the memory you saved by not buffering comes back as backpressure. Where the backend is slow, read the storage branch on its own rather than racing the render.

### Why buffering is a real problem and not a style preference

> *"**Memory implications**: large pages produce large cache entries. For S3-like storage backends, consider streaming directly to storage without buffering the entire entry in memory."*

The arithmetic is the same one as [01ga](01ga-where-the-prisma-instance-lives.md)'s connection count, in a different resource. A buffered handler holds the whole entry per concurrent `set`, so peak memory is entry size times concurrency — and the entries that are largest are exactly the pages under most load. A handler that is fine in staging with three requests can be the reason a container is OOM-killed under traffic, and the crash will look like a rendering problem rather than a caching one.

## Partial writes, which have no safe default

Two documented statements, and they are worth reading together because one is a decision you must make and the other is what happens if you make it wrong:

> *"**Partial writes**: the stream may error partway through rendering. Your handler should decide whether to keep partial entries or discard them. Discarding is safer, as partial entries can produce incomplete pages."*

> *"**Partial writes**: if a cache entry is partially written and then read, the behavior is undefined. Use atomic writes or a write-then-rename pattern to avoid serving partial entries."*

🔴 **"Discarding is safer" and "the behavior is undefined" together mean a partial entry is not a degraded cache hit — it is a corrupt one.** A render that fails halfway leaves a truncated payload; served later, it produces an incomplete page, and nothing downstream is checking length or integrity.

The fix is the one every storage system has: never let a partial write become visible. Write to a temporary key and promote it only on success.

```ts
async set(cacheKey: string, pendingEntry: Promise<CacheEntry>) {
  const entry = await pendingEntry
  const [toStore, toReturn] = entry.value.tee()
  const tmp = `tmp:${cacheKey}:${crypto.randomUUID()}`

  try {
    await storage.putStream(tmp, toStore, { meta: metaOf(entry) })
    await storage.rename(tmp, `entry:${cacheKey}`)   // atomic promotion
  } catch (err) {
    await storage.delete(tmp).catch(() => {})        // discard, never promote
    metrics.increment('cache.set.failed')
    report(err)
  }
  return { ...entry, value: toReturn }
}
```

Where the backend has no rename, the equivalent is a two-key scheme — write the body, then write the pointer that names it — so the pointer only ever references a complete body. What you must not do is write in place under the real key and hope the render finishes.

## The three failure rules, and why they are not symmetric

This is the part worth memorising, because each rule has a different consequence and only one of them is loud.

### `get()` — a throw is a render error, not a miss

> *"your handler should catch internal errors and return `undefined` (the \"cache miss\" signal). The framework does not wrap `get()` in a try/catch, so an unhandled exception from `get()` will propagate as a render error."*
> *"A thrown error is not treated as a cache miss; it propagates as a render error, so always return `undefined` to signal a miss."*

🔴 **This is the difference between a cache outage that slows your site down and one that takes it offline.** A handler whose `get` lets a connection error escape converts every cached route into an error page the moment Redis is unreachable. The whole value proposition of a cache — that losing it costs performance, not availability — depends on one `try`/`catch`.

### `refreshTags()` — a throw fails the request

> *"Your handler must catch errors in `refreshTags()`: if it throws, the exception propagates as a request failure."*

Same shape, worse ergonomics, because `refreshTags` runs *"periodically before starting a new request"* rather than inside a render. Its failures land on requests that touch no cached data at all, so the error looks unrelated to caching and the stack trace points at framework internals.

### `set()` — a failure is silent, and that is the dangerous one

> *"**`set()` failure**: the response is still served to the user because `set()` is called asynchronously after the response stream is already flowing."*

Nothing surfaces. The user gets a correct response, the request succeeds, and the entry was never stored. Repeat that at scale and you have a cache with a zero hit rate, full recomputation on every request, and no signal anywhere — the only evidence is a cost graph and a latency profile that nobody connects to the cache.

**So: `get` and `refreshTags` must never throw, and `set` must be instrumented, because the framework's error handling is the opposite of what you want in each case.**

| Method | Unhandled error becomes | What you must do |
|---|---|---|
| `get` | a **render error** — the page fails | catch everything, return `undefined` |
| `refreshTags` | a **request failure**, on unrelated requests | catch everything, report, return |
| `set` | **nothing at all** | catch, and emit your own metric |

## The consistency the framework is aiming for

> *"The revalidation system prioritizes availability over strict consistency."*
> *"Cache failures result in degraded performance (stale content, extra renders), not broken applications."*

Read that as the specification your handler is being measured against. Every rule on this page is in service of the second sentence: catch in `get` so a backend outage is extra renders rather than errors; discard partial writes so a failed render is a miss rather than a corrupt page; instrument `set` so "degraded performance" is something you can see rather than something you pay for silently.

A handler that does not follow them does not merely fail to help — it converts the framework's availability-first design into an availability risk, which is a strictly worse position than having no custom handler at all.

## Gotchas

**★ Symptom: cached pages render empty or truncated, and the same route is fine on a cache miss.** Cause: the entry's stream was consumed by the storage path, so the branch returned to the renderer had nothing left. Fix: `tee()` before you read either branch, and return the branch you did not store:

```ts
const [toStore, toReturn] = entry.value.tee()
```

**★ Symptom: containers are OOM-killed under load, and the traces point at rendering.** Cause: the handler buffers each entry in memory, so peak usage is entry size times concurrency — and the largest entries belong to the busiest pages. Fix: stream to storage instead of buffering, which is exactly the case the docs raise for *"S3-like storage backends"*. Buffering is a fine first implementation and a poor production one.

**★ Symptom: an occasional page renders half-complete, with no error and no pattern.** Cause: a partial cache entry is being served. The stream errored partway through a render, the handler wrote what it had under the real key, and *"if a cache entry is partially written and then read, the behavior is undefined."* Fix: write to a temporary key and promote atomically, and on failure delete rather than promote — *"Discarding is safer, as partial entries can produce incomplete pages."*

**★ Symptom: a Redis outage produces 500s across the site rather than slow pages.** Cause: `get()` threw. The framework *"does not wrap `get()` in a try/catch"* and a thrown error *"is not treated as a cache miss"*. Fix: one try/catch, returning the documented miss signal — this single line is what makes a cache outage a performance event instead of an incident:

```ts
async get(cacheKey, softTags) {
  try { return await lookup(cacheKey, softTags) } catch { return undefined }
}
```

**★ Symptom: intermittent request failures on routes that use no cache at all.** Cause: `refreshTags()` threw, and it runs before requests rather than inside renders, so its failures attach to whatever request happened to trigger the sync. Fix: catch and report inside `refreshTags`; a failed sync means "we may be serving stale content", which is never a reason to fail a request.

**★ Symptom: hit rate is zero, latency is unchanged from having no cache, and there are no errors anywhere.** Cause: `set()` is failing silently — it runs after the response is already flowing, so the framework serves the user correctly and swallows the outcome. Fix: instrument it yourself. This is the one place in the interface where the absence of an error is not evidence of success.

**★ Symptom: `tee()` was adopted to avoid buffering and memory got worse.** Cause: the two branches advance together from one source, so a slow storage write holds the chunks the fast reader has already passed. Fix: where the backend is slow relative to the render, do not race them — buffer deliberately with a size limit, or write the storage branch after the response has completed, and treat the memory cost as a decision rather than a surprise.

**★ Symptom: entries survive but their metadata is wrong after a crash mid-write.** Cause: body and metadata were written as two non-atomic operations, so one landed and the other did not. Fix: write metadata and body under one key, or write the body first and the pointer second, so the pointer is the commit. A pointer that names a complete body cannot describe a partial one.

## Interview questions

**★ Why does a cache handler need `tee()` at all?**
Because `CacheEntry.value` is a `ReadableStream` and a stream can only be consumed once. The handler has two consumers — storage, and the render that asked for the value — so reading it for one starves the other. `tee()` splits it into two independently readable branches, which is the documented answer. The caveat worth adding is that the branches share a source, so a slow storage write holds the chunks the fast reader has already consumed, and the memory you were avoiding returns as backpressure.

**★ What should a handler do when a render errors partway through writing an entry?**
Discard it. The documentation says *"Discarding is safer, as partial entries can produce incomplete pages"* and, separately, that reading a partially-written entry has *"undefined"* behaviour — so a partial entry is a corrupt cache hit, not a degraded one. The implementation is a write-then-rename or a body-then-pointer scheme, so a partial write is never visible under the real key.

**★ Describe the three failure rules and why they differ.**
A throwing `get()` becomes a render error, because the framework does not wrap it — so it must catch everything and return `undefined`, the documented miss signal. A throwing `refreshTags()` becomes a request failure, and because it runs before requests rather than inside renders, it fails requests that have nothing to do with caching. A failing `set()` does nothing at all, because it runs after the response is already streaming — which makes it the only one you must instrument yourself. They differ because the framework's priority is availability: it will not let a write failure hurt a user, and it will not silently guess your intent on a read.

**★ Why is a badly-written cache handler worse than no cache handler?**
Because it converts an availability-first design into an availability risk. The framework's stated position is that *"Cache failures result in degraded performance… not broken applications"*, which holds only if `get` and `refreshTags` swallow their errors. A handler that lets a connection error escape means a Redis blip takes the site down — so you have taken a system that was correct-but-uncoordinated and made it fragile, which is a strictly worse trade than leaving the default in place.

**★ Your cache hit rate is zero in production and nothing is logged. Where do you look?**
At `set`, first and last. It is the one path the framework deliberately makes silent — called asynchronously after the response is already flowing, so the user is served correctly and the failure is discarded by design. Every other symptom of a broken handler produces something visible; this one produces only a cost graph. The corrective action is not debugging so much as instrumentation: emit a metric on both the success and failure paths of `set` before you need it.

**★ Why is buffering entries in memory a scaling problem specifically?**
Because peak memory is entry size multiplied by concurrent writes, and the two are correlated — the largest cache entries belong to the pages under the most load, so the worst case arrives exactly when you can least afford it. The docs raise this for *"S3-like storage backends"* and recommend streaming directly to storage. The failure also disguises itself: an OOM kill during rendering looks like a rendering problem, and nothing points back at the cache handler that allocated the memory.

---

← [05e · Writing a custom cache handler](05e-writing-a-custom-cache-handler.md) · [Topic index](05-edge-functions-and-custom-cache-structures-for-global-comput.md) · Next → [05h · A shared cache across instances](05h-a-shared-cache-across-instances.md)
