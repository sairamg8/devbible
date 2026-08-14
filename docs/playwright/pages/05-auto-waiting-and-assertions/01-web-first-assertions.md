---
title: "Auto-Waiting & Assertions: Web-First Assertions, Actionability & Soft Assertions"
sidebar_label: "Auto-Waiting & Assertions"
sidebar_position: 1
---

# 🎭 Auto-Waiting & Assertions: Web-First Assertions, Actionability & Soft Assertions

## 1. Under-The-Hood Mechanics

Playwright's defining reliability feature is **automatic, built-in waiting** — both for actions (clicking, filling) and for assertions — eliminating the manual `sleep()`/arbitrary-delay patterns that plague less sophisticated automation tools.

```
expect(locator).toBeVisible()
        │
        ▼
NOT a single, instant check — RETRIES the check repeatedly (polling) until it PASSES,
or a timeout elapses — this is why it's called a "web-first" assertion: designed
SPECIFICALLY for the reality that web UIs update asynchronously

Actionability checks (before ANY action like .click()):
  Playwright automatically waits for the target element to be:
    visible → stable (not still animating/moving) → enabled → receives events (not covered by another element)
  ──► only THEN does the actual click dispatch
```

### Why This Eliminates an Entire Category of Flaky Tests
Without built-in auto-waiting, a test clicking a button the instant after a state change would race against that button's own re-render — sometimes the click lands correctly, sometimes it fires against a stale, about-to-be-replaced DOM node, producing exactly the "flaky, sometimes passes sometimes fails" test behavior that's historically plagued E2E testing. Playwright's actionability checks and web-first assertions build the "wait until it's actually ready" logic into every action/assertion by default, rather than requiring manual `waitFor`-style calls sprinkled through every test (though `waitFor`-equivalent explicit waits still exist for genuinely custom conditions).

### Soft Assertions: Continuing After a Failure
```typescript
await expect.soft(page.getByText('Total: $45.99')).toBeVisible();
await expect.soft(page.getByText('Free shipping')).toBeVisible();
// test CONTINUES even if the first soft assertion failed — both are checked,
// and the test fails at the END if EITHER failed, reporting BOTH results
```
Regular `expect()` throws immediately on failure, stopping the test right there — `expect.soft()` records a failure but lets the test **continue**, useful when checking several independent, unrelated things in one test and wanting visibility into all of them, not just whichever failed first.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Historically Flaky Test Suite Becoming Reliable After Migrating From Manual Delays to Web-First Assertions.
A team's previous Selenium-based suite was riddled with `sleep(2000)`-style manual delays before every assertion, guessing at how long a given UI update might take — too short a delay caused flaky failures under slower CI load; too long a delay made the whole suite unnecessarily slow. Migrating to Playwright's web-first assertions (`expect(locator).toBeVisible()`, which polls until true or a timeout, rather than a single check after a fixed guess-based delay) eliminated both problems simultaneously: assertions resolved the moment the actual condition became true (often much faster than the old fixed delays), and genuinely slow CI runs no longer produced false failures, since the polling window itself absorbed that variability.

---

## 3. Production-Grade Code Example

```typescript
// Web-first assertions — auto-retrying until they pass or time out
test('adds an item to the cart', async ({ page }) => {
  await page.goto('/products/1');
  await page.getByRole('button', { name: 'Add to Cart' }).click();

  // Polls/retries automatically — no manual wait needed for the cart badge to update
  await expect(page.getByTestId('cart-count')).toHaveText('1');
  await expect(page.getByRole('button', { name: 'Add to Cart' })).toBeDisabled(); // e.g. briefly disabled post-click
});
```

```typescript
// Actionability checks happening automatically before an action
test('clicks a button that becomes enabled after validation passes', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Email').fill('alex@acme.com');

  // Playwright automatically WAITS for this button to become enabled (actionability check)
  // before attempting the click — no manual expect().toBeEnabled() needed first
  await page.getByRole('button', { name: 'Continue' }).click();
});
```

```typescript
// Soft assertions — checking several independent things, seeing ALL results even if one fails
test('order confirmation page shows all expected details', async ({ page }) => {
  await page.goto('/order-confirmation/123');

  await expect.soft(page.getByText('Order #123')).toBeVisible();
  await expect.soft(page.getByText('Total: $45.99')).toBeVisible();
  await expect.soft(page.getByText('Estimated delivery')).toBeVisible();
  // If ONE of these fails, the test STILL checks the others, reporting ALL results at the end —
  // more informative than stopping at the FIRST failure and never learning about the rest
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Adding Manual `waitForTimeout()` Delays "Just in Case"
```typescript
// ❌ ANTI-PATTERN: reintroduces the exact flakiness/slowness tradeoff web-first assertions
// were designed to eliminate — an arbitrary guess-based delay, not a real readiness check
await page.getByRole('button', { name: 'Submit' }).click();
await page.waitForTimeout(2000); // guessing — might be too short (flaky) or too long (slow)
await expect(page.getByText('Success')).toBeVisible();

// ✅ CORRECT: let the web-first assertion itself do the waiting — no arbitrary delay needed
await page.getByRole('button', { name: 'Submit' }).click();
await expect(page.getByText('Success')).toBeVisible(); // polls until true or timeout, no guessing
```

### ⚠️ Pitfall 2: Using Regular `expect()` When Checking Several Independent, Unrelated Conditions
```typescript
// ❌ LESS INFORMATIVE: if the FIRST assertion fails, the test stops immediately — you never
// learn whether the SECOND and THIRD conditions were also broken, requiring multiple
// debug-fix-rerun cycles to discover each issue one at a time
await expect(page.getByText('Order #123')).toBeVisible(); // fails here — test STOPS
await expect(page.getByText('Total: $45.99')).toBeVisible(); // never even checked

// ✅ CORRECT: expect.soft() for independent checks where seeing ALL results at once is valuable
await expect.soft(page.getByText('Order #123')).toBeVisible();
await expect.soft(page.getByText('Total: $45.99')).toBeVisible(); // STILL checked, even if the first failed
```

### ⚠️ Pitfall 3: Assuming Actionability Checks Substitute for Explicit Assertions About State
```typescript
// ❌ INCOMPLETE: a successful click only confirms the button WAS clickable at that moment —
// it does NOT verify anything about the RESULT of clicking it
await page.getByRole('button', { name: 'Submit' }).click(); // ✅ this succeeding proves nothing about correctness

// ✅ CORRECT: always follow an action with an explicit assertion about its EXPECTED RESULT —
// actionability checks ensure the action COULD happen correctly, not that the app BEHAVED correctly
await page.getByRole('button', { name: 'Submit' }).click();
await expect(page.getByText('Form submitted successfully')).toBeVisible();
```
