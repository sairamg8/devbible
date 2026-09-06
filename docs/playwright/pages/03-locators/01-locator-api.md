---
title: "Locators: `getByRole`, Semantic Queries & Strictness Mode"
sidebar_label: "Locators"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against the Playwright documentation —
> [Locators](https://playwright.dev/docs/locators) (re-resolution, recommended priority,
> strictness, `filter()`) and [Assertions](https://playwright.dev/docs/test-assertions)
> (which matchers retry). Documentation-validated; **no sandbox run** — `@playwright/test` is not
> installed in this checkout, so **no error text on this page is a captured transcript**. The track
> carries **no pinned version** (`policy: latest`).
> Validated: 2026-09-06 · claims + output provenance · session 4e8d4393

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

> *"Locators are strict. This means that all operations on locators that imply some target DOM element will throw an exception if more than one element matches."*
> — [Locators](https://playwright.dev/docs/locators)

An action or assertion on a locator matching **more than one** element throws, rather than silently acting on just the first match — this catches a genuine class of bug (a selector that was supposed to be unique but accidentally matches multiple elements) at the exact point it happens, instead of silently interacting with the wrong element.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Test Silently Clicking the Wrong "Delete" Button on a List Page, Caught Only by Strictness Mode.
A test used `page.locator('button:has-text("Delete")').click()` on a page listing multiple items, each with its own delete button — before strictness mode, this would have silently clicked whichever "Delete" button happened to resolve first (likely the first item in the list), regardless of which item the test actually intended to delete, producing a test that appeared to pass while verifying the wrong thing entirely. Playwright's strict-by-default locator behavior instead **threw immediately** rather than acting on a guess, forcing the test to be corrected to properly scope the locator (e.g. `.filter({ hasText: 'Product A' })` first, then find its delete button within that specific scope) — catching a real correctness bug at write-time rather than shipping a silently-wrong test.

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

  // ❌ throws instead of clicking: the locator matches every Delete button on the page,
  // and a locator operation that implies ONE target element rejects an ambiguous match
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

---

## Gotchas

**★ Symptom: the strict-mode failure points at a line that looks fine.** Cause: creating a locator queries nothing. The exception is raised where the locator is *used* — the `click()`, the `expect()` — which can be dozens of lines and one helper function away from the over-broad selector that caused it. Fix: read the locator string in the error, not the stack frame; the string tells you which description was ambiguous, the stack only tells you who finally used it.

**★ Symptom: `.first()` made the failure go away and the test still asserts nothing useful.** Cause: `.first()`, `.last()` and `.nth()` are *selection*, not *disambiguation* — they pick a match from an ambiguous set instead of describing the one you meant. The test now deterministically operates on whichever element the DOM happens to order first, which is the exact silent-wrong-element bug strictness exists to surface. Fix: scope, then act — `page.locator('.product-card').filter({ hasText: 'Wireless Mouse' }).getByRole('button', { name: 'Delete' })`. `.first()` is legitimate only when the set is genuinely homogeneous and any member will do (the first row of a table you are about to assert the shape of, say).

**★ Symptom: `getByRole('button', { name: 'Save' })` finds nothing, but there is visibly a Save button.** Cause: `getByRole` queries the accessibility tree — *"page.getByRole() to locate by explicit and implicit accessibility attributes"* — and a `div` with a click handler has no button role, an icon-only button with no accessible name has no name to match, and a label that is only visually adjacent is not an accessible name. Fix: **do not** reach for a CSS selector. The failing locator has found a real accessibility defect; give the control a role and an accessible name, and the test starts passing for the same reason a screen-reader user starts being able to use it.

**★ Symptom: an assertion passes, and the action on the next line hits a different element.** Cause: a locator is a description, and *"Every time a locator is used for an action, an up-to-date DOM element is located in the page."* Two consecutive uses are two independent resolutions, so a list that re-renders between them (a poll, a websocket update, a sort) can move the row out from under you. Fix: do not carry a positional locator across a re-render — describe the row by its content (`filter({ hasText: orderId })`) so that a re-render resolves to the same *logical* element rather than the same index.

**★ Symptom: a branch on `await locator.count()` behaves differently in CI.** Cause: `count()` is a one-shot question answered at the moment you ask it, whereas the matchers documented as *"assertions will retry until the assertion passes"* keep re-checking. An `if (await locator.count() > 0)` therefore races the UI it is inspecting. Fix: express the intent as an assertion — `await expect(locator).toHaveCount(0)` waits for the list to empty; `if (count)` merely reports whether it had emptied yet.

**Text locators are the ones your product manager can break.** `getByText` and `getByRole`'s `name` option both match copy, so a wording change, a translation or a stray non-breaking space is a test failure with no code change behind it. That is usually the right trade (the copy is part of the contract with the user), but it is the reason `getByTestId` still exists for controls whose label is genuinely volatile.

**⚠️ `ElementHandle` is described here as the older, snapshot-shaped API, and this pass did not verify its current status.** The re-resolution behaviour that makes locators reliable is quoted above and is solid. The comparison to `ElementHandle` is not sourced from the pages read on 2026-09-06 — check the `ElementHandle` entry in the API reference before writing new code against it, and prefer a locator regardless.

## Interview questions

**★ What *is* a locator, and why does the distinction from "an element" matter in practice?**
It is a description of how to find an element, not a reference to one. Creating it touches the DOM zero times; every action and assertion resolves it again — *"Every time a locator is used for an action, an up-to-date DOM element is located in the page."* In practice this buys two things and costs one. It buys immunity from stale references, so a locator created before a re-render still works afterwards; and it buys auto-waiting, because a description can be retried while a reference cannot. It costs you the guarantee that two consecutive uses touch the same node — which is exactly the thing people are surprised by when a list re-orders mid-test.

**★ Why is strict mode a feature rather than an obstacle?**
Because the alternative silently picks one. A selector that matches five Delete buttons expresses an intention that the author got wrong, and any tool that resolves the ambiguity for you turns that authoring bug into a passing test that verifies the wrong thing. The documented rule — *"all operations on locators that imply some target DOM element will throw an exception if more than one element matches"* — converts a class of silent wrongness into a loud failure at the moment the ambiguity appears, which is the cheapest possible moment to find it.

**★ Why is `getByRole` recommended over a CSS selector, and what does each one actually break on?**
The recommendation is explicit: *"To make tests resilient, we recommend prioritizing user-facing attributes and explicit contracts such as page.getByRole()."* A CSS selector breaks on things a user cannot perceive — a renamed class, a wrapper div, a switch of component library — so it produces failures that carry no information about the product. A role locator breaks on things a user *can* perceive: the control lost its accessible name, or stopped being a button. Both are real failures, but only one of them is worth your morning.

**★ When is `.first()` acceptable?**
When the set is genuinely interchangeable and the test says so. "The first row of the results table exists and has three columns" is a fine use, because the assertion is about the shape of any row. "Click the first Delete button" is not, because the test is silently choosing a victim. The test is whether you could swap the matched element for another member of the set without changing what the test proves.

**How do you act on a control inside one specific row of a repeated list?**
Narrow to the row first and chain from it: `page.locator('.product-card').filter({ hasText: 'Wireless Mouse' }).getByRole('button', { name: 'Delete' })`. The outer locator identifies the row by content, and the inner one searches only inside that row — so the Delete button is unique by construction, and strictness never has to fire. The docs describe this as filtering by text with `locator.filter()` and chaining the filters as you narrow.

**A colleague stores `const btn = await page.$('button')` and reuses it later. What do you tell them?**
That they have taken a snapshot of a node rather than a description of one, so anything that re-renders that part of the tree leaves them holding a detached element — and that the fix is not to re-take the snapshot at every use, it is to hold the locator instead and let Playwright resolve it each time. The locator form also gets auto-waiting and strictness for free, neither of which a stored handle has.

---

← [Test runner](../02-test-runner/01-playwright-test-fixtures.md) · [Playwright index](../../README.md) · Next → [Actions and interactions](../04-actions-and-interactions/01-interaction-primitives.md)
