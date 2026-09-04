---
title: "On a large site the effective window is the *minimum* across the route, so one helper with a short window sets the budget for a page it does not own — and time-based versus on-demand invalidation is not a feature comparison, it is a choice between an unconditional bound and a production dependency on your publish path"
sidebar_label: "03c · Budgets and on-demand"
sidebar_position: 12
description: "Per-route revalidate budgets across a large site: the minimum-wins rule, cacheLife nesting, staleness as a written policy encoded as named profiles, and the operational differences between time-based and on-demand invalidation."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [How to implement Incremental Static Regeneration](https://nextjs.org/docs/app/guides/incremental-static-regeneration) (docs `lastUpdated` 2026-06-23), [`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife) (`lastUpdated` 2026-08-25) and [How revalidation works in Next.js](https://nextjs.org/docs/app/guides/how-revalidation-works) (`lastUpdated` 2026-06-01), plus the banked [`revalidatePath`](https://nextjs.org/docs/app/api-reference/functions/revalidatePath) quotes.
> Target: **Next.js 16.3.4**, React 19.2.8, Node >= 20.9. Documentation-verified; **no sandbox run**. No cache-hit or load figures appear on this page.

**[03](03-isr-at-enterprise-level-stale-while-revalidate-tuning.md) derived one number for one route. A real site has three hundred routes and a shared component library, and at that size two things happen that do not happen on one page. The first is that the number stops being yours: the effective ISR window for a route is the minimum across every fetch on it, so an analytics widget in the footer with a short window silently sets the budget for the pricing page. The second is that "how stale may this be" turns out to be a product policy that nobody has written down, and in its absence every engineer invents one per file. This page is about making both explicit — a small set of named staleness classes, applied deliberately, with the choice between time-based and on-demand invalidation made per class rather than per developer.**

## The minimum-wins rule, and why it makes windows a shared resource

> *"If you have multiple `fetch` requests in a prerendered route, and each has a different `revalidate` frequency, the lowest time will be used for ISR. However, those revalidate frequencies will still be respected by the cache."*

> *"If any of the `fetch` requests used on a route have a `revalidate` time of `0`, or an explicit `no-store`, the route will be dynamically rendered."*
> — [ISR guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration)

Two rules, and the second is the sharp one. The first means your carefully-derived `revalidate = 3600` is an *upper* bound that anything on the route can lower. The second means one `no-store` anywhere — in a shared header component, in a feature-flag client, in a third-party SDK — removes the route from ISR entirely, and there is no error, only a bill.

**The practical consequence is that a route's caching behaviour is not a property of its own file.** It is a property of the transitive closure of everything it renders, including code owned by other teams.

```tsx
// components/site-header.tsx — imported by every route in the app
async function LiveBanner() {
  // 🔴 This one option makes EVERY route that renders the header dynamic.
  const banner = await fetch('https://api.sprintdesk.dev/banner', {
    cache: 'no-store',
  }).then((r) => r.json())
  return banner ? <div className="banner">{banner.text}</div> : null
}
```

```tsx
// components/site-header.tsx — the fix: give the volatile part its own boundary
import { Suspense } from 'react'

async function LiveBanner() {
  const banner = await fetch('https://api.sprintdesk.dev/banner', {
    next: { revalidate: 60, tags: ['banner'] },
  }).then((r) => r.json())
  return banner ? <div className="banner">{banner.text}</div> : null
}

export function SiteHeader() {
  return (
    <header>
      <Nav />
      <Suspense fallback={null}>
        <LiveBanner />
      </Suspense>
    </header>
  )
}
```

🔴 **State the default correctly, because this corpus has had it backwards once.** `fetch`'s default leaves a route **static and potentially stale** — it is not dynamic by default. What makes a route dynamic is an explicit `no-store`, an explicit `revalidate: 0`, or a request-time API. So the audit you run is not "which fetches did somebody remember to cache" but "which fetches did somebody explicitly opt out". [ch4 · diagnosing stale and unexpectedly dynamic routes](../04-data-fetching-in-the-app-router/03c-diagnosing-stale-and-unexpectedly-dynamic-routes.md) is the procedure for finding them.

## The same rule, restated for Cache Components

`cacheLife` nesting behaves analogously, with one crucial escape. (The directive-level story — how a lifetime is declared and why it must be explicit at every cached scope — is [ch5 · revalidation and lifetimes](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05-revalidation-and-lifetimes.md). What follows is what that rule does to a site with three hundred routes.)

> *"The outer cache uses its own lifetime, regardless of inner cache lifetimes. ... An explicit `cacheLife` always takes precedence, whether it's longer or shorter than inner lifetimes."*

> *"If you don't call `cacheLife` in the outer cache, it uses the `default` profile (15 min revalidate). Inner caches with shorter lifetimes can reduce the outer cache's `default` lifetime. Inner caches with longer lifetimes cannot extend it beyond the default."*
> — [`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife)

So the minimum-wins contagion still happens — **but only if you left the outer scope implicit.** An explicit `cacheLife` is a firewall. That is why the docs recommend one in every `use cache` scope, and the recommendation is about ownership as much as clarity:

> *"We recommend setting a `cacheLife` in every `use cache` scope so its behavior is clear at the call site."*

The framework will even stop you falling into the worst version of it. When a short-lived cache is nested inside a `use cache` with no explicit lifetime, *"the outer cache's lifetime would silently become short too via propagation. To prevent this accidental misconfiguration, Next.js throws an error during prerendering"* — and the accompanying warning is the one that makes this a real hazard rather than a hypothetical: *"the nested cache may not be obvious — it could be in an imported module or even a third-party dependency."*

## Staleness classes: the policy, written down once and encoded

Rather than a number per file, define a small set of named classes derived from product requirements, and apply the name. `cacheLife` makes this literal — the config file becomes the policy document:

```ts
// next.config.ts — this block IS the staleness policy. Review it like one.
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    // Legal, brand, docs. Changes are announced days ahead; on-demand on publish.
    evergreen: { stale: 300, revalidate: 86_400, expire: 604_800 },

    // Marketing and landing pages. Campaigns go live on a schedule; the window
    // is the backstop for a missed on-demand call, not the mechanism.
    marketing: { stale: 300, revalidate: 1_800, expire: 43_200 },

    // Catalogue. Prices and stock are invalidated on write; 15 min is the floor
    // under a failed webhook, chosen from the pricing policy's 30-minute promise.
    catalogue: { stale: 300, revalidate: 900, expire: 21_600 },

    // Editorial. Publishing invalidates by tag; this window catches edits made
    // through paths that do not call revalidateTag (bulk imports, admin fixes).
    editorial: { stale: 300, revalidate: 3_600, expire: 86_400 },
  },
}

