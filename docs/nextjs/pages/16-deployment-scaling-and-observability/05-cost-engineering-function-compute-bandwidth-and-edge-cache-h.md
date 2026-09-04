---
title: "Under Fluid compute the meter that never pauses is memory, not CPU — so a route that waits 400 ms on a database is billed for the waiting, and the single largest lever on the whole invoice is whether a request reaches a function at all"
sidebar_label: "05 · Cost engineering"
sidebar_position: 9
description: "The billable meters and what moves each: Active CPU versus Provisioned Memory versus Invocations, Edge Requests and Fast Data Transfer, image transformations billed on cache MISS and STALE, build minutes, regional price variation, measuring payloads after 16.0 removed First Load JS, and the caching decisions that move all of them at once."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Vercel documentation — [Fluid compute pricing](https://vercel.com/docs/functions/usage-and-pricing) (`last_updated: 2026-06-16`), [Pricing on Vercel](https://vercel.com/docs/pricing) (`2026-09-03`), [Calculating usage of resources](https://vercel.com/docs/pricing/how-does-vercel-calculate-usage-of-resources) (`2026-08-11`), [Limits and Pricing for Image Optimization](https://vercel.com/docs/image-optimization/limits-and-pricing) (`2026-08-11`), and the Next.js [`next` CLI reference](https://nextjs.org/docs/app/api-reference/cli/next) (`version: 16.3.4`, `lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4**. Documentation-verified, **no sandbox run** and **no measurements**: every figure below is quoted from the pricing pages as published on the date above. **Prices move — read the live page before quoting a number to a finance team.**

**Cost on a modern Next.js platform is not a hosting question, it is a rendering-strategy question wearing a hosting costume. A cached request touches two meters: a network request to the CDN, and the bytes it sends back. A cache miss touches five: those two, plus an invocation, plus the CPU your code burns, plus the memory reserved for the whole time the instance is busy. That last one is the part people get wrong — under Fluid compute, Active CPU pauses while you wait on a database and Provisioned Memory does not. So the route that spends 400 ms waiting on Postgres is billed for the waiting, just on a different meter than you expected. Everything else on this page — image transformations charged on every cache MISS and STALE, build minutes rounded up and multiplied by vCPU count, region-dependent compute rates — is arithmetic around that central fact.**

## The meters

| Meter | Charged for | Moved by |
|---|---|---|
| **Edge Requests** | *"per network request to the CDN"* | request count, prefetching, asset count |
| **Fast Data Transfer** | *"data moved to the user from the CDN"* | payload size, image sizes, RSC payload size |
| **Invocations** | *"each request to your function"* | cache hit rate, prefetch, background revalidation |
| **Active CPU** | *"the CPU time your code actively consumes"* | rendering work, serialization, crypto, image work |
| **Provisioned Memory** | *"the entire instance lifetime in GB-hours"* | memory setting × how long requests are in flight |
| **Image transformations / cache reads / cache writes** | per transformation, per 8 KB read/write unit | distinct `src`/width/quality combinations, cache churn |
| **Build minutes** | CPU-minutes, rounded up | build frequency, machine size, `generateStaticParams` scale |

Hobby's included allowances, quoted: **Active CPU 4 hours**, **Provisioned Memory 360 GB-hrs**, **Invocations 1 million**, and for images **5K transformations**, **300K cache reads**, **100K cache writes** per month.

## 🔴 Active CPU pauses; memory does not

This is the sentence to memorise:

> *"**Vercel bills Active CPU only while your code is actually running. If the request is waiting on I/O, CPU billing pauses but memory billing continues**."*

And the illustration the docs give:

> *"If your function takes 100ms to process data but spends 400ms waiting for a database query, you're only billed for the 100ms of active CPU time. This means computationally intensive tasks (like image processing) will use more CPU time than I/O-heavy tasks (like making API calls)."*

Memory works the other way round:

> *"Billed for the entire instance lifetime in GB-hours. Continues billing while handling requests, even during I/O operations. … Memory is reserved for your function even when it's waiting for I/O. Billing continues until the last in-flight request completes."*

> *"After all requests complete, the instance is paused, and no CPU or memory charges apply until the next invocation. This means, you pay for memory whenever work is in progress, never for idle CPU, and nothing at all between requests."*

The documented worked example, quoted rather than computed here — a 4 GB function in São Paulo (`gru1`), 4 seconds of active CPU, instance alive 10 seconds including I/O:

> *"CPU: (4 seconds / 3600) × $0.221 = $0.0002456"*
> *"Memory: (4 GB × 10 seconds / 3600) × $0.0183 = $0.0002033"*
> *"Total: $0.0002456 + $0.0002033 = $0.0004489 for each invocation."*

Two design consequences fall out of the shape, not the numbers.

**A slow dependency is a memory bill.** Fixing an N+1 query or a serial waterfall reduces instance lifetime, which reduces GB-hours, even though the CPU meter barely moves. The waterfall work in [chapter 4](../04-data-fetching-in-the-app-router/01-explanation.md) is cost engineering.

**Concurrency is what makes memory cheap.** Each instance *"can handle multiple requests with optimized concurrency"*, so the same GB-hour is amortised across every request in flight. A route that holds an instance open on a serial chain of awaits while serving one request is the worst case on this meter.

## What a request actually consumes

The documentation walks an ecommerce journey and lists the meters at each step. Compressed:

| Request | Meters touched |
|---|---|
| Cached page from the CDN | Edge Requests + Fast Data Transfer only — *"Since it's static and cached on our global CDN, this only involves Edge Requests … and Fast Data Transfer"* |
| Browsing cached assets | Edge Requests + Fast Data Transfer |
| A stale ISR page being regenerated | Edge Requests + **Invocations** + **Active CPU** |
| A dynamic cart mutation | Edge Requests + Invocations + Active CPU + data transfer + the datastore's own meters |
| Middleware A/B test | Edge Requests |

That table *is* the cost model. Everything you can move from row three or four into row one removes three meters at once.

Two behaviours from elsewhere in the corpus sharpen it. Background regeneration is not free — *"Background regeneration (stale-while-revalidate) runs on the instance that receives the triggering request. On platforms with per-request billing, this background work counts as additional compute."* And prefetching is not free either — *"This per-link prefetch includes cached content that resolves after the destination URL is known. It costs a server invocation per prefetchable link."* A dense index page of 200 links is a very different invocation profile from a page of 5.

## Image optimization is a cache-behaviour bill

> *"Image transformations are billed for every cache MISS and STALE."*

> *"Image cache reads … It is *not* billed for every cache HIT, only when the image needs to be retrieved from the shared global cache. An image that has been accessed recently (several hours ago) in the same region will be cached in region and does *not* incur this cost."*

> *"Image cache writes … measured in 8KB units. It is billed for every cache MISS and STALE."*

So the cost driver is the **number of distinct cache keys**, and the cache key is derived from the source plus the transformation parameters. Practically: every additional width in `sizes`, every distinct `quality`, and every change to the source URL creates a new key that must be transformed once and written once.

```tsx
// A `sizes` value that implies four widths creates four cache keys per image.
// A cache-busting query string on the source creates a whole new set on every change.
<Image
  src={card.coverUrl}
  alt=""
  fill
  sizes="(max-width: 768px) 100vw, 640px"
/>
```

And the hard limits, which are correctness rather than cost:

> *"The maximum size for an transformed image is **10 MB**"*
> *"Each source image has a maximum width and height of 8192 pixels"*
> *"A source image must be one of the following formats to be optimized: `image/jpeg`, `image/png`, `image/webp`, `image/avif`. Other formats will be served as-is"*

The Hobby overage behaviour is unusually graceful and worth knowing before you see it in the wild:

> *"New images will fail to optimize and instead return a runtime error response with 402 status code. This will trigger the `onError` callback and show the `alt` text instead of the image"*

> *"Previously optimized images have already been cached and will continue to work as expected, without error"*

That is why the symptom of exceeding the limit is *some* images showing alt text — the already-cached ones keep working. It looks like a broken CDN and it is a quota.

## Build minutes are multiplied by cores

> *"Basic build machines are included with Hobby. For paid teams, Basic is priced at $0.007 per build minute, based on 2 vCPUs at $0.0035 per CPU minute."*

> *"The duration of the build is rounded up to the nearest minute and then multiplied by the number of CPUs on the machine type. For example, if a build took 2 minutes and 34 seconds and used the Enhanced machine type, it will be priced at $0.084 (3 minutes x 8 CPUs x $0.0035)."*

Two consequences. **Rounding up punishes many small builds** — ten one-minute builds cost more than one nine-minute build on the same machine. And **a bigger machine is only cheaper if it saves proportionally more wall-clock time than it adds cores**; four times the cores must produce a build under a quarter of the duration to break even.

The largest build-time lever in a Next.js app is how many routes you prerender — which is `generateStaticParams`, and which [chapter 6](../06-ssg-isr-and-ssr-strategy/02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md) covers at length. Enumerating 500,000 products at build time is a build-minutes decision before it is anything else.

## Measuring bytes after 16.0 removed the build-output numbers

Fast Data Transfer is a bytes meter, and the number you used to read off `next build` is gone. The 16.0 release removed the `size` and `First Load JS` columns from the build output, with the stated reason that *"We found these to be inaccurate in server-driven architectures using React Server Components"*. That is honest and it leaves a gap.

The replacement is a separate command, added in 16.1:

```bash
next experimental-analyze --output .next/diagnostics/analyze
```

It is Turbopack-native and *"Does not produce build artifacts"*, so it is an analysis pass rather than a build you then have to discard.

⚠️ If you reach for `@next/bundle-analyzer` instead, note that Turbopack has been the default bundler since 16.0 — a `webpack()` function in `next.config` is silently not read, which is exactly how a bundle-analysis setup ends up producing nothing while appearing to be configured. See [Appendix C · the CLI surface](../19-appendices/03c-appendix-c-the-cli-surface.md).

## Region changes the rate

Compute is priced per region. From the published table, Active CPU per hour ranges from **$0.128** in `iad1`, `cle1` and `pdx1` to **$0.221** in `gru1` (São Paulo), with `fra1` at **$0.184** and `hnd1`/`kix1` at **$0.202**; Provisioned Memory per GB-hour tracks the same spread, **$0.0106** to **$0.0183**.

So the multi-region argument from [03](03-multi-region-strategies-and-data-locality-patterns.md) has a second edge: spreading compute across regions not only usually raises latency, it can raise the unit rate as well. Cheapest and default happen to coincide.

## ⚠️ What I could not confirm

The pricing page as published on 2026-09-04 lists Vercel Functions, Image Optimization, Global Config, Web Analytics, Speed Insights, Drains, Observability, Blob, Microfrontends, bulk redirects and Builds. It does **not** publish a per-unit rate for **Edge Requests**, **Fast Data Transfer** or **ISR reads/writes** in that table, and the URL `vercel.com/docs/incremental-static-regeneration/usage-and-pricing` returned **404**. They are named as billable resources in the usage walkthrough, so they are metered — this page therefore describes *what moves them* and does not quote a price for them. Check the live pricing page and your own invoice breakdown for current rates rather than trusting a number from any secondary source, this one included.

## The decision table

| Change | Invocations | Active CPU | Provisioned Memory | Fast Data Transfer | Build minutes |
|---|---|---|---|---|---|
| Make a dynamic route static or ISR | ⬇⬇ | ⬇⬇ | ⬇⬇ | — | ⬆ |
| Raise `revalidate` / lengthen `cacheLife` | ⬇ | ⬇ | ⬇ | — | — |
| Add PPR so the shell is CDN-served | ⬇ (shell) | ⬇ | ⬇ | ⬇ | — |
| Fix a request waterfall | — | ⬇ | ⬇⬇ | — | — |
| Reduce prefetching on a dense index | ⬇⬇ | ⬇ | ⬇ | ⬇ | — |
| Prerender more routes at build | ⬇ | ⬇ | ⬇ | — | ⬆⬆ |
| Add `connection()` to a root layout | ⬆⬆ | ⬆⬆ | ⬆⬆ | — | ⬇ |
| Add a region | — | ⬆ (rate) | ⬆ (rate) | — | — |
| Add a `sizes` breakpoint | — | — | — | ⬇ (smaller files) | — |

The single most valuable row is the last-but-two, and it is the one people add by accident — see [01b](01b-vercel-environments-and-the-build-time-runtime-split.md).

## Gotchas

**★ Symptom: compute cost is high but CPU profiling shows the functions are idle.** Cause: Provisioned Memory is billed for the whole instance lifetime including I/O waits, while Active CPU pauses. You are paying for waiting, on the memory meter. Fix: shorten instance lifetime by removing serial awaits — parallelise independent fetches so the instance is busy for less wall-clock time:

```ts
const [board, members] = await Promise.all([getBoard(id), getMembers(id)])
```

**★ Symptom: invocations spike on a page nobody visits much.** Cause: prefetching. Each prefetchable link *"costs a server invocation per prefetchable link"* when the content resolves server-side, so a dense index multiplies one page view into many invocations. Fix: reduce the prefetchable surface on list-heavy routes — `prefetch={false}` on links below the fold, or paginate — and measure with the `next.rsc` span attribute from [04b](04b-opentelemetry-the-span-catalogue-and-trace-volume.md).

**★ Symptom: ISR pages are cheap to serve but the invocation count does not fall.** Cause: background regeneration runs on the instance that receives the triggering request and *"counts as additional compute"* on per-request billing. Fix: lengthen the revalidation window, or move to on-demand revalidation so regeneration happens when the data changes rather than on a timer — see [chapter 6 · revalidate budgets](../06-ssg-isr-and-ssr-strategy/03c-revalidate-budgets-and-time-based-versus-on-demand.md).

**★ Symptom: some images render as alt text and others are fine.** Cause: the image optimization quota was exceeded — new optimizations return 402 and trigger `onError`, while *"previously optimized images have already been cached and will continue to work as expected"*. Fix: raise the plan or reduce transformations. Diagnose it by noticing that the broken ones are always the *new* images, which no CDN fault would produce.

**★ Symptom: image transformation count is far higher than the number of images.** Cause: transformations are billed per cache MISS and STALE, and the cache key includes the transformation parameters — so each width in `sizes` and each `quality` value is its own key. Fix: reduce the breakpoint set to the widths your layout actually uses, and standardise on one `quality` value across the app.

**★ Symptom: image costs jumped after a storage migration with no traffic change.** Cause: the source URLs changed, so every key is new and every image is a MISS followed by a write. Fix: expect a one-off spike after any source-URL change, and avoid cache-busting query strings on image sources — they convert an image into an unbounded family of cache keys. Pinning `search` in `remotePatterns` is the related control; see [chapter 9](../09-styling-and-ui/04d-remote-patterns-is-a-security-control.md).

**★ Symptom: nobody can tell whether a change reduced the payload, because `next build` no longer prints sizes.** Cause: 16.0 removed the `size` and `First Load JS` columns as *"inaccurate in server-driven architectures using React Server Components"*. Fix: run the dedicated analysis command, which writes a report without producing build artifacts:

```bash
next experimental-analyze --output .next/diagnostics/analyze
```

**Symptom: a `@next/bundle-analyzer` setup produces no output and no error.** Cause: it is configured through a `webpack()` function in `next.config`, and Turbopack has been the default bundler since 16.0 — that function is silently not read. Fix: use `next experimental-analyze`, or opt that build back onto webpack deliberately and know that you have.

**★ Symptom: build cost rose sharply after enabling per-commit preview builds.** Cause: duration is *"rounded up to the nearest minute and then multiplied by the number of CPUs"*, so many short builds are penalised twice — by rounding and by core count. Fix: batch commits, skip builds for documentation-only changes, and size the build machine on measured wall-clock time rather than on the assumption that more cores are proportionally faster.

**★ Symptom: a bigger build machine cost more and did not save time.** Cause: the price is CPU-minutes, so doubling cores doubles the per-minute rate; it only pays if wall-clock time more than halves. Next.js builds are not perfectly parallel. Fix: measure the same build on both machine types before committing, and remember the rounding — a build that drops from 3:10 to 2:50 is billed as 3 minutes either way.

**★ Symptom: moving to a European region raised the bill as well as latency.** Cause: compute is priced per region and the default `iad1` is at the bottom of the published range while several others are materially higher. Fix: if the move was for latency, re-read [03](03-multi-region-strategies-and-data-locality-patterns.md) — moving compute away from the database usually raises latency too, so you may be paying more for a worse result.

**★ Symptom: a one-line change to the root layout doubled the invoice.** Cause: something request-time — `connection()`, `cookies()`, `headers()` — was called in a layout that wraps everything, opting every route into dynamic rendering. Fix: move it to the narrowest layout that needs it. This is the highest-leverage single line in the whole chapter, in both directions.

**Symptom: an unused image variant is still costing cache writes.** Cause: writes are billed on MISS and STALE, and a stale entry is rewritten when it is next requested even if only a crawler requests it. Fix: align image cache TTL with how often the source actually changes; a short TTL on a static asset is a recurring write charge for no benefit.

**Symptom: nobody can attribute cost to a feature.** Cause: the meters are per-project, and a Next.js project is one deployment containing every route. Fix: instrument first — the `next.route` attribute on the root span gives you per-route invocation and duration profiles, which is the only way to connect a line on the invoice to a page in the application.

## Interview questions

**★ Under Fluid compute, which meter keeps running while your function waits on a database, and why does that change how you optimise?**
Provisioned Memory. Active CPU pauses during I/O — the documentation says billing pauses when your code is waiting for external services — but memory is reserved for the whole instance lifetime and billing continues until the last in-flight request completes. So an I/O-bound route is billed mostly on memory, and the optimisation that moves the number is not making the code faster, it is making the *request shorter*: parallelising independent fetches, removing waterfalls, and letting the instance serve other requests concurrently while it waits.

**★ Walk through the difference in billable resources between a cache hit and a cache miss.**
A cache hit from the CDN touches two meters: an Edge Request for the network request, and Fast Data Transfer for the bytes returned. A miss adds three more: an Invocation, Active CPU for the time your code actually runs, and Provisioned Memory for the whole time the instance is busy — including the I/O wait. That is why cache hit rate is the dominant term in the whole model: it is not a 20% saving on one line, it is the difference between two meters and five.

**★ Why is a dense index page with 200 links a cost problem?**
Because prefetch is a server request. Route prefetching costs a server invocation per prefetchable link when the content resolves server-side, so one page view can produce a large multiple of invocations, plus the Edge Requests and data transfer for each payload. The routes where this bites are exactly the ones that look cheapest — a list page that renders quickly and links to a hundred detail pages. The controls are prefetch scope, pagination, and making the destinations cacheable so the prefetch is served from the CDN rather than a function.

**★ How are image transformations billed, and what does that imply about `sizes` and `quality`?**
Transformations are billed for every cache MISS and STALE, and cache writes likewise; cache reads are billed only when the image must come from the shared global cache rather than an in-region copy. Since the cache key includes the transformation parameters, every distinct width and quality is a separate key that must be transformed and written once. So a generous `sizes` list is a real cost — worth it when it saves substantially more Fast Data Transfer on mobile than it adds in transformations, and not worth it when the widths are cosmetic. One `quality` value across the application is nearly always right.

**★ Some images on a Hobby project render as alt text. What happened, and how do you know it is not a CDN problem?**
The image optimization quota was exceeded. New optimizations return a 402, which triggers the `onError` callback and shows the `alt` text; images that were already optimized are cached and keep working normally. The diagnostic tell is exactly that split — a CDN or origin fault would break old and new images alike, whereas a quota breaks only images that need a *new* transformation. That includes existing images at a new width, which is why it can look random.

**★ Why can a larger build machine cost more without saving time?**
Because builds are priced in CPU-minutes: duration rounded up to the nearest minute, multiplied by the number of vCPUs. The documented example — 2 minutes 34 seconds on an 8-CPU machine billed as 3 minutes × 8 CPUs — shows both effects. Quadrupling cores quadruples the rate, so it only pays if wall-clock time falls to under a quarter, and Next.js builds do not parallelise perfectly. The rounding also means shaving 20 seconds off a 3:10 build saves nothing at all.

**★ A team wants to reduce cost and proposes deploying to a cheaper region. Evaluate.**
The premise is true — compute rates vary by region, from $0.128 per Active CPU hour in `iad1`, `cle1` and `pdx1` up to $0.221 in `gru1` on the published table — but the default is already at the bottom of that range, so there is usually nowhere cheaper to go. And if the database stays where it is, moving compute increases every query round trip, which raises instance lifetime and therefore the memory meter. The cheap region and the correct region are the same region, and it is the one you are already in.

**★ What is the single highest-leverage line of code in a Next.js cost model, in both directions?**
A request-time API in the root layout. `connection()`, `cookies()` or `headers()` there opts every route in the application into dynamic rendering, converting cached responses into function invocations across the board — five meters instead of two, on every request. Removing it, or scoping it to the narrowest layout that needs the value, does the reverse. It is one line, it looks harmless in review, and it changes the shape of the entire invoice.

**Why is "our hosting bill is too high" usually a rendering-strategy conversation rather than a hosting one?**
Because the platform charges for work, and the framework decides how much work each request is. The meters map almost exactly onto rendering decisions: static and ISR routes are served from the CDN and touch two meters; dynamic routes invoke a function and touch five; prefetch turns navigations into server requests; `generateStaticParams` scale is build minutes; image `sizes` is transformations. Nothing on the invoice is decided by the hosting provider that is not first decided by a rendering choice in the codebase.

**Why is Fast Data Transfer harder to attribute since Next.js 16?**
Because the per-route `size` and `First Load JS` columns were removed from the build output in 16.0, on the stated grounds that they are inaccurate in server-driven architectures using React Server Components — a route's real payload now depends on which components are server-rendered and what the RSC payload contains, not on a static bundle graph. The replacement is `next experimental-analyze`, a Turbopack-native analysis pass that produces no build artifacts. The honest summary is that the old number was misleading and its absence is a correction, but you now have to run a separate command to get any number at all.

**How would you attribute cost to a feature in a Next.js application?**
Not from the invoice, which is per-project. Use the trace attributes: the root span carries `next.route` and `http.status_code`, so invocation counts and durations can be grouped per route pattern, and `next.rsc` separates prefetch traffic from user-initiated traffic. That gives a per-route profile you can multiply by the published rates to get a defensible estimate. It also usually shows that a small number of routes dominate, which turns a budget conversation into a short list of pages to cache.

---

← [OpenTelemetry and the span catalogue](04b-opentelemetry-the-span-catalogue-and-trace-volume.md) · [Chapter 16 overview](01-explanation.md) · Next → [Milestone: SprintDesk deployed twice](06-project-milestone-sprintdesk-deployed-twice.md)
