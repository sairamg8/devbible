---
title: "Asset Modules (Webpack 5+): Built-In `asset/*` Types"
sidebar_label: "Asset Modules (Webpack 5+)"
sidebar_position: 1
---

# ⚙️ Asset Modules (Webpack 5+): Built-In `asset/*` Types

## 1. Under-The-Hood Mechanics

Before Webpack 5, importing an image or font required three separate community loaders (`file-loader`, `url-loader`, `raw-loader`). Webpack 5 absorbed all three into the core compiler as **asset modules**, configured via `type` instead of `use`, removing a whole category of loader dependency/version-mismatch issues.

```
import logo from './logo.png'
        │
        ▼
module.rules match { test: /\.png$/, type: 'asset/...' }
        │
        ├── asset/resource ──► emits logo.[hash].png as a separate file, `logo` import = its URL string
        ├── asset/inline    ──► NO separate file emitted, `logo` import = a base64 data: URI string
        ├── asset/source    ──► `logo` import = the RAW file content as a string (for e.g. raw SVG/GLSL/txt)
        └── asset             ──► Webpack decides resource vs inline automatically, based on parser.dataUrlCondition.maxSize
```

### Automatic Choice via `maxSize`
The plain `asset` type (no suffix) picks `asset/inline` for files under a byte threshold (`parser.dataUrlCondition.maxSize`, default 8kb) and `asset/resource` above it — the reasoning: very small files (icons, tiny sprites) often cost more in a separate HTTP request's overhead than they'd cost inlined as base64 directly in the referencing CSS/JS, while larger files benefit from being cacheable as their own file with their own long-term cache header.

---

## 2. Real-World Engineering Scenario

**Scenario**: Icon System With Hundreds of Small SVGs Plus a Handful of Large Hero Images.
An app has 200+ small UI icons (each a few hundred bytes to 2kb) and 10 large hero/marketing images (200kb+). Using the automatic `asset` type with a tuned `maxSize` means icons get inlined directly into the JS/CSS bundle (avoiding 200 separate tiny HTTP requests), while hero images are emitted as separate `asset/resource` files with their own `[contenthash]`-based long-term cache headers — one rule, two very different, both-optimal outcomes.

---

## 3. Production-Grade Code Example

```javascript
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.(png|jpe?g|webp|avif)$/i,
        type: 'asset/resource', // large photographic images — always a separate cacheable file
        generator: { filename: 'images/[hash][ext][query]' },
      },
      {
        test: /\.svg$/i,
        type: 'asset', // automatic: small icon SVGs inline, larger illustration SVGs as files
        parser: { dataUrlCondition: { maxSize: 4 * 1024 } }, // 4kb threshold, tuned for this icon set
      },
      {
        test: /\.glsl$/i,
        type: 'asset/source', // raw shader source imported as a plain string, no file emission
      },
      {
        test: /\.woff2?$/i,
        type: 'asset/resource', // fonts must always be a real file — inlining defeats font preloading
        generator: { filename: 'fonts/[hash][ext][query]' },
      },
    ],
  },
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Inlining Fonts via `asset/inline`
```javascript
// ❌ WRONG: base64-inlining a font bloats the JS/CSS bundle by ~33% (base64 overhead) and makes
// the font impossible to preload via <link rel="preload" as="font"> — actively hurting LCP/CLS
{ test: /\.woff2?$/, type: 'asset/inline' },

// ✅ CORRECT: fonts should almost always be asset/resource — real files, cacheable, preloadable
{ test: /\.woff2?$/, type: 'asset/resource' },
```

### ⚠️ Pitfall 2: Forgetting Old `file-loader` Options Don't Map 1:1
Migrating from `file-loader`'s `options: { name: '[name].[ext]', outputPath: 'images/' }` to `asset/resource`'s `generator: { filename: ... }` uses a **different templating syntax** (`[hash][ext][query]` vs `[name].[ext]`) — copy-pasting the old options object silently does nothing, since `asset/resource` doesn't read a `file-loader`-shaped `options` object at all.

### ⚠️ Pitfall 3: Leaving `maxSize` at the Default for a Project With Many Large SVG Illustrations
The 8kb default `dataUrlCondition.maxSize` was tuned as a reasonable general default, but a project whose SVGs are complex illustrations (30-60kb) rather than simple icons will have the automatic `asset` type inline surprisingly large data URIs into the JS bundle well past the point of it being a net win — measure with `webpack-bundle-analyzer` and tune `maxSize` down (or split the rule by directory/naming convention) rather than trusting the default blindly.
