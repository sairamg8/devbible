---
title: "Navigation & Network: `page.goto()`, `page.route()` & HAR Replay"
sidebar_label: "Navigation & Network"
sidebar_position: 1
---

# 🎭 Navigation & Network: `page.goto()`, `page.route()` & HAR Replay

## 1. Under-The-Hood Mechanics

Beyond simple navigation, Playwright provides direct control over the network layer itself — intercepting, modifying, mocking, and asserting against real HTTP traffic the page generates, at a lower level than application-side tools like MSW (which intercept within the JS runtime; Playwright intercepts at the browser's own network layer, one level further out).

```
page.goto(url)              ──► navigates, waits for the 'load' event by default (configurable via waitUntil)
page.waitForURL(pattern)       ──► waits for navigation to REACH a specific URL (e.g. after a client-side redirect)
page.waitForLoadState(state)     ──► waits for a specific readiness signal: 'load' | 'domcontentloaded' | 'networkidle'

page.route(pattern, handler)       ──► intercepts EVERY request matching the pattern, BEFORE it reaches the network —
                                          can fulfill with a mock response, modify the real request, or let it through
page.waitForResponse(pattern)        ──► waits for and returns a SPECIFIC response, for asserting on real network activity
```

### `page.route()`: Intercepting at the Browser's Network Layer
Because interception happens at the actual browser network layer (not by monkey-patching `fetch`/`XMLHttpRequest` in the page's own JS context), `page.route()` catches **every** request the page makes through any mechanism — a `fetch` call, an `<img>` tag, a stylesheet, a WebSocket handshake — uniformly, without needing the page's own code to cooperate with or even be aware of the interception at all.

### HAR Replay: Deterministic, Recorded Network Traffic
Recording a real session's network traffic into a HAR (HTTP Archive) file, then replaying it during tests, provides a **realistic**, previously-recorded response dataset without depending on a real backend being available/stable during test runs — useful for genuinely deterministic E2E tests against complex, slow, or rate-limited third-party APIs.

---

## 2. Real-World Engineering Scenario

**Scenario**: Testing an Error State for a Third-Party Payment Gateway Without Ever Actually Triggering a Real Failed Charge.
An E2E test needed to verify the checkout flow's behavior when a payment gateway returns a decline response — triggering a REAL decline against the actual payment provider's sandbox would be slow, potentially rate-limited, and awkward to reliably reproduce on demand. `page.route()` intercepted the specific payment API endpoint and returned a mocked "card declined" response directly, letting the test deterministically verify the app's error-handling UI without any dependency on the real payment gateway's actual behavior, uptime, or sandbox test-card quirks.

---

## 3. Production-Grade Code Example

```typescript
// page.route() — mocking a specific API response to test an error state deterministically
test('shows an error message when payment is declined', async ({ page }) => {
  await page.route('**/api/payments/charge', (route) => {
    route.fulfill({
      status: 402,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'card_declined', message: 'Your card was declined.' }),
    });
  });

  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Pay Now' }).click();

  await expect(page.getByText('Your card was declined.')).toBeVisible();
});
```

```typescript
// page.waitForResponse() — asserting on REAL network activity, not just UI state
test('triggers exactly one analytics call on page view', async ({ page }) => {
  const analyticsPromise = page.waitForResponse((response) =>
    response.url().includes('/analytics/pageview') && response.status() === 200
  );

  await page.goto('/products');
  const response = await analyticsPromise; // waits for and returns the matching response
  expect(response.ok()).toBeTruthy();
});
```

```typescript
// HAR replay — deterministic tests against previously-recorded network traffic
test.use({
  // Recorded once via: npx playwright test --save-har=./har/products.har
  // Replayed here for a deterministic, backend-independent test run
});

test('renders products from recorded network traffic', async ({ page, context }) => {
  await context.routeFromHAR('./har/products.har', { url: '**/api/products' });
  await page.goto('/products');
  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting `page.route()` Must Be Set Up BEFORE the Navigation That Triggers the Request
```typescript
// ❌ WRONG: setting up the route AFTER navigating means the initial page-load requests
// have ALREADY fired before the interception was ever registered — too late to catch them
await page.goto('/checkout'); // requests already fired
await page.route('**/api/payments/charge', handler); // registered too late for THIS page's initial load

// ✅ CORRECT: register the route BEFORE navigating, so it's active for every subsequent request
await page.route('**/api/payments/charge', handler);
await page.goto('/checkout');
```

### ⚠️ Pitfall 2: Using `waitForLoadState('networkidle')` as a General-Purpose "Wait for Everything" Hammer
```typescript
// ❌ RISKY: networkidle waits for NO network activity for a period — but modern apps with
// polling, analytics beacons, or long-lived WebSocket connections may NEVER go fully idle,
// causing this to time out unnecessarily, or to wait far longer than actually needed
await page.waitForLoadState('networkidle'); // can hang/timeout on apps with persistent background activity

// ✅ CORRECT: prefer specific, targeted waits — a web-first assertion for the actual UI
// state that matters, or waitForResponse for a SPECIFIC request, rather than a blanket "idle" wait
await expect(page.getByText('Products loaded')).toBeVisible();
```

### ⚠️ Pitfall 3: Over-Relying on HAR Replay, Never Testing Against the Real Backend
HAR replay provides deterministic, fast tests — but a recorded HAR file can drift out of sync with the real backend's actual current behavior (a changed response shape, a new required field) without any test ever failing, since the test only ever verifies against the frozen, recorded snapshot. Reserve HAR replay for specific, deliberately-isolated scenarios (third-party APIs, hard-to-reproduce edge cases) rather than replacing all real-backend E2E coverage — a suite testing exclusively against replayed HAR files can pass consistently while the actual live integration is silently broken.
