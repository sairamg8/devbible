---
title: "Visual & Screenshot Testing: `toHaveScreenshot()` & Baseline Management"
sidebar_label: "Visual & Screenshot Testing"
sidebar_position: 1
---

# 🎭 Visual & Screenshot Testing: `toHaveScreenshot()` & Baseline Management

## 1. Under-The-Hood Mechanics

Visual regression testing captures a **pixel-level baseline image** on first run, then compares every subsequent test run's screenshot against that stored baseline — catching visual regressions (broken CSS, layout shifts, a missing icon) that purely behavioral/DOM-based assertions can't detect at all.

```
expect(page).toHaveScreenshot('checkout-page.png')
        │
        ▼
FIRST run: no baseline exists ──► CAPTURES the current render as the baseline, test PASSES
        │
        ▼
SUBSEQUENT runs: captures a NEW screenshot ──► PIXEL-DIFFS against the stored baseline
        │
        ├── within threshold/maxDiffPixels tolerance ──► PASSES
        └── exceeds tolerance                              ──► FAILS, produces a visual diff image
```

### Threshold & `maxDiffPixels` Tuning: Absorbing Legitimate Rendering Variance
Pixel-perfect exact matching is often too strict in practice — sub-pixel font rendering differences between machines/OS versions, anti-aliasing variance, and minor timing-dependent animation states can all cause a small, meaningless pixel difference between otherwise-identical renders. `threshold` (a per-pixel color difference tolerance) and `maxDiffPixels`/`maxDiffPixelRatio` (how many total differing pixels are tolerated before failing) absorb this legitimate noise, while still catching genuine visual regressions (a broken layout, a wrong color, a missing element) that produce far larger, more significant differences.

### Updating Baselines: A Deliberate Workflow, Not a Reflex
`--update-snapshots` regenerates every baseline image to match the current render — exactly like the snapshot-testing "reflexive approval" risk covered in the [Jest snapshot testing doc](../../../jest-rtl/pages/05-snapshot-testing/01-snapshot-mechanics.md), running this command should follow a **deliberate visual review** of what actually changed, not be a reflexive fix for a failing visual test.

---

## 2. Real-World Engineering Scenario

**Scenario**: A CSS Regression Undetectable by Behavioral Tests, Caught Immediately by Visual Testing.
A shared CSS utility class change accidentally broke the visual alignment of a pricing table's columns — every behavioral RTL/Playwright assertion (button clickable, text present, correct values) still passed, since the underlying DOM structure and content were entirely unchanged; only the **visual layout** was broken. A `toHaveScreenshot()` visual regression test on the pricing page failed immediately, showing a clear pixel diff highlighting exactly which region of the page had shifted — a class of bug purely behavioral testing is structurally incapable of catching, since it never inspects actual rendered pixel layout at all.

---

## 3. Production-Grade Code Example

```typescript
// Basic visual regression test, with tuned tolerance for legitimate rendering variance
test('pricing page visual layout is unchanged', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page).toHaveScreenshot('pricing-page.png', {
    maxDiffPixelRatio: 0.01, // tolerate up to 1% differing pixels — absorbs anti-aliasing/font-rendering noise
  });
});
```

```typescript
// Scoping a screenshot to a SPECIFIC element, not the whole page — more stable, more targeted
test('the checkout summary card renders correctly', async ({ page }) => {
  await page.goto('/checkout');
  const summaryCard = page.getByTestId('order-summary');
  await expect(summaryCard).toHaveScreenshot('order-summary-card.png');
});
```

```typescript
// Masking genuinely dynamic content that would otherwise cause false failures every run
test('dashboard visual layout, masking the live timestamp', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveScreenshot('dashboard.png', {
    mask: [page.getByTestId('last-updated-timestamp')], // excluded from the pixel comparison entirely
  });
});
```

```bash
# Reviewing and deliberately updating baselines after an INTENTIONAL visual change
npx playwright test --update-snapshots
# ALWAYS visually review the diff/new baseline images before committing them —
# never run this reflexively just to make a failing test pass
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Zero Tolerance (`maxDiffPixelRatio: 0`) Causing Constant False Failures
```typescript
// ❌ TOO STRICT: exact pixel-perfect matching fails on minor, meaningless rendering differences
// between machines/CI runners (different font rendering, different sub-pixel anti-aliasing)
await expect(page).toHaveScreenshot('page.png', { maxDiffPixelRatio: 0 });

// ✅ CORRECT: a small, deliberate tolerance absorbs legitimate noise while still catching real regressions
await expect(page).toHaveScreenshot('page.png', { maxDiffPixelRatio: 0.01 });
```

### ⚠️ Pitfall 2: Not Masking Genuinely Dynamic Content, Causing Every Run to "Fail"
```typescript
// ❌ WRONG: a live timestamp, a randomly-generated avatar, or rotating promotional banner
// content changes EVERY run, causing this test to fail constantly for reasons unrelated
// to any actual visual regression
await expect(page).toHaveScreenshot('dashboard.png'); // includes the ever-changing timestamp

// ✅ CORRECT: explicitly mask elements known to vary run-to-run, keeping the comparison
// meaningful for the STABLE parts of the page that visual testing should actually verify
await expect(page).toHaveScreenshot('dashboard.png', { mask: [page.getByTestId('timestamp')] });
```

### ⚠️ Pitfall 3: Generating Baselines on a Different OS/Environment Than CI Runs Them
Screenshot rendering (font hinting, anti-aliasing) can differ meaningfully between operating systems — a baseline generated on a developer's local macOS machine may not match pixel-for-pixel against a Linux-based CI runner's rendering, causing persistent, environment-driven failures unrelated to any real regression. Baselines should be generated in the **same environment** (ideally the same Docker image) that CI will later compare against, not on an engineer's local machine.
