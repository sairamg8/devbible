---
title: "API Testing: `APIRequestContext` & Combining API Setup With UI Verification"
sidebar_label: "API Testing"
sidebar_position: 1
---

# 🎭 API Testing: `APIRequestContext` & Combining API Setup With UI Verification

## 1. Under-The-Hood Mechanics

Playwright's `request` fixture makes real HTTP calls **without launching a browser at all** — useful for pure backend/contract testing, and critically, for **seeding or verifying data quickly**, bypassing the (much slower) UI when the UI itself isn't what's actually being tested.

```
request fixture (APIRequestContext)
        │
        ▼
await request.post('/api/orders', { data: {...} })   ──► a REAL HTTP call, no browser/page involved at all
        │
        ▼
Response object: .status(), .ok(), .json(), .headers()   ──► standard response inspection, same shape
                                                                regardless of which HTTP client made the call
```

### Why API-Level Setup Is Often Faster Than UI-Level Setup
A test verifying "an order shows correctly on the order history page" doesn't need to test the **order creation flow** through the UI to get to that state — creating the order via a direct API call (fast, no browser rendering/navigation involved) and then using the UI only to verify the actual thing being tested (the order history page's rendering) is both faster and more precisely scoped: a failure in this test now clearly indicates a problem with the order history page specifically, not an ambiguous failure that could have originated in either the creation flow or the display logic.

### Combining API Setup With UI Verification: A Common, Valuable Pattern
Seed data via the `request` fixture (fast, direct), then switch to `page` for the actual behavior under test (rendering, interaction) — this pattern appears constantly in mature E2E suites specifically because it isolates test setup cost from the actual thing being verified.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Test Suite Where Every Order-History Test Redundantly Re-Tested the Entire Checkout Flow Just to Get an Order Into the System.
Before adopting API-level setup, every test needing "an order that exists" first walked through the entire UI checkout flow (browse products, add to cart, fill shipping info, submit payment) purely to arrive at a state where an order existed to actually test against — meaning 20 different order-history tests each redundantly re-executed and re-verified the same checkout flow, multiplying both test run time and the blast radius of any checkout-flow flakiness (a single flaky checkout step could fail all 20 unrelated order-history tests). Switching to seeding orders directly via `request.post('/api/orders', {...})` let each order-history test start from exactly the state it needed, in milliseconds, with zero dependency on the checkout UI flow's own stability.

---

## 3. Production-Grade Code Example

```typescript
// Seeding data via the request fixture, then verifying via the UI — fast setup, focused verification
test('order history page shows a previously placed order', async ({ page, request }) => {
  // FAST setup: create the order directly via API, bypassing the entire checkout UI flow
  const response = await request.post('/api/orders', {
    data: { items: [{ sku: 'sku_1', quantity: 2 }], customerId: 'test-customer-1' },
  });
  expect(response.ok()).toBeTruthy();
  const order = await response.json();

  // FOCUSED verification: only the order history PAGE's rendering is actually under test here
  await page.goto('/account/orders');
  await expect(page.getByText(`Order #${order.id}`)).toBeVisible();
});
```

```typescript
// Pure API/contract testing — no browser involved at all
test('POST /api/orders validates required fields', async ({ request }) => {
  const response = await request.post('/api/orders', { data: { items: [] } }); // missing customerId
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.error).toContain('customerId is required');
});
```

```typescript
// Verifying via API after a UI action — the reverse direction of the pattern
test('checkout via the UI actually persists an order server-side', async ({ page, request }) => {
  await page.goto('/checkout');
  await completeCheckoutFlow(page); // exercises the actual UI flow — THIS is what's being tested

  // Verify the RESULT via the faster, more direct API, rather than only trusting the UI's own confirmation screen
  const response = await request.get('/api/orders?customer=test-customer-1');
  const orders = await response.json();
  expect(orders.length).toBeGreaterThan(0);
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Using UI-Based Setup for Every Test, Multiplying Redundant Coverage and Flakiness Blast Radius
```typescript
// ❌ SLOW AND FRAGILE: re-walking an entire multi-step UI flow purely to reach a starting
// state for a DIFFERENT test's actual focus multiplies run time AND couples unrelated
// tests to that flow's stability
test('order history shows correct total', async ({ page }) => {
  await page.goto('/checkout');
  await completeFullCheckoutFlowViaUI(page); // slow, and a checkout bug fails THIS unrelated test too
  await page.goto('/account/orders');
  await expect(page.getByText('$45.99')).toBeVisible();
});

// ✅ CORRECT: seed the needed state directly via API, keeping the test focused on what it ACTUALLY verifies
test('order history shows correct total', async ({ page, request }) => {
  await request.post('/api/orders', { data: { total: 45.99, customerId: 'test-1' } });
  await page.goto('/account/orders');
  await expect(page.getByText('$45.99')).toBeVisible();
});
```

### ⚠️ Pitfall 2: Forgetting the `request` Fixture Doesn't Share Auth State With `page` Automatically
```typescript
// ❌ WRONG ASSUMPTION: request and page fixtures are NOT automatically authenticated the same
// way — a request call may need its OWN auth header, even if `page` is using a storageState
const response = await request.post('/api/orders', { data: {...} }); // may 401 without explicit auth

// ✅ CORRECT: explicitly pass auth (a token, matching cookies) to the request fixture,
// or configure it at the project level to share storageState consistently
const response = await request.post('/api/orders', {
  data: {...},
  headers: { Authorization: `Bearer ${testUserToken}` },
});
```

### ⚠️ Pitfall 3: Never Testing the ACTUAL UI Flow the API Shortcut Was Bypassing
Using API-level setup for every test's precondition is valuable, but if the actual UI checkout flow is never exercised by ANY test (only ever bypassed via direct API calls), a genuine regression in that UI flow itself could go completely undetected. At least some tests should still exercise the full, real user-facing flow end-to-end — API shortcuts are for tests where that specific flow ISN'T the thing under test, not a wholesale replacement for ever testing it directly.
