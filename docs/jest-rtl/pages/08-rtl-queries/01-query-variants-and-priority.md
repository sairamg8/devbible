---
title: "RTL Queries: getBy, queryBy, findBy & Accessibility-First Priority"
sidebar_label: "RTL Queries"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against Testing Library documentation — [About Queries](https://testing-library.com/docs/queries/about) and [Query Priority](https://testing-library.com/docs/queries/about#priority).

DOM queries in React Testing Library are structured into three distinct execution variants (`getBy`, `queryBy`, `findBy`) arranged in an accessibility-first priority hierarchy that mirrors how assistive technologies interpret UI components.

---

## 1. Under-The-Hood Mechanics

Every query category provides single-element and multi-element (`*AllBy*`) variants with strict failure semantics:

| Query Type | 0 Matches | 1 Match | 2+ Matches | Asynchronous Retry? | Primary Use Case |
|---|---|---|---|---|---|
| `getBy...` | ❌ **Throws error** | ✅ Returns element | ❌ **Throws error** | ❌ No (Sync) | Element expected to exist on initial render |
| `queryBy...` | ✅ **Returns `null`** | ✅ Returns element | ❌ **Throws error** | ❌ No (Sync) | Asserting element ABSENCE (`.not.toBeInTheDocument()`) |
| `findBy...` | ❌ **Throws error** | ✅ Returns element | ❌ **Throws error** | ✅ **Yes (Async wait)** | Element appearing after network fetch or state settle |
| `getAllBy...` | ❌ **Throws error** | ✅ Returns Array[1] | ✅ Returns Array[N] | ❌ No (Sync) | Expected multiple elements (e.g. list items) |
| `queryAllBy...` | ✅ **Returns `[]`** | ✅ Returns Array[1] | ✅ Returns Array[N] | ❌ No (Sync) | Asserting zero or multiple elements |
| `findAllBy...` | ❌ **Throws error** | ✅ Returns Array[1] | ✅ Returns Array[N] | ✅ **Yes (Async wait)** | Multiple elements appearing asynchronously |

---

### The Official Query Priority Hierarchy

RTL prescribes a strict query priority order to maximize accessibility compliance:

```
1. Accessible to Everyone (Top Priority):
   ├── getByRole(role, { name: /.../i })   ──► Semantic ARIA role + accessible name (buttons, links, dialogs, inputs)
   ├── getByLabelText(/.../i)              ──► Form labels linked via <label htmlFor="..."> or aria-labelledby
   ├── getByPlaceholderText(/.../i)        ──► Input placeholder (fallback when label absent)
   ├── getByText(/.../i)                   ──► Non-interactive content (paragraphs, headings, banners)
   └── getByDisplayValue(/.../i)           ──► Current value of a filled form element

2. Semantic HTML5 / Media Queries:
   ├── getByAltText(/.../i)                ──► Images, areas, input type="image" with alt text
   └── getByTitle(/.../i)                  ──► Title attributes or SVG <title> tags

3. Escape Hatches (Last Resort):
   └── getByTestId('...')                  ──► Arbitrary data-testid attribute (no accessibility signal)
```

---

## 2. Real-World Engineering Scenario

**Scenario**: Eliminating test fragility and catching an accidental accessibility regression in a user checkout flow.

A payment card checkout used `getByTestId('pay-button')`. During a redesign, a developer swapped `<button>` for a non-semantic `<div onClick={...}>` without an ARIA role or keyboard listener. The `data-testid` test continued passing, but keyboard and screen-reader users could no longer complete purchases. Refactoring tests to `getByRole('button', { name: /pay \$49\.00/i })` instantly caught the regression because `<div>` does not compute to the `button` role in the accessibility tree.

---

## 3. Production-Grade Code Example

```tsx
// CheckoutForm.test.tsx
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckoutForm } from './CheckoutForm';

describe('CheckoutForm Query Priority & Variant Specifications', () => {
  test('handles complete accessible form submission lifecycle', async () => {
    const user = userEvent.setup();
    render(<CheckoutForm />);

    // 1. getByRole / getByLabelText: Form fields present synchronously on mount
    const emailInput = screen.getByLabelText(/billing email/i);
    const planSelect = screen.getByRole('combobox', { name: /subscription tier/i });
    const submitButton = screen.getByRole('button', { name: /complete order/i });

    // 2. queryBy: Asserting absence of error banner on initial render
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // 3. User interaction
    await user.type(emailInput, 'alex@example.com');
    await user.selectOptions(planSelect, 'pro');
    await user.click(submitButton);

    // 4. findBy: Element appears asynchronously after network validation resolves
    const successBanner = await screen.findByRole('status', { name: /order confirmed/i });
    expect(successBanner).toBeInTheDocument();

    // 5. Scoped queries with within() on repeating list elements
    const orderItems = screen.getAllByRole('listitem');
    expect(orderItems).toHaveLength(2);

    const firstItem = within(orderItems[0]);
    expect(firstItem.getByText(/pro subscription/i)).toBeInTheDocument();
    expect(firstItem.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });
});
```

---

## 4. Gotchas & Senior Pitfalls

### Symptom: `TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Submit"`
- **Cause**: The button contains an SVG icon or nested spans without an accessible name, or `aria-hidden="true"` was accidentally applied to a parent container.
- **Fix**: Verify accessible name calculation in the DOM, ensure `aria-label="Submit"` or text content exists, and inspect the rendered tree using `screen.debug()`.

### Symptom: `TestingLibraryElementError: Found multiple elements with the role "button"`
- **Cause**: Using `getByRole('button')` when multiple buttons exist without narrowing by accessible name.
- **Fix**: Narrow the query by accessible name using regex: `screen.getByRole('button', { name: /submit/i })`. If identical buttons exist in different table rows, scope with `within(tableRow).getByRole('button', { name: /delete/i })`.

### Symptom: `expect(screen.getByRole('alert')).not.toBeInTheDocument()` crashes with an unhandled exception
- **Cause**: `getBy*` throws immediately when 0 elements match, preventing the `.not.toBeInTheDocument()` assertion from running.
- **Fix**: Always use `queryBy*` when asserting the absence of an element: `expect(screen.queryByRole('alert')).not.toBeInTheDocument()`.

---

## 5. Interview Questions & Deep Dives

### ★ 1. What are the key differences between `getBy*`, `queryBy*`, and `findBy*`?
**Answer**:
- `getBy*`: Synchronous. Returns the matching DOM node. Throws an error immediately if 0 or >1 nodes match. Used for elements expected on initial render.
- `queryBy*`: Synchronous. Returns the matching DOM node, or `null` if 0 nodes match (throws if >1 match). Used exclusively for asserting absence.
- `findBy*`: Asynchronous. Returns a Promise that wraps `waitFor()` and `getBy*`. Polls the DOM until the element appears or the timeout (default 1000ms) expires. Used for elements appearing after async updates.

### ★ 2. Why is `getByRole` preferred over `getByText` and `getByTestId`?
**Answer**: `getByRole` queries elements using the browser's computed Accessibility API Tree (roles like `button`, `heading`, `dialog`, `checkbox` combined with accessible names). Unlike `getByText`, it verifies both semantic role and visibility. Unlike `getByTestId`, it provides a 1:1 guarantee that real screen reader and keyboard users can locate and operate the control.

### 3. How does the `within()` utility work in React Testing Library?
**Answer**: `within(domNode)` binds all standard RTL query methods (`getByRole`, `queryByText`, `findByLabelText`) to search strictly within the descendants of the specified `domNode` rather than global `document.body`. This disambiguates queries in complex UIs such as data tables, lists, and modal drawers.

### 4. What is the difference between `{ exact: false }` and RegExp matching in queries?
**Answer**: String matching with `{ exact: false }` performs case-insensitive substring matching (`screen.getByText('submit', { exact: false })`). Regular expressions (`screen.getByText(/submit/i)`) provide identical case-insensitivity with greater precision, allowing anchors (`/^submit$/i`), wildcards, and partial phrase matching.

---

## Where this connects

- **Previous**: [07 · RTL Core Philosophy](../07-rtl-core-philosophy/01-guiding-principle.md) — Behavior vs implementation details.
- **Next**: [09 · User Interaction](../09-user-interaction/01-simulating-input.md) — Simulating realistic input with `user-event` v14.
- **Async Queries**: [10 · Async Utilities](../10-async-utilities/01-waiting-for-updates.md) — How `findBy` delegates to `waitFor`.
