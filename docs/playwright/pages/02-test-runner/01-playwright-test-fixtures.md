---
title: "Test Runner: `@playwright/test`, Built-In Fixtures & the Projects Matrix"
sidebar_label: "Test Runner"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Playwright documentation —
> [Test fixtures](https://playwright.dev/docs/test-fixtures) (built-in fixture table, worker scope,
> automatic fixtures, fixture timeouts) and [Timeouts](https://playwright.dev/docs/test-timeouts).
> Documentation-validated; **no sandbox run** — `@playwright/test` is not installed in this
> checkout, so nothing here is a runtime probe. The track carries **no pinned version**
> (`policy: latest`); playwright.dev publishes only the current release.
> Validated: 2026-09-06 · claims + output provenance · session 4e8d4393

# 🎭 Test Runner: `@playwright/test`, Built-In Fixtures & the Projects Matrix

## 1. Under-The-Hood Mechanics

`@playwright/test` structures tests around a **fixture-based dependency injection system** — rather than manually creating a browser/context/page in every test's setup code, tests declare which fixtures they need as destructured parameters, and the runner provides them, already initialized and ready.

```typescript
test('my test', async ({ page }) => { ... });
//                        │
//                        └── the `page` FIXTURE — Playwright creates a browser context + page,
//                              navigates nowhere yet, and hands it to this test, ALREADY torn down
//                              automatically after the test finishes — no manual setup/teardown code needed
```

### Built-In Fixtures
`page`, `context`, `browser`, `request` (for pure API testing, see the [API testing doc](../13-api-testing/01-request-fixture.md)) are provided automatically — each test gets its own fresh instance per the isolation rules covered in the [core architecture doc](../01-core-architecture/01-browser-automation-model.md).

### `test.extend()`: Custom Fixtures
```typescript
const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.fill('#username', 'testuser');
    await page.click('button[type=submit]');
    await use(page); // hands the LOGGED-IN page to the test
    // (cleanup code, if any, goes AFTER the use() call)
  },
});
```
Custom fixtures let common setup logic (authentication, seeded test data, a page-object instance) be defined **once** and reused by simply declaring it as a parameter — every test needing an authenticated page destructures `{ authenticatedPage }` instead of repeating the login flow inline.

### The `projects` Config: One Suite, Many Environments
Rather than duplicating test files per browser/device combination, a single test suite runs against every configured `projects` entry (different browsers, different viewport sizes, different device emulations) — the **same test code**, executed once per project, is what makes cross-browser/cross-device coverage a configuration concern rather than a test-authoring burden.

---

## 2. Real-World Engineering Scenario

**Scenario**: Every Test File Duplicating the Same Login Flow, Until a Custom Fixture Existed.
Dozens of test files each began with the same four lines: navigate to `/login`, fill credentials, submit, wait for redirect — repetitive, and a maintenance burden the moment the login flow itself changed (every single test file needed updating). Introducing an `authenticatedPage` custom fixture via `test.extend()` collapsed that repeated setup into a single, shared definition — every test needing to start from a logged-in state simply destructured `{ authenticatedPage }` as its page fixture, and a future login-flow change only needed updating in one place.

---

## 3. Production-Grade Code Example

```typescript
// fixtures.ts — custom fixtures extending the base test
import { test as base, expect } from '@playwright/test';

type MyFixtures = {
  authenticatedPage: import('@playwright/test').Page;
};

export const test = base.extend<MyFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill('testuser');
    await page.getByLabel('Password').fill('testpass');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('/dashboard');
    await use(page); // the test receives the ALREADY-LOGGED-IN page
  },
});

export { expect };
```

```typescript
// checkout.spec.ts — using the custom fixture, no repeated login boilerplate
import { test, expect } from '../fixtures';

test.describe('Checkout flow', () => {
  test('completes a purchase', async ({ authenticatedPage: page }) => {
    await page.goto('/cart');
    await page.getByRole('button', { name: 'Checkout' }).click();
    await expect(page.getByText('Order confirmed')).toBeVisible();
  });
});
```

```typescript
// playwright.config.ts — the projects matrix, running the SAME suite across browsers and viewports
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 13'] } }, // SAME tests, mobile viewport + WebKit engine
  ],
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Repeating Setup Logic Inline Instead of Extracting a Custom Fixture
```typescript
// ❌ REPETITIVE: the same login flow duplicated across dozens of test files — a maintenance
// burden the moment the login flow itself needs to change
test('test A', async ({ page }) => {
  await page.goto('/login'); /* ...repeated login steps... */
  await page.goto('/feature-a');
});

// ✅ CORRECT: extract shared setup into a custom fixture, used consistently across all tests needing it
test('test A', async ({ authenticatedPage: page }) => { await page.goto('/feature-a'); });
```

### ⚠️ Pitfall 2: Forgetting Fixture Cleanup Code Must Go AFTER `use()`
```typescript
// ❌ WRONG: cleanup code placed BEFORE use() runs before the test even executes, not after —
// this doesn't actually clean up anything post-test
const test = base.extend({
  tempFile: async ({}, use) => {
    const path = createTempFile();
    await deleteTempFile(path); // ❌ runs IMMEDIATELY, before the test uses the file at all
    await use(path);
  },
});

// ✅ CORRECT: cleanup logic belongs AFTER the use() call — it runs once the TEST has finished
const test2 = base.extend({
  tempFile: async ({}, use) => {
    const path = createTempFile();
    await use(path); // test runs HERE, using `path`
    await deleteTempFile(path); // cleanup runs AFTER the test completes
  },
});
```

### ⚠️ Pitfall 3: Using a Worker-Scoped Fixture Where Test-Scoped Isolation Was Actually Needed
Fixtures can be scoped to the worker (created once, shared across every test in that worker process) or left at the default test scope (fresh per test) — **the worker form requires the tuple syntax shown in the gotchas below, not a bare option object** — using worker scope for something that should genuinely be fresh per test (like an authenticated page with test-specific state) reintroduces the exact cross-test state leakage risk covered in the [core architecture doc](../01-core-architecture/01-browser-automation-model.md), just via fixtures instead of manually-shared contexts.

---

## Gotchas

**★ Symptom: a fixture you meant to create once per worker is created for every test.** Cause: scope is not an option object, it is the **second element of a tuple**. `myFixture: async ({}, use) => {…}` with a `{ scope: 'worker' }` written anywhere inside the function body is simply a test-scoped fixture. The reference is explicit:

> *"Note the tuple-like syntax for the worker fixture - we have to pass `{scope: 'worker'}` so that test runner sets this fixture up once per worker."*
> — [Test fixtures](https://playwright.dev/docs/test-fixtures)

```typescript
// ❌ not worker-scoped — the option never reaches the runner
const test = base.extend({
  account: async ({ browser }, use) => { await use(await createAccount()); },
});

// ✅ worker-scoped — the tuple's second element is where scope lives
const test = base.extend<{}, { account: Account }>({
  account: [async ({ browser }, use) => { await use(await createAccount()); }, { scope: 'worker' }],
});
```

Note the second type parameter: worker fixtures are declared in `base.extend<TestFixtures, WorkerFixtures>()`, not the first slot.

**★ Symptom: the suite got slower the day the `authenticatedPage` fixture landed.** Cause: the fixture logs in **through the UI**, and it runs once for every test that names it. Twenty tests means twenty full login flows, each one a navigation plus a form submit plus a redirect wait. The fixture removed the duplication from the source; it did not remove the work from the run. Fix: log in once and reuse the *serialized* session rather than repeating the flow — see [authentication and state](../07-authentication-and-state/01-session-reuse.md). Keep the UI-driven login for the one test whose subject actually **is** logging in.

**★ `{ auto: true }` runs your fixture for tests that never asked for it.** That is the entire point of it, and it is also the trap: an automatic fixture is charged to every test in its scope, so a "harmless" auto fixture that seeds a database adds its cost to the fastest unit test in the file.

> *"Automatic fixtures are set up for each test/worker, even when the test does not list them directly. To create an automatic fixture, use the tuple syntax and pass `{ auto: true }`."*
> — [Test fixtures](https://playwright.dev/docs/test-fixtures)

Fix: reserve `auto` for things that must be true of every test (tracing, a global mock, a console-error guard) and make everything else opt-in by naming it.

**★ A slow fixture fails the test, and the error names the test, not the fixture.** Setup and teardown are billed to the test's own budget — *"By default, fixture shares timeout with the test."* — and the test timeout is *"30 seconds by default"*. A fixture that seeds fifteen seconds of data leaves fifteen seconds for the test body, and the failure reads as a test timeout. Fix: give the slow fixture its own budget with the tuple's `{ timeout: 60000 }` option rather than raising the timeout for every test in the project.

**Cleanup before `use()` is not cleanup at all — and cleanup after `use()` is not optional.** The contract is positional: *"Setup is executed before the test/hook requiring it is run, and teardown is executed when the fixture is no longer being used by the test/hook."* Everything above the `await use(…)` is setup; everything below it is teardown. A fixture with nothing below `use` leaks whatever it created for the whole run.

**Aliasing a fixture does not clone it.** `async ({ authenticatedPage: page })` renames the binding; it does not produce a second page. `authenticatedPage` was built *from* the built-in `page` fixture, so it **is** that page — cookies set during the fixture's login are on the same context the rest of the test uses. That is what makes the pattern work, and it is also why a fixture that navigates somewhere leaves the test starting on that URL.

**The `request` fixture is not "the page's network".** It is documented as an *"Isolated APIRequestContext instance for this test run"* — a separate HTTP client, not a view of what the browser is sending. Assertions about traffic the **page** generates belong to route interception and `waitForResponse` ([navigation and network](../06-navigation-and-network/01-navigation-and-interception.md)); the `request` fixture is for calling your API directly, which is [API testing](../13-api-testing/01-request-fixture.md).

## Interview questions

**★ What does a fixture give you that `beforeEach` does not?**
Three things. First, dependency order: a fixture declares what it needs (`async ({ page }, use)`) and the runner builds the graph, so you never sequence setup by hand. Second, on-demand setup — a fixture is built for the tests that name it, and an unnamed, non-automatic fixture costs nothing, whereas a `beforeEach` in a describe block runs for every test in that block whether or not it is relevant. Third, teardown is written in the same function as setup, on the far side of `use()`, so the pairing cannot drift apart the way a `beforeEach`/`afterEach` pair does when someone edits one of them.

**★ Why must fixture cleanup be written after `await use(...)` rather than in a `finally`, and what is `use` actually doing?**
`use` hands the value to whatever requested it and does not resolve until that consumer is finished — so the line after `await use(value)` is, by construction, "after the test". Code written before `use` runs before the test has seen the value at all, which is why a `deleteTempFile` above the `use` call deletes a file the test is about to be handed. The documented rule is that setup is what runs before the requiring test or hook and teardown is what runs once the fixture is no longer in use; the `use` call is the boundary between the two halves.

**★ When is a worker-scoped fixture correct, and when is it a bug waiting to be filed?**
Correct when the value is expensive to build and genuinely immutable across tests: a seeded account the tests only read, a compiled artefact, a started stub server. It is a bug when the value carries per-test state — an authenticated page, a database row the tests mutate, a counter. The failure mode is the one from [core architecture](../01-core-architecture/01-browser-automation-model.md): tests pass alone and fail in a full run, and because worker assignment varies with sharding, the failure moves around. A useful test for yourself: if two tests running back to back in the same worker could disagree about the fixture's contents, it is test-scoped.

**★ How do you type custom fixtures, and why does the second type parameter matter?**
`base.extend<MyFixtures>({...})` types the test-scoped fixtures — the documented pattern is `export const test = base.extend<MyFixtures>({...})`. Worker-scoped fixtures go in the **second** type parameter, `base.extend<TestFixtures, WorkerFixtures>()`. Getting this wrong is not merely cosmetic: TypeScript is the only thing that will tell you a worker fixture was declared in the test-fixture slot, because the tuple `{ scope: 'worker' }` on its own will still be accepted at the value level.

**What is the `request` fixture for, given that the page already makes requests?**
It is an isolated HTTP client for talking to your API without a browser — seeding data before a UI test, asserting a side effect after one, or testing the API itself. It does not observe the browser's traffic. When the question is "did the page call this endpoint", the answer is route interception or `waitForResponse`, not `request`.

**How does the `projects` matrix change what a fixture means?**
A project supplies the `use` options that the built-in fixtures are constructed from, so the same fixture code produces a different `context` per project — a different device descriptor, viewport or base URL. This is why fixtures are written against `page`/`context` rather than against a browser you launched: the project is allowed to decide what those are, and a fixture that launches its own browser silently opts out of the entire matrix.

---

← [Core architecture](../01-core-architecture/01-browser-automation-model.md) · [Playwright index](../../README.md) · Next → [Locators](../03-locators/01-locator-api.md)
