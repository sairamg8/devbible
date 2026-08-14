---
title: "Testing Integration: `@storybook/test-runner`, Stories as the Single Source of Truth"
sidebar_label: "Testing Integration"
sidebar_position: 1
---

# 📖 Testing Integration: `@storybook/test-runner`, Stories as the Single Source of Truth

## 1. Under-The-Hood Mechanics

`@storybook/test-runner` turns every story — specifically, every story with a `play` function — into an actual, automated CI test, executed against a real, headless browser via Playwright under the hood, without needing any separate test files at all.

```
@storybook/test-runner
        │
        ▼
Starts a headless BROWSER (Playwright-backed), navigates to EVERY story in a built Storybook
        │
        ▼
For each story:
  - renders it
  - executes its play function (if one exists), including all its assertions
  - FAILS the CI run if any play function's assertions fail
        │
        ▼
Stories serve DOUBLE DUTY: visual documentation for humans browsing Storybook,
AND automated interaction tests for CI — ONE authored artifact, not two separately-maintained ones
```

### Why This Eliminates Duplicate Test Authoring
Without the test-runner, a team might maintain **both** a Storybook story (for visual documentation/review) **and** a separate RTL test file (for automated regression protection) covering the same component behavior — two artifacts that can drift out of sync with each other over time. The test-runner means the story's own `play` function **is** the automated test — writing an interaction test and documenting the component's behavior become the same act, not two separate maintenance burdens.

### Running in CI: A Real Browser, Not jsdom
Because the test-runner drives an actual Playwright-controlled browser (not jsdom, unlike RTL), it inherits the same real-browser-fidelity benefits covered in the [Playwright component testing doc](../../../playwright/pages/12-component-testing/01-experimental-ct-runner.md) — genuine layout/rendering behavior, not jsdom's approximation.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Design System's Component Behavior Regressions Caught Automatically in CI, Purely From Existing Stories.
A design system team had already authored `play` functions on many of their component stories — primarily for visual, step-by-step review during development and design sign-off. Wiring `@storybook/test-runner` into their CI pipeline meant those same `play` functions, with zero additional test-writing effort, became an automated regression suite — a future code change that broke a component's documented interaction behavior (say, a dropdown that stopped closing on outside click) would fail the CI build automatically, using verification logic the team had already written for an entirely different purpose (interactive documentation).

---

## 3. Production-Grade Code Example

```json
// package.json — running the test-runner against a built Storybook instance
{
  "scripts": {
    "build-storybook": "storybook build",
    "test-storybook": "test-storybook --url http://localhost:6006"
  }
}
```

```yaml
# .github/workflows/storybook-tests.yml
jobs:
  test-storybook:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright install --with-deps # test-runner needs Playwright's browsers
      - run: npm run build-storybook
      - run: |
          npx http-server storybook-static --port 6006 &
          npx wait-on http://localhost:6006
          npm run test-storybook
```

```tsx
// LoginForm.stories.tsx — the SAME play function from the interaction testing doc,
// now ALSO serving as this component's automated CI regression test, with zero extra code
export const ShowsValidationErrorForInvalidEmail: Story = {
  args: { onSubmit: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Email'), 'not-a-valid-email');
    await userEvent.click(canvas.getByRole('button', { name: 'Log In' }));
    await expect(canvas.getByText(/please enter a valid email/i)).toBeInTheDocument();
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
  // This ONE play function is: a documented example, a visual Interactions-panel demo,
  // AND (via test-runner) an automated CI test — authored ONCE, serving all three purposes
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Assuming Stories Without `play` Functions Get Any Behavioral Verification
```tsx
// ❌ MISUNDERSTANDING: a story with only `args` (no play function) is tested by the
// test-runner for "does it render without crashing" — but NOTHING about its actual
// BEHAVIOR is verified, since there's no play function's assertions to run at all
export const Default: Story = { args: { label: 'Click me' } }; // renders, but verifies NOTHING behavioral

// ✅ AWARENESS: only stories WITH play functions get genuine behavioral test coverage from
// the test-runner — a story without one is still valuable (visual documentation, a
// baseline for visual regression tools) but isn't a behavioral test substitute
```

### ⚠️ Pitfall 2: Not Installing Playwright's Browser Dependencies in CI
```yaml
# ❌ WRONG: the test-runner needs Playwright's actual browser binaries — without installing
# them explicitly, CI fails with a browser-launch error unrelated to any actual test logic
- run: npm run test-storybook # ❌ fails — no browser binaries installed

# ✅ CORRECT: install Playwright's browsers before running the test-runner
- run: npx playwright install --with-deps
- run: npm run test-storybook
```

### ⚠️ Pitfall 3: Running the Test-Runner Against a Live Dev Server Instead of a Built, Static Storybook
```bash
# ❌ SLOWER/LESS RELIABLE: running against the DEV server (storybook dev) means the
# test-runner competes with Storybook's own hot-module-reloading and dev-time overhead,
# and doesn't verify the ACTUAL production-built artifact's behavior
storybook dev &
npm run test-storybook # against the dev server — not what actually gets deployed/reviewed

# ✅ CORRECT: build a static Storybook first, then run the test-runner against THAT —
# verifying the actual artifact, faster and more reliable than the dev server
npm run build-storybook
npx http-server storybook-static --port 6006 &
npm run test-storybook
```
