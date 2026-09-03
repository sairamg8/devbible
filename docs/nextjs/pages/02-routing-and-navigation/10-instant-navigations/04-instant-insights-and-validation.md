---
sidebar_position: 4
title: "Instant Insights validates every Page and Default segment in development by default, and the instant route segment config is how you tell it which segments are allowed to block"
sidebar_label: "4 · Instant Insights and validation"
description: "How Cache Components validation simulates page loads and client navigations, the experimental.instantInsights.validationLevel setting, the instant export's three forms, and the precedence rule that governs static-shell validation."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against [`instant` route segment config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/instant), [Ensuring instant navigations](https://nextjs.org/docs/app/guides/instant-navigation) and the [Next.js 16.3 release blog](https://nextjs.org/blog/next-16-3).
> Target: **Next.js 16.3.4** · `instant` export requires `cacheComponents`; `experimental.instantInsights` is experimental.

**Nothing about Instant Navigations is enforced at build time. Validation is a development-only feedback loop: with `cacheComponents` on, Next.js simulates both a page load and a client navigation for every Page and Default segment as you browse, and surfaces anything that would block in the dev overlay. The `instant` route segment config is the dial — `true` opts a segment into validation, `false` declares that this segment is allowed to block, and an object sets the severity. Getting the precedence rules right matters more than the syntax, because a single `instant = false` in the wrong place silently disables static-shell validation for your entire application.**

## What validation actually checks

> *"By **default** (`validationLevel: 'warning'`), Cache Components apps validate every Page and Default segment in development. Validation surfaces what would keep navigations into a segment from being instant — which navigations would block, where a `<Suspense>` boundary is missing, and which data is reaching the user uncached."*

Crucially it does not check one thing; it checks each entry path separately:

> *"For a route like `/shop/[slug]`, validation checks:*
> *• **Page load**: the full tree renders from the root. The root layout `<Suspense>` catches everything.*
> *• **Client navigation** (e.g. from `/shop/shoes` to `/shop/hats`): the `/shop` layout is already mounted and only the page below it re-renders. A `<Suspense>` boundary in the root layout does not cover this navigation.*
> *Each case is validated independently. A `<Suspense>` boundary that covers one navigation path might not cover another. This is why a page can pass the page load check but fail for client navigations, and why catching these issues by hand is difficult as the number of routes grows."*

Validation triggers at **every shared layout boundary** in the route, runs on page loads and on HMR updates, and uses the real request from your browser — so `[slug]` is checked against the actual values you navigate to, not a synthetic placeholder.

## Where the insight appears, and what it offers

Each insight names the specific component that would block and offers three fixes — **Stream** (wrap it in `<Suspense>`), **Cache** (give it `'use cache'`), **Block** (opt the segment out with `instant = false`). Each card links a walkthrough with patterns and trade-offs, and each carries a **Copy prompt** button:

> *"Each insight also provides a prompt that teaches your agent how to apply your chosen fix."*

That is the actual delivery mechanism for this feature. The panel is not just a list of warnings; it is a set of machine-readable instructions aimed at a coding agent, which is why the guide's recommended workflow is agent-driven.

## The `instant` export

```tsx title="layout.tsx | page.tsx"
export const instant = true

export default function Page() {
  return <div>...</div>
}
```

```tsx
type InstantConfig =
  | true
  | false
  | {
      level?: 'warning'
    }

export const instant: InstantConfig = true
```

- **`true`** — opt in at whatever level is configured globally. With framework defaults that means development-only validation surfacing in the dev overlay.
- **`false`** — this segment is allowed to block on navigation.
- **object** — opt in with a `level`. Today `'warning'` is the only value:

> *"In the future a validation level that supports validation during build will be supported. Unless you are enabling experimental validation modes there is no need to specify level since the only level available is `"warning"`."*

Two hard constraints from the reference:

> *"The `instant` export only works when `cacheComponents` is enabled."*
> *"`instant` cannot be used in Client Components. It will throw an error."*

## Turning down the volume globally

The framework default validates everything. To validate only segments that opt in explicitly:

```ts title="next.config.ts"
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

- **`'warning'`** *(framework default)* — every Page and Default segment is implicitly validated, dev only.
- **`'manual-warning'`** — only segments with an explicit `instant` export are validated, dev only.

And a warning about the default itself:

> *"The framework default may change in future versions to opt users into higher levels of validation. Because this feature is experimental, that change is not considered a breaking change. To pin a specific behavior, set `validationLevel` explicitly."*

## Opting out, and the two different things `false` does

The first meaning is local and mild:

> *"Set `instant = false` on the page or layout file. This opts the segment out of validation feedback. The segment may still navigate instantly if its structure supports it; the framework just won't surface insights for it. Navigations between sibling segments below are still validated."*

So `instant = false` on `app/dashboard/layout.tsx` stops flagging navigations into `/dashboard` from outside, while navigations between `/dashboard/a` and `/dashboard/b` are still checked. That is exactly the useful shape: a shared layout that cannot load instantly, wrapping pages that must.

```tsx title="app/tabs/layout.tsx"
export const instant = false
```

```tsx title="app/tabs/[tab]/page.tsx"
export const instant = true
```

The docs are explicit that you should *not* sprinkle `false` around defensively:

> *"You don't need to add `false` to ancestors of an instant page just because they do something blocking — a higher-up `instant = true` doesn't force its descendants to validate, and leaving an ancestor unconfigured is fine. Reach for `false` only when you've configured a deeper page as instant and need to exempt navigations that pass through a blocking ancestor."*

The second meaning is global and severe. Cache Components separately validates that each page produces a **non-empty static shell** at prerender time, and that check obeys a different precedence:

> *"To opt a route out of this validation, ensure the highest `instant` config in the route's tree is `false` — a `false` higher in the tree takes precedence over any deeper `true` for the static-shell check. Setting `false` on the root layout disables static shell validation for the entire app. Place the `false` as low as possible."*

One `export const instant = false` in `app/layout.tsx` therefore turns off static-shell validation everywhere, and nothing else changes to tell you.

## What an opted-out segment costs

> *"For opted-out segments, the navigation blocks on the server. If the content depends on cookies or headers but has a known cache lifetime, caching it with `use cache: private` lets the App Shell carry it ahead of the click instead of opting out, as long as its `stale` time is at least 5 minutes."*

`instant = false` is an honest declaration, not a fix. It is the right answer when the structural change is not worth the work — and the wrong answer when a five-minute private cache would have carried the content into the shell.

## Gotchas

**★ `export const instant` in a Client Component throws.**
The reference states it flatly. The trap is a page file that acquired `'use client'` for an unrelated reason months after someone added an `instant` export to it — the file compiles fine until the directive lands. The same restriction applies to `prefetch`: *"`prefetch` cannot be used when the segment is a Client Component."*

**★ `instant` and `prefetch` silently do nothing without `cacheComponents`.**
Both exports only work when Cache Components is enabled. Add them to an app that has not enabled the flag and you get no validation, no error, and a false sense that the route is covered.

**★ Validation never blocks a build, so CI will not catch any of this.**
Every insight is development-only. A team that only ever sees the app through CI and a preview deployment will never see a single insight. The `instant()` Playwright helper exists precisely to move this class of regression into CI — see [ch. 13 · 10](../../13-testing-and-developer-experience/10-the-instant-playwright-helper.md).

**★ One `instant = false` in the root layout disables static-shell validation for the whole app.**
For the static-shell check, a `false` higher in the tree beats any deeper `true` — the opposite of what "more specific wins" instincts predict. Place the opt-out as low as it can go, and treat an `instant = false` in `app/layout.tsx` as a change that needs a comment explaining why the whole application is exempt.

**★ The default validation level is experimental and may change without a breaking-change notice.**
Vercel reserves the right to raise the framework default, and says explicitly that because the feature is experimental *"that change is not considered a breaking change."* If your team relies on a particular volume of feedback — or on validation *not* getting stricter mid-upgrade — set `experimental.instantInsights.validationLevel` explicitly rather than inheriting the default.

**★ `level` accepts only `'warning'`, so there is no build-time enforcement to configure yet.**
Writing `instant = { level: 'warning' }` is equivalent to `instant = true` under default settings. A build-capable level is described as future work. Do not design a CI gate around this export; use `instant()` tests.

**★ Framework-synthesized error routes are excluded from implicit validation.**
`/_global-error` and `/_not-found` are skipped unless you opt them in with an explicit `instant` export. A not-found page that blocks is a genuinely bad experience — it is the page users hit when something has already gone wrong — and nothing will tell you about it by default.

**★ `instant = false` is a declaration, not a fix, and it has a runtime cost.**
Navigation into an opted-out segment blocks on the server. Before reaching for it, check whether the blocking content merely depends on `cookies()` or `headers()` with a known lifetime — `'use cache: private'` with a `stale` of at least five minutes lets the App Shell carry it ahead of the click, which is a real fix rather than a suppressed warning.

**★ Adding `instant = false` defensively to ancestors trains the team to ignore it.**
A higher-up `instant = true` does not force descendants to validate, so an unconfigured ancestor is fine. Reach for `false` only when a deeper page is explicitly `true` and navigations must pass through a blocking ancestor. Every unnecessary opt-out is a segment nobody will ever revisit.

**★ Validation surfaces blockers one at a time, so a clean overlay after one fix means nothing.**
The worked example in the guide fixes a per-slug fetch, watches the error clear, and only then sees the uncached `getFeatured()` fetch appear. Re-navigate after every fix and keep going until the overlay stays clean across a full pass of the route.

## Interview questions

**★ What does Cache Components validation actually simulate, and why two cases?**
For each validated route it checks the initial page load — the full tree rendering from the root, where a root-layout `<Suspense>` catches everything — and a client navigation at each shared layout boundary, where only the segments below the shared layout re-render and boundaries above it are unusable. They are validated independently because a boundary that covers one path may not cover the other, which is exactly the failure that is impossible to audit by hand as route count grows.

**★ What are the three forms of the `instant` export and what does each mean?**
`true` opts the segment into validation at the globally configured level. `false` declares that the segment is allowed to block, removing it from insight reporting and — for the static-shell check — exempting everything below it. An object with `level` sets severity, though `'warning'` is currently the only supported value, with build-time levels described as future work.

**★ You add `export const instant = false` to `app/layout.tsx` to quiet one noisy route. What have you actually done?**
Disabled static-shell validation for the entire application, because for that check a `false` higher in the tree takes precedence over any deeper `true`. You have also stopped insights for navigations into the root, though sibling navigations deeper in the tree are still checked. The correct move is to place the `false` on the specific layout or page that cannot be instant, as low in the tree as possible.

**★ How do you make validation quieter without opting individual routes out?**
Set `experimental.instantInsights.validationLevel` to `'manual-warning'`, which validates only segments carrying an explicit `instant` export. This is also the setting to pin if you do not want the framework default silently raised in a future release — Vercel states that raising it is not considered a breaking change while the feature is experimental.

**★ Why can't you rely on validation in CI?**
Because it is development-only and never blocks the build. The insights appear in the dev overlay on page loads and HMR updates; a CI pipeline that runs `next build` sees nothing. To get this class of regression into CI you write `instant()` Playwright tests, which assert what is visible without waiting for the network and fail when the instant UI changes.

**★ When is `instant = false` the right call?**
When the structural fix is not worth the work, or the route is not a priority — for example a shared dashboard layout that legitimately blocks while the tab pages beneath it must stay instant. It is the wrong call when the blocking content merely depends on `cookies()` or `headers()` and has a known cache lifetime, because `'use cache: private'` with a `stale` of at least five minutes lets the App Shell carry it ahead of the click instead. And remember that opted-out segments genuinely block on the server; the warning goes away and the latency does not.

**★ Which routes does validation skip by default, and why does that matter?**
The framework-synthesized `/_global-error` and `/_not-found` routes are excluded from implicit validation. It matters because those are the pages users reach when something has already failed, so a blocking not-found page compounds a bad moment. Opt them in explicitly with an `instant` export if the app leans on them.

{/* FOOTER */}
