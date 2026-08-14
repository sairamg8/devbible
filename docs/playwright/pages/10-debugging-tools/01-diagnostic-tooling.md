---
title: "Debugging Tools: Trace Viewer, Inspector, Codegen & UI Mode"
sidebar_label: "Debugging Tools"
sidebar_position: 1
---

# 🎭 Debugging Tools: Trace Viewer, Inspector, Codegen & UI Mode

## 1. Under-The-Hood Mechanics

Playwright's debugging tooling spans two very different moments: **during** active test authoring/debugging (Inspector, codegen, UI Mode) and **after the fact**, reconstructing exactly what happened in a completed (often CI) test run (Trace Viewer).

```
Trace Viewer (POST-MORTEM analysis):
  playwright.config.ts: trace: 'retain-on-failure' (or 'on-first-retry', etc.)
        │
        ▼
On a failed test, Playwright records a TRACE FILE containing:
  - a DOM snapshot at EVERY action
  - full network activity
  - console logs
  - a timeline scrubber to step through EXACTLY what the browser saw, action by action
        │
        ▼
npx playwright show-trace trace.zip   ──► opens the interactive Trace Viewer UI

Inspector (LIVE, interactive debugging):
  PWDEBUG=1 npx playwright test   ──► pauses execution, opens an interactive step-through debugger,
                                         with a live selector picker for building locators

codegen (RECORDING interactions INTO code):
  npx playwright codegen https://example.com   ──► opens a browser; every click/fill/navigation
                                                       you perform is recorded as GENERATED test code

UI Mode (interactive, watch-mode test running):
  npx playwright test --ui   ──► a full interactive runner: watch mode, TIME-TRAVEL debugging
                                    through a test's actions, re-running individual tests on demand
```

### Trace Viewer: Reconstructing a CI Failure Without Reproducing It Locally
Because a trace captures a DOM snapshot at **every single action**, a failure that only reproduces in CI (different timing, different environment) can be fully investigated **after the fact** by opening the recorded trace — seeing exactly what the page looked like, what network calls were in flight, and what the console showed at the precise moment of failure, without needing to reproduce the flaky condition locally at all.

### `codegen`: Generating a Starting Point, Not a Finished Test
Recording interactions via codegen produces working, executable test code immediately — but it typically generates locators based on whatever it can find (sometimes CSS selectors, not always the ideal `getByRole` semantic locator) and captures no meaningful assertions beyond the recorded actions themselves. It's best treated as a fast way to get a **rough draft** of interaction code, which then needs review/refinement (better locators, added assertions) rather than a finished test to commit as-is.

---

## 2. Real-World Engineering Scenario

**Scenario**: A CI-Only Failure Diagnosed in Minutes via Trace Viewer, Instead of Days of Attempted Local Reproduction.
A test failed intermittently in CI but never locally, despite repeated attempts to reproduce it on a developer's machine — a classic, frustrating flaky-test investigation. With `trace: 'on-first-retry'` configured, the CI run's failed attempt automatically produced a trace file, uploaded as a CI artifact. Opening it in Trace Viewer immediately revealed the actual cause: a network request that occasionally resolved slower under real CI load than the developer's fast local machine, timing out a specific action just past its default timeout window — visible directly in the trace's network panel, a diagnosis that would have taken far longer (or never happened at all) without being able to see exactly what the CI run's browser actually experienced.

---

## 3. Production-Grade Code Example

```typescript
// playwright.config.ts — configuring automatic trace/video/screenshot capture on failure
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    trace: 'on-first-retry', // capture a trace ONLY when a test is retried after failing — avoids overhead on passing runs
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  retries: process.env.CI ? 2 : 0, // retry in CI (generating a trace on the retry if it fails again)
});
```

```bash
# Trace Viewer — investigating a CI failure after the fact, from a downloaded trace artifact
npx playwright show-trace trace.zip

# Inspector — live, interactive step-through debugging with a selector picker
PWDEBUG=1 npx playwright test checkout.spec.ts

# codegen — recording a rough draft of test code by interacting with a real browser
npx playwright codegen https://staging.acme.com

# UI Mode — interactive watch-mode runner with time-travel debugging
npx playwright test --ui
```

```typescript
// A codegen-generated test (rough draft) BEFORE refinement
test('test', async ({ page }) => {
  await page.goto('https://staging.acme.com/');
  await page.locator('div:nth-child(3) > button').click(); // ❌ fragile, generated CSS selector
});

// AFTER refinement — replacing the generated selector with a proper semantic locator, adding an assertion
test('adds the first product to the cart', async ({ page }) => {
  await page.goto('https://staging.acme.com/');
  await page.getByRole('button', { name: 'Add to Cart' }).first().click(); // ✅ semantic, resilient locator
  await expect(page.getByTestId('cart-count')).toHaveText('1'); // ✅ an actual assertion, not just recorded actions
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Committing Raw `codegen` Output Without Refinement
```typescript
// ❌ FRAGILE: generated selectors are often brittle (nth-child, auto-generated CSS classes),
// and recorded interactions rarely include meaningful assertions beyond the actions themselves
await page.locator('.css-1a2b3c > div:nth-child(2)').click();

// ✅ CORRECT: treat codegen output as a rough draft — replace fragile selectors with semantic
// locators (getByRole/getByLabel/getByText) and add real assertions before committing
```

### ⚠️ Pitfall 2: Capturing Traces on Every Run, Not Just Failures
```typescript
// ❌ WASTEFUL: trace: 'on' captures a trace for EVERY test, including passing ones — significant
// storage/CI artifact overhead for data that's almost never actually needed (passing tests don't need debugging)
use: { trace: 'on' },

// ✅ CORRECT: capture traces only when something actually needs investigating
use: { trace: 'on-first-retry' }, // or 'retain-on-failure' — only pay the overhead when it's useful
```

### ⚠️ Pitfall 3: Debugging Locally With `PWDEBUG=1` Left Enabled in a Committed Script
```bash
# ❌ WRONG: leaving PWDEBUG=1 set in a CI script accidentally pauses EVERY test run,
# waiting indefinitely for manual interaction with the Inspector — CI hangs forever
PWDEBUG=1 npm run test:e2e   # committed into a CI script by mistake

# ✅ CORRECT: PWDEBUG is a LOCAL, interactive debugging tool — never set in CI/automated scripts
npm run test:e2e   # CI runs normally, without any interactive debugging flag set
```
