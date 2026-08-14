---
title: "Babel Performance & Caching"
sidebar_label: "Babel Performance & Caching"
sidebar_position: 1
---

# ⚡ Babel Performance & Caching

Covers syllabus **§11.1 Compilation Cost**, **§11.2 Caching Strategies**, and **§11.3 Reducing Plugin/Preset Surface**.

## 1. Concept & Under-the-Hood Mechanics

### 11.1 Compilation Cost

Babel’s transforms run as **JavaScript visitors** over ASTs. On large monorepos this becomes a primary CI bottleneck—exactly why Next/Vite defaulted to SWC/esbuild. Justify Babel with **measured** needs (plugins/macros), not habit.

Compare the same tree with SWC/esbuild where possible; decide on data.

### 11.2 Caching Strategies

| Layer | Mechanism |
| --- | --- |
| babel-loader | `cacheDirectory` on disk |
| Jest | transform cache for unchanged files |
| Watch mode | Incremental rebuilds; cold start still pays full parse/transform |

Invalidate caches when babel config, browserslist, or babel-related deps change.

### 11.3 Reducing Surface

- **`preset-env` `exclude`** — skip transforms your targets already support  
- **Tighten browserslist** — fewer transforms and polyfills → less compile *and* smaller bundles  
- Remove dead plugins  

---

## 2. Real-World Engineering Scenario

**Scenario: CI compile 14 minutes; 9 minutes in babel-loader without cache.**

Enable `cacheDirectory`, cache the directory in CI, and drop IE11 from browserslist after product confirms. Compile drops under 4 minutes; polyfill bundle shrinks. Later, styled-components SWC migration removes Babel entirely from the app path.

---

## 3. Production-Grade Code Example

```js
// webpack
use: {
  loader: 'babel-loader',
  options: {
    cacheDirectory: true,
    cacheCompression: false, // sometimes faster on CI CPUs; measure
  },
}
```

```js
// Tighten targets
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: { browsers: ['last 2 Chrome versions', 'last 2 Firefox versions', 'last 2 Safari versions'] },
        useBuiltIns: 'usage',
        corejs: 3,
        modules: false,
      },
    ],
  ],
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Cache without keying on babel.config.js
Stale transforms after plugin changes—include config in CI cache keys.

### ⚠️ Micro-optimizing Babel instead of leaving it
If the only plugin has an SWC twin, migration beats cache tuning.

### ⚠️ Extremely old browserslist “just in case”
Taxes every developer forever—make support policy explicit.

### ⚠️ Running Babel on already-compiled dist in monorepo
Double compile—exclude build outputs.
