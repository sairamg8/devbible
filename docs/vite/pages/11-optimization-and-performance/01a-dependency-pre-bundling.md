---
title: "Dependency pre-bundling exists for two unrelated reasons — CommonJS cannot be imported natively, and a package shipping 600 ESM files would cost 600 requests — and on Vite 8 Rolldown does it"
sidebar_label: "01a · Dependency pre-bundling"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling), [Dep Optimization Options](https://vite.dev/config/dep-optimization-options), [Migration from v7](https://vite.dev/guide/migration). Documentation-validated; **no sandbox run, no timings, no benchmarks**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Dependency Pre-Bundling

**Pre-bundling is the one place where Vite's "no bundling in dev" claim is deliberately false, and it is false for two reasons that have nothing to do with each other.** The first is correctness: the browser cannot `import` a CommonJS module, so anything shipped as CJS or UMD must be rewritten to ESM before it can be served. The second is request economics: a package that ships hundreds of small ESM files would produce hundreds of parallel requests for one `import` statement. Vite solves both by bundling `node_modules` — and only `node_modules` — once, at cold start, and caching the result. On Vite 8 the tool doing that bundling changed from esbuild to Rolldown, and the option namespace changed with it.

## 1. Under-The-Hood Mechanics

> *"When you run `vite` for the first time, Vite prebundles your project dependencies before loading your site locally. It is done automatically and transparently by default."* — [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling)

### Purpose one — CommonJS and UMD compatibility

> *"**CommonJS and UMD compatibility:** During development, Vite serves all code as native ESM. Therefore, Vite must convert dependencies that are shipped as CommonJS or UMD into ESM first."*

The subtlety is named exports. CommonJS assigns exports at runtime, so a static ESM `import { useState } from 'react'` has nothing to bind against unless someone analyses the module body:

> *"When converting CommonJS dependencies, Vite performs smart import analysis so that named imports to CommonJS modules will work as expected even if the exports are dynamically assigned (e.g. React)"*

```js
// works as expected — quoted from the Vite docs
import React, { useState } from 'react'
```

That single sentence is why "just exclude it from pre-bundling" is nearly always wrong for a CJS package: excluding it does not make the browser able to import it.

### Purpose two — collapsing a package's internal module graph

> *"**Performance:** Vite converts ESM dependencies with many internal modules into a single module to improve subsequent page load performance."*

> *"Some packages ship their ES modules builds as many separate files importing one another. For example, [`lodash-es` has over 600 internal modules](https://unpkg.com/browse/lodash-es/)! When we do `import { debounce } from 'lodash-es'`, the browser fires off 600+ HTTP requests at the same time! Even though the server has no problem handling them, the large number of requests creates network congestion on the browser side, causing the page to load noticeably slower."*

> *"By pre-bundling `lodash-es` into a single module, we now only need one HTTP request instead!"*

⚠️ Those counts are the documentation's own, quoted as printed. Nothing on this page was measured.

### Dev only, and Rolldown on v8

> *"Dependency pre-bundling only applies in development mode."*

> *"Rolldown is now used for dependency optimization instead of esbuild."* — [Migration from v7](https://vite.dev/guide/migration)

The escape hatch moved with it. `optimizeDeps.rolldownOptions` is the v8 name, typed as `Omit<RolldownOptions, 'input' | 'logLevel' | 'output'>` plus a restricted `output`, and:

> *"Certain options are omitted since changing them would not be compatible with Vite's dep optimization."* … *"`plugins` are merged with Vite's dep plugin"* — [Dep Optimization Options](https://vite.dev/config/dep-optimization-options)

`optimizeDeps.esbuildOptions` still works and is deprecated — *"This option is converted to `optimizeDeps.rolldownOptions` internally."* The rename table is in [01c](01c-optimizedeps-include-and-exclude.md).

### How Vite decides what to pre-bundle

> *"If an existing cache is not found, Vite will crawl your source code and automatically discover dependency imports (i.e. \"bare imports\" that expect to be resolved from `node_modules`) and use these found imports as entry points for the pre-bundle. The pre-bundling is performed with [Rolldown](https://rolldown.rs/), so it's typically very fast."*

Where the crawl starts is `optimizeDeps.entries`:

> *"By default, Vite will crawl all your `.html` files to detect dependencies that need to be pre-bundled (ignoring `node_modules`, `build.outDir`, `__tests__` and `coverage`). If the top-level [`input`](https://vite.dev/config/shared-options#input) or `build.rolldownOptions.input` is specified, Vite will crawl those entry points instead."*

Setting it explicitly changes the ignore behaviour, which is easy to miss:

> *"This will overwrite default entries inference. Only `node_modules` and `build.outDir` folders will be ignored by default when `optimizeDeps.entries` is explicitly defined. If other folders need to be ignored, you can use an ignore pattern as part of the entries list, marked with an initial `!`. `node_modules` will not be ignored for patterns that explicitly include the string `node_modules`."*

### The mid-session re-bundle — the behaviour people report as "Vite keeps reloading"

> *"After the server has already started, if a new dependency import is encountered that isn't already in the cache, Vite will re-run the dep bundling process and reload the page if needed."*

```text
cold start ──► scan entries ──► pre-bundle discovered deps ──► serve
                                        │
    browser requests a route that imports a dep NOT in the cache
                                        │
                                        ▼
                        re-run dep bundling ──► full page reload "if needed"
```

`optimizeDeps.holdUntilCrawlEnd` is the knob that trades startup latency against that reload, and its default is `true`:

> *"When enabled, it will hold the first optimized deps results until all static imports are crawled on cold start. This avoids the need for full-page reloads when new dependencies are discovered and they trigger the generation of new common chunks. If all dependencies are found by the scanner plus the explicitly defined ones in `include`, it is better to disable this option to let the browser process more requests in parallel."*

⚠️ It is flagged **Experimental** in the reference. Treat a change to it as reversible tuning, not as config you rely on.

### Turning discovery off entirely

> *"When set to `true`, automatic dependency discovery will be disabled and only dependencies listed in `optimizeDeps.include` will be optimized. CJS-only dependencies must be present in `optimizeDeps.include` during dev."* — `optimizeDeps.noDiscovery`

That second sentence is the whole cost of the option: you have taken over responsibility for a list Vite was maintaining for you, and the failure mode of forgetting an entry is a CJS package the browser cannot import.

---

## 2. Real-World Engineering Scenario

**Scenario**: a dev server that always full-reloads a few seconds after it becomes usable.

An internal plugin injected `import { track } from '@acme/analytics'` into every route module during `transform`. The initial scanner never saw that import, because it does not exist in the source on disk — it exists only after a transform runs. The docs describe exactly this shape:

> *"A typical use case for `optimizeDeps.include` or `optimizeDeps.exclude` is when you have an import that is not directly discoverable in the source code. For example, maybe the import is created as a result of a plugin transform. This means Vite won't be able to discover the import on the initial scan - it can only discover it after the file is requested by the browser and transformed. This will cause the server to immediately re-bundle after server start."*

The fix is one line — put the package in `optimizeDeps.include` so the scanner does not have to find it. The tell that this is the diagnosis, rather than a flaky HMR bug, is that the reload happens on the *first* navigation after every cold start and never again until the cache is invalidated.

---

## 3. Production-Grade Code Example

```typescript
// vite.config.ts (Vite 8) — an app whose dependency graph the scanner cannot fully see.
import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    // The scanner crawls .html by default. This app's real entry points are a
    // multi-page set plus a Storybook-style sandbox, and one directory must not
    // be crawled — the leading '!' is the documented ignore form.
    entries: ['index.html', 'admin/index.html', 'src/**/*.stories.tsx', '!src/legacy/**'],

    // Injected by a plugin during transform, so the initial scan cannot see it.
    // Without this, the server re-bundles and full-reloads on first navigation.
    include: ['@acme/analytics'],

    // Escape hatch to the underlying bundler. v8 name; `esbuildOptions` is the
    // deprecated alias and is converted to this internally.
    rolldownOptions: {
      // Only options Vite does not need to control itself are accepted here.
      define: { __ACME_DEV__: 'true' },
    },
  },
});
```

```typescript
// vite.config.ts — the fully-explicit variant: no discovery at all.
// Only use this when you are prepared to maintain the list by hand.
import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    noDiscovery: true,
    // 🔴 With noDiscovery, this list is the ENTIRE set. The docs are explicit that
    // "CJS-only dependencies must be present in optimizeDeps.include during dev".
    include: ['react', 'react-dom', 'react-dom/client', '@acme/analytics', 'lodash-es'],
    // The scanner is off, so nothing will be found late — the hold buys nothing.
    holdUntilCrawlEnd: false,
  },
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: excluding a CommonJS package to "skip the pre-bundle step"

```typescript
// ❌ WRONG: this does not skip work, it removes the CJS→ESM conversion. The browser
// then receives a file containing `module.exports = ...` and cannot import it.
optimizeDeps: { exclude: ['some-cjs-only-package'] },

// ✅ CORRECT: CJS packages belong in the pre-bundle. If the cost is the problem,
// the lever is the cache (01b), not the exclusion list.
optimizeDeps: { include: ['some-cjs-only-package'] },
```

The reference carries this as a standing warning: *"CommonJS dependencies should not be excluded from optimization."*

### ⚠️ Pitfall 2: setting `optimizeDeps.entries` and losing the default ignores

```typescript
// ❌ RISKY: once `entries` is set explicitly, only `node_modules` and `build.outDir`
// are ignored by default — `__tests__` and `coverage` are NOT ignored anymore.
optimizeDeps: { entries: ['src/**/*.{ts,tsx}'] },

// ✅ CORRECT: restate the ignores you were relying on, using the '!' prefix form.
optimizeDeps: {
  entries: ['src/**/*.{ts,tsx}', '!src/**/__tests__/**', '!coverage/**'],
},
```

### ⚠️ Pitfall 3: assuming `needsInterop` is something you should be configuring

`optimizeDeps.needsInterop` exists, is marked **Experimental**, and the reference tells you not to reach for it:

> *"Vite is able to properly detect when a dependency needs interop, so this option isn't generally needed. However, different combinations of dependencies could cause some of them to be prebundled differently. Adding these packages to `needsInterop` can speed up cold start by avoiding full-page reloads. You'll receive a warning if this is the case for one of your dependencies, suggesting to add the package name to this array in your config."*

The correct trigger is the warning naming the package. Adding entries speculatively forces interop where Vite decided it was unnecessary.

---

## Gotchas

**★ Symptom: the dev server full-reloads on the first navigation after every cold start.** Cause: a dependency was discovered late — commonly one an import injected by a plugin `transform`, which the initial scan cannot see. Fix: name it explicitly so the scanner does not need to find it.
```typescript
optimizeDeps: { include: ['@acme/analytics'] },
```

**★ Symptom: `import { useState } from 'react'` works, but the same style of named import from a smaller CJS package throws at runtime.** Cause: the *smart import analysis* the docs describe runs as part of pre-bundling. If that package was excluded, or discovery was turned off without listing it, no analysis happened. Fix: get it back into the optimizer — `optimizeDeps.include: ['that-package']`. Do not "fix" it by rewriting the import to a default import plus destructuring; that hides the misconfiguration and breaks again the next time the package's exports move.

**★ Symptom: a dependency imported only from a test file or a Storybook story is never pre-bundled.** Cause: the default crawl is over `.html` files, and *"ignoring `node_modules`, `build.outDir`, `__tests__` and `coverage`"*. Fix: either add the real entry points to `optimizeDeps.entries`, or list the package in `include`. The second is cheaper and does not change the ignore semantics.

**★ Symptom: you set `optimizeDeps.entries` and now test fixtures are being crawled.** Cause: explicit `entries` narrows the default ignore set to `node_modules` and `build.outDir` only. Fix: add negative patterns — `'!src/**/__tests__/**'` — as list members.

**★ Symptom: `noDiscovery: true` produced a clean start, then a route deep in the app fails to import a package.** Cause: with discovery off, `include` is the complete set, and a CJS-only package that is missing from it is served unconverted. Fix: add it. The maintenance burden is the price of the option, and it is the reason `noDiscovery` is a poor default for an app under active development.

**★ Symptom: `optimizeDeps.esbuildOptions` no longer seems to control what it used to.** Cause: v8 converts it to `optimizeDeps.rolldownOptions` internally, and the two option sets are not identical — the migration guide gives an explicit per-option mapping. Fix: port to `rolldownOptions` using that table rather than assuming a passthrough. Full table in [01c](01c-optimizedeps-include-and-exclude.md).

**★ Symptom: an option you passed to `optimizeDeps.rolldownOptions` appears to be ignored.** Cause: the type deliberately omits some — `input`, `logLevel`, `output` at the top level, and `format`, `sourcemap`, `dir`, `banner` within `output`. *"Certain options are omitted since changing them would not be compatible with Vite's dep optimization."* Fix: nothing to fix; these are Vite's to control. If you need that level of control over dependency output, you are trying to build a bundle, not optimize dependencies.

**★ Symptom: turning `holdUntilCrawlEnd` off made the app reload more, not less.** Cause: the hold exists precisely to prevent that. *"This avoids the need for full-page reloads when new dependencies are discovered."* Turning it off is only correct when *"all dependencies are found by the scanner plus the explicitly defined ones in `include`"*. Fix: put the deps back in `include` first, then disable the hold — in that order.

## Interview questions

**★ Vite says it does not bundle in development. Why does it bundle `node_modules` then?**
Because the two problems it solves in `node_modules` do not exist in your source. Your source is already ESM — the browser can import it directly, one file at a time, which is what makes on-demand transformation possible. Dependencies are neither guaranteed to be ESM nor guaranteed to be a small number of files. CommonJS cannot be imported natively at all, and a package like `lodash-es` that ships hundreds of internal modules would turn one `import` into hundreds of parallel requests. Pre-bundling converts and flattens once, at cold start, and caches the result — so the exception is scoped to exactly the directory where the rule does not hold.

**★ What does "smart import analysis" buy, and what breaks without it?**
Named imports from CommonJS. CJS assigns to `module.exports` at runtime, so there is no static export list for `import { useState } from 'react'` to bind to. The pre-bundler analyses the module to work out what names it will produce and emits an ESM shim that exports them. Without it — which is what you get if you exclude a CJS package from optimization — the browser receives CommonJS it cannot parse as a module, and named imports fail. This is why "exclude it, it'll be faster" is the single most common wrong answer about `optimizeDeps`.

**★ A dev server becomes usable and then hard-reloads a few seconds later, every cold start. What is happening?**
A dependency is being discovered after the initial scan. The scanner crawls entry points on disk; anything that only becomes an import after a plugin transform, or that is only reachable from a route the scanner did not consider an entry, is invisible to it. When the browser eventually requests that module, Vite re-runs dep bundling and reloads. The named fix is `optimizeDeps.include`. The design-level fix is to stop injecting bare imports from plugins, because a synthetic import is invisible to every static tool, not just Vite's scanner.

**★ When would you set `noDiscovery: true`, and what does it cost?**
When the dependency set is genuinely fixed and you want a deterministic cold start with no possibility of a mid-session re-bundle — a locked-down internal app, a CI-driven preview environment, a reproducible benchmark harness. The cost is that `optimizeDeps.include` becomes the complete list and you maintain it by hand, with the docs' warning that *"CJS-only dependencies must be present in `optimizeDeps.include` during dev"*. On a codebase where people add dependencies weekly, that list rots and the failure surfaces as an import error on someone else's machine.

**★ What changed about pre-bundling in Vite 8, and does it change how you configure it?**
The engine: *"Rolldown is now used for dependency optimization instead of esbuild."* The configuration surface changed name with it — `optimizeDeps.esbuildOptions` is deprecated and converted internally to `optimizeDeps.rolldownOptions`. What did *not* change is the model: still dev-only, still crawl-then-bundle, still cached in `node_modules/.vite`, still `include`/`exclude` as the manual overrides. So for most projects the answer is "nothing to configure differently" — the projects that do have work are the ones that had reached into esbuild-specific options, and for those the migration guide provides a per-option mapping rather than a passthrough.

---

← [01 · Build-time performance](01-build-time-performance.md) · [Vite overview](../../README.md) · Next → [01b · The pre-bundle cache](01b-the-pre-bundle-cache.md)
