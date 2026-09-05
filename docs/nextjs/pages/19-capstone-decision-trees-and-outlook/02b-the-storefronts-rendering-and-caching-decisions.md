---
title: "The storefront's rendering decisions are all one decision asked five times — what may complete before a request exists — and the answers differ from SprintDesk's because a catalogue is shared, unbounded, and read mostly by people who are not logged in"
sidebar_label: "02b · Rendering and caching"
sidebar_position: 21
description: "Enumeration as a budget over category × facet × page, five staleness velocities on one product page, the blocking paths a stampede still uses, the shell/hole split for price and stock, the crawler's dynamic-render budget, where use cache: remote finally earns its round trip, and revalidateTag versus updateTag when a merchandiser publishes."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 — this page composes material already verified across chapters 5, 6, 8, 10 and 15 of this book against the Next.js 16.3.4 documentation. It introduces no new framework claims of its own; the storefront is a worked contrast case, not a product.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · React canary bundled by the App Router · Node.js **24.20.0**.

**Every rendering decision on the storefront is the same question with a different subject: *can this complete before a request exists, and if not, how small can the part that cannot be made?* SprintDesk answers "no, and it does not matter" almost everywhere, because a tenant-scoped board has nobody to share a prerender with. The storefront answers "yes" for most of the page and then fights hard over five specific values — price, stock, the cart badge, recommendations, and recently-viewed — because those five decide whether the shell exists at all. This chunk is those fights: how much of the catalogue to enumerate, how stale each value may be, which cache directive each read wants, and which invalidation function a merchandiser's publish should call.**

## Enumeration is a budget, and the catalogue makes it a cross product

SprintDesk has essentially no `generateStaticParams` problem — its dynamic segment is a board id behind a login, and there is nothing to prerender. The storefront's catalogue is the opposite: a large, known, public URL set, which is exactly the case the function was built for and exactly the case that gets out of hand.

[ch6 · 02](../06-ssg-isr-and-ssr-strategy/02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md) states the framing this page inherits — the returned array is a bill CI pays every deploy — and the framework argues against enumerating everything in its own words:

> *"Not every route needs to be prerendered. Every page you prerender increases build work and produces output that has to be stored and deployed. Many routes may never be visited before your next deployment, making that work unnecessary."*

The storefront's version of the trap is not the number of products. It is that a category route has more than one axis:

```
/c/shoes                                    1 URL
/c/shoes?sort=price_asc                     × sort options
/c/shoes?brand=acme&size=42                 × facet combinations
/c/shoes?page=7                             × pages
```

Facets and sort are `searchParams`, so they are not enumerable through `generateStaticParams` at all — they are URL data, and [ch2 · 10 · 03](../02-routing-and-navigation/10-instant-navigations/03-per-link-prefetching-and-incremental-adoption.md) is explicit that `params` and `searchParams` are structurally excluded from a shared App Shell. The combinatorial risk lives in the *path* segments, and the storefront's is the nested-category route:

> *"If multiple dynamic segments in a route use `generateStaticParams`, the child `generateStaticParams` function is executed once for each set of `params` the parent generates."*
> — quoted at [ch6 · 02c](../06-ssg-isr-and-ssr-strategy/02c-nested-segments-and-the-combinatorial-explosion.md)

**The rule that keeps this bounded is the one from that page: enumerate bottom-up, with one query and one `LIMIT`, so a single number bounds the whole prerender set.**

```tsx
// app/p/[slug]/page.tsx — one query, one bound, only pairs that exist
const PRERENDER_CAP = Number(process.env.PRERENDER_CAP ?? 2000)

export async function generateStaticParams() {
  const { rows } = await getPool().query<{ slug: string }>(
    `SELECT slug FROM products
      WHERE status = 'live'
      ORDER BY view_count_30d DESC, slug ASC
      LIMIT $1`,
    [PRERENDER_CAP]
  )
  return rows.map((row) => ({ slug: row.slug }))
}
```

