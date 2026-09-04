---
title: "Static and dynamic stopped being a mode you pick for the application and became a property each route acquires — usually by accident, the moment something in it reads a cookie"
sidebar_label: "03b · Hybrid static/dynamic"
sidebar_position: 4
description: "The third pillar of the philosophy: why static and dynamic are per-route rather than global, what actually flips a route to request-time rendering, streaming as the escape from the all-or-nothing choice, and where the framework is heading with Cache Components."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) (`version: 16.3.4`, `lastUpdated` 2026-08-25) and the [16.3 release post](https://nextjs.org/blog/next-16-3) (`publishedAt` August 3rd 2026).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**; **no benchmarks run**.
> ⚠️ This page is the *philosophy* of the static/dynamic split. The mechanics live in [chapter 5](../05-caching-ppr-and-cache-components/01-explanation.md) and [chapter 6](../06-ssg-isr-and-ssr-strategy/01-explanation.md); read those for the rules, this one for why the model is shaped this way.

**The older generation of frameworks made you choose once, for the whole site: a static site generator, or a server-rendered application. Next.js's third architectural bet is that this choice belongs to the route, and increasingly to the individual fetch. That is more powerful and considerably easier to get wrong, because a route's rendering strategy is not something you declare — it is something the route acquires from what its code happens to do. The most expensive bugs in this area are all the same bug: a route changed strategy and nobody noticed.**

## The old choice, and why it was a false one

| | Static site generator | Server-rendered app |
|---|---|---|
| Freshness | Rebuild to change anything | Always current |
| Cost per request | Serve a file | Run code |
| Personalisation | None without client JS | Native |
| First byte | Fast, and constant | Depends on your slowest query |

Real applications are not one of these. A SaaS product has a marketing page that changes monthly, a pricing page that changes quarterly, a product list that changes hourly, and a dashboard that is different for every user on every request. Choosing one mode for all four means three of them are wrong.

**So the App Router does not have a mode.** Each route is prerendered at build time unless something in it needs request-time information, in which case it renders per request. You do not usually configure this. The route acquires it.

## 🔴 What actually flips a route to request-time

This is the sentence to internalise, because it is where the accidents come from: **a route becomes dynamic when something inside it reads request-time data.** Reading `cookies()`, `headers()` or `searchParams` is the common case.

That has a consequence people find genuinely surprising: **the change can come from a component you did not touch.**

```tsx
// app/layout.tsx — someone adds a personalised greeting to the shared header
import { cookies } from 'next/headers'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get('theme')      // 🔴 every route under this layout
  return <html data-theme={theme?.value}><body>{children}</body></html>
}
```

One cookie read in a shared layout moves **every route beneath it** to request-time rendering. No error, no warning in the diff, no failing test — the marketing pages that used to be static files now execute code on every request. The symptom arrives later as a hosting bill or a latency graph, far from the commit that caused it.

⚠️ **This is the strongest argument for the push-down rule from [03](03-core-philosophy-server-first-rendering.md).** A boundary placed low limits the blast radius of a bundle *and* of a rendering-strategy change. They are the same discipline.

## Streaming: the reason it is not all-or-nothing

If a route were only ever wholly static or wholly dynamic, the model would be barely better than the old one. Streaming is what makes the middle ground real: a route can send its static shell immediately and fill in the slow, personal parts as they resolve.

```tsx
export default async function Dashboard() {
  return (
    <>
      <Nav />                                     {/* static, sent immediately */}
      <Suspense fallback={<TasksSkeleton />}>
        <Tasks />                                 {/* per-user, arrives when ready */}
      </Suspense>
      <Suspense fallback={<BillingSkeleton />}>
        <Billing />                               {/* slow, and blocks nothing */}
      </Suspense>
    </>
  )
}
```

The user sees structure at once instead of a spinner, and the slowest query stops setting time to first byte. **A Suspense boundary is a decision about what the user waits for**, which is a product decision as much as a technical one — worth making deliberately rather than wherever an error told you to add one.

## Where this is going: explicit caching

Early App Router versions cached aggressively and implicitly, and it was the framework's most-criticised behaviour — hard to predict, harder to opt out of. Vercel now describes the direction, quotably, as

> our work over the last year to simplify Next.js back to its roots: dynamic by default, with no hidden or implicit caching.

The replacement is the `'use cache'` directive and Cache Components: caching becomes something you write down rather than something you inherit. Two flags opt in today:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
}
```

🔴 **The behaviours behind Instant Navigations are stated to become the default in a future major version.** So this is not an experiment to watch from a distance — it is the framework's next default, available early. That is also why enabling `cacheComponents` **removes** `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` as of v16.0.0: those are the old implicit model's controls, and the new model replaces rather than extends them.

## The cost model, honestly

Rendering strategy is a cost decision, and the costs are not symmetric:

| | Prerendered | Request-time |
|---|---|---|
| Per-request compute | ~none | Every request runs your code |
| Data freshness | As of build or last revalidation | Current |
| Failure mode under load | Serves fine | Your database is the bottleneck |
| Failure mode when wrong | **Stale data shown to users** | **Cost and latency** |

⚠️ **The two failure modes have wildly different severities and that asymmetry should drive the default.** A page that is accidentally dynamic costs money and milliseconds. A page that is accidentally static can show one customer another customer's data, if what made it static was `force-static` blanking the `cookies()` call an auth check depended on. Cost is recoverable; a data leak is not.

**No numbers are quoted here on purpose.** Compute cost per request depends entirely on your host, your query shapes and your traffic; any figure printed in a book is someone else's application. Measure your own — this page gives you the shape of the trade, not its magnitude.

## Gotchas

**★ Symptom: hosting costs jump after a release that "only changed the header".** Cause: something in a shared layout started reading `cookies()`, `headers()` or `searchParams`, which moves every route beneath it to request-time rendering. Nothing errors and no test fails. Fix: keep request-time reads out of shared layouts; push them into the specific component that needs them, behind its own Suspense boundary.

```tsx
// ❌ app/layout.tsx reads cookies() → every route under it is dynamic
// ✅ app/components/theme-badge.tsx reads cookies() → only this subtree is
```

**★ Symptom: after adding `force-static` to speed a route up, an auth check silently takes the logged-out branch.** Cause: `force-static` does not error on `cookies()`/`headers()` — it **blanks** them. Your code reads empty values and takes the anonymous path, which for an authorization check can mean showing the wrong user's view. Fix: never force a route static to fix a performance symptom without first establishing that nothing in it reads request state.

**★ Symptom: a page shows a spinner for two seconds, then everything at once.** Cause: no Suspense boundaries, so the whole route waits on its slowest data. Fix: decide what the user should see immediately — usually navigation and page structure — and wrap each independently-slow region separately. One boundary around everything is barely better than none.

**★ Symptom: on upgrading to 16, the build errors on `export const revalidate`.** Cause: `cacheComponents` is enabled, and v16.0.0 removes `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` under it. Fix: this is not a bug to work around — the new model replaces those controls with `'use cache'`. Migrate the intent rather than re-enabling the old flags.

**★ Symptom: the same route is static in one environment and dynamic in another.** Cause: strategy is derived from what the code does, and environment-specific branches change that — a feature flag read from a header, or a debug path reading `searchParams`. Fix: check the build output, which reports each route's rendering strategy, and treat an unexpected change there as a regression.

**Symptom: a marketing page is prerendered and shows last month's pricing.** Cause: it is genuinely static and nothing revalidates it. Fix: this is the *correct* failure mode of a static page and the reason revalidation exists; give content that changes on a human timescale a revalidation interval rather than making the route dynamic.

**Symptom: a team concludes "just make everything dynamic, it's simpler".** Cause: reasonable fatigue with a subtle model. Fix: it is simpler and it discards the framework's main advantage, which is that most of most applications does not need to be personal. The honest version is to make everything dynamic *deliberately*, measure, and reintroduce static where it pays — not to arrive there by accident.

**Symptom: a Suspense boundary was added to silence an error and the layout now jumps on load.** Cause: the fallback's dimensions do not match the resolved content, so the boundary is a layout-shift generator. Fix: skeletons should reserve the real geometry. A boundary is a product decision about what the user waits for, and a fallback that changes size is a worse experience than a slightly longer wait.

## Interview questions

**★ What makes a route dynamic in the App Router?**
Not a declaration — something inside it reading request-time data, typically `cookies()`, `headers()` or `searchParams`. The route acquires the strategy from what its code does. The dangerous consequence is that the trigger can be in a component you did not touch: one cookie read added to a shared layout moves every route beneath it to request-time rendering, with no error and no failing test. That is the single most common cause of an unexplained hosting-cost jump after a release.

**★ Why is "accidentally static" a more serious bug than "accidentally dynamic"?**
Because the failure modes are asymmetric. An accidentally dynamic route costs compute and latency — recoverable, and visible on a graph. An accidentally static route shows stale data, and if what made it static was `force-static`, it is worse than stale: `force-static` does not error on `cookies()` or `headers()`, it blanks them, so an authorization check reads empty values and takes the logged-out branch. That can show one user another user's view. Cost is recoverable; a data-exposure incident is not, so the default should lean toward the recoverable failure.

**★ What is Next.js correcting with "dynamic by default, with no hidden or implicit caching"?**
Earlier App Router versions, which cached aggressively and implicitly. It was the framework's most-criticised behaviour — unpredictable, hard to opt out of, and it made simple dynamic pages mysteriously stale. The `'use cache'` directive and Cache Components replace it with caching you write down. It matters practically because those behaviours are stated to become the default in a future major, so `cacheComponents: true` today is the framework's next default. It also explains why enabling it removes `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` as of v16.0.0 — those are the old model's controls, and this is a replacement rather than an extension.

**Why isn't the static/dynamic choice made once for the whole application?**
Because real applications are not uniform. A SaaS product has marketing pages that change monthly, a product list that changes hourly, and a dashboard that differs per user per request. One global mode makes most of those wrong: a static generator can't personalise, and a fully server-rendered app pays per-request compute for pages that never change. Moving the decision to the route — and with per-fetch caching, below the route — lets each part of the application be as static as it can afford to be.

**What is a Suspense boundary really deciding?**
What the user waits for, which is a product decision wearing technical clothes. Without boundaries a route waits on its slowest data and the user gets a spinner then everything at once. With them, the static shell arrives immediately and each slow region fills in independently, so the slowest query stops setting time to first byte. That is also why boundaries added reflexively to silence an error tend to be badly placed — and why a fallback whose dimensions don't match the real content trades a wait for a layout shift, which is usually the worse deal.

**How would you audit an application for accidental dynamic rendering?**
Start from the build output, which reports each route's rendering strategy, and treat that report as something to diff across releases rather than read once. Then grep shared layouts for request-time APIs, since those have the widest blast radius. The structural fix is the same discipline as the `'use client'` push-down rule: keep request-time reads in the narrowest component that needs them, behind their own Suspense boundary, so a strategy change stays local instead of cascading to every route under a layout.

---

← Prev [03 · Core philosophy: server-first](03-core-philosophy-server-first-rendering.md) · [Index](01-explanation.md) · Next → [04 · Versioning and the LTS model](04-versioning-and-lts-model-what-stable-canary-and-preview-mean.md)
