---
title: "Visual Tests: Chromatic Snapshots, Review Workflow & TurboSnap"
sidebar_label: "Visual Tests"
sidebar_position: 1
---

# 📸 Visual Tests: Chromatic Snapshots, Review Workflow & TurboSnap

> **What you see:** In Storybook UI — **Visual tests** entry / Chromatic addon (when installed); in CI — Chromatic check on the PR.  
> **What it does:** Renders each story, captures screenshots, pixel-diffs against the last **approved** baseline, and requires human approve/reject on changes.  
> **What drives it:** Chromatic project + `chromatic` CLI/GitHub Action, `parameters.chromatic`, optional TurboSnap, stable story states.  
> Related: [Interactions](../05-interaction-testing/01-play-functions.md) · [Publishing](../14-publishing-and-deployment/01-shipping-a-static-storybook.md) · [Playwright visual regression](../../../playwright/pages/09-visual-and-screenshot-testing/01-visual-regression.md)

## 1. Under-The-Hood Mechanics

```
PR opened / chromatic CLI runs
        │
        ▼
Build Storybook (or use existing build)
        │
        ▼
For each story (or TurboSnap-selected subset):
  render in cloud browsers → screenshot(s)
        │
        ▼
Pixel-diff vs last APPROVED baseline for that story (+ viewport / mode)
        │
        ├── No diff     → pass
        └── Diff found  → "changes" status → human review UI
                              │
                              ├── Accept → new baseline
                              └── Deny   → fix code / CSS
```

### Why per-story (not only full-page E2E screenshots)?

| Approach | Granularity | Misses |
|---|---|---|
| Playwright full page | Route-level | Subtle component regressions under other content |
| Chromatic per story | Every intentional UI state | Needs good story coverage of states |
| Both | Best for design systems + apps | Slight overlap cost |

Stories force you to **name** states (`Loading`, `Empty`, `Error`, `WithLongLabel`). Each name gets a baseline — regressions can’t hide inside a busy page screenshot.

### TurboSnap

```
Git diff of changed files
        │
        ▼
Module dependency graph (which files import which)
        │
        ▼
Only re-snapshot stories whose dependency graph intersects the change
        │
        ▼
Unaffected stories reuse prior results → faster PR checks at large scale
```

Requires **full git history** (`fetch-depth: 0`) so Chromatic can compare against the correct parent baseline.

---

## 2. What You See in the UI / Review Surface

### Inside Storybook (Chromatic / Visual tests addon)
Depending on version and whether `@chromatic-com/storybook` (or the Visual tests addon) is installed:

| UI element | Meaning |
|---|---|
| **Visual tests panel / tab** | Project link, last build status, snapshot thumbnails |
| **Run / project token status** | Whether cloud visual tests are connected |
| **Story-level badge** | Snapshot enabled/disabled, modes |

Exact chrome varies by Storybook major version — the **source of truth for merge gating** is still the Chromatic build on the PR, not only the local panel.

### In the Chromatic / PR review UI

| Element | Meaning |
|---|---|
| **Diff overlay** | Red/green or onion-skin of before vs after |
| **Accept / deny** | Approve intentional change or block regression |
| **Viewports / modes** | Separate baselines per width or theme |
| **Build library** | History of baselines per branch/commit |

---

## 3. Stabilizing Snapshots (Production Parameters)

### 3.1 Disable non-deterministic stories

```tsx
export const LiveClock: Story = {
  args: { showCurrentTime: true },
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};
```

### 3.2 Multiple viewports per story

```tsx
export const ResponsiveCard: Story = {
  parameters: {
    chromatic: { viewports: [375, 768, 1200] },
  },
};
```

### 3.3 Delay for fonts / animations

```tsx
parameters: {
  chromatic: {
    delay: 300, // ms after load before shot — use sparingly
    pauseAnimationAtEnd: true, // freeze CSS animations at end state when supported
  },
},
```

Prefer fixing root causes (wait on `document.fonts.ready` in decorator, disable infinite spinners in stories) over large global delays.

### 3.4 Ignore regions (dynamic islands)

```tsx
parameters: {
  chromatic: {
    ignoreSelectors: [".ads-slot", "[data-chromatic='ignore']"],
  },
},
```

Mark truly dynamic subtrees in the component/story rather than ignoring half the page.

### 3.5 Modes (theme / locale matrices)

Chromatic **modes** capture the same story under different globals (e.g. light/dark, en/de) as separate baselines — powerful with theme toolbars from [colors & themes](../17-theming-colors-and-fonts/01-global-colors-themes-and-tokens.md).

