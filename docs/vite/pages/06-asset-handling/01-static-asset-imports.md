---
title: "Asset Handling: Static Imports, `public/` & Special Import Suffixes"
sidebar_label: "Asset Handling"
sidebar_position: 1
---

# ⚡ Asset Handling: Static Imports, `public/` & Special Import Suffixes

## 1. Under-The-Hood Mechanics

Vite treats non-JS asset imports (images, fonts, raw text files) as first-class module imports, resolving to a **URL string** by default — with several special import suffixes for opting into a different resolution shape entirely.

```javascript
import logoUrl from './logo.png';           // resolves to a URL STRING — either a hashed file path, or a base64 data: URI
                                                  // (inlined automatically if under assetsInlineLimit, default 4kb)

import rawText from './notes.txt?raw';         // resolves to the RAW FILE CONTENT as a string, not a URL
import workerCtor from './worker.js?worker';     // resolves to a WEB WORKER CONSTRUCTOR, not a URL or content
import forcedUrl from './icon.svg?url';            // forces URL resolution even for an asset that WOULD be inlined
```

### The `public/` Directory: Untouched, Unhashed, Served As-Is
Files placed in `public/` are copied **verbatim** to the build output root, at their exact same relative path — no transformation, no content hashing, no import-graph analysis at all. This is the correct place for files that must be referenced by a fixed, predictable path (`favicon.ico`, `robots.txt`, a `manifest.json` a third-party tool expects at an exact URL) — anything imported from source code instead should go through the normal asset-import pipeline (with hashing, for long-term cache-busting).

### `import.meta.glob()`: Batch-Importing Many Modules at Once
```javascript
const modules = import.meta.glob('./pages/*.tsx'); // returns an object of { path: () => import(path) } — LAZY by default
const eagerModules = import.meta.glob('./pages/*.tsx', { eager: true }); // resolves ALL matches immediately, synchronously
```
This is Vite's built-in mechanism for dynamically discovering and importing a set of modules matching a glob pattern — commonly used for auto-generating routes from a `pages/` directory, or loading all files in a content directory, without hand-maintaining an explicit list of every file.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Documentation Site Auto-Registering Routes From Every Markdown-Adjacent Page Component in a Directory.
Rather than hand-maintaining a routes array listing every single page component (a maintenance burden that drifts every time a page is added/removed), the site used `import.meta.glob('./pages/**/*.tsx', { eager: true })` to automatically discover and import every page component in the directory at build time — adding a new page file was immediately, automatically picked up by the routing system with zero additional registration code, since the glob pattern itself was the single source of truth for "what pages exist."

---

## 3. Production-Grade Code Example

```javascript
// Static asset imports — URL resolution, with automatic small-file inlining
import heroImage from './assets/hero.jpg'; // large file → hashed URL string, e.g. '/assets/hero.a1b2c3.jpg'
import tinyIcon from './assets/icon.svg';    // small file (<4kb default) → base64 data: URI, NO separate file emitted

function Hero() {
  return <img src={heroImage} alt="Hero" />; // works identically regardless of which resolution path was taken
}
```

```javascript
// Special import suffixes for non-default resolution
import shaderSource from './shader.glsl?raw'; // raw string content — not a URL, the actual file text
import ImageWorker from './image-worker.js?worker'; // a Worker CONSTRUCTOR — `new ImageWorker()` spins one up
import iconUrl from './icon.svg?url'; // FORCES a URL, even though this SVG would normally be small enough to inline

const worker = new ImageWorker(); // genuinely instantiates a Web Worker from image-worker.js
worker.postMessage({ data: someImageBuffer });
```

```javascript
// import.meta.glob() — auto-discovering and registering routes from a directory
const pageModules = import.meta.glob('./pages/**/*.tsx', { eager: true });

const routes = Object.entries(pageModules).map(([path, module]) => {
  const routePath = path.replace('./pages', '').replace(/\.tsx$/, '').replace(/\/index$/, '/') || '/';
  return { path: routePath, component: module.default };
});
// Adding a new file to pages/ is IMMEDIATELY reflected here — zero manual route registration needed
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Putting Source-Referenced Assets in `public/` Instead of Importing Them
```javascript
// ❌ SUBOPTIMAL: an asset placed in public/ and referenced by a hardcoded string path gets
// NO content hashing, NO build-time validation that the file actually exists, and NO
// bundler-level optimization (unlike an imported asset)
<img src="/images/hero.jpg" /> // works, but bypasses hashing/cache-busting/import validation entirely

// ✅ CORRECT: import assets that are part of the app's actual content, reserving public/
// specifically for files that MUST have a fixed, predictable path (favicon, robots.txt)
import heroImage from './assets/hero.jpg';
<img src={heroImage} />
```

### ⚠️ Pitfall 2: Using Eager `import.meta.glob` Where Lazy Would Avoid an Unnecessarily Large Bundle
```javascript
// ❌ SUBOPTIMAL: eager: true resolves and BUNDLES every single matched module into the
// initial bundle immediately — for a large content directory (hundreds of blog posts),
// this defeats code-splitting entirely, shipping content nobody may ever actually visit
const allPosts = import.meta.glob('./posts/*.md', { eager: true }); // ALL posts bundled upfront

// ✅ CORRECT: lazy (default) glob returns functions returning a Promise — each module
// is only fetched/bundled when actually invoked, preserving code-splitting
const allPosts2 = import.meta.glob('./posts/*.md'); // { path: () => import(path) } — lazy, per-post
```

### ⚠️ Pitfall 3: Assuming `assetsInlineLimit` Inlining Is Always a Net Win
Inlining small assets as base64 avoids a separate HTTP request, but base64 encoding itself adds roughly 33% overhead to the asset's byte size, and an inlined asset can no longer be cached independently by the browser (it's baked into whatever JS/CSS file references it, invalidated whenever THAT file changes, not just when the asset itself changes). For an asset reused across many pages/components, a real separate cacheable file (forced via the `?url` suffix, or raising `assetsInlineLimit`'s threshold down) can outperform inlining despite the extra initial request.
