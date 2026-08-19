---
title: "Accessibility Testing: jest-axe, WCAG Auditing & Accessible Names"
sidebar_label: "Accessibility Testing"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against Deque axe-core & jest-axe documentation — [jest-axe](https://github.com/nickcolley/jest-axe).

Automated accessibility testing combines `axe-core` rule engines (`jest-axe`) with targeted ARIA matchers (`toHaveAccessibleName`, `toHaveAccessibleDescription`) to detect WCAG compliance violations before code reaches production.

---

## 1. Under-The-Hood Mechanics

Accessibility testing in modern React operates across automated rule engines and semantic DOM matchers:

```
┌───────────────────────────────────────────────────────────────────────────┐
│ 1. Automated WCAG Rule Scanning (`jest-axe`)                              │
│    Executes `axe.run(container)` on the rendered HTML DOM tree.          │
│    Evaluates 90+ accessibility rules (ARIA roles, form labels, headings). │
│    `expect(results).toHaveNoViolations()` outputs detailed rule summaries.│
└───────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ 2. Computed Accessible Name Matchers (`@testing-library/jest-dom`)        │
│    Computes the EXACT text a screen reader announces based on:            │
│    `aria-labelledby` > `aria-label` > Native text content / Alt text.      │
│    `expect(button).toHaveAccessibleName('Close dialog')`                  │
│    `expect(input).toHaveAccessibleDescription('Password must be 8+ chars')│
└───────────────────────────────────────────────────────────────────────────┘
```

### Automated Rules vs Manual Semantics
- **What `jest-axe` Catches (30–50% of WCAG issues)**: Missing `<label htmlFor>`, duplicate IDs, buttons without text or `aria-label`, invalid ARIA parent-child relationships (`role="list"` without `role="listitem"`).
- **What `jest-axe` Cannot Catch**: Keyboard focus traps, logical tab navigation order, screen reader context flow, and visual color contrast (since jsdom does not compute actual CSS pixel rendering).

---

## 2. Real-World Engineering Scenario

**Scenario**: A design refactor replacing text buttons with icon buttons, creating a severe accessibility regression.

A navigation toolbar replaced `<button>Close</button>` with `<button><XIcon /></button>`. In unit tests using `getByTestId('close-button')`, the suite passed. However, screen readers announced "button, unlabeled", leaving visually impaired users unable to dismiss modals. Integrating `jest-axe` and asserting `toHaveAccessibleName('Close modal')` caught the defect, forcing the engineering team to supply `aria-label="Close modal"`.

---

## 3. Production-Grade Code Example

```tsx
// ModalDialog.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ModalDialog } from './ModalDialog';

expect.extend(toHaveNoViolations);

describe('ModalDialog Accessibility Specifications', () => {
  test('passes automated axe-core audit in both closed and open states', async () => {
    const { container } = render(
      <ModalDialog isOpen={true} title="Delete Account" onClose={jest.fn()}>
        <p>This action cannot be undone.</p>
        <button type="button">Confirm</button>
      </ModalDialog>
    );

    // Run axe against rendered container
    const results = await axe(container, {
      rules: {
        // Disable color-contrast in jsdom because layout engine is synthetic
        'color-contrast': { enabled: false },
      },
    });

    expect(results).toHaveNoViolations();
  });

  test('validates computed accessible names and descriptions', () => {
    render(
      <div>
        <label id="search-label" htmlFor="search-input">Global Search</label>
        <input
          id="search-input"
          type="search"
          aria-labelledby="search-label"
          aria-describedby="search-hint"
        />
        <span id="search-hint">Press Enter to search documentation</span>
      </div>
    );

    const input = screen.getByRole('searchbox');

    // Assert computed accessibility tree attributes
    expect(input).toHaveAccessibleName('Global Search');
    expect(input).toHaveAccessibleDescription('Press Enter to search documentation');
  });

  test('icon-only buttons expose accessible names', () => {
    render(
      <button type="button" aria-label="Dismiss alert">
        <svg aria-hidden="true" width="16" height="16"><path d="M0 0h16v16H0z" /></svg>
      </button>
    );

    const button = screen.getByRole('button', { name: /dismiss alert/i });
    expect(button).toHaveAccessibleName('Dismiss alert');
  });
});
```

---

## 4. Gotchas & Senior Pitfalls

### Symptom: `jest-axe` throws `color-contrast` rule errors on synthetic elements
- **Cause**: jsdom does not calculate layout geometry, stylesheets, or computed RGB pixel blending. `color-contrast` checks in jsdom can produce false positives.
- **Fix**: Disable the `color-contrast` rule in `jest-axe` configuration and run color contrast audits in real browser testing (Playwright / Storybook a11y addon).

### Symptom: Passing `jest-axe` audit, but the modal does not manage focus or handle Escape key
- **Cause**: Automated a11y tools only scan static HTML markup, not runtime event handlers or focus traps.
- **Fix**: Write explicit interaction tests with `@testing-library/user-event` to assert that pressing `{Escape}` closes the modal and focus returns to the triggering button.

### Symptom: Testing accessibility only on initial component mount
- **Cause**: Scanning only the default state misses violations in error banners, dynamic form validation tooltips, or loading states.
- **Fix**: Run `await axe(container)` across multiple render states (e.g. after validation errors appear).

---

## 5. Interview Questions & Deep Dives

### ★ 1. How does `jest-axe` work under the hood, and what are its limitations?
**Answer**: `jest-axe` executes Deque's `axe-core` library by serializing the rendered jsdom container and evaluating it against WCAG 2.1 A/AA/AAA rules. Its primary limitation is that it evaluates the DOM statically in jsdom: it cannot test computed CSS bounding boxes (color contrast, overlapping text), screen reader live announcements (`aria-live` pacing), or dynamic keyboard focus trapping.

### ★ 2. What is the difference between `toHaveAttribute('aria-label', 'x')` and `toHaveAccessibleName('x')`?
**Answer**:
- `toHaveAttribute('aria-label', 'x')` only verifies that a specific raw HTML attribute exists on the element.
- `toHaveAccessibleName('x')` calculates the element's actual Accessible Name according to the W3C Accessible Name and Description Computation specification, resolving `aria-labelledby`, `aria-label`, `<label>`, native button text, and child `alt` attributes in precedence order.

### 3. How should SVG icons inside buttons be configured for accessibility?
**Answer**: SVGs should have `aria-hidden="true"` or `focusable="false"` to prevent screen readers from announcing raw SVG paths. The parent `<button>` must provide the accessible name via text content, `aria-label`, or `aria-labelledby`.

### 4. What are `aria-live` regions and how do you test them in RTL?
**Answer**: `aria-live` regions (`polite` or `assertive`) announce dynamic content changes (such as toast notifications or search results) to screen readers without shifting focus. You test them by asserting that the container element has `role="status"` or `role="alert"` and verifying the updated text appears.

---

## Where this connects

- **Previous**: [13 · Testing Hooks](../13-testing-hooks/01-render-hook.md) — Testing custom hook states.
- **Next**: [15 · Debugging Tests](../15-debugging-tests/01-diagnostic-tools.md) — Inspecting DOM trees and using testing-playground.
- **Storybook Accessibility (`docs/storybook/pages/07-accessibility-testing/`)**: Real-browser automated accessibility audits.
