---
title: "Diagnosing a Test That's Flaky in CI But Passes Locally"
sidebar_label: "Diagnosing a Test That's Flaky in CI But P"
sidebar_position: 1
---

# 🎭 Diagnosing a Test That's Flaky in CI But Passes Locally

## 1. Under-The-Hood Mechanics

"Flaky in CI, fine locally" is almost never a mystery once you accept the premise: **CI and your laptop are genuinely different environments**, not just the same environment running the same test twice. The categories of difference map directly to categories of root cause:

```text
Difference between CI and local              →  What kind of flakiness it produces
─────────────────────────────────────────────────────────────────────────────────
CI machines are typically slower/shared      →  Timing races that never lose on a fast
(fewer CPU cores, noisy-neighbor containers)     local machine consistently lose in CI
CI runs tests in a different order/           →  Test isolation bugs (leftover state,
parallelism (more workers, different sharding)   shared backend records) surface as
                                                  order-dependent failures
CI has no developer manually watching/         →  A missing explicit wait that "usually"
waiting between actions                          works locally because a human's mouse
                                                  movement/screen-reading pace accidentally
                                                  gave the page enough time
CI's default viewport/timezone/locale may      →  Assertions on formatted dates/times/
differ from your local browser's OS defaults     currency that are locale-dependent
```

The single most valuable fact for this category of bug: Playwright can **already tell you exactly what happened** in the failing CI run, without you needing to reproduce it — if tracing was enabled (see the [debugging tools doc](../10-debugging-tools/01-diagnostic-tooling.md)), the trace file from the actual failed CI attempt is a complete, scrubbable recording of that specific failure. Diagnosis should start there, not with guessing.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Checkout Test That Fails ~1 in 15 CI Runs, Never Locally, No Matter How Many Times It's Re-Run on a Laptop.
A checkout flow test occasionally fails in CI on an assertion checking the order confirmation total, but passes every single time it's run locally, including with `--repeat-each=50`. The team's first instinct — "it's just flaky, add a retry" — masks the real bug rather than fixing it. Pulling the trace artifact from an actual failed CI run (uploaded automatically per `trace: 'on-first-retry'`) shows the actual cause in under two minutes: a discount-calculation network response that, under CI's slower/shared infrastructure, occasionally resolved a few hundred milliseconds later than the fixed `page.waitForTimeout(500)` the test had been using to "wait for the total to update" — a manual delay that happened to always be long enough on a fast local machine, but not reliably long enough under CI load.

---

## 3. Production-Grade Diagnostic Sequence

```typescript
// Step 1: make sure you're actually capturing evidence FROM the CI failure itself —
// most "flaky in CI" investigations fail simply because nobody looked at a trace
// playwright.config.ts
export default defineConfig({
  use: { trace: 'on-first-retry' }, // generates a trace on the SECOND attempt of a failing test
  retries: process.env.CI ? 2 : 0,
});
```

```bash
# Step 2: pull the trace artifact from the failed CI run (uploaded by your CI config) and open it —
# this alone resolves a large fraction of "flaky in CI" investigations without further steps
npx playwright show-trace ci-artifacts/trace.zip
```

```bash
# Step 3: if the trace doesn't immediately reveal it, REPRODUCE CI's actual conditions locally
# instead of just re-running the test as-is (which only reproduces YOUR machine's conditions)

# Match CI's worker/parallelism model — catches order-dependent isolation bugs
npx playwright test --workers=1 --repeat-each=20 checkout.spec.ts

# Force a CPU throttle to simulate CI's slower/shared hardware (via a custom fixture using CDP)
```

```typescript
// A fixture that throttles CPU to make LOCAL runs feel like slow, shared CI infrastructure —
// races that only lose under load become reproducible on a fast laptop
import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 }); // 4x slowdown
    await use(page);
  },
});
```

