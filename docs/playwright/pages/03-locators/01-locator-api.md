---
title: "Locators: `getByRole`, Semantic Queries & Strictness Mode"
sidebar_label: "Locators"
sidebar_position: 1
---

# 🎭 Locators: `getByRole`, Semantic Queries & Strictness Mode

## 1. Under-The-Hood Mechanics

A Playwright **Locator** is not a reference to a specific DOM element at a point in time — it's a **lazy, re-evaluating description** of how to find an element, re-resolved fresh every time an action or assertion uses it. This is a deliberate design distinct from the older `ElementHandle` API (a snapshot reference to one specific, potentially stale element).

```typescript
const button = page.getByRole('button', { name: 'Submit' }); // NOT yet queried against the DOM at all —
                                                                  just a description of HOW to find it

await button.click(); // NOW Playwright resolves the locator against the CURRENT DOM, auto-waits for
                          // actionability (visible, stable, enabled — see the assertions doc), then clicks
```
Because a Locator re-resolves on every use, it stays valid even if the underlying DOM element was re-rendered (removed and re-added) between when the Locator was created and when it's actually used — a genuine reliability advantage over `ElementHandle`, which would reference a now-stale, possibly-detached element.

### Query Priority: `getByRole` as the Preferred Default
Mirroring the same accessibility-first philosophy covered in the [RTL queries doc](../../../jest-rtl/pages/08-rtl-queries/01-query-variants-and-priority.md), `getByRole()` (matching the accessibility tree's role + accessible name) is Playwright's recommended primary locator strategy — it queries the way a real user (or assistive technology) identifies an element, rather than coupling tests to CSS classes or DOM structure. `getByText`/`getByLabel`/`getByPlaceholder`/`getByAltText`/`getByTitle` cover other semantic targeting needs; `getByTestId` remains the escape hatch of last resort.

### Chaining & Filtering
```typescript
page.locator('.product-card').filter({ hasText: 'In Stock' }).first();
```
Locators compose — `.filter()` narrows a broader locator by additional criteria (text content, or a nested locator's presence), and `.first()`/`.last()`/`.nth()` select a specific match from an otherwise-ambiguous set, without needing a single, maximally-specific CSS selector to express the same narrowing.

### Strictness Mode: A Safety Feature, Not an Inconvenience
By default, an action/assertion on a locator matching **more than one** element throws an error, rather than silently acting on just the first match — this catches a genuine class of bug (a selector that was supposed to be unique but accidentally matches multiple elements) at the exact point it happens, instead of silently interacting with the wrong element.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Test Silently Clicking the Wrong "Delete" Button on a List Page, Caught Only by Strictness Mode.
A test used `page.locator('button:has-text("Delete")').click()` on a page listing multiple items, each with its own delete button — before strictness mode, this would have silently clicked whichever "Delete" button happened to resolve first (likely the first item in the list), regardless of which item the test actually intended to delete, producing a test that appeared to pass while verifying the wrong thing entirely. Playwright's strict-by-default locator behavior instead **threw an error** immediately ("strict mode violation: locator resolved to 3 elements"), forcing the test to be corrected to properly scope the locator (e.g. `.filter({ hasText: 'Product A' })` first, then find its delete button within that specific scope) — catching a real correctness bug at write-time rather than shipping a silently-wrong test.

---

## 3. Production-Grade Code Example

```typescript
// getByRole as the default, preferred locator strategy
test('submits the checkout form', async ({ page }) => {
  await page.goto('/checkout');
  await page.getByRole('textbox', { name: 'Email' }).fill('alex@acme.com');
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page.getByRole('heading', { name: 'Order Confirmed' })).toBeVisible();
});
```

```typescript
// Chaining and filtering — correctly scoping to a SPECIFIC item among several similar ones
test('deletes the correct product from the list', async ({ page }) => {
  await page.goto('/products');

  const productCard = page.locator('.product-card').filter({ hasText: 'Wireless Mouse' });
  await productCard.getByRole('button', { name: 'Delete' }).click(); // scoped WITHIN that specific card

  await expect(page.locator('.product-card').filter({ hasText: 'Wireless Mouse' })).toHaveCount(0);
});
```

```typescript
// Strictness mode catching an ambiguous locator at test-run time
test('this locator is deliberately too broad, demonstrating strict mode', async ({ page }) => {
  await page.goto('/products'); // a page with MULTIPLE "Delete" buttons, one per product

  // ❌ throws: "strict mode violation: locator('button:has-text(\"Delete\")') resolved to 5 elements"
  await page.locator('button:has-text("Delete")').click();
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Reaching for Raw CSS Selectors Instead of Semantic Locators
```typescript
// ❌ FRAGILE: couples the test to a specific CSS class name/DOM structure that can change
// during a purely visual refactor, breaking the test for reasons unrelated to actual behavior
await page.locator('.btn.btn-primary.submit-cta').click();

// ✅ CORRECT: query the way a real user identifies the element — survives styling/structure refactors
await page.getByRole('button', { name: 'Submit' }).click();
```

### ⚠️ Pitfall 2: Fighting Strictness Mode With `.first()` Instead of Properly Scoping
```typescript
// ❌ RISKY: silences the strictness error, but doesn't actually fix the ambiguity — the test
// now reliably clicks "SOME delete button," not necessarily the intended one, exactly the
// bug strictness mode was trying to surface in the first place
await page.locator('button:has-text("Delete")').first().click();

// ✅ CORRECT: properly scope the locator to the SPECIFIC item actually intended
await page.locator('.product-card').filter({ hasText: 'Wireless Mouse' }).getByRole('button', { name: 'Delete' }).click();
```

### ⚠️ Pitfall 3: Storing a Locator's "Resolved Element" for Later Reuse, Expecting `ElementHandle`-Like Snapshot Behavior
```typescript
// ❌ MISUNDERSTANDING: a Locator is NOT a snapshot — this is actually fine and CORRECT behavior
// (it re-resolves fresh each time), but engineers coming from ElementHandle-based tooling
// sometimes expect the OPPOSITE (a frozen reference) and get confused when the locator
// correctly reflects DOM changes that happened between creation and use
const button = page.getByRole('button', { name: 'Submit' }); // created once
await page.reload(); // the underlying DOM element is now DIFFERENT (re-rendered)
await button.click(); // ✅ still works correctly — re-resolves against the CURRENT DOM, not a stale reference

// ✅ AWARENESS: this re-resolving behavior is a FEATURE, not something to work around —
// don't reach for ElementHandle expecting "more predictable" snapshot behavior instead
```
