---
title: "Parallelism & Sharding: Workers, `describe.serial()` & CI Sharding"
sidebar_label: "Parallelism & Sharding"
sidebar_position: 1
---

# 🎭 Parallelism & Sharding: Workers, `describe.serial()` & CI Sharding

## 1. Under-The-Hood Mechanics

Playwright parallelizes at two independent levels — multiple **worker processes** running different test files simultaneously, and (optionally) further splitting the total suite across **multiple CI machines** entirely — each solving a different scaling bottleneck.

```
workers: N  (playwright.config.ts)
        │
        ▼
N separate WORKER PROCESSES, each with its OWN browser instance, running DIFFERENT test
FILES in parallel — tests WITHIN one file run sequentially by default, UNLESS marked
test.describe.parallel()

--shard=1/3  (CI-level splitting)
        │
        ▼
The TOTAL test suite is divided into 3 roughly-equal chunks, each run on a SEPARATE
CI machine/job — reduces WALL-CLOCK CI time by running shards genuinely concurrently
across machines, not just across workers on ONE machine
```

### `test.describe.parallel()` vs `test.describe.serial()`
By default, tests within a single file run **sequentially** (one after another, within whichever worker picked up that file) — `test.describe.parallel()` opts a specific describe block's tests into running concurrently against **different** workers (only safe for tests with zero interdependency). `test.describe.serial()` goes the opposite direction: explicitly enforcing that tests in that block run in strict order, and if one fails, **skipping** the rest (appropriate for a deliberate, intentional test sequence where later steps genuinely depend on earlier ones succeeding — used sparingly, since it cuts against the general E2E testing principle of independent, isolated tests).

### Sharding: Scaling Across Machines, Not Just Cores
`workers` parallelizes within a single machine's CPU cores; `--shard` distributes across **entirely separate CI machines/jobs** — the mechanism that lets a suite too large to meaningfully speed up with more workers on one machine still finish faster by running different portions on genuinely different hardware simultaneously.

---

## 2. Real-World Engineering Scenario

**Scenario**: A 40-Minute CI Suite Reduced to 10 Minutes via Sharding Across 4 Machines.
A large E2E suite took 40 minutes to run on a single CI machine, even with `workers` maxed out to the available CPU cores — the suite's total volume of tests, not core count, was the actual bottleneck at that point. Configuring CI to run the same suite across 4 parallel jobs, each handling one shard (`--shard=1/4` through `--shard=4/4`), reduced wall-clock CI time to roughly 10 minutes — each shard ran its ~quarter of the total tests on its own separate machine, genuinely concurrently, rather than competing for the same machine's limited cores.

---

## 3. Production-Grade Code Example

```typescript
// playwright.config.ts — configuring worker count
import { defineConfig } from '@playwright/test';

export default defineConfig({
  workers: process.env.CI ? 4 : undefined, // fixed count in CI; undefined lets Playwright use (cores / 2) locally
  fullyParallel: true, // allows tests WITHIN a file to also run in parallel, not just across files
});
```

```typescript
// A describe.serial() block — a DELIBERATE, ordered sequence (used sparingly)
test.describe.serial('onboarding wizard steps', () => {
  test('step 1: create account', async ({ page }) => { /* ... */ });
  test('step 2: verify email', async ({ page }) => { /* depends on step 1 having succeeded */ });
  test('step 3: complete profile', async ({ page }) => { /* depends on steps 1 and 2 */ });
  // if step 1 fails, steps 2 and 3 are AUTOMATICALLY SKIPPED, not run against a broken precondition
});
```

```yaml
# .github/workflows/e2e.yml — sharding across 4 parallel CI jobs
jobs:
  e2e:
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - run: npx playwright test --shard=${{ matrix.shard }}/4
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Using `test.describe.parallel()` for Tests With Hidden Interdependencies
```typescript
// ❌ DANGEROUS: if these tests secretly share state (a global counter, a shared database
// record) that ISN'T reset per test, running them in PARALLEL (against different workers,
// different browser instances) produces RACE CONDITIONS and flaky, order-dependent failures
test.describe.parallel('inventory tests', () => {
  test('reduces stock on purchase', async ({ page }) => { /* mutates SHARED inventory record */ });
  test('shows out-of-stock when quantity is zero', async ({ page }) => { /* reads the SAME shared record */ });
});

// ✅ CORRECT: only parallelize tests that are GENUINELY independent — each test should
// set up and tear down its OWN isolated data, never relying on shared, mutable state
```

### ⚠️ Pitfall 2: Overusing `describe.serial()` as a Workaround for Poor Test Isolation
```typescript
// ❌ ANTI-PATTERN: reaching for serial() because tests "happen to" depend on execution order
// (rather than each being genuinely, deliberately a STEP in one intentional sequence) is
// usually a symptom of missing proper test isolation/setup, not a legitimate ordering need
test.describe.serial('user tests', () => {
  test('creates a user', async ({ page }) => { /* creates global test user */ });
  test('user can log in', async ({ page }) => { /* relies on the PREVIOUS test's user existing */ });
});

// ✅ CORRECT: each test should independently set up its own needed state (e.g. via a
// fixture creating a fresh user per test), rather than relying on a PRIOR test's side effects
```

### ⚠️ Pitfall 3: Sharding Without Load-Balancing Test Duration Across Shards
Naive sharding (splitting tests purely by count, e.g. alphabetically or by file order) can produce unevenly-loaded shards if some test files are significantly slower than others — one shard might take 15 minutes while another finishes in 3, meaning the SLOWEST shard still gates total CI time, undermining much of sharding's intended benefit. Playwright's built-in sharding attempts reasonably balanced distribution, but for suites with highly uneven per-file test durations, monitoring actual per-shard completion times (and potentially reorganizing test files) may be needed to realize sharding's full benefit.

{/* LINKMAP:START */}

## Further reading

*Best explanations found elsewhere on the web — added alongside this page, nothing here replaces it.*

- **Read this:** [Parallelism](https://playwright.dev/docs/test-parallel) — playwright.dev: files run in parallel, tests in a file in order in one worker, `fullyParallel`, serial mode "not recommended", limiting workers on CI, worker index
- **Also good:** [Test API](https://playwright.dev/docs/api/class-test) — playwright.dev: `test.describe.parallel()` and `test.describe.serial()` sit in the Deprecated section as "Discouraged"; use `test.describe.configure` with `mode` (*read*)
- **Beyond the docs:** [Playwright - Parallelism and sharding](https://dev.to/this-is-learning/playwright-parallelism-and-sharding-58h9) — Luca Del Puppo, DEV Community, 2023-02-09: workers, `fullyParallel`, serial and shard with the `configure` form; no blob reports
- **Read this:** [Sharding](https://playwright.dev/docs/test-sharding) — playwright.dev: `--shard=x/y`, `fullyParallel` shards per test and otherwise per file, blob reporter and `merge-reports`, GitHub Actions matrix
- **Beyond the docs:** [Playwright Parallel Test Execution](https://www.deviqa.com/blog/playwright-parallel-test-execution-how-to-speed-up-the-test-suite/) — Anastasiia Sokolinska, DeviQA, 2026-06-25: one 60-test file leaving shards idle under file-level sharding, test-level sharding, `--shard-weights` (the article's claim: since 1.57), `fail-fast: false` for blobs

{/* LINKMAP:END */}
