---
title: "Accessibility Panel: a11y Addon, axe-core & CI Gates"
sidebar_label: "Accessibility Panel"
sidebar_position: 1
---

# ♿ Accessibility Panel: a11y Addon, axe-core & CI Gates

> **What you see:** Bottom panel tab **Accessibility** (or **A11y**) on every story when `@storybook/addon-a11y` is registered.  
> **What it does:** Runs **axe-core** against the rendered story DOM, lists violations/passes/incomplete checks, and highlights offending elements in the canvas.  
> **What drives it:** `@storybook/addon-a11y`, `parameters.a11y`, and in CI either test-runner + `axe-playwright` or Storybook’s built-in Vitest-based a11y test modes.  
> Related: [Jest/RTL a11y](../../../jest-rtl/pages/14-accessibility-testing/01-a11y-assertions.md) · [Interactions](../05-interaction-testing/01-play-functions.md) · [Test runner](../11-testing-integration/01-test-runner.md)
>
> **📌 Version note:** unlike Controls/Actions/Interactions,
> `@storybook/addon-a11y` was **not** merged into core in Storybook 9/10 —
> it’s still a real dependency you install and register (§3.1 is accurate
> as-is). What did change: `@storybook/addon-essentials` and
> `@storybook/addon-interactions`, shown alongside it in §3.1, are gone as
> of Storybook 9 (core now) — drop them from a current `main.ts`. And for
> CI (§4), Storybook 9+’s Vitest-based "Storybook Test" integration runs
> a11y checks as part of the same run as interaction tests + coverage,
> and is now the default recommendation for Vite-powered projects —
> test-runner + `axe-playwright` (§4.1) still works and is the right choice
> for non-Vite / Playwright-only setups.

## 1. Under-The-Hood Mechanics

```
Story renders in the preview iframe
        │
        ▼
a11y addon runs axe-core on the story root (default: #storybook-root / configured element)
        │
        ▼
Results classified:
  • Violations  — definite rule failures (fix these)
  • Passes      — rules checked and satisfied
  • Incomplete  — needs human judgment (axe couldn’t decide)
        │
        ▼
Click a violation → addon highlights the node(s) in the canvas
        │
        ▼  (optional CI)
test-runner postVisit → checkA11y(...)  OR  a11y test: 'error'
        → build fails on new violations
```

### Why per-story automatic scans beat a yearly audit

| Approach | When issues appear | Who sees them |
|---|---|---|
| Annual audit | Months late | Specialist only |
| Manual checklist on PR | Sometimes | Reviewer if they remember |
| **a11y panel on every story** | While building the component | Author + reviewer in Storybook |
| **+ CI axe** | Before merge | Entire team via red check |

Scanning is **automatic** as you browse stories — no separate `npm run a11y` to forget.

### What axe can and cannot catch

| axe-core is strong at | Requires humans / other tools |
|---|---|
| Missing names on controls | Sensible focus **order** across a full page |
| Invalid ARIA / roles | Whether copy is understandable |
| Many contrast issues (static text) | Contrast of complex gradients / images of text |
| Duplicate IDs, empty links | Screen reader **verbosity** and flow |
| Required parent/child ARIA relationships | Real AT testing (VoiceOver, NVDA) |

Treat a green Accessibility panel as a **necessary baseline (~partial WCAG coverage)**, never a certificate of full accessibility.

---

## 2. What You See in the Accessibility UI

| UI element | Meaning |
|---|---|
| **Violations list** | Rule id + impact (critical / serious / moderate / minor) + count of nodes |
| **Passes** | Rules that ran clean (confidence the basics hold) |
| **Incomplete** | Needs manual check — open details, don’t ignore forever |
| **Highlight** | Selecting a finding outlines the element in the canvas |
| **Re-run** | Re-scan after you change Controls args or fix the component |
| **Empty / disabled** | Addon not installed, or `a11y` disabled for this story |

**Typical fix loop:** open story → red violation “Buttons must have discernible text” → highlight shows icon-only button → add `aria-label` → re-run → green.

---

## 3. Setup & Configuration

