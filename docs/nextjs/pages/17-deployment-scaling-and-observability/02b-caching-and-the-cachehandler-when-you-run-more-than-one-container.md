---
title: "One container is correct by default and two containers are not — the Next.js server cache lives on each instance's own disk, so ISR, revalidateTag and Server Actions all quietly become per-pod facts until you write a cache handler"
sidebar_label: "02b · The cache across containers"
sidebar_position: 5
description: "The reverse proxy, streaming pass-through and keep-alive timeouts, then the server cache in detail: cacheMaxMemorySize, a full cacheHandler, refreshTags for cross-instance tag coordination, cacheHandler versus cacheHandlers, and the build ID."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Next.js [Self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting) (`version: 16.3.4`, `lastUpdated: 2026-08-25`) [Deploying to platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms) (`lastUpdated: 2026-03-30`) and the [`next` CLI reference](https://nextjs.org/docs/app/api-reference/cli/next) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** · Node `>= 20.9`. Documentation-verified, **no sandbox run**, no timings. Prior page: [02 · Self-hosting: standalone and Docker](02-self-hosting-docker-containerization.md). The wider multi-instance checklist is [17 · Deploying beyond Vercel](17-choosing-a-deployment-target-beyond-vercel.md).

**A single `next start` process is correct, full stop. The documentation says so, and every feature in the framework works against it. What nobody tells you is how narrow that guarantee is: it is a statement about *one* process with *one* persistent disk. Put a buffering proxy in front and streaming quietly stops being streaming. Scale to two replicas and the ISR cache — which is the same cache used for pages, `fetch` responses and route handlers — becomes two independent caches on two local disks, so `revalidateTag()` invalidates one of them and users see different content depending on which pod answered. None of this errors. This page is the infrastructure in front of the container, then the cache behind it, with the handler written out in full.**

## In front of the container

> *"When self-hosting, it's recommended to use a reverse proxy (like nginx) in front of your Next.js server rather than exposing it directly to the internet. A reverse proxy can handle malformed requests, slow connection attacks, payload size limits, rate limiting, and other security concerns, offloading these tasks from the Next.js server."*

> *"This allows the server to dedicate its resources to rendering rather than request validation."*

That is the argument for the proxy. Here is the thing the proxy takes away if you let it:

> *"If you are using nginx or a similar proxy, you will need to configure it to disable buffering to enable streaming."*

```js
// next.config.js — the documented app-side signal
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*{/}?',
        headers: [{ key: 'X-Accel-Buffering', value: 'no' }],
      },
    ]
  },
}
```

And the requirement is end-to-end, not just at the last hop:

> *"**Load balancers** must support chunked transfer encoding or HTTP/2 streaming. Some cloud load balancers (for example, AWS ALB with Lambda integration) may buffer responses by default."*

> *"**Reverse proxies** between the load balancer and Next.js must also pass through chunked responses without buffering."*

🔴 The consequence for Partial Prerendering is worth quoting exactly, because it is a *silent* regression rather than a failure:

> *"If using Partial Prerendering, streaming support is required. Without it, the static shell and dynamic content are delivered together after the full render completes, eliminating PPR's time-to-first-byte advantage."*

Nothing errors. Nothing logs. The page still renders correctly. You have simply paid for PPR and are receiving server-side rendering.

### 🔴 Keep-alive timeouts, and the 502 that never reproduces locally

The `next` CLI reference names a failure that is entirely invisible in development:

> *"When deploying Next.js behind a downstream proxy (e.g. a load-balancer like AWS ELB/ALB), it's important to configure Next's underlying HTTP server with keep-alive timeouts that are larger than the downstream proxy's timeouts. Otherwise, once a keep-alive timeout is reached for a given TCP connection, Node.js will immediately terminate that connection without notifying the downstream proxy. This results in a proxy error whenever it attempts to reuse a connection that Node.js has already terminated."*

```bash
next start --keepAliveTimeout 70000
```

The number must exceed the proxy's idle timeout, not merely differ from it. AWS ALB defaults to 60 seconds, which is why 70000 is the documented example.

## The cache is one cache, and it is local

> *"Caching and revalidating pages (with Incremental Static Regeneration) use the **same Next.js server cache**. By default, this cache is stored on the local filesystem (on disk) of each Next.js server instance."*

> *"This works automatically for a single self-hosted `next start` instance with persistent local disk."*

Both halves of that sentence are conditions. Ephemeral compute breaks the second; a second replica breaks the first.

> *"By default, generated cache assets will be stored in memory (defaults to 50mb) and on disk. On ephemeral compute platforms (common serverless setups), local disk is often non-persistent or unavailable, so this cache is effectively short-lived and per-instance. If you are hosting Next.js using a container orchestration platform like Kubernetes, each pod will have a copy of the cache."*

> *"To prevent stale data from being shown since the cache is not shared between pods by default, you can configure the Next.js cache to provide a cache handler and disable in-memory caching."*

Note the second instruction. It is not enough to add a shared handler — you must also switch off the in-memory layer, or each pod keeps answering from its own 50 MB copy in front of your shared store.

```js
// next.config.js
module.exports = {
  cacheHandler: require.resolve('./cache-handler.js'),
  cacheMaxMemorySize: 0, // disable default in-memory caching
}
```

## The handler, written out

This is the documented shape, filled in against Redis. The four methods are the contract; everything else is your storage decision.

```js
// cache-handler.js
const { createClient } = require('redis')

const client = createClient({ url: process.env.REDIS_URL })
const ready = client.connect()

const KEY = (k) => `next:cache:${process.env.BUILD_ID}:${k}`
const TAG = (t) => `next:tag:${process.env.BUILD_ID}:${t}`

module.exports = class CacheHandler {
  constructor(options) {
    this.options = options
  }

  async get(key) {
    await ready
    const raw = await client.get(KEY(key))
    if (!raw) return null

    const entry = JSON.parse(raw)
    // A tag invalidated after this entry was written makes it stale.
    for (const tag of entry.tags ?? []) {
      const invalidatedAt = Number(await client.get(TAG(tag))) || 0
      if (invalidatedAt > entry.lastModified) return null
    }
    return entry
  }

  async set(key, data, ctx) {
    await ready
    const entry = {
      value: data,
      lastModified: Date.now(),
      tags: ctx.tags ?? [],
    }
    await client.set(KEY(key), JSON.stringify(entry))
  }

  async revalidateTag(tags) {
    await ready
    // tags is either a string or an array of strings
    const list = [tags].flat()
    const now = Date.now()
    await Promise.all(list.map((tag) => client.set(TAG(tag), String(now))))
  }

  // A per-request in-memory cache that is reset before the next request.
  resetRequestCache() {}
}
```

Three points the documented skeleton makes explicit and that are easy to get wrong.

**`revalidateTag` receives a string *or* an array.** The docs' own example opens with `tags = [tags].flat()` for exactly that reason.

**`set` is handed the tags on `ctx`, not on the key.** Tag membership is per-entry, which is why invalidation is a scan or an index rather than a delete by key.

**`revalidatePath` is not a separate mechanism.**

> *"`revalidatePath` is a convenience layer on top of cache tags. Calling `revalidatePath` will call the `revalidateTag` function with a special default tag for the provided page."*

If your handler implements `revalidateTag` correctly, `revalidatePath` works for free. If it does not, `revalidatePath` fails in a way that looks unrelated to tags.

And the docs are honest that the skeleton is a starting point, not a production artefact:

> *"For production deployments, use this as a starting point and extend it with durable storage, eviction policies, error handling, and distributed tag coordination."*

## 🔴 Tag invalidation does not travel by itself

This is the failure that survives a correct-looking shared cache.

> *"By default, calling `revalidateTag()` on one instance only invalidates the cache on that instance. Other instances continue serving stale content until they independently discover the invalidation."*

> *"To coordinate tag invalidation across instances, implement the `refreshTags()` method in your custom cache handler. This method is called before each request and should sync tag state from shared storage (like Redis) so all instances learn about invalidations promptly."*

Called *before each request* — so it must be cheap. Pull the tag table into memory on an interval and let `refreshTags` read the memoised copy rather than issuing a round trip per request.

```js
// inside CacheHandler, alongside the methods above
let tagsCache = new Map()
let lastSync = 0

async function syncTags() {
  const now = Date.now()
  if (now - lastSync < 1000) return   // at most one round trip per second
  lastSync = now
  const entries = await client.hGetAll(`next:tags:${process.env.BUILD_ID}`)
  tagsCache = new Map(
    Object.entries(entries).map(([tag, at]) => [tag, Number(at)])
  )
}

// method on the class:
//   async refreshTags() { await syncTags() }
//   async getExpiration(...tags) { ... read tagsCache ... }
```

⚠️ The exact companion methods on the `cacheHandlers` interface are documented on the [`cacheHandlers` reference](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers); the self-hosting guide names `refreshTags()` and its calling convention, which is what the snippet above illustrates. Verify the full method list against that reference before shipping a handler — this page does not reproduce it.

## Two handlers, two config keys

They are different options for different caches, and the names differ by one letter:

> *"`cacheHandler` (singular) covers server cache paths like ISR, route handlers, patched `fetch`/`unstable_cache`, and image optimization. `cacheHandlers` (plural) configures `'use cache'` directive backends."*

So an application using [Cache Components and `'use cache'`](../05-caching-ppr-and-cache-components/01-explanation.md) needs the **plural** option; an application using ISR and `fetch` caching needs the **singular** one; an application using both needs both. Configuring only one and concluding "the shared cache does not work" is a very common half-hour.

The multi-server section also names the directive-level route:

> *"For consistent caching behavior, use `'use cache: remote'` with a custom cache handler that stores data in external storage."*

## The build ID ties the cache to the deployment

> *"Next.js generates an ID during `next build` to identify which version of your application is being served. The same build should be used and boot up multiple containers."*

> *"If you are rebuilding for each stage of your environment, you will need to generate a consistent build ID to use between containers."*

```js
// next.config.js
module.exports = {
  generateBuildId: async () => process.env.GIT_HASH,
}
```

> *"When `deploymentId` is set, Next.js uses a constant build ID and `generateBuildId` has no effect. Version skew is detected from the deployment ID instead."*

That is the self-hosted equivalent of the platform feature in [01c](01c-the-edge-network-and-skew-protection.md): static assets gain `?dpl=<deploymentId>`, navigations carry `x-deployment-id`, and a mismatch produces a hard navigation instead of a broken client-side one.

```js
// next.config.js
module.exports = {
  deploymentId: process.env.DEPLOYMENT_VERSION,
}
```

## What the server sets on its own

Worth knowing before you write CDN rules that fight it:

> *"Next.js sets the `Cache-Control` header of `public, max-age=31536000, immutable` to truly immutable assets. It cannot be overridden."*

> *"Dynamically rendered pages set a `Cache-Control` header of `private, no-cache, no-store, max-age=0, must-revalidate` to prevent user-specific data from being cached."*

> *"When using a CDN in front of your Next.js application, the page will include `Cache-Control: private` response header when dynamic APIs are accessed. … If the page is fully prerendered to static, it will include `Cache-Control: public` to allow the page to be cached on the CDN."*

The framework is already telling your CDN the right thing. A blanket CDN rule that overrides `Cache-Control` on HTML is how user-specific pages end up in a shared cache.

## Gotchas

**★ Symptom: PPR and streamed responses arrive all at once, and time-to-first-byte regressed with no code change.** Cause: a reverse proxy or load balancer is buffering. Fix: disable buffering — the app-side signal is `X-Accel-Buffering: no` via `headers()` — and check every hop, because *"load balancers must support chunked transfer encoding or HTTP/2 streaming"* and AWS ALB with Lambda integration is named as one that may buffer by default.

**★ Symptom: intermittent 502s behind a load balancer that never reproduce locally or under load testing.** Cause: Node's keep-alive timeout is shorter than the proxy's, so Node closes an idle connection without telling the proxy, which then tries to reuse it. Fix: raise it above the proxy's idle timeout — `next start --keepAliveTimeout 70000` for a 60-second ALB. It is a pure race, so it appears as a low background error rate rather than a reproducible failure.

**★ Symptom: two users refresh the same ISR page seconds apart and see different content.** Cause: each instance has its own on-disk cache — *"each pod will have a copy of the cache"* — and they revalidated at different times. Fix: a shared `cacheHandler` **and** `cacheMaxMemorySize: 0`. Setting only the handler leaves a 50 MB per-pod memory cache in front of the shared store, which reproduces the symptom at a lower rate and is harder to diagnose.

**★ Symptom: `revalidateTag()` from a webhook fixes one pod and leaves the rest stale.** Cause: *"calling `revalidateTag()` on one instance only invalidates the cache on that instance"*. Fix: implement `refreshTags()` so every instance syncs tag state from shared storage before serving. Without it, a shared cache is shared *storage* with unshared *invalidation*.

**★ Symptom: `refreshTags()` was implemented and p95 latency got worse.** Cause: it is called before **each request**, so a naive implementation adds a network round trip to every request in the application. Fix: memoise the tag table with a short TTL, as in `syncTags` above, and let the method read the in-process copy.

**★ Symptom: the shared cache "does not work" for `'use cache'` entries although ISR is fine.** Cause: you configured `cacheHandler` (singular) and `'use cache'` is governed by `cacheHandlers` (plural). Fix: configure the plural option too — they are different caches with near-identical names, which is precisely why this is a repeat offender.

**★ Symptom: `revalidatePath()` does nothing against a custom handler while `revalidateTag()` works.** Cause: *"`revalidatePath` is a convenience layer on top of cache tags"* and calls your `revalidateTag` with a special default tag. If your implementation only matches tags it recognises, it drops that one. Fix: treat any incoming tag as opaque — never filter to a known set.

**★ Symptom: containers from the same release serve different Server Actions and users get "Failed to find Server Action".** Cause: each build generated its own Server Function encryption key. Fix: build once and deploy that artefact, or set a shared key at build time — *"The key must be a base64-encoded value with a valid AES key length (16, 24, or 32 bytes)"*:

```bash
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$SHARED_KEY" next build
```

**★ Symptom: after a deploy every cached page is cold although the shared store is full of entries.** Cause: cache keys are scoped to the build. A new build ID means a new namespace — which is correct, because the prerendered output changed. Fix: nothing, unless you are rebuilding per environment for the *same* source, in which case pin the build ID with `generateBuildId` so the artefacts agree.

**★ Symptom: `generateBuildId` is set and appears to be ignored.** Cause: `deploymentId` is also set, and *"when `deploymentId` is set, Next.js uses a constant build ID and `generateBuildId` has no effect"*. Fix: pick one. If you want skew detection, keep `deploymentId` and delete `generateBuildId`.

**Symptom: a user-specific dashboard was served to the wrong user from the CDN.** Cause: a blanket CDN rule overrode the `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` that Next.js sets on dynamically rendered pages. Fix: let the origin's headers through for HTML. The framework is already distinguishing `public` from `private` per route; a global override discards that signal.

**Symptom: cache entries disappear on every pod restart despite a configured handler.** Cause: the handler's storage is in-process — the documented example uses a `Map`, and it is explicitly a starting point. Fix: back it with durable shared storage; a `Map` in a container is a per-pod memory cache with extra steps.

## Interview questions

**★ "A single `next start` process handles every Next.js feature correctly." What is that sentence *not* promising?**
It promises functional fidelity for one process. It says nothing about two. The moment there is a second instance, several defaults stop being safe: the server cache is per-instance and on local disk, so ISR entries diverge; `revalidateTag()` invalidates only the instance that received it; the Server Function encryption key differs per build; and there is no deployment ID to detect skew. It also assumes persistent local disk, which ephemeral compute does not provide. The guarantee is real and narrow, and the documentation's multi-server and multi-instance sections exist precisely to enumerate what falls outside it.

**★ Why is a shared cache handler insufficient on its own for cross-instance consistency?**
Because storage and invalidation are separate problems. A shared handler makes every instance read and write the same entries, but `revalidateTag()` still runs on exactly one instance — the one that received the webhook or Server Action — and the others have no reason to look again. The documented remedy is `refreshTags()`, called before each request, which syncs tag state from shared storage so every instance learns about the invalidation. Without it you have consistent storage and inconsistent freshness, which is arguably worse than obviously separate caches because it looks correct.

**★ `refreshTags()` runs before every request. What does that constrain, and how do you implement it responsibly?**
It constrains cost: anything you do there is multiplied by your entire request volume, so a Redis round trip per request is not viable at scale. The responsible implementation keeps an in-process copy of the tag-invalidation table and refreshes it on a short interval — a second is usually far tighter than the staleness anyone will notice — so `refreshTags()` is a memory read in the common case. It also has to fail open: if shared storage is unavailable, serving slightly stale content is better than failing every request.

**★ `cacheHandler` and `cacheHandlers` differ by one letter. What do they each cover?**
The singular option covers the server cache paths — ISR, route handlers, patched `fetch` and `unstable_cache`, and image optimization. The plural option configures backends for the `'use cache'` directive. They are separate caches with separate lifecycles, so an application that uses both ISR and Cache Components must configure both. Configuring one and testing the other is the standard way to conclude that shared caching "does not work".

**★ Why does the documentation tell you to set `cacheMaxMemorySize: 0` when adding a cache handler?**
Because the default keeps an in-memory cache (50 MB) in front of whatever handler you install, and that memory is per-instance. With it enabled, each pod can answer from its own copy without consulting the shared store, so the exact divergence you added the handler to fix reappears — less often, and therefore harder to reproduce. Disabling it makes the shared store authoritative.

**★ What is the relationship between the build ID, the deployment ID and your cache?**
Cache keys are scoped to the build, so a new build starts with a cold cache by design — the prerendered output is different. `generateBuildId` lets you pin that ID, which matters when you rebuild the same source for several environments and want the artefacts to agree. `deploymentId` supersedes it: setting it makes the build ID constant, disables `generateBuildId`, and switches skew detection to the deployment ID, adding `?dpl=` to static assets and `x-deployment-id` to navigations so a mismatch triggers a hard navigation rather than a broken client-side one.

**★ A buffering load balancer does not break anything. Why is it still a bug?**
Because it converts every streaming feature into its non-streaming equivalent while leaving the output identical. Suspense boundaries still resolve, PPR still renders — but, as the docs put it, the static shell and dynamic content are delivered together after the full render completes, eliminating PPR's time-to-first-byte advantage. You are running the more complex architecture and receiving the simpler one's performance, with no error to alert on. The only symptom is a metric, which is why it is usually found weeks later.

**You have inherited a Kubernetes deployment where ISR "randomly" serves old content. Give the diagnostic order.**
First, count the replicas — with more than one and no shared handler, the behaviour is expected and not random at all. Second, check `cacheMaxMemorySize`; a handler with in-memory caching still enabled reproduces the symptom intermittently. Third, check whether `refreshTags()` is implemented, because that decides whether on-demand invalidation propagates. Fourth, check whether the application uses `'use cache'`, because that needs the plural `cacheHandlers` option and is a separate cache entirely. Fifth, confirm every pod is running the same build ID; mixed builds during a rolling deploy produce divergence that resolves itself and therefore looks random.

---

← [Self-hosting: standalone and Docker](02-self-hosting-docker-containerization.md) · [Chapter 17 overview](01-explanation.md) · Next → [Multi-region strategies and data locality](03-multi-region-strategies-and-data-locality-patterns.md)
