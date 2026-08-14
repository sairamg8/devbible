---
title: "Long-Term Caching: Content Hashes & Persistent Build Cache"
sidebar_label: "Long-Term Caching"
sidebar_position: 1
---

# ⚙️ Long-Term Caching: Content Hashes & Persistent Build Cache

## 1. Under-The-Hood Mechanics

Two entirely different caching concerns share the word "cache" in Webpack: **browser cache-busting** (making sure users fetch new code after a deploy, but keep unchanged files cached) and **build-time caching** (making rebuilds/CI runs faster by not recomputing unchanged work).

### Browser Cache-Busting: `[hash]` vs `[chunkhash]` vs `[contenthash]`
- `[hash]` — one hash for the **entire compilation**. Changing any single file changes this hash for every output file, defeating long-term caching almost entirely.
- `[chunkhash]` — one hash per **chunk**, derived from everything in that chunk (including its dependencies' content) — better, but a shared dependency change still busts every chunk that includes it.
- `[contenthash]` — a hash of that **specific file's own emitted content** — the finest granularity. Changing `Button.tsx` only changes the hash of the chunk containing `Button.tsx`'s compiled output, leaving every other chunk's hash (and therefore browser cache entry) untouched.

### Persistent Filesystem Build Cache
```
cache: { type: 'filesystem' }
        │
        ▼
Webpack serializes intermediate build artifacts (parsed ASTs, loader outputs, module graphs) to disk
        │
        ▼
Next build run: unchanged inputs ──► results read from disk cache, skipping re-parse/re-transform entirely
                changed inputs   ──► only the affected subgraph is recomputed
```
`buildDependencies` tells the cache which **external** files (webpack.config.js itself, babel.config.js, tsconfig.json) should invalidate the *entire* cache if they change — without listing these, changing a Babel plugin config might not correctly invalidate cached transform results that depended on the old config.

---

## 2. Real-World Engineering Scenario

**Scenario**: CI Pipeline Where Every PR Ran a Full 8-Minute Cold Build.
A monorepo's CI previously ran every build from a completely clean checkout, re-parsing and re-transforming every file on every single PR regardless of how small the diff was. Enabling `cache: { type: 'filesystem' }` with the cache directory persisted between CI runs (via the CI provider's cache-restore step, keyed on lockfile hash) cut typical PR build time from 8 minutes to under 90 seconds for small diffs, since only the actually-changed files' subgraphs needed recomputation.

---

## 3. Production-Grade Code Example

```javascript
// webpack.config.js
const path = require('path');

module.exports = {
  output: {
    filename: '[name].[contenthash:8].js',
    chunkFilename: 'chunks/[id].[contenthash:8].js',
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        // Isolating vendor deps into their own chunk maximizes how often users' BROWSER cache
        // (not the build cache) stays valid across app-code-only deploys
        vendor: { test: /[\\/]node_modules[\\/]/, name: 'vendors', chunks: 'all' },
      },
    },
  },
  cache: {
    type: 'filesystem',
    cacheDirectory: path.resolve(__dirname, '.webpack-cache'),
    buildDependencies: {
      // Any change to these files invalidates the ENTIRE persistent cache — correctness over speed
      config: [__filename],
      babelConfig: [path.resolve(__dirname, 'babel.config.js')],
      tsConfig: [path.resolve(__dirname, 'tsconfig.json')],
    },
  },
};
```

```yaml
# .github/workflows/ci.yml — persisting the filesystem build cache across CI runs
- uses: actions/cache@v4
  with:
    path: .webpack-cache
    key: webpack-${{ hashFiles('yarn.lock') }}-${{ github.sha }}
    restore-keys: webpack-${{ hashFiles('yarn.lock') }}-
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Using `[hash]` Instead of `[contenthash]`, Believing It's Equivalent
```javascript
// ❌ WRONG: [hash] is compilation-wide — editing ONE component busts the browser cache for
// every single emitted file, including ones with byte-for-byte identical content to the last build
filename: '[name].[hash].js',

// ✅ CORRECT: per-file content hashing — unrelated files keep their browser-cached copy valid
filename: '[name].[contenthash].js',
```

### ⚠️ Pitfall 2: Forgetting `buildDependencies`, Serving Stale Cached Transforms After a Config Change
Changing a Babel preset or `tsconfig.json` compiler option should change how files are transformed — but without listing that file under `buildDependencies`, the filesystem cache has no way to know its previously-cached transform results are now invalid, silently serving **stale, pre-config-change** transform output from disk until the cache is manually cleared.

### ⚠️ Pitfall 3: Committing the Filesystem Cache Directory to Version Control
The `.webpack-cache` directory is large, binary, machine/version-specific, and not meant to be portable across Webpack versions or Node versions — accidentally committing it (missing from `.gitignore`) bloats repo size for zero benefit, since a cache built on one CI runner's Webpack/Node version isn't guaranteed valid on a different one. Always `.gitignore` it and rely on CI's own cache-restore mechanism instead (as shown above), which correctly keys on lockfile state.