### 3.1 Register the addon

```ts
// .storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-a11y", // the one panel here that's still a separate install
    // Storybook 9+: Controls/Actions/Interactions are core — nothing else to add.
    // Pre-9 projects will instead have "@storybook/addon-essentials" and
    // "@storybook/addon-interactions" listed here; drop them on upgrade.
  ],
  framework: { name: "@storybook/react-vite", options: {} },
};

export default config;
```

### 3.2 Global rules in `preview.ts`

```ts
// .storybook/preview.ts
import type { Preview } from "@storybook/react";

const preview: Preview = {
  parameters: {
    a11y: {
      // Storybook 8+: how the addon participates in tests — check your version
      // test: 'todo' | 'error' | 'off',
      config: {
        rules: [
          { id: "color-contrast", enabled: true },
          // Isolated components are not full pages — landmark rules often false-positive
          { id: "landmark-one-main", enabled: false },
          { id: "region", enabled: false },
          { id: "page-has-heading-one", enabled: false },
        ],
      },
      options: {
        // runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
      },
      // element: '#storybook-root', // override root if needed
    },
  },
};

export default preview;
```

**Principle:** disable rules **globally** only when they are meaningless for *all* isolated components (page landmarks). Disable **per story** for one-off false positives.

### 3.3 Per-story / meta overrides

```tsx
// One story is a deliberate non-text contrast experiment
export const ContrastLab: Story = {
  parameters: {
    a11y: {
      config: {
        rules: [{ id: "color-contrast", enabled: false }],
      },
    },
  },
};

// Skip a11y entirely for a known broken legacy snapshot (prefer fixing)
export const LegacyUnfixable: Story = {
  parameters: {
    a11y: { disable: true },
  },
};
```

### 3.4 Stories that document good vs bad patterns

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { IconButton } from "./IconButton";
import { XIcon } from "./icons";
import { fn } from "@storybook/test";

