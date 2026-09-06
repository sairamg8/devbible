---
title: "Vite Core Architecture: The Dual-Engine Model"
sidebar_label: "Vite Core Architecture"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Vite documentation — [Why Vite](https://vite.dev/guide/why), [Migration from v7](https://vite.dev/guide/migration), [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling), [Build Options](https://vite.dev/config/build-options). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-06 · claims + output provenance · session 4e8d4393

# ⚡ Vite Core Architecture: The Dual-Engine Model

## 1. Under-The-Hood Mechanics

Vite's speed comes from running **two entirely different strategies for two entirely different jobs** — never bundling your application source during development at all, and bundling exhaustively only for the final production build.

🔴 **The "dual *engine*" reading of this page is now history, and the history is the interesting part.** Through Vite 7 the two jobs were done by two separate tools. Vite 8 unified them:

> *"Vite originally relied on two separate tools under the hood: esbuild for fast compilation during development, and Rollup for thorough optimization in production builds."* — [Why Vite](https://vite.dev/guide/why)

> *"Rolldown was built to unify both into a single bundler"* — [Why Vite](https://vite.dev/guide/why)

> *"Vite 8 uses Rolldown and Oxc based tools instead of esbuild and Rollup."* — [Migration from v7](https://vite.dev/guide/migration)

So the **two modes** are still real and still the thing to understand. The **two engines** are not: on Vite 8 there is one Rust-based bundler, Rolldown, on both sides of the line, with Oxc doing the per-file transform work esbuild used to do.

```text
DEVELOPMENT (vite / vite dev)                        PRODUCTION BUILD (vite build)
        │                                                    │
        ▼                                                    ▼
Native ESM served over HTTP                       Rolldown bundles the whole graph
  - browser requests each module directly            - full tree-shaking via static ESM analysis
  - Vite transforms ON DEMAND, per-file,                - code-splitting, chunk optimization
    only files the browser actually requests             - minification (build.minify defaults to 'oxc'
  - Rolldown pre-bundles node_modules deps                 for the client build), CSS extraction
    (CommonJS/UMD → ESM, flattened graphs)              - Oxc does the per-file transpilation to
                                                          build.target WITHIN the bundle pipeline
```

⚠️ **Vite 7 and earlier read the same diagram with `esbuild` in the left column and `Rollup` in the right.** If you are on a v7 codebase that mapping is still correct — [the v7 docs are still served](https://v7.vite.dev/guide/rolldown), and `vite.dev/guide/rolldown` now 301-redirects there, because on Vite 8 opting *in* to Rolldown is no longer a thing you do.

### Why No Dev-Time Bundling Is Fast
A traditional bundler-based dev server (webpack-dev-server, etc.) must build a dependency graph and produce **some** bundle before the browser can load anything — as an app grows, that initial bundling step (and every rebuild after a file change) gets slower in rough proportion to the app's total size. Vite instead serves each module as its own native ESM `import` over HTTP; the browser's own module resolution requests exactly the files the current page needs, and Vite transforms **only those files, on demand** — startup time stays roughly constant regardless of how large the rest of the untouched application is.

### Dependency Pre-Bundling: Solving Two Problems at Once
Native ESM `import` in the browser works fine for the app's own source, but two problems remain for `node_modules` dependencies: (1) many packages still ship as CommonJS/UMD, which the browser can't `import` natively at all, and (2) some packages internally split their exports across dozens or hundreds of small ESM files, which would mean dozens of separate HTTP requests just to load one logical dependency. `optimizeDeps` (Vite's pre-bundling step) runs once at cold start, converting CommonJS/UMD deps to ESM and flattening each dependency's internal module graph into a single, consolidated ESM file.

These are exactly the two reasons the documentation gives, in this order:

> *"CommonJS and UMD compatibility: During development, Vite serves all code as native ESM."* — [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling)

> *"Performance: Vite converts ESM dependencies with many internal modules into a single module."* — [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling)

🔴 **Which tool does it changed in Vite 8.** The docs now state flatly:

> *"The pre-bundling is performed with Rolldown."* — [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling)

> *"Rolldown is now used for dependency optimization instead of esbuild."* — [Migration from v7](https://vite.dev/guide/migration)

⚠️ **This page previously carried the claim that esbuild's Go implementation does this "10-100x faster" than a JS bundler.** That figure is esbuild's own marketing number, it is not on the current Vite docs, and it is no longer the relevant comparison because esbuild is not in the Vite 8 pipeline. It has been removed rather than restated — no substitute number is asserted here, because none was verifiable from primary documentation.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Large Application Where Dev Server Startup Collapsed From "make a coffee" to "already there".
⚠️ **The numbers below are illustrative of the shape of the change, not a measurement** — nothing on this page was timed, and the Vite docs publish no startup benchmark to cite. Migrating a large React app from a webpack-dev-server setup to Vite typically collapses cold dev-server start from tens of seconds to near-immediate, and file-change rebuild time from seconds to near-instant — not because Vite is doing less total work over the life of a dev session, but because it defers almost all of that work to be **on-demand, per-file**, rather than upfront, whole-app bundling. The team's mental model shift: Vite's dev server isn't a "faster bundler," it fundamentally isn't bundling most of the app at all during development.

---

## 3. Production-Grade Code Example

```typescript
// vite.config.ts — the dev/build split is largely invisible to app code, but explicit
// in what each config section actually configures
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()], // one plugin, both sides of the line: it hooks the dev transform
                      // pipeline AND the production bundle
  optimizeDeps: {
    // Forces these into the pre-bundling step even if not auto-detected —
    // useful for deps with unusual export conditions the scanner might miss
    include: ['some-legacy-commonjs-package'],
  },
  build: {
    // This section configures the PRODUCTION BUNDLE. On Vite 8 that is Rolldown,
    // and the option is `rolldownOptions` — `rollupOptions` still works as an alias.
    rolldownOptions: {
      // 🔴 NOT `output.manualChunks: { vendor: [...] }`. Vite 8: "The object form
      // output.manualChunks option is not supported anymore." See the Gotchas below.
      external: [],
    },
  },
});
```

```bash
# Observing the two modes directly
vite          # dev server — native ESM, on-demand transforms, deps pre-bundled by Rolldown;
              # your own source is NEVER bundled here
vite build    # production build — Rolldown bundles everything into optimized, tree-shaken chunks
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Assuming Dev and Production Builds Use Identical Transform Behavior
```text
❌ WRONG ASSUMPTION: because Vite 8 now runs "the same bundler on both sides," code that
behaves one way in `vite` (dev) is assumed to behave IDENTICALLY in `vite build`
(production) — but dev serves UNBUNDLED ESM while build produces BUNDLED, tree-shaken,
chunked, MINIFIED output. Unifying on Rolldown narrowed this gap; it did not close it,
because the gap was never mainly about which bundler — it is about bundling at all.
A bug that only reproduces in production (after `vite build`) usually traces back to
tree-shaking, chunk ordering or minification, none of which run in dev — always verify a
fix against an ACTUAL production build, not just the dev server, before calling it fixed.
```

### ⚠️ Pitfall 2: A Dependency Missing From `optimizeDeps.include`, Causing Constant Re-Bundling
```typescript
// ❌ SYMPTOM: the dev server keeps re-triggering "new dependencies optimized" and a full page
// reload, repeatedly, for a dependency Vite's automatic scanner didn't discover upfront
// (common with deps only imported conditionally, or via a dynamic path)

// ✅ FIX: explicitly list it so it's included in the INITIAL pre-bundling pass
export default defineConfig({
  optimizeDeps: { include: ['dynamically-imported-dep'] },
});
```

### ⚠️ Pitfall 3: Expecting Native ESM Dev Serving to Work Identically in Every Browser
Native ESM `import` serving during development relies on the browser's own module resolution — this requires a genuinely modern browser; Vite's dev server is not meant to be tested for legacy-browser compatibility directly (that's what `@vitejs/plugin-legacy`'s differential bundling handles specifically for the **production build**, not the dev experience). Assuming dev-server behavior is representative of legacy-browser production behavior is a mismatch between two different concerns.

---

## Gotchas

**★ Symptom: `output.manualChunks: { vendor: ['react'] }` stops doing anything after a Vite 8 upgrade.** Cause: the object form was removed. The migration guide is unambiguous — *"The object form `output.manualChunks` option is not supported anymore. The function form `output.manualChunks` is deprecated."* Fix: move to the function form as an immediate stopgap (still shipped, but on notice), and plan the real move to Rolldown's replacement, which the guide names: *"Rolldown has the more flexible [`codeSplitting`](https://rolldown.rs/reference/OutputOptions.codeSplitting) option."* ⚠️ **I did not read `codeSplitting`'s option shape, so no example of it is given here** — follow the link rather than trusting a shape reconstructed from the option's name. The migration guide does not state whether Vite errors on the object form or silently ignores it; treat it as removed either way.

**★ Symptom: you set `build.rollupOptions` and a lint or a type says to use something else.** Cause: Vite 8 renamed it. The migration guide lists ``build.rollupOptions``: *"renamed to `build.rolldownOptions`"*, and the build-options reference now describes the old name as an alias — *"This option is an alias of `build.rolldownOptions` option. Use `build.rolldownOptions` option instead."* Fix: rename it. It is a straight rename, not a behaviour change, and the alias means nothing breaks the day you upgrade — which is exactly why nobody does the rename until something else forces it.

**★ Symptom: a tutorial, a bookmark or a model tells you to install `rolldown-vite` to "opt in" to Rolldown.** Cause: that was the Vite 6/7 arrangement. `https://vite.dev/guide/rolldown` now returns **301 Moved Permanently** to `https://v7.vite.dev/guide/rolldown` — the opt-in page has been demoted to the v7 archive. Fix: on Vite 8 there is nothing to opt into; Rolldown is what `vite` and `vite build` already run. Installing `rolldown-vite` alongside Vite 8 is at best redundant.

**★ Symptom: after upgrading to Vite 8 the app breaks on a browser that worked yesterday, and you changed no config.** Cause: `build.target` defaults to `'baseline-widely-available'`, and Vite 8 moved what that resolves to. The migration guide: *"The default browser values of `build.target` and `'baseline-widely-available'` are updated to newer browser versions: Chrome 107 → 111, Edge 107 → 111, Firefox 104 → 114, Safari 16.0 → 16.4"* — and the build reference gives the resolved list as `['chrome111', 'edge111', 'firefox114', 'safari16.4', 'ios16.4']`. Fix: if you must keep the older floor, set `build.target` explicitly to the versions you actually support instead of inheriting a moving default.

**★ Symptom: your Terser options have no effect.** Cause: `build.minify` on Vite 8 defaults to `'oxc'` for the client build and `false` for the SSR build. A config block written for Terser is only consulted if you have actually selected Terser. Fix: check what `build.minify` resolves to before debugging minifier options — and note that the SSR build is not minified at all by default, so "my server bundle is huge" is expected, not a bug.

**★ Symptom: config keyed on esbuild by name behaves differently or is quietly ignored.** Cause: Vite 8 replaced esbuild with Oxc-based tooling across the pipeline — *"Vite 8 uses Rolldown and Oxc based tools instead of esbuild and Rollup."* Fix: re-read the config reference for any option whose **name contains a tool**. ⚠️ I did not enumerate which esbuild-named keys survive into Vite 8 and which were renamed or dropped, so do not take silence here as "they all still work" — check the specific key you use.

**★ Symptom: `npm create vite@latest` or `vite` refuses to run on a machine that ran the last project fine.** Cause: the Node floor. The getting-started guide states *"Vite requires Node.js version 20.19+, 22.12+. However, some templates require a higher Node.js version to work."* Fix: note the shape of that requirement — it is not "≥ 20.19", it is two separate windows, so Node 21.x and Node 22.0–22.11 are **below** the floor despite being numerically higher than 20.19.

**★ Symptom: "it works in dev" and then a production-only bug.** Cause: the dev server never bundles your first-party source at all, so tree-shaking, chunk boundaries, module-evaluation order across chunks and minification have simply not run yet. Unifying on Rolldown in Vite 8 makes the *transforms* more consistent; it does not make dev *bundled*. Fix: `vite build` before you believe a fix. This is the single highest-yield habit on this page and the reason `vite preview` exists.

## Interview questions

**★ Why is a Vite dev server's cold-start time roughly independent of how big the application is?**
Because a bundle-based dev server has to produce a bundle before it can serve anything, and an ESM-based one does not. The Vite docs draw the contrast directly: *"In a bundle-based dev server, the entire application is bundled before it can be served"* versus *"In an ESM-based dev server, modules are served on-demand as the browser requests them."* The browser's own module resolution walks the import graph and asks for exactly the files the current page needs; Vite transforms only those, only when asked. Code sitting in a route nobody has navigated to costs nothing at startup. The startup work that *is* proportional to something is dependency pre-bundling — and that is proportional to your `node_modules`, done once, and cached.

**★ A candidate says "Vite uses esbuild in development and Rollup for production." Is that right?**
It was, through Vite 7, and it is the answer most material still gives. On **Vite 8 it is wrong**: *"Vite 8 uses Rolldown and Oxc based tools instead of esbuild and Rollup."* The interesting follow-up is *why* the two-tool arrangement existed at all — esbuild was extremely fast but its production output and plugin ecosystem were not what Vite wanted to ship, and Rollup had the maturity but not the speed. Rolldown is the attempt to stop paying for that split: *"Rolldown was built to unify both into a single bundler."* A candidate who can narrate that trade-off understands the architecture; one who has merely memorised the new tool names does not.

**★ If Vite 8 runs the same bundler in dev and in build, why is there still a dev-versus-production behaviour gap?**
Because the gap was never mainly about which bundler. In development your source is **not bundled** — each module is its own HTTP-served ESM file, nothing is tree-shaken, nothing is minified, and module identity is one-file-one-module. In the build everything is bundled, dead code is eliminated by static ESM analysis, chunks are formed, and names are mangled. Unifying the toolchain removes one *class* of discrepancy (two transformers disagreeing about the same syntax) and leaves the structural one entirely intact. That is why "verify against an actual `vite build`" survives the Rolldown migration unchanged.

**★ Dependency pre-bundling is described as solving two problems. What are they, and why are they solved by the same step?**
The docs give them as *"CommonJS and UMD compatibility: During development, Vite serves all code as native ESM"* and *"Performance: Vite converts ESM dependencies with many internal modules into a single module."* The first is a correctness problem — the browser cannot `import` CommonJS, full stop. The second is a request-count problem — a dependency that internally splits into 400 tiny ESM files becomes 400 round trips on the dev server. One pass fixes both because the fix for each is the same operation: read the dependency's whole graph and emit one consolidated ESM file. That is bundling; Vite just confines it to `node_modules`, where the code changes about once a sprint, instead of your source, where it changes every keystroke.

**★ When would you reach for `optimizeDeps.include`, given that Vite discovers dependencies automatically?**
When the automatic scanner cannot see the import. The scanner works from your entry HTML and the static import graph, so a dependency reached only through a conditional import, a computed path, or a package whose export conditions the scanner resolves differently is discovered *late* — at which point Vite has to run a fresh pre-bundle and reload the page mid-session. Listing it in `include` moves the discovery to the initial cold-start pass, where it costs you nothing you were not already paying.

**Why does the removal of the object form of `manualChunks` matter more than a config rename?**
Because the object form encoded a *strategy* — "these package names go in this chunk" — and the function form and Rolldown's `codeSplitting` encode a *policy* evaluated per module. Teams that wrote `{ 'react-vendor': ['react', 'react-dom'] }` were expressing a caching intent, and porting that intent forward means restating it in terms of module IDs or of whatever `codeSplitting` actually exposes, not mechanically translating a literal. It is the one item in the v7→v8 migration on this page that is a design decision rather than a find-and-replace.

---

← [Vite overview](../../README.md) · Next → [CLI & Project Scaffolding](../02-cli-and-scaffolding/01-commands-and-templates.md)
