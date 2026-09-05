---
title: "Static export is the right answer when the artifact has to leave your infrastructure — and a serverful deployment is worth its bill because the docs' minimum is one Node process, with everything above that being performance fidelity rather than correctness"
sidebar_label: "04c · When export wins, what a server buys"
sidebar_position: 16
description: "The cases where output: 'export' is genuinely correct — docs sites, embedded artifacts, air-gapped deploys — against what a Node.js server and an edge network actually buy, using Next.js 16.3.4's own functional-vs-performance fidelity framing and its feature and CDN capability matrices."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Deploying to Platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms) (docs `lastUpdated` 2026-03-30), [Rendering Philosophy](https://nextjs.org/docs/app/guides/rendering-philosophy) (`lastUpdated` 2026-03-30), [Deploying](https://nextjs.org/docs/app/getting-started/deploying) (`lastUpdated` 2026-08-25) and [How to create a static export](https://nextjs.org/docs/app/guides/static-exports) (`lastUpdated` 2026-08-25).
> Target: **Next.js 16.3.4**, App Router. Documentation-verified (T2); `next` is **not installed in this checkout**, so **no package probe and no sandbox run**. 🔴 **No prices, no benchmark figures and no invoice comparisons appear on this page** — the cost sections name what drives a bill, and [ch17 · cost engineering](../17-deployment-scaling-and-observability/05-cost-engineering-function-compute-bandwidth-and-edge-cache-h.md) owns the mechanics.

**[04](04-full-static-export-vs-serverful-edge-distribution.md) and [04b](04b-what-survives-and-the-force-static-trap.md) made the trade concrete. Now the honest half: static export is sometimes exactly right, and the cases share one property — the artifact has to survive outside your infrastructure. A docs site that ships in a release tarball, an admin UI baked into a device image, a build handed to a regulated customer who will host it themselves: none of these can depend on a process you operate. Everywhere else, read the documentation's own minimum before assuming a server is expensive: *"To run Next.js, your platform needs a Node.js server. That's it."* One `next start` process is documented to handle every feature correctly. Everything a CDN or edge network adds on top of that is, in the docs' own vocabulary, performance fidelity — not correctness.**

## Four cases where export is the right answer

### 1 · The artifact ships somewhere you do not operate

A documentation site bundled into a release tarball. An onboarding UI baked into a device
image. A dashboard a regulated customer will host inside their own network, on infrastructure
you will never see. In every one of these, "there is no server" is not a limitation you accepted
— it is the requirement. An `out/` directory is a deliverable; a Node process is a support
contract.

This is also the criterion that makes the decision cheap: **if the build output is something
someone else takes away, export.** If it is something you serve, keep reading.

### 2 · Content changes only when the repository changes

A docs site, a spec, a changelog, an engineering handbook. The content lives in Markdown in the
same repository as the code, so *every* content change is already a commit and already triggers
a build. In that world, the ISR removal costs nothing at all — you were never going to update
content without a deploy. The whole of item 9 on the unsupported list is free.

The trigger to re-examine this is the day the content moves to a CMS. It stops being free that
afternoon.

### 3 · Air-gapped or certification-constrained deployment

Where every running process has to be inventoried, patched and certified, a directory of files
served by an already-approved web server is materially less work than an approved Node runtime
plus a patch cadence for it. This is a real, defensible reason and it has nothing to do with
performance. The docs' own deployment list backs it: an export is servable *"on any web server
that can serve HTML/CSS/JS static assets"*, and the guide names S3, Nginx and Apache.

### 4 · The organisational constraint, stated honestly

Sometimes the reason is that you can get an S3 bucket approved in a day and a container platform
in a quarter. That is a legitimate reason to choose export, and it is worth writing down *as
that reason* in the ADR, because it is the one that expires. When the container platform lands,
the technical justification for export evaporates and only inertia is left.

**Where export is usually the wrong answer**, and worth naming so the decision is symmetric: a
marketing site with a CMS behind it (Draft Mode and ISR are the two features you lose and the
two that team wants most), anything with a login, anything with a form, anything with more
content than your CI timeout tolerates enumerating.

## What a server buys, in the documentation's own terms

The minimum, verbatim:

> *"To run Next.js, your platform needs **a Node.js server**. That's it."*

> *"A single `next start` process handles every Next.js feature correctly: Server Components, ISR, PPR, Cache Components, Server Actions, Proxy, and `after()`."*

> *"The only additional dependency is the `sharp` package, which is required for Image Optimization."*

And the deployment support table from [Deploying](https://nextjs.org/docs/app/getting-started/deploying):

| Deployment Option | Feature Support |
|---|---|
| Node.js server | **All** |
| Docker container | **All** |
| Static export | **Limited** |
| Adapters | Varies (verified adapters run the test suite) |

That table is the load-bearing one for this whole chunk. A container is not a compromise
position between export and a managed platform — it is a full-fidelity target. See
[ch17 · self-hosting with Docker](../17-deployment-scaling-and-observability/02-self-hosting-docker-containerization.md).

### Functional fidelity vs performance fidelity — the distinction to argue with

> *"**Functional fidelity** means every Next.js feature works correctly. The adapter test suite is the contract: if a platform's adapter passes the tests, it supports Next.js. This is binary: it passes or it doesn't."*

> *"**Performance fidelity** means features achieve their optimal performance characteristics. Examples include PPR's static shell served at CDN latency rather than origin latency, or ISR serving stale content instantly with sub-second revalidation propagation."*

> *"A platform that achieves functional fidelity is a fully supported deployment target for Next.js. Performance fidelity is how platforms differentiate, and it improves incrementally over time."*

This is the sentence that dissolves most "do we need the edge" arguments. The edge does not
make features work; it makes working features fast. A PPR shell served from an origin in one
region is *correct*, just further away.

### The feature matrix — what infrastructure each feature actually needs

> *"The 'Edge Stitching' column is a **performance optimization**, not a correctness requirement. All features work correctly from a single origin server."*

| Feature | Streaming | Shared Cache | Edge Stitching |
|---|---|---|---|
| Server Components | Required | No | No |
| ISR (time-based) | No | Recommended | No |
| ISR (on-demand) | No | Recommended | No |
| Partial Prerendering | Required | Recommended | Optional |
| Cache Components (`use cache`) | Required | Recommended | No |
| Proxy / Middleware | No | No | No |
| Server Actions | Required | No | No |
| `after()` | No | No | No |

Two definitions that make the table usable:

> *"**Streaming Required** means the platform must support chunked transfer encoding or HTTP/2 streaming and must not buffer the response before sending it to the client."*

> *"Without shared cache, each instance maintains its own cache independently — features still work correctly on each instance, but revalidation events don't propagate across instances."*

Read the second one twice before you scale a self-hosted deployment from one instance to three.
It is the single most common surprise in self-hosted ISR: a `revalidateTag` served by instance
A leaves instances B and C stale, and the user's next request lands on B. See
[ch5 · revalidation and lifetimes](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05-revalidation-and-lifetimes.md)
and [ch17 · multi-region and data locality](../17-deployment-scaling-and-observability/03-multi-region-strategies-and-data-locality-patterns.md).

The cache configuration splits in two, and the split matters when you wire a Redis behind it:
`cacheHandler` (singular) *"covers server cache paths like ISR, route handlers, patched
`fetch`/`unstable_cache`, and image optimization"*; `cacheHandlers` (plural) *"configures
`'use cache'` directive backends."*

### Edge distribution, concretely

The docs' CDN capability table names the primitives, and its framing is deliberately
unflattering:

> *"These are available building blocks, not finished integrations."*

| CDN | Edge Compute | Key-Value / Tags | Blob Storage | PPR Resuming |
|---|---|---|---|---|
| Cloudflare | Workers | KV | R2 | Yes (worker) |
| Akamai | EdgeWorkers | EdgeKV | Object Storage | Yes (worker) |
| Amazon CloudFront | Lambda@Edge | KeyValueStore | S3 | Yes (Lambda) |
| Fastly | Compute | KV Store | Object Storage | Yes (WASM) |
| Azure | Functions | Managed Redis | Blob Storage | Yes (server) |
| Google Cloud | Cloud Run | Various KV | Cloud Storage | Yes (server) |

> *"Most community adapters today deploy Next.js as a Docker container or Node.js server without leveraging CDN-specific primitives like edge KV or PPR resuming."*

So "serverful edge distribution" in practice means: prerendered HTML and RSC payloads cached at
CDN nodes worldwide, dynamic work executed at an origin (or a regional function), and the
static shell of a PPR page potentially served from the node while the dynamic holes stream from
origin. The last of those is the part that is *"still emerging and may require bespoke platform
work"* per the docs. See [ch5 · composing static, ISR and dynamic on one page](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/01b-composing-the-three.md)
and [ch17 · Vercel and the edge network](../17-deployment-scaling-and-observability/01-vercel-automated-deployments-edge-network-preview-branches.md).

### Why the model demands this in the first place

> *"Next.js's rendering model places the static/dynamic boundary at the component level rather than the route level. Finer-grained boundaries provide more flexibility for developers at the cost of broader requirements for hosting platforms. This is a deliberate trade-off."*

> *"The trade-off is infrastructure complexity. A finer-grained rendering boundary transfers complexity from application code into the hosting platform."*

A static export is the far end of the same axis: it transfers *all* the complexity back into
application code and build configuration, and asks nothing of the platform. That is a coherent
position. It is just not a free one.

## The cost model of each — what drives the bill

🔴 No numbers here, deliberately. What follows is the set of meters, because which meter is
running is the part that generalises; the rates are not, and inventing them would be worse than
useless.

**Static export bills:**

- **Object storage** for the `out/` directory — proportional to page count × page weight, and
  to how many deploys you retain.
- **Egress bandwidth** — proportional to traffic × page weight. This does not disappear with
  a static site; it is usually the largest line.
- **Build minutes** — proportional to *content count*, because enumeration is mandatory. This
  is the meter that surprises people, and it is the one that grows without anyone deciding.
- **An image service**, if you used a custom loader — now a vendor invoice with its own
  per-transform meter.
- **Zero per-request compute.** This is the whole reason anyone chooses it.

**Serverful bills:**

- **Compute** — invocations and duration, or a container's provisioned time. Driven almost
  entirely by *cache hit ratio*: a request served from the cache does not run your code.
- **Egress bandwidth** — the same meter as above, at similar volume.
- **Cache storage and cache reads** — the shared cache backend, if you run one.
- **Image optimization compute** — `sharp` runs on your machines rather than a vendor's.
- **Build minutes** — smaller, because you can prerender the head and generate the tail on
  demand.

**The single lever that matters on the serverful side is the cache hit ratio**, because it is
what converts a compute charge into a bandwidth charge. A fully-cached serverful page and a
static export page bill nearly the same way; the difference is entirely in the requests that
miss. That is why "static export to save money" is often the wrong optimisation: if your pages
are cacheable, ISR already gets you the static bill, *and* keeps the thirteen features. If they
are not cacheable, an export could not have served them anyway.

[ch17 · cost engineering](../17-deployment-scaling-and-observability/05-cost-engineering-function-compute-bandwidth-and-edge-cache-h.md)
owns the mechanics of all of the above; this page only draws the rendering consequence.

## Gotchas

**★ Symptom: a team chooses static export to reduce hosting cost, and the bill barely moves.** Cause: egress bandwidth was the dominant line, and it is identical under both models. Compute was small because the pages were already cacheable. Fix: measure which meter dominates before choosing — if the answer is bandwidth, the rendering strategy is not the lever, and [ch17 · cost engineering](../17-deployment-scaling-and-observability/05-cost-engineering-function-compute-bandwidth-and-edge-cache-h.md) has the ones that are.

**★ Symptom: "we need the edge" turns into a six-week platform project for a product with users in one country.** Cause: conflating functional fidelity with performance fidelity. Every feature works correctly from a single origin server — the docs say so about the Edge Stitching column explicitly. Fix: name the latency requirement first, in milliseconds and for a named user population, and only then decide whether edge distribution is what closes it. Often a CDN in front of an origin closes it without any Next.js-specific integration.

**★ Symptom: self-hosted ISR goes stale on some instances after a `revalidateTag`, and the staleness follows no pattern.** Cause: no shared cache — each instance keeps its own, so an invalidation event reaches only the instance that handled it, and load balancing decides who sees what. Fix: configure `cacheHandler` (and `cacheHandlers` for `use cache` entries) against a shared backend before scaling past one instance. The matrix marks shared cache "Recommended" for both ISR rows, which understates how confusing its absence is to debug.

**★ Symptom: a build succeeds on the platform but streams nothing — the whole page arrives at once and PPR appears to do nothing.** Cause: the platform buffers responses. The docs are explicit that streaming means chunked transfer encoding or HTTP/2 streaming *and* not buffering; without it *"responses are buffered and sent as a whole, which still works but loses the streaming performance benefit."* Fix: check for a buffering reverse proxy in front of the app — this is a platform property, not an application bug, and no amount of Suspense boundary tuning will fix it.

**★ Symptom: image optimization fails only in the container, and only in production.** Cause: `sharp` is documented as the one additional dependency for Image Optimization, and it is a native module — output file tracing does not always include native binaries. Fix: add it explicitly, as the `output` reference itself suggests, with an `outputFileTracingIncludes` entry such as `'/*': ['node_modules/sharp/**/*']`. See [ch17 · self-hosting with Docker](../17-deployment-scaling-and-observability/02-self-hosting-docker-containerization.md).

**★ Symptom: the docs site's CI job doubles in duration after a content migration, and nobody changed the pipeline.** Cause: export makes build minutes proportional to content count. A CMS import of a few thousand legacy pages is a build-time change disguised as a content change. Fix: this is the review trigger for the whole decision — when content volume becomes a build-time variable you do not control, the case for export in item 2 above has expired.

**★ Symptom: an "air-gapped" static export still calls out to an image CDN and a client-side analytics endpoint.** Cause: the custom image loader and client-side fetching both point at the internet by construction. Fix: for a genuinely air-gapped target use `images: { unoptimized: true }` with pre-sized assets, and audit every client `fetch` — the mode removes *your* server, not every network dependency, and this distinction is what fails a security review.

**Symptom: a PPR page's static shell is served from the origin, not the edge, on a platform that advertises edge compute.** Cause: PPR resuming needs the platform to store the shell separately and resume dynamic rendering — the docs call end-to-end support *"still emerging"* and note most community adapters do not use CDN primitives at all. Fix: verify it against the platform's own documentation rather than the CDN capability table, which lists building blocks and says so.

## Interview questions

**★ Give a case where static export is unambiguously the right choice.**
When the build output has to leave your infrastructure: docs bundled into a release tarball, a UI baked into a device image, a build handed to a regulated customer to host themselves. In those cases "no server" is the requirement, not the compromise. The secondary case is content that only changes when the repository changes — a handbook or a spec in Markdown — because then the ISR and Draft Mode removals cost literally nothing, since no content change was ever going to happen without a deploy.

**★ What does an edge network actually buy a Next.js app, in the framework's own terms?**
Performance fidelity, not functional fidelity. The docs define the two explicitly and state that all features work correctly from a single origin server; the "Edge Stitching" column of the feature matrix is labelled a performance optimization. So the edge buys you a PPR static shell at CDN latency instead of origin latency, and ISR stale-serving with faster invalidation propagation. It does not buy you a feature you did not otherwise have. That reframing usually shortens the argument considerably.

**★ Your team wants to cut hosting spend and proposes static export. How do you evaluate it?**
Ask which meter dominates. Egress bandwidth is identical under both models, so if that is the big line, export changes nothing. Compute is driven by cache hit ratio, so if the pages are already cacheable, ISR gives you the static bill while keeping all thirteen features — and if they are not cacheable, export could not have served them. The only genuine saving is on uncacheable-but-not-really pages, which is a caching problem, not a rendering-mode one. Then price the other side: build minutes now scale with content count, and an image service invoice may appear.

**★ Why does a shared cache stop being optional the moment you run more than one instance?**
Because ISR invalidation is per-instance without one. The docs put it plainly: each instance maintains its own cache, features still work correctly on each instance, but revalidation events do not propagate. So a `revalidateTag` handled by instance A leaves B and C serving the old content, and which one a user hits is a load-balancer decision. The symptom is intermittent staleness with no reproducible pattern — the worst class of bug to be handed.

**★ Is a Docker container a downgrade from a managed platform for Next.js?**
Functionally, no — the Deploying table marks both "Node.js server" and "Docker container" as supporting **All** features, and one `next start` process is documented to handle Server Components, ISR, PPR, Cache Components, Server Actions, Proxy and `after()` correctly. What you take on is the operational work the platform was doing: shared cache configuration, streaming-capable ingress, `sharp` in the image, graceful shutdown for `after()`, and multi-instance cache coordination. It is a staffing question, not a capability question.

**★ Why does Next.js's rendering model impose more on a hosting platform than a route-level framework does?**
Because the static/dynamic boundary sits at the component level, so a single response carries both prerendered and request-time content. That forces streaming, because the two parts arrive at different times; it forces cache coordination, because any cached fragment can be invalidated on demand; and it forces HTML/RSC-payload consistency, because a mismatch shows up as inconsistent data during client navigation. The docs describe this as a deliberate trade-off — flexibility in application code paid for with requirements on the platform. Static export is the opposite end of that same axis.

**★ What is the review trigger that would make you revisit a static-export decision?**
Three concrete ones. Content moves from the repository to a CMS — Draft Mode and ISR stop being free that day. Build duration crosses a threshold you would notice during an incident, because enumeration is mandatory and content count now drives it. Or a login appears anywhere in the product, which makes `cookies()` load-bearing and takes the whole mode off the table. Any one of those should reopen the decision rather than trigger a workaround.

---

← [04b · What survives, and the `force-static` trap](04b-what-survives-and-the-force-static-trap.md) · [Chapter 6 overview](01-explanation.md) · Next → [04d · The migration back, and the one-way door](04d-the-migration-back-and-the-one-way-door.md)
