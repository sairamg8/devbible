---
title: "Performance Analysis: Bundle Analyzer, Stats & Size Budgets"
sidebar_label: "Performance Analysis"
sidebar_position: 1
---

# ⚙️ Performance Analysis: Bundle Analyzer, Stats & Size Budgets

## 1. Under-The-Hood Mechanics

Webpack's `stats` object is a complete, structured record of everything the compiler did — every module, every chunk, every asset, their sizes, and the reasons each module was included. Every diagnostic tool (bundle analyzers, CI budget checks) is ultimately just a consumer of this same data.

```
compiler.run() ──► Stats object ──► stats.toJson({ preset: 'verbose' | 'errors-only' | 'minimal' })
                                              │
                                              ├── webpack-bundle-analyzer ──► treemap visualization
                                              │      (which modules/dependencies consume how much space, nested)
                                              │
                                              └── performance.hints ──► warnings/errors when an asset or
                                                     entrypoint exceeds a configured byte-size threshold
```

### `webpack-bundle-analyzer`: Where Did the Bytes Go
Renders the compiled output as an interactive treemap — box size proportional to gzip/parsed size. The single most common finding on a first run of this tool in an established codebase: an unexpectedly large box turns out to be a duplicated dependency (two different major versions of the same library pulled in transitively), a moment-style locale bundle importing every locale instead of one, or a debug/dev-only library accidentally included in the production bundle.

### `performance.hints`
`performance: { maxAssetSize: 250000, maxEntrypointSize: 250000, hints: 'error' }` fails the build (or warns) when any single asset or entrypoint's total size crosses the configured threshold — an automated, enforced tripwire rather than relying on someone remembering to check bundle size manually before merging.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Routine Dependency Bump Silently Doubling the Vendor Bundle.
A minor version bump of a charting library was merged without anyone noticing it changed its internal bundling strategy, pulling in a second, incompatible copy of a shared dependency instead of reusing the app's existing one. `performance.hints: 'error'` in CI caught this immediately — the build failed on `maxEntrypointSize` exceeded, and `webpack-bundle-analyzer`'s treemap immediately made the duplicated dependency visually obvious (two same-named boxes at different sizes/versions), turning what could have been a silent production regression into a blocked PR with an obvious root cause.

---

## 3. Production-Grade Code Example

```javascript
// webpack.config.js
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  performance: {
    hints: process.env.CI ? 'error' : 'warning', // enforce in CI, just warn locally during dev
    maxAssetSize: 250 * 1024,
    maxEntrypointSize: 250 * 1024,
  },
  plugins: [
    ...(process.env.ANALYZE
      ? [new BundleAnalyzerPlugin({ analyzerMode: 'static', openAnalyzer: false, reportFilename: 'bundle-report.html' })]
      : []),
  ],
};
```

```bash
# Generate a treemap report without opening a browser — for CI artifact upload
ANALYZE=true yarn build
```

```javascript
// scripts/print-stats.js — programmatic access to stats.toJson() for a custom CI check
const webpack = require('webpack');
const config = require('../webpack.config.js');

webpack(config, (err, stats) => {
  const json = stats.toJson({ preset: 'minimal' });
  const entrypointSize = Object.values(json.entrypoints)
    .flatMap((e) => e.assets)
    .reduce((sum, a) => sum + a.size, 0);

  console.log(`Total entrypoint size: ${(entrypointSize / 1024).toFixed(1)}kb`);
  if (entrypointSize > 500 * 1024) process.exit(1); // custom, sharper budget than performance.hints alone
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Measuring Uncompressed Size Instead of Gzip/Brotli Size
`webpack-bundle-analyzer`'s default view shows **parsed** (uncompressed) size — real users download the **gzip or brotli-compressed** version over the wire, which can be 3-4x smaller for text-heavy JS. Toggling the analyzer's gzip size view (or checking `maxAssetSize` against real compressed output) avoids over- or under-estimating actual user-facing payload impact.

### ⚠️ Pitfall 2: `performance.hints` Silently Set to `false` After a Budget Violation "Just to Unblock a Deploy"
Disabling the hint entirely to get past a size-budget CI failure (rather than fixing the actual bloat, or deliberately raising the budget with a documented reason) removes the tripwire for every future PR too — the next, unrelated size regression now ships with zero warning. Treat a budget violation as a signal to investigate (`ANALYZE=true` build) before ever touching the threshold itself.

### ⚠️ Pitfall 3: Running Bundle Analysis Only Locally, Never in CI
A one-off local `ANALYZE=true` build the day the app was first optimized doesn't catch the next six months of gradual dependency creep — each individually-small addition passing under the radar. Wiring `performance.hints: 'error'` (or a dedicated size-limit CI step) into every PR turns bundle-size awareness from a one-time audit into a continuously-enforced property of the codebase.
