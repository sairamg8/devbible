---
title: "Debugging Tests: screen.debug, logRoles & Testing Playground"
sidebar_label: "Debugging Tests"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-19 against Testing Library documentation — [Debugging](https://testing-library.com/docs/dom-testing-library/api-debugging).

React Testing Library provides diagnostic inspection utilities (`screen.debug`, `logRoles`, `logTestingPlaygroundURL`, `prettyDOM`) to inspect synthetic jsdom trees, determine valid ARIA roles, and generate optimal queries without trial-and-error guessing.

---

## 1. Under-The-Hood Mechanics

When test queries fail, RTL offers direct introspection methods that serialize the DOM and accessibility tree to the terminal:

```
Diagnostic Tooling Pipeline:
  ├── screen.debug(element?, maxLength?)
  │     └── Serializes the active DOM tree using `prettyDOM()`.
  │     └── Highlighted with ANSI colors; truncated at `DEBUG_PRINT_LIMIT` (default: 7000 chars).
  │
  ├── logRoles(container)
  │     └── Computes the browser Accessibility Tree for the provided container.
  │     └── Prints table of: ARIA role, Accessible Name, and HTML element tag.
  │
  └── screen.logTestingPlaygroundURL()
        └── Generates an interactive URL at testing-playground.com loaded with current DOM HTML.
        └── Suggests optimal, prioritized RTL queries by clicking interactive elements in browser.
```

---

## 2. Real-World Engineering Scenario

**Scenario**: Debugging a complex custom date picker dropdown where `getByRole('button')` throws "unable to find element".

A calendar dropdown had nested composite buttons and tablist headers. A developer spent 20 minutes guessing regex strings (`/select date/i`, `/calendar/i`) to query the trigger button. Running `logRoles(container)` printed the exact computed accessibility tree: the trigger was actually rendered with `role="combobox", name="Choose departure date"`. Using the printed role and accessible name fixed the query in seconds.

---

## 3. Production-Grade Code Example

```tsx
// DatePicker.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { logRoles } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { DatePicker } from './DatePicker';

describe('DatePicker Diagnostic Debugging Specifications', () => {
  test('inspects accessible roles and generates testing playground URL', async () => {
    const user = userEvent.setup();
    const { container } = render(<DatePicker label="Departure Date" />);

    // 1. Log computed accessible roles to terminal for inspection
    logRoles(container);
    /* Terminal Output:
      combobox:
        Name "Departure Date":
        <input role="combobox" aria-expanded="false" />
      button:
        Name "Open calendar picker":
        <button type="button" />
    */

    // 2. Open dropdown
    const trigger = screen.getByRole('button', { name: /open calendar picker/i });
    await user.click(trigger);

    // 3. Print scoped subtree of the opened popover
    const popover = screen.getByRole('dialog', { name: /calendar/i });
    screen.debug(popover);

    // 4. In case of complex layout debugging, generate playground URL
    if (process.env.DEBUG_TEST) {
      screen.logTestingPlaygroundURL();
      // Outputs: https://testing-playground.com/#markup=...
    }

    // 5. Query verified element
    const dayButton = screen.getByRole('gridcell', { name: '15' });
    await user.click(dayButton);

    expect(screen.getByRole('combobox')).toHaveValue('2026-08-15');
  });
});
```

---

## 4. Gotchas & Senior Pitfalls

### Symptom: `screen.debug()` output is truncated with `...` in the console
- **Cause**: DOM serialization exceeds the default character limit (7000 characters).
- **Fix**: Increase the limit by passing a character size: `screen.debug(undefined, Infinity)`, or set `process.env.DEBUG_PRINT_LIMIT = '100000'`.

### Symptom: `screen.debug()` dumps thousands of irrelevant HTML lines to the terminal
- **Cause**: Calling `screen.debug()` with no arguments on a full page / dashboard component tree.
- **Fix**: Pass the specific sub-element you are investigating: `screen.debug(screen.getByRole('form'))`.

### Symptom: Polluting CI build logs with permanent `screen.debug()` statements
- **Cause**: Forgetting to remove temporary debugging calls before pushing commits.
- **Fix**: Add the ESLint rule `testing-library/no-debugging-utils` to automatically fail linting if `screen.debug()` or `logRoles()` is committed.

---

## 5. Interview Questions & Deep Dives

### ★ 1. How does `logRoles()` help developers write accessible queries?
**Answer**: `logRoles(domNode)` traverses the subtree, computes the computed ARIA role for each element according to W3C ARIA specifications, calculates their accessible names, and prints a hierarchical tree. This eliminates guesswork regarding whether an element has an implicit role (e.g. `<nav>` is `navigation`, `<dialog>` is `dialog`, `<select>` is `combobox`).

### ★ 2. What is `screen.logTestingPlaygroundURL()`, and how does it work?
**Answer**: It serializes the current state of `document.body` into compressed HTML and outputs a URL to `testing-playground.com`. Opening the URL in a browser renders the live HTML inside a visual sandbox where you can click any element to see recommended RTL query code ranked by RTL's official query priority.

### 3. How do you attach a Node inspector breakpoint to debug a Jest test in VS Code or Chrome?
**Answer**: Run Jest with Node's inspect flag:
`node --inspect-brk ./node_modules/.bin/jest --runInBand src/MyTest.test.tsx`
Place `debugger;` statements inside your test or component code. Connect via Chrome DevTools (`chrome://inspect`) or the VS Code Debugger to step through React component fiber rendering line-by-line.

### 4. What is the difference between `screen.debug()` and `console.log(container.innerHTML)`?
**Answer**: `container.innerHTML` outputs raw, unformatted, single-line HTML strings without styling. `screen.debug()` uses `prettyDOM()` to format HTML with indentation, syntax highlighting via ANSI terminal colors, and respects the `DEBUG_PRINT_LIMIT` buffer configuration.

---

## Where this connects

- **Previous**: [14 · Accessibility Testing](../14-accessibility-testing/01-a11y-assertions.md) — Verifying accessible roles and WCAG compliance.
- **Next**: [16 · Testing Setup from Zero](../16-real-world-workflows-and-recipes/01-testing-setup-from-zero.md) — Comprehensive setup recipe with Jest, RTL, and MSW.
- **RTL Queries**: [08 · RTL Queries](../08-rtl-queries/01-query-variants-and-priority.md) — Query prioritization hierarchy.