export default nextConfig
```

```tsx
// app/products/[slug]/page.tsx
import { cacheLife, cacheTag } from 'next/cache'

async function getProduct(slug: string) {
  'use cache'
  cacheLife('catalogue')
  cacheTag(`product-${slug}`)
  return fetchProduct(slug)
}
```

Four properties this buys that four hundred scattered numbers do not:

1. **The policy is reviewable.** A product manager can read `next.config.ts` and disagree with `catalogue: 15 minutes`. Nobody can review `export const revalidate = 900` in a file they have never opened.
2. **Changing the policy is one commit.** The pricing promise moves from 30 minutes to 10; one line changes; every catalogue page follows.
3. **The name carries the reason.** `cacheLife('catalogue')` says what class of content this is. `900` says nothing.
4. **Drift is visible.** A page calling `cacheLife({ revalidate: 240 })` inline stands out against a codebase of named profiles, and the review question writes itself: which class is this, and if it is none of them, should there be a fifth?

⚠️ **You may redefine the built-in names, including `default` and `max`, but prefer your own.** The docs warn that *"The time-named profiles carry an intuitive expectation (`days` reads as roughly 24 hours), so redefining them is more likely to surprise a reader"*. `catalogue` cannot be misread as a duration; `hours` can.

There is also a documented pattern for content whose freshness requirement varies per item — a CMS field driving the window:

```ts
// lib/posts.ts — the documented data-driven shape
import { cacheLife, cacheTag } from 'next/cache'

