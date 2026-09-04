---
title: "How much of your page is static is a property of where you put `await` — and the shell a crawler receives is not the shell a browser receives"
sidebar_label: "03b · Maximizing the shell, and crawlers"
sidebar_position: 8
description: "The depth rule that decides how much of a page prerenders, the non-async layout pattern that keeps a shell URL-independent, the difference between a static shell and an App Shell, and the bot path that re-renders everything at request time."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Caching](https://nextjs.org/docs/app/getting-started/caching) (docs `lastUpdated` 2026-08-25) and [ISR with Cache Components](https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components) (`lastUpdated` 2026-08-03).
> Target: **Next.js 16.3.4**, App Router, Cache Components. Documentation-verified; **no sandbox run**.

**[03](03-partial-pre-rendering-ppr-static-shell-dynamic-holes-for-min.md) establishes that a route produces a shell with holes in it. This page is about the two questions that follow, and both have answers that are more mechanical than they first appear. The first is *how much* ends up in the shell, which turns out to be almost entirely a question of how deep in the tree your `await` calls sit — one `await params` at the top of a layout can cost you the whole page, and moving it three components down can recover it. The second is *whose* shell, because there are two different ones: a static shell tied to a known URL, and an App Shell that is deliberately URL-independent. And there is a third audience nobody plans for, which gets neither: a crawler is detected by user agent and served a full dynamic render, which means a page that works perfectly for every human can fail for Googlebot.**

## The depth rule

> *"The deeper your async work sits in the tree, the more of the page can be prerendered. This is the structural pattern Cache Components rewards"*

This is not a style preference. Prerendering proceeds top-down, and the first thing that cannot complete stops everything below it from being evaluated at build time. So an `await` near the root is expensive out of all proportion to what it fetches.

The canonical case is a layout that destructures its params:

```tsx
// ❌ One await at the top. If `team` is not in generateStaticParams, this
// layout cannot prerender — and neither can anything it wraps.
export default async function TeamLayout({
  children,
  params,
}: LayoutProps<'/teams/[team]'>) {
  const { team } = await params
  return (
    <div>
      <TeamSidebar />
      <h1>{team}</h1>
      {children}
    </div>
  )
}
```

> *"If this param is dynamic (not provided by `generateStaticParams`), it is runtime data and the layout cannot be prerendered."*

The fix is to stop awaiting and start *passing the promise down*, so the `await` happens inside a boundary:

```tsx
// ✅ Not async. The promise travels; the await happens below the boundary.
import { Suspense } from 'react'

export default function TeamLayout({
  children,
  params,
}: LayoutProps<'/teams/[team]'>) {
  return (
    <div>
      <TeamSidebar />
      <Suspense fallback={<TeamNameSkeleton />}>
        <TeamHeading params={params} />
      </Suspense>
      {children}
    </div>
  )
}

async function TeamHeading({ params }: Pick<LayoutProps<'/teams/[team]'>, 'params'>) {
  const { team } = await params
  return <h1>{team}</h1>
}
```

Now `TeamSidebar`, `{children}` and the fallback all reach the shell. Only the heading streams. **The component removed the word `async` from the layout signature — that is the entire change**, and it moved a whole page's worth of markup from request time to build time.

🔴 **Do this even for params you *did* enumerate.** This is the rule that is easy to skip because it looks like an optimisation you have already earned:

> *"Keep the read inside the boundary even for the categories `generateStaticParams` covers. A statically known param still belongs to one URL, so awaiting it above the Suspense boundary would tie this layout's App Shell to that URL."*

Awaiting a known param does not fail — it produces a shell that is only valid for that one URL, which forfeits the reusable App Shell for every other URL under the layout. The cost is invisible: the enumerated pages are fine, and every un-enumerated one is slow.

## Two different shells

The vocabulary matters here because the two are used interchangeably in the wild and they are not the same object.

| | **Static shell** | **App Shell** |
|---|---|---|
| Depends on the URL? | yes — built for known params | no — deliberately URL-independent |
| When it is used | a URL listed in `generateStaticParams` | any URL whose params were not listed |
| Param-specific parts | present, concrete | left behind their fallbacks |

> *"When a route's dynamic params are known, the shell contains that concrete content, and any remaining uncached or runtime data still streams behind its `<Suspense>` fallback. When the params aren't known, the reusable, URL-independent version is the **App Shell**: the same static shell with the param-specific parts left behind their fallbacks."*

The App Shell is what makes the old either/or disappear. Under the previous model a dynamic route was either enumerated at build time or rendered from scratch on first visit. Now:

> *"In a route with dynamic param segments, `generateStaticParams` prerenders the URLs you list at build time. Any other URL is served the App Shell instantly, then upgraded in the background with its now-known params and cached for the next visitor."*

⚠️ **This is version-gated and recent.** *"The App Shell for unlisted params is served from Next.js 16.3. Earlier versions wait for a full server render before sending the response."* If you are on 16.0–16.2 the instant-shell behaviour is simply not there, and a benchmark taken on 16.1 says nothing about 16.3.

The scale consequences — how many params to enumerate, what the upgrade produces, and what happens when the path set changes — belong to chapter 6 and are worked through at [ch6 · 02d](../06-ssg-isr-and-ssr-strategy/02d-when-the-path-set-changes-and-what-cache-components-changes.md) and [ch6 · 03](../06-ssg-isr-and-ssr-strategy/03-isr-at-enterprise-level-stale-while-revalidate-tuning.md). The one line worth carrying here is the framework's own argument against enumerating everything:

> *"Not every route needs to be prerendered. Every page you prerender increases build work and produces output that has to be stored and deployed. Many routes may never be visited before your next deployment, making that work unnecessary."*

## 🔴 Crawlers do not get a shell

This is the single most surprising behaviour in the model, and it has direct SEO consequences:

> *"Browsers receive the static shell instantly. Bots and crawlers are detected by their user agent and handled differently: because they need a complete document, Next.js skips the shell and renders the entire page dynamically at request time, then sends the finished HTML once the render completes."*

The reasoning is sound — a crawler that received a shell full of skeletons would index skeletons. But the consequence is a second, less-exercised rendering path for the audience whose experience you can least observe:

> *"Because the shell is re-rendered instead of reused, work that completed during prerendering now runs at request time for a bot. If part of your shell depends on inputs that only exist while prerendering, such as build-time data or values that are not reachable in the request-time environment, a page that loads for a person can fail to render for a crawler. Make sure the data your shell relies on is also available at request time."*

**Read that as a warning about build-time-only inputs.** The shape that breaks is easy to write and looks correct:

```tsx
// ❌ Fine for every human. Fails for Googlebot.
// This file is present in the build container and absent at runtime.
import { readFile } from 'node:fs/promises'

const manifest = JSON.parse(
  await readFile('./.build-artifacts/manifest.json', 'utf-8')
)

export default function Page() {
  return <FeatureList features={manifest.features} />
}
```

At build time the read succeeds and the value goes into the shell. Every browser gets that shell and never re-executes the module. A crawler triggers a full request-time render, the file is not in the serverless bundle, and the render throws — so the page that ranks is the page that 500s.

```tsx
// ✅ The data is reachable in both environments, so both paths produce a page.
import { cacheLife } from 'next/cache'

async function getFeatures() {
  'use cache'
  cacheLife('days')
  return db.features.findAllEnabled()
}

export default async function Page() {
  return <FeatureList features={await getFeatures()} />
}
```

⚠️ The general test: **anything your shell depends on must also work at request time.** Build-only environment variables, files written by a build step and not shipped, and anything scoped to the build container all qualify. Since the bot path is triggered by user agent, you will not see this in normal QA — the fastest check is to request the page with a crawler user agent and confirm you get a complete document rather than an error.

There is a related behaviour on the metadata side worth knowing about, since it is the other place a bot is treated specially: streaming metadata is appended to `<body>` for bots that execute JavaScript, but **HTML-limited bots** that cannot — `facebookexternalhit` is the documented example — get blocking metadata in `<head>` instead, with the list overridable via `htmlLimitedBots`. That belongs to metadata and is covered in [ch12](../12-seo-metadata-and-accessibility/01-explanation.md).

## Prefetching pulls a second render forward

The App Shell is not only a fallback for unlisted URLs; under Partial Prefetching it is what a `<Link>` fetches:

> *"With Partial Prefetching enabled, the router prefetches each route's App Shell by default. The App Shell includes static content and session data derived from `cookies()` and `headers()`. To also prefetch cached content that depends on a link's **URL data**, such as `searchParams` or dynamic `params`, set `prefetch={true}` on that link."*

So there are two tiers, and the second one is not free:

> *"This per-link prefetch includes cached content that resolves after the destination URL is known. It costs a server invocation per prefetchable link."*

🔴 **Per link, not per route.** A page listing sixty tasks, each a `<Link prefetch>` to its detail route, is sixty server invocations as the list scrolls into view. That is a defensible spend on a three-item primary nav and an indefensible one on a feed. The default — App Shell only, shared across links to the same route — is the right choice almost everywhere, which is why `prefetch={true}` is opt-in.

⚠️ A prefetch also has a side effect people do not expect: *"A prefetch counts as that first visit."* For an unlisted param, the background upgrade starts when the link enters the viewport rather than when it is clicked. That is usually the point. It also means a page of links to unlisted URLs will trigger upgrades for all of them merely by being scrolled past.

## Gotchas

**★ Symptom: a layout is not prerendering and the insight names the layout, but you have not changed it.** Cause: the layout `await`s `params` at the top level, and a route below it has a param not covered by `generateStaticParams` — so the param is runtime data and the layout cannot prerender. Fix: make the layout non-async and pass the `params` promise into a `<Suspense>`-wrapped child that awaits it.

**★ Symptom: enumerated URLs are fast, un-enumerated ones are slow, and you conclude ISR is not working.** Cause: something above a boundary awaited a param, which ties the layout's shell to one specific URL and forfeits the reusable App Shell that every other URL depends on. Fix: keep the param read below the boundary *even for params you enumerated* — a statically known param still belongs to one URL.

**★ Symptom: the site is fine in every browser and Search Console reports rendering errors.** Cause: bots skip the shell and get a full request-time render, so anything your shell relied on that exists only at build time now runs — and fails — in the request-time environment. Fix: make the data reachable at request time. Verify by requesting the page with a crawler user agent and checking for a complete document rather than an error.

**★ Symptom: a build-time file read works locally, works in preview, and breaks only for crawlers in production.** Cause: the same thing, in its most common shape — the file is in the build container and not in the deployed bundle. Human traffic never re-executes the module because it is served the shell; the bot path does. Fix: ship the data (a database, an API, or a file genuinely included in the bundle) rather than relying on build-container state.

**★ Symptom: server invocations spike after adding `prefetch` to a list.** Cause: per-link prefetching costs a server invocation per prefetchable link, and a long list multiplies that by however many links enter the viewport. Fix: reserve `prefetch={true}` for a small number of high-intent links and let everything else use the default App Shell prefetch, which is shared across links to the same route.

```tsx
// ❌ Sixty links in the viewport, sixty server invocations.
{tasks.map((task) => (
  <Link key={task.id} href={`/tasks/${task.id}`} prefetch>
    {task.title}
  </Link>
))}
```

```tsx
// ✅ Default prefetch (App Shell, shared) for the list; prefetch={true} where
// the click is near-certain.
{tasks.map((task) => (
  <Link key={task.id} href={`/tasks/${task.id}`}>{task.title}</Link>
))}
<Link href="/checkout" prefetch>Checkout</Link>
```

**★ Symptom: background upgrades fire for URLs nobody clicked.** Cause: a prefetch counts as the first visit, so scrolling a list of links to un-enumerated URLs starts an upgrade for each. Fix: this is usually desirable — it is what makes the click instant. If the upgrade is expensive and the click rate is low, drop those links to a prefetch mode that does not resolve URL data.

**★ Symptom: you benchmark the instant-App-Shell behaviour on 16.1 and cannot reproduce the documented result.** Cause: serving the App Shell for unlisted params landed in **16.3**; earlier versions wait for a full server render before responding. Fix: check the version before concluding the feature does not work — this is a genuine behaviour difference within the 16 line.

## Interview questions

**★ Why can moving one `await` three components deeper change how much of a page is static?**
Because prerendering runs top-down and stops at the first thing that cannot complete at build time — everything below an unresolvable `await` is never evaluated for the shell. An `await params` at the top of a layout therefore costs not just the heading that needed the param but the sidebar, the children and every static sibling. Passing the promise down and awaiting it inside a `<Suspense>` boundary means only the component that genuinely needs the value leaves the shell. The documentation states the principle directly — the deeper the async work sits, the more of the page can be prerendered — and the mechanical change is usually just removing `async` from a layout signature.

**★ What is the difference between a static shell and an App Shell?**
A static shell is built for a known URL and contains that URL's concrete content, with only uncached or runtime data behind fallbacks. An App Shell is the deliberately URL-independent version: the same shell with the param-specific parts left behind their fallbacks, so it can be reused for any URL under the route. Which one a visitor gets depends on whether their URL was returned by `generateStaticParams` — listed URLs get the concrete prerender, unlisted ones get the App Shell instantly and then a background upgrade that produces the concrete version for the next visitor. The App Shell is also what a `<Link>` prefetches by default under Partial Prefetching, which is why keeping it URL-independent matters beyond the first visit.

**★ Why should you keep a param read below a Suspense boundary even for params you enumerated?**
Because awaiting a param above the boundary ties that layout's shell to one specific URL, and the App Shell is by definition the version that is not tied to any. A statically known param still belongs to one URL, so hoisting the read does not fail — it silently forfeits the reusable shell for every URL that was *not* enumerated. The symptom is the confusing one: the pages you listed are fast, the pages you did not are slow, and it looks like ISR is not working when in fact the layout can no longer produce a URL-independent shell for them.

**★ Why can a page work for every user and fail for Googlebot?**
Because bots are detected by user agent and deliberately do not receive the shell — they need a complete document, so Next.js skips the shell and renders the entire page dynamically at request time. That means work which completed during prerendering now executes in the request-time environment. If the shell depended on something only available at build time — a file written by a build step and not shipped, a build-only environment variable, anything scoped to the build container — that dependency is now missing and the render fails. Human traffic never exposes it, because humans are served the prerendered shell and the module is never re-executed. The documented rule is that the data your shell relies on must also be available at request time, and the practical check is to request the page with a crawler user agent.

**★ What does `prefetch={true}` cost, and when is the default better?**
The default under Partial Prefetching fetches the route's App Shell, and links pointing at the same route share one App Shell request. `prefetch={true}` additionally resolves the link's own URL data — `params` and `searchParams` — so cached content depending on them can be rendered before the click; the documentation is explicit that this costs a server invocation *per prefetchable link*. On a nav bar with three links that is trivially worth it. On a feed of sixty items it is sixty server invocations triggered by scrolling, for clicks that mostly will not happen. So the default is correct almost everywhere, and `prefetch={true}` is for the small set of links where the click is near-certain — a checkout button, the next step in a wizard.

**A prefetch "counts as the first visit". Why does that matter?**
Because for a URL whose params were not enumerated, the first visit is what triggers the background upgrade from App Shell to concrete prerender. Making a prefetch count as that visit means the upgrade starts when the link scrolls into view rather than when it is clicked, so the navigation lands on the upgraded result. That is the desirable case and it is why the behaviour exists. The consequence to be aware of is that merely scrolling past a list of links to unlisted URLs starts upgrades for all of them — real server work, done speculatively. On a page with many links to expensive, rarely-clicked routes, that is a cost worth measuring rather than assuming.

**Why does the framework argue against prerendering every route?**
Because prerendering is not free at either end: it increases build time and produces output that must be stored and deployed, and many of those routes may never be visited before the next deployment — so the work and the storage are spent on pages nobody reads. Since 16.3 the alternative is no longer a slow first visit: an unlisted URL is served the App Shell instantly and upgraded in the background, so the penalty for not enumerating a route is much smaller than it used to be. The documented recommendation is to enumerate the routes that benefit most from being ready — popular pages, predictable content — and let the long tail generate on demand.

---

← [03 · Partial Prerendering](03-partial-pre-rendering-ppr-static-shell-dynamic-holes-for-min.md) · [Chapter index](01-explanation.md) · Next → [03c · Validation, DevTools and CI](03c-instant-navigation-validation-devtools-and-proving-it-in-ci.md)
