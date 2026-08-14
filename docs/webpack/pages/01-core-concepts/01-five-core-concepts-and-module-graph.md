---
title: "Webpack Core Concepts: Entry, Output, Loaders, Plugins & The Module Graph"
sidebar_label: "Webpack Core Concepts"
sidebar_position: 1
---

# ⚙️ Webpack Core Concepts: Entry, Output, Loaders, Plugins & The Module Graph

## 1. Under-The-Hood Mechanics

Webpack's entire job reduces to one operation: build a **dependency graph** starting from `entry` points, then emit that graph as `output` bundles. Everything else — loaders, plugins, optimization — modifies how that graph is built or how it gets serialized.

```
Entry Module(s)
   │
   ▼
Resolver (finds the file on disk, applying resolve.alias/extensions/modules)
   │
   ▼
Loaders (right-to-left chain transforms the raw source into JS Webpack can parse)
   │
   ▼
Parser (acorn-based AST construction, detects import/require statements ──► new graph edges)
   │
   ▼
Module Graph (recursively repeated for every discovered dependency)
   │
   ▼
Chunking (grouping modules into chunks per entry + dynamic import() boundaries)
   │
   ▼
Output (emitting .js/.css/asset files per output.filename/chunkFilename/assetModuleFilename)
```

### The Five Core Concepts
1. **Entry** — one or more starting points. A single string, an array (bundled together), or an object (`{ main: './index.js', admin: './admin.js' }`) for multi-page/multi-bundle apps.
2. **Output** — where and how bundles are written: `filename`, `path`, `publicPath` (the URL prefix runtime code uses to fetch chunks), `chunkFilename` (naming for async chunks).
3. **Loaders** — transform *before* parsing. A `.scss` file isn't valid JS; `sass-loader` → `css-loader` → `style-loader` turn it into something the module graph can include.
4. **Plugins** — tap into the **Compiler**/**Compilation** lifecycle via Tapable hooks, extending behavior loaders can't reach (asset emission, optimization passes, HTML generation).
5. **Mode** — `'development'` | `'production'` | `'none'`. Toggles a bundle of built-in defaults (minification, `NODE_ENV` define, tree-shaking) rather than being one setting itself.

### Module Types
Webpack 5 natively understands several module types beyond plain JS: `javascript/auto` (default, supports both ESM and CommonJS syntax in the same file), `javascript/esm` (strict ESM, enables stricter tree-shaking analysis), `javascript/commonjs`, `json`, and `webassembly/async`.

---

## 2. Real-World Engineering Scenario

**Scenario**: Multi-Page Marketing Site With a Shared Vendor Bundle.
A marketing site has a public homepage, a pricing page, and an admin dashboard — three genuinely separate entry points that shouldn't all load each other's JS. An object-form `entry: { home: './src/home.js', pricing: './src/pricing.js', admin: './src/admin.js' }` produces three independent bundles, while `dependOn` lets `admin` share a common `shared` entry (React, the design system) without Webpack duplicating that code into all three outputs.

---

## 3. Production-Grade Code Example

```javascript
// webpack.config.js
const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    shared: ['react', 'react-dom'],
    home: { import: './src/pages/home.tsx', dependOn: 'shared' },
    pricing: { import: './src/pages/pricing.tsx', dependOn: 'shared' },
    admin: { import: './src/pages/admin.tsx', dependOn: 'shared' },
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash:8].js',
    chunkFilename: 'chunks/[name].[contenthash:8].chunk.js',
    publicPath: '/static/',
    clean: true, // replaces clean-webpack-plugin
  },
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'babel-loader', exclude: /node_modules/ },
    ],
  },
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting `dependOn` and Duplicating Vendor Code
```javascript
// ❌ WRONG: three independent entries each bundle their OWN copy of react/react-dom —
// tripling the shipped size of a library your users only need to download once
entry: { home: './src/home.tsx', pricing: './src/pricing.tsx', admin: './src/admin.tsx' },

// ✅ CORRECT: dependOn a shared vendor entry so React ships exactly once across all three bundles
entry: {
  shared: ['react', 'react-dom'],
  home: { import: './src/home.tsx', dependOn: 'shared' },
},
```

### ⚠️ Pitfall 2: Using `array entry` When Independent Bundles Were Intended
`entry: ['./a.js', './b.js']` bundles both files into **one single output**, not two separate ones — a common source of confusion for engineers expecting array entry to behave like object entry's multi-bundle output. Array entry is for concatenating multiple files (e.g. a polyfill + your app code) into one bundle, not for multi-page splitting.

### ⚠️ Pitfall 3: `publicPath: 'auto'` Breaking on Non-Root-Relative Deployments
`publicPath` determines the URL prefix the *runtime* uses to fetch async chunks. `'auto'` (the modern default) infers this from the currently executing script's URL, which works for most CDN/subpath deployments — but breaks silently (404s on chunk fetches) if the app is server-side rendered and the initial HTML's script tag URL doesn't match where chunks are actually hosted. Set `publicPath` explicitly for SSR or multi-CDN setups rather than trusting auto-inference.