```typescript
// Step 4: audit the failing test for manual waits — these are the #1 source of this
// specific flakiness pattern, and auto-waiting assertions almost always replace them correctly
// ❌ SUSPECT: a fixed-duration guess standing in for "wait until the real condition is true"
await page.getByRole('button', { name: 'Apply Discount' }).click();
await page.waitForTimeout(500); // "usually" long enough locally; not reliably long enough under CI load
const total = await page.getByTestId('order-total').textContent();
expect(total).toBe('$40.49');

// ✅ CORRECT: assert on the ACTUAL condition — a web-first assertion polls until it's true
// or a real timeout elapses, which absorbs environment speed differences automatically
await page.getByRole('button', { name: 'Apply Discount' }).click();
await expect(page.getByTestId('order-total')).toHaveText('$40.49');
```

```typescript
// Step 5: audit for test ISOLATION bugs — does this test depend on state left behind by
// another test, or share a backend resource with tests running concurrently in other workers?
// ❌ SUSPECT: tests sharing one seeded user account across parallel workers
test('applies a discount code', async ({ page }) => {
  await loginAs(page, 'shared-test-user@acme.com'); // another worker's test, running
  // CONCURRENTLY, might be mutating this same account's cart right now
});

// ✅ CORRECT: each test/worker gets its OWN isolated data (a fresh account per test,
// or per-worker seeded fixtures), so parallel execution can never race on shared state
test('applies a discount code', async ({ page }, testInfo) => {
  const user = await createTestUser({ workerIndex: testInfo.workerIndex });
  await loginAs(page, user.email);
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Reaching for `retries` as the Fix Instead of the Band-Aid
```typescript
// ⚠️ retries: 2 makes the SYMPTOM (a red CI run) go away without touching the CAUSE —
// appropriate as a pragmatic stopgap for a KNOWN, actively-being-investigated flake,
// but treating it as the permanent fix means the underlying race condition (which might
// be a REAL production bug, not just a test artifact) stays silently masked forever
retries: process.env.CI ? 2 : 0,
```
Retries and root-cause fixing aren't mutually exclusive — keep retries configured as a safety net for genuinely transient infrastructure hiccups (a CDN blip), but track down and fix tests that retry consistently, rather than treating a passing-on-retry CI run as "resolved."

### ⚠️ Pitfall 2: "Fixing" Flakiness by Adding More `waitForTimeout` Calls
```typescript
// ❌ WRONG: increasing a manual delay "fixes" the flake in whatever environment you tested
// the new delay against, but the SAME class of bug (a fixed guess vs a real condition)
// will resurface the next time infrastructure gets even slightly slower
await page.waitForTimeout(2000); // "that should definitely be enough now" — until it isn't

// ✅ CORRECT: replace the guess with a condition-based wait — see Step 4 above.
// If no locator/assertion naturally expresses the condition, `page.waitForFunction()` or
// `page.waitForResponse()` targeting the SPECIFIC thing you're actually waiting for is still
// better than a fixed duration, because it resolves the instant the real condition is true.
```

### ⚠️ Pitfall 3: Assuming "Passes Locally 50/50 Runs" Proves It's Not the Test's Fault
Running a suspect test 50 times locally and seeing zero failures is evidence the bug's trigger condition is **rare on your specific machine**, not evidence the test is correct — a race condition can have wildly different odds of manifesting depending on exact CPU speed, background load, and scheduling, which is precisely why "works on my machine" and "flaky in CI" coexist. Local repeat-runs are a useful data point, not proof of innocence; the CPU-throttled fixture (Step 3) is a much stronger local reproduction technique specifically because it changes the ODDS, not just the run count.

### ⚠️ Pitfall 4: Debugging a Visual-Regression Flake as if It Were a Functional One
`toHaveScreenshot()` flakiness has a mostly disjoint cause set from functional-assertion flakiness: font rendering differences between a local OS and CI's Docker image, animations not fully settled at capture time, or a slightly different default viewport. The Step 1-5 sequence above (traces, CPU throttling, isolation audits) mostly doesn't apply here — the actual fix path is usually `maxDiffPixels`/threshold tuning, disabling animations before capture (`animations: 'disabled'` on the screenshot call), and generating baseline images from the SAME environment (CI's Docker image, not a local machine) that will run the comparison.
