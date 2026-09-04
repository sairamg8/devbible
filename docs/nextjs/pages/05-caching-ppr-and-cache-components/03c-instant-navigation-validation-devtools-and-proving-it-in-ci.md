---
title: "A passing build proves the navigation is instant, not that it is good — and the boundary that satisfies validation on a page load may not exist during a client navigation at all"
sidebar_label: "03c · Validation, DevTools and CI"
sidebar_position: 8
description: "Why a direct visit and a client navigation render differently, what instant-navigation validation actually checks, the Navigation Inspector workflow, and the @next/playwright instant() helper that turns a shell into a CI assertion."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Ensuring instant navigations](https://nextjs.org/docs/app/guides/instant-navigation) (docs `lastUpdated` 2026-08-25) and [Caching](https://nextjs.org/docs/app/getting-started/caching) (`lastUpdated` 2026-08-25).
> Target: **Next.js 16.3.4**, App Router, Cache Components. Documentation-verified; **no sandbox run**.

**The reason Cache Components is enforceable rather than aspirational is that the framework checks your routes and names the component blocking each one. But there are two traps in relying on that, and both are stated plainly in the documentation and ignored just as plainly in practice. The first is that a direct visit and a client navigation are *different renders with different information available*, so a `<Suspense>` boundary that covers one may sit entirely outside the other's scope — which is why a route can pass on a page load and block on a transition. The second is that validation is a structural check: it can prove a shell exists, and it cannot tell you whether anything useful is in it. A single boundary around your whole page satisfies it perfectly and produces the worst loading state you can ship.**

## What "instant" means, precisely

> *"A navigation is **instant** when the browser can start rendering the new page the moment the user clicks, with static, cached, and fallback content showing up right away, while the server streams the remaining content into its fallbacks."*

With one caveat that matters for anyone benchmarking:

> *"This definition assumes caches are warm. Cold caches still require the server to compute the cached result once, so the first navigation to a route may still wait."*

So "instant" is a property of the *structure*, measured with warm caches. A first-visit-after-deploy measurement is not measuring the thing validation checks — and since a deploy resets every `use cache` entry ([01b](01b-what-the-model-costs-persistence-storage-and-the-runtime-floor.md)), the first measurement after every release is the cold one.

## 🔴 The asymmetry: two arrivals, two renders

This is the fact the whole page rests on:

> *"**Direct visits** get the **static shell** as HTML, typically from a CDN. **Client navigations** only re-render below the layout the current and destination routes share, so the fallback UI defined by a `<Suspense>` boundary above that point can't be used during the transition."*

Concretely: a boundary in your root layout covers everything on a page load, because a page load renders from the document root. On a navigation from `/teams/acme/board` to `/teams/orbit/board`, only the components below the shared `/teams/[team]` layout re-render — so that root-layout boundary is *above the re-render scope and never triggers*.

> *"A `<Suspense>` boundary in the root layout covers everything on a page load, but on this navigation, it sits above the re-render scope and does not trigger."*

The same asymmetry runs through the client hooks, in the opposite direction:

> *"`useSearchParams()` suspends during server rendering because search params are not available at build time. But on a client navigation, the router already has the params from the URL and the hook resolves synchronously. The same component can render immediately on a client navigation but sit behind a fallback on a page load."*

**So one component can be fast one way and slow the other, in either direction.** That is why the framework validates both cases independently:

> *"Each case is validated independently. A `<Suspense>` boundary that covers one navigation path might not cover another. This is why a page can pass the page load check but fail for client navigations, and why catching these issues by hand is difficult as the number of routes grows."*

That last clause is the honest argument for the tooling. This is not a thing you reason about correctly across a hundred routes.

## What validation checks, and how to turn it down

> *"By **default** (`validationLevel: 'warning'`), Cache Components apps validate every Page and Default segment in development."*

> *"Validation runs on every page load using the real request from your browser, so dynamic params like `[slug]` are checked against actual values as you navigate."*

That second sentence is worth pausing on: validation is not a static analysis. It runs against real requests as you browse, which means **routes you never visit in development are never validated**. A route behind a feature flag or an admin login can be perfectly broken and perfectly quiet.

To validate only segments that explicitly opt in:

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    instantInsights: {
      validationLevel: 'manual-warning',
    },
  },
}

