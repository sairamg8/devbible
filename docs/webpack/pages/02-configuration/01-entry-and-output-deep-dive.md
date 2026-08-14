---
title: "Configuration Deep Dive: Entry & Output"
sidebar_label: "Configuration Deep Dive: Entry & Output"
sidebar_position: 1
---

# ⚙️ Configuration Deep Dive: Entry & Output

## 1. Under-The-Hood Mechanics

Beyond the basic string/array/object forms, `entry` accepts a **function returning a Promise** — evaluated lazily at build start, letting entry points be computed asynchronously (e.g. discovered by scanning a directory, or fetched from a remote manifest for a plugin-based architecture).

```javascript
entry: () => new Promise((resolve) => {
  // e.g. glob-scan a pages/ directory to build the entry object dynamically
  resolve({ main: './src/index.js', ...discoverPageEntries() });
}),
```

### Output Naming: Three Distinct Filename Templates
- `filename` — names the bundle for each **initial** chunk (one per entry point).
- `chunkFilename` — names **async** chunks produced by `import()` or `SplitChunksPlugin`, which have no entry name of their own so this template usually needs `[id]` or `[name]` (from magic comments) instead.
- `assetModuleFilename` — names files emitted by `asset/resource` modules (images, fonts) — independent from JS chunk naming entirely.

### `library` / `libraryTarget`: Building a Consumable Package, Not an App
When Webpack's output is itself a library other code will `import`/`require()` (rather than an app's final bundle), `output.library` configures the exposed global/module name and `output.library.type` (`'umd'`, `'commonjs2'`, `'module'`, `'window'`) controls which module system the emitted code is compatible with — critical for authoring a package meant to work in both browser `<script>` tags and Node `require()`.

---

## 2. Real-World Engineering Scenario

**Scenario**: Design System Package Consumed by Both a Webpack App and a Plain `<script>` Tag Demo Site.
A component library needs to ship as an npm package importable via `import { Button } from '@acme/ds'` in consuming apps' bundlers, **and** be droppable as a standalone `<script src="acme-ds.umd.js">` on a static docs site with zero build tooling. `output.library: { type: 'umd', name: 'AcmeDS' }` produces a single build compatible with both consumption models — UMD detects at runtime whether it's in a CommonJS, AMD, or global-script environment and adapts.

---

## 3. Production-Grade Code Example

```javascript
// webpack.config.js — library build for a shared design system package
const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'acme-ds.umd.js',
    library: { name: 'AcmeDS', type: 'umd' },
    globalObject: 'this', // avoids "window is not defined" when the UMD bundle runs in Node/SSR
  },
  externals: {
    // Don't bundle React into the library — consuming apps provide their own copy
    react: { commonjs: 'react', commonjs2: 'react', amd: 'react', root: 'React' },
    'react-dom': { commonjs: 'react-dom', commonjs2: 'react-dom', amd: 'react-dom', root: 'ReactDOM' },
  },
};
```

```javascript
// webpack.config.js — dynamic entry via an async function, for a docs site auto-scanning MDX pages
const glob = require('glob');
const path = require('path');

module.exports = {
  entry: async () => {
    const pages = await glob('src/pages/**/*.mdx');
    return Object.fromEntries(
      pages.map((file) => [path.basename(file, '.mdx'), file])
    );
  },
  output: {
    filename: '[name].[contenthash:8].js',
    chunkFilename: 'chunks/[id].[contenthash:8].js',
    assetModuleFilename: 'assets/[hash][ext][query]',
  },
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting `externals` When Building a Library
```javascript
// ❌ WRONG: bundles React directly into the library output — if a consuming app also has its
// own React copy, this produces DUPLICATE React instances and breaks hooks/context entirely
module.exports = { entry: './src/index.ts', output: { library: { type: 'umd' } } };

// ✅ CORRECT: mark peer dependencies as externals so consumers supply their own copy
module.exports = {
  externals: { react: 'react', 'react-dom': 'react-dom' },
  // ...
};
```

### ⚠️ Pitfall 2: Using `[hash]` Instead of `[contenthash]` for Long-Term Caching
```javascript
// ❌ WRONG: [hash] is a single hash for the ENTIRE compilation — changing ANY file
// invalidates the cache-busting hash of files that didn't actually change
filename: '[name].[hash].js',

// ✅ CORRECT: [contenthash] is per-file, based on that specific file's content —
// unrelated files keep their cached hash across deploys
filename: '[name].[contenthash].js',
```

### ⚠️ Pitfall 3: `chunkFilename` Missing `[id]`/`[name]`, Causing Chunk Filename Collisions
A `chunkFilename` template that only uses `[contenthash]` (no `[id]` or `[name]`) can theoretically collide if two unrelated async chunks happen to hash identically at a given hash-truncation length, and makes debugging network tab output far harder since chunk files carry no human-readable identity at all. Always include `[id]` (or `[name]` via magic comments) alongside the hash.
