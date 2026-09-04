---
title: "Cache Components makes Partial Prerendering the default and makes React Activity keep the previous route in the DOM, and that second change quietly invalidates a large class of existing end-to-end tests"
sidebar_label: "2b · PPR, Activity and CI"
sidebar_position: 101
description: "Reading the build table as a testable contract, why hidden Activity content still matches DOM queries and which locators survive it, the visibility-aware fallbacks, and the CI shape — sharding, retries, artefacts and the flake budget."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [How Next.js preserves UI state with Activity](https://nextjs.org/docs/app/guides/preserving-ui-state) (lastUpdated 2026-07-01), [cacheComponents](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents) (2026-06-22) and [Building your application](https://nextjs.org/docs/app/guides/building).
> Target: **Next.js 16.3.4** · `@playwright/test` 1.62.1 · continues [2 · End-to-end flows with Playwright](02-end-to-end-flows-with-playwright-testing-streaming-and-ppr-b.md).

**Turning on `cacheComponents` does two things at once, and teams braced for the first are blindsided by the second. The first is Partial Prerendering as the default rendering model: routes stop being all-static or all-dynamic and become a prerendered shell with dynamic parts streaming into it. The second is that client-side navigation no longer unmounts the route you came from — React's `<Activity>` hides it instead. Hidden means `display: none`, and `display: none` means still in the document. Any end-to-end assertion built on a DOM query that does not check visibility can now match an element belonging to a page the user left.**

## The build table is a testable contract

`next build` prints a symbol per route, and with Cache Components enabled the vocabulary changes:

| Symbol | Meaning |
|---|---|
| `○` | Static — fully prerendered, served without server rendering |
| `◐` | Partial Prerender — static shell served immediately, dynamic content streams in |
| `●` | SSG — prerendered from `generateStaticParams` or `getStaticProps` |
| `ƒ` | Dynamic — server-rendered on demand for every request |

With Cache Components on, `ƒ` becomes rare and meaningful: a route only lands there when it has *nothing* to prerender — a request-dependent Route Handler, Proxy, or dynamic metadata such as `icon` or `opengraph-image`. A page route that shows `ƒ` is usually a mistake, and it is the classic silent regression: someone adds a `cookies()` read to a shared layout and every descendant route de-opts.

One nuance the docs call out and that trips people up when they write assertions around this: the symbol reflects what the route does at prerender time, not which validation configs it exports. A route that exports `instant` still shows the symbol its prerendering behaviour earns.

You cannot assert on the build table from Playwright, and you should not try to parse it — it is human-facing output that has already changed once this major version. The regression it represents is caught by the navigation-property tests described in [10 · The instant() Playwright helper](10-the-instant-playwright-helper.md) and [10b · Instant tests in CI](10b-instant-tests-in-ci-and-regression-causes.md), which fail when a route stops delivering its shell ahead of the network, whatever the cause.

## Activity: the previous route is still in the DOM

With `cacheComponents` enabled, Next.js wraps routes in React's `<Activity>` and sets the mode to `"hidden"` on navigation rather than unmounting. State survives, so navigating back restores form inputs and expanded sections intact. Effects are cleaned up when a route becomes hidden and recreated when it becomes visible again. Next.js keeps a few recently visited routes hidden and evicts older ones.

For end-to-end tests the operative fact is one sentence:

> *"Hidden Activity content has `display: none` but remains in the document."*

That applies both to routes preserved by Cache Components and to `<Activity>` you use directly for tabs or accordions. The documented consequences are three, and each corresponds to a distinct test failure:

1. **DOM queries can find hidden elements.** A selector matches something on the page the user already left.
2. **Interactions with hidden elements fail or time out.** Playwright waits for actionability, which a `display: none` element never reaches — so the failure is a 30-second timeout on a click, with a locator that "clearly exists".
3. **Assertions may match hidden content.** The worst of the three, because it is a *false pass*: you assert an element is present after navigating away from it, and it is.

### Which locators survive it

`getByRole` queries the accessibility tree, and the accessibility tree excludes hidden elements. So do `getByLabel` and `getByPlaceholder`. That is why the locator discipline from [page 2](02-end-to-end-flows-with-playwright-testing-streaming-and-ppr-b.md) stops being a style preference here and becomes correctness:

```ts
// Filters by visibility automatically — safe under Activity.
await page.getByRole('button', { name: 'Submit' }).click()
await page.getByLabel('Email').fill('user@example.com')
```

When there is genuinely no accessible handle, filter explicitly:

```ts
// Safe: visibility is stated.
await page.locator('.product-card').filter({ visible: true }).first().click()

// Unsafe: may resolve to a card on the previous route.
await page.locator('.product-card').first().click()
```

Cypress has the same problem and the same shape of answer — `.should('be.visible')` or a `{ visible: true }` option.

### The assertion that flips meaning

This is the one to internalise, because a passing test that should fail is worse than a failing test:

```ts
// Before Activity: after navigating away, the heading was gone. Now it may not be.
await page.getByRole('link', { name: 'Settings' }).click()
await expect(page.getByText('Your boards')).toBeHidden()   // correct
await expect(page.getByText('Your boards')).toHaveCount(0)  // may now fail
```

`toBeHidden()` is satisfied by a `display: none` element and by a missing one, which is exactly the semantics you want. `toHaveCount(0)` asserts the element is not in the DOM, which is no longer true after a preserved navigation. If you have assertions written the second way, they will start failing on upgrade for a reason that has nothing to do with the feature under test.

### The state that no longer resets

Activity preserving state is a feature for users and a hazard for tests that assumed a fresh mount. A form the user partially filled, scrolled to, or expanded is still in that condition when they navigate back. A test that navigates away and returns and then asserts on a pristine form is asserting the old behaviour. Decide per test which you mean: assert the preserved state (that is the feature) or force a real reload with `page.reload()` when you genuinely want a fresh mount.

## Running the suite in CI

The Next.js Playwright guide covers the two mechanical requirements: tests run headless by default, and `npx playwright install-deps` installs the system libraries the browsers need on a Linux runner. Everything below that is scale.

### Sharding

Playwright splits a suite across machines with `--shard`, and the shards are combined afterwards from blob reports:

```yaml title=".github/workflows/e2e.yml"
jobs:
  e2e:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --shard=${{ matrix.shard }}/4
        env:
          E2E_USER_EMAIL: ${{ secrets.E2E_USER_EMAIL }}
          E2E_USER_PASSWORD: ${{ secrets.E2E_USER_PASSWORD }}
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: blob-report-${{ matrix.shard }}
          path: blob-report/
          retention-days: 7
```

`fail-fast: false` matters: without it, one shard failing cancels the others and you lose the information about whether the failure was localised or systemic.

Sharding multiplies the cost of your setup project, because each shard runs its own. If authentication is expensive, that is four logins instead of one — usually acceptable, occasionally a reason to seed the storage state as a build artefact instead.

### Retries and what they hide

`retries: 2` in CI and `0` locally is the conventional split, and it is a trade. Retries convert an intermittent failure into a pass, which keeps the pipeline moving and also keeps you from noticing. Playwright reports retried tests as "flaky" rather than "passed", and that count is the number to watch: a suite with a rising flaky count is degrading even while it stays green. Treat a persistently flaky test as a bug in the test or in the app, not as an acceptable cost.

`trace: 'on-first-retry'` is what makes that investigable — the first attempt fails, the retry runs with tracing on, and you get a full recording of the failing conditions without paying for traces on the thousands of tests that passed.

### Artefacts worth keeping

The HTML report with `open: 'never'` so it does not try to launch a browser in CI, the blob reports for merging across shards, and traces. Videos and screenshots-on-failure are useful early in a suite's life and become noise once traces are in place, because a trace contains DOM snapshots you can inspect rather than a video you have to scrub.

## Gotchas

**★ `toHaveCount(0)` after a client-side navigation now fails.**
The previous route is hidden, not unmounted, so the element is still in the document. Use `toBeHidden()`, which is satisfied by both `display: none` and absence, and which is what the assertion meant in the first place.

**★ A click times out on an element that is obviously on the page.**
It is on a hidden route. Playwright waits for actionability and a `display: none` element never becomes actionable, so you get a 30-second timeout rather than a "not found". The locator needs to filter by visibility, or you are on the wrong route than you think.

**★ A CSS-selector locator silently binds to the previous route.**
`page.locator('.task-card').first()` has no visibility filter, so after a navigation it can resolve to a card belonging to the page you left — and the assertion passes against stale content. `getByRole` filters by visibility because it queries the accessibility tree; when you must use a raw locator, add `.filter({ visible: true })`.

**★ A test that navigates away and back and expects a pristine form.**
Activity preserves state deliberately. The form still holds what the user typed. Either assert the preserved state — which is the actual product behaviour — or `page.reload()` when you specifically want a fresh mount.

**★ Assuming `<Activity>` only affects routes.**
The same `display: none` semantics apply to `<Activity>` used directly in your own components for tabs, accordions and expandable panels. A tab panel that is "closed" may still be queryable.

**★ Parsing the `next build` route table in a CI gate.**
It is human-facing output whose vocabulary already changed in 16 — `◐` is new, and the bundle-size columns were removed entirely. A grep-based gate is a gate that will pass vacuously after the next formatting change. Assert on behaviour with navigation tests instead.

**★ Reading `ƒ` on a page route as normal.**
With Cache Components on, `ƒ` means the route had nothing at all to prerender. For a page, that is nearly always a regression — usually a request-time API newly read in a shared layout — not a design decision.

**★ Sharding without `fail-fast: false`.**
The first shard to fail cancels the rest, so you cannot tell a single broken test from a systemic breakage, and the artefacts you would need are never uploaded.

**★ Uploading artefacts only on failure.**
`if: ${{ !cancelled() }}` rather than `if: failure()`, because blob reports from *passing* shards are required to merge a complete report, and because a flaky-but-passed run is exactly the one you want the trace for.

**★ Treating the flaky count as noise.**
Playwright distinguishes "passed" from "flaky". Retries make both green in the pipeline summary. A suite whose flaky count is climbing is losing signal, and the loss is invisible unless someone is watching that number.

**★ Enabling `cacheComponents` and not re-running the full E2E suite.**
This is the upgrade where a large fraction of existing assertions change meaning at once. The failures will look unrelated to the flag — a timeout here, a count assertion there — and the common cause is Activity, not your application.

## Interview questions

**★ What exactly does `cacheComponents` change about the rendering model, and what does it change about the DOM?**
It makes Partial Prerendering the default: every route becomes a static shell prerendered at build time plus dynamic parts that stream in at request time, which is why `experimental.ppr` and `experimental_ppr` were removed as separate switches. Separately, it makes client-side navigation preserve the previous route by setting React's `<Activity>` mode to hidden instead of unmounting, so component state survives a navigation and a return. The second change is the one that affects tests, because hidden content stays in the document with `display: none`.

**★ Why does `getByRole` behave correctly under Activity where a CSS locator does not?**
Because `getByRole` queries the accessibility tree, and the accessibility tree excludes elements hidden with `display: none`. A raw CSS locator queries the DOM, where the hidden route's elements are still present, so it can bind to content from a page the user has left. `getByLabel` and `getByPlaceholder` share the accessibility-tree behaviour; `page.locator()` does not unless you add `.filter({ visible: true })`.

**★ Which assertion should replace `toHaveCount(0)` after a navigation, and why?**
`toBeHidden()`. It is satisfied both by an element that is absent and by one that is present but not visible, which is precisely the claim you meant to make: the user cannot see this. `toHaveCount(0)` asserts something stronger — absence from the document — which used to be true incidentally and is no longer true once routes are preserved.

**★ You enable Cache Components and a dozen unrelated end-to-end tests start timing out on clicks. What is your first hypothesis?**
That the locators are resolving to elements on a hidden, preserved route. Playwright waits for actionability and a `display: none` element never becomes actionable, so a click on a stale match produces a timeout rather than a "not found" error. The triage is to check whether the failing locators are raw CSS or text locators without visibility filtering, and to move them to role-based queries.

**★ How do you test that a route is partially prerendered rather than fully dynamic?**
Not by reading the build table from a script — it is human-facing output whose format has already changed. You test the observable property: that the shell is present and interactive before the dynamic content arrives. That means asserting the shell and the Suspense fallback first and the streamed content second, and for navigation specifically, using the dedicated `instant()` tooling covered in this chapter's pages 10 and 10b, which fails when a route stops delivering its shell ahead of the network.

**★ Why does `ƒ` on a page route deserve investigation under Cache Components?**
Because with Cache Components the default is a spectrum: routes are expected to be `○` or `◐`. A route only falls to `ƒ` when it has nothing to prerender at all. For a page that almost always means a request-time API — `cookies()`, `headers()`, `searchParams` — is being read outside a Suspense boundary, often in a shared layout, which de-opts every descendant. It is the archetypal regression that a code review of the route itself would not catch, because the change was made elsewhere.

**★ What does sharding cost you, and what does `fail-fast: false` buy?**
Sharding costs a full setup project per shard — four shards means four authentication runs — plus the fixed overhead of checkout, install and browser download on each machine. `fail-fast: false` stops the first failing shard from cancelling the others, which preserves the information about whether one test broke or the build did, and ensures every shard's artefacts get uploaded so the merged report is complete.

**★ Retries make CI green. What is the argument against turning them up?**
Retries convert intermittent failures into passes, which hides degradation. Playwright is careful to report a retried-and-passed test as flaky rather than passed, and that count is the health signal — a suite whose flaky count is rising is losing coverage while its pipeline stays green. Two retries with `trace: 'on-first-retry'` is a reasonable operating point: it keeps the pipeline moving and it captures the evidence needed to fix the underlying cause, provided somebody looks at the flaky count.

**★ Why upload artefacts with `if: !cancelled()` rather than `if: failure()`?**
Because a merged report needs the blob reports from the shards that passed as well as the ones that failed, and because the run you most want a trace from is often one that was flaky and therefore ultimately green. Conditioning on failure throws away exactly the evidence you need for the failure mode that is hardest to reproduce.

{/* FOOTER */}
