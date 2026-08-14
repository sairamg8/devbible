---
title: "Code Splitting: Dynamic Imports, `SplitChunksPlugin` & Runtime Chunks"
sidebar_label: "Code Splitting"
sidebar_position: 1
---

# ⚙️ Code Splitting: Dynamic Imports, `SplitChunksPlugin` & Runtime Chunks

## 1. Under-The-Hood Mechanics

Code splitting breaks one monolithic bundle into multiple smaller chunks loaded on-demand, so a user's first page load only downloads the JS that page actually needs.

```
Static import graph (entry bundle)  ──────────►  ONE initial chunk per entry
        │
        └── dynamic import('./Modal') encountered ──► NEW async chunk boundary created
                                                              │
                                                              ▼
                                              Fetched over the network ONLY when
                                              that import() actually executes at runtime
```

### `SplitChunksPlugin`: Automatic Vendor/Common Extraction
Beyond manual `import()` boundaries, `optimization.splitChunks` analyzes the **module graph itself** to find modules reused across multiple chunks (most commonly `node_modules` dependencies imported by several different pages) and automatically extracts them into shared chunks:
- `chunks: 'all'` — considers both static and dynamic imports for splitting (vs `'async'`, only dynamic imports, or `'initial'`, only static).
- `cacheGroups` — named buckets with their own `test`/`minSize`/`priority`, e.g. a dedicated `vendor` group for anything under `node_modules`.
- `minSize`/`maxSize` — a chunk below `minSize` isn't worth the extra HTTP request overhead to split out; above `maxSize`, a chunk gets further subdivided.

### Magic Comments
`import(/* webpackChunkName: "settings" */ './Settings')` names the resulting chunk file (otherwise a numeric id) for readability in network tab / bundle analysis. `webpackPrefetch: true` hints the browser to fetch the chunk during idle time (for "likely needed soon" navigation targets); `webpackPreload: true` fetches it in parallel with the parent chunk (for "needed very soon, don't wait for idle").

### `runtimeChunk`
Extracts Webpack's own bootstrapping/module-registry runtime code into its own tiny chunk, separate from application code — without this, every single app code change also invalidates the runtime's embedded module manifest, busting the browser's cached copy of chunks that didn't actually change.

---

## 2. Real-World Engineering Scenario

**Scenario**: SPA With a Rarely-Used, Heavy Rich-Text Editor Component.
A settings page embeds a full rich-text editor (a 300kb dependency) that fewer than 10% of visitors ever open. `React.lazy(() => import(/* webpackChunkName: "rich-text-editor" */ './RichTextEditor'))` keeps that 300kb entirely out of the initial bundle every other visitor downloads — combined with `webpackPrefetch: true` on a link that likely leads there, the chunk can even be fetched proactively during browser idle time before the user clicks, making the eventual load feel instant.

---

## 3. Production-Grade Code Example

```javascript
// webpack.config.js
module.exports = {
  optimization: {
    runtimeChunk: 'single', // one shared runtime chunk across all entries — better long-term caching
    splitChunks: {
      chunks: 'all',
      minSize: 20000,
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: -10,
        },
        reactVendor: {
          // Isolate React specifically — it changes far less often than other deps, maximizing cache hits
          test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
          name: 'react-vendor',
          priority: 10,
        },
      },
    },
  },
};
```

```tsx
// RouteSettings.tsx — dynamic import with magic comments
import { lazy, Suspense } from 'react';

const RichTextEditor = lazy(
  () => import(/* webpackChunkName: "rich-text-editor", webpackPrefetch: true */ './RichTextEditor')
);

function SettingsPage() {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <RichTextEditor />
    </Suspense>
  );
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting `runtimeChunk`, Busting Cache on Every Deploy
```javascript
// ❌ WRONG: without a dedicated runtime chunk, the module manifest is embedded in EVERY chunk,
// so a single-line change anywhere invalidates the content hash of chunks that didn't actually change
optimization: { splitChunks: { chunks: 'all' } },

// ✅ CORRECT: extract the runtime so unrelated chunks keep their long-term cache validity across deploys
optimization: { runtimeChunk: 'single', splitChunks: { chunks: 'all' } },
```

### ⚠️ Pitfall 2: Over-Aggressive `splitChunks` Producing Hundreds of Tiny Chunks
Setting `minSize` too low (or omitting it) can cause `SplitChunksPlugin` to extract dozens of very small shared chunks — each one is a separate HTTP request, and on HTTP/1.1 or a high-latency connection, request overhead can outweigh the caching benefit of splitting that granularly. Tune `minSize` (and `maxAsyncRequests`/`maxInitialRequests`) against real network conditions, not just theoretical cache optimality.

### ⚠️ Pitfall 3: `webpackPreload` Used Where `webpackPrefetch` Was Intended
```javascript
// ❌ WRONG: preload fetches in PARALLEL with the current navigation, competing for bandwidth
// with resources the CURRENT page actually needs right now — for a "maybe needed later" chunk, this hurts LCP
import(/* webpackPreload: true */ './RarelyUsedFeature');

// ✅ CORRECT: prefetch waits for browser idle time — appropriate for "likely needed soon, not right now"
import(/* webpackPrefetch: true */ './RarelyUsedFeature');
```
Reserve `webpackPreload` for chunks needed almost immediately after the current one (e.g. a modal that opens automatically), not speculative "might click this later" navigation targets.