export default nextConfig
```

The per-segment opt-out is `instant = false`, whose two hard limits — it does not clear synchronous IO errors, and it does not make the navigation fast — are covered at [01c](01c-flipping-the-flag-on-an-existing-app.md).

⚠️ **Validation output never reaches the HTTP response.** *"Insights don't show up in the HTTP response. An offending route still returns `200` with rendered HTML in dev."* A CI job that curls a route and checks the status will pass a route with no shell at all. The machine-checkable mechanism is the test helper below, not the dev server.

## Seeing the shell: the Navigation Inspector

The Inspector freezes a navigation at its initial loading state, which is the only reliable way to see what a user actually sees before streaming completes. It is available whenever Cache Components is enabled.

The workflow: open Next.js DevTools, select **Navigation Inspector**, toggle **Pause on navigations**. The next refresh or link click freezes. The panel labels what it caught — **Page load** with the target URL, or **Client nav** with both source and target — which is exactly the distinction that matters, made visible.

Two details that save time:

- **Every navigation pauses while the toggle is on.** Turn it off when you are done, or you will spend ten minutes wondering why the app is broken.
- **The first visit is cold.** On a cold cache both fallbacks appear; refresh and the cached content is there. Do not diagnose a caching problem from the first freeze.

Pair it with the React DevTools Suspense panel, which lists the boundaries in the tree and lets you toggle each between fallback and resolved — that is how you find out *which* boundary is responsible for a region, rather than guessing from the layout.

## 🔴 Validation passing is not the goal

> *"Validation passing means the navigation is instant. It does not mean the loading states are good. A `<Suspense>` boundary placed high in the tree (say, wrapping the whole page) might satisfy validation, but it replaces most of the page with a single fallback on every navigation."*

> *"The best loading states keep as much real, cached content visible as possible and only show fallbacks where data is actually in flight."*

The two ways to satisfy validation are not equivalent:

```tsx
// ❌ Passes validation. Every navigation blanks the page.
export default function BoardPage({ params }: PageProps<'/teams/[team]/board'>) {
  return (
    <Suspense fallback={<WholePageSkeleton />}>
      <Board params={params} />
    </Suspense>
  )
}
```

```tsx
// ✅ Also passes validation. The user keeps the chrome, the columns and the
// legend, and sees a fallback only where data is genuinely in flight.
export default function BoardPage({ params }: PageProps<'/teams/[team]/board'>) {
  return (
    <main>
      <BoardHeader />
      <BoardLegend />
      <Suspense fallback={<ColumnsSkeleton />}>
        <BoardColumns params={params} />
      </Suspense>
      <Suspense fallback={<ActivitySkeleton />}>
        <RecentActivity params={params} />
      </Suspense>
    </main>
  )
}
```

Both are green. One of them is the product. The documentation's framing — *"a product page that keeps the header, image, and description visible with only the price and availability behind a fallback feels faster than a full-page skeleton, even at the same total load time"* — is the design rule: perceived speed is about how much survives, not how long the total takes.

## Turning a shell into a CI assertion

Structural validation runs in development against routes you happen to visit. To hold the line as the codebase grows, the documented mechanism is an end-to-end test that asserts on what is actually visible at navigation time. `@next/playwright` provides `instant()`, which scopes assertions to the immediately-available UI:

```bash
npm install -D @next/playwright @playwright/test
```

```typescript
// e2e/board.test.ts
import { test, expect } from '@playwright/test'
import { instant } from '@next/playwright'