async function getPostContent(slug: string) {
  'use cache'
  const post = await fetchPost(slug)
  cacheTag(`post-${slug}`)

  if (!post) {
    // Missing now, likely to exist later: cache briefly to shield the database
    // without pinning a 404 for a day.
    cacheLife('minutes')
    return null
  }

  cacheLife({ revalidate: post.revalidateSeconds ?? 3600 })
  return post.data
}
```

Note what that conditional buys, and note the constraint: `cacheLife` must run at most once per invocation, though it may appear in several branches.

## Time-based and on-demand are different operational shapes

They are usually presented as two features. They are better understood as two *systems*, with different failure modes, different dependencies and different things that page you at 3am.

| | **Time-based** | **On-demand** |
|---|---|---|
| Trigger | An incoming request, after the window | A write, via `revalidateTag` / `revalidatePath` / `updateTag` |
| Freshness | Bounded above only on trafficked paths | Immediate on the write, unbounded if the call is missed |
| Dependency | None beyond the cache itself | 🔴 Your publish path is now production infrastructure |
| Failure mode | Content is old, predictably | Content is old **indefinitely**, silently |
| Cost | A floor of renders proportional to 1/window | Zero when nothing changes |
| Correctness risk | Serving stale is expected | Wrong path invalidated = nothing happens, no error |
| Observability | Age is derivable from the window | Requires you to log and alert on the calls |

**The decisive row is "dependency".** On-demand invalidation means a webhook from your CMS, or a Server Action in your admin, is now a production system: it needs authentication, retries, idempotence, monitoring and an on-call story. When it works it is strictly better than time-based. When it silently stops working — a rotated secret, a changed URL, a deploy that dropped an env var — nothing errors and content freezes at whatever it was, forever.

**Which is why the enterprise answer is both, with the roles named.** On-demand provides the freshness; time-based is the backstop that bounds the damage when on-demand fails. Every window in the config block above carries a comment saying so, and that comment is the reason the window is not simply "very long".

```ts
// app/api/cms-webhook/route.ts — on-demand, treated as production infrastructure
import { revalidateTag } from 'next/cache'
import { after } from 'next/server'
import { timingSafeEqual, createHmac } from 'node:crypto'