const meta = {
  title: "Components/IconButton",
  component: IconButton,
  args: { onClick: fn() },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Fails a11y: no accessible name */
export const MissingLabel: Story = {
  args: { icon: <XIcon /> },
  parameters: {
    // Optionally tag so CI can allowlist only this educational story
    a11y: {
      /* still useful to show the failure in the panel for training */
    },
  },
};

/** Passes: name exposed to AT */
export const WithAriaLabel: Story = {
  args: { icon: <XIcon />, "aria-label": "Close" },
};
```

Prefer shipping **only** the accessible API in the design system; use “bad” stories sparingly for internal training.

---

## 4. CI: Turning the Panel into a Gate

Two supported paths — pick one, don't run both:

- **Storybook Test (Vitest addon)** — the default recommendation for
  Vite-powered projects since Storybook 9. Runs stories as Vitest tests;
  a11y violations fail the same run as interaction tests, alongside
  coverage. See §4.2.
- **test-runner + axe-playwright** — the older Playwright-based path
  (§4.1). Still correct for non-Vite frameworks or teams already invested
  in test-runner.

### 4.1 test-runner + axe-playwright

```ts
// .storybook/test-runner.ts
import type { TestRunnerConfig } from "@storybook/test-runner";
import { injectAxe, checkA11y } from "axe-playwright";

const config: TestRunnerConfig = {
  async preVisit(page) {
    await injectAxe(page);
  },
  async postVisit(page) {
    await checkA11y(page, "#storybook-root", {
      detailedReport: true,
      detailedReportOptions: { html: true },
      // axe options: runOnly, rules, …
    });
  },
};

export default config;
```

Wire `test-storybook` into GitHub Actions alongside unit tests. See [test-runner](../11-testing-integration/01-test-runner.md).

### 4.2 Storybook Test (Vitest addon) + a11y `test` modes

Storybook 9+’s Vitest-based testing integration (`@storybook/addon-vitest`) treats a11y results as test outcomes via `parameters.a11y.test: ‘todo’ | ‘error’ | ‘off’`, run through `vitest` (or the Storybook "Tests" widget) rather than a separate Playwright pass:

```ts
// preview.ts — fail CI on violations for stories tagged this way
parameters: {
  a11y: { test: "error" },
},
```

Prefer **failing CI on violations** (`’error’`) for design-system packages; use `’todo’` only while remediating a large backlog so signal isn’t ignored entirely.

### 4.3 Dark mode and contrast

A story may pass contrast in light tokens and fail in dark. Run a11y under theme globals:

```tsx
export const Dark: Story = {
  globals: { theme: "dark" }, // matches your toolbar decorator
};
```

Or matrix in test-runner / Chromatic modes + separate a11y visits. See [global colors & themes](../17-theming-colors-and-fonts/01-global-colors-themes-and-tokens.md).

---

## 5. Real-World Engineering Scenario

**Scenario:** Icon-only close button merged “looking fine” in design review.

Visual review and Chromatic were green (icon rendered). Accessibility panel showed **critical**: button has no discernible text. Fix: `aria-label="Close"` (or visible text). Time-to-fix: minutes during development — not a post-release WCAG lawsuit ticket.

Second scenario: modal focus trap. Axe stayed mostly green; **keyboard play** story failed because Tab left the dialog. Lesson: pair a11y panel with Interactions keyboard tests for widgets.

---

## 6. How Accessibility Works With the Other Panels

```
Controls     → change label / disabled / contrast-related props → re-run a11y
Actions      → keyboard activation should fire same callbacks as click
Interactions → prove focus order, escape to close, aria-expanded toggles
Visual tests → catch “focus ring removed” / contrast regressions pixels may show;
               a11y rules catch many contrast issues axe can compute
```

**Suggested review order for a new interactive component:**

1. **Controls** — explore states  
2. **Accessibility** — zero violations on default + critical states  
3. **Interactions** — keyboard + pointer flows with assertions  
4. **Actions** — callbacks fire with correct payloads  
5. **Visual tests** — approve intentional appearance  

---

## 7. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Green panel = fully accessible
```
❌ Ship with only axe green
✅ axe + keyboard play + periodic real screen-reader checks on core flows
```

### ⚠️ Pitfall 2: Global rule disable to silence one story
```ts
// ❌ preview.ts disables color-contrast everywhere
// ✅ only ContrastLab story disables it
```

### ⚠️ Pitfall 3: Panel-only, no CI
Without test-runner/CI, violations are **optional**. Engineers skip the tab under deadline pressure. Automate the gate.

### ⚠️ Pitfall 4: Scanning only the happy path story
`Default` passes; `Error` with red text on red background fails contrast; `Disabled` loses name. Cover **states** with stories (or Controls + manual re-run + CI matrix).

### ⚠️ Pitfall 5: False confidence on incomplete results
**Incomplete** is not a pass. Schedule manual review for those rules (e.g. some contrast cases).

### ⚠️ Pitfall 6: Fixing a11y only in Storybook wrappers
If the decorator adds `aria-label` but the real app usage doesn’t, you fake green results. Fix the **component API** so correct usage is the default.

### ⚠️ Pitfall 7: Landmark noise
Full-page rules (`region`, `landmark-one-main`) fire on isolated buttons. Disable those **globally for component libraries**; keep them for full-page composition stories if you have any.

---

## 8. Checklist

```
[ ] @storybook/addon-a11y in main.ts addons
[ ] preview a11y rules tuned for components (not full pages)
[ ] Exceptions scoped per story, not globally
[ ] Critical components: default + error + disabled + dark stories scanned
[ ] Interactive widgets: keyboard play functions, not only axe
[ ] CI runs axe via test-runner (or a11y test: 'error')
[ ] Design system APIs force accessible names (required props / types)
[ ] Team treats incomplete results as work, not noise
```

---

## 9. Related panels

| Panel | Relationship |
|---|---|
| **Controls** | Re-scan after prop changes that affect text, roles, visibility |
| **Actions** | Verify AT-friendly activation still invokes handlers |
| **Interactions** | Behavioral a11y (focus, keyboard) beyond static axe rules |
| **Visual tests** | Appearance regressions; not a substitute for axe |
