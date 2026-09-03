---
sidebar_position: 17
title: "Deploying beyond Vercel is a capability question, not a loyalty question — and the honest answer is that a Node.js server plus sharp gets you every feature"
sidebar_label: "Deploying beyond Vercel"
description: "The four deployment options, the feature/infrastructure matrix, the CDN primitive table, and the five things a multi-instance self-hosted Next.js deployment must configure before it is correct."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [Deploying](https://nextjs.org/docs/app/getting-started/deploying), [Deploying to Platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms), [Self-Hosting](https://nextjs.org/docs/app/guides/self-hosting), [CDN Caching](https://nextjs.org/docs/app/guides/cdn-caching), [`output`](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), and [Next.js 16.3](https://nextjs.org/blog/next-16-3) (3 August 2026).
> Target: **Next.js 16.3.4**. Node.js `>= 20.9`. Prior page: [16 · OpenNext](16-opennext-the-community-adapter-that-became-the-standard.md). See also [02 · Self-hosting: Docker containerization](02-self-hosting-docker-containerization.md).

**The question "can we run Next.js off Vercel?" has a boring answer and an interesting one. The boring answer is yes, trivially: a Node.js server supports every feature, and the only extra dependency is `sharp`. The interesting answer is that the moment you run *more than one* of those servers, five separate things stop being defaults and start being configuration — the Server Function encryption key, the deployment ID, a shared cache, tag coordination, and end-to-end streaming. Every "we self-hosted and X broke" story is one of those five. This page is the checklist.**

## The four options

| Deployment Option | Feature Support |
| --- | --- |
| Node.js server | All |
| Docker container | All |
| Static export | Limited |
| Adapters | Varies (verified adapters run the test suite) |

Node and Docker are documented as supporting **all** Next.js features. That is not a hedge; the platform guide restates it: *"A single `next start` process handles every Next.js feature correctly: Server Components, ISR, PPR, Cache Components, Server Actions, Proxy, and `after()`."*

`output: 'standalone'` is what makes the container small:

> *"This will create a folder at `.next/standalone` which can then be deployed on its own without installing `node_modules`."*

With a trap worth naming up front:

> *"This minimal server does not copy the `public` or `.next/static` folders by default as these should ideally be handled by a CDN instead, although these folders can be copied to the `standalone/public` and `standalone/.next/static` folders manually"*

```bash filename="Terminal"
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
```

Static export is the only option with real feature loss: *"Running as a static export does not support Next.js features that require a server."*

## The capability matrix

| Feature | Streaming | Shared Cache | Edge Stitching | Notes |
| --- | --- | --- | --- | --- |
| Server Components | Required | No | No | Basic streaming support |
| ISR (time-based) | No | Recommended | No | Works per-instance without shared cache |
| ISR (on-demand) | No | Recommended | No | Tag propagation needs shared cache for multi-instance |
| Partial Prerendering | Required | Recommended | Optional | |
| Cache Components (`use cache`) | Required | Recommended | No | Shared cache enables cross-instance consistency |
| Proxy / Middleware | No | No | No | Runs at edge or origin |
| Server Actions | Required | No | No | POST requests with streaming response |
| `after()` | No | No | No | Requires graceful shutdown support |

Two definitions carry the weight:

> *"**Streaming Required** means the platform must support chunked transfer encoding or HTTP/2 streaming and must not buffer the response before sending it to the client."*

> *"**Shared Cache Recommended** means multiple server instances benefit from shared cache backends to coordinate. […] Without shared cache, each instance maintains its own cache independently — features still work correctly on each instance, but revalidation events don't propagate across instances."*

Note what "Edge Stitching" is not: *"The 'Edge Stitching' column is a **performance optimization**, not a correctness requirement. All features work correctly from a single origin server."*

## The five things multi-instance changes

### 1 · The Server Function encryption key

> *"Next.js encrypts Server Function closure variables before sending them to the client. By default, a unique encryption key is generated for each build. When running multiple server instances, all instances must use the same encryption key. Otherwise, a Server Function encrypted by one instance cannot be decrypted by another, causing "Failed to find Server Action" errors."*

```bash
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=your-generated-key next build
```

> *"The key must be a base64-encoded value with a valid AES key length (16, 24, or 32 bytes). Next.js generates 32-byte keys by default."*

This is the single most misdiagnosed self-hosting failure. Server Actions work perfectly in staging with one replica and fail intermittently in production with three — because a form submitted against replica A is decrypted by replica B.

### 2 · The deployment identifier

`deploymentId` drives skew protection. When configured, Next.js:

1. Appends `?dpl=<deploymentId>` to static asset URLs
2. Adds an `x-deployment-id` header to client-side navigation requests
3. Adds an `x-nextjs-deployment-id` header to navigation responses
4. Injects a `data-dpl-id` attribute on the `html` element
5. Includes the `deploymentId` in the `'use cache'` cache key, invalidating entries when it changes

```js filename="next.config.js"
module.exports = {
  deploymentId: process.env.DEPLOYMENT_VERSION || process.env.GIT_SHA,
}
```

The symptoms it prevents are worth memorising because they look like three unrelated bugs:

> *"**Missing assets**: The client requests JavaScript or CSS files that no longer exist on the server · **Server Function mismatches**: The client invokes a Server Function using an ID from a previous build that the server no longer recognizes · **Navigation failures**: Prefetched page data from an old deployment is incompatible with the new server"*

And the limit of what it does, stated bluntly:

> *"Next.js does not read the `?dpl=` query parameter on incoming requests. The query parameter is for cache busting (ensuring browsers and CDNs fetch fresh assets), not for routing."*

> *"A per-deployment value only avoids skew if requests are also routed by deployment. Next.js does not route on `?dpl=`, so that routing comes from your host or CDN. Without it, clients that reach an instance from another deployment during a rollout will reload rather than navigate."*

So `deploymentId` converts a broken navigation into a full page reload. It does not make the navigation work — that requires deployment-aware routing at your load balancer.

### 3 · A shared cache

> *"By default, Next.js uses an in-memory cache that is not shared across instances. For consistent caching behavior, use `'use cache: remote'` with a custom cache handler that stores data in external storage."*

Two config surfaces, for two cache paths: `cacheHandler` covers ISR, route handlers, patched `fetch`/`unstable_cache` and image optimization; `cacheHandlers` configures `'use cache'` backends.

### 4 · Tag coordination

Shared storage alone is not enough, because invalidation is a broadcast problem:

> *"By default, calling `revalidateTag()` on one instance only invalidates the cache on that instance. Other instances continue serving stale content until they independently discover the invalidation."*

> *"To coordinate tag invalidation across instances, implement the `refreshTags()` method in your custom cache handler. This method is called before each request and should sync tag state from shared storage (like Redis) so all instances learn about invalidations promptly."*

`refreshTags()` running *before each request* is the design decision to notice: it makes invalidation eventually-consistent on a per-request granularity rather than requiring a pub/sub fan-out.

### 5 · Streaming, end to end

Streaming is a property of the whole path, and any hop can break it:

> *"**Load balancers** must support chunked transfer encoding or HTTP/2 streaming. Some cloud load balancers (for example, AWS ALB with Lambda integration) may buffer responses by default. · **Reverse proxies** between the load balancer and Next.js must also pass through chunked responses without buffering."*

For nginx, the documented fix:

```js filename="next.config.js"
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

> *"If using Partial Prerendering, streaming support is required. Without it, the static shell and dynamic content are delivered together after the full render completes, eliminating PPR's time-to-first-byte advantage."*

### And one more: graceful shutdown for `after()`

> *"When stopping the server, ensure a graceful shutdown by sending `SIGINT` or `SIGTERM` signals and waiting. The Next.js server will finish in-flight requests and execute any pending `after()` callbacks before exiting. Platforms should allow a configurable drain period (10-30 seconds is recommended)."*

Kubernetes' default `terminationGracePeriodSeconds` is 30, which is inside that window — but a `SIGKILL`-happy rollout or a 5-second grace period silently drops every pending `after()` callback, and nothing logs it.

## What a CDN in front changes

Next.js sets `Cache-Control` by rendering strategy:

- **Static pages** (no revalidation): `s-maxage=31536000`
- **ISR pages**: `s-maxage={revalidate}, stale-while-revalidate={expire - revalidate}`
- **Dynamic pages**: `private, no-cache, no-store, max-age=0, must-revalidate`

Hashed static assets get `public, max-age=31536000, immutable`.

The gap that surprises people:

> *"CDN-level caching alone does not support on-demand revalidation (`revalidateTag()` / `revalidatePath()`): those calls invalidate the Next.js server cache, but the CDN will continue serving its cached copy until the `s-maxage` TTL expires. To propagate on-demand revalidation to the CDN, trigger CDN purges alongside your revalidation call."*

The documented pattern is: call `revalidateTag()`/`revalidatePath()`, then call your CDN's purge API *"for the affected keys (including both HTML and RSC variants)"*.

App Router responses also carry a `Vary` on custom headers — `rsc`, `next-router-state-tree`, `next-router-prefetch`, `next-router-segment-prefetch`, and `next-url` for interception routes — which many CDNs handle poorly. And an ordering rule:

> *"`proxy.js` (previously Middleware) should run before the CDN cache so it remains the source of truth for auth, redirects, and rewrites. If your deployment places `proxy.js` behind the CDN, configure the cache layer to bypass caching for routes that depend on `proxy.js` decisions."*

## The CDN primitive table

| CDN | Edge Compute | Key-Value / Tags | Blob Storage | PPR Resuming |
| --- | --- | --- | --- | --- |
| Cloudflare | Workers | KV | R2 | Yes (worker) |
| Akamai | EdgeWorkers | EdgeKV | Object Storage | Yes (worker) |
| Amazon CloudFront | Lambda@Edge | KeyValueStore | S3 | Yes (Lambda) |
| Fastly | Compute | KV Store | Object Storage | Yes (WASM) |
| Azure | Functions | Managed Redis | Blob Storage | Yes (server) |
| Google Cloud | Cloud Run | Various KV | Cloud Storage | Yes (server) |

With the caveat printed directly beneath it:

> *"These are available building blocks, not finished integrations. Most community adapters today deploy Next.js as a Docker container or Node.js server without leveraging CDN-specific primitives like edge KV or PPR resuming."*

## Capacity arithmetic moved in 16.3

If your instance-count model was built on numbers from 16.2 or earlier, it is now conservative:

> *"We replaced web streams with native Node.js streams in the App Router rendering layer, removing the overhead of converting between the two during server-side rendering."*

> *"In our benchmarks, apps handle up to 22% more requests under load, with no changes to application code."*

Two disciplines follow. First, re-measure before adding replicas — the same fleet may already have headroom. Second, treat "up to 22%" as what it says: a benchmark ceiling for SSR-bound workloads, not a guarantee for a workload dominated by database latency.

## Gotchas

**★ Server Actions failing intermittently across replicas with "Failed to find Server Action".**
Each build generates its own Server Function encryption key, so a form encrypted by replica A cannot be decrypted by replica B. Set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` at build time to a base64 value of 16, 24 or 32 bytes and use the same one everywhere. It reproduces at exactly zero replicas of load in staging and constantly in production, which is why it is misdiagnosed as a networking fault.

**★ Shipping `output: 'standalone'` without copying `public/` and `.next/static`.**
The minimal server does not copy them, by design, because they should be on a CDN. Deploy the standalone folder alone and the site loads with no styles, no scripts and no images. Either copy both into the standalone tree or actually put them on a CDN — but pick one deliberately.

**★ Believing `deploymentId` makes rolling deployments seamless.**
It converts a *broken* client navigation into a *full page reload*, which loses `useState` and anything else not in the URL or local storage. Actual seamlessness requires deployment-aware routing, and Next.js explicitly does not provide it: *"Next.js does not read the `?dpl=` query parameter on incoming requests."* That routing is your load balancer's job.

**★ Adding a shared cache and expecting `revalidateTag()` to propagate.**
Shared storage makes entries visible; it does not tell other instances that a tag was invalidated. Implement `refreshTags()` on the cache handler so each instance syncs tag state from shared storage before serving a request. Without it, instances serve stale content until their own TTLs lapse.

**★ Calling `revalidateTag()` and not purging the CDN.**
On-demand revalidation invalidates the Next.js server cache only. A CDN holding the page under `s-maxage` keeps serving it until the TTL expires — potentially a year for a fully static page. Purge both the HTML and the RSC variant of every affected key alongside the revalidation call.

**★ Placing `proxy.js` behind the CDN cache.**
Proxy is the source of truth for auth, redirects and rewrites. If the CDN answers from cache before proxy runs, an authenticated redirect never happens and a cached authenticated page can be served to an anonymous visitor. Run proxy in front of the cache, or configure the cache to bypass every route whose behaviour depends on a proxy decision.

**★ Buffering somewhere in the chain and silently losing PPR.**
Nothing errors. The static shell and the dynamic content simply arrive together, after the full render, and PPR's entire time-to-first-byte benefit evaporates. Check the load balancer (AWS ALB with Lambda integration is named specifically), any reverse proxy, and nginx's default buffering — for which the documented remedy is `X-Accel-Buffering: no`.

**★ Killing pods before `after()` callbacks drain.**
`after()` work runs during graceful shutdown. The guidance is a 10–30 second drain period on `SIGINT`/`SIGTERM`. A short `terminationGracePeriodSeconds`, or an orchestrator that escalates to `SIGKILL` quickly, drops analytics writes, audit logs and cache warms with no error surface at all.

**★ Choosing a static export for an app that will need a server later.**
Export is the only option in the matrix with genuine feature loss, and the boundary is sharp: anything requiring the Next.js runtime is unsupported. Route Handlers survive only as `GET` with `dynamic = 'force-static'`. If there is any prospect of authentication, ISR or Server Actions, the container is the same amount of work and keeps every door open.

**★ Sizing the fleet on pre-16.3 SSR throughput numbers.**
The App Router's rendering layer moved from web streams to native Node.js streams in 16.3, and the release reports *"up to 22% more requests under load, with no changes to application code."* A capacity model carried forward from 16.2 will over-provision an SSR-bound service. Re-measure rather than either ignoring the change or assuming it applies to a database-bound workload.

## Interview questions

**★ What does Next.js actually require from a hosting platform?**
A Node.js server, plus `sharp` for Image Optimization. That covers every feature: Server Components, ISR, PPR, Cache Components, Server Actions, Proxy and `after()`. Streaming support is needed for PPR and Server Components to deliver progressively — without it responses are buffered and sent whole, which still works but loses the benefit. Everything else — CDN caching, edge compute, shared cache — improves performance and multi-instance consistency rather than enabling features.

**★ A team moves from one replica to three and Server Actions start failing intermittently. What is wrong?**
The Server Function encryption key. Next.js encrypts closure variables for Server Functions and generates a unique key per build; with multiple instances, all of them must share it or an action encrypted by one cannot be decrypted by another, producing "Failed to find Server Action". Fix it by setting `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (base64, 16/24/32 bytes) at build time across the fleet.

**★ What exactly does `deploymentId` protect against, and what does it not do?**
It protects against version skew: missing assets, Server Function ID mismatches, and prefetched page data from an old deployment. It appends `?dpl=` to asset URLs, sends and reads deployment-ID headers on navigations, sets a `data-dpl-id` attribute, and includes itself in the `'use cache'` cache key. What it does *not* do is route: Next.js never reads `?dpl=` from an incoming request. A skew mismatch triggers a hard reload, not a correct navigation — deployment-aware routing has to come from the host or CDN.

**★ You have a shared Redis cache handler and `revalidateTag()` still does not propagate. Why?**
Because shared storage and tag coordination are different problems. `revalidateTag()` invalidates on the instance that ran it; other instances have no idea until they check. The cache handler must implement `refreshTags()`, which Next.js calls before each request so the instance can sync tag state from shared storage before deciding whether its cached entry is still valid.

**★ Why does on-demand revalidation not reach a CDN, and what is the fix?**
`revalidateTag()`/`revalidatePath()` invalidate the Next.js server cache. The CDN holds its own copy under the `s-maxage` it was given and knows nothing about the call. The documented pattern is to purge the CDN alongside the revalidation, for both the HTML and the RSC variant of each affected key.

**★ Where should `proxy.js` sit relative to the CDN cache, and why?**
In front. It is the source of truth for auth, redirects and rewrites, so a CDN that answers from cache before proxy runs can serve content that the proxy would have blocked or redirected. If your topology forces proxy behind the cache, configure the cache to bypass every route whose behaviour depends on a proxy decision.

**★ PPR is enabled and the time-to-first-byte is unchanged. What do you check?**
Buffering, at every hop. The static shell only helps if it can be sent before the dynamic work finishes. Check the load balancer for chunked-transfer support (AWS ALB with Lambda integration is called out as a default-buffering case), any reverse proxy in between, and nginx, where the documented remedy is setting `X-Accel-Buffering: no`. If anything in the chain buffers, shell and body arrive together and PPR delivers nothing.

**★ How did 16.3 change capacity planning, and how much of that should you bank?**
The App Router's rendering layer replaced web streams with native Node.js streams, removing conversion overhead during SSR; the release notes report up to 22% more requests under load with no application changes. Bank it only after measuring your own workload: the figure is a benchmark ceiling for SSR-bound traffic, and a service dominated by database latency will see proportionally less. The right response is to re-measure before scaling, not to assume either 0% or 22%.

**★ When is a static export the right answer, and when is it a trap?**
Right when the site genuinely has no server-side needs — documentation, marketing, a client-rendered SPA whose data comes from a separate API. A trap the moment authentication, ISR, Server Actions or dynamic Route Handlers appear on the roadmap, because export supports only `GET` handlers with `dynamic = 'force-static'` and nothing that needs the Next.js runtime. A container costs about the same effort and keeps every option available.

{/* FOOTER */}
