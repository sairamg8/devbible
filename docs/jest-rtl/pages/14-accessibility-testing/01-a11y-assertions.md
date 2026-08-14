---
title: "Accessibility Testing: `jest-axe`, Accessible Name Matchers & Role-Based Queries"
sidebar_label: "Accessibility Testing"
sidebar_position: 1
---

# 🧪 Accessibility Testing: `jest-axe`, Accessible Name Matchers & Role-Based Queries

## 1. Under-The-Hood Mechanics

Accessibility testing in this stack operates at two distinct levels — automated, rule-based violation scanning (`jest-axe`) and targeted, specific ARIA-correctness assertions (`jest-dom`'s matchers) — plus a happy side effect from RTL's own query system.

```
jest-axe: render the component ──► axe.run(container) ──► scans against WCAG rule set
                                        │
                                        ▼
                              toHaveNoViolations() ──► fails with a DETAILED report of
                                                          which specific rule(s) were violated
                                                          (missing alt text, insufficient contrast,
                                                           a form control with no accessible label, ...)

jest-dom matchers: toHaveAccessibleName() / toHaveAccessibleDescription()
                       ──► asserts the COMPUTED accessible name/description an actual screen
                             reader would announce — not just a raw attribute value
```

### Automated Scanning vs Targeted Assertions: Different Coverage
`jest-axe` catches a **broad class** of common, rule-expressible violations automatically (missing labels, poor contrast, invalid ARIA attribute usage) across an entire rendered component — but it cannot verify deeper, judgment-based correctness (whether a modal correctly traps focus, whether the reading order genuinely makes sense) the way a specific, deliberately-written assertion can. The two approaches are complementary, not substitutes for each other.

### RTL's Query Priority as an Implicit A11y Check
As covered in the [RTL queries doc](../08-rtl-queries/01-query-variants-and-priority.md), consistently using `getByRole` (the recommended default) means a test can only find an element **if it's genuinely identifiable by role and accessible name** — a component that's technically visible but has no accessible name at all simply cannot be queried this way, meaning a large fraction of accessibility regressions surface as query failures automatically, without any dedicated a11y-specific tooling required at all.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Redesigned Icon-Only Button Passing All Existing Tests While Being Completely Inaccessible.
A design refactor replaced a text-labeled "Delete" button with an icon-only trash-can button, using `getByTestId('delete-button')` in the existing test — which still passed, since the `data-testid` attribute was preserved through the redesign, structurally blind to the fact that the button now had **no accessible name at all** for screen reader users. Running `jest-axe` against the component caught this immediately (a "button has no accessible name" rule violation), and switching the test's query to `getByRole('button', { name: /delete/i })` meant the test itself would have failed the moment the accessible name was lost — regardless of whether `jest-axe` was run, since the query itself depends on that accessible name existing.

---

## 3. Production-Grade Code Example

```tsx
// jest-axe — automated WCAG rule violation scanning
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('SignupForm has no automatically-detectable accessibility violations', async () => {
  const { container } = render(<SignupForm />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

```tsx
// jest-dom accessible name/description matchers — targeted ARIA correctness
test('delete button has a clear accessible name despite being icon-only', () => {
  render(<IconButton icon={<TrashIcon />} ariaLabel="Delete item" />);
  const button = screen.getByRole('button');
  expect(button).toHaveAccessibleName('Delete item'); // verifies the COMPUTED name, not just a raw attribute
});

test('form field has an accessible description linking its validation hint', () => {
  render(<PasswordField />);
  const input = screen.getByLabelText(/password/i);
  expect(input).toHaveAccessibleDescription('Must be at least 8 characters'); // via aria-describedby
});
```

```tsx
// Role-based queries as an implicit accessibility check — this test FAILS if the accessible name is lost
test('delete button is discoverable by its accessible role and name', () => {
  render(<IconButton icon={<TrashIcon />} ariaLabel="Delete item" />);
  // If a future redesign removes ariaLabel, THIS QUERY ITSELF fails immediately — no separate
  // a11y-specific tooling run required to catch the regression
  expect(screen.getByRole('button', { name: /delete item/i })).toBeInTheDocument();
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Relying Solely on `getByTestId`, Structurally Blind to Accessibility Regressions
As the scenario above demonstrates, a `data-testid`-based query survives an accessible-name-removing redesign completely unaffected — providing zero signal about the actual accessibility regression. Preferring `getByRole` (per the [RTL queries priority doc](../08-rtl-queries/01-query-variants-and-priority.md)) makes this exact class of regression a natural, automatic test failure.

### ⚠️ Pitfall 2: Treating a Passing `jest-axe` Scan as "Fully Accessible"
```
❌ OVERCONFIDENT: jest-axe catches automatically-detectable, rule-expressible violations —
it CANNOT verify keyboard navigation order makes logical sense, whether focus is correctly
trapped in a modal, or whether a screen reader's ANNOUNCED experience is genuinely coherent
end-to-end. Automated tools estimate that they catch roughly 30-50% of real WCAG issues —
a clean jest-axe run is necessary, not sufficient, evidence of genuine accessibility

✅ CORRECT: pair automated scanning with periodic REAL screen reader testing and manual
keyboard-only navigation testing for anything genuinely accessibility-critical
```

### ⚠️ Pitfall 3: Running `jest-axe` Against an Unmounted or Loading State Only
```tsx
// ❌ INCOMPLETE: scanning only the component's initial/default render state misses violations
// that only exist in OTHER states — an error message that appears without an accessible
// role, a loading spinner with no aria-live announcement, a modal's post-open focus state
test('has no violations', async () => {
  const { container } = render(<Form />); // only the DEFAULT state ever gets scanned
  expect(await axe(container)).toHaveNoViolations();
});

// ✅ CORRECT: scan meaningfully different states too — after an error, after a successful
// submission, with a modal open — not just the component's very first render
test('has no violations in the error state', async () => {
  const { container } = render(<Form initialError="Invalid email" />);
  expect(await axe(container)).toHaveNoViolations();
});
```