The tail is not abandoned. Since 16.3 an unlisted URL is served the App Shell instantly and upgraded in the background — the mechanism and its version gate are at [ch5 · 03b](../05-caching-ppr-and-cache-components/03b-maximizing-the-shell-the-app-shell-and-what-crawlers-get.md). **That is what makes a cap defensible on a catalogue where it would not have been two minor versions ago.**

🔴 **The cap only works if the App Shell is genuinely URL-independent.** One `await params` above a boundary in the product layout ties the shell to a single URL and the entire long tail loses the instant path — the enumerated head stays fast and everything else gets slow, which reads as "ISR is broken". [ch5 · 03b](../05-caching-ppr-and-cache-components/03b-maximizing-the-shell-the-app-shell-and-what-crawlers-get.md) works the fix through: pass the promise down, await it below the boundary.

## Five velocities on one product page

[ch6 · 01b](../06-ssg-isr-and-ssr-strategy/01b-data-velocity-and-the-staleness-budget.md) uses this exact page as its worked example, and it is worth taking literally — velocity attaches to data, not to routes:

| Data | Who notices staleness | Where it goes |
|---|---|---|
| Marketing copy | nobody until the next campaign | shell, long profile |
| Category tree | a merchandiser, next working day | shell, long profile, tagged |
| Description | the editor who just saved | shell, tagged, invalidated on save |
| **Price** | the customer, at checkout | a hole, or a short-lifetime cached read |
| **Stock badge** | the customer, after purchase | a hole |

🔴 **The failure this table prevents is one value dragging the route down.** Someone notices the stock count is stale, reaches for the biggest available hammer, and now the marketing copy re-renders on every request forever. On SprintDesk this rarely happens because the route was already request-time; on the storefront it silently converts the most-visited pages on the site from CDN reads into function invocations, and nobody will unpick it because the change has no comment saying which value it was for.

The lifetimes are declared per cached scope, and the recommendation from [ch5 · 10 · 05](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05-revalidation-and-lifetimes.md) is to set `cacheLife` in every one of them rather than inherit `default`:

```tsx
// lib/catalog.ts
import { cacheLife, cacheTag } from 'next/cache'

export async function getProduct(slug: string) {
  'use cache'
  cacheLife('days')                 // changes when an editor saves, not on a clock
  cacheTag(`product:${slug}`)
  return db.products.bySlug(slug)
}

export async function getCategoryTree() {
  'use cache'
  cacheLife('hours')                // drifts on its own; no one invalidates it
  cacheTag('category-tree')
  return db.categories.tree()
}
```

Price and stock are deliberately absent from that file. They are the holes, and the next section is why.

## The shell, and the five holes

The product page as a tree, annotated with what each part is:

```tsx
// app/p/[slug]/page.tsx
import { Suspense } from 'react'

export default function ProductPage({ params }: PageProps<'/p/[slug]'>) {
  return (
    <article>
      {/* shell: title, images, description, specs, reviews */}
      <Suspense fallback={<ProductSkeleton />}>
        <ProductBody params={params} />
      </Suspense>

      {/* holes: each one small, each behind its own boundary */}
      <Suspense fallback={<PriceSkeleton />}>
        <Price params={params} />
      </Suspense>
      <Suspense fallback={<StockSkeleton />}>
        <StockBadge params={params} />
      </Suspense>
      <Suspense fallback={null}>
        <RecentlyViewed />
      </Suspense>
    </article>
  )
}
```

Two things about this shape are worth stating explicitly because they are the ones SprintDesk never has to think about.

**Each hole gets its own boundary.** Sharing one boundary between the price and the stock badge means the slower of the two gates both. On a board that is a cosmetic issue; on a product page the price is what the visitor is waiting for.

**The boundary is not what makes something dynamic.** [ch5 · 03](../05-caching-ppr-and-cache-components/03-partial-pre-rendering-ppr-static-shell-dynamic-holes-for-min.md) makes this the counter-intuitive point of the model: a `<Suspense>` boundary only says where a hole is *allowed* to be. Wrapping the description in one does not cost you anything; failing to wrap the price does.

