---
title: "Vite already rewrites your dynamic imports to fetch their dependencies in parallel and already emits modulepreload directives — the options here exist for the two cases it cannot infer: a non-HTML entry, and cascading hash invalidation"
sidebar_label: "01g · Preloading and cache granularity"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Features → Build Optimizations](https://vite.dev/guide/features), [Build Options](https://vite.dev/config/build-options) (`build.modulePreload`, `build.chunkImportMap`, `build.cssCodeSplit`). Documentation-validated; **no sandbox run, no timings, no benchmarks**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Preloading and Cache Granularity

**Three of the most valuable things Vite's build does for load performance are automatic, undocumented in most configs, and easy to break by accident.** It emits `<link rel="modulepreload">` for entry chunks, it rewrites every dynamic import so the chunk's own dependencies are fetched in parallel rather than discovered one round trip later, and it splits CSS per async chunk with a guarantee that the chunk does not evaluate before its stylesheet has loaded. The options in this chunk exist for the cases inference cannot cover: a build with no HTML entry, a deployment whose base path is decided at runtime, and the cascading cache invalidation that is inherent to ES modules.

## 1. Under-The-Hood Mechanics

> *"Features listed below are automatically applied (except for the experimental chunk import map feature) as part of the build process and there is no need for explicit configuration unless you want to disable them."* — [Features → Build Optimizations](https://vite.dev/guide/features)

### Preload directives

> *"Vite automatically generates `<link rel=\"modulepreload\">` directives for entry chunks and their direct imports in the built HTML."*

### The waterfall elimination — the one people re-implement by hand

> *"In real world applications, Rollup often generates \"common\" chunks - code that is shared between two or more other chunks. Combined with dynamic imports, it is quite common to have the following scenario:"*
> *"In the non-optimized scenarios, when async chunk `A` is imported, the browser will have to request and parse `A` before it can figure out that it also needs the common chunk `C`. This results in an extra network roundtrip:"*

```text
Entry ---> A ---> C
```

> *"Vite automatically rewrites code-split dynamic import calls with a preload step so that when `A` is requested, `C` is fetched **in parallel**:"*

```text
Entry ---> (A + C)
```

> *"It is possible for `C` to have further imports, which will result in even more roundtrips in the un-optimized scenario. Vite's optimization will trace all the direct imports to completely eliminate the roundtrips regardless of import depth."*

⚠️ That passage still says *"Rollup"* on the Vite 8 documentation. The bundler on v8 is Rolldown; the described optimisation is Vite's own rewrite of the dynamic import call and is unaffected by which bundler produced the chunks. I am flagging the stale word rather than repeating it as a v8 fact.

### `build.modulePreload` and its polyfill

> **Default:** `{ polyfill: true }`
> *"By default, a [module preload polyfill](https://guybedford.com/es-module-preloading-integrity#modulepreload-polyfill) is automatically injected. The polyfill is auto injected into the proxy module of each `index.html` entry. If the build is configured to use a non-HTML custom entry via `build.rolldownOptions.input`, then it is necessary to manually import the polyfill in your custom entry:"* — [Build Options](https://vite.dev/config/build-options)

```js
import 'vite/modulepreload-polyfill'
```

> *"Note: the polyfill does **not** apply to [Library Mode](https://vite.dev/guide/build#library-mode). If you need to support browsers without native dynamic import, you should probably avoid using it in your library."*

> *"The polyfill can be disabled using `{ polyfill: false }`."*

### The base-path subtlety

> *"The list of chunks to preload for each dynamic import is computed by Vite. By default, an absolute path including the `base` will be used when loading these dependencies. If the `base` is relative (`''` or `'./'`), `import.meta.url` is used at runtime to avoid absolute paths that depend on the final deployed base."*

So a relative `base` is not merely a shorter URL — it changes the mechanism from a build-time absolute path to a runtime resolution against `import.meta.url`. That is what makes a relative-base build portable across unknown deployment prefixes.

For finer control there is an experimental hook:

```ts
type ResolveModulePreloadDependenciesFn = (
  url: string,
  deps: string[],
  context: {
    hostId: string
    hostType: 'html' | 'js'
  },
) => string[]
```

> *"The `resolveDependencies` function will be called for each dynamic import with a list of the chunks it depends on, and it will also be called for each chunk imported in entry HTML files. A new dependencies array can be returned with these filtered or more dependencies injected, and their paths modified. The `deps` paths are relative to the `build.outDir`. The return value should be a relative path to the `build.outDir`."*

### Cascading cache invalidation, and `build.chunkImportMap`

> *"To improve the cache hit rate of chunks, Vite can create an import map for chunks. This prevents the cascading cache invalidation issue, which is a problem with ES Modules."*

The mechanism, verbatim, for the graph `Entry --> A ---> C`:

> *"If `C` is updated, the only chunk that inherently needs to be invalidated is `C`. However, if `A` references `C` via a normal URL in a static import (i.e. the hash of `C` is included in the URL), the content of `A` is changed, thus `A` would also need to be invalidated. The same applies to `Entry`."*

> *"When this optimization is enabled, Vite will create an import map that maps each chunk's ID to its URL and uses the chunk ID in the import statements instead of the URL. This way, when a chunk is updated, only the updated chunk needs to be invalidated, while the chunks that reference it will not be invalidated."*

Two documented limits:

> *"Note that this optimization currently does not apply to CSS and assets. If you update an asset, the chunks that reference it will be invalidated. That said, the invalidation would not cascade and the chunk importing the invalidated chunk would not be invalidated."*

> *"Note that this option requires [`import.meta.resolve` support](https://caniuse.com/mdn-javascript_operators_import_meta_resolve). If you need to support older browsers, check out [`@vitejs/plugin-legacy`](https://github.com/vitejs/vite/tree/main/packages/plugin-legacy)."*

It is `false` by default and marked **Experimental**.

### CSS code splitting, and the FOUC guarantee

> *"Vite automatically extracts the CSS used by modules in an async chunk and generates a separate file for it. The CSS file is automatically loaded via a `<link>` tag when the associated async chunk is loaded, and the async chunk is guaranteed to only be evaluated after the CSS is loaded to avoid [FOUC](https://en.wikipedia.org/wiki/Flash_of_unstyled_content)."*

> *"If you'd rather have all the CSS extracted into a single file, you can disable CSS code splitting by setting [`build.cssCodeSplit`](https://vite.dev/config/build-options#build-csscodesplit) to `false`."* — default `true`, and *"If you specify `build.lib`, `build.cssCodeSplit` will be `false` as default."*

---

## 2. Real-World Engineering Scenario

**Scenario**: a one-line change to a shared utility invalidates 80% of the cached bundle.

The app has a `formatCurrency` helper in a chunk that most routes statically import. Changing it changes that chunk's content hash — which is correct and unavoidable. What is avoidable is what happens next: every chunk that imports it does so by URL, and the URL contains the hash, so the *importing* chunks' contents changed too. Their hashes change. Their importers' hashes change. One leaf edit propagates all the way to the entry.

This is not a Vite defect; the documentation calls it *"a problem with ES Modules"*. The static import specifier is a URL, and a content-hashed URL makes every reference to a chunk part of the referrer's content.

`build.chunkImportMap: true` breaks the propagation by adding a layer of indirection: import statements name a stable chunk *ID*, and an import map in the HTML translates IDs to hashed URLs. The IDs do not change when content changes, so only the genuinely-modified chunk is invalidated. The costs are real and documented — it is experimental, it requires `import.meta.resolve` in the browser, and it does not cover CSS or assets.

---

## 3. Production-Grade Code Example

```typescript
// vite.config.ts (Vite 8) — a non-HTML entry, a relative base, and the import map.
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base: preload dependency paths are resolved at RUNTIME against
  // import.meta.url instead of being baked in as absolute paths. Required when the
  // deployment prefix is not known at build time (a CDN path chosen per tenant).
  base: './',

  build: {
    // No index.html — the entry is a JS module. See the polyfill note below.
    rolldownOptions: {
      input: 'src/widget-entry.ts',
    },

    modulePreload: {
      // Default is true. Keep it unless you have measured that every target browser
      // supports modulepreload natively.
      polyfill: true,
    },

    // EXPERIMENTAL, default false. Breaks the cascading-hash chain by importing
    // chunks through stable IDs resolved via an import map.
    // 🔴 Requires `import.meta.resolve` in the browser.
    chunkImportMap: true,
  },
});
```

```typescript
// src/widget-entry.ts — a NON-HTML entry must import the polyfill itself.
// "If the build is configured to use a non-HTML custom entry via
//  build.rolldownOptions.input, then it is necessary to manually import the
//  polyfill in your custom entry."
import 'vite/modulepreload-polyfill';

import { mountWidget } from './mount';

mountWidget(document.querySelector('#widget-root')!);
```

```typescript
// vite.config.ts — library mode, where two of the above defaults flip.
export default defineConfig({
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'] },
    // ⚠️ In lib mode the modulePreload polyfill does NOT apply, and
    //    build.cssCodeSplit defaults to false. Both are documented defaults,
    //    not something you configure — stated here so a reader is not surprised.
  },
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: switching to a custom entry and losing the polyfill silently

```typescript
// ❌ The polyfill is injected into "the proxy module of each index.html entry".
// A build with only `rolldownOptions.input` has no such proxy module, so nothing
// is injected — and nothing warns.
build: { rolldownOptions: { input: 'src/main.ts' } },

// ✅ Import it explicitly, as the first statement of the custom entry.
// src/main.ts
import 'vite/modulepreload-polyfill';
```

### ⚠️ Pitfall 2: enabling `chunkImportMap` without checking browser support

It requires `import.meta.resolve`. The documented path for older browsers is `@vitejs/plugin-legacy`, not "it degrades gracefully" — the docs make no such claim, and I could not find one. Treat it as a hard requirement.

### ⚠️ Pitfall 3: disabling `cssCodeSplit` to "reduce requests"

Turning it off extracts *all* project CSS into one file, which every route then downloads whether or not it uses any of it. It also discards the ordering guarantee that async chunks are *"guaranteed to only be evaluated after the CSS is loaded"* for their own stylesheet, because there is no longer a per-chunk stylesheet to wait for. It is the right call for a small app with one theme, and a regression for a large one.

### ⚠️ Pitfall 4: hand-rolling preload links that Vite already emits

Vite emits `<link rel="modulepreload">` for entry chunks and their direct imports, and rewrites dynamic imports to fetch their dependencies in parallel. Adding manual preload tags for the same chunks duplicates the hints and risks preloading a hashed filename that changes on the next build.

---

## Gotchas

**★ Symptom: after switching to a JS entry point, dynamic imports fail on an older browser that worked before.** Cause: the modulepreload polyfill is injected into the proxy module of an `index.html` entry, and a non-HTML entry has none. Fix: import it manually as the first line of the entry.
```js
import 'vite/modulepreload-polyfill'
```

**★ Symptom: a library you publish behaves differently from the app you tested it in.** Cause: *"the polyfill does **not** apply to Library Mode"*, and `build.cssCodeSplit` also defaults to `false` there. Fix: nothing to change — but do not assume app defaults carry over. The docs' own advice for a library that needs old-browser dynamic import is *"you should probably avoid using it in your library."*

**★ Symptom: preloaded chunk URLs 404 after deploying under a path prefix you did not know at build time.** Cause: with a non-relative `base`, preload paths are absolute and include the build-time base. Fix: set `base: './'`, which switches the mechanism to runtime resolution via `import.meta.url`. This is a build-time decision — it cannot be patched after the fact by rewriting HTML.

**★ Symptom: one small utility change invalidates nearly every chunk in the browser cache.** Cause: cascading hash invalidation, which the docs describe as *"a problem with ES Modules"* — an importer's content includes the hashed URL of what it imports. Fix: `build.chunkImportMap: true`, which routes imports through stable chunk IDs. Verify `import.meta.resolve` support for your target browsers first, and note it does not cover CSS or assets.

**★ Symptom: `chunkImportMap` is on and an asset change still invalidates the chunk that references it.** Cause: documented — *"this optimization currently does not apply to CSS and assets."* Fix: expected. The docs add the mitigation that matters: *"the invalidation would not cascade and the chunk importing the invalidated chunk would not be invalidated."* One level, not the whole graph.

**★ Symptom: a flash of unstyled content on a lazily-loaded route.** Cause: something bypassed per-chunk CSS — usually `cssCodeSplit: false`, or styles injected by JavaScript rather than emitted as a stylesheet. Fix: leave `cssCodeSplit` at its default of `true`, where *"the async chunk is guaranteed to only be evaluated after the CSS is loaded to avoid FOUC."*

**★ Symptom: adding manual `<link rel="modulepreload">` tags did not improve anything and broke after a rebuild.** Cause: Vite already emits them for entry chunks and their direct imports, and chunk filenames are content-hashed. Fix: delete the manual tags. If you need to *change* the computed list — filter it, or add a chunk Vite could not infer — the documented hook is the experimental `modulePreload.resolveDependencies`, which receives `deps` relative to `build.outDir` and must return paths relative to it.

**★ Symptom: `resolveDependencies` returns paths that resolve to nothing.** Cause: the contract is relative to `build.outDir` in both directions — *"The `deps` paths are relative to the `build.outDir`. The return value should be a relative path to the `build.outDir`."* Returning an absolute URL, or a path relative to the project root, silently produces bad preload hints. Fix: keep every path in the function relative to `outDir`.

## Interview questions

**★ What problem does Vite's dynamic-import rewriting solve, and why can the browser not solve it itself?**
When the browser fetches an async chunk `A` that also needs a common chunk `C`, it cannot know about `C` until it has downloaded and parsed `A` — the dependency is stated *inside* the file. That is an extra network round trip, and it repeats at every level of depth. The browser cannot fix it because the information does not exist until the file arrives. The bundler can, because it built the graph: Vite rewrites the dynamic import call site to also request the chunk's dependencies, so *"when `A` is requested, `C` is fetched in parallel"*, and the docs state it traces all direct imports *"to completely eliminate the roundtrips regardless of import depth."* It is a good example of an optimisation that is only available to whoever holds the whole graph.

**★ Why does a relative `base` change the preload mechanism rather than just the URLs?**
Because an absolute path has to be decided at build time, and a relative deployment prefix is by definition not known then. With a non-relative `base`, Vite writes preload dependency paths as absolute URLs including that base. With `base` set to `''` or `'./'`, it instead uses `import.meta.url` at runtime — the module asks the runtime where it was loaded from and resolves its siblings against that. The consequence for design is that "deploy the same artefact under any prefix" is a build-time choice; you cannot retrofit it by rewriting HTML, because the paths are inside the JavaScript.

**★ Explain cascading cache invalidation in ES modules, and what an import map does about it.**
A static import specifier is a URL, and with content hashing that URL contains the hash of the imported chunk. So the importing chunk's *source text* changes whenever the imported chunk changes, which changes the importer's hash, which changes its importers' source text, and so on to the entry. One leaf edit therefore invalidates a path all the way up the graph — which the Vite docs call *"a problem with ES Modules"* rather than a Vite problem, because it is inherent to hashing URLs that appear in source. `build.chunkImportMap` inserts indirection: imports reference a stable chunk ID, and an import map in the HTML maps IDs to hashed URLs. The IDs do not change, so importers do not change, so only the modified chunk is invalidated. The costs are that it is experimental, it needs `import.meta.resolve`, and it does not cover CSS or assets.

**★ When is disabling `cssCodeSplit` the right call?**
When the CSS is small, largely shared, and the number of requests matters more than the precision of what each route downloads — a marketing site with one stylesheet, or a build being embedded somewhere that expects a single CSS file. What you give up is that CSS follows the code that uses it: with splitting on, an async route's stylesheet is emitted alongside its chunk and the chunk *"is guaranteed to only be evaluated after the CSS is loaded"*, which is what prevents a flash of unstyled content on lazy routes. With it off, every route downloads all the CSS, and the per-chunk ordering guarantee no longer has anything to apply to. It is also worth knowing that library mode already defaults it to `false`, so a library author is in this mode whether or not they chose it.

**★ Two of these features are automatic and one is opt-in. What does that tell you about their risk profiles?**
Preload directive generation and dynamic-import rewriting are on by default because they are strictly additive and require nothing of the browser beyond what the build already assumes — the docs group them under features that *"are automatically applied … and there is no need for explicit configuration unless you want to disable them."* `chunkImportMap` is opt-in and experimental because it changes the *form* of the emitted import statements and depends on a browser capability, `import.meta.resolve`, that not every target supports; the documented fallback for older browsers is a separate plugin, not graceful degradation. As a general rule, a build optimisation that only adds hints can be a default, and one that changes the module graph's runtime resolution cannot be.

---

← [01f · Chunk-size warnings and size reporting](01f-chunk-size-warnings-and-size-reporting.md) · [Vite overview](../../README.md) · Next → [01h · Sourcemaps, target and minifiers](01h-sourcemaps-target-and-minifiers.md)
