---
title: "Debugging Tests: `screen.debug()`, `logRoles()` & Testing Playground"
sidebar_label: "Debugging Tests"
sidebar_position: 1
---

# 🧪 Debugging Tests: `screen.debug()`, `logRoles()` & Testing Playground

## 1. Under-The-Hood Mechanics

When a query fails or a test's assertion doesn't match reality, RTL provides direct visibility tools that print the **actual current DOM/accessibility state** — turning "why isn't this query finding anything" from a guessing game into a quick, direct inspection.

```
screen.debug()                ──► pretty-prints the CURRENT rendered DOM to the console
                                     (optionally scoped: screen.debug(specificElement))

logRoles(container)              ──► prints every ACCESSIBLE ROLE currently present in the container,
                                        alongside the accessible name RTL would use to query each one —
                                        directly answers "what role/name should I actually query by"

Testing Playground                 ──► a browser extension / testing-playground.com URL — paste HTML,
                                          get SUGGESTED queries ranked by RTL's own priority order
```

### `screen.debug()`: The First Thing to Reach For
When a `getByRole`/`getByText` query throws "unable to find element," `screen.debug()` immediately shows **exactly** what's actually in the DOM at that point — frequently revealing the real issue at a glance (the element hasn't rendered yet because the query needed to be `findBy*` instead of `getBy*`, or the actual text differs slightly from what the query expected, or a provider is missing and the component crashed silently before rendering anything meaningful).

### `logRoles()`: Discovering the Correct Query Without Guessing
Rather than guessing which role a given element maps to (implicit ARIA roles aren't always obvious — a `<button>` is `role="button"`, but a `<div onClick>` has no accessible role at all), `logRoles(container)` prints the actual, currently-computed role/name pairing for every accessible element present — directly answering "what should my `getByRole` call actually look like" from real, current output rather than documentation lookup or trial and error.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Failing Query Diagnosed in Seconds Instead of Minutes of Guessing.
A test's `screen.getByRole('button', { name: /submit/i })` was throwing "unable to find an accessible element," despite the developer being confident a submit button existed in the component. Calling `screen.debug()` immediately revealed the actual rendered DOM: the button element was present, but its visible text was "Submit Order" (matched fine by the regex) — the REAL issue was that the button was still disabled and hidden behind a loading spinner overlay at the exact point the query ran, since the component hadn't finished its initial async data fetch yet. The fix wasn't a query problem at all — it needed `findByRole` (waiting for the post-loading state) instead of `getByRole` (checking too early) — a diagnosis that took seconds once the actual DOM state was visible, versus potentially much longer spent guessing at query syntax issues that weren't the real problem.

---

## 3. Production-Grade Code Example

```tsx
// screen.debug() — the first diagnostic step when a query unexpectedly fails
import { render, screen } from '@testing-library/react';

test('shows the submit button once loading completes', async () => {
  render(<CheckoutForm />);

  screen.debug(); // prints the CURRENT DOM — reveals the loading spinner is still showing here

  // Diagnosis from the debug() output: this needs findBy (wait for it), not getBy (check now)
  const submitButton = await screen.findByRole('button', { name: /submit order/i });
  expect(submitButton).toBeEnabled();
});
```

```tsx
// logRoles() — discovering the correct query for an element with a non-obvious role
import { render } from '@testing-library/react';
import { logRoles } from '@testing-library/dom';

test('discovering the right role to query by', () => {
  const { container } = render(<CustomDropdown />);
  logRoles(container);
  // Console output might reveal:
  //   button:
  //   Name "Select an option":
  //   <button />
  //
  //   listbox:
  //   Name "":
  //   <ul />
  // ── now the actual correct query is obvious: getByRole('button', { name: 'Select an option' })
});
```

```tsx
// Scoping screen.debug() to a specific element, for a large component tree
test('scoped debugging in a large tree', () => {
  render(<Dashboard />);
  const sidebar = screen.getByRole('navigation');
  screen.debug(sidebar); // prints ONLY the sidebar's DOM, not the entire (potentially huge) page
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Reaching for Trial-and-Error Query Syntax Changes Before Checking the Actual DOM
```tsx
// ❌ INEFFICIENT: repeatedly guessing at slightly different query variations without ever
// looking at what's ACTUALLY rendered wastes time on a problem screen.debug() would reveal instantly
screen.getByRole('button', { name: 'Submit' });     // fails
screen.getByRole('button', { name: /submit/ });        // fails
screen.getByRole('button', { name: /submit/i });          // still fails — but the REAL issue was never the regex

// ✅ CORRECT: call screen.debug() FIRST, the moment a query unexpectedly fails —
// often reveals the actual issue (wrong timing, missing provider, different text) immediately
```

### ⚠️ Pitfall 2: Calling `screen.debug()` on a Huge Tree Without Scoping It
```tsx
// ❌ UNWIELDY: debugging the ENTIRE page for a large app dumps an enormous, hard-to-scan
// console output, when only one specific section was actually relevant to the failing query
screen.debug(); // prints potentially THOUSANDS of lines for a large dashboard

// ✅ CORRECT: scope debug() to the specific element/container actually relevant to the issue
screen.debug(screen.getByRole('main'));
```

### ⚠️ Pitfall 3: Leaving `screen.debug()` Calls in Committed Test Code
`screen.debug()` is a diagnostic tool for **active debugging**, not a permanent fixture — leaving stray `debug()` calls in committed tests clutters CI output with large DOM dumps on every run, for tests that aren't currently failing or being actively investigated. Remove debug calls once the actual issue is diagnosed and fixed, the same discipline as removing stray `console.log` statements before committing.
