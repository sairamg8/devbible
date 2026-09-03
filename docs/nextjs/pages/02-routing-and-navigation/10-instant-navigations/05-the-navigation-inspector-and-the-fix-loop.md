---
sidebar_position: 5
title: "The Navigation Inspector exists because Next.js does not prefetch in development, and it is the only way to see the shell a user would actually get before you ship"
sidebar_label: "5 · Navigation Inspector and the fix loop"
description: "Freezing a page load or client navigation at its shell, the relationship between Pause on navigations and the instant() test scope, a worked two-step fix of a blocking route, and the agent loop the docs prescribe."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against [Ensuring instant navigations](https://nextjs.org/docs/app/guides/instant-navigation), [`instant` route segment config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/instant) and the [Next.js 16.3 release blog](https://nextjs.org/blog/next-16-3).
> Target: **Next.js 16.3.4** · Navigation Inspector requires `cacheComponents`.

**Development is the one environment where you cannot observe an instant navigation, because Next.js disables prefetching there. That is the entire reason the Navigation Inspector exists: it freezes a page load or a client navigation at its shell so you can look at the loading state a real user would see. Pair it with the two-step fix loop the guide walks — push URL-dependent work down behind a boundary, then give the remaining uncached reads a cache lifetime — and you have the complete development-time workflow. What it will not do is tell you whether the shell is *good*; that judgement stays yours.**

## Why it exists

Next.js **disables prefetching in development**, which makes it genuinely hard to know what a
user will see during a given navigation's loading sequence.

The Navigation Inspector answers that by letting you **pause page loads and client-side
navigations at the shell**, so the loading state a user would actually see is held on screen.

It is available with Cache Components alone; Partial Prefetching is not required:

```ts title="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

## The workflow

Open the Next.js DevTools, select **Navigation Inspector**, and turn on **Pause on navigations**. While the toggle is on:

Refreshing freezes the initial static UI generated for the route, before any dynamic data
streams in. Clicking a link freezes the **prefetched** UI for the destination route.

The panel labels which of the two you are looking at — **Page load** with the target URL, or **Client nav** with both source and target URLs — which is the concrete, visible form of the distinction that runs through this whole topic. Click **Resume** to let the navigation finish.

Walking the store example from [chunk 1](01-what-instant-means.md): refresh `/store/shoes` on a cold cache and both fallbacks are visible. Refresh again and the product name appears immediately from cache while availability still shows its fallback. Then click through to `/store/hats` and the Inspector labels it **Client nav**; the product name and price are there from cache, and only the inventory fallback remains. That progression *is* the mental model, made observable.

The React DevTools Suspense panel is the natural companion:

it lists the `<Suspense>` boundaries in the tree and lets you toggle each between its fallback
and resolved state — which is how you find out precisely which boundary covers which part of
the page.

## The Inspector and the test helper are the same mechanism

This is worth internalising, because it explains why an `instant()` test and an Inspector session always agree:

Entering the `instant()` scope does the same thing as turning on **Pause on navigations** in
the Inspector, and leaving the scope releases the pause exactly as **Resume** does. The test
helper and the devtool are two interfaces to one mechanism.

The DevTools hold back dynamic content using a `next-instant-navigation-testing` cookie. The Inspector is the interactive front end for that mechanism and `instant()` is the programmatic one; what you see frozen in the panel is what the assertion block sees.

## A blocking route, fixed in two steps

The starting point — two top-level `fetch()` calls, one of which also awaits `params`:

```tsx title="app/products/[slug]/page.tsx"
export default async function ProductPage(
  props: PageProps<'/products/[slug]'>
) {
  const featured = await getFeatured()
  const { slug } = await props.params
  const res = await fetch(`https://next-recipe-api.vercel.dev/products/${slug}`)
  const product = await res.json()

  return (
    <div>
      <FeaturedSection items={featured} />
      <h1>{product.name}</h1>
      <p>${product.price}</p>
      <p>{product.description}</p>
    </div>
  )
}

async function getFeatured() {
  const res = await fetch('https://next-recipe-api.vercel.dev/products?limit=3')
  return res.json()
}
```

**Step 1 — push the slug-dependent work down.** Extract it into a child and wrap that child in `<Suspense>`, so `await props.params` and the product fetch suspend together *inside* the boundary:

```tsx title="app/products/[slug]/page.tsx"
import { Suspense } from 'react'

async function ProductInfo({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const res = await fetch(`https://next-recipe-api.vercel.dev/products/${slug}`)
  const product = await res.json()
  return (
    <>
      <h1>{product.name}</h1>
      <p>${product.price}</p>
      <p>{product.description}</p>
    </>
  )
}

export default async function ProductPage(
  props: PageProps<'/products/[slug]'>
) {
  const featured = await getFeatured()
  return (
    <div>
      <FeaturedSection items={featured} />
      <Suspense fallback={<p>Loading product...</p>}>
        <ProductInfo params={props.params} />
      </Suspense>
    </div>
  )
}
```

**Step 2 — cache what is left.** The insight now names `getFeatured()`:

```tsx title="app/products/[slug]/page.tsx"
async function getFeatured() {
  'use cache'
  const res = await fetch('https://next-recipe-api.vercel.dev/products?limit=3')
  return res.json()
}
```

The result is cached at the **fetch level**, and the featured list ships with the App Shell.

And a deployment caveat that bites teams the first time they ship this:

On serverless deployments, in-memory caching with `"use cache"` **will not persist across
instances** — `"use cache: remote"` is the documented answer where persistence is needed.

## Passing validation is the floor, not the goal

🔴 **Validation passing means the navigation is instant. It does not mean the loading states
are good.** A `<Suspense>` boundary placed high in the tree — wrapping the whole page, say —
can satisfy validation while replacing most of the page with a single fallback on every
navigation.

A product page that keeps the header, image and description visible, with only price and
availability behind a fallback, feels faster than a full-page skeleton — **at the same total
load time**. The metric and the experience are not the same thing.

The Inspector is how you tell those two situations apart, because they are indistinguishable in the overlay.

## The agent loop, as documented

The guide states the loop explicitly:

- **Observe** — read validation insights and choose the exact navigation and UI that should appear immediately.
- **Test** — confirm the target UI renders normally, then write an `instant()` test and verify that it *fails* before changing the route.
- **Fix** — apply the fix the insight names (`use cache` or `<Suspense>`) and re-run validation.
- **Verify** — run the test against a production-like build and keep the passing test as a regression guard.

Three levers do the work: **push down** (extract I/O into a Suspense-wrapped child so static siblings lift into the shell), **cache** (pair `'use cache'` with `cacheLife`), and **per-link prefetching** for routes that read URL data.

And the sentence that keeps an agent from inventing a caching policy:

What it does need is your app-specific intent: what should appear immediately, what may stream
in, and what must stay fresh. And when a caching decision is unclear the documented default is
to **keep the data fresh behind `<Suspense>` rather than guess a cache lifetime** — a wrong
guess is a correctness bug, a missing cache is only a slow page.

## Gotchas

**★ The DevTools cookie is scoped to the domain, not the port, so two local projects fight over it.**
Cookies are scoped to the **domain, not the port**. Run several projects on the same domain —
`localhost`, typically — and the cookie is shared across all of them, which produces behaviour
that looks inexplicable until you remember the port is not part of the scope.

The symptom is a second project on another port behaving strangely — freezing when you did not ask it to, or refusing to. Clear the `next-instant-navigation-testing` cookie or close the Navigation Inspector panel when switching between projects. The docs say this will be fixed as part of stabilising the feature.

**★ "Pause on navigations" stays on until you turn it off.**
Clicking **Resume** completes the current navigation only; the toggle remains armed and the next refresh or link click pauses too. Ten minutes later you are debugging an unrelated problem and every click freezes. Turn it off when you finish inspecting.

**★ The Inspector needs `cacheComponents`, not `partialPrefetching`.**
Teams mid-migration sometimes conclude the panel is missing because they have not enabled Partial Prefetching yet. Cache Components alone is enough, and inspecting shells before you flip the prefetch flag is the sensible order.

**★ Development timing tells you nothing, even with the Inspector open.**
The Inspector shows you *what* is in the shell. It does not make development representative of production latency, because there is still no prefetching in dev. Never conclude "this feels fast enough" from a dev session; conclude "this is the content the shell carries" and take timing from a production build.

**★ In-memory `'use cache'` does not survive a serverless deployment's instance boundaries.**
A route that validates cleanly and behaves perfectly locally can miss cache on most requests in production because each instance has its own memory. Where persistence matters, use `'use cache: remote'`. This is a deployment-shape problem that no amount of local inspection will reveal.

**★ Identical before/after captures mean the refactor did not take effect.**
The guide is direct: *"Each refactor should pair with a before/after capture to verify the change actually landed. Identical-looking captures mean the refactor didn't take effect."* Insight cleared plus unchanged shell is the signature of a fix applied to the wrong component, or of a `'use cache'` whose `stale` is too short to reach the shell.

**★ A `<Suspense>` around the whole page passes validation and makes the product worse.**
It is the fastest way to a clean overlay and the surest way to a full-page skeleton on every navigation. Push boundaries down until only data genuinely in flight sits behind a fallback, and use the Inspector — not the overlay — to confirm.

**★ An agent left to choose cache lifetimes will guess, and a wrong guess ships stale data to users.**
The documented instruction is to keep unclear data fresh behind `<Suspense>` rather than assign a lifetime speculatively. Give the agent the app-specific intent up front: what must appear immediately, what may stream, what must never be cached.

## Interview questions

**★ Why does the Navigation Inspector exist at all?**
Because Next.js disables prefetching in development, so a developer cannot observe the loading sequence a production user would get by clicking around `next dev`. The Inspector freezes a page load or client navigation at its shell so the actual initial UI is visible and inspectable, and labels which of the two paths you are looking at.

**★ What is the relationship between the Inspector and the `instant()` Playwright helper?**
They are the same mechanism with two front ends. Both use a `next-instant-navigation-testing` cookie to hold back dynamic content. The documentation states that entering the `instant()` scope is equivalent to turning on **Pause on navigations**, and leaving it is equivalent to clicking **Resume**. So what you see frozen in the panel is precisely what the test's assertions run against.

**★ Walk through fixing a page that awaits `params` and an uncached fetch at its top level.**
Two steps, in the order validation surfaces them. First extract the slug-dependent work — the `await params` and the fetch that uses it — into a child component and wrap it in `<Suspense>`, so both suspend inside the boundary and the rest of the page stays in the shell. Then the next insight names the remaining uncached fetch; give it `'use cache'` so its result ships with the App Shell. Re-navigate after each change, because validation reports one blocker at a time.

**★ A route passes validation. What have you learned, and what have you not?**
You have learned the navigation is structurally instant: there is a non-empty shell and nothing blocks it. You have not learned that the shell is useful. A single `<Suspense>` wrapping the entire page satisfies validation and yields a full-page skeleton on every navigation. Judging shell quality requires looking at it, which is what the Inspector is for.

**★ Your route caches everything correctly and still misses cache constantly in production. What would you check first?**
Whether the deployment is serverless and the cache is in-memory. `'use cache'` results do not persist across instances, so each cold instance recomputes; `'use cache: remote'` is the documented remedy. After that, check whether the cache profile's `stale` time is under five minutes, which keeps the content out of the App Shell regardless of how well it caches.

**★ What is the documented loop for having an agent make a navigation instant?**
Observe, Test, Fix, Verify. Read the validation insights and pick the exact navigation and UI that must be immediate; confirm the target UI renders normally, then write an `instant()` test and check it fails before the change; apply the fix the insight names and re-run validation; finally run the test against a production-like build and keep it as a regression guard. The agent does not need to understand the caching model, but it does need your intent about what must appear immediately, what may stream, and what must stay fresh.

**★ You applied a fix, the insight cleared, and the shell looks exactly as it did before. What does that tell you?**
That the refactor probably did not take effect. Identical before/after captures are the documented signature of a change that did not land — a boundary added around the wrong component, or a `'use cache'` whose `stale` time is under five minutes and therefore never reaches the App Shell. Verify with a capture, not with the absence of a warning.

{/* FOOTER */}
