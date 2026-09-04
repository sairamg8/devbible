---
title: "The end-to-end half of the milestone is two flows, and both are harder than they look for the same reason — under Cache Components a page has no single moment of being loaded and the route you navigated away from is still in the DOM"
sidebar_label: "5b · The Playwright flows"
sidebar_position: 19
description: "Two authenticated storage states because one cannot test tenant isolation, the auth flow acceptance criteria, board CRUD including how to assert an optimistic update actually rendered, proving revalidateTag end-to-end, and the phase gate for the whole chapter."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [How to set up Playwright with Next.js](https://nextjs.org/docs/app/guides/testing/playwright) (lastUpdated 2026-08-25), [Playwright: Authentication](https://playwright.dev/docs/auth), [Playwright: Best Practices](https://playwright.dev/docs/best-practices), [How Next.js preserves UI state with Activity](https://nextjs.org/docs/app/guides/preserving-ui-state) (2026-07-01) and [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) (2026-06-17). Continues [5 · Milestone: SprintDesk test suite](05-project-milestone-sprintdesk-test-suite.md). Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4** · `@playwright/test` **1.62.1** · Node.js 24.20.0.

**The milestone names two end-to-end flows: authentication and board CRUD. Neither is a matter of clicking through the happy path, and the reasons are specific to this stack. Testing a multi-tenant application's authentication requires *two* authenticated sessions, because the interesting assertion is that one cannot see the other's data — and the standard Playwright pattern of one shared account cannot express it. Testing board CRUD requires deciding what "the task appeared" means when the appearance is optimistic, the reconciliation is a Server Action, and the previous route is still sitting in the DOM with `display: none`.**

## The suite shape

Authentication is established once, in a setup project, and reused as storage state. The configuration mechanics — `webServer` pointing at `next start` rather than `next dev`, `baseURL`, the setup-project `dependencies` array — are [2 · End-to-end flows with Playwright](02-end-to-end-flows-with-playwright-testing-streaming-and-ppr-b.md). What this milestone changes is that there is more than one state:

```ts
// playwright.config.ts — projects section only; see chunk 2 for the rest
projects: [
  { name: 'setup', testMatch: /.*\.setup\.ts/ },
  {
    name: 'member-a',
    testMatch: /.*\.member-a\.spec\.ts/,
    dependencies: ['setup'],
    use: { storageState: 'playwright/.auth/member-a.json' },
  },
  {
    name: 'member-b',
    testMatch: /.*\.member-b\.spec\.ts/,
    dependencies: ['setup'],
    use: { storageState: 'playwright/.auth/member-b.json' },
  },
  {
    name: 'anonymous',
    testMatch: /.*\.anon\.spec\.ts/,
  },
]
```

🔴 `playwright/.auth` must be gitignored. Playwright's own warning is unambiguous: *"The browser state file may contain sensitive cookies and headers that could be used to impersonate you or your test account."*

```ts
// tests/auth.setup.ts
import { test as setup, expect } from '@playwright/test'

const members = [
  { file: 'playwright/.auth/member-a.json', email: 'a@sprintdesk.test', team: 'Team A' },
  { file: 'playwright/.auth/member-b.json', email: 'b@sprintdesk.test', team: 'Team B' },
]

for (const member of members) {
  setup(`authenticate ${member.email}`, async ({ page }) => {
    await page.goto('/signin')
    await page.getByLabel('Email').fill(member.email)
    await page.getByLabel('Password').fill(process.env.E2E_PASSWORD!)
    await page.getByRole('button', { name: 'Sign in' }).click()

    // Wait for the FINAL url, not the first navigation — a login flow can set
    // cookies across several redirects, and storageState written too early is
    // an unauthenticated state that fails every test with no useful message.
    await page.waitForURL('/teams/**/board')
    await expect(page.getByRole('heading', { name: member.team })).toBeVisible()

    await page.context().storageState({ path: member.file })
  })
}
```

Playwright's authentication guide is explicit about that comment:

> *"Wait until the page receives the cookies … Sometimes login flow sets cookies in the process of several redirects. Wait for the final URL to ensure that the cookies are actually set."*

And on why one shared account is not enough here — the guide names two disqualifying conditions, and SprintDesk hits both: tests mutate server-side state, and the property under test is per-account.

## Flow 1 — authentication

- [ ] An anonymous visit to `/teams/:id/board` redirects to sign-in and preserves the intended destination.
- [ ] Signing in from that redirect lands on the originally requested board, not on a generic dashboard.
- [ ] The session survives a full page reload and a client-side navigation.
- [ ] Sign-out clears the session: the next visit to a protected route redirects again, and the back button does not restore an authenticated view.
- [ ] 🔴 **`member-b` requesting `member-a`'s board gets a 404 or a redirect, never a rendered board with a permissions message.** A "you do not have access" page that renders the team name has already leaked the team name.
- [ ] A tampered or expired session cookie is treated as anonymous rather than producing a 500.

The fifth criterion is the end-to-end half of the tenancy invariant from [5](05-project-milestone-sprintdesk-test-suite.md). The unit test proves the query is scoped; this proves the route enforces it. Neither implies the other — a correctly scoped query behind a route that never calls it is still a leak.

```ts
// tests/tenant-isolation.member-b.spec.ts
import { expect, test } from '@playwright/test'

test('member B cannot open member A’s board', async ({ page }) => {
  const response = await page.goto(`/teams/${process.env.E2E_TEAM_A_ID}/board`)
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Team A' })).toHaveCount(0)
})
```

## Flow 2 — board CRUD

### The two things that make assertions subtle

**Assertions must retry.** Playwright's own guidance is that web-first assertions wait and manual ones do not — `expect(await locator.isVisible()).toBe(true)` *"won't wait a single second, it will just check the locator is there and return immediately."* Under Partial Prerendering the shell arrives before the data, so a manual assertion runs against the shell and fails, or worse, passes against a stale value.

**Hidden content is still in the document.** With Cache Components on, React `<Activity>` preserves the previous route rather than unmounting it:

> *"Hidden Activity content has `display: none` but remains in the document. This applies both to routes preserved by Cache Components and to content you hide with `<Activity>` directly."*

with three named consequences — *"DOM queries can find hidden elements."*, *"Interactions with hidden elements fail or timeout."*, *"Assertions may match hidden content."*

The mitigation is a locator choice, not a wait. Role-based locators query the accessibility tree, which excludes hidden elements:

> *"In Playwright, `getByRole` queries automatically filter by visibility."*

So `getByRole`, `getByLabel` and `getByPlaceholder` are safe; `page.locator('.task-card')` is not, and needs `.filter({ visible: true })`. The full treatment is [2b · PPR, Activity and CI](02b-testing-ppr-activity-and-playwright-in-ci.md); the criterion for this milestone is simply that no CSS-class locator appears in the suite without a visibility filter.

### Create

```ts
// tests/board-crud.member-a.spec.ts
import { expect, test } from '@playwright/test'

test('creating a task persists it through a full reload', async ({ page }) => {
  await page.goto(`/teams/${process.env.E2E_TEAM_A_ID}/board`)

  const title = `write the retro ${Date.now()}`
  await page.getByRole('button', { name: 'New task' }).click()
  await page.getByLabel('Title').fill(title)
  await page.getByRole('button', { name: 'Create' }).click()

  const card = page.getByRole('article', { name: title })
  await expect(card).toBeVisible()

  // 🔴 The assertion that matters. A card rendered from client state proves
  // nothing about the write or about revalidateTag. Reload and look again.
  await page.reload()
  await expect(page.getByRole('article', { name: title })).toBeVisible()
})
```

The reload is the whole test. Without it, a Server Action that threw after rendering an optimistic card still passes.

### Update — and how to prove the optimistic path actually ran

Drag-and-drop moves a task between columns optimistically and reconciles against a Server Action. A test that only asserts the final state passes even if the optimistic update never rendered — the user would see a half-second of nothing and the test would be green. To assert the optimistic state you have to make it observable, by delaying the action's response:

```ts
test('moving a task shows optimistically, then reconciles', async ({ page }) => {
  await page.goto(`/teams/${process.env.E2E_TEAM_A_ID}/board`)

  // Hold the Server Action's POST open so the optimistic frame is observable.
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/teams/**/board', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    await held
    await route.continue()
  })

  const card = page.getByRole('article', { name: 'write the retro' })
  await card.dragTo(page.getByRole('region', { name: 'In progress' }))

  // Optimistic: the card is already in the target column, request still open.
  await expect(page.getByRole('region', { name: 'In progress' })
    .getByRole('article', { name: 'write the retro' })).toBeVisible()

  release()

  // Reconciled: still there after the server responds and the tag revalidates.
  await expect(page.getByRole('region', { name: 'In progress' })
    .getByRole('article', { name: 'write the retro' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('region', { name: 'In progress' })
    .getByRole('article', { name: 'write the retro' })).toBeVisible()
})
```

The same shape gives you the rollback test: instead of releasing the request, fulfil it with a 500 and assert the card returns to its original column and an error is announced.

### Delete, and the rest of the criteria

- [ ] Creating a task persists across a reload (the test above).
- [ ] Editing a title updates optimistically and survives a reload.
- [ ] Moving a task between columns shows the optimistic frame, reconciles, and survives a reload.
- [ ] A failed move rolls back visibly and surfaces an error the user can read.
- [ ] Deleting a task removes it and a reload confirms it; an undo, if the product has one, restores it.
- [ ] Board filters in the URL round-trip: applying a filter changes the URL, and opening that URL directly produces the same board.
- [ ] A garbage filter value (`?status=purple`) renders the default board rather than an error page ([3d](03d-zod-contract-tests-at-the-boundaries.md)).
- [ ] Navigating away from the board and back does not match a stale card from the hidden previous route.

That last one is worth writing deliberately, because it is the assertion that catches an Activity regression: navigate board → settings → board, then assert the count of a task title is exactly one.

## The layers this flow hands off to

- **Streaming order** — asserting that the shell arrives before the board, rather than asserting a final state, is [2](02-end-to-end-flows-with-playwright-testing-streaming-and-ppr-b.md).
- **Instant navigation** — that a click renders meaningful UI before the network answers is a different property with a purpose-built helper, `instant()` from `@next/playwright`: [10](10-the-instant-playwright-helper.md), and getting those tests running against a production build in CI is [10b](10b-instant-tests-in-ci-and-regression-causes.md).
- **Sharding, retries, artefacts and the flake budget** — [2b](02b-testing-ppr-activity-and-playwright-in-ci.md).
- **Getting the suite into the monorepo task graph**, so a change to the app invalidates the e2e cache — [4d](04d-turborepo-in-ci-and-affected-filtering.md).

## What the end-to-end layer cannot cover

- **A query that returns the wrong rows but renders plausibly.** If `listTasks` drops the tenancy predicate *and* both teams have similar-looking data, the board renders and the test passes. Only the two-account isolation test and the data-layer predicate test catch it, and they catch different halves.
- **Anything without a UI affordance.** A background digest job, a webhook handler, a cron.
- **Races between two users.** One browser context per test by default; concurrent edits need a deliberately-written two-context test and are usually better covered at the data layer with an optimistic-concurrency assertion.
- **Performance.** A test that passes in 400 ms and a test that passes in 4 s are both green.
- **Correctness of what the user sees when it is plausible but wrong** — a date rendered in the wrong timezone, a count off by one. Those are mapper tests.

## Phase gate

You are done with chapter 13 when, for SprintDesk:

1. `next typegen && tsc --noEmit` passes with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `verbatimModuleSyntax` on, and `typedRoutes` catching a deliberately broken link.
2. Every request boundary parses through a schema, and the env schemas fail the build when a variable is missing.
3. The unit suite runs with no database and includes the tenancy-predicate test.
4. Every Server Action has its shape, authorization and effect tests.
5. The Playwright suite runs against `next start`, with at least two authenticated storage states, and covers both flows above including the reload assertions.
6. `turbo run lint type-check test build --affected` on a no-op commit executes zero tasks.
7. Each layer's "cannot cover" list is written down somewhere the team reads.

## Gotchas

**★ Symptom: every authenticated test fails with a redirect to sign-in, and the setup project passed.** Cause: `storageState` was written before the login flow finished setting cookies. The Playwright docs warn that a login can set cookies across several redirects. Fix: `await page.waitForURL(<final destination>)` and assert a post-login element before calling `storageState`.

**★ Symptom: two tests using the same account interfere when run in parallel.** Cause: they mutate the same server-side data, which the Playwright auth guide names as a condition where shared-account state is inappropriate. Fix: one account per project, one team per account — the same tenancy-based isolation the unit layer uses.

**★ Symptom: a test asserts a task card and matches one on the page the user already left.** Cause: Activity keeps the previous route in the document with `display: none`, and *"Assertions may match hidden content."* Fix: `getByRole` / `getByLabel`, which query the accessibility tree and exclude hidden elements; for any CSS locator, `.filter({ visible: true })`.

**★ Symptom: an interaction times out on an element the test can see in the DOM snapshot.** Cause: the element is inside hidden Activity content — *"Interactions with hidden elements fail or timeout."* Fix: scope the locator to the visible route first (`page.getByRole('main')` and chain from there), rather than searching the whole page.

**★ Symptom: the optimistic update test passes even after the optimistic path is deleted.** Cause: the test only asserts the final state, which arrives from the server regardless. Fix: hold the Server Action's request open with `page.route`, assert the intermediate state, then release — as above. If you cannot observe a state, you are not testing it.

**★ Symptom: a create test passes and the task was never written.** Cause: the assertion matched the optimistically-rendered card. Fix: `await page.reload()` and assert again. This also happens to test that `revalidateTag` ran with the right tag, which nothing else in the suite covers.

**★ Symptom: an isolation test passes because the other team's board happens to be empty.** Cause: the assertion was "no tasks visible", which is true for an empty board and for a working access check alike. Fix: assert on the response status and on the absence of an identifying element that would only exist if the board rendered — and seed team A with data so the negative is meaningful.

**★ Symptom: the suite is green against `next dev` and finds nothing.** Cause: the dev server does not prefetch, bundles differently and prerenders nothing, so PPR, Activity and instant-navigation behaviour are all absent. Fix: `webServer` pointing at a production build, per [2](02-end-to-end-flows-with-playwright-testing-streaming-and-ppr-b.md). Every property this milestone claims to test exists only in `next start`.

**★ Symptom: after a change to the app, the e2e job hits cache and reports the previous run.** Cause: the Playwright package does not depend on the app, so the app's files are not in the task's hash. Fix: the `workspace:*` dependency plus `dependsOn: ["^build"]` from [4d](04d-turborepo-in-ci-and-affected-filtering.md).

**★ Symptom: `playwright/.auth/*.json` shows up in a pull request diff.** Cause: it is not gitignored. Fix: gitignore it and rotate the test credentials — the file contains cookies that can impersonate the account, which is exactly what the Playwright docs warn about.

## Interview questions

**★ Why does a multi-tenant app need more than one authenticated storage state?**
Because the most valuable end-to-end assertion in a multi-tenant system is negative: this account cannot reach that account's data. With a single shared session there is no second identity to make the request, so the property is unexpressible and the suite silently omits it. The Playwright docs also name two conditions where a shared account is inappropriate — tests that mutate server state, and browser- or account-specific behaviour — and a task board hits both. One project per account, each with its own storage state and its own team, solves isolation and parallelism at once.

**★ How do you test an optimistic update without asserting the thing that would happen anyway?**
Make the intermediate state observable by controlling the timing. Intercept the Server Action's request with `page.route`, hold it open, assert that the UI has already moved the card, then release the request and assert the reconciled state, then reload and assert persistence. Three assertions, three distinct claims: the optimistic render happened, the reconciliation did not undo it, and the write reached the database. A test that only makes the third claim passes on a build where optimistic updates were removed entirely.

**★ Why is `page.reload()` the most important line in a CRUD test?**
Because everything before it can be satisfied by client state. React rendered the new card optimistically; the card is visible; the assertion passes. Whether the Server Action succeeded, whether the row was written with the right team scope, and whether `revalidateTag` invalidated the cached board are all invisible until something re-reads from the server. The reload is what converts a rendering assertion into an end-to-end one, and it is also the cheapest available test of the cache-revalidation path.

**★ Cache Components is enabled and half the existing suite starts behaving oddly. What changed?**
Two things at once. Partial Prerendering became the default, so a route is now a prerendered shell plus streamed dynamic content, and there is no single moment at which the page is "loaded" — manual assertions that do not retry now race the stream. And client navigation stopped unmounting the previous route: React `<Activity>` hides it with `display: none`, so it is still in the document and still matches DOM queries. The second is the one that breaks previously-passing tests, and the fix is locator discipline — role-based queries filter by visibility, CSS queries do not.

**★ Your end-to-end suite is green and a customer saw another customer's tasks. How is that possible?**
Because a board that renders plausibly is indistinguishable, to a browser test, from a board that renders correctly. If the tenancy predicate is missing from a query, the page still renders tasks; the test asserts that tasks appear, and they do. The failure is only detectable by an assertion that names the *other* tenant's data and requires it to be absent, which needs a second authenticated identity and seeded data on both sides. This is the clearest case in the chapter of why each layer must state what it cannot see: the data-layer test proves the predicate exists, the E2E test proves the route enforces it, and only both together cover the failure.

**★ What belongs in the E2E suite and what should be pushed down a layer?**
Push down anything whose correctness can be decided without a browser — mapping, ordering, formatting, validation, authorization logic. Keep in E2E the things that only exist in a real browser against a production build: navigation, streaming order, prefetching and instant navigation, optimistic update and rollback, session handling, and the negative cross-tenant assertions. The test is not "could this be written in Playwright" — almost anything could — but "does running it in a browser tell me something a cheaper layer cannot".

---

← [Milestone: the SprintDesk test suite](05-project-milestone-sprintdesk-test-suite.md) · [Chapter 13 overview](01-explanation.md) · Next → [Chapter 14 · Agent-driven development](../14-agent-driven-development/01-explanation.md)
