---
title: "Component Testing: Mounting Components in a Real Browser"
sidebar_label: "Component Testing"
sidebar_position: 1
---

# 🎭 Component Testing: Mounting Components in a Real Browser

## 1. Under-The-Hood Mechanics

Playwright's Component Testing (CT) runner occupies a distinct middle ground between RTL's jsdom-based component tests and full E2E page-navigation tests — it mounts an **individual component** (not a full page/route), but renders it in a **genuinely real browser engine**, not a simulated DOM.

```
RTL (jsdom):                       Playwright CT:                       Full E2E:
render(<Button />)                  mount(<Button />)                     page.goto('/checkout')
        │                                    │                                    │
        ▼                                    ▼                                    ▼
Simulated DOM (jsdom)              REAL Chromium/Firefox/WebKit         REAL browser, REAL app,
- fast, no real browser              - real layout/paint/CSS engine       full navigation/routing
- some browser APIs approximated       - genuinely accurate rendering       - slowest, most realistic
                                          - still ISOLATED to one component,   - tests the WHOLE integrated app
                                            not full page navigation
```

### `mount()`: Component-Level, Not Page-Level
`mount()` renders a single component (with props/slots) directly, in isolation — similar in spirit to RTL's `render()`, but backed by an actual browser engine rather than jsdom's simulation. This matters specifically for components whose correctness depends on **real** browser rendering behavior (actual CSS layout computation, real `getBoundingClientRect()` values, genuine animation/transition timing) that jsdom only approximates or doesn't support at all.

### When CT Fits Between Unit and Full E2E
Component testing is appropriate when a component's behavior is genuinely sensitive to real rendering (layout-dependent logic, actual visual measurements) but doesn't need the overhead and setup of a full page navigation/routing/backend-integration E2E test — a narrower, faster alternative to full E2E specifically for components where jsdom's simulation would be insufficient or where full-page setup would be unnecessary overhead for what's being verified.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Virtualized List Component Whose Scroll-Position-Based Rendering Logic Behaved Differently Under jsdom vs a Real Browser.
A virtualized list component computed which rows to render based on actual `getBoundingClientRect()` measurements and real scroll event timing — jsdom's approximation of these APIs didn't accurately reflect real browser layout/scroll behavior, causing RTL-based tests to pass while a genuine bug in the real-browser rendering logic went undetected. Migrating this specific component's tests to Playwright's CT runner (mounting it in an actual browser engine) exercised the real layout/scroll APIs the component's logic actually depended on, immediately surfacing the discrepancy that jsdom's simulation had been masking.

---

## 3. Production-Grade Code Example

```typescript
// playwright-ct.config.ts — component testing configuration
import { defineConfig, devices } from '@playwright/experimental-ct-react';

export default defineConfig({
  testDir: './src',
  use: { ctPort: 3100 },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
});
```

```tsx
// VirtualizedList.spec.tsx — mounting a component directly, in a real browser
import { test, expect } from '@playwright/experimental-ct-react';
import { VirtualizedList } from './VirtualizedList';

test('renders only visible rows based on real scroll position', async ({ mount }) => {
  const component = await mount(
    <VirtualizedList items={Array.from({ length: 10000 }, (_, i) => `Item ${i}`)} itemHeight={40} height={400} />
  );

  // Real browser layout/scroll — genuinely exercises getBoundingClientRect()/scroll timing,
  // not jsdom's approximation of it
  await expect(component.getByText('Item 0')).toBeVisible();
  await expect(component.getByText('Item 500')).not.toBeVisible(); // correctly virtualized OUT of the DOM

  await component.evaluate((el) => { el.scrollTop = 20000; });
  await expect(component.getByText('Item 500')).toBeVisible(); // now scrolled INTO view, real browser confirms it
});
```

```tsx
// Testing real CSS-dependent behavior (e.g. a tooltip that repositions based on actual viewport edges)
test('tooltip repositions when near the viewport edge', async ({ mount, page }) => {
  await page.setViewportSize({ width: 400, height: 300 });
  const component = await mount(<Tooltip content="Info" position="right" />);

  await component.getByRole('button').hover();
  // Real browser layout determines the ACTUAL rendered position — jsdom has no real
  // viewport/layout engine capable of verifying this kind of edge-avoidance logic at all
  await expect(component.getByRole('tooltip')).toHaveCSS('left', /.+/); // genuinely computed position
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Using Component Testing for Everything, Losing RTL's Speed Advantage
```
❌ SUBOPTIMAL: migrating EVERY component test to Playwright CT, including simple components
with no real-browser-dependent behavior, trades away jsdom-based RTL's significant speed
advantage for no actual benefit — a real browser engine is meaningfully slower to spin up
and render against than jsdom's simulation, for components that never needed that fidelity

✅ CORRECT: reserve Playwright CT specifically for components whose correctness GENUINELY
depends on real browser rendering/layout/timing; keep the bulk of component tests on
RTL's faster jsdom-based approach
```

### ⚠️ Pitfall 2: Treating Component Testing as a Replacement for Full E2E Coverage
Component testing verifies a component in isolation — it does NOT verify how that component integrates with real routing, a real backend, or the rest of the actual application. A component passing all its CT tests can still be wired up incorrectly at the integration level (wrong props passed from a parent, a route never actually rendering it) — full E2E coverage remains necessary for verifying genuine end-to-end user flows, not just isolated component correctness.

### ⚠️ Pitfall 3: Forgetting Component Testing Is Still Marked Experimental
Playwright's Component Testing runner has historically carried an "experimental" designation with API surface still evolving between versions — teams adopting it for significant test coverage should track its stability status and be prepared for potential breaking changes across Playwright version upgrades, unlike the fully-stable core E2E API.
