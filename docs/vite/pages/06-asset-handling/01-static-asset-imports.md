---
title: "Asset Handling: Static Imports, `public/` & Special Import Suffixes"
sidebar_label: "Asset Handling"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Vite documentation — [Static Asset Handling](https://vite.dev/guide/assets), [Build Options](https://vite.dev/config/build-options). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> ⚠️ Scope of this pass: the `?worker` suffix and the `import.meta.glob` reference were **not** re-fetched; those claims carry their original 2026-08-14 provenance and are flagged below.
> Validated: 2026-09-06 · claims + output provenance · session 4e8d4393

# ⚡ Asset Handling: Static Imports, `public/` & Special Import Suffixes

## 1. Under-The-Hood Mechanics

Vite treats non-JS asset imports (images, fonts, raw text files) as first-class module imports, resolving to a **URL string** by default — with several special import suffixes for opting into a different resolution shape entirely.

```javascript
import logoUrl from './logo.png';        // resolves to a URL STRING — either a hashed file path, or a base64
                                         // data: URI (inlined automatically if under build.assetsInlineLimit,
                                         // default 4096 bytes)

import rawText from './notes.txt?raw';      // resolves to the RAW FILE CONTENT as a string, not a URL
import workerCtor from './worker.js?worker';  // resolves to a WEB WORKER CONSTRUCTOR, not a URL or content
import assetUrl from './data.bin?url';          // resolves an asset Vite would NOT otherwise treat as an asset
import bigIcon from './icon.svg?no-inline';       // never inline this one, whatever its size
import tiny from './icon.svg?inline';               // always inline this one, whatever its size
```

🔴 **`?url` and `?no-inline` are different suffixes doing different jobs, and conflating them is this page's most load-bearing correction.** The documentation scopes each precisely:

> *"Assets that are not included in the internal list or in `assetsInclude` can be explicitly imported as a URL using the `?url` suffix."* — [Static Asset Handling](https://vite.dev/guide/assets)

> *"Assets can be explicitly imported with inlining or no inlining using the `?inline` or `?no-inline` suffix respectively."* — [Static Asset Handling](https://vite.dev/guide/assets)

So `?url` answers *"treat this file as an asset at all"* — it is for extensions Vite does not already recognise. The suffix that answers *"do not turn this into a `data:` URI"* is **`?no-inline`**. An earlier version of this page taught `?url` as the way to defeat inlining; that is not what the documentation says it is for.

Also note what an imported URL actually contains, because it is not the same string in both modes:

> *"Importing a static asset will return the resolved public URL when it is served."* — in development that is the source path such as `/src/img.png`; in the production build it is a hashed emitted path such as `/assets/img.2d8efhg.png`.

### The `public/` Directory: Untouched, Unhashed, Served As-Is
Files placed in `public/` are copied **verbatim** to the build output root, at their exact same relative path — no transformation, no content hashing, no import-graph analysis at all. The docs describe the lifecycle in one sentence:

> *"served at root path `/` during dev, and copied to the root of the dist directory as-is."* — [Static Asset Handling](https://vite.dev/guide/assets)

and give the criteria for putting something there: assets that are *"Never referenced in source code (e.g. `robots.txt`)"*, that *"Must retain the exact same file name (without hashing)"*, or where *"you simply don't want to have to import an asset first just to get its URL."*

🔴 **The referencing rule is a hard one and is where most `public/` bugs come from:**

> *"reference `public` assets using root absolute path - for example, `public/icon.png` should be referenced in source code as `/icon.png`."* — [Static Asset Handling](https://vite.dev/guide/assets)

The directory name never appears in the URL. `import from './public/icon.png'` and `src="public/icon.png"` are both wrong, and the second one silently works in dev on some setups, which is worse than failing.

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
import tinyIcon from './assets/icon.svg';    // small file (under the 4096-byte default) → base64
                                             // data: URI, NO separate file emitted

function Hero() {
  return <img src={heroImage} alt="Hero" />; // works identically regardless of which resolution path was taken
}
```

```javascript
// Special import suffixes for non-default resolution
import shaderSource from './shader.glsl?raw'; // raw string content — not a URL, the actual file text
import ImageWorker from './image-worker.js?worker'; // a Worker CONSTRUCTOR — `new ImageWorker()` spins one up
import iconUrl from './icon.svg?no-inline'; // emits a separate, hashed, independently cacheable file
                                            // even though this SVG is small enough to be inlined
import shaderUrl from './shader.glsl?url';  // ?url is the OTHER job: get a URL for a file type Vite
                                            // does not already classify as an asset

const worker = new ImageWorker(); // genuinely instantiates a Web Worker from image-worker.js
worker.postMessage({ data: someImageBuffer });
```

⚠️ **`?worker` was not re-checked in this pass** — it lives in the features reference rather than the assets guide, and that page was outside the fetch budget. The claim is unchanged from this page's original authoring; see [13 · Worker and WASM support](../13-worker-and-wasm-support/01-advanced-runtime-targets.md) for the treatment that owns it.

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
Inlining small assets as base64 avoids a separate HTTP request, but base64 encoding itself adds roughly 33% overhead to the asset's byte size (it is 4 output characters per 3 input bytes — arithmetic, not a measurement), and an inlined asset can no longer be cached independently by the browser (it's baked into whatever JS/CSS file references it, invalidated whenever THAT file changes, not just when the asset itself changes). For an asset reused across many pages/components, a real separate cacheable file can outperform inlining despite the extra initial request.

🔴 **Two ways to get that separate file, and only one of them is per-asset.** Use the **`?no-inline`** suffix on the specific import — *"Assets can be explicitly imported with inlining or no inlining using the `?inline` or `?no-inline` suffix respectively."* — or **lower** `build.assetsInlineLimit` from its default of `4096` so fewer assets qualify at all. (An earlier version of this page said `?url` and "raising the threshold down"; the first is the wrong suffix and the second is backwards — raising the limit inlines *more*.)

---

## Gotchas

**★ Symptom: you add `?url` to stop an SVG being inlined and it is still a `data:` URI.** Cause: wrong suffix. `?url` is scoped to *"Assets that are not included in the internal list or in `assetsInclude`"* — it is how you get a URL for a file type Vite does not already classify as an asset. Fix: **`?no-inline`** is the one that means "do not inline this", and `?inline` is its opposite. Two suffixes, two jobs, and only one of them is about size.

**★ Symptom: an asset near the size boundary flips between a separate file and a data URI between builds, and cache-hit rates move with it.** Cause: `build.assetsInlineLimit` defaults to `4096` bytes and the decision is made per asset against that number, so an asset hovering around 4 KB changes behaviour whenever it is re-exported at a slightly different size. Fix: stop leaving it to the threshold for assets you actually care about — pin the decision with `?inline` or `?no-inline` at the import site, where it is visible to whoever reads the code next.

**★ Symptom: a file tracked by Git LFS ships as a base64 blob of the LFS pointer text.** Cause: it would, if Vite did not special-case it — the build reference notes that *"Git LFS placeholders are automatically excluded from inlining"*. Fix: nothing to do, but know the rule exists, because the symptom it prevents (a 130-byte pointer file inlined as though it were the asset) is one you would otherwise spend an afternoon on.

**★ Symptom: `src="public/logo.png"` works in dev and 404s in production.** Cause: the `public` directory name is not part of the URL. The docs are explicit — *"reference `public` assets using root absolute path - for example, `public/icon.png` should be referenced in source code as `/icon.png`."* Fix: drop the directory from every reference. The reason it survives to production is that in dev the file often resolves through the source tree as well, so the wrong path appears to work exactly until it is the only path available.

**★ Symptom: a `public/` asset is stale in users' browsers for weeks after a change.** Cause: files there are copied *"to the root of the dist directory as-is"* — no content hash, so the URL is identical before and after the change and every cache in the path is entitled to keep serving the old bytes. Fix: this is the deliberate trade of the directory, not a bug. Put only fixed-path files there (`robots.txt`, `favicon.ico`, a `manifest.json` a third party fetches at an exact URL) and route everything else through the import pipeline, which hashes.

**★ Symptom: you rename an asset in `public/` and nothing warns you that fifty references now point at nothing.** Cause: there is no import graph. A `public/` reference is a string, checked by nobody at build time. Fix: importing the asset instead gets you a build-time resolution error the moment the path is wrong — that build-time validation, not the hashing, is often the stronger reason to prefer imports.

**★ Symptom: you hardcode `/assets/logo.a1b2c3.png` after reading it out of DevTools, and it breaks on the next deploy.** Cause: the hash is content-derived and the served URL is not stable across builds — the docs describe an import resolving to `/src/img.png` in development and `/assets/img.2d8efhg.png` in production. Fix: never write a hashed path by hand; that is the entire reason the import returns a string rather than you naming the file.

**★ Symptom: `import.meta.glob(pattern)` returns an empty object when `pattern` is a variable.** Cause: the glob is resolved when the module is transformed, not when it runs — Vite has to enumerate the matching files and rewrite the call into a literal map before the browser ever sees it, and it cannot do that against a value that only exists at runtime. Fix: the pattern must be written inline as a literal. ⚠️ **I did not re-fetch the `import.meta.glob` reference in this pass**; this explanation follows from the transform being a build-time one, and the exact constraints are worth confirming against [vite.dev/guide/features](https://vite.dev/guide/features) before relying on an edge case.

**★ Symptom: `{ eager: true }` on a content directory and the initial bundle triples.** Cause: eager resolves every match into a static import, so all of it lands in the graph reachable from the entry, and code-splitting has nothing left to split. Fix: use the lazy default, which yields functions returning promises, and let each match become its own dynamically-imported chunk. Eager is right when you genuinely need every match synchronously at startup — a route table's *metadata*, for example — and wrong for the route *components* themselves.

**★ Symptom: `new URL('./img-' + name + '.png', import.meta.url)` produces a broken path in the build.** Cause: only static forms are rewritten — the docs note that for non-static URL strings *"Vite will not transform"* the expression, so it is left to resolve at runtime against a URL that no longer describes where the built file lives. Fix: keep the first argument a literal, and use `import.meta.glob` when you genuinely need a set of assets chosen at runtime. This is the same static-analysability constraint as the glob pattern, in a different costume.

## Interview questions

**★ What does `import logo from './logo.png'` actually evaluate to, and why does the answer depend on the file's size?**
It evaluates to a string URL. Which string depends on whether Vite inlined the asset: under `build.assetsInlineLimit` (default 4096 bytes) you get a base64 `data:` URI and no separate file is emitted at all; over it you get a path to a content-hashed emitted file. The consuming code cannot tell the difference, which is the point — `<img src={logo} />` works either way. The size threshold exists because the trade is a real one: below a few kilobytes the HTTP request overhead genuinely dominates the payload, and above it the ability to cache the asset independently dominates instead.

**★ When is `public/` the right answer, and when is reaching for it a mistake?**
It is right for exactly three situations the docs name: the asset is *"Never referenced in source code"* (`robots.txt`, a verification file some service fetches), it *"Must retain the exact same file name"* (a `manifest.json` at a contractual URL), or you want a URL without an import. It is a mistake for anything the app itself references, because you give up three things at once — content hashing, so you cannot cache-bust; build-time path resolution, so a typo is a runtime 404 with no warning; and any bundler-level processing. The instinct to use it for images is usually really an instinct to avoid thinking about import paths, and it trades a five-second annoyance for a class of silent production bug.

**★ `assetsInlineLimit` already controls inlining. Why does `?no-inline` need to exist?**
Because the limit is a global policy and inlining is a per-asset decision. A threshold cannot express "this 2 KB logo appears on every page and should be one cacheable file, but these 2 KB one-off icons should be inlined" — those assets are the same size and want opposite treatment. `?no-inline` and `?inline` move the decision to the import site, where the context that justifies it is visible. The secondary argument is stability: an asset sitting near the threshold changes behaviour when its byte size drifts, and pinning it removes a source of unexplained variance between builds.

**★ What is the difference between eager and lazy `import.meta.glob`, and how do you choose?**
Lazy — the default — returns an object mapping each path to a function that returns a dynamic import promise; each match becomes its own chunk, fetched on first call. Eager resolves every match into a static import, so everything is in the initial graph and available synchronously. Choose by asking whether you need *all* of it *at startup*. Route components: lazy, always, because the user visits one. A registry of small metadata objects used to build a menu: eager, because you need all of it immediately and dynamic-importing forty tiny modules is worse. The failure mode is using eager on a content directory and destroying code-splitting for the whole app, which does not show up until the bundle report.

**★ Why can neither `import.meta.glob`'s pattern nor `new URL(..., import.meta.url)`'s first argument be built from a variable?**
Because both are compile-time rewrites, not runtime functions. Vite has to know, while transforming the module, which files a glob matches so it can emit a literal map of them, and it has to know which asset a `new URL` refers to so it can emit the built asset and point at its hashed path. A value that only exists at runtime cannot be inspected at transform time, so both fall back to leaving the expression alone — which fails silently rather than loudly, because the code is still syntactically valid and just resolves against paths that do not exist in `dist/`. The general lesson generalises past Vite: anything a bundler rewrites requires a statically analysable argument, and "it worked in dev" is not evidence it was analysed.

**Why is inlining an asset not simply a free win?**
Three costs. Base64 is 4 characters per 3 bytes, so the payload grows about a third before compression. The asset stops being independently cacheable — it lives inside a JS or CSS file, and it is re-downloaded every time *that* file changes, which for app code is every deploy. And if the same asset is referenced from several chunks, it can be duplicated into each of them rather than shared. Against that you save one request. That trade is clearly worth it at a few hundred bytes and clearly not worth it for something reused across the app, which is why a threshold exists rather than a boolean.

---

← [Build System](../05-build-system-rollup/01-build-options.md) · [Vite overview](../../README.md) · Next → [Env Variables & Modes](../07-env-variables-and-modes/01-environment-system.md)