```ts
// Example shape — exact API follows your Chromatic + Storybook version docs
parameters: {
  chromatic: {
    modes: {
      light: { globals: { theme: "light" } },
      dark: { globals: { theme: "dark" } },
    },
  },
},
```

### 3.6 Stories that need interaction first

Two patterns:

1. **Dedicated end-state story** — `args` or loader put the component in the final visual state (most stable for pixels).  
2. **Play then snapshot** — ensure CI/Chromatic waits for interactions to finish (version-specific); still prefer explicit end states when flakes appear.

```tsx
// Prefer explicit visual state for baselines
export const ValidationError: Story = {
  args: {
    email: "bad",
    emailError: "Please enter a valid email",
    // forced error props / initialFormState
  },
};

// Optional: also prove how you GET there
export const ValidationErrorViaPlay: Story = {
  play: async ({ canvasElement }) => {
    /* type invalid + submit — for Interactions / test-runner */
  },
  parameters: {
    // If this story is noisy in Chromatic, disableSnapshot and rely on ValidationError
    chromatic: { disableSnapshot: true },
  },
};
```

---

## 4. CI Wiring

```yaml
# .github/workflows/chromatic.yml
name: Chromatic
on:
  push:
    branches: [main, master]
  pull_request:

jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # required for TurboSnap / accurate baselines

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: yarn

      - run: yarn install --immutable
      - run: yarn build-storybook --quiet
        # optional: build once and pass storybook build dir

      - uses: chromaui/action@latest
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          onlyChanged: true # TurboSnap
          # storybookBuildDir: storybook-static
```

**Secrets:** `CHROMATIC_PROJECT_TOKEN` is a CI secret — never commit it, never put it in `STORYBOOK_*` client env (those are embedded in the browser bundle). See [manager / env doc](../13-build-and-configuration/03-manager-ui-builder-hooks-and-env.md).

---

## 5. Real-World Engineering Scenario

**Scenario:** One-line padding change on base `Button` → 47 visual diffs.

Chromatic listed every story depending on `Button`. Reviewers:

1. Accepted intentional density change on primary stories.  
2. Rejected accidental regressions on icon-only and compact table actions (token typo).  

Without per-story baselines, that typo might have shipped as “looks fine on the one page we checked.”

---

## 6. Review Discipline (Non-Negotiable)

```
❌ Bulk-accept all diffs because the PR is large
✅ Open each change; accept only intentional design changes
✅ If a diff is surprise → fix code, don’t “approve the bug”
✅ If a story is flaky → stabilize or disableSnapshot + replace with deterministic story
```

Same philosophy as Playwright/Jest snapshot testing: updating baselines is a **product decision**, not a chore to skip.

---

## 7. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Animations and loaders
Infinite spinners always diff. Use `pauseAnimationAtEnd`, story args `loading={false}`, or disable snapshot for pure motion demos.

### ⚠️ Pitfall 2: Fonts not ready → text width shifts
Share production fonts via `staticDirs` / CSS; wait on `document.fonts.ready` for specimen stories. See [custom fonts](../17-theming-colors-and-fonts/02-custom-fonts-and-typography.md).

### ⚠️ Pitfall 3: Shallow clone breaks TurboSnap
Default `actions/checkout` is shallow → TurboSnap may re-run everything or mis-attribute. Always `fetch-depth: 0`.

### ⚠️ Pitfall 4: Snapshotting the playground mega-story only
A single Controls playground is great for humans, terrible as the only baseline (infinite arg combinations). Snapshot **named** states.

### ⚠️ Pitfall 5: Backgrounds addon vs real theme
Canvas background color ≠ product dark mode. Use theme globals/modes so Chromatic captures real token-driven colors.

### ⚠️ Pitfall 6: Ignoring visual tests “because we have a11y”
A11y does not catch “padding doubled” or “brand color wrong.” Visual and a11y answer different questions.

---

## 8. Checklist

```
[ ] Chromatic project token in CI secrets only
[ ] checkout fetch-depth: 0 + onlyChanged / TurboSnap when story count is large
[ ] Named stories for critical visual states (not only playgrounds)
[ ] Non-deterministic stories disableSnapshot or ignoreSelectors
[ ] Fonts/themes match production for accurate pixels
[ ] Viewports / modes cover real product breakpoints and dark mode
[ ] Team reviews diffs individually — no bulk rubber-stamp
[ ] Visual tests panel addon optional; PR Chromatic status is the gate
```

---

## 9. Related panels

| Panel | Relationship |
|---|---|
| **Controls** | Exploration only — baselines use story file args |
| **Actions** | Irrelevant to pixels unless UI state depends on clicks |
| **Interactions** | Reach states; prefer explicit end-state stories for snapshots |
| **Accessibility** | Orthogonal quality gate — run both |