## The crawler consumes your dynamic-render budget

This is the storefront-specific consequence of the fact quoted in [02](02-case-study-2-contrast-a-ppr-driven-e-commerce-storefront.md): a bot skips the shell and gets a full request-time render. Two things follow that a SaaS never has to plan for.

**A crawl of the catalogue is a full render of the catalogue.** Every indexable URL a crawler visits is a request-time render on the same meters as any other invocation — the ones enumerated in [ch17 · 05](../17-deployment-scaling-and-observability/05-cost-engineering-function-compute-bandwidth-and-edge-cache-h.md). On a large catalogue that is a real, recurring workload driven by a schedule you do not control.

**The bot render must not depend on anything build-only.** The general test from [ch5 · 03b](../05-caching-ppr-and-cache-components/03b-maximizing-the-shell-the-app-shell-and-what-crawlers-get.md) is that everything the shell relies on must also work at request time. On a storefront the tempting build-only input is a generated artefact — a facet index, a sitemap-derived category map, a pre-computed related-products file written by a build step and not shipped. It works for every human because humans get the shell, and it 500s for the crawler.

⚠️ **I could not find documentation stating whether the bot path reuses cached `use cache` entries during that full render.** The documented sentence says the *shell* is re-rendered rather than reused, and says nothing about the cache entries beneath it. Do not assume either way; the safe design — one that costs nothing if the optimistic reading is true — is to keep the shell's data reachable at request time, which you have to do regardless.

## Where `use cache: remote` finally earns its round trip

[ch5 · 10 · 03](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/03-use-cache-remote.md) lists the compelling cases and the disqualifying ones, and the storefront produces one clean example of each — which is why it is a better teaching case than SprintDesk, where the argument is muddier.

**Earns it:** a rate-limited pricing or tax service. Prices are read at request time (they are a hole), each serverless instance has its own ephemeral memory and a low hit rate, and the key space is small — a currency, a region, a tier. Few distinct keys, many requests each, a quota on the other end. That is precisely the documented shape: *"Rate-limited APIs — you risk hitting quotas; a shared cache collapses N requests into one."*

```tsx
// lib/pricing.ts — few keys, many hits, a quota upstream
import { cacheLife, cacheTag } from 'next/cache'

export async function getPriceBook(currency: string, region: string) {
  'use cache: remote'
  cacheLife('minutes')
  cacheTag(`pricebook:${currency}:${region}`)
  return pricingApi.fetchBook({ currency, region })
}
```

**Does not earn it:** the same directive on a search or facet query.

```tsx
// ❌ A network round trip attached to a permanent miss.
export async function searchProducts(q: string, facets: Record<string, string>) {
  'use cache: remote'
  return searchApi.query(q, facets)
}
```

Every distinct key value is a separate entry, and a free-text query plus an arbitrary facet map is very nearly unique per request. The documentation names this outcome directly — *"cache keys carry mostly unique values per request (search filters, price ranges, user-specific parameters) — utilization approaches zero."* You have added a remote lookup before every miss and bought nothing. **The code is indistinguishable from the version that works; only the cardinality differs.**

## `revalidateTag` versus `updateTag` when a merchandiser publishes

SprintDesk's invalidations mostly come from a Server Action performed by the person who needs to see the result, which is `updateTag`'s home ground. The storefront's dominant invalidation is a merchandiser publishing a price change, and it arrives from a CMS webhook — a Route Handler, where `updateTag` is not callable at all. [ch5 · 10 · 05b](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05b-revalidatetag-and-updatetag.md) has the signatures and the table; the storefront-specific part is which profile to pass.

```ts
// app/api/cms/revalidate/route.ts — the merchandiser's publish
import { revalidateTag } from 'next/cache'

export async function POST(request: NextRequest) {
  const { slug } = await verifyWebhook(request)
  revalidateTag(`product:${slug}`, 'max')     // stale is fine while it regenerates
  return Response.json({ revalidated: true })
}
```

