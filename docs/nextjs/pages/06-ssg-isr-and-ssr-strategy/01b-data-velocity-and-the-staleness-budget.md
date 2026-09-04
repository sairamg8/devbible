---
title: "\"How stale is acceptable?\" is a product question that engineers keep answering technically — data velocity is a property of each piece of data, never of a route, and the three rungs of the freshness ladder have different costs and different failure modes"
sidebar_label: "01b · Data velocity"
sidebar_position: 2
description: "Making the data-velocity axis operational: the staleness budget, the three-rung ladder from time-based revalidation to on-demand invalidation to request-time reads, read-your-writes as the case that masquerades as velocity, and the multi-instance guarantee that quietly does not hold."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [How to implement Incremental Static Regeneration (ISR)](https://nextjs.org/docs/app/guides/incremental-static-regeneration) (docs `version: 16.3.4`, `lastUpdated: 2026-06-23`), [Caching](https://nextjs.org/docs/app/getting-started/caching) (`lastUpdated: 2026-08-25`), [`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag) and [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag), the [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions) and [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache) (those four quoted from research banked 2026-09-03, not re-fetched).
> `next` is **not installed in this checkout** — no package probe was possible; `react` probes at **19.2.8**.
> Target: **Next.js 16.3.4 · React 19.2.8 · Node >= 20.9**. Documentation-verified; **no sandbox run**.

**Ask a room "does this data need to be real-time?" and every hand goes up, because the question is unanswerable — nobody volunteers for stale data in the abstract. The answerable version is "if a user sees a value that is N seconds old, what goes wrong, who notices, and what does it cost?", and it is a product question with an owner who is not you. Getting an answer is most of the work, because once you have a number the technical choice is nearly mechanical: three rungs, each with a different cost and a different way of failing. The mistake this axis produces is never picking the wrong rung for a value; it is applying one value's rung to the whole route.**

## Velocity attaches to data, not to routes

A product page can legitimately contain, in one document: marketing copy that changed last quarter, a category tree that changes weekly, a description that changes when an editor saves, a price that must be right when the user clicks buy, and a stock count that must be right at the instant of read. Five different velocities, one URL. Nothing in the framework requires them to share a strategy — `use cache` lifetimes are per function and `<Suspense>` boundaries are per subtree.

🔴 **The overcorrection to watch for is one value dragging the route down.** Someone notices the stock count is stale, adds `export const dynamic = 'force-dynamic'`, and now the marketing copy is re-rendered on every request forever. The value that needed rung three took the other four with it, and nobody will ever unpick it, because the flag has no comment saying which value it was for.

Write the budget down before touching code. Three columns, one row per piece of data on the page:

| Data | Who notices staleness, and how fast | What it costs when they do |
|---|---|---|
| Marketing headline | Nobody until the next campaign | Zero |
| Category tree | Merchandiser, next working day | A confused support ticket |
| Product description | Editor, minutes — they just saved it | Editor loses trust in the CMS |
| Price | The customer, at checkout | A refund, and possibly a regulator |
| Stock count | The customer, after purchase | An oversell and a manual apology |

The rows with a real cost are the only ones that get to influence rendering.

## The three-rung ladder, and the doc sentence that orders it

The ISR guide states the ordering directly, and it is worth treating as the default policy rather than one opinion:

> *"We recommend setting a high revalidation time. For instance, 1 hour instead of 1 second. If you need more precision, consider using on-demand revalidation. If you need real-time data, consider switching to dynamic rendering."*
> — [ISR guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration)

### Rung 1 — time-based: you cannot be told, so you re-check

Use it when nothing can notify you that the data changed: a third-party API, a partner feed, an aggregate you compute yourself, anything owned by a team that will not call your webhook.

```tsx
// app/(marketing)/pricing/page.tsx — Cache Components
import { cacheLife } from 'next/cache'

async function ExchangeRates() {
  'use cache'
  cacheLife('hours')
  const res = await fetch('https://api.example.com/fx/latest')
  const rates = await res.json()
  return <RateTable rates={rates} />
}
```

What a user experiences at the expiry boundary is the part people get wrong. The request that arrives after expiry does **not** wait:

> *"After 60 seconds has passed, the next request will still return the cached (now stale) page"* … *"The cache is invalidated and a new version of the page begins generating in the background"* … *"Once generated successfully, the next request will return the updated page and cache it for subsequent requests"*
> — [ISR guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration)

So `revalidate: 60` does not mean "at most 60 seconds old". It means "at least 60 seconds old before anyone triggers a refresh, and the trigger*ing* visitor still sees the old one." On a low-traffic route the real staleness is unbounded: no request, no regeneration. The mechanics are [ch5 · revalidation and lifetimes](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05-revalidation-and-lifetimes.md).

### Rung 2 — on-demand: the writer tells you

This is what people usually mean when they say "real-time". They do not want the page re-rendered on every request; they want it correct within a second of the **write**. That is a different, much cheaper thing.

```ts
// app/actions/publish.ts
'use server'

import { updateTag } from 'next/cache'

export async function publishArticle(id: string, body: string) {
  await db.article.update({ where: { id }, data: { body, status: 'PUBLISHED' } })
  updateTag(`article-${id}`)
}
```

Two documented distinctions decide which invalidation function you want:

> *"`updateTag` immediately expires the cached data for the specified tag. The next request will wait to fetch fresh data rather than serving stale content from the cache."* — [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag)

> *"A revalidation is triggered by a request, not by the `revalidateTag` call, so pages using the tag revalidate as they are visited rather than all at once."* — [`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)

`updateTag` is Server-Action-only (*"It cannot be used in Route Handlers, Client Components, or any other context"*), which matters when your invalidation arrives as a CMS webhook — a Route Handler — and you have to reach for `revalidateTag` or `revalidatePath` instead.

### Rung 3 — request time: the value must be true at the moment of reading

Not "recent". True. The list is short and you should be able to recite it:

- **Money you are about to charge** — the price rendered on the button you are about to let someone press.
- **Inventory you are about to commit** — availability, seat maps, appointment slots.
- **Permissions and entitlements** — what this user may see or do right now, revoked five seconds ago.
- **Anything a regulator or contract says must be current** — rates, disclosures, restricted-jurisdiction gating.
- **Anything the user themselves just wrote** — see below; it is not really a velocity problem.

```tsx
// app/products/[id]/page.tsx
import { Suspense } from 'react'

export default async function Page({ params }: PageProps<'/products/[id]'>) {
  const { id } = await params
  return (
    <main>
      <ProductCopy id={id} />
      <Suspense fallback={<StockPlaceholder />}>
        <LiveStock id={id} />
      </Suspense>
    </main>
  )
}

async function LiveStock({ id }: { id: string }) {
  // No 'use cache': this is read at request time, every time.
  const stock = await inventory.count(id)
  return <StockBadge units={stock} />
}

async function ProductCopy({ id }: { id: string }) {
  'use cache'
  const product = await db.product.findUnique({ where: { id } })
  return <Copy product={product} />
}
```

One document, rung 1 and rung 3 side by side, and the shell still ships from the CDN.

## Read-your-writes is not a velocity problem

The most common "our caching is broken" report is a user who saved something and did not see it. No revalidation interval fixes that, because the user is faster than any interval you would accept. It is a property of the **mutation response**, and the Server Actions guide describes a single-response model:

> *"When `updateTag`, `revalidatePath`, or `refresh` runs, Next.js re-renders the current route server-side and includes a newly rendered RSC Payload in the action's response, so the page reflects the change in the same roundtrip. `revalidateTag` with a stale-while-revalidate profile intentionally skips that immediate re-render."*
> — [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions)

So the fix for "I saved and nothing happened" is to call `updateTag`, `revalidatePath` or `refresh` **inside the action** — not to shorten a lifetime, and certainly not to make the route dynamic for every visitor because one author was confused.

## Observability: how you know which rung a page is actually on

You are not allowed to guess this. The ISR guide names two facilities, and both are documented rather than folklore:

> *"You can use the `x-nextjs-cache` response header to observe cache behavior. Values are `HIT` (served from cache), `STALE` (served from cache, revalidating in background), `MISS` (not in cache, rendered fresh), or `REVALIDATED` (regenerated via on-demand revalidation)."*
> — [ISR guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration)

and, for local verification against a production build, `NEXT_PRIVATE_DEBUG_CACHE=1`, which *"will make the Next.js server console log ISR cache hits and misses"*. Diagnosing a stale route in order is [ch4 · diagnosing stale and unexpectedly dynamic routes](../04-data-fetching-in-the-app-router/03c-diagnosing-stale-and-unexpectedly-dynamic-routes.md).

## Gotchas

**★ Symptom: you set an hourly revalidation and the route refreshes every ten seconds.** Cause: the route takes the minimum. *"If you have multiple `fetch` requests in a prerendered route, and each has a different `revalidate` frequency, the lowest time will be used for ISR."* One well-meaning ten-second call in a shared header sets the pace for the entire route. Fix: move the fast-moving read behind its own `<Suspense>` boundary so it stops participating in the route's static render, rather than raising everyone else's frequency.

**★ Symptom: on-demand revalidation works in staging and only sometimes in production.** Cause: you scaled out. *"When running multiple instances, the default file-system cache is per-instance. On-demand revalidation only invalidates the instance that receives the call."* With four pods behind a load balancer, one webhook invalidates one quarter of your fleet and the other three keep serving the old page until their own timer fires. Fix: configure a shared cache handler so invalidation is fleet-wide; the docs point at `incrementalCacheHandlerPath` and the self-hosting caching guide.

**★ Symptom: a page has been stale for three days and no alarm fired.** Cause: revalidation is failing and failing safe. *"If an error is thrown while attempting to revalidate data, the last successfully generated data will continue to be served from the cache. On the next subsequent request, Next.js will retry revalidating the data."* The user-visible behaviour of a broken upstream is therefore *"the site looks fine"*, indefinitely. Fix: instrument the fetch itself — log and count failures in the cached function — because the cache layer will not tell you.

**★ Symptom: a low-traffic page is far staler than its `revalidate` value.** Cause: regeneration is request-triggered. With no visitors there is no trigger, so an expiry window is a lower bound on staleness, never an upper one. Fix: if a page must be fresh regardless of traffic, invalidate it from the writer (rung 2) or schedule a job that requests it; a shorter interval changes nothing on a page nobody visits.

**★ Symptom: "we made it real-time" and the origin is now taking the full read volume.** Cause: rung 3 was applied to data that only needed rung 2. Request-time rendering re-reads on every request from every visitor, including bots and prefetches; on-demand invalidation reads once per *write*. For a catalogue with a 1000:1 read:write ratio, that is three orders of magnitude of avoidable load. Fix: tag the cached read and invalidate it in the mutation path.

**★ Symptom: the CMS webhook returns 200 and the page still shows old content.** Cause: two documented traps at once. `revalidatePath` *"invalidates the cache entries but regeneration happens on the next request"* — so nothing changes until someone visits — and *"Proxy won't be executed for on-demand ISR requests, meaning any path rewrites or logic in Proxy will not be applied. Ensure you are revalidating the exact path."* If your public URL is rewritten, you invalidated a path that does not exist. Fix: revalidate the destination path (the route file's path), then request the URL once yourself to force regeneration.

**Symptom: a stale value on the page that never appears in any cache you can find.** Cause: the client router holds the RSC payload. The `use cache` reference states the client router enforces a **minimum 30-second stale time**, regardless of configuration, communicated with an `x-nextjs-stale-time` header. Fix: stop looking at the server; a same-session update needs the action to return a re-render, as above.

**Symptom: revalidation appears to work but you are billed for it.** Cause: background regeneration is real work on a real instance. *"Background regeneration (stale-while-revalidate) runs on the instance that receives the triggering request. On platforms with per-request billing, this background work counts as additional compute."* A one-second `revalidate` on a busy route is a near-continuous re-render you are paying for. Fix: raise the interval to what the budget table actually justifies; the docs' own suggestion is an hour, not a second.

**Symptom: after a deploy, every page is briefly slower and freshness looks perfect.** Cause: caches are keyed by build id and start empty, so nothing is stale because nothing is cached. Fix: none — but do not read the post-deploy window as evidence that your revalidation strategy works.

## Interview questions

**★ A stakeholder says the dashboard must be real-time. What do you ask next?**
What breaks if a number is thirty seconds old, and who is the person who notices. Almost every answer resolves to one of two cases: either the data changes because *this user* changed it, which is a mutation-response problem solved by invalidating and re-rendering in the action's response, or it changes because *someone else* did, which is solved by invalidating from that writer. Genuine per-request freshness is required only for values that must be true at the instant of reading — money about to be charged, inventory about to be committed, permissions. Those get a `<Suspense>` boundary of their own, not a route-level flag.

**★ Why is `revalidate: 60` not a guarantee that data is at most sixty seconds old?**
Because it is not a scheduler. After sixty seconds the entry is eligible for regeneration, but regeneration is triggered by a request, and the request that triggers it is still served the stale copy; the fresh one appears for the following visitor. On a page with one visit an hour, the data is an hour old. `revalidate` sets a floor on how *fresh* the data can be, not a ceiling on how stale.

**★ What is the difference between `updateTag` and `revalidateTag`, and when does it matter to a user?**
`updateTag` expires the tag immediately and the next read waits for fresh data, so the user who triggered the mutation sees the result in the same round trip. `revalidateTag` with a stale-while-revalidate profile deliberately keeps serving the old value while the refresh happens in the background, which is right for content that many people read and one system updates, and wrong for the author who just clicked Save. It also matters where you are: `updateTag` can only be called from a Server Action, so a CMS webhook arriving at a Route Handler must use `revalidateTag` or `revalidatePath`.

**★ Your route has five pieces of data with five different freshness needs. How do you structure it?**
Cache each read at its own lifetime with `use cache` and `cacheLife`, tag the ones a writer can invalidate, and put only the values that must be true at read time in an uncached component behind its own `<Suspense>` boundary. The page then prerenders a shell containing everything else. The anti-pattern is picking the strictest requirement and applying it to the route, which is what a segment-level `revalidate` or `force-dynamic` does — and under the previous model, the lowest `revalidate` in the route wins, so mixing them at segment level gives you the strictest one whether you wanted it or not.

**Why does on-demand revalidation behave differently on one instance versus four?**
Because the default cache is the local filesystem, per instance. The invalidation call lands on whichever instance the load balancer picked, and the others are unaware, so they keep serving their own copies until their own time-based expiry. Any freshness guarantee you make on the strength of a webhook is only true at one replica unless you have configured a shared cache handler.

**A page has been showing three-day-old data and monitoring is green. What happened?**
Almost certainly a revalidation that throws. Next.js keeps serving the last successfully generated data and retries on the next request, which is exactly the right failure mode for availability and exactly the wrong one for detection: the page looks healthy, the status code is 200, and the upstream has been down since Friday. The instrumentation has to live inside the cached function, and the alert has to be on "time since last successful refresh", not on error rates at the edge.

**When is time-based revalidation the *right* answer rather than the lazy one?**
When nobody can tell you the data changed. A third-party currency feed, a partner's availability API, an aggregate you recompute from logs — there is no write event of yours to hang an invalidation on, so a lifetime is the honest model. It is the lazy answer when you own the write path and simply did not wire the invalidation, and you can tell the two apart by asking whether a webhook or a Server Action exists that *could* have called `updateTag`.

---

← [Choosing a rendering pattern](01-choosing-a-rendering-pattern-seo-build-time-data-velocity-pe.md) · [Chapter index](01-explanation.md) · Next → [Personalization](01c-personalization-without-going-dynamic.md)
