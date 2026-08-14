---
title: "RTL Queries: `getBy`/`queryBy`/`findBy` & The Accessibility-First Priority Order"
sidebar_label: "RTL Queries"
sidebar_position: 1
---

# 🧪 RTL Queries: `getBy`/`queryBy`/`findBy` & The Accessibility-First Priority Order

## 1. Under-The-Hood Mechanics

Every RTL query exists in up to three variants, each with different behavior for "not found" and "found later" — picking the wrong variant produces either a confusing false failure or an assertion that can never actually fail.

```
getBy*      ──► THROWS immediately if 0 or 2+ matches found — for elements EXPECTED TO EXIST right now
queryBy*      ──► returns null if not found (does NOT throw) — for asserting ABSENCE of an element
findBy*         ──► returns a PROMISE, internally POLLS/retries until found or timeout — for elements
                       that appear ASYNCHRONOUSLY (after a fetch resolves, after a state update settles)

All* variants (getAllBy/queryAllBy/findAllBy) — same semantics, for MULTIPLE expected matches
```

### Why Three Variants, Not One
Using `getBy*` to assert an element is **absent** would throw immediately (since `getBy*` throws on zero matches) — the wrong tool for that job; `queryBy*`'s null-return is specifically what makes "assert this does NOT exist" expressible at all (`expect(queryByText('Error')).not.toBeInTheDocument()`). Using `getBy*` for an element that appears **after** an async operation would fail immediately (the element doesn't exist yet at the moment `getBy*` runs, synchronously) — `findBy*`'s built-in polling/retry is what correctly waits for asynchronously-appearing content.

### Query Priority: Accessibility as the Organizing Principle
RTL's own documentation recommends a specific priority order, **not** arbitrary preference — it's designed so tests naturally verify accessibility as a side effect of how elements are queried:
1. **`getByRole`** — matches by ARIA role + accessible name; the preferred default for almost everything, since it's exactly how assistive technology (and sighted users scanning for a "button labeled Submit") identifies interactive elements.
2. **`getByLabelText`/`getByPlaceholderText`** — for form fields specifically, matching how a user identifies an input.
3. **`getByText`** — for non-interactive content (a paragraph, a heading) where role-based querying doesn't apply.
4. **`getByTestId`** — the escape hatch of last resort, matching an arbitrary `data-testid` attribute with **no** accessibility signal at all — appropriate only when no accessible query can reasonably express the target element.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Test Suite Riddled With `data-testid` Queries That Missed a Real Accessibility Regression.
A component library's tests exclusively used `getByTestId` for every query — convenient to write, but entirely blind to accessibility. A refactor accidentally removed a button's `aria-label`, making it inaccessible to screen reader users — every existing `getByTestId('submit-button')` query kept passing, since the `data-testid` attribute was untouched, completely masking the regression. Migrating the highest-value tests to `getByRole('button', { name: /submit/i })` meant that same regression would have failed the test immediately — the accessible name was now literally part of what the query needed to match, making an accessibility break a test failure by construction, not something requiring separate, dedicated a11y tooling to catch.

---

## 3. Production-Grade Code Example

```tsx
// getBy vs queryBy vs findBy — matched correctly to what's actually being asserted
import { render, screen } from '@testing-library/react';

test('shows an error message immediately after invalid submission', async () => {
  render(<LoginForm />);

  // getBy: the submit button exists RIGHT NOW, synchronously, on initial render
  const submitButton = screen.getByRole('button', { name: /log in/i });

  // queryBy: asserting ABSENCE — using getBy here would THROW instead of letting the assertion run
  expect(screen.queryByText(/invalid credentials/i)).not.toBeInTheDocument();

  await userEvent.click(submitButton);

  // findBy: the error message appears ASYNCHRONOUSLY, after a rejected API call resolves
  const errorMessage = await screen.findByText(/invalid credentials/i);
  expect(errorMessage).toBeInTheDocument();
});
```

```tsx
// Query priority in practice — getByRole first, data-testid only as an actual last resort
function LoginForm() {
  return (
    <form>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" />
      <button type="submit">Log In</button>
    </form>
  );
}

test('renders accessible form elements', () => {
  render(<LoginForm />);
  screen.getByLabelText('Email');                        // ✅ priority 2 — form field, matched by label
  screen.getByRole('button', { name: 'Log In' });           // ✅ priority 1 — interactive element, matched by role+name
  // NOT: screen.getByTestId('login-form-submit-button')      ❌ last resort, unnecessary here — a real accessible query exists
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Using `getBy*` for an Element That Appears Asynchronously
```tsx
// ❌ WRONG: throws IMMEDIATELY — the element genuinely doesn't exist yet at the moment
// this synchronous query runs, since the async operation hasn't resolved
await userEvent.click(submitButton);
const error = screen.getByText(/invalid credentials/i); // ❌ throws — too early, still resolving

// ✅ CORRECT: findBy* polls/retries until the element appears (or times out)
const error = await screen.findByText(/invalid credentials/i);
```

### ⚠️ Pitfall 2: Defaulting to `getByTestId` When an Accessible Query Would Work
```tsx
// ❌ AVOID (as the default): bypasses accessibility verification entirely, and couples the
// test to an implementation detail (a testid attribute) rather than user-observable behavior
screen.getByTestId('submit-btn');

// ✅ PREFER: query the way a real user/assistive technology would identify the element
screen.getByRole('button', { name: /submit/i });
```

### ⚠️ Pitfall 3: Using `queryBy*` When `getBy*` Was Actually Appropriate, Masking a Real Failure
```tsx
// ❌ RISKY: queryBy* returns null instead of throwing — if the element SHOULD exist but a
// bug means it doesn't, this produces a confusing "Cannot read property of null" a few
// lines later, rather than a clear, immediate "Unable to find element" failure at the query itself
const button = screen.queryByRole('button', { name: /submit/i });
userEvent.click(button); // ❌ throws a confusing null-related error if button is actually missing

// ✅ CORRECT: use getBy* when the element is EXPECTED to exist — a clear, immediate failure
// message beats a confusing downstream null-reference error
const button = screen.getByRole('button', { name: /submit/i });
```
