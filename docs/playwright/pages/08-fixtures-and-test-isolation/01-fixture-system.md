---
title: "Fixtures & Test Isolation: Scoping, Automatic Fixtures & Fresh Contexts"
sidebar_label: "Fixtures & Test Isolation"
sidebar_position: 1
---

# 🎭 Fixtures & Test Isolation: Scoping, Automatic Fixtures & Fresh Contexts

## 1. Under-The-Hood Mechanics

Beyond the custom-fixture basics covered in the [test runner doc](../02-test-runner/01-playwright-test-fixtures.md), Playwright's fixture system has specific scoping and automation rules that directly control test isolation and suite performance.

```
Fixture scope:
  test-scoped (default)  ──► a FRESH instance created for EVERY individual test
  worker-scoped             ──► created ONCE per WORKER PROCESS, shared across every test that worker runs

Automatic fixtures ({ scope: ..., auto: true }):
  ──► run for EVERY test/worker WITHOUT needing to be explicitly destructured as a test parameter —
        e.g. a fixture that sets up global test-environment logging, run unconditionally

Fresh BrowserContext per test (the DEFAULT behavior):
  ──► guarantees NO shared cookies/localStorage/cache between tests, UNLESS explicitly overridden
        via a shared storageState (see the authentication doc)
```

### Test-Scoped vs Worker-Scoped: A Real Performance/Isolation Tradeoff
A test-scoped fixture (the default) provides maximum isolation — nothing carries over between tests — at the cost of recreating that fixture's setup work for every single test. A worker-scoped fixture (explicitly declared `{ scope: 'worker' }`) is created once and **reused** across every test in that worker, meaningfully faster for expensive setup (seeding a test database, starting an auxiliary service) — but introduces shared state across tests in that worker, which must be genuinely safe to share (read-only reference data, not per-test mutable state).

### Automatic Fixtures: Running Without Explicit Opt-In
```typescript
const test = base.extend({
  logTestName: [async ({}, use, testInfo) => {
    console.log(`Running: ${testInfo.title}`);
    await use();
  }, { auto: true }], // runs for EVERY test automatically, even if never destructured as a parameter
});
```
Useful for genuinely universal setup/instrumentation (logging, global error listeners) that every test should have, without requiring every single test file to explicitly request it.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Slow Test Suite Sped Up Significantly by Moving Expensive, Safely-Shareable Setup to Worker Scope.
A suite's custom fixture seeded a set of reference data (a fixed list of country codes, currency definitions — genuinely read-only, never mutated by any test) into a test database before every single test, adding real, repeated overhead across hundreds of tests for data that never actually needed to be re-seeded per test. Changing that specific fixture's scope from test-scoped (the default) to worker-scoped meant the reference data was seeded **once per worker process** instead of once per test — a substantial suite-wide speedup, since the data was genuinely safe to share (nothing in the suite ever mutated it), while per-test mutable state (an authenticated session, a test-specific order) correctly remained test-scoped.

---

## 3. Production-Grade Code Example

```typescript
// fixtures.ts — mixing worker-scoped (expensive, shareable) and test-scoped (per-test) fixtures
import { test as base } from '@playwright/test';

type Fixtures = {
  referenceData: { countries: string[]; currencies: string[] }; // worker-scoped — safe to share, read-only
  testOrder: { id: string }; // test-scoped — must be FRESH per test, mutable
};

export const test = base.extend<{}, Fixtures>({
  referenceData: [
    async ({}, use) => {
      const data = await seedReferenceData(); // expensive — run ONCE per worker, not per test
      await use(data);
    },
    { scope: 'worker' },
  ],

  testOrder: async ({}, use) => {
    const order = await createTestOrder(); // cheap, but must be FRESH and isolated per test
    await use(order);
    await deleteTestOrder(order.id); // cleanup after EACH test
  },
});
```

```typescript
// An automatic fixture — universal test instrumentation with no per-test opt-in needed
export const testWithLogging = base.extend({
  _logTestStart: [
    async ({}, use, testInfo) => {
      console.log(`▶ Starting: ${testInfo.title}`);
      await use();
      console.log(`✓ Finished: ${testInfo.title} (${testInfo.status})`);
    },
    { auto: true }, // runs for EVERY test, even though no test destructures `_logTestStart` explicitly
  ],
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Worker-Scoping a Fixture That Actually Needs Per-Test Isolation
```typescript
// ❌ DANGEROUS: worker-scoping something that tests actually MUTATE (like an authenticated
// session or a shopping cart) means one test's changes LEAK into the next test sharing that worker
export const test = base.extend({
  sharedCart: [async ({}, use) => { await use(await createCart()); }, { scope: 'worker' }], // ❌ mutated by tests!
});

// ✅ CORRECT: only worker-scope fixtures that are GENUINELY read-only/safe to share across
// tests — anything a test mutates needs to stay test-scoped (the default)
export const test2 = base.extend({
  cart: async ({}, use) => { await use(await createCart()); }, // fresh per test — default scope
});
```

### ⚠️ Pitfall 2: Overusing Automatic Fixtures for Non-Universal Concerns
```typescript
// ❌ WASTEFUL: an automatic fixture that only a SUBSET of tests actually need runs its setup
// cost for EVERY test anyway, including ones that never use it
const test = base.extend({
  expensiveAdminSetup: [async ({}, use) => { await seedAdminData(); await use(); }, { auto: true }], // ALL tests pay this cost

// ✅ CORRECT: reserve auto:true for genuinely universal concerns (logging, error handlers);
// let tests that specifically need expensive setup explicitly destructure that fixture instead
```

### ⚠️ Pitfall 3: Assuming Worker-Scoped Fixture Setup Runs Fresh for Every Test File
A worker-scoped fixture's setup runs once **per worker process**, and a single worker typically runs **many** test files sequentially (not one worker per file) — assuming its setup re-runs at the start of each new test *file* (rather than each new test *worker*) leads to incorrect assumptions about exactly when that expensive setup work actually happens, especially when reasoning about test run ordering or debugging why a worker-scoped fixture's state appears to persist across files that seem unrelated.
