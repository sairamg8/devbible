---
title: "Every meaningful property of a streaming Next.js app — what arrives first, what the user can act on, what the server actually persisted — is only observable in a browser against a production build, which is why the Playwright config is the most consequential file in your test suite"
sidebar_label: "2 · End-to-end flows with Playwright"
sidebar_position: 2
description: "Why next start and not next dev, the webServer options that matter and the one that is deprecated, the setup project pattern for authentication, web-first assertions versus the manual assertions that never wait, and how to assert on streaming order rather than on a final state."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [How to set up Playwright with Next.js](https://nextjs.org/docs/app/guides/testing/playwright) (lastUpdated 2026-08-25), [Playwright: Web server](https://playwright.dev/docs/test-webserver), [Playwright: Authentication](https://playwright.dev/docs/auth) and [Playwright: Best Practices](https://playwright.dev/docs/best-practices).
> Target: **Next.js 16.3.4** · `@playwright/test` 1.62.1 · Node.js 24.20.0.

**The Playwright config decides what your suite is actually testing, and almost every team gets one line of it wrong. Point `webServer` at `next dev` and you have built a test suite for an environment that prefetches nothing, bundles differently, and prerenders nothing — then shipped a production build it never exercised. The Next.js Playwright guide is explicit about which build to run against, and everything else on this page follows from taking that seriously: authentication has to be established once against a real server, assertions have to retry because a streaming page has no single "done", and the interesting assertion about a streaming route is about ordering, not about the final DOM.**

## Run against the production build

The Next.js guide's recommendation is one sentence and it is the whole basis of a trustworthy suite:

> *"We recommend running your tests against your production code to more closely resemble how your application will behave."*

The differences are not cosmetic. `next dev` compiles on demand, does not prerender, and does not prefetch. `next build` classifies every route into the table you see at the end of the build — `○` static, `◐` partially prerendered, `●` SSG, `ƒ` dynamic — and `next start` serves those artefacts. A test against the dev server cannot observe which classification a route got, and classification is precisely what determines what the user sees first.

That distinction is sharp enough that the chapter treats instant-navigation assertions separately: see [10 · The instant() Playwright helper](10-the-instant-playwright-helper.md) for the `instant()` scope, and [10b · Instant tests in CI](10b-instant-tests-in-ci-and-regression-causes.md) for why the dev server is the one environment where the property being tested does not exist.

## The `webServer` block, option by option

```ts title="playwright.config.ts"
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
})
```

Four of those lines are load-bearing and are the ones people get wrong.

**`url`, not `port`.** `port` is deprecated. `url` is better anyway, because Playwright polls it and treats a 2xx, 3xx, 400, 401, 402 or 403 response as "ready" — so an app whose root redirects to a login page still signals readiness correctly, where a bare port check only proves something accepted a TCP connection.

**`reuseExistingServer: !process.env.CI`.** Locally this attaches to the dev server you already have running instead of fighting it for the port. In CI it is `false`, which makes Playwright *throw* if something is already listening — that is the desired behaviour, because a leftover process from a previous job would otherwise silently serve your tests the wrong build.

**`timeout`.** Defaults to 60 seconds. `npm run build && npm run start` on any real app takes longer than that, and the failure looks like a server that never came up rather than a build still in progress. Raise it, or build in a separate CI step and let `webServer` only run `next start`.

**`baseURL`.** With it set, `page.goto('/')` works and your specs are portable to a deployed preview URL by changing one environment variable. Without it every spec hardcodes `http://localhost:3000` and none of them can run against staging.

One more, easy to miss: `webServer.env` inherits `process.env` and adds `PLAYWRIGHT_TEST=1`. That is a usable signal if the app needs to know it is under test — to disable a third-party analytics script, for example.

## Authenticate once, in a setup project

Logging in inside `beforeEach` is correct and slow: every test pays a full form submission and redirect chain. Playwright's setup-project pattern pays it once and reuses the resulting browser state.

```ts title="e2e/auth.setup.ts"
import { test as setup, expect } from '@playwright/test'
import path from 'node:path'

const authFile = path.join(__dirname, '../playwright/.auth/user.json')

setup('authenticate', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL!)
  await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await page.waitForURL('/boards')
  await expect(page.getByRole('heading', { name: 'Your boards' })).toBeVisible()

  await page.context().storageState({ path: authFile })
})
```

The two lines after the click are not decoration. Login flows commonly set cookies across a chain of redirects, so saving state immediately after the click can capture a half-finished session. `waitForURL` establishes that the chain finished; the visible-heading assertion establishes that the destination actually rendered as an authenticated user. Save state only after both.

`playwright/.auth/` must be gitignored. The file contains live session cookies — anyone who has it can impersonate that account.

```bash
mkdir -p playwright/.auth
printf '\nplaywright/.auth\n' >> .gitignore
```

### When a shared account is the wrong pattern

The shared-state approach assumes your tests can all run simultaneously as the same user without interfering. That holds for read-heavy suites. It breaks the moment two tests mutate the same server-side state — one asserts the board list is empty while another is creating a board in it. When that happens you need either a worker-scoped account (a fixture that provisions a user per parallel worker and saves state per worker) or per-test data namespacing. Reaching for `test.describe.serial` instead trades the flake for a suite that no longer parallelises.

## Web-first assertions, and the one that never waits

Playwright locators auto-wait: before clicking, they check the element is attached, visible, stable and enabled. Assertions built on them retry until the condition holds or the timeout expires. That retry is what makes a suite against an asynchronous UI stable.

```ts
// Retries until the element is visible, or fails after the assertion timeout.
await expect(page.getByText('Task created')).toBeVisible()

// Checks once, right now, and returns immediately.
expect(await page.getByText('Task created').isVisible()).toBe(true)
```

The second form is the single most common source of flake in a Next.js E2E suite, because it is the form that looks most like a unit test. It does not wait a single millisecond: it samples the DOM at the instant it runs. Against a streaming page — where content arrives in pieces over hundreds of milliseconds — it will be right sometimes and wrong sometimes, on a schedule set by CI machine load.

The `await` position is the tell. `await expect(locator)...` is web-first. `expect(await locator...)` is not.

The same distinction governs locators: prefer `getByRole`, `getByLabel`, `getByPlaceholder` and `getByText` over CSS chains. A class name is an implementation detail that a designer can change without touching behaviour; a role and an accessible name are the contract with the user. And chaining narrows without brittleness:

```ts
await page
  .getByRole('listitem')
  .filter({ hasText: 'Ship syllabus' })
  .getByRole('button', { name: 'Complete' })
  .click()
```

## Testing streaming: the assertion is about order

A route that streams has two observable phases. The prerendered shell arrives first; the parts wrapped in `<Suspense>` arrive later. If your test navigates and then asserts that the fully-populated page is visible, it passes whether or not streaming works — because Playwright's retrying assertion happily waits out the entire stream and then confirms the end state. That test would also pass on a fully blocking route. It is not testing streaming.

The property worth testing is that the shell is usable *before* the slow part arrives. Express it as an assertion on the fallback, then on the content:

```ts title="e2e/board-streaming.spec.ts"
import { test, expect } from '@playwright/test'

test('board shell renders before the activity feed resolves', async ({ page }) => {
  await page.goto('/boards/demo')

  // The shell: prerendered, no data dependency.
  await expect(page.getByRole('heading', { name: 'Demo board' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'New task' })).toBeEnabled()

  // The boundary is still showing its fallback at this point.
  await expect(page.getByRole('status', { name: 'Loading activity' })).toBeVisible()

  // And then the streamed content replaces it.
  await expect(page.getByRole('list', { name: 'Recent activity' })).toBeVisible()
  await expect(page.getByRole('status', { name: 'Loading activity' })).toBeHidden()
})
```

Give the fallback an accessible name — `role="status"` with an `aria-label`, or a visually-hidden heading — precisely so that it is assertable. A fallback that is an unlabelled spinner div cannot be distinguished from any other spinner on the page, and you are back to CSS selectors.

Two honest caveats. First, this test has a race in it: if the streamed content arrives faster than Playwright evaluates the fallback assertion, the fallback assertion fails. That is a real risk against a fast local database and a real reason to make the fallback assertion the *first* thing after navigation, and to consider deliberately slowing the boundary's data source in the test environment via a route interception. Second, asserting on the *absence* of the shell being blocked — that is, "this navigation was instant" — is a different property with dedicated tooling, and it is covered in [10 · The instant() Playwright helper](10-the-instant-playwright-helper.md).

### Controlling the slow half

`page.route` lets you own the timing rather than hope for it, and it is also the documented way to stop testing third-party services you do not control:

```ts
test('shows the fallback while the feed is in flight', async ({ page }) => {
  let release: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })

  await page.route('**/api/activity', async (route) => {
    await gate
    await route.fulfill({ status: 200, body: JSON.stringify([]) })
  })

  await page.goto('/boards/demo')
  await expect(page.getByRole('status', { name: 'Loading activity' })).toBeVisible()

  release!()
  await expect(page.getByRole('list', { name: 'Recent activity' })).toBeVisible()
})
```

This only intercepts requests the *browser* makes. A Server Component fetching on the server is invisible to `page.route`, because that request never leaves the server. That asymmetry catches people out constantly: intercepting works for client-side data fetching and for Route Handlers the browser calls, and does nothing at all for server-side `fetch`. To control server-side timing you need a seam on the server — a test-only environment variable, a fake data source selected by config, or a fixture database you can make slow.

## Gotchas

**★ Pointing `webServer` at `next dev` and believing the suite covers production.**
The dev server does not prerender and does not prefetch, so every claim about what arrives first is untested. Build and start, or run against a deployed preview. The Next.js guide names the production build explicitly.

**★ The default `webServer.timeout` of 60 seconds is shorter than a real build.**
`command: 'npm run build && npm run start'` regularly exceeds it, and the error reads as "server did not start" rather than "build still running". Raise it, or split the build into its own CI step and let `webServer` run only `next start`.

**★ `reuseExistingServer: true` in CI serves your tests somebody else's build.**
A leftover server from a previous job or a parallel matrix leg will be reused silently, and the suite will pass against stale code. Tie it to `!process.env.CI` so CI throws on a port collision instead.

**★ `expect(await locator.isVisible()).toBe(true)` does not wait.**
It samples once. On a streaming page that is a coin flip weighted by machine load. Move the `await` outside: `await expect(locator).toBeVisible()`.

**★ Saving `storageState` immediately after clicking Sign in captures a partial session.**
Auth flows often set cookies across several redirects. Wait for the final URL and assert on a post-login element before calling `storageState`, or your saved state will work locally and fail under CI latency.

**★ Committing `playwright/.auth/user.json`.**
It contains live session cookies for a real account. Gitignore the directory before the first run, not after — a file committed once stays in history.

**★ A shared authenticated account plus `fullyParallel` equals cross-test interference.**
Two tests mutating the same user's data will collide non-deterministically. Either provision an account per worker, or namespace every fixture the tests create, or accept serial execution — but pick deliberately rather than discovering it as flake.

**★ Asserting the final populated state and calling it a streaming test.**
A retrying assertion waits out the whole stream, so the test passes identically against a fully blocking route. Assert on the fallback first, then on the content, and only then have you constrained the ordering.

**★ An unlabelled spinner cannot be asserted on.**
If the fallback has no role and no accessible name, the only handle is a CSS class — which is exactly the brittleness you were avoiding. Give fallbacks `role="status"` and a name; it helps assistive technology for the same reason it helps the test.

**★ `page.route` cannot intercept a server-side `fetch`.**
Interception hooks the browser's network stack. A Server Component's `fetch` runs on the server and never appears there. To control server-side data you need a server-side seam.

**★ `forbidOnly` missing means one stray `test.only` silently green-lights a pull request.**
`test.only` skips every other test in the file. Without `forbidOnly: !!process.env.CI`, CI reports a pass on a single test. Set it.

**★ Forgetting `npx playwright install-deps` in a Linux CI image.**
Browsers download, then fail to launch on missing system libraries, and the error is about a shared object rather than about Playwright. Install the OS dependencies as a distinct step.

**★ `trace: 'on'` on every test produces gigabytes of artefacts.**
`on-first-retry` gives you a trace for exactly the runs you need to debug and nothing for the runs that passed.

## Interview questions

**★ Why does the Next.js documentation recommend running Playwright against a production build, and what specifically breaks if you do not?**
Because `next dev` is a different application. It compiles routes on demand, does not prerender, and does not prefetch, so the entire class of properties concerning what the user has before the network answers is unobservable there. `next build` classifies routes — static, partially prerendered, SSG, dynamic — and `next start` serves those artefacts. A suite against dev can still catch functional regressions, but it cannot catch a route that silently de-opted from prerendered to request-time rendering, which is one of the most common production-only regressions in an App Router app.

**★ Why is `url` preferable to `port` in the `webServer` block, beyond `port` being deprecated?**
Because Playwright polls the URL and treats 2xx, 3xx, 400, 401, 402 and 403 as ready. That correctly handles an app whose root redirects to login or returns 401 for anonymous users. A port check only proves that something bound the socket, which can be true well before the server can serve a request.

**★ What is the difference between `await expect(locator).toBeVisible()` and `expect(await locator.isVisible()).toBe(true)`?**
The first is a web-first assertion: it retries until the condition holds or the assertion timeout expires. The second evaluates `isVisible()` once and asserts on the boolean, so it never waits. Against any asynchronous UI — and a streaming page is asynchronous by construction — the second form is a race, and it fails intermittently in proportion to how loaded the CI machine is. The position of the `await` is the entire difference.

**★ Explain the setup-project pattern and why the wait before `storageState` matters.**
A project matched to `*.setup.ts` runs first and is declared as a `dependency` of the real test projects, which consume its output via `storageState`. It performs the login once and writes the browser's cookies and storage to a file, so every subsequent test starts already authenticated instead of paying a form submission each time. The wait matters because login is often a chain of redirects that set cookies at different steps; capturing state before the chain completes produces a file that is missing a cookie, and the failure surfaces later as a mysteriously unauthenticated test.

**★ When does a single shared authenticated account stop being the right approach?**
As soon as tests mutate server-side state that other tests read. If one test asserts the board list is empty while another creates a board, running them in parallel as the same user is a race. The options are a worker-scoped fixture that provisions an account per parallel worker, per-test data namespacing so tests cannot see each other's rows, or serialising — and serialising surrenders the parallelism that made the suite fast.

**★ You have a test that navigates to a streaming route and asserts the populated content is visible. Why is that not a test of streaming?**
Because Playwright's assertion retries. It will simply wait until the stream completes and then find the content, which is exactly what it would do against a route that blocked entirely and rendered everything at once. The test constrains the end state and says nothing about ordering. To test streaming you assert the shell and the fallback are present first, and only then that the content replaced the fallback.

**★ How would you make a streaming assertion deterministic rather than racing the server?**
Take control of the slow half. For browser-issued requests, `page.route` lets you hold the response behind a promise you release explicitly, so the fallback is guaranteed to be observable. For server-side data fetching that is not possible — `page.route` hooks the browser's network stack and a Server Component's `fetch` never touches it — so you need a seam on the server: a test-only configuration that selects a slow or gated data source.

**★ Why prefer `getByRole` over a CSS selector, given that both find the element?**
Because the CSS class is an implementation detail with no contract behind it — a styling refactor changes it and breaks a test that was asserting nothing about behaviour. A role plus an accessible name is the contract with the user and with assistive technology, so a test written against it fails only when something a user would notice has changed. It has a second benefit: a component you cannot query by role is usually a component a screen reader user cannot operate.

**★ What is `trace: 'on-first-retry'` buying you?**
A full recording — DOM snapshots, network, console, actions — for exactly the runs that failed once and are being retried, and nothing for the runs that passed. `trace: 'on'` gives you the same debugging power plus an artefact for every passing test, which on a large suite is gigabytes of storage per run for data nobody will open.

{/* FOOTER */}