test.describe('Board (/teams/[team]/board)', () => {
  test('is instant on an initial page load', async ({ page, baseURL }) => {
    await instant(
      page,
      async () => {
        await page.goto('/teams/acme/board')
        // In the shell:
        await expect(page.getByRole('heading', { name: 'Sprint board' })).toBeVisible()
        // NOT in the shell — it streams:
        await expect(page.getByTestId('unread-count')).toHaveCount(0)
      },
      { baseURL }
    )
    // Outside the scope, streaming has completed.
    await expect(page.getByTestId('unread-count')).toBeVisible()
  })

  test('is instant on a client navigation', async ({ page }) => {
    await page.goto('/teams/acme/board')
    await instant(page, async () => {
      await page.click('a[href="/teams/orbit/board"]')
      await page.waitForURL((url) => url.pathname === '/teams/orbit/board')
      await expect(page.getByRole('heading', { name: 'Sprint board' })).toBeVisible()
    })
  })
})
```

Three rules the documentation states and each of which is a real failure if ignored:

1. **Pass `baseURL` when `page.goto()` is the first navigation** — *"The helper needs the origin before requesting the document."*
2. **Wait for the destination URL before asserting on a client navigation** — *"Otherwise, a shared selector can match the source page before the destination commits."* A heading present on both pages will match the *old* page and the test will pass while proving nothing.
3. **`instant()` is the Inspector, scripted.** *"The start of the `instant()` scope is the same as turning on **Pause on navigations** in the Navigation Inspector, and the end of the scope releases the pause the way **Resume** does."*

These run against `next dev` unmodified. For a production build in CI:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: { exposeTestingApiInProductionBuild: true },
}
```

⚠️ **Note what that flag does before enabling it globally.** It causes `next start` to expose the testing API. Gate it on an environment variable rather than shipping it to production unconditionally.

**The assertion that carries the value is the negative one.** `toHaveCount(0)` inside the scope is what proves a region is genuinely streaming rather than blocking; a test that only asserts things are visible will pass on a fully-blocking page that eventually renders everything.

## Gotchas

**★ Symptom: a route passes validation on a page load and blocks on a client navigation.** Cause: the boundary covering it lives in a layout shared by both routes, so it is above the re-render scope during the transition and never triggers. Fix: put a boundary below the shared layout — inside the page, or in a segment the navigation actually re-renders.

**★ Symptom: a component needs a `<Suspense>` boundary on a page load but appears fine during navigation, so the requirement looks arbitrary.** Cause: `useSearchParams` and friends genuinely differ — search params are unknown at build time so the hook suspends on a server render, and known from the URL on a client navigation so it resolves synchronously. Fix: treat the boundary as unconditional for these hooks rather than testing one path and concluding.

**★ Symptom: CI is green and a route with no shell reaches production.** Cause: insights never appear in the HTTP response — an offending route returns `200` with rendered HTML in dev. Nothing about the response distinguishes it. Fix: assert with the `instant()` helper, which is the documented machine-checkable form; a status-code check cannot see this class of defect.

**★ Symptom: an admin or feature-flagged route is broken and validation never mentioned it.** Cause: validation runs on every page load using the real request from your browser — routes nobody browses in development are never checked. Fix: either visit them deliberately during development or cover them with `instant()` tests, which is the more durable of the two.

**★ Symptom: an `instant()` test on a client navigation passes even after you break the destination.** Cause: the assertion matched the *source* page, because the destination had not committed yet and the selector exists on both. Fix: `await page.waitForURL(...)` before asserting — and note that if the prefetched destination cannot commit, that wait times out, which is the failure you wanted.

**★ Symptom: `instant()` throws about an origin on the first navigation of a test.** Cause: the helper needs the origin before it requests the document, and the first `page.goto()` has not established one. Fix: pass Playwright's `baseURL` as the third argument.

**★ Symptom: the whole app appears frozen while you are debugging.** Cause: **Pause on navigations** is still on, and it pauses *every* navigation, not just the next one. Fix: toggle it off. This is not a bug and it is the most common ten-minute detour of the workflow.

**★ Symptom: you wrap the page in one boundary, validation goes green, and users complain the app got worse.** Cause: validation is structural — it proves a shell exists, not that anything useful is in it, and a single top-level boundary satisfies it while removing nearly the whole page from the shell. Fix: push boundaries down to the smallest subtree doing deferred work, and confirm with the Navigation Inspector rather than with the absence of warnings.

**★ Symptom: benchmark numbers are much worse than the documented behaviour describes.** Cause: "instant" assumes warm caches, and a cold cache still requires the server to compute the cached result once. Since a deploy resets every `use cache` entry, the first measurement after a release is always the cold path. Fix: warm the route before measuring, and measure the cold path separately as its own number rather than conflating them.

## Interview questions

