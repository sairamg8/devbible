---
title: "An Instant Insight is a development-only error that never fails the build and only fires on routes you actually open, it comes from a catalogue of sixteen distinct messages, and each message offers only the subset of Stream / Cache / Block that can fix the thing it detected"
sidebar_label: "06b · The Insight catalogue"
sidebar_position: 160
description: "When validation runs and on what, the full list of Insight message slugs, the card matrix showing which fixes each Insight offers and why the missing ones are missing, getting the same diagnosis out of next build, and turning the volume down at two scopes."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Insight message pages [Uncached data during prerendering](https://nextjs.org/docs/messages/blocking-prerender-dynamic), [Runtime data during prerendering](https://nextjs.org/docs/messages/blocking-prerender-runtime), [URL data outside of Suspense](https://nextjs.org/docs/messages/instant-shell-url-data) and [Dynamic data during prefetching](https://nextjs.org/docs/messages/instant-link-prefetch-partial); plus [Ensuring instant navigations](https://nextjs.org/docs/app/guides/instant-navigation) (`lastUpdated: 2026-08-25`), [Adopting Partial Prefetching](https://nextjs.org/docs/app/guides/adopting-partial-prefetching) (`lastUpdated: 2026-08-25`), [`instant` route segment config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/instant) (`lastUpdated: 2026-08-03`) and [Migrating to Cache Components](https://nextjs.org/docs/app/guides/migrating-to-cache-components) (`lastUpdated: 2026-08-25`, via the banked chapter-5 research pass).
> Target: **Next.js 16.3.4** (docs build). Documentation-verified — **no sandbox run**. The `/docs/messages/` pages carry no `lastUpdated` field.

**The dev overlay's blocking-route card is the most useful diagnostic Next.js has shipped in years, and its two structural properties are both easy to miss: it never fails a build, and it only fires on routes a human actually opened in a browser. That makes it a *loop*, not a *gate* — nothing sweeps your app for you, and nothing stops a regression reaching production. This page is the map: what triggers validation, the sixteen message slugs it can produce, which fix cards each one offers and why the absent ones are absent, and how to get the same diagnosis out of `next build` when you are reading CI output instead of an overlay. The fixes themselves are [06c · Stream and Cache](06c-stream-cache-and-block-in-detail.md) and [06d · Block](06d-block-and-opting-out-honestly.md).**

## What an Insight is, and when it fires

An Instant Insight is a **development-time** diagnosis produced by Cache Components validation. It is not a build error and it is not a runtime error.

> *"By default (`validationLevel: 'warning'`), Cache Components apps validate every Page and Default segment in development."*

> *"`'warning'` *(framework default)*: Every Page and Default segment is implicitly validated at warning level (dev only)."*

> *"Both insights are development-only and never block the build."*

Validation is driven by real traffic through your own browser, not by a static sweep:

> *"Validation runs on every page load using the real request from your browser, so dynamic params like `[slug]` are checked against actual values as you navigate."*

> *"`instant` triggers validation at every shared layout boundary in the route. Validation runs during development (on page loads and HMR updates) and surfaces errors in the dev error overlay."*

And it simulates both entry paths independently, which is the whole reason the tooling exists:

> *"For each validated route, Next.js checks both the initial page load and client navigations at different points in the route hierarchy."*
> *"Each case is validated independently. A `<Suspense>` boundary that covers one navigation path might not cover another. This is why a page can pass the page load check but fail for client navigations, and why catching these issues by hand is difficult as the number of routes grows."*

🔴 **Consequence: a route you never open in `next dev` is never validated.** There is no sweep. If a route is only reachable behind a feature flag or an admin login, its Insights simply never fire. The adoption guide says this outright for one of the checks — *"Load every route in `next dev` to check for it."*

The blog frames the severity choice deliberately:

> *"With Instant Insights, we've made slow navigations an error in development."*
> *"We're also exploring ways to surface the errors you see in development during the build process, so any regressions in your instant routes would be caught at build time."*

That second sentence is the one to remember in a design discussion: build-time enforcement is **stated as exploratory, not shipped.** Do not plan a CI gate around it.

## The catalogue

The `blocking-prerender-dynamic` page publishes a Related Insights list. These are the messages in the family; the URL for each is `https://nextjs.org/docs/messages/<slug>`:

| Slug | What the docs' link text says it detects |
|---|---|
| `blocking-prerender-dynamic` | uncached `fetch()`, a db call, or `await connection()` outside `<Suspense>` |
| `blocking-prerender-runtime` | `cookies()`, `headers()`, `params` or `searchParams` outside `<Suspense>` |
| `blocking-prerender-client-hook` | URL data in a Client Component outside `<Suspense>` |
| `blocking-prerender-metadata-runtime` | runtime data in `generateMetadata()` |
| `blocking-prerender-metadata-dynamic` | uncached data in `generateMetadata()` |
| `blocking-prerender-viewport-runtime` | runtime data in `generateViewport()` |
| `blocking-prerender-viewport-dynamic` | uncached data in `generateViewport()` |
| `blocking-prerender-random` | `Math.random()` while prerendering |
| `blocking-prerender-random-client` | `Math.random()` in a Client Component |
| `blocking-prerender-current-time` | `Date.now()` while prerendering |
| `blocking-prerender-current-time-client` | `Date.now()` in a Client Component |
| `blocking-prerender-crypto` | crypto APIs while prerendering |
| `blocking-prerender-crypto-client` | crypto APIs in a Client Component |
| `instant-link-prefetch-partial` | a `<Link prefetch={true}>` into a route that has not adopted Partial Prefetching |
| `instant-shell-url-data` | `params` / `searchParams` outside `<Suspense>`, tying the App Shell to one URL |
| `instant-unrendered-segment` | an unrendered segment |

⚠️ **I read four of these pages verbatim** — the four named on the `> Verified:` line. The one-line descriptions above are the docs' own link text from the Related Insights list, not summaries of behaviour I confirmed. `instant-unrendered-segment` in particular is a slug and a title and nothing more in what I checked; **I could not confirm what it detects or which cards it offers.**

Every one of these pages opens with the same banner:

> *"This Insight is part of the Instant Navigations feature introduced in Next.js 16.3."*

The pairing pattern is worth internalising because it tells you where to look before you read a word of the message: **almost every prerender Insight has a Server-Component form and a Client-Component form** (`-random` / `-random-client`, `-current-time` / `-current-time-client`, `-crypto` / `-crypto-client`), and **metadata and viewport get their own slugs** rather than reusing the page ones. A `params` read has three possible slugs depending on where you did it: `instant-shell-url-data` in a Server Component, `blocking-prerender-client-hook` through `useSearchParams`, and `blocking-prerender-metadata-runtime` inside `generateMetadata`.

### Which cards each Insight offers, and why

The fix cards are not uniform. Each message renders only the remediations that can actually work for what it found. In the documentation source each card carries a `group` attribute, and those group names are where "Stream / Cache / Block" comes from:

| Insight | Stream | Cache | Block | Why the missing card is missing |
|---|:---:|:---:|:---:|---|
| `blocking-prerender-dynamic` | ✅ | ✅ | ✅ | data can be cached or streamed |
| `blocking-prerender-runtime` | ✅ | — | ✅ | a per-request value cannot be cached into a shell |
| `instant-shell-url-data` | ✅ | — | ✅ | URL data varies per link, so it cannot join a shared App Shell |
| `instant-link-prefetch-partial` | — | — | — | offers a different triple entirely |

That last row is the one that breaks the pattern. The prefetch Insight's cards carry the groups `upgrade`, `disable` and `ignore`, and their titles are *"Opt into Partial Prefetching"* (`export const prefetch = 'partial'`), *"Use the default prefetch"* (drop `prefetch={true}` from the link), and *"Disable validation on this route"* (`export const instant = false`). **"Stream, Cache, Block" is the taxonomy of the *prerender* Insights specifically**, not of Instant Insights in general.

That Insight also has a deliberate timing quirk worth knowing:

> *"The check fires at navigation time, not prefetch time, so existing apps that have recently enabled Cache Components are not flooded with warnings for every `<Link prefetch={true}>` on the page."*

And a genuinely useful framing of what adopting Partial Prefetching buys the destination:

> *"Routes that opt into Partial Prefetching skip the dynamic data at prefetch time, leaving you free to choose when it loads: at navigation via streaming, ahead of time via per-link prefetching, or not at all."*

## Diagnosing from a build instead of the overlay

The overlay only exists in `next dev`. When you are reading CI output or a failing production build, the docs name two flags:

> *"In `next dev`, the error overlay points at the failing component with file paths and line numbers. When working from a build instead, the default `next build` output is more abbreviated. Run `next build --debug-prerender` for full user-frame stack traces and `next build --debug-build-paths /dashboard /settings` to iterate on specific routes."*

```bash
# full user-frame stack traces for prerender failures
next build --debug-prerender

# rebuild only the routes you are working on
next build --debug-build-paths /dashboard /settings
```

`--debug-build-paths` is the one that changes the shape of the work: a Cache Components adoption is a long sequence of small fixes, and rebuilding two routes instead of the whole app is the difference between a tight loop and a coffee break.

## Turning the volume down, at two scopes

> *"**One segment**: add `export const instant = false` to the page or layout file. This opts out the segment itself. Child segments are still validated during client navigations."*
> *"**Entire app**: set `experimental.instantInsights.validationLevel` to `'manual-warning'` in `next.config`. This limits validation to segments that explicitly export `instant`."*

```ts
// next.config.ts — validate only the segments that ask to be validated
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

The two levels, verbatim, are the whole enum:

> *"`'warning'` *(framework default)*: Every Page and Default segment is implicitly validated at warning level (dev only)."*
> *"`'manual-warning'`: Only segments with an explicit `instant` are validated, at warning level (dev only)."*

🔴 **`'manual-warning'` inverts the default from opt-out to opt-in**, which is the right setting for a large legacy app mid-migration and the wrong setting for a greenfield one — under it, a new route added by someone who has never heard of this feature is silently exempt.

## Gotchas

**★ Symptom: the failing route is `/_not-found` and you do not have a `not-found.tsx`.** Cause: the read is in the root layout, and `/_not-found` is a real synthetic route that inherits it. Verbatim: *"`/_not-found` is a real prerendered route that inherits the root layout, so an uncached read there fails on the synthetic route too. Run `next build --debug-prerender` to confirm the originating file, and fix it at the layout, not by adding a `not-found.tsx`."* Fix: run the debug build to find the real file, then fix the layout — adding a `not-found.tsx` moves the symptom without touching the cause.

```bash
next build --debug-prerender
```

**★ Symptom: nobody on the team ever sees the Insight for the admin route.** Cause: validation runs on real requests through a real browser, and nobody opens that route in `next dev`. Fix: there is no scan to run. Either open every route by hand, or codify the ones that matter as `instant()` Playwright tests so CI opens them for you, against a production-like build.

```ts
// next.config.ts — so `next start` exposes the same testing API as `next dev`
const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: { exposeTestingApiInProductionBuild: true },
}
```

**★ Symptom: a smoke test, a `curl`, or a synthetic monitor shows the route is perfectly healthy while it is failing validation.** Cause: an Insight is not part of the response. The [Migrating to Cache Components](https://nextjs.org/docs/app/guides/migrating-to-cache-components) guide states it directly: *"Insights don't show up in the HTTP response. An offending route still returns `200` with rendered HTML in dev. The insight only appears in the dev overlay, the dev-server log, or the MCP `get_errors` tool."* Fix: there are exactly three places to look, and a status-code check is not one of them — read the dev-server log if you are scripting, and the overlay if you are not.

**Symptom: `params` read inside `generateMetadata()` produces a different Insight than the same read in the page body.** Cause: metadata has its own message slug. Verbatim: *"A `params` or `searchParams` read inside `generateMetadata` surfaces as URL data in `generateMetadata()` instead."* Fix: search `blocking-prerender-metadata-runtime`, not `instant-shell-url-data`. Searching the wrong slug is how an hour disappears.

**Symptom: `/_global-error` and `/_not-found` never produce Insights even though everything else does.** Cause: they are excluded from the implicit sweep. Verbatim: *"Framework-synthesized error routes (`/_global-error`, `/_not-found`) are excluded from implicit validation. To validate them, opt in explicitly with `instant`."* Fix: opt them in if you care.

```tsx
// app/not-found.tsx
export const instant = true
```

**Symptom: you set `validationLevel: 'manual-warning'` during a migration and six months later nothing is ever flagged.** Cause: the setting is opt-in and nobody adds `instant` to new routes. Fix: it is a migration setting, not a steady state. Once the backlog is cleared, remove it and let the framework default (`'warning'`) validate every Page and Default segment again — or, if you must keep it, make `export const instant = true` part of the page template.

**Symptom: a build-time gate you planned around Instant Insights does not exist.** Cause: the only shipped level is `'warning'`, described as *"Validates in development only. Errors appear in the dev overlay; the build is unaffected."* Verbatim from the reference: *"In the future a validation level that supports validation during build will be supported."* Fix: gate on `instant()` Playwright tests today, which do run in CI, and revisit when a build-capable level ships.

## Interview questions

**★ Why does the `blocking-prerender-runtime` Insight not offer a Cache card?**
Because it fires on `cookies()`, `headers()`, `params` or `searchParams`, and those are per-request or per-URL by definition. Caching them would either serve one user's session to another or tie a shared artifact to one URL — the App Shell is explicitly *"a per-route prerender containing the parts of a page that don't depend on URL data."* The available fixes are therefore Stream, meaning put a boundary around the part that needs the value so the rest ships, or Block. The intermediate move the docs do recommend is to read the runtime value *outside* a cached function and pass it in as an argument, so the expensive lookup behind it can still be cached per session.

**★ An Insight is development-only and never fails the build. Why is that a problem, and what do you do about it?**
Because a diagnosis nobody is forced to look at is a diagnosis that regresses. Validation runs on real page loads through your own browser, so a route nobody opens in `next dev` is never checked at all, and a refactor that pushes a `fetch()` back above a boundary ships silently. The documented answer is to encode the routes that must be instant as `instant()` Playwright tests, which do run in CI, and to run them against a production-like build by setting `experimental.exposeTestingApiInProductionBuild` so `next start` exposes the same testing API. Vercel acknowledges the gap — *"We're also exploring ways to surface the errors you see in development during the build process"* — but exploration is not a release, so do not plan around it.

**★ You get an Insight about `params`. How many different messages could that be, and how do you tell them apart?**
Three, and the difference is *where* the read happened rather than what it read. A Server Component reading `params` or `searchParams` outside a boundary gives `instant-shell-url-data`, whose point is that the shared App Shell got tied to one URL. The same information read through a client hook like `useSearchParams` gives `blocking-prerender-client-hook`. And a read inside `generateMetadata()` gives `blocking-prerender-metadata-runtime`, with a matching `-viewport-` pair for `generateViewport()`. They have different fixes because they have different scopes — the metadata one cannot be fixed by moving a `<Suspense>` boundary in the page body at all.

**When would you set `validationLevel: 'manual-warning'`, and when is that the wrong call?**
It is right when you are adopting Cache Components in a large existing app and the default is producing more red boxes than the team can triage — it flips validation from opt-out to opt-in so you can annotate routes as you fix them and see only what you have committed to. It is wrong as a permanent setting and wrong in a greenfield app, because under it a route added by someone who has never heard of the feature is silently exempt from every check. The reference's own advice cuts both ways: pin the level explicitly if you depend on it, because the framework default *"may change in future versions to opt users into higher levels of validation"* and that change *"is not considered a breaking change."*

**Validation passes on every route. Are the loading states good?**
No — those are separate properties and the docs say so directly: *"Validation passing means the navigation is instant. It does not mean the loading states are good. A `<Suspense>` boundary placed high in the tree (say, wrapping the whole page) might satisfy validation, but it replaces most of the page with a single fallback on every navigation."* The stated goal is the opposite of the one that satisfies the checker: keep as much real cached content visible as possible and show fallbacks only where data is genuinely in flight. The check confirms a shell exists; only the Navigation Inspector, or an `instant()` test asserting on specific content, confirms the shell is worth looking at.

**Why does the prefetch Insight check at navigation time rather than at prefetch time?**
Because checking at prefetch time would fire once per visible `<Link prefetch={true}>` the moment a page rendered, which on a link-dense page is a wall of identical warnings before the developer has done anything. The docs give exactly that reason: *"The check fires at navigation time, not prefetch time, so existing apps that have recently enabled Cache Components are not flooded with warnings for every `<Link prefetch={true}>` on the page."* The practical consequence is that you find these by clicking through the app, not by loading it — which is another instance of the same structural property, that Insights follow real traffic.

---

← [06 · Instant Navigations: status and vocabulary](06-163-preview-instant-navigations-stream-cache-block-and-parti.md) · [Chapter 2 overview](01-explanation.md) · Next → [06c · Stream, Cache and Block in detail](06c-stream-cache-and-block-in-detail.md)
