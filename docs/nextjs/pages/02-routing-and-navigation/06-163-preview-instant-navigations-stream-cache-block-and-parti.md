---
title: "Instant Navigations was a 16.3 preview that has since shipped stable, Stream / Cache / Block are the three fix cards in the dev overlay rather than settings you write, and Partial Prefetching is a different thing from Partial Prerendering despite the near-identical name"
sidebar_label: "06 · Instant Navigations: status and vocabulary"
sidebar_position: 34
description: "What shipped in 16.3 and what is still under experimental, why the Stream/Cache/Block trio is a remediation taxonomy and not a config enum, the Partial Prefetching versus Partial Prerendering distinction, and where the deep dives live."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [Next.js 16.3: Instant Navigations](https://nextjs.org/blog/next-16-3-instant-navigations) (posted Thursday 25 June 2026), [Ensuring instant navigations](https://nextjs.org/docs/app/guides/instant-navigation) (`lastUpdated: 2026-08-25`), [`instant` route segment config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/instant) (`lastUpdated: 2026-08-03`), [`prefetch` route segment config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/prefetch) (`lastUpdated: 2026-08-25`), [`partialPrefetching`](https://nextjs.org/docs/app/api-reference/config/next-config-js/partialPrefetching) (`lastUpdated: 2026-08-25`) and the [Next.js Glossary](https://nextjs.org/docs/app/glossary) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** (docs build). Documentation-verified — **no sandbox run**.

**Three things in this page's own title were wrong when the syllabus wrote them, and one of them is still wrong in most write-ups. "16.3 Preview" was accurate in June 2026 and is stale now — the blog post that introduced Instant Navigations carries a banner saying the preview shipped as stable. "Stream / Cache / Block" is not a config enum, an option triple, or a value you assign to anything: it is the set of three *fix cards* the development error overlay renders under a blocking-route insight, and their names come from the `group` attribute on those cards. And "Partial Prefetching" and "Partial Prerendering" are two different features with two different glossary entries that differ by four letters in the middle of a word. This page fixes the vocabulary and pins the status; the machinery itself is taught in [10 · Instant Navigations](10-instant-navigations/README.md).**

## The status, resolved

The feature was announced in a blog post dated **Thursday, June 25th 2026**, titled *Next.js 16.3: Instant Navigations*. At the time it was distributed on the `preview` dist-tag:

> *"To try out Instant Navigations for yourself, install the 16.3 Preview today"* — `npm install next@preview`

> *"We'd love to hear any feedback you have on GitHub, and we'll continue to publish updates to the preview tag as we work towards a polished stable release."*

That post now opens with a banner that settles the question:

> *"This post covers the preview, which has since shipped as stable. Install it with `npm install next@latest` and see the release post for everything that's new."*

So **the `[16.3 Preview]` label on this chapter's syllabus entry is out of date.** The right framing for a reader on 16.3.4 is: *opt-in and stable, with the tuning knobs still under `experimental`.* Those are two different claims and the docs keep them separate.

### What is stable, what is under `experimental`, and what the docs will not say

| Surface | Where it lives | Version-history row in the docs |
|---|---|---|
| `cacheComponents` | top-level `next.config` | blog: *"it will become a default in a future major version of Next.js"* |
| `partialPrefetching` | top-level `next.config` | **`16.3.0` — *"`partialPrefetching` introduced. Requires `cacheComponents` to be enabled."*** |
| `export const instant` | route segment config | `v16.x.x` — *"`instant` export introduced (Cache Components only)"* |
| `export const prefetch` | route segment config | `v16.x.x` — *"`prefetch` export introduced (Cache Components only)"* |
| `experimental.instantInsights.validationLevel` | `next.config`, under `experimental` | not versioned |
| `experimental.exposeTestingApiInProductionBuild` | `next.config`, under `experimental` | not versioned |
| Navigation Inspector | Next.js DevTools, gated on `cacheComponents` | not versioned |
| `instant()` from `@next/playwright` | separate npm package | not versioned in the Next.js docs |

🔴 **The literal string `v16.x.x` is what the `instant` and `prefetch` reference pages print in their Version History tables.** That is not a redaction on my part — it is an unresolved placeholder in the published documentation, and it means **I cannot tell you which patch release introduced either export.** Do not assert one.

The `instant` reference is also explicit that the segment config is still moving:

> *"The framework default may change in future versions to opt users into higher levels of validation. Because this feature is experimental, that change is not considered a breaking change. To pin a specific behavior, set `validationLevel` explicitly."*

That sentence is the practical instruction hiding in the status question: **if you depend on a particular validation volume in CI or in a shared repo, write `validationLevel` down explicitly rather than inheriting the default.**

### "Instant Navigations" is a brand, not an API

The [Next.js Glossary](https://nextjs.org/docs/app/glossary) has entries for *App Shell*, *Partial Prefetching*, *Partial Prerendering (PPR)*, *Prefetching*, *Prerendering*, *Static Shell*, *Streaming*, *Suspense boundary*, *URL data*, *Cache Components*, *Client Cache*, *Proxy* and *Middleware*. It has **no entry for "Instant Navigation" or "Instant Navigations."** The blog is where the umbrella name is defined:

> *"one new feature we're calling Instant Navigations — a suite of tools that bring the responsiveness of client-driven SPAs to Next.js, without sacrificing the benefits that come with its server-driven model."*

A *suite of tools*. There is no `instantNavigations` flag to switch on. What you actually turn on is two config keys, and what you actually get is five separately-documented things: the App Shell, Instant Insights validation, the Navigation Inspector, per-link prefetching, and the `instant()` Playwright helper. When an interviewer asks you to "enable Instant Navigations," the correct answer is two lines of config plus a migration.

```ts
// next.config.ts — the entire "enable Instant Navigations" surface
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
}

export default nextConfig
```

`partialPrefetching` is hard-gated on the other one:

> *"`partialPrefetching` requires `cacheComponents`. Without it, `next dev` and `next build` throw at config validation."*

## Stream, Cache, Block — a remediation taxonomy, not an option set

This is the correction most likely to cost you in an interview or a code review, because the three words look exactly like an enum.

The blog's section is titled *"Stream, Cache, or Block"* and describes a **choice you make when a route blocks**, expressed as buttons in the development error overlay:

> *"Now, when a route awaits some data on the server, you will be presented with a choice between a few options"*

> *"To make a navigation instant, you 'turn' an asynchronous operation into something that can be available instantly:"*
> *"**Stream** with `<Suspense>`. The user will instantly see a loading state (with more UI streaming in after)."*
> *"**Cache** with `'use cache'`. The user will instantly see a previously cached UI (reused between requests)."*
> *"In both cases above, the navigation will feel SPA-like and instant to the user."*

> *"However, sometimes you might want to make a certain navigation server-bound. For example, a blog might choose to never show a loading shell for posts. For those cases, you can tell Next.js that you want this navigation to **Block**"*

> *"Notice how this puts you in control. If you want your server-driven app to react to link clicks instantly—without waiting for the network—then you Stream or Cache. If you want some routes to delay navigations, then you Block."*

The names are load-bearing in the documentation source, not just in the prose: each Insight page under `/docs/messages/` renders its remediations as fix cards carrying a `group` attribute, and the observed groups are `stream`, `cache`, `block` on the prerender insights, and `upgrade`, `disable`, `ignore` on the prefetch insight. The guide's own image alt-text names the trio directly:

> *"Dev overlay insight for a blocking-route, showing the uncached data access on `app/products/[slug]/page.tsx` with Stream, Cache, and Block fix cards"*

So the mapping from card to code is:

| Fix card | What you actually write | Effect |
|---|---|---|
| **Stream** | a `<Suspense>` boundary around the blocking child | shell ships now, region streams in |
| **Cache** | `'use cache'` on the data-access function | value joins the shell, reused between requests |
| **Block** | `export const instant = false` on the page or layout | segment is exempt from validation; navigation waits |

🔴 **There is no `stream`, `cache` or `block` value you can assign to any export.** The only route segment enums in this area are `instant` (`true | false | { level?: 'warning' }`) and `prefetch` (`'auto' | 'partial' | 'force-disabled'`). If you write `export const instant = 'stream'`, you have invented an API.

Which card is offered depends on which insight fired, and the cards are not always three. The *runtime data during prerendering* insight — `cookies()`, `headers()`, `params`, `searchParams` read outside `<Suspense>` — offers only **Stream** and **Block**, because caching a per-request value is not a fix. That per-insight variation is the subject of [06b](06b-instant-insights-and-the-fix-cards.md); the fixes themselves are [06c](06c-stream-cache-and-block-in-detail.md) and [06d](06d-block-and-opting-out-honestly.md).

## Partial Prefetching is not Partial Prerendering

Two glossary entries, four letters apart, both abbreviated in conversation, and they operate at different times on different artifacts.

> **Partial Prerendering (PPR)** — *"A rendering optimization that combines prerendering and dynamic rendering in a single route. The static shell is served immediately while dynamic content streams in when ready, providing the best of both rendering strategies."*

> **Partial Prefetching** — *"A prefetching strategy for Cache Components routes where a `<Link>` prefetches a per-route App Shell by default instead of the full page. Enable it with `partialPrefetching: true` in `next.config.ts`."*

| | Partial **Prerendering** | Partial **Prefetching** |
|---|---|---|
| Category | a render strategy | a network strategy |
| When it runs | at build / prerender time | when a `<Link>` enters the viewport |
| Artifact | the **static shell** (HTML) | the **App Shell** (per-route prefetch payload) |
| Consumed by | a direct visit / hard navigation | a client navigation / soft navigation |
| Enabled by | `cacheComponents` | `partialPrefetching` |
| Boundary that shapes it | `<Suspense>` in the full tree | `<Suspense>` below the shared layout |

They also produce **two different shells with two different names**, and mixing those up is the single most common error in this area. The static shell is what a CDN serves to a cold browser. The App Shell is what a `<Link>` downloads ahead of a click:

> **App Shell** — *"A per-route prerender containing the parts of a page that don't depend on URL data. Cached content is included when its `stale` time is at least 5 minutes, since the shell is reused for longer than shorter-lived content stays fresh."*

> **Static Shell** — *"The prerendered HTML structure of a page that's served immediately to the browser. With Partial Prerendering, the static shell includes all statically renderable content plus Suspense boundary fallbacks for dynamic content that streams in later."*

The consequence is stated flatly in the guide and it is why a route can pass one check and fail the other:

> *"**Direct visits** get the static shell as HTML, typically from a CDN. **Client navigations** only re-render below the layout the current and destination routes share, so the fallback UI defined by a `<Suspense>` boundary above that point can't be used during the transition."*

> *"A `<Suspense>` boundary in the root layout covers everything on a page load, but on this navigation, it sits above the re-render scope and does not trigger."*

## Why the shell-per-route change happened at all

The motivation is worth carrying because it explains the shape of everything downstream. Before 16.3, every visible link produced its own prefetch:

> *"Previously, Next.js solved this by sending a prefetch request to the server for every link in the viewport."*
> *"In 16.2, Next.js makes a prefetch request for every link, even if those links point to the same route"*
> *"Many of you told us that this looked ridiculous, and frankly, we agree."*

> *"So we've decided to borrow this trick from single-page apps. Instead of prefetching a page per link, Next.js will now prefetch a reusable shell per route. Those shells will then be cached on the client so they're only fetched once."*

> *"For example, if you had a sidebar with twenty chat links, Next.js used to send a separate prefetch request per link. However, with the new behavior, it will only prefetch once per route: a shell for the `/chat/[id]` route, a shell for the `/dashboard` route, and so on."*

That is the trade you accept when you flip the flag: **N link-shaped prefetches collapse to one route-shaped prefetch, and everything that varied per link stops being prefetched.** Which is exactly why every existing `<Link prefetch={true}>` in your codebase now delivers less than it did — the audit that follows from that is [10 · 02](10-instant-navigations/02-partial-prefetching-and-the-app-shell.md).

## Where the rest of it is taught

| Question | Page |
|---|---|
| What "instant" means, and the two shells | [10 · 01 What "instant" means](10-instant-navigations/01-what-instant-means.md) |
| App Shell mechanics and auditing legacy `prefetch={true}` | [10 · 02 Partial Prefetching and the App Shell](10-instant-navigations/02-partial-prefetching-and-the-app-shell.md) |
| Per-link prefetching, cost model, `prefetch = 'partial'` adoption | [10 · 03 Per-link prefetching and adoption](10-instant-navigations/03-per-link-prefetching-and-incremental-adoption.md) |
| The `instant` export and `validationLevel` in full | [10 · 04 Instant Insights and validation](10-instant-navigations/04-instant-insights-and-validation.md) |
| Navigation Inspector, `instant()` tests, the fix loop | [10 · 05 Navigation Inspector and the fix loop](10-instant-navigations/05-the-navigation-inspector-and-the-fix-loop.md) |
| ISR under Cache Components | [10 · 06 Better ISR](10-instant-navigations/06-better-isr-with-cache-components.md) |
| Every Insight message and which cards it offers | [06b · The Insight catalogue](06b-instant-insights-and-the-fix-cards.md) |
| The Stream and Cache fixes in full, with their trade-offs | [06c · Stream and Cache in detail](06c-stream-cache-and-block-in-detail.md) |
| `instant = false`, its precedence rules and its limits | [06d · Block, and opting out honestly](06d-block-and-opting-out-honestly.md) |
| Prefetch inlining and `<Link>` prefetch control | [13 · Prefetch inlining](13-prefetch-inlining.md), [13b · Prefetch control and link status](13b-prefetch-control-and-link-status.md) |

## Gotchas

**★ Symptom: you write `export const instant = 'stream'` and TypeScript rejects it.** Cause: you read "Stream / Cache / Block" as an enum. Fix: the type is published in the reference and has three shapes, none of them a string.

```ts
type InstantConfig =
  | true
  | false
  | {
      level?: 'warning'
    }

export const instant: InstantConfig = true
```

**★ Symptom: a colleague says "we already have PPR, so Partial Prefetching is on."** Cause: the names collide. Fix: they are separate config keys with separate effects, and only one of them can be checked by reading `next.config.ts`. `cacheComponents: true` gives you Partial **Prerendering**; the second line is what gives you Partial **Prefetching**.

```ts
const nextConfig: NextConfig = {
  cacheComponents: true,     // Partial PRERENDERING — static shell + streaming
  partialPrefetching: true,  // Partial PREFETCHING  — one App Shell per route
}
```

**Symptom: `next dev` throws at config validation the moment you add `partialPrefetching`.** Cause: you enabled it without `cacheComponents`. Fix: the docs state the dependency outright — *"Without it, `next dev` and `next build` throw at config validation."* Add both keys, not one.

**Symptom: you enable both flags and navigations still feel exactly the same locally.** Cause: prefetching does not happen in development at all. The `instant` reference is explicit: *"Next.js does not perform prefetches in development, so navigations may not feel as instant as they will in production. Validation reflects what will happen during `next start`, where prefetching is enabled."* The blog repeats it: *"Like before, actual prefetching is only enabled in production."* Fix: judge the result from the Navigation Inspector or a `next start` build, never from the feel of `next dev`.

**Symptom: `export const instant = true` throws in a component that has `'use client'` at the top.** Cause: the export is server-side segment config. Fix, verbatim from the reference: *"`instant` cannot be used in Client Components. It will throw an error."* The same restriction applies to `prefetch` — *"`prefetch` cannot be used when the segment is a Client Component."* Move the export to the server `layout.tsx` above it, or drop it.

**Symptom: `export const prefetch = 'auto'` appears in review and nobody can say what it does.** Cause: it is the default, spelled out. Fix, verbatim: *"The meaningful values to set are `'partial'` and `'force-disabled'`. `'auto'` is the default and is equivalent to omitting the export; don't write `prefetch = 'auto'` explicitly."* Delete the line.

**Symptom: Instant Insights behave oddly in Safari during development.** Cause: a known preview-era limitation. The blog's Known Issues section says there are issues with the Instant Insights tooling in Safari and recommends Chrome or Firefox in development. ⚠️ That list was written against the preview and the post has since been marked stable; **I could not confirm from the current documentation whether the Safari issue is resolved.** Treat it as a possibility to rule out, not a current fact.

**Symptom: two projects on `localhost` interfere with each other's Navigation Inspector.** Cause: the DevTools use a cookie and cookies ignore the port. Verbatim: *"The DevTools use a `next-instant-navigation-testing` cookie to hold back dynamic content and freeze the page at the instant UI. Because cookies are scoped to the domain and not the port, running multiple projects on the same domain (typically `localhost`) means the cookie is shared across them."* Fix: clear the cookie, or close the Navigation Inspector panel when switching projects. The docs add *"This will be fixed as part of stabilizing the feature."*

**Symptom: `/_global-error` and `/_not-found` never produce validation insights.** Cause: they are excluded from the implicit sweep. Verbatim: *"Framework-synthesized error routes (`/_global-error`, `/_not-found`) are excluded from implicit validation. To validate them, opt in explicitly with `instant`."* Fix: add `export const instant = true` to those segments if you care about them.

## Interview questions

**★ Someone says "we're on the 16.3 preview of Instant Navigations." What do you check first, and what would you tell them?**
That the preview is over. The announcement post carries a banner reading *"This post covers the preview, which has since shipped as stable. Install it with `npm install next@latest`"* — so the `preview` dist-tag is no longer where this lives. The follow-up question is which *parts* they mean, because the umbrella name covers surfaces at three different stability levels: `partialPrefetching` is a top-level config key with a real `16.3.0` version-history row; `instant` and `prefetch` are route segment configs whose published version-history rows still read the literal placeholder `v16.x.x`; and `instantInsights.validationLevel` and `exposeTestingApiInProductionBuild` are both under `experimental` and can move without a breaking-change notice, which the `instant` reference says in as many words.

**★ Are "Stream", "Cache" and "Block" options you configure?**
No. They are the three fix cards the development error overlay renders under a blocking-route Insight, and their names are the `group` values on those cards in the docs source. Stream means adding a `<Suspense>` boundary; Cache means adding `'use cache'` to the data-access function; Block means `export const instant = false`. Each card links to a walkthrough. The only enums in this area are `instant`, whose type is `true | false | { level?: 'warning' }`, and `prefetch`, whose type is `'auto' | 'partial' | 'force-disabled'`. Nothing accepts the string `'stream'`.

**★ Distinguish Partial Prerendering from Partial Prefetching.**
Prerendering is about what the server produces; prefetching is about what the client downloads before a click. Partial Prerendering is the render strategy `cacheComponents` turns on: it produces a *static shell* of HTML that ships immediately with `<Suspense>` fallbacks where dynamic content will stream in. Partial Prefetching is the network strategy `partialPrefetching` turns on: instead of one prefetch per visible link, the browser fetches one reusable *App Shell* per route and caches it on the client. They interact — the App Shell is a per-route prerender that only contains the parts not depending on URL data — but they are separate flags and only one of them changes what `<Link>` does.

**Why do the docs distinguish the "static shell" from the "App Shell" at all? Isn't a shell a shell?**
Because they are consumed by different navigations and shaped by different boundaries. A direct visit renders from the document root, so every `<Suspense>` in the full tree is available to catch a suspension — including one in the root layout. A client navigation only re-renders below the layout the source and destination share, so a boundary above that point is not in scope and cannot cover the transition. The same component can therefore be instant on one path and behind a fallback on the other. The guide's `useSearchParams()` example makes this concrete: it suspends during server rendering because search params are unknown at build time, but on a client navigation the router already holds them from the URL and the hook resolves synchronously.

**Why did Vercel move from per-link prefetching to per-route shells?**
Because per-link prefetching scaled with the number of links, not the number of routes. A sidebar of twenty chat links produced twenty prefetch requests for one route. The blog is unusually candid about it — *"Many of you told us that this looked ridiculous, and frankly, we agree."* The fix borrows per-route code splitting from single-page apps: one shell per distinct route in the viewport, cached on the client for the session. The cost of that trade is that anything varying per link — `params`, `searchParams`, the full URL — can no longer be in the shared artifact, which is precisely why per-link prefetching still exists as an opt-in on `<Link prefetch={true}>`.

**If Instant Navigations is opt-in and stable, why is the validation still under `experimental`?**
Because the *behaviour* and the *feedback about the behaviour* stabilise on different schedules. `cacheComponents` and `partialPrefetching` change what the framework does at runtime and are versioned normally. `experimental.instantInsights.validationLevel` only changes how loudly the dev server complains, and the reference reserves the right to raise the default without calling it breaking: *"The framework default may change in future versions to opt users into higher levels of validation. Because this feature is experimental, that change is not considered a breaking change."* The reference's own advice follows from that — pin `validationLevel` explicitly if you need the volume to stay put.

**The `instant` reference says a future validation level will support validation during build. What does that change for you?**
Today the only level is `'warning'`, described as *"Validates in development only. Errors appear in the dev overlay; the build is unaffected."* Every Instant Insight is therefore invisible in CI unless you write an explicit `instant()` Playwright test. When a build-time level arrives, a regression in an instant route becomes a build failure rather than something a developer has to notice locally — which means the sensible preparation now is to keep the route set that must be instant small and explicitly annotated, so that the day the default changes you know exactly which routes are in scope.

---

← [05 · Prefetching fundamentals and View Transitions](05-prefetching-fundamentals-and-the-native-view-transitions-api.md) · [Chapter 2 overview](01-explanation.md) · Next → [06b · Instant Insights and the fix cards](06b-instant-insights-and-the-fix-cards.md)
