---
title: "Advanced Patterns: Page Object Model, Custom Matchers & Test Tagging"
sidebar_label: "Advanced Patterns"
sidebar_position: 1
---

# 🎭 Advanced Patterns: Page Object Model, Custom Matchers & Test Tagging

## 1. Under-The-Hood Mechanics

As a suite grows past a handful of tests, several organizational patterns become essential for keeping it maintainable — each solving a specific scaling problem that becomes acute once a suite reaches dozens or hundreds of tests.

```
Page Object Model (POM):
  class CheckoutPage {
    constructor(private page: Page) {}
    async fillShippingInfo(info) { ... }     ──► ENCAPSULATES locators + actions for one page,
    async submitOrder() { ... }                    reused across every test that touches checkout
  }

Custom matchers:
  expect.extend({ toBeValidOrder(received) { ... } })   ──► domain-specific assertions,
                                                               same mechanism as Jest's expect.extend()

Test tagging:
  test('completes checkout @smoke', async ({ page }) => {...})
        │
        ▼
  npx playwright test --grep @smoke   ──► runs ONLY tagged tests — a fast "smoke test" subset
                                            for quick CI gates, distinct from the FULL regression suite
```

### Page Object Model: Encapsulation Against Locator Churn
Without POM, a locator change (a button's accessible name changes, a form field is restructured) requires updating every single test file that happens to reference that element directly — potentially dozens of scattered edits. Encapsulating a page's locators and common actions into a single class means that same change requires updating **one** page object, with every test using it automatically benefiting from the fix, since they interact with the page object's methods, not raw locators directly.

### Test Tagging: Different Test Subsets for Different CI Stages
A full regression suite might take 30+ minutes — too slow for a fast feedback loop on every single commit. Tagging a curated subset of critical-path tests (`@smoke`) lets CI run just that fast subset on every push, reserving the full `@regression` suite for less frequent runs (nightly, or pre-merge) — `--grep`/`--grep-invert` filter which tagged tests actually run for a given CI stage.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Checkout Redesign Requiring Updates to 40 Test Files, Reduced to 2 Files by an Existing Page Object.
A checkout page redesign changed several form field labels and button text — in a suite without a Page Object Model, this would have required manually updating raw locators across every one of the ~40 test files that happened to interact with checkout at some point. Because the suite had a `CheckoutPage` page object encapsulating those exact interactions, the actual fix required updating locators in **one** file (`CheckoutPage.ts`) — every test using `checkoutPage.fillShippingInfo(...)` and similar methods was automatically compatible with the redesign the moment the page object itself was updated, with zero changes needed in the 40 test files themselves.

---

## 3. Production-Grade Code Example

```typescript
// pages/CheckoutPage.ts — Page Object Model, encapsulating checkout's locators and actions
import { Page, Locator, expect } from '@playwright/test';

export class CheckoutPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email');
    this.submitButton = page.getByRole('button', { name: 'Place Order' });
  }

  async goto() {
    await this.page.goto('/checkout');
  }

  async fillShippingInfo(email: string) {
    await this.emailInput.fill(email);
  }

  async submitOrder() {
    await this.submitButton.click();
    await expect(this.page.getByText('Order confirmed')).toBeVisible();
  }
}
```

```typescript
// checkout.spec.ts — using the page object; a future locator change only needs updating in ONE place
import { test } from '@playwright/test';
import { CheckoutPage } from '../pages/CheckoutPage';

test('completes checkout with valid info @smoke', async ({ page }) => {
  const checkoutPage = new CheckoutPage(page);
  await checkoutPage.goto();
  await checkoutPage.fillShippingInfo('alex@acme.com');
  await checkoutPage.submitOrder();
});
```

```typescript
// A custom matcher, extending expect with a domain-specific assertion
expect.extend({
  async toBeValidOrder(page, orderId: string) {
    const heading = page.getByText(`Order #${orderId}`);
    const isVisible = await heading.isVisible();
    return {
      pass: isVisible,
      message: () => `expected order #${orderId} to be visible on the confirmation page`,
    };
  },
});

test('shows a valid order confirmation', async ({ page }) => {
  // ... complete checkout ...
  await expect(page).toBeValidOrder('12345');
});
```

```bash
# Test tagging — running only the fast smoke subset for quick CI feedback
npx playwright test --grep @smoke        # fast, curated critical-path subset — every commit
npx playwright test --grep @regression     # full suite — nightly or pre-merge
npx playwright test --grep-invert @slow      # everything EXCEPT explicitly slow-tagged tests
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Page Objects Containing Assertions Instead of Just Actions/Locators
```typescript
// ❌ BLURS RESPONSIBILITY: embedding test-specific assertions INSIDE the page object couples
// it to specific expected outcomes that may differ per test, reducing its reusability
async submitOrder() {
  await this.submitButton.click();
  await expect(this.page.getByText('Order confirmed')).toBeVisible(); // what if a DIFFERENT test expects an ERROR instead?
}

// ✅ CORRECT (for most cases): keep page objects focused on ACTIONS and LOCATORS; let
// individual tests make their OWN assertions about outcomes, using the page object's exposed locators
async submitOrder() { await this.submitButton.click(); }
// in the test: await expect(checkoutPage.page.getByText('Order confirmed')).toBeVisible();
```

### ⚠️ Pitfall 2: Inconsistent or Undocumented Tag Conventions
```typescript
// ❌ CONFUSING: ad-hoc, inconsistent tagging across the suite (@smoke, @Smoke, @fast, @quick
// all used interchangeably by different engineers) makes --grep filtering unreliable
test('test A @smoke', ...);
test('test B @Smoke', ...); // inconsistent casing — grep won't match both the same way
test('test C @fast', ...); // a DIFFERENT tag meaning roughly the same thing

// ✅ CORRECT: establish and document a small, consistent set of tag conventions
// (@smoke, @regression, @slow) used uniformly across the entire suite
```

### ⚠️ Pitfall 3: One Giant Page Object Covering an Entire Multi-Page Flow
```typescript
// ❌ OVER-BROAD: a single "CheckoutFlowPage" class trying to encapsulate cart, shipping,
// payment, AND confirmation pages all at once becomes a large, unfocused class that's
// itself hard to maintain — the same problem POM was meant to solve, one level up
class EntireCheckoutFlow { /* cart methods, shipping methods, payment methods, confirmation methods, ALL here */ }

// ✅ CORRECT: one page object PER logical page/component, composed together in tests
// that need to traverse multiple pages, keeping each individual page object focused
class CartPage { /* ... */ }
class ShippingPage { /* ... */ }
class PaymentPage { /* ... */ }
```
