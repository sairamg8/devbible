---
title: "Appendix D · part 3 — metadata, accessibility and the measurements you take before shipping, including the two the framework stopped giving you"
sidebar_label: "12 · Appendix D — metadata, a11y, measurement"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [How to optimize your Next.js application for production](https://nextjs.org/docs/app/guides/production-checklist) (`lastUpdated: 2026-03-10`), [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`) and the [`next` CLI reference](https://nextjs.org/docs/app/api-reference/cli/next) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** · Turbopack default. Documentation-verified; **no sandbox run, no timings**.

**This is where the official checklist's age costs the most, because two of its four measurement instructions no longer describe anything that exists. It tells you accessibility linting is built in — `next lint` was removed and `next build` no longer lints, so on a default 16 project nothing checks accessibility at all. It tells you to analyze bundles with a plugin whose documentation anchor still says "for webpack" — while Turbopack is the default and a first-party analyzer shipped in 16.1. Meanwhile 16.0 deleted the two numbers most CI budgets were built on. This page is the corrected pre-launch pass: what to check, what to measure it with now, and the one thing on the list that no tool will ever catch for you.**

## 1 · Accessibility — the section with a hole in it

The checklist's a11y items are three file conventions and one linter. The conventions are current:

> * *"**Global Error UI**: Add `app/global-error.tsx` to provide consistent, accessible fallback UI and recovery for uncaught errors across your app."*
> * *"**Global 404**: Add `app/global-not-found.tsx` to serve an accessible 404 for unmatched routes across your app."*
> * *"**Forms and Validation**: Use Server Actions to handle form submissions, server-side validation, and handle errors."*

🔴 **The linter item is not.** It reads *"Use the built-in `eslint-plugin-jsx-a11y` plugin to catch accessibility issues early"* — and in 16 there is no built-in anything:

> *"The `next lint` command has been removed. Use Biome or ESLint directly. `next build` no longer runs linting."*

The `eslint` key in `next.config` was removed too. So the corrected item is: **wire it yourself, and verify it runs.**

```bash
npx @next/codemod@canary next-lint-to-eslint-cli .
```

And because `@next/eslint-plugin-next` now defaults to flat config, a project can lose linting twice in one upgrade for two unrelated reasons — the command disappeared, and the legacy `.eslintrc` stopped being read. Check both.

```json
{
  "scripts": {
    "lint": "eslint .",
    "typecheck": "next typegen && tsc --noEmit"
  }
}
```

⚠️ **What a linter cannot check.** `eslint-plugin-jsx-a11y` is a static rule set: it finds a missing `alt`, a click handler on a `div`, a label with no control. It cannot tell you whether focus lands somewhere sensible after a route change, whether a streamed-in region announces itself, or whether an error boundary's fallback is reachable by keyboard. In an App Router application those three are exactly where the accessibility bugs are, because streaming and client-side navigation both change the page without a document load. That gap is not a Next.js failing — no linter catches it — but a checklist that lists only the linter implies a coverage it does not have.

The two conventions above matter more than they look for that reason: `global-error.tsx` and `global-not-found.tsx` are the states a user reaches when something has already gone wrong, and they are the states least likely to have been opened by anyone with a screen reader.

## 2 · Metadata and SEO — current, and one thing to re-check after 16

The checklist's items stand:

> * *"**Metadata API**: Use the Metadata API to improve your application's Search Engine Optimization (SEO) by adding page titles, descriptions, and more."*
> * *"**Open Graph (OG) images**: Create OG images to prepare your application for social sharing."*
> * *"**Sitemaps and Robots**: Help Search Engines crawl and index your pages by generating sitemaps and robots files."*

🔴 **But three of those file conventions changed shape in 16**, and the checklist predates it. The image-generating functions in `opengraph-image`, `twitter-image`, `icon` and `apple-icon` now receive `params` **and** `id` as promises — while `generateImageMetadata` still receives synchronous `params`. And the `sitemap` function's `id` is now a promise resolving to a **string**, so arithmetic on it needs a conversion. Both are worked through in [Appendix B part 2](02b-appendix-b-the-15-to-16-migration-mechanically.md).

The pre-launch check is therefore not "do we have OG images" but "do our OG images and sitemaps still render after the upgrade" — a question with a different answer.

There is also a rendering fact that retires a whole category of SEO folklore:

> *"Browsers receive the static shell instantly. Bots and crawlers are detected by their user agent and handled differently: because they need a complete document, Next.js skips the shell and renders the entire page dynamically at request time, then sends the finished HTML once the render completes."*

**Crawlers get a full dynamic render.** So "we need SSR for SEO" is not a reason to give up instant navigation — the crawler was never going to see the shell. [Chapter 12](../12-seo-metadata-and-accessibility/01-explanation.md) covers the rest.

## 3 · Type safety — one line on the official page, and a command that changes it

The checklist says to use TypeScript and the TS plugin. What it cannot say, because it predates the command, is that route types are now checkable without a build:

```bash
next typegen && tsc --noEmit
```

> *"Previously, route types were only generated during `next dev` or `next build`, which meant running `tsc --noEmit` directly wouldn't validate your route types."*

That is a genuine pre-launch gate: it catches a `params` destructure that was never awaited, or a `<Link href>` pointing at a route that does not exist, without paying for a production build. Two caveats from [Appendix C part 3](03c-appendix-c-the-cli-surface.md): it loads your `next.config` under the production build phase, so the job needs the build's environment; and it writes `next-env.d.ts`, which the docs recommend gitignoring.

## 4 · Core Web Vitals — the lab/field distinction the checklist gets right

> *"**Lighthouse**: Run lighthouse in incognito to gain a better understanding of how your users will experience your site, and to identify areas for improvement. This is a simulated test and should be paired with looking at field data (such as Core Web Vitals)."*

*"This is a simulated test"* is the load-bearing clause and the most-ignored sentence on the official page. A Lighthouse score is a lab measurement on a synthetic device and network; it is a debugging instrument, not evidence about your users. The field half:

```tsx
// app/_components/web-vitals.tsx
'use client'
import { useReportWebVitals } from 'next/web-vitals'

export function WebVitals() {
  useReportWebVitals((metric) => {
    navigator.sendBeacon(
      '/api/vitals',
      JSON.stringify({ name: metric.name, value: metric.value, id: metric.id }),
    )
  })
  return null
}
```

🔴 **`useReportWebVitals` is a hook, so it belongs in a Client Component** — mount it once in the root layout. `sendBeacon` rather than `fetch` because the interesting metrics arrive as the page is being unloaded, which is exactly when a `fetch` gets cancelled.

## 5 · Analyzing bundles — the section that needs replacing outright

The checklist offers `@next/bundle-analyzer`, and its own link anchor reads `package-bundling#nextbundle-analyzer-**for-webpack**`. Turbopack has been the default bundler since 16.0.

The current answer is a first-party command, added in 16.1:

```bash
npx next experimental-analyze
```

> *"Analyzes bundle output using Turbopack. Does not produce build artifacts."*

It starts a local server on port 4000 by default and lets you *"Filter bundles by route and switch between client and server views"*, *"View the full import chain showing why a module is included"*, and *"Trace imports across server-to-client component boundaries and dynamic imports."*

For a before/after on a refactor, write it to disk instead:

```bash
npx next experimental-analyze --output
cp -r .next/diagnostics/analyze ./analyze-before
```

### And the two numbers that no longer exist

> *"**Next.js 16** removes the `size` and `First Load JS` metrics from the `next build` output. We found these to be inaccurate in server-driven architectures using React Server Components. Both our Turbopack and Webpack implementations had issues, and disagreed on how to account for Client Components payload."*

🔴 **Any CI gate parsing those numbers now parses nothing and passes.** That is the worst failure a quality gate has, because a green check reads as evidence. Delete the parser rather than leaving it — and note the reasoning generalises: *a budget that two implementations of the same bundler compute differently was never enforceable.* The replacement is field-shaped, which is why §4 comes before this section rather than after it.

The checklist's supplementary tools are still fine for the narrower question of what a dependency costs before you add it: Import Cost, Package Phobia, Bundle Phobia, bundlejs.

## The pre-launch pass, corrected

| # | Check | How, at 16.3 |
|---|---|---|
| 1 | Nothing accidentally dynamic | audit Request-time API calls; none in the root layout |
| 2 | Everything intended to be cached is marked | grep for `"use cache"`; confirm `stale` clears the 30s floor, and 5 min for App Shell inclusion |
| 3 | Authorization inside every Server Action | not in Proxy, layout or page — [part 2](04b-appendix-d-security.md) |
| 4 | No sensitive value crosses a client boundary | projection at the boundary, `server-only` on the DAL, taint as the net |
| 5 | `.env.*` gitignored; only public values prefixed | and no build-time read of a value that must be per-request |
| 6 | Lint actually runs | 🔴 `next lint` is gone and `next build` does not lint |
| 7 | Types check, routes included | `next typegen && tsc --noEmit` |
| 8 | `error.js`, `not-found.js`, `global-error.tsx`, `global-not-found.tsx` exist and are keyboard-reachable | conventions, then a manual pass |
| 9 | OG images and sitemaps still render post-16 | `params` and `id` are promises now |
| 10 | Lab and field measurement both in place | Lighthouse **and** `useReportWebVitals` |
| 11 | Bundle understood, not just measured | `next experimental-analyze` |
| 12 | No CI gate silently passing | 🔴 anything parsing `size`/`First Load JS` is now vacuous |
| 13 | Browser floor checked against analytics | Chrome/Edge/Firefox 111+, Safari 16.4+ |
| 14 | `keepAliveTimeout` above the proxy's, if self-hosting | [chapter 16](../16-deployment-scaling-and-observability/01-explanation.md) |

## Gotchas

**★ Symptom: no accessibility rule has fired since the 16 upgrade and nobody changed the lint config.** Cause: `next lint` was removed and `next build` no longer lints, so a project whose only lint step was implicit in the build now has none. Fix: add an explicit `eslint .` script and run it in CI. Then check the second failure — `@next/eslint-plugin-next` defaults to flat config, so a surviving `.eslintrc` is being ignored.

**★ Symptom: a11y linting is green and screen-reader users report the app is unusable after navigation.** Cause: static rules check markup, not behaviour. Focus management across client-side navigation, announcement of streamed regions and keyboard reachability of error fallbacks are all invisible to a linter. Fix: add a manual keyboard-only pass over navigation, a streamed route and both error states. There is no tool substitute; the checklist implying otherwise is its weakest moment.

**★ Symptom: OG images 404 after the upgrade, only on routes using `generateImageMetadata`.** Cause: the image function's `params` and `id` became promises while `generateImageMetadata`'s `params` stayed synchronous. Fix: await in exactly one of the two — awaiting in `generateImageMetadata` is as wrong as not awaiting in the image function.

**★ Symptom: a sitemap emits overlapping URL ranges.** Cause: `id` is now a promise resolving to a string, so `id * 50000` is string arithmetic. Fix: `Number(await id) * 50000`.

**★ Symptom: a team defends giving up instant navigation "for SEO".** Cause: reasoning from a model where crawlers saw whatever a browser saw. Fix: they do not — crawlers are detected by user agent and served a complete dynamic render. The SEO argument for abandoning the static shell does not survive that sentence.

**★ Symptom: `useReportWebVitals` throws about hooks in a Server Component.** Cause: it is a React hook. Fix: put it in a `'use client'` component mounted once in the root layout, and report with `sendBeacon` — a `fetch` issued during unload is frequently cancelled, which is precisely when the final metrics arrive.

**★ Symptom: a Lighthouse score of 98 alongside user complaints about slowness.** Cause: Lighthouse is a lab test on a simulated device and network, as the checklist itself says. Fix: pair it with field data. Lab numbers are for finding a cause; field numbers are for knowing whether you have a problem.

**★ Symptom: the bundle-size CI gate has been green for months and the bundle has doubled.** Cause: 16.0 removed `size` and `First Load JS` from build output, so the parser matches nothing and the gate passes vacuously. Fix: delete the parser and rebuild the gate on field data, and be suspicious of any check that cannot fail.

**★ Symptom: you know a dependency is large and cannot find out why it is included.** Cause: a size number never answers that. Fix: `next experimental-analyze`, which shows the full import chain and traces across the server-to-client boundary and through dynamic imports. The usual answer is a barrel file imported by a Client Component.

**★ Symptom: `next experimental-analyze` output is wanted in CI but it starts a server and hangs the job.** Cause: it serves the report by default. Fix: `--output` writes to `.next/diagnostics/analyze` and exits; copy the directory to compare against a later run.

**★ Symptom: the type-check job fails while loading `next.config`, not on any type.** Cause: `next typegen` loads the config using the production build phase, so it needs the build's environment variables. Fix: give the type-check job the same environment as the build job.

## Interview questions

**★ On a default Next.js 16 project, what checks your accessibility?**
Nothing, and that is the answer people find surprising. `next lint` was removed and `next build` no longer runs linting, so unless someone added an explicit ESLint or Biome step, no rule runs at all — while the official production checklist still describes `eslint-plugin-jsx-a11y` as built in. There is a second trap on top: `@next/eslint-plugin-next` now defaults to flat config, so a project that *did* add a lint step can still be silently skipping a legacy `.eslintrc`.

**★ What class of accessibility problem does a linter never catch, and why is it worse in the App Router?**
Anything behavioural: where focus goes after a client-side navigation, whether a region that streams in is announced, whether an error boundary's fallback can be reached by keyboard. A linter reads markup; these are consequences of the page changing without a document load. The App Router does that constantly — client-side transitions and streaming are both defaults — so the gap between "lint is green" and "usable with a screen reader" is wider here than in a traditional multi-page app.

**★ "We need SSR for SEO." Respond.**
Crawlers are detected by user agent and served a complete dynamic render rather than the static shell, because they need a finished document. So the SEO argument does not distinguish between rendering strategies at all — you can keep instant navigation for humans and crawlers still get full HTML. The reasoning it replaces came from a period when the bot and the browser received the same bytes.

**★ Why is `useReportWebVitals` necessarily in a Client Component, and why `sendBeacon`?**
It is a React hook, and hooks require a Client Component — mounted once in the root layout so it observes every route. `sendBeacon` rather than `fetch` because the most valuable metrics, particularly the final layout-shift and interaction numbers, are emitted as the page unloads, and a `fetch` started during unload is routinely cancelled. `sendBeacon` is designed to survive that transition.

**★ Your CI has had a green bundle-size gate for six months. What would you check first?**
Whether it can fail. 16.0 removed `size` and `First Load JS` from `next build` output, so any gate parsing them now finds nothing and passes unconditionally. A check that cannot fail is worse than no check, because the green mark is read as evidence. I would delete the parser rather than repair it — the stated reason for the removal is that the numbers disagreed between Turbopack and webpack and misaccounted for Client Component payload, so the metric was never a defensible budget — and rebuild the gate on field Core Web Vitals.

**★ What does `next experimental-analyze` give you that a size number never did?**
The import chain — *why* a module is in a bundle. It filters by route, separates client and server views, and traces imports across the server-to-client boundary and through dynamic imports. A size number tells you that you have a problem; the chain tells you where the decision that caused it was made, which is almost always someone importing a barrel file from a Client Component. It produces no build artifacts, so it is a diagnostic run rather than part of a deploy.

**★ How do you type-check routes in CI without building, and what surprises people about it?**
`next typegen && tsc --noEmit`. Before `typegen` existed, route types were only generated by `next dev` or `next build`, so a bare `tsc --noEmit` silently validated everything except them. The surprise is that `typegen` loads your `next.config` under the production build phase, so a type-check job without the build's environment variables fails while loading configuration — an error that looks nothing like a type error and sends people to the wrong file.

**★ Which items on a pre-launch checklist can be automated, and which cannot?**
Automatable: the type check including routes, lint once it is actually wired, a grep for Request-time APIs in the root layout, an `instant()` test per critical route, and field Core Web Vitals collection. Not automatable, and therefore worth naming explicitly on the list: a keyboard-only pass over navigation and both error states, the judgement of which `[stream]`/`[cache]`/`[block]` fix each blocking route should take, whether each Server Action's authorization checks the *relationship* and not just the session, and the browser-floor decision against your own analytics. The dangerous ones are the second group, because there is no green tick to mistake for having done them.

---

← [Appendix D part 2 · security](04b-appendix-d-security.md) · [Chapter 19 overview](01-explanation.md) · Next → [Appendix E · The version watchlist](05-appendix-e-version-watchlist.md)