**★ Why can the same route be instant on a direct visit and blocking on a client navigation?**
Because they are different renders. A direct visit renders from the document root, so every `<Suspense>` boundary in the tree — including one in the root layout — is in scope. A client navigation only re-renders below the layout the current and destination routes share, so any boundary above that shared layout is outside the re-render scope and simply never triggers. A route whose only boundary lives in the root layout therefore has full fallback coverage on a page load and none at all on a transition between two of its own sub-routes. This is why Next.js validates the two cases independently, and why the documentation says catching this by hand gets impractical as route count grows.

**★ Validation passes. What has it actually proved, and what has it not?**
It has proved the navigation is *instant* in the structural sense: there is a static shell, and nothing above the boundaries blocks its production. It has not proved the shell contains anything worth looking at. A single `<Suspense>` wrapped around an entire page satisfies validation completely while replacing the whole page with one fallback on every navigation — structurally perfect, experientially worse than what you had. The documentation is explicit that these are separate questions, and the design rule it gives is that good loading states keep as much real cached content visible as possible and show fallbacks only where data is genuinely in flight. Perceived speed is about how much survives the transition, not the total time.

**★ Why can't a CI job detect a blocking route by checking status codes?**
Because insights never appear in the HTTP response — an offending route still returns `200` with fully rendered HTML in development. The information exists only in the dev overlay, the dev-server log, or the MCP `get_errors` tool. There is nothing in the response for a status check or even a body diff to catch, since the page does eventually render correctly; it just renders at request time instead of shipping a shell. The documented machine-checkable mechanism is the `instant()` helper from `@next/playwright`, which scopes assertions to the UI available at navigation time — and the assertions that carry the value are the negative ones, checking that streaming content is *absent* from the immediate UI.

**★ What is the most important assertion in an `instant()` test, and why?**
The negative one. Asserting that cached and static content is visible inside the scope is necessary but weak — a fully blocking page that eventually renders everything will satisfy it. What proves the shell is real is asserting that the streaming content is *not* yet present: `toHaveCount(0)` on the region you expect to arrive later, inside the scope, followed by `toBeVisible()` on the same region outside it. That pair establishes both that the shell shipped without waiting and that the deferred content does in fact arrive. Without the negative assertion the test cannot distinguish an instant navigation from a slow one that finished before the assertion ran.

**★ Why does an `instant()` test on a client navigation need `waitForURL`?**
Because the assertion can otherwise match the page you navigated *from*. A selector like a heading role or a shared test id typically exists on both the source and the destination, and at the moment the click is dispatched the destination has not committed — so the assertion finds the source page's element and passes without ever examining the destination. Waiting for the destination URL forces the commit before any assertion runs. It has a useful secondary property: if the prefetched destination cannot commit at all, the wait times out and the test fails, which is exactly the regression the test exists to catch.

**Validation runs against real requests as you browse. What does that miss?**
Every route you do not visit. Validation is not a static sweep of the route tree — it runs on each page load using the actual request from your browser, which is what lets it check dynamic params against real values rather than placeholders. The trade is that an admin area, a route behind a feature flag, or any page not part of your normal development loop is never validated and can be arbitrarily broken while the overlay stays clean. That is the strongest argument for the `instant()` tests: they are the only mechanism that covers routes nobody happens to open, and they keep covering them after the person who understood the boundary placement has left the team.

**What does "instant assumes warm caches" mean for how you benchmark?**
That the definition validation enforces is about structure, measured under warm conditions — a cold cache still requires the server to compute the cached result once, so the first navigation to a route may legitimately wait. Combined with the fact that a deploy invalidates every `use cache` entry, because the build id is part of the cache key, this means the first request to any route after a release is always the cold path. A benchmark that measures immediately post-deploy is measuring something real but different from what validation checks. The useful practice is to treat them as two numbers: warm navigation time, which is what the structure buys you, and cold first-visit time, which is what your users get at every release and which no amount of boundary placement improves.

---

← [03b · Maximizing the shell, and crawlers](03b-maximizing-the-shell-the-app-shell-and-what-crawlers-get.md) · [Chapter index](01-explanation.md) · Next → **04 · Revalidation and ISR** *(not written yet)*
