---
title: "The Edge Runtime is deprecated, so \"global compute\" in Next.js 16 is no longer a runtime you opt into — it is a CDN in front of one Node.js server and a cache handler behind it, and both of those are things you configure rather than declare"
sidebar_label: "05 · Edge and custom cache structures"
sidebar_position: 5
description: "Topic index: why `export const runtime = 'edge'` is deprecated, what actually makes an application global now, and how to write the custom cache handler that makes revalidation propagate across instances."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js 16.3.4 documentation — [`runtime` segment config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime), [Edge Runtime Deprecated](https://nextjs.org/docs/messages/edge-runtime-deprecated), [Deploying to Platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms), [Using a CDN](https://nextjs.org/docs/app/guides/cdn-caching), [`cacheHandlers`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers), [How revalidation works](https://nextjs.org/docs/app/guides/how-revalidation-works).
> Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4** · React 19.2.8 · Node 24.20.0.

**This topic was planned when "edge functions" meant a second JavaScript runtime you opted a route into. In Next.js 16.3.4 that option is deprecated — the documentation lists `'edge'` as deprecated on the `runtime` segment config and tells you to delete the export, because *"The Node.js runtime is the default, so no replacement is needed."* So the honest version of this topic is not how to write an edge function. It is what "global" costs once there is exactly one runtime: a CDN in front of your server, a cache handler behind it, and a set of headers that have to survive the trip. Those are the three things that actually make an application fast in more than one region, and none of them is a directive you write in a route file.**

## The reframing, in one paragraph

Next.js states the hosting requirement about as plainly as a framework can:

> *"To run Next.js, your platform needs **a Node.js server**. That's it."*
> *"A single `next start` process handles every Next.js feature correctly: Server Components, ISR, PPR, Cache Components, Server Actions, Proxy, and `after()`."*
> — [Next.js · Deploying to Platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms)

And it separates correctness from speed explicitly, which is the distinction this whole topic turns on:

> *"Additional infrastructure (CDN caching, edge compute, shared cache) primarily improves **performance** and multi-instance consistency."*
> *"The \"Edge Stitching\" column is a **performance optimization**, not a correctness requirement. All features work correctly from a single origin server."*

Everything in this topic is therefore optional in the sense that your application works without it, and mandatory in the sense that your application is slow and inconsistent without it. That is a much more useful framing than "should I use the edge runtime", and it is also the reason the deprecation is not a loss.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The Edge Runtime is deprecated](05b-the-edge-runtime-is-deprecated.md)** | 🔴 what the docs actually say, what to delete, why Proxy is a special case, and what is *not* claimed — there is no announced removal version |
| 2 | **The CDN layer and `Cache-Control` by rendering strategy** *(not written yet)* | the exact headers Next.js emits for static, ISR and dynamic pages, and why `s-maxage` is the number that decides your bill |
| 3 | **`Vary`, the `_rsc` parameter and what a CDN must forward** *(not written yet)* | the `rsc` header, the 307 hash redirect, and the navigation bug a stripped header produces |
| 4 | **The on-demand revalidation gap** *(not written yet)* | 🔴 `revalidateTag()` does not reach your CDN, and what to do about it |
| 5 | **Writing a custom cache handler** *(not written yet)* | the `get`/`set`/`refreshTags`/`getExpiration`/`updateTags` interface and the `CacheEntry` shape |
| 6 | **Streams, partial writes and failure semantics** *(not written yet)* | `.tee()`, why a throwing `get()` is a render error rather than a miss, and why `set()` failures are invisible |
| 7 | **[A shared cache across instances](05h-a-shared-cache-across-instances.md)** | 🔴 revalidation is local by default — one instance invalidating its own copy is the default behaviour, not a bug |

⚠️ **Scope boundary against [ch05](../05-caching-ppr-and-cache-components/01-explanation.md).** That chapter owns the caching *model* — `use cache`, `cacheLife`, PPR, where a cached value physically lives, and what `use cache: remote` means. This topic owns the *infrastructure*: the runtime question, the CDN in front, and the handler you write yourself. Where the two touch, ch05 is the reference and this topic links it.

## Phase gate

You are done with this topic when you can take an application that is correct on one server and make it fast in three regions without changing a route file — naming which headers the CDN must forward, which cache entries are shared and which are per-instance, and what happens to a `revalidateTag()` call at each layer it passes through.

## Where this connects

- [ch05 · Caching, PPR and Cache Components](../05-caching-ppr-and-cache-components/01-explanation.md) — the model this topic deploys
- [01b · The three kinds of pool](01b-the-three-kinds-of-pool.md) — the other thing that does not get faster by being closer to the user
- [04 · Background jobs and message queues](04-background-jobs-and-message-queues-for-async-workloads.md) — where work goes when a request cannot hold it
- [ch17 · Deployment, scaling and observability](../17-deployment-scaling-and-observability/01-explanation.md) — the platform view of the same decisions

---

← [04 · Background jobs and message queues](04-background-jobs-and-message-queues-for-async-workloads.md) · Start → [05b · The Edge Runtime is deprecated](05b-the-edge-runtime-is-deprecated.md)
