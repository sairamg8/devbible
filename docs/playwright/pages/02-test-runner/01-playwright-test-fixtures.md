---
title: "Test Runner: `@playwright/test`, Built-In Fixtures & the Projects Matrix"
sidebar_label: "Test Runner"
sidebar_position: 1
---

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
Fixtures can be scoped `{ scope: 'worker' }` (created once, shared across every test in that worker process) or left at the default test scope (fresh per test) — using worker scope for something that should genuinely be fresh per test (like an authenticated page with test-specific state) reintroduces the exact cross-test state leakage risk covered in the [core architecture doc](../01-core-architecture/01-browser-automation-model.md), just via fixtures instead of manually-shared contexts.
