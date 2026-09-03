---
sidebar_position: 10
title: "The instant() helper from @next/playwright scopes your assertions to the UI that exists before the network answers, which turns \"this navigation is instant\" from a feeling into a failing test"
sidebar_label: "10 · The instant() Playwright helper"
description: "Installing @next/playwright, the two test shapes every route needs, what the instant() scope actually does to the page, and the assertion discipline that stops these tests passing vacuously."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against [Ensuring instant navigations](https://nextjs.org/docs/app/guides/instant-navigation), [`instant` route segment config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/instant), the [Next.js 16.3 release blog](https://nextjs.org/blog/next-16-3) and [How to set up Playwright with Next.js](https://nextjs.org/docs/app/guides/testing/playwright).
> Target: **Next.js 16.3.4** · `@next/playwright` alongside `@playwright/test` · Node.js **>= 20.9**.

**Development-time validation can tell you a route has a non-empty shell. It cannot tell you the *right things* are in it, and it runs nowhere near CI. `instant()` closes both gaps: it wraps a block of Playwright assertions in a scope where dynamic content is held back, so everything you assert inside that block is by definition content the user had before the network answered. The test then fails whenever that set of content changes — for any reason, including reasons nobody predicted. That is the whole value proposition: it is a regression test for a property, not for a rendering.**

## What it is for

> *"Another common failure mode is a page that navigates instantly today becoming slow tomorrow. Maybe a component that reads `cookies()` gets added to a shared header and de-opts the route to request-time rendering, or a `<Suspense>` boundary moves during a refactor and part of the page starts blocking. Either way, UI that used to appear immediately no longer does."*

Neither of those edits touches the route you carefully made instant. That is why this needs a test rather than a review checklist.

The guide is explicit about why structural validation is not enough:

> *"Validation catches structural problems during development, but as the codebase grows, the structural checks can only tell you that a shell exists. They can't tell you whether the right content is in it. E2E tests close that gap: they assert on what the user actually sees when the navigation completes, catching regressions before they ship."*

## Install

```bash
pnpm add -D @next/playwright @playwright/test
```

```bash
npm install -D @next/playwright @playwright/test
```

```bash
yarn add -D @next/playwright @playwright/test
```

`@next/playwright` is additive: it is not a test runner and does not replace `@playwright/test`. If you do not already have Playwright configured, set it up first — `pnpm create playwright` writes a `playwright.config.ts` — as covered in [02 · End-to-end flows with Playwright](02-end-to-end-flows-with-playwright-testing-streaming-and-ppr-b.md).

## The shape

```ts
import { instant } from '@next/playwright'
```

`instant(page, callback, options?)`. Everything asserted inside the callback runs against the instant UI; dynamic content is released when the callback returns.

> *"Inside the callback, an initial page load shows the static UI and a client navigation shows the destination's prefetched UI. Other dynamic content remains blocked until the callback finishes."*

And, tying it back to the DevTools:

> *"The start of the `instant()` scope is the same as turning on **Pause on navigations** in the Navigation Inspector, and the end of the scope releases the pause the way **Resume** does."*

So it is not a timing heuristic. There is no threshold in milliseconds and nothing flaky about it: the page is genuinely frozen at its shell for the duration of the block.

## Two tests, because a route has two entry paths

> *"A route can be reached two ways, and a `<Suspense>` boundary can cover one without covering the other:*
> *• **Initial page load**: Use `page.goto()` to test the static UI from the document response.*
> *• **Client navigation**: Click a `<Link>` to test the destination's prefetched UI. Per-link prefetching can add request-specific content to this UI."*

```ts title="e2e/navigation.test.ts"
import { test, expect } from '@playwright/test'
import { instant } from '@next/playwright'

test.describe('Product page (/store/[slug])', () => {
  test('is instant on an initial page load', async ({ page, baseURL }) => {
    await instant(
      page,
      async () => {
        await page.goto('/store/hats')
        await expect(page.locator('h1')).toContainText('Baseball Cap')
        await expect(page.getByText('In stock')).toHaveCount(0)
      },
      { baseURL }
    )
    await expect(page.getByText('In stock')).toBeVisible()
  })

  test('is instant on a client navigation', async ({ page }) => {
    await page.goto('/store/shoes')
    await instant(page, async () => {
      await page.click('a[href="/store/hats"]')
      await page.waitForURL((url) => url.pathname === '/store/hats')
      await expect(page.locator('h1')).toContainText('Baseball Cap')
      await expect(page.getByText('In stock')).toHaveCount(0)
    })
    await expect(page.getByText('In stock')).toBeVisible()
  })
})
```

Four structural details in that file, each of which is a bug if you omit it.

**`baseURL` is passed when `page.goto()` is the first navigation.**

> *"Pass Playwright's `baseURL` to `instant()` when `page.goto()` is the first navigation. The helper needs the origin before requesting the document."*

The client-navigation test does not need it, because `page.goto('/store/shoes')` outside the scope has already established the origin.

**`waitForURL` comes before any assertion on the destination.**

> *"For client navigations, wait for the destination URL before asserting on its UI. Otherwise, a shared selector can match the source page before the destination commits. If the prefetched destination cannot commit, the URL wait times out and the test fails."*

Both halves matter. Without it your assertion can pass against the *source* page — the exact false green this test exists to prevent — and with it, a destination that cannot commit fails loudly instead of silently.

**There is a negative assertion inside the scope.** `toHaveCount(0)` on the streamed content is what pins the boundary. Without it the test says "the title is instant" and stays green if the entire rest of the page also becomes instant, or if a `<Suspense>` boundary vanishes and the whole page starts blocking behind something else.

**There is a positive assertion after the scope.** `await expect(page.getByText('In stock')).toBeVisible()` proves the dynamic content actually arrives once the pause is released. Without it, a route that never resolves its streamed content passes.

## The order you write it in

The documented loop puts the test *before* the fix:

> *"**Test**: confirm the target UI renders normally, then write an `instant()` test and verify that it fails before changing the route."*

This is not ceremony. An `instant()` test that was never seen to fail may be asserting on the wrong selectors, may be scoped around a navigation that never happens, or may be passing because the assertion matched the source page. Watching it go red first is the only cheap proof that it is wired to the thing you think it is.

## Gotchas

**★ Omitting `baseURL` when `page.goto()` is the first navigation.**
The helper needs the origin before it requests the document, and `page.goto('/store/hats')` inside the scope with no prior navigation gives it nothing to resolve a relative path against. Destructure `baseURL` from the Playwright fixture and pass it as the third argument. The client-navigation test does not need it because the `goto` outside the scope has already set the origin.

**★ Asserting on the destination before `waitForURL` gives you a green test against the source page.**
A shared selector — a heading, a price, a nav item — can match the page you navigated *from* in the window between the click and the commit. Always `await page.waitForURL(...)` inside the scope, before any expectation about the destination. It doubles as the failure mode you want: if the prefetched destination cannot commit, the wait times out and the test fails.

**★ A test with only positive assertions inside the scope is close to vacuous.**
Asserting that the title is visible does not pin anything: it stays green if the boundary moves, if more content becomes instant, or if the whole page starts blocking behind a different fallback that happens to include the title. Pair every "this must be instant" with a `toHaveCount(0)` for what must still be streaming, so the test fails in both directions.

**★ No assertion after the scope means a route that never finishes loading passes.**
The scope holds back dynamic content; returning from it releases the pause. If you never assert that the released content actually appears, a broken stream is indistinguishable from a correct one. End every one of these tests with a `toBeVisible()` on the streamed content.

**★ Testing one entry path and assuming the other.**
The initial page load and the client navigation produce different initial UI — the first is the static shell from the document, the second the destination's prefetched App Shell — and a `<Suspense>` boundary can cover one without covering the other. Two tests per route, always. Writing only the click test is the more common half to skip and the more common one to break.

**★ Running these against `next dev` and assuming the same result under `next start`.**
The testing API is enabled automatically in `next dev`, so the tests run there without extra config — but development does not prefetch, which is precisely the mechanism these tests are about. Running against a production build requires an explicit config flag; see [10b · Instant tests in CI](10b-instant-tests-in-ci-and-regression-causes.md).

**★ Writing the test after the fix and never seeing it fail.**
The documented loop is: confirm the target UI renders normally, write the test, watch it fail, then apply the fix. A test authored against an already-passing route can be scoped around a navigation that never happens or asserting on selectors that match either page, and nothing will ever tell you.

**★ Testing every route.**
> *"Focus these tests on the user flows that matter most."*

Each of these tests freezes a navigation and asserts on shell contents, which means each one becomes a review conversation the first time someone refactors a shared layout. Spend that budget on the flows where an instant navigation is actually part of the product.

## Interview questions

**★ What does `instant()` actually do to the page, and why is it not a timing assertion?**
It opens a scope in which dynamic content is held back, so everything asserted inside runs against the UI that was available without waiting for the network. The documentation says entering the scope is equivalent to enabling **Pause on navigations** in the Navigation Inspector, and leaving it is equivalent to clicking **Resume**. There is no millisecond threshold anywhere, which is why the tests are not flaky under load.

**★ Why does a single route need two `instant()` tests?**
Because it has two entry paths that produce different initial UI. A `page.goto()` exercises the static shell delivered by the document response, where every `<Suspense>` boundary in the tree is available. A link click exercises the destination's prefetched App Shell, where only boundaries below the shared layout apply. A boundary can cover one path and not the other, so one test cannot stand in for the other.

**★ Why must `waitForURL` come before assertions in a client-navigation test?**
Because between the click and the destination committing, a shared selector can match the source page, and the assertion passes against the wrong page — the exact false green the test exists to prevent. It also converts a destination that cannot commit into a timeout failure rather than a silent pass.

**★ What makes an `instant()` test vacuous, and how do you avoid it?**
Only asserting that things are present. That stays green if the boundary moves, if more content becomes instant, or if a different fallback happens to include your selector. A useful test asserts positively on what must be instant, negatively (`toHaveCount(0)`) on what must still be streaming, and then — after the scope — positively that the streamed content does arrive.

**★ When do you have to pass `baseURL`, and why?**
When `page.goto()` is the first navigation of the test, i.e. it happens inside the `instant()` callback with nothing before it. The helper needs the origin before it requests the document. A test that navigates outside the scope first has already established the origin and does not need it.

**★ Why does the documented workflow insist on watching the test fail before applying the fix?**
Because a test written against an already-passing route has never demonstrated that it is connected to the behaviour it claims to check. It may assert on selectors that match either page, or wrap a navigation that never happens. Seeing red once is the cheapest available proof that the assertion is wired correctly, and it is why the agent loop lists Test before Fix.

**★ What kinds of change do these tests catch that a code review of the route would not?**
Changes made somewhere else entirely. The two examples the release notes give are a component that reads `cookies()` being added to a shared header, which de-opts the route to request-time rendering, and a `<Suspense>` boundary being moved during a refactor so part of the page starts blocking. Neither edit touches the route file, so neither would show up in a review of that route.

{/* FOOTER */}