`'max'` is the recommended profile because it produces a window long enough that requests are *always* served stale while regeneration runs. For a description or an image that is obviously right. **For a price it is obviously wrong**, and that is the one place the storefront departs from the default advice:

```ts
  revalidateTag(`price:${sku}`, { expire: 0 })   // stale is never served
```

`{ expire: 0 }` means the next request blocks until fresh data arrives. That is a deliberate purchase of latency to buy correctness — the framing from 05b is that the profile is the point past which correctness matters more than speed, and for a price displayed next to a buy button that point is immediately.

🔴 **The scaling trap is the broad tag.** `revalidateTag('catalog', { expire: 0 })` across a large catalogue turns every subsequent first request into a blocking render simultaneously — the stampede shape described at [ch6 · 03b](../06-ssg-isr-and-ssr-strategy/03b-the-stampede-and-what-the-framework-does-not-protect-you-from.md), with your own hand on the lever. Tag per entity, invalidate per entity, and reserve `{ expire: 0 }` for the values that genuinely cannot be stale.

## What the stampede protection does and does not cover

Worth restating in storefront terms, because the storefront is where a herd is actually possible. The stale path is structurally safe: *"the stale content continues to be served until the fresh content is ready"*, so nobody blocks and nobody renders. But [ch6 · 03b](../06-ssg-isr-and-ssr-strategy/03b-the-stampede-and-what-the-framework-does-not-protect-you-from.md) enumerates the paths that *do* block, and a storefront reaches for two of them routinely: `expire` having elapsed on a cold path, and a deliberate immediate expiry. It also records that whether N concurrent requests produce one background regeneration or N **is not settled by the documentation** — that page read three primary sources and found no mention of a lock, single-flight or coalescing, and declined to assert one. This page does not either.

The engineering answer is the one that works under both readings: cache the expensive part *below* the page, so duplicate regenerations converge on one cached data read rather than N database round trips.

## Gotchas

**★ Symptom: the enumerated head of the catalogue is fast and every other product page is slow, and it looks like ISR is not running.** Cause: something above a `<Suspense>` boundary awaited `params`, which ties the layout's shell to one URL and forfeits the reusable App Shell that every un-enumerated URL depends on. Fix: make the layout non-async and await the param inside the boundary — the exact change is shown at [ch5 · 03b](../05-caching-ppr-and-cache-components/03b-maximizing-the-shell-the-app-shell-and-what-crawlers-get.md), and it is usually deleting the word `async` from a signature.

**★ Symptom: `next build` doubles in length with no commit that could explain it.** Cause: `generateStaticParams` returns the result of a query against production data, so the array grew when the catalogue did. The eleven lines of TypeScript are identical; the `SELECT` is not. Fix: put an explicit environment-driven `LIMIT` on the enumeration, as in the query above, so one number bounds the deploy cost and it is visible in configuration rather than implied by a table's row count.

**★ Symptom: the product page renders per request even though only the stock badge needed to.** Cause: a runtime read escaped its boundary — most often a header component that reads a cookie, or a data helper hoisted above the `<Suspense>` wrapper during a refactor. Fix: every runtime read gets its own boundary and nothing above it awaits runtime data; the mechanism is [ch5 · 03](../05-caching-ppr-and-cache-components/03-partial-pre-rendering-ppr-static-shell-dynamic-holes-for-min.md) and the failure mode is the one [ch6 · 01b](../06-ssg-isr-and-ssr-strategy/01b-data-velocity-and-the-staleness-budget.md) calls one value dragging the route down.

**★ Symptom: `use cache: remote` was added to the search path and the hit rate is near zero while latency went up.** Cause: cache keys made of a free-text query and an arbitrary facet map are close to unique per request, so every lookup is a remote round trip followed by a miss. Fix: remove it. Reserve `remote` for reads with a small key space and a real upstream constraint — the price-book example above has three key components with tens of combinations between them and a quota on the other end.

