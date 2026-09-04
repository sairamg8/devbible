---
title: "Cache Components inverts the default: nothing is cached until you say so, and the build refuses to guess on your behalf"
sidebar_label: "01 · The explicit caching model"
sidebar_position: 1
description: "What the cacheComponents flag actually turns on, the three experimental flags it replaced, the precise inversion of the fetch default, and what making the declaration mandatory buys you in build-time validation."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [`cacheComponents`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents) (docs `lastUpdated` 2026-06-22), [Caching](https://nextjs.org/docs/app/getting-started/caching) (`lastUpdated` 2026-08-25) and [Migrating to Cache Components](https://nextjs.org/docs/app/guides/migrating-to-cache-components) (`lastUpdated` 2026-08-25).
> Target: **Next.js 16.3.4**, App Router, Node.js runtime. Documentation-verified; **no sandbox run**.

**The previous caching model cached aggressively and made you opt out; Cache Components caches nothing and makes you opt in. That single inversion is the whole chapter, and it is worth understanding as a trade rather than an upgrade — because you are buying something concrete and paying for it with something equally concrete. What you buy is a framework that can *prove*, at build time, that every route produces a static shell, and that names the exact component standing in the way when one does not. What you pay is that `use cache` is a strictly weaker store than the `fetch` Data Cache it replaces — in-memory by default, gone when a serverless instance is torn down, gone again at every deploy. Nobody tells you the second half, and it is where the production surprises live; [01b](01b-what-the-model-costs-persistence-storage-and-the-runtime-floor.md) is that half in full. This page is the model itself.**

## What the flag is

One boolean in `next.config.ts`:

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

The documentation's own summary of what that turns on:

> *"Cache Components enables component and function-level caching using the `use cache` directive. Data fetching is dynamic by default, and you choose what to cache at the page, component, or function level. Next.js prerenders a static HTML shell that is served immediately while dynamic content streams in when ready, letting you mix static and dynamic content within a single route."*

Three things arrive with it, and nothing else does: the [`use cache` directive](10-the-three-cache-directives/README.md), the `cacheLife` function, and the `cacheTag` function.

### It is one flag standing in for three

The version history table has exactly one row, and it is the row that explains why this flag feels bigger than a feature toggle:

| Version | Change |
|---|---|
| `16.0.0` | *"`cacheComponents` introduced. This flag controls the `ppr`, `useCache`, and `dynamicIO` flags as a single, unified configuration."* |

If you followed Next.js through 15, you met these separately: `experimental.ppr` for Partial Prerendering, `experimental.useCache` for the directive, `experimental.dynamicIO` for the strict prerender validation. They were three switches that only made sense together, and shipping them independently produced combinations nobody had designed. `cacheComponents` collapses them into one supported configuration.

The consequence is stated flatly, and it breaks builds:

> *"Additionally, `cacheComponents` implements **Partial Prerendering (PPR)** as the default behavior in the App Router. This means the `experimental.ppr` configuration flag and the `experimental_ppr` route segment configuration are no longer necessary and have been removed."*

Not deprecated. Removed. PPR is no longer a thing you enable; it is what rendering *is* — which is why [03](03-partial-pre-rendering-ppr-static-shell-dynamic-holes-for-min.md) treats it as the chapter's rendering model rather than an optimisation.

## The inversion, stated precisely

Here is the same page under both models. Nothing about the component changes; what changes is what the framework assumes when you say nothing.

```tsx
// The previous model. This route is STATIC, and it is stale.
export default async function Page() {
  const res = await fetch('https://api.acme.com/pricing')
  const pricing = await res.json()
  return <PriceTable pricing={pricing} />
}
```

The `fetch` had no options, so it was cached, so the route prerendered, so it went out at build time and stayed there. To get fresh data you had to *say something* — `cache: 'no-store'`, or `export const dynamic = 'force-dynamic'`, or a `revalidate`. Silence meant "cache it forever." This is the single most misread default in the framework's history, and the corpus corrects it explicitly at [ch4 · 03c](../04-data-fetching-in-the-app-router/03c-diagnosing-stale-and-unexpectedly-dynamic-routes.md): a bare `fetch()` leaves a route **static and stale**, not dynamic.

```tsx
// Cache Components. The exact same code is now DYNAMIC — and will not build.
export default async function Page() {
  const res = await fetch('https://api.acme.com/pricing')
  const pricing = await res.json()
  return <PriceTable pricing={pricing} />
}
```

Now silence means "fetch it every time." The route is dynamic, and because an uncached read sits above every Suspense boundary, the build surfaces a **`blocking-route`** insight naming this component. You must resolve it one of two ways, and the choice is the design decision the whole model exists to force:

```tsx
// Option A — this data is shared and may be stale. Cache it.
import { cacheLife } from 'next/cache'

async function getPricing() {
  'use cache'
  cacheLife('hours')
  const res = await fetch('https://api.acme.com/pricing')
  return res.json()
}

export default async function Page() {
  return <PriceTable pricing={await getPricing()} />
}
```

```tsx
// Option B — this data must be fresh per request. Stream it.
import { Suspense } from 'react'

async function PriceTable() {
  const res = await fetch('https://api.acme.com/pricing')
  const pricing = await res.json()
  return <table>{/* rows */}</table>
}

export default function Page() {
  return (
    <Suspense fallback={<PriceTableSkeleton />}>
      <PriceTable />
    </Suspense>
  )
}
```

**Neither option is "the fix".** They are two different products. Option A serves every visitor the same hourly-refreshed prices from a CDN. Option B guarantees the price on screen is the price in the database and pays a request-time render for it. Under the previous model you could ship either one *by accident*, because the default silently chose for you. That is what "explicit" means here: the framework declines to guess, and the build fails until a human decides.

## What the declaration actually buys

Making you annotate your data access would be a poor trade on its own. What it buys is that the framework now knows enough to check your work.

> *"Next.js requires you to explicitly handle components that can't complete during prerendering. It surfaces a validation insight in the dev overlay and dev server console that names the route and points at fixes (cache the access, move it into a `<Suspense>` boundary, or opt the route out). This validation keeps every route producing a static shell, so direct navigations stay instant."*

Read the last clause as a guarantee, because that is how it is meant. Under the previous model, "is this route static?" was a question you answered by reading the build output and hoping, and a single `cookies()` call added six layers up in a shared component would silently convert an entire section of the site to per-request rendering — the classic accidental-dynamic bug, diagnosed at [ch4 · 03c](../04-data-fetching-in-the-app-router/03c-diagnosing-stale-and-unexpectedly-dynamic-routes.md). Under Cache Components that cannot happen quietly. The validation names the file.

The insights are identified by name, and knowing them makes the dev overlay searchable rather than decorative:

| Insight | What tripped it |
|---|---|
| `blocking-route` | An uncached data read with no `<Suspense>` above it |
| `blocking-prerender-runtime` | `cookies()`, `headers()` or `searchParams` outside a boundary |
| `blocking-prerender-random` | `Math.random()` during prerender |
| `blocking-prerender-current-time` | `Date.now()` / `new Date()` during prerender |
| `blocking-prerender-crypto` | `crypto.randomUUID()` during prerender |
| `blocking-prerender-client-hook` | `useSearchParams` and friends outside a boundary |
| `empty-generate-static-params` | `generateStaticParams` returned `[]` |

⚠️ **The insights are invisible to anything that is not the dev overlay.** This is stated plainly and it catches people who try to gate CI on a status code:

> *"Insights don't show up in the HTTP response. An offending route still returns `200` with rendered HTML in dev. The insight only appears in the dev overlay, the dev-server log, or the MCP `get_errors` tool."*

If you want a machine to enforce this, the mechanism is the `instant()` Playwright helper, covered in **03c · instant-navigation validation** *(not written yet)*.

## Gotchas

**★ Symptom: you enable the flag and every route in the app errors at once.** Cause: the flag is global and immediate, and `dynamic`, `revalidate` and `fetchCache` exports become build errors the moment it is on — a large app has hundreds. Fix: do not try to fix them all in one pass. Enable the flag, run the codemod that opts every segment out of validation, then convert routes one at a time. The full sequence is [01c](01c-flipping-the-flag-on-an-existing-app.md); the codemod is:

```bash
npx @next/codemod@canary cache-components-instant-false ./app
```

**★ Symptom: you cache a value, the dev overlay goes quiet, and you conclude the route is optimised.** Cause: a passing validation means the navigation is *instant*, not that it is *good* — a single `<Suspense>` wrapped around the whole page satisfies validation and replaces the entire page with one spinner. Fix: treat a clean overlay as the floor and inspect what actually lands in the shell; the doc is unambiguous that these are different questions, and the workflow is in **03c · instant-navigation validation** *(not written yet)*.

**★ Symptom: a colleague insists `fetch()` with no options makes a route dynamic, and the migration diff looks wrong to them.** Cause: they are describing the Cache Components behaviour and applying it to the previous model, where a bare `fetch()` left the route static and stale. Both statements are true — of different models. Fix: name which model you are in before arguing about a default. This chapter is the explicit model; the previous one is documented at [Caching and Revalidating (Previous Model)](https://nextjs.org/docs/app/guides/caching-without-cache-components) and taught at [ch4 · 03](../04-data-fetching-in-the-app-router/03-static-vs-dynamic-rendering-force-dynamic-force-static-reval.md).

**★ Symptom: you cannot find the PPR flag to turn on in a fresh 16.x app.** Cause: there is nothing to turn on. `experimental.ppr` and `experimental_ppr` were removed in 16, and PPR is what `cacheComponents` does. Fix: remove both if a tutorial told you to add them; a codemod exists for the segment config. See [03](03-partial-pre-rendering-ppr-static-shell-dynamic-holes-for-min.md).

## Interview questions

**★ Under Cache Components, what does a `fetch()` with no options do — and what did it do before?**
Under Cache Components it is an uncached read: the data is fetched on every request, and because it is uncached the framework requires you to handle it, either by wrapping the call in `use cache` or by putting the component behind a `<Suspense>` boundary. Under the previous model the same call was cached, which left the route static and served stale data indefinitely until something revalidated it. The behaviour inverted completely, and this is the single most common source of confusion when reading Next.js material written across the 15-to-16 boundary — a blog post is only correct relative to the model it was written for.

**★ Cache Components is described as one flag replacing three. Which three, and why did they need to merge?**
`experimental.ppr`, `experimental.useCache` and `experimental.dynamicIO`, merged in 16.0.0. They needed to merge because they were not independent features: `useCache` gives you a way to declare that something is cacheable, `dynamicIO` is the validation that makes the declaration mandatory rather than optional, and `ppr` is the rendering strategy that the declarations make possible. Enabling any subset produced a configuration nobody had designed for — declarations with no validation, or validation with no way to satisfy it. Shipping them as one flag means there is one supported combination.

**★ Why does the framework make you choose between `use cache` and `<Suspense>` rather than picking a sensible default?**
Because there is no sensible default — the two produce different products. Caching serves every visitor the same value for a lifetime you chose; streaming guarantees per-request freshness and pays a render for it. Which is correct depends on business meaning the framework has no access to: whether a stale price is a minor cosmetic issue or a mispriced order. The previous model did pick a default, and the result was that applications shipped one behaviour while their authors believed they had the other. Refusing to guess converts a silent wrong answer into a build error with a filename on it.

**Why is Partial Prerendering no longer a flag?**
Because it stopped being an optimisation and became the rendering model. Once every route is validated to produce a static shell, and once cached and uncached content can coexist in one route with the uncached parts behind boundaries, what you have *is* PPR — a static shell with dynamic holes. There is nothing left to opt into. Practically, this means `experimental.ppr` in `next.config` and `experimental_ppr` on a segment are both removed rather than deprecated, and a codemod exists for the segment config.

**Can you adopt Cache Components for part of an application?**
Not by route, because the flag is global and requires the Node.js runtime everywhere. What you *can* stage is the work: `instant = false` on a segment defers validation feedback for it while the rest of the app converts, and a codemod applies that opt-out across the whole `app/` directory in one pass. That is a migration schedule, not partial adoption — the model is on everywhere from the moment the flag flips, and any route still exporting `dynamic`, `revalidate` or `fetchCache` errors immediately.

---

← [Chapter index](01-explanation.md) · Next → [01b · What the model costs](01b-what-the-model-costs-persistence-storage-and-the-runtime-floor.md)
