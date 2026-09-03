---
sidebar_position: 11
title: "An instant() test that only ever runs against next dev is testing an environment with prefetching switched off, so getting these tests into CI against a production build is the whole point"
sidebar_label: "10b · Instant tests in CI"
description: "Enabling the testing API for next start with exposeTestingApiInProductionBuild, the localhost cookie collision to avoid in parallel runs, the two named regression causes and why they fail wide, and where instant() sits among the Cypress, Jest, Playwright and Vitest guides."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against [Ensuring instant navigations](https://nextjs.org/docs/app/guides/instant-navigation), [`instant` route segment config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/instant), [How to set up Playwright with Next.js](https://nextjs.org/docs/app/guides/testing/playwright) and the [Next.js 16.3 release blog](https://nextjs.org/blog/next-16-3).
> Target: **Next.js 16.3.4** · continues [10 · The instant() Playwright helper](10-the-instant-playwright-helper.md).

**Development is the one environment where the property you are testing does not exist: Next.js does not prefetch in `next dev`, so the App Shell a client navigation relies on is never delivered ahead of the click. `instant()` still works there — the testing API is on automatically — but a suite that only ever runs against the dev server is checking a weaker claim than the one you care about. Running against `next start` needs one experimental config flag, and after that the interesting part is understanding what actually breaks these tests: changes in files that have nothing to do with the route.**

## Where the tests can run

The guide gives two environments and one switch between them. Run these tests against `next dev`, where the testing API is enabled for you automatically. To run them in CI against a production build instead, set `exposeTestingApiInProductionBuild`, which makes `next start` expose that same API.

```ts title="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: { exposeTestingApiInProductionBuild: true },
}

export default nextConfig
```

The rest is ordinary Playwright practice from the Next.js guide. Playwright simulates a user navigating your application across three browsers — Chromium, Firefox and WebKit — and doing so requires your Next.js server to be running. The guide's own recommendation is to run your tests against your production code, because that more closely resembles how the application will behave for real users.

Two operational details from the same guide: Playwright runs your tests in headless mode by default, and installing everything it needs is a single command, `npx playwright install-deps`.

Build and start, then run the suite against it; or let Playwright's `webServer` option start the server and wait for it. The one thing to avoid is pointing an `instant()` suite at `next dev` in CI and treating a pass as evidence about production.

## Gate the flag to the build you test

The documentation gives the flag and does not take a position on leaving it enabled in a shipping build, so treat this as engineering judgement rather than a documented rule: the flag exists to expose a testing API from `next start`, and there is no reason for that API to be reachable in the artefact you serve to users. Scope it:

```ts title="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    exposeTestingApiInProductionBuild: process.env.E2E === 'true',
  },
}

export default nextConfig
```

Then build the E2E artefact with `E2E=true next build` and ship the plain one. The trade-off is that you are no longer testing byte-identical output; if that matters more to you than the exposure, enable it unconditionally and say so out loud in a comment.

## What actually breaks these tests

The two causes named in the release notes are worth memorising, because they share a property: **neither one edits the route under test.** The first is a component that reads `cookies()` being added to a shared header, which de-opts the route to request-time rendering. The second is a `<Suspense>` boundary moving during a refactor, after which part of the page starts blocking.

**A `cookies()` read in a shared header.** The read is a runtime API, so the component cannot be prerendered; if it is not wrapped in a `<Suspense>` boundary the route de-opts to request-time rendering, and every route that renders that header loses content from its shell. The failure is wide — dozens of tests going red from a one-line change in a component nobody thought of as routing code. That width is the signal, not noise: read it as "a shared ancestor changed", and go look at the header rather than at the thirty routes.

**A `<Suspense>` boundary moved during a refactor.** Moving a boundary up makes more of the page fall behind one fallback; moving it down or removing it makes the parent block. Either way the set of instantly-visible content changes, which is exactly what the assertion pins. A refactor that reorganises components without intending to change behaviour is the classic source.

The fix in both cases is one of the two levers from the Instant Navigations model — cache it, or push it down behind a boundary — described in [ch. 2 · 10 · Instant Navigations](../02-routing-and-navigation/10-instant-navigations/README.md).

## The test and the validation are independent

Worth being explicit, because it surprises people: `export const instant = false` opts a segment out of *validation feedback*. It does not disable an `instant()` test, which observes the page rather than consulting the segment config. So a route can be deliberately exempt from dev-overlay insights and still be pinned by a test — which is a perfectly reasonable arrangement for a route you have decided not to chase structurally but whose current behaviour you do not want silently degrading further.

## Where this sits among the other testing tools

Upstream documents four testing setups — Cypress, Jest, Playwright and Vitest — and `instant()` exists only for Playwright, in the `@next/playwright` package. There is no Cypress equivalent. A team standardised on Cypress for end-to-end work has to either add Playwright for this specific class of test or go without; the property depends on a testing API the helper drives, not on anything observable from ordinary browser automation.

Within a suite, these are not a replacement for your existing end-to-end tests. Those assert that the application works; `instant()` tests assert that a *performance property* of a navigation has not regressed. Keep the passing test as a regression guard — that is the documented final step of the loop — and expect it to fail for reasons unrelated to the feature being worked on.

## The agent-driven version

The release notes package this whole loop as a Skill, `next-cache-components-optimizer`, and describe it performing the same four steps by hand: it confirms the target UI renders normally, writes an `instant()` test that fails before the fix, then works that test to green against a production-like build, and finally ships it as a regression guard. The notes say it can be pointed at the initial load (a hard navigation), at client-side navigation (a soft navigation), or at both.

Note the phrase "against a production-like build" — the Skill's own workflow assumes you have solved the environment question above.

## Gotchas

**★ A green suite against `next dev` is a weaker claim than it looks.**
The testing API is enabled automatically there, so the tests run and pass, but development does not prefetch. The client-navigation test is exercising a navigation whose App Shell was never prefetched. Run the suite against `next build` plus `next start` with `exposeTestingApiInProductionBuild` before you trust it as a gate.

**★ The DevTools cookie is scoped to the domain, not the port.**
The docs warn about this directly: *"cookies are scoped to the domain and not the port"*, so running multiple projects on the same domain — typically `localhost` — means the cookie is shared between them and can cause unexpected behaviour. The `next-instant-navigation-testing` cookie is the mechanism both the Inspector and `instant()` use to hold content back. Two projects on `localhost`, or a suite running while you have the Navigation Inspector paused in a browser on the same machine, can interfere. Clear the cookie or close the panel when switching projects; the docs say this will be fixed as part of stabilising the feature.

**★ Leaving `exposeTestingApiInProductionBuild` on in the artefact you ship.**
The docs describe the flag as the way to expose the same testing API from `next start` for CI, and take no position on shipping it. There is no product reason for that API to be reachable by users, so gate it behind an environment variable and build the E2E artefact separately — accepting that you are then not testing byte-identical output.

**★ A wide failure is a signal about an ancestor, not thirty separate regressions.**
When a `cookies()` read lands in a shared header, every route rendering that header loses shell content at once. The instinct to triage route by route wastes an afternoon. Read breadth as "something shared changed" and look for the common ancestor first.

**★ These tests fail for reasons unrelated to the pull request that broke them.**
That is the design — they pin a property that any edit anywhere can violate. Teams that treat an unrelated red test as flakiness and retry it lose the entire value of the suite. The correct response to a surprising failure is to open the Navigation Inspector on that navigation and look at the shell.

**★ There is no Cypress equivalent.**
Upstream documents Cypress, Jest, Playwright and Vitest, but `instant()` ships in `@next/playwright` only. A Cypress-standardised team must add Playwright for this class of test; the helper drives a Next.js testing API rather than doing anything a generic browser driver could replicate.

**★ `instant = false` does not exempt a route from an `instant()` test.**
The segment config governs validation feedback in development. The test observes the rendered page and knows nothing about the export. That decoupling is useful — you can pin the current behaviour of a route you have deliberately stopped chasing — but it does mean "we opted that route out" is never the explanation for a failing test.

**★ Forgetting `npx playwright install-deps` in CI.**
Standard Playwright operational detail rather than anything specific to `instant()`, and still the most common reason a suite that runs locally does nothing in a fresh CI container. Playwright runs headless by default; the browsers and their system dependencies still have to be installed.

## Interview questions

**★ Why is running `instant()` tests only against `next dev` insufficient?**
Because Next.js does not prefetch in development. The client-navigation test is therefore exercising a navigation whose destination App Shell was never delivered ahead of the click, so a pass says less than it appears to. The testing API is enabled automatically in dev, which makes this an easy mistake; running against `next build` and `next start` requires setting `experimental.exposeTestingApiInProductionBuild`.

**★ What does `exposeTestingApiInProductionBuild` do, and how would you scope it?**
It makes `next start` expose the same testing API that `next dev` enables automatically, so the helper can hold back dynamic content against a production build. The docs do not take a position on shipping it, but there is no reason for users to reach a testing API, so a reasonable practice is to gate it on an environment variable and build a separate E2E artefact — accepting that you are then not testing byte-identical output.

**★ Two of your instant tests start failing after a change to a shared header. What happened, and how do you triage?**
Almost certainly a runtime API read — `cookies()` or `headers()` — was added to a component in that header without a `<Suspense>` boundary, de-opting every route that renders it to request-time rendering. Triage by breadth: a wide failure across unrelated routes points at a shared ancestor, so open the header, not the thirty routes. The fix is the usual pair — cache the lookup behind the session value, or wrap the component in a boundary.

**★ Does `export const instant = false` disable the corresponding `instant()` test?**
No. The segment config controls development-time validation feedback; the test observes what the page actually renders and never consults it. That is deliberate and useful: a route can be exempt from insights while its current behaviour stays pinned by a test.

**★ Your team uses Cypress for end-to-end tests. How do you adopt this?**
By adding Playwright for this class of test, or not adopting it. Upstream documents Cypress, Jest, Playwright and Vitest as testing setups, but `instant()` ships only in `@next/playwright` and drives a Next.js testing API — it is not something a generic browser driver can reproduce by waiting or by measuring.

**★ How should a team treat an `instant()` failure on a pull request that did not touch the route?**
As the intended behaviour of the suite, not as flakiness. These tests pin a property that edits anywhere in the shared tree can violate — a moved `<Suspense>` boundary, a new runtime API read in a layout. Retrying a red test throws away the only signal you get before users do. Open the Navigation Inspector on that navigation and compare the shell against what the test expects.

{/* FOOTER */}