**★ Symptom: a merchandiser publishes a price and customers keep seeing the old one for a while.** Cause: the webhook called `revalidateTag(tag, 'max')`, which is the recommended default precisely because it serves stale for a long window while regeneration runs. Fix: prices are the exception — call `revalidateTag` on the per-SKU price tag with `{ expire: 0 }` so stale is never served and the next request blocks for the correct value:

```ts
revalidateTag(`price:${sku}`, { expire: 0 })
```

**★ Symptom: after a bulk catalogue import, the site becomes slow all at once and recovers over several minutes.** Cause: an invalidation over a broad tag with an immediate expiry, so every path lost its stale copy simultaneously and the next request for each one blocked on a render. Fix: tag per entity and invalidate per entity, and if a bulk change genuinely must be global, use `'max'` so stale keeps being served while the fleet regenerates in the background.

**★ Symptom: product pages render for browsers and 500 for Googlebot after a build-tooling change.** Cause: the shell depends on an input that exists only in the build container — a generated facet index, a related-products file, a build-only environment variable. The bot path re-renders the whole page at request time, so that dependency is evaluated in an environment where it is absent. Fix: ship the data through something reachable at request time (a database, an API, a file genuinely in the bundle), and verify by requesting a product URL with a crawler user agent.

**★ Symptom: function invocations rise on a schedule nobody set.** Cause: crawl traffic. Each bot request is a full request-time render rather than a shell read, so a crawl of a large catalogue is a recurring render workload on a cadence you do not control. Fix: this is not a bug to remove — it is a budget line. Size the dynamic-render capacity to include it, and keep the per-page request-time work small enough that a crawl is affordable.

**★ Symptom: two boundaries were merged "to reduce layout shift" and now the whole product page waits on the slowest of them.** Cause: a boundary gates everything inside it, so combining the price and the recommendations means the recommendations decide when the price appears. Fix: separate boundaries per hole, and solve layout shift with reserved space in the fallback rather than by joining the fallbacks.

**★ Symptom: someone sets a very short `cacheLife` on the catalogue "so it stays fresh" and origin load climbs.** Cause: the window is a floor under how often you *may* regenerate and a ceiling on origin load — [ch6 · 03](../06-ssg-isr-and-ssr-strategy/03-isr-at-enterprise-level-stale-while-revalidate-tuning.md) derives it: renders per second are bounded by cached paths divided by the window, with the request rate absent from the expression. Halving the window doubles the ceiling. Fix: derive the number from the staleness budget row for that data, and get freshness for the values that need it from on-demand invalidation rather than from a shorter clock.

**★ Symptom: nothing has an explicit `cacheLife` and a lifetime surprises someone during an incident.** Cause: an omitted `cacheLife` still has one — the `default` profile — and it is not visible where you are reading. Fix: set `cacheLife` in every cached scope, as the documentation recommends and as the `lib/catalog.ts` example above does, so the behaviour is stated at the call site instead of inferred.

## Interview questions

**★ Why is a category route a worse enumeration problem than a product route, even when there are more products than categories?**
Because a product route has one axis and a category route has several. Products enumerate as a flat list bounded by one `LIMIT`. A category listing multiplies category by sort by facet combination by page, and while the facet and sort axes are `searchParams` — so they are not enumerable at all and never enter `generateStaticParams` — the nested path segments still multiply. Worse, the child enumeration runs once per parent param set, so a child that ignores the parent params it was handed returns the same list for every parent and asks the build to render the full cross product, most of which is URLs that correspond to nothing.

**★ When does `use cache: remote` help on a storefront, and when is it strictly worse than nothing?**
It helps where the key space is small, the request volume per key is high, and the upstream has a constraint you would otherwise hit — a rate-limited pricing or tax service is the canonical case, because the price book keys on a currency, a region and a tier rather than on the product. It is strictly worse than nothing where keys are near-unique per request, which on a storefront means search queries, arbitrary facet maps and anything keyed by user. In the second case you pay a network round trip before every lookup and the lookup always misses, so you have added latency and infrastructure to buy a hit rate approaching zero. The two versions of the code are nearly identical; only the cardinality of the key tells them apart, which is why this has to be reasoned about rather than spotted in review.

