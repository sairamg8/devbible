---
title: "Testing Strategy: The Real-World Pyramid & Contract Testing"
sidebar_label: "Testing Strategy"
sidebar_position: 1
---

# 🏛️ Testing Strategy: The Real-World Pyramid & Contract Testing

## 1. The Decision Framework

The classic testing pyramid isn't a stylistic preference — it's a direct consequence of each layer's cost-per-test and confidence-per-test tradeoff, and a healthy test suite's shape should reflect that economics deliberately, not accidentally.

```
                    ▲  E2E (Playwright) — FEWEST
                   ╱ ╲    critical user journeys ONLY (login, checkout) — expensive to
                  ╱   ╲   run/maintain, reserved for what truly must never break
                 ╱─────╲
                ╱       ╲  Integration tests — FEWER
               ╱         ╲   multiple components + real state management wired together,
              ╱───────────╲  mocked network boundary
             ╱             ╲
            ╱               ╲  Component tests (Jest/RTL) — MODERATE, the HIGHEST-LEVERAGE layer
           ╱                 ╲   individual component behavior in isolation — most UI
          ╱───────────────────╲  regressions are caught HERE, per-test cost is low
         ╱                     ╲
        ╱                       ╲  Unit tests — MANY, FASTEST, CHEAPEST
       ╱_________________________╲  pure functions, utilities, reducers
```

### Why the Shape Matters, Not Just "Write Tests"
A test suite INVERTED from this shape (many slow E2E tests, few fast unit/component tests) is a common, expensive anti-pattern — E2E tests are the most expensive to write, run, and maintain (real browser automation, genuine flakiness risk, slow CI feedback), so a suite over-relying on them pays maximum cost for often duplicate coverage that a much cheaper component test could have provided with equivalent confidence for that specific piece of logic.

### Contract Testing: Verifying the Frontend's Assumptions Stay True
Even with generated types (covered in the [data layer doc](../04-data-layer-and-api-architecture/01-structuring-the-data-boundary.md)) keeping shapes in sync at compile time, a genuine RUNTIME contract test (Pact-style, or validating against a live/staged backend) catches a category generated types alone cannot: the backend's ACTUAL runtime behavior diverging from its own documented schema (a field that's supposed to always be present sometimes isn't, due to a backend bug) — a gap between "what the schema says" and "what the API actually, truly returns."

---

## 2. Real-World Engineering Scenario

**Scenario**: A Team's E2E-Heavy Suite Taking 45 Minutes and Still Missing Component-Level Bugs.
A team's test suite consisted almost entirely of E2E tests — every feature, however small, was verified via a full Playwright test navigating through the real app. The suite took 45 minutes to run, was frequently flaky (real browser timing issues unrelated to actual bugs), AND still missed genuine component-level bugs, since E2E tests typically only exercised each component's "happy path" as part of a larger user journey, never systematically covering its individual edge cases (empty states, error states, unusual prop combinations) the way dedicated component tests would. Rebalancing toward the pyramid — moving most coverage to fast, reliable component tests (RTL), reserving E2E specifically for the 5-6 truly critical, must-never-break user journeys (login, checkout) — cut total suite time to under 10 minutes, reduced flakiness dramatically, AND increased actual bug-catching coverage, since component tests could now systematically cover edge cases E2E tests had never reached.

---

## 3. Reference Implementation

```typescript
// Unit test — a pure function, cheapest layer, fastest to write and run
test('calculateDiscount applies percentage correctly', () => {
  expect(calculateDiscount(100, 0.2)).toBe(80);
});
```

```tsx
// Component test — the HIGHEST-LEVERAGE layer, systematically covering edge cases
test('checkout button is disabled when cart is empty', () => {
  render(<CheckoutButton cartItemCount={0} />);
  expect(screen.getByRole('button')).toBeDisabled();
});
test('checkout button shows item count in its label', () => {
  render(<CheckoutButton cartItemCount={3} />);
  expect(screen.getByRole('button')).toHaveTextContent('Checkout (3 items)');
});
```

```tsx
// Integration test — multiple components + real state management, network boundary mocked
test('adding an item updates the cart badge across the app shell', () => {
  renderWithProviders(<AppShell />); // REAL Redux store, REAL routing — just the network is mocked
  fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' }));
  expect(screen.getByTestId('cart-badge')).toHaveTextContent('1');
});
```

```typescript
// E2E test — reserved for genuinely critical, must-never-break journeys ONLY
test('a user can complete checkout from product page to confirmation', async ({ page }) => {
  await page.goto('/products/1');
  await page.getByRole('button', { name: 'Add to Cart' }).click();
  await page.getByRole('link', { name: 'Checkout' }).click();
  // ... full real-browser flow through the ACTUAL critical path
  await expect(page.getByText('Order confirmed')).toBeVisible();
});
```

---

## 4. Senior Engineer Anti-Patterns & Lessons

### ⚠️ Anti-Pattern 1: An Inverted Pyramid — Heavy E2E, Sparse Unit/Component Coverage
As the scenario shows, this is the single most common, most expensive real-world testing anti-pattern — it maximizes the cost of the most expensive layer while providing WORSE edge-case coverage than a properly-shaped pyramid would, since E2E tests rarely exercise a component's full range of states systematically.

### ⚠️ Anti-Pattern 2: Treating "More E2E Tests" as Inherently Higher Confidence
E2E tests verify genuine end-to-end integration — valuable, but expensive and inherently limited in HOW MANY distinct scenarios can reasonably be covered given their cost/flakiness/runtime. A component test suite systematically covering 20 edge cases of one component often provides MORE actionable confidence about that component's correctness than a single E2E test that happens to pass through it once, on the happy path.

### ⚠️ Anti-Pattern 3: No Contract Testing, Relying Solely on "It Compiled" as API-Correctness Evidence
Generated types catch a SCHEMA mismatch at compile time — they cannot catch the backend's actual runtime behavior silently diverging from what that schema promises (a documented-required field that's occasionally, buggily absent in real responses). Without some form of contract testing against a real/staged backend, this category of bug surfaces only in production, discovered by users, rather than being caught by CI.