export async function POST(request: Request) {
  const signature = request.headers.get('x-cms-signature') ?? ''
  const body = await request.text()

  const expected = createHmac('sha256', process.env.CMS_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex')

  const ok =
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected))

  if (!ok) return new Response('invalid signature', { status: 401 })

  const { type, slug } = JSON.parse(body) as { type: string; slug: string }

  // 'max' keeps readers on stale content while entries refresh in the background.
  revalidateTag(`post-${slug}`, 'max')
  revalidateTag('posts', 'max')

  // Emit a signal you can alert the ABSENCE of. This is the whole point:
  // a webhook that stops firing produces no error, only silence.
  after(() => {
    console.info(JSON.stringify({ event: 'cms.revalidated', type, slug, at: Date.now() }))
  })

  return Response.json({ revalidated: true })
}
```

🔴 **Alert on the absence of that log line, not on its errors.** A webhook that fails loudly is a good day. The failure that costs you a week is the one where the CMS stopped calling you at all, and no error exists anywhere to alert on.

## Three ways on-demand invalidation silently does nothing

**1 · The wrong path, under a rewrite.**

> *"When using rewrites, you must pass the **destination** path (the actual route file location), not the source path that appears in the browser's address bar."*
> *"This is because `revalidatePath` operates on the route file structure, not the URL visible to users. Cache entries are tagged based on which route file renders them."*
> — banked from [`revalidatePath`](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)

⚠️ The banked note records that this rule is stated for `rewrites` in `next.config.js` and **not** explicitly for a `NextResponse.rewrite()` from proxy; the mechanism implies the same, but it is unconfirmed. The ISR guide reinforces the general shape from the other direction: *"Proxy won't be executed for on-demand ISR requests, meaning any path rewrites or logic in Proxy will not be applied. Ensure you are revalidating the exact path. For example, `/post/1` instead of a rewritten `/post-1`."*

**2 · A tag that was never assigned.** From the banked `cacheTag` documentation: a single call accepts up to 128 tags of at most 256 characters, longer tags are skipped and tags past the 128th are dropped, both with a console warning. And: *"A tag that exceeds the limit is never assigned to cached data, so revalidating it does nothing."* A tag built from a long composite key can silently exceed 256 characters.

**3 · The wrong instance.** *"Calling `revalidateTag()` on instance A only invalidates the cache on that instance."* Without a shared handler your webhook invalidated one of twenty caches, which is [03d](03d-the-cache-is-not-one-thing.md).

## On-demand is lazy, and `revalidatePath` has a wider blast radius than it looks

> *"`revalidatePath` invalidates the cache entries but regeneration happens on the next request. If you want to eagerly regenerate the cache entry immediately instead of waiting for the next request, you can use the Pages router `res.revalidate` method. We're working on adding new methods to provide eager regeneration capabilities for the App Router."*
> — [ISR guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration)

So "invalidate" means "mark", not "rebuild". Nothing regenerates until somebody asks.

And the blast radius, from the banked reference: `revalidatePath('/', 'layout')` *"will purge the Client Cache, and invalidate all cached data for revalidation on the next page visit"*, with layout invalidation cascading to *"all nested layouts beneath it, and all pages beneath them."* The `type` argument is **required** when the path contains a dynamic segment. The soft-tag mechanism explains why the cascade exists: `/blog/hello` carries `_N_T_/layout`, `_N_T_/blog/layout`, `_N_T_/blog/hello/layout` and `_N_T_/blog/hello`, and `revalidatePath` invalidates the leaf tag and its ancestors.

**Prefer tags to paths for anything driven by content.** A tag names the *thing* that changed; a path names a URL that happens to render it, and gets the ancestors thrown in.

## Gotchas

**★ Symptom: a route's effective revalidate window is far shorter than its segment config says.** Cause: the minimum-wins rule — the lowest `revalidate` among the route's fetches is what ISR uses. A shared component with a short window sets the budget for every page that renders it. Fix: audit the whole route, not the page file; then either raise the offending window or isolate the volatile part behind its own `<Suspense>` boundary so it does not dictate the page's caching.

**★ Symptom: a route went fully dynamic and there is no `force-dynamic` anywhere.** Cause: one `cache: 'no-store'` or `next: { revalidate: 0 }` on any fetch reachable from the route. Fix: search the transitive component tree, not the route directory. And correct the mental model while you are there: `fetch`'s default leaves the route static and possibly stale — dynamism comes from an explicit opt-out or a request-time API, not from forgetting to opt in.

**★ Symptom: enabling Cache Components fails a prerender with an error about a nested short-lived cache.** Cause: a `use cache` scope with no explicit `cacheLife` containing one with a short lifetime, which would silently make the outer scope short too; the framework refuses rather than propagating. The offending inner cache *"could be in an imported module or even a third-party dependency."* Fix: add an explicit `cacheLife` to the outer scope. Choose deliberately — a long profile keeps the outer scope prerendered, a short one plus a `<Suspense>` boundary confirms you meant it to be dynamic.

**★ Symptom: the CMS webhook stopped firing three weeks ago and the site has been serving stale content ever since.** Cause: on-demand invalidation is a production dependency with no built-in liveness signal. A rotated secret or a changed URL produces silence, not an error. Fix: two things together. Emit a structured log on every successful revalidation and alert on its *absence* over a window; and keep a time-based window on every profile as the backstop, so the worst case is bounded rather than infinite.

**★ Symptom: `revalidatePath` returns without error and the page does not change.** Cause: one of three documented traps — you passed the browser-visible path under a rewrite instead of the destination route file path; the `type` argument was omitted on a path with a dynamic segment, where it is required; or you are running multiple instances and only the one that received the call was invalidated. Fix: pass the route-file path and the correct `type`, and for the third, a shared cache handler. Nothing about any of these produces an error, which is why they survive so long.

**Symptom: `revalidateTag` runs with a long composite tag and nothing is invalidated.** Cause: the documented limits — 128 tags per call, 256 characters each; tags over the limit are skipped, and *"A tag that exceeds the limit is never assigned to cached data, so revalidating it does nothing."* A tag built from concatenated tenant, locale and slug can cross 256 characters. Fix: hash long composite keys to a fixed-length tag, and assert the length where tags are constructed rather than trusting the console warning to be noticed.

**Symptom: one `revalidatePath('/', 'layout')` in an admin action invalidated the entire site.** Cause: that is its documented behaviour — it purges the client cache and invalidates all cached data, and layout invalidation cascades to every nested layout and page beneath it. Fix: invalidate by tag. A tag names the thing that changed; a root layout path names everything.

**Symptom: the config has forty different revalidate numbers and nobody can say why any of them is what it is.** Cause: numbers chosen per file by whoever wrote the file. Fix: collapse them to a handful of named `cacheLife` profiles derived from written product requirements, put the derivation in a comment next to each, and treat inline numbers in page files as a review smell that means "this is a fifth class nobody has named".

**Symptom: you called `revalidatePath` and expected the page to be rebuilt straight away.** Cause: on-demand invalidation marks entries; regeneration happens on the next request. The docs say so explicitly and note that eager regeneration exists only as the Pages Router `res.revalidate` today. Fix: adjust the expectation, and if a page genuinely must be warm immediately after a write, request it yourself after invalidating.

## Interview questions

**★ Why is the effective revalidate window a property of the route rather than of the page file?**
Because the documented rule is that the lowest `revalidate` frequency among the route's fetches is the one ISR uses, and "the route" includes every component it renders — shared layouts, design-system components, third-party widgets. So a footer that refreshes a status banner every sixty seconds sets the ISR budget for a pricing page that declares an hour. The sharper version of the same rule is that a single `no-store` or `revalidate: 0` anywhere reachable removes the route from ISR entirely and makes it dynamic, with no error to notice. This is why auditing caching means walking the component tree, not reading the segment config, and why Cache Components' advice to set an explicit `cacheLife` in every scope matters: an explicit lifetime is a firewall against the propagation, and an implicit one is not.

**★ How do you make staleness a decision rather than an accident across three hundred routes?**
By turning it into a small set of named classes derived from written product requirements, and encoding them as `cacheLife` profiles in `next.config.ts`. Four or five names — evergreen, marketing, catalogue, editorial — each with a comment giving the requirement it came from. The call site then says `cacheLife('catalogue')`, which carries a reason where `900` carries none. This buys reviewability (a product owner can read the policy and object to it), single-point change (the pricing promise tightens, one line changes), and drift detection (an inline number stands out and prompts the right question: which class is this, and if none, should there be a fifth?). The docs recommend naming your own profiles over redefining the built-ins, precisely because `days` carries a duration expectation that a redefinition would violate while `catalogue` carries none.

**★ Time-based or on-demand — how do you choose?**
You mostly do not choose; you use both and name their roles. On-demand gives immediacy, because only the writer knows when data changed, and it costs nothing when nothing changes. But it converts your publish path into production infrastructure: a webhook needing auth, retries, idempotence and monitoring, and one whose failure mode is silence rather than an error, so content freezes indefinitely with nothing to alert on. Time-based gives an unconditional bound with no dependencies at all, at the cost of a floor of renders proportional to the inverse of the window. Combine them: on-demand for the freshness, a time-based window as the backstop that bounds the damage when on-demand quietly stops. And write which is which in a comment, because the next person will otherwise "optimise" the redundant-looking window away.

**★ Someone says "we use on-demand revalidation, so we don't need a revalidate window." What is wrong with that?**
It assumes the invalidation call always happens, and there are at least four documented ways it does not, none of which errors. The path can be wrong under a rewrite — `revalidatePath` operates on the route file structure, so you must pass the destination path, not the URL in the address bar. The tag can exceed the documented 256-character limit, in which case it was never assigned to the cached data and revalidating it does nothing. In a multi-instance deployment the call invalidates only the instance that received it. And the webhook can simply stop being called. Every one of those produces stale content with no error anywhere. A time-based window does not make any of them less likely; it bounds how long they can hurt you, which is what makes it a backstop rather than a redundancy.

**★ Why prefer `revalidateTag` over `revalidatePath` for content changes?**
Because a tag names the thing that changed and a path names a URL that happens to render it. The path form drags its ancestors along: revalidation runs on a soft-tag system where `/blog/hello` carries tags for the leaf and for every layout above it, so invalidating the path invalidates that whole chain — and `revalidatePath('/', 'layout')` purges the client cache and invalidates all cached data beneath it. Tags also survive routing changes, where paths do not: move a page and every `revalidatePath` call referencing it is silently wrong, while a `product-123` tag keeps meaning what it meant. The path form is still right when the *route* is what changed rather than the data.

**What does `revalidatePath` actually do at the moment you call it?**
It marks entries; it does not rebuild anything. The documentation is explicit — invalidation happens on the call, regeneration happens on the next request, and eager regeneration exists today only as the Pages Router `res.revalidate` method, with App Router equivalents described as in progress. So a webhook that invalidates a thousand pages has created a thousand entries that will each regenerate the first time somebody asks for them, spread across whatever your traffic distribution is. That is usually what you want. It also means "I revalidated it and it is still slow for the first visitor" is not a bug.

**How does a data-driven cache lifetime work, and when would you use one?**
`cacheLife` accepts an inline object as well as a profile name, so a window can be computed from the data you just fetched — the documented shape is `cacheLife({ revalidate: post.revalidateSeconds ?? 3600 })`, with unspecified properties inheriting from the `default` profile. It is right when the freshness requirement is genuinely a property of the content rather than of its class: an editor marking one campaign page as fast-moving, or a not-found result cached briefly so a database is shielded without pinning a 404 for a day. The constraint is that `cacheLife` must execute at most once per invocation, though it may appear in several branches — which is exactly how the conditional not-found pattern is written in the docs.

---

← [03b · The stampede](03b-the-stampede-and-what-the-framework-does-not-protect-you-from.md) · [Chapter index](01-explanation.md) · Next → [03d · The cache is not one thing](03d-the-cache-is-not-one-thing.md)