**★ A merchandiser publishes a price change from a CMS. Why can you not use `updateTag`?**
Because `updateTag` is callable only inside Server Actions and throws elsewhere, and a CMS webhook arrives at a Route Handler. That leaves `revalidateTag`, which takes a required second argument saying how long stale content may still be served. For most catalogue content the recommended `'max'` profile is right — a long window, so requests are always served stale while regeneration runs. For a price it is wrong, because the whole reason you invalidated is that the displayed number must not be the old one; there you pass `{ expire: 0 }` so stale is never served and the next request blocks for fresh data. The general principle is that the profile is the point past which correctness matters more than speed.

**★ Why does the crawler path change the capacity plan for a storefront but not for a SaaS?**
Because the crawler is served differently and the storefront has a large indexable surface. Bots are detected by user agent and given a full request-time render of the whole page rather than the shell, so each crawled URL is an invocation with real CPU and memory behind it. On a SaaS the indexable surface is a marketing site and perhaps a few public pages, so this is a rounding error. On a storefront it is the entire catalogue, crawled repeatedly on a schedule set by search engines, which makes it a standing workload rather than an occasional one — and a workload whose volume you cannot throttle without hurting the acquisition channel it feeds.

**★ Is a cache stampede a real risk on ISR'd product pages?**
On the stale path, no, and structurally so — the cached copy keeps being served for the whole time regeneration runs, so no request waits and no request renders. The risk lives on the paths that block, and a storefront uses two of them routinely: a cold path whose `expire` has elapsed, and a deliberate immediate expiry on a price. There is also a question the documentation does not answer — whether N concurrent requests to one stale entry cause one background regeneration or N — and the honest position is that it is unresolved. Engineer as if it were N, by caching the expensive read below the page so duplicate regenerations converge on one data fetch; that costs nothing if the optimistic answer turns out to be correct.

**★ Why should the price and the stock badge be separate `<Suspense>` boundaries rather than one?**
Because a boundary is a unit of gating: everything inside it appears together, when the slowest thing inside it is ready. Price and stock come from different systems with different latencies and different failure modes, and the price is what the visitor is waiting for. Merging them means an inventory service having a slow minute delays the number that decides whether anyone buys. Separate boundaries also make the failure isolable — a stock badge that fails can degrade to nothing while the price still renders.

**★ Someone shortens every `cacheLife` on the catalogue to keep it fresh. Explain why that is the wrong lever.**
Because the lifetime is not a freshness guarantee; it is a floor under how often regeneration *may* happen, and regeneration is triggered by a request rather than by a clock. On a low-traffic path a short window produces content far older than the number suggests, so it does not deliver the freshness that motivated the change. What it does deliver, reliably, is the other side of the same expression: the origin-load ceiling is the number of cached paths receiving traffic divided by the window, with the request rate absent entirely. Halving the window doubles that ceiling. The correct lever for freshness is on-demand invalidation on the specific values that need it; the window is for content that drifts with nobody to tell you.

**★ What is the practical test for whether a value belongs in the shell or in a hole?**
Ask two questions in order. First, is the value the same for every reader? If it differs per reader it cannot be in a shared shell at all. Second, if it is the same for everyone, is there a lifetime at which being wrong is acceptable? If yes it belongs in the shell with an explicit `cacheLife` and a tag; if no — the value has to be true at the instant of reading — it is an uncached read behind its own boundary. Stock is the instructive case because it passes the first question and fails the second: the number is identical for every visitor, and it still cannot be cached, because being wrong means an oversell.

---

← [02 · Case study 2: the storefront](02-case-study-2-contrast-a-ppr-driven-e-commerce-storefront.md) · Next → [02c · The cart, checkout and where state lives](02c-the-cart-checkout-and-where-state-lives.md)
