---
title: "Optimization & Performance: Tree-Shaking, Chunk Warnings & Size Reporting"
sidebar_label: "Optimization & Performance"
sidebar_position: 1
---

# ⚡ Optimization & Performance: Tree-Shaking, Chunk Warnings & Size Reporting

## 1. Under-The-Hood Mechanics

Vite's production build inherits Rollup's mature static-ESM-analysis-based tree-shaking, plus a few Vite-specific build-time diagnostics tuned for catching size regressions before they ship.

```
Rollup's tree-shaking (build.rollupOptions apply here too)
        │
        ├── requires STATIC ESM import/export syntax (same requirement as Webpack — see the
        │      Webpack optimization bible's tree-shaking section)
        │
        └── eliminates any export PROVABLY unused across the entire bundled graph

build.chunkSizeWarningLimit  ──► warns (doesn't fail) when a chunk exceeds this KB threshold post-build
        │
        ▼
Brotli/gzip size reporting  ──► `vite build` prints BOTH raw and compressed size per chunk,
                                    by default — giving a realistic sense of actual over-the-wire size,
                                    not just the uncompressed artifact size
```

### Why the Build Output Shows Both Raw and Gzip Sizes
Raw (uncompressed) chunk size can be meaningfully misleading — text-heavy JS/CSS often compresses 3-4x smaller over the wire via gzip/brotli (the same real distinction covered in the [Webpack performance analysis doc](../../../webpack/pages/14-performance-analysis/01-diagnostics-and-bundle-analysis.md)). Vite's build output printing both, by default, without needing a separate bundle-analyzer step, keeps this distinction visible at every single build rather than requiring an opt-in analysis tool to discover it.

### `chunkSizeWarningLimit`: A Tripwire, Not a Hard Failure
Exceeding this threshold produces a build-time **warning**, not a build failure — intentionally, since a single large but genuinely necessary chunk (a big charting library used on one specific, low-traffic admin page) might legitimately warrant a higher threshold rather than being treated as an automatic error. Teams wanting an enforced, CI-blocking budget need a separate tool (`size-limit`, or a custom script parsing Vite's build output) layered on top.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Silent Bundle Size Regression Discovered Only Because of a Build Warning Nobody Initially Noticed.
A new charting library was added for one dashboard widget, and its default import (rather than a more selective, tree-shakeable import path) pulled in a much larger portion of the library's code than actually needed. `vite build`'s default chunk-size warning flagged the resulting chunk as unusually large — a signal that had been quietly appearing in CI logs for several deploys before anyone actually investigated it, since it was "only a warning." Once investigated, switching to the library's documented tree-shakeable import path (`import { LineChart } from 'charting-lib/line'` instead of `import { LineChart } from 'charting-lib'`) cut that chunk's size dramatically, restoring it below the warning threshold.

---

## 3. Production-Grade Code Example

```typescript
// vite.config.ts — tuning the size-warning threshold deliberately, not just accepting the default
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 500, // KB — tuned for this app's actual, deliberate chunking strategy
  },
});
```

```bash
# Default vite build output already reports both raw and compressed size per chunk
vite build

# dist/assets/index-a1b2c3.js       142.31 kB │ gzip: 45.67 kB
# dist/assets/vendor-d4e5f6.js      310.85 kB │ gzip: 98.12 kB
# (!) Some chunks are larger than 500 KB after minification. Consider:
#     - Using dynamic import() to code-split the application
#     - Adjusting chunkSizeWarningLimit
```

```javascript
// The tree-shaking-defeating import pattern from the scenario, and its fix
// ❌ pulls in the ENTIRE library's surface area, even if only LineChart is used
import { LineChart } from 'charting-lib';

// ✅ a more selective import path lets tree-shaking (and often the library's OWN
// internal code-splitting) eliminate everything except what's actually imported
import { LineChart } from 'charting-lib/line';
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Ignoring Chunk-Size Warnings as Routine CI Noise
```
❌ RISKY: treating every chunkSizeWarningLimit warning as "probably fine, ship it" without
investigation means genuine regressions accumulate silently over many deploys, each
individually easy to dismiss, until the app's actual bundle size has drifted significantly
from where the team believes it to be

✅ CORRECT: treat a NEW warning (one that wasn't present in the previous build) as worth
a quick investigation — even if the final conclusion is "yes, this chunk legitimately
needs to be this size," that should be a DELIBERATE conclusion, not a default assumption
```

### ⚠️ Pitfall 2: Judging Bundle Size From Raw Numbers Instead of the Gzip Column
```
❌ MISLEADING: comparing raw sizes across builds/PRs can over- or under-state the ACTUAL
user-facing impact — a change that increases raw size but is highly compressible (e.g.
repetitive generated code) may barely affect real over-the-wire transfer size, while a
change that looks small in raw bytes but is already-compressed binary data (an image,
a font) doesn't compress further at all over gzip

✅ CORRECT: always compare the gzip/brotli column specifically when assessing real
user-impact of a bundle size change, not the raw uncompressed figure
```

### ⚠️ Pitfall 3: Assuming `chunkSizeWarningLimit` Enforces Anything in CI
Because it's a warning, not a failure, a CI pipeline that doesn't explicitly parse build output (or use a dedicated budget-enforcement tool) for this warning will happily continue passing/deploying regardless of how large chunks have grown — relying on `chunkSizeWarningLimit` alone provides visibility, not enforcement; genuine CI-blocking budgets need an additional, explicit tool layered on top (mirroring the `size-limit`/Lighthouse CI patterns covered in the [Web Vitals performance budgets doc](../../../web-vitals-performance/pages/10-budgets-and-advanced-diagnostics/01-performance-budgets-and-deep-profiling.md)).
