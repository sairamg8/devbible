---
title: "Build System: `rolldownOptions`, Chunk Splitting & Library Mode"
sidebar_label: "Build System"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Vite documentation — [Build Options](https://vite.dev/config/build-options), [Migration from v7](https://vite.dev/guide/migration), [Why Vite](https://vite.dev/guide/why). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> ⚠️ The directory this page lives in is still named `05-build-system-rollup`. The name is a URL slug and was left alone; the content below is Vite 8, where the bundler is Rolldown.
> Validated: 2026-09-06 · claims + output provenance · session 4e8d4393

# ⚡ Build System: `rolldownOptions`, Chunk Splitting & Library Mode

## 1. Under-The-Hood Mechanics

🔴 **On Vite 8, `vite build` hands off to Rolldown, not Rollup.** The migration guide states it without qualification:

> *"Vite 8 uses Rolldown and Oxc based tools instead of esbuild and Rollup."* — [Migration from v7](https://vite.dev/guide/migration)

The reason the two-bundler arrangement existed at all is worth keeping, because it explains what the unification was for:

> *"Vite originally relied on two separate tools under the hood: esbuild for fast compilation during development, and Rollup for thorough optimization in production builds."* … *"Rolldown was built to unify both into a single bundler"* — [Why Vite](https://vite.dev/guide/why)

```text
vite build
        │
        ▼
Rolldown bundles the app's ESM module graph
        │
        ├── rolldownOptions  ──► pass-through raw bundler config (input, output, external)
        │                        (`rollupOptions` still works — it is an alias)
        ├── chunk splitting     ──► control over vendor/route-based chunk grouping
        │                           🔴 the OBJECT form of manualChunks is REMOVED on v8
        ├── build.target          ──► transpile target, default 'baseline-widely-available'
        └── build.lib                ──► LIBRARY mode — publishing a package, not an app
```

⚠️ **If you are reading this against a Vite 7 codebase, put `esbuild` and `Rollup` back into that diagram** and everything else on this page still applies. The option names below are the v8 ones.

### Chunk Splitting: Deliberate Grouping for Long-Term Caching
Left to its own defaults, the bundler makes reasonable but generic chunking decisions. Deliberate grouping lets an engineer put specific modules into specific named chunks, most commonly isolating rarely-changing vendor dependencies (React, a UI library) into their own chunk so a code change to first-party app code doesn't invalidate the browser's long-term cache of that stable vendor chunk (the same underlying motivation as Webpack's `SplitChunksPlugin` cache groups, covered in the [Webpack code splitting doc](../../../webpack/pages/07-code-splitting/01-splitting-strategies.md)).

🔴 **The API for expressing that moved in Vite 8, and the old form does not degrade gracefully:**

> *"The object form `output.manualChunks` option is not supported anymore. The function form `output.manualChunks` is deprecated."* — [Migration from v7](https://vite.dev/guide/migration)

> *"Rolldown has the more flexible [`codeSplitting`](https://rolldown.rs/reference/OutputOptions.codeSplitting) option."* — [Migration from v7](https://vite.dev/guide/migration)

So there are three states to keep straight:

| Form | Status on Vite 8 | Use it? |
|---|---|---|
| `output.manualChunks: { 'react-vendor': ['react'] }` | **not supported anymore** | ⛔ no — port it |
| `output.manualChunks: (id) => …` | **deprecated** | ⚠️ works today, as a migration stopgap |
| Rolldown's `codeSplitting` | the named replacement | ✅ the destination |

⚠️ **No `codeSplitting` example is given on this page.** The migration guide names the option and links Rolldown's reference for it; I did not read that reference in this pass, so writing an example here would mean inventing an option shape from its name. Follow the link. The function form below is shown instead because it is the form the Vite docs still describe as present.

### `build.target`: Per-File Transpilation Inside the Bundle Pipeline
Bundling and transpiling are separate jobs, and Vite has always run a fast per-file transpiler inside the bundle pipeline to bring syntax down to `build.target`'s JS compatibility level. Through Vite 7 that transpiler was esbuild; on Vite 8 it is Oxc.

The default is **not** a fixed ES year:

> `build.target` default: `'baseline-widely-available'` — the build reference resolves it to `['chrome111', 'edge111', 'firefox114', 'safari16.4', 'ios16.4']`

🔴 **That resolution moved in Vite 8**, which means a v7→v8 upgrade can silently raise your browser floor with no config change on your side:

> *"The default browser values of `build.target` and `'baseline-widely-available'` are updated to newer browser versions: Chrome 107 → 111, Edge 107 → 111, Firefox 104 → 114, Safari 16.0 → 16.4"* — [Migration from v7](https://vite.dev/guide/migration)

### `build.lib`: A Fundamentally Different Output Shape
Library mode changes Vite's build output from "an app's final bundle" to "a publishable package" — `formats: ['es', 'cjs', 'umd']` produces multiple module-format variants of the same library source. The build reference gives the default as `['es', 'umd']`, or `['es', 'cjs']` when multiple entries are used, and requires `name` *"when `formats` includes `'umd'` or `'iife'`"*, analogous to the dual ESM/CJS package exports pattern covered in the JavaScript modules doc, but generated automatically by Vite's build tooling rather than hand-configured.

---

## 2. Real-World Engineering Scenario

**Scenario**: A React App Where Every Deploy Invalidated the Browser Cache for the Entire Vendor Bundle.
Without deliberate chunk grouping, the bundler's default chunking occasionally grouped first-party app code and third-party vendor code (React, a UI library) into overlapping chunks — meaning a small app-code bug fix deploy busted the browser's cached copy of React itself for every returning visitor, forcing an unnecessary re-download of a large, rarely-actually-changing dependency. Explicitly grouping `react`/`react-dom` into their own dedicated chunk meant only the genuinely-changed app-code chunk's cache was invalidated on subsequent deploys — vendor code stayed cached across releases where it hadn't actually changed.

---

## 3. Production-Grade Code Example

```typescript
// vite.config.ts (Vite 8) — deliberate vendor chunk isolation for long-term browser caching
import { defineConfig } from 'vite';

// ⛔ WHAT THIS USED TO SAY, AND NO LONGER WORKS ON VITE 8:
//    rollupOptions: { output: { manualChunks: {
//      'react-vendor': ['react', 'react-dom'],
//    } } }
//    "The object form output.manualChunks option is not supported anymore."

const VENDOR_CHUNKS: Record<string, string[]> = {
  'react-vendor': ['/node_modules/react/', '/node_modules/react-dom/'],
  'ui-vendor': ['/node_modules/@radix-ui/'],
};

export default defineConfig({
  build: {
    // Explicit target, so a default that moves between majors cannot move your browser floor
    target: 'es2020',
    rolldownOptions: {
      output: {
        // ⚠️ The FUNCTION form is deprecated on Vite 8 but still shipped. This is the
        // migration stopgap, not the destination — the destination is Rolldown's
        // `codeSplitting` option: https://rolldown.rs/reference/OutputOptions.codeSplitting
        manualChunks(id) {
          for (const [chunk, prefixes] of Object.entries(VENDOR_CHUNKS)) {
            if (prefixes.some((p) => id.includes(p))) return chunk;
          }
          // Everything else: return nothing and let the bundler decide.
        },
      },
    },
    // Default is 500. Compared against the UNCOMPRESSED chunk size, so this is a proxy
    // for parse/execute cost, not for bytes on the wire.
    chunkSizeWarningLimit: 600,
  },
});
```

```typescript
// vite.config.ts — library mode, publishing a package rather than building an app
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'AcmeUI',
      formats: ['es', 'cjs', 'umd'], // multiple consumable formats from ONE build
      fileName: (format) => `acme-ui.${format}.js`,
    },
    rollupOptions: {
      external: ['react', 'react-dom'], // peer deps — NOT bundled into the library output
      output: { globals: { react: 'React', 'react-dom': 'ReactDOM' } }, // required for the UMD format specifically
    },
  },
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting `external` in Library Mode
```typescript
// ❌ WRONG: without marking peer dependencies external, the library build BUNDLES React
// directly into the output — a consuming app with its OWN React copy now has TWO instances,
// breaking hooks/context exactly like the equivalent Webpack Module Federation pitfall
export default defineConfig({ build: { lib: { entry: 'src/index.ts', formats: ['es'] } } }); // no external!

// ✅ CORRECT: mark peer dependencies external so consumers supply their own copy
export default defineConfig({
  build: { lib: { /* ... */ }, rollupOptions: { external: ['react', 'react-dom'] } },
});
```

### ⚠️ Pitfall 2: Over-Granular Chunking Producing Many Small, Request-Heavy Chunks
```typescript
// ❌ SUBOPTIMAL: splitting every single dependency into its OWN chunk multiplies HTTP
// requests — on higher-latency connections, request overhead can outweigh caching benefits
manualChunks: (id) => {
  if (id.includes('node_modules')) {
    return id.toString().split('node_modules/')[1].split('/')[0]; // one chunk PER dependency, often too granular
  }
},

// ✅ CORRECT: group related, similarly-changing dependencies into a FEW deliberate chunks,
// as shown in the production example (react-vendor, ui-vendor), not one chunk per package
```
⚠️ **Both snippets use the function form, which Vite 8 lists as deprecated.** The shape of the
mistake is what matters and it survives the API change intact: the useful unit of a chunk is
"things that change together", and `node_modules` is not that unit — it is a directory.

### ⚠️ Pitfall 3: Forgetting UMD Format Requires `output.globals` for Every External
```typescript
// ❌ WRONG: UMD format needs to know what GLOBAL VARIABLE name each external dependency
// maps to when loaded via a plain <script> tag — omitting this produces a UMD bundle that
// throws "React is not defined" when actually used in a non-module <script> context
rollupOptions: { external: ['react'] }, // missing output.globals — UMD build is broken

// ✅ CORRECT: declare the global name mapping for every external, specifically for UMD
rollupOptions: { external: ['react'], output: { globals: { react: 'React' } } },
```

---

## Gotchas

**★ Symptom: after upgrading to Vite 8, your vendor chunks vanish and everything lands in one bundle.** Cause: *"The object form `output.manualChunks` option is not supported anymore."* Fix: port to the function form as a stopgap, then to Rolldown's `codeSplitting`. ⚠️ **The migration guide does not state whether Vite errors on the object form or ignores it silently**, so do not rely on a build failure to tell you — diff your `dist/` file list across the upgrade instead.

**★ Symptom: you port to the function form and a deprecation warning appears.** Cause: *"The function form `output.manualChunks` is deprecated."* Fix: it works, so ship it, but book the real move. The replacement the guide names is *"Rolldown has the more flexible [`codeSplitting`](https://rolldown.rs/reference/OutputOptions.codeSplitting) option."* — and porting is a design exercise, not a rename, because the object form encoded "these package names go in this chunk" while the newer forms evaluate a policy per module.

**★ Symptom: a config reference or a type tells you `build.rollupOptions` is not the option to use.** Cause: the rename. The migration guide lists ``build.rollupOptions``: *"renamed to `build.rolldownOptions`"*, and the build reference describes the old name as *"an alias of `build.rolldownOptions` option. Use `build.rolldownOptions` option instead."* Fix: rename it. Nothing breaks if you do not, which is exactly why this one rots in codebases for majors at a time.

**★ Symptom: the app breaks on an older browser after a Vite 8 upgrade you made no config change for.** Cause: `build.target` defaults to `'baseline-widely-available'`, and what that resolves to moved — Chrome 107 → 111, Edge 107 → 111, Firefox 104 → 114, Safari 16.0 → 16.4. Fix: if you have a real browser-support commitment, **set `build.target` to explicit versions**. A named default that tracks a moving external definition is convenient right up until it moves under a codebase that promised otherwise.

**★ Symptom: you tune `chunkSizeWarningLimit` and nothing about load time changes.** Cause: it is a warning threshold, not a splitting policy — nothing about your output changes when you raise it. The build reference is also specific that the comparison is against the **uncompressed** chunk size, because JS size correlates with parse and execute time rather than with transfer time. Fix: raise it to silence a warning you have consciously decided to accept; do not treat crossing it as a performance metric, and never treat the gzip size as the number being compared.

**★ Symptom: library mode emits a UMD bundle you never asked for, or errors asking for `name`.** Cause: the defaults. `build.lib.formats` defaults to `['es', 'umd']`, or to `['es', 'cjs']` when multiple entries are used, and `name` *"is required when `formats` includes `'umd'` or `'iife'`"*. Fix: if you do not need a script-tag build, set `formats: ['es']` explicitly and the `name` requirement disappears with it. Most libraries published today do not need UMD and ship it only because it was the default.

**★ Symptom: consumers of your library report "Invalid hook call" or two React contexts.** Cause: `external` was omitted in library mode, so React was bundled *into* the library, and the consuming app now has two React instances. Fix: mark every peer dependency external. This is the single most common library-mode defect, it is invisible in your own repo (where there is only one React), and it only reproduces in a consumer.

**★ Symptom: the UMD build throws "React is not defined" when loaded via a script tag.** Cause: `external` told the bundler not to include React, but UMD needs to know the **global variable name** to look it up under at runtime, and that mapping is `output.globals`. Fix: declare one entry per external. The ESM and CJS outputs are unaffected because they resolve externals through the module system, which is why this fails only in the one format nobody tests.

**★ Symptom: `__dirname is not defined` when the config runs.** Cause: `__dirname` is a CommonJS-only binding. A config file that Node resolves as ESM — because the file is `.mts`, or because `package.json` says `"type": "module"` — does not have it. Fix: derive it from `import.meta.url`, or use a path that does not need it. The `resolve(__dirname, 'src/index.ts')` idiom in the library example above is the CommonJS-flavoured one and is exactly where this bites.

**★ Symptom: your SSR bundle is enormous and unminified.** Cause: it is supposed to be. `build.minify` defaults to `'oxc'` for the client build and **`false` for the SSR build**. Fix: nothing, usually — minifying server code buys no transfer saving and costs you readable stack traces. Set it only if you have a deployment target that charges by bundle size.

**★ Symptom: Terser options in the config have no effect.** Cause: `build.minify` defaults to `'oxc'` on Vite 8; Terser-shaped options are only read when Terser is the selected minifier. Fix: check what `build.minify` actually resolves to before debugging its options.

## Interview questions

**★ Vite used to run two different bundlers. Why, and what did unifying them buy?**
The two jobs have genuinely different priorities. Development wants the lowest possible latency per file and does not care about output quality, because nothing is shipped. The production build wants exhaustive tree-shaking, careful chunking and a mature plugin surface, and can afford to be slow. Vite's answer was to use the best available tool for each: *"esbuild for fast compilation during development, and Rollup for thorough optimization in production builds."* The cost of that answer is a permanent behaviour seam — two parsers, two transform pipelines, two sets of edge cases, and a class of bug that only appears when the two disagree about the same source. *"Rolldown was built to unify both into a single bundler"*, and Vite 8 completes the swap. What you buy is the removal of that seam; what you do not buy is dev/prod parity, because the remaining difference is that dev does not bundle at all.

**★ What is `manualChunks` actually for, and what assumption did its object form bake in?**
It is a browser-caching tool, not a performance tool in itself. Chunk boundaries are cache boundaries: everything in a chunk is invalidated together, so putting rarely-changing vendor code in the same chunk as daily-changing app code means every deploy makes every returning visitor re-download React. The object form — `{ 'react-vendor': ['react', 'react-dom'] }` — assumed that "which chunk does this belong to" could be answered from a static list of package names decided at config time. The function and `codeSplitting` forms answer it per module, from the module's own id. That is more expressive and it is also why the migration is not mechanical: a package-name list does not carry the intent that produced it.

**★ Why must a library mark its peer dependencies `external` when an application must not?**
Because an application is the last consumer — nothing will be layered on top of it, so bundling React in is the correct and only option. A library is consumed by something that has its own copy of the same dependency, and shipping a second copy is not merely wasteful: React specifically breaks, because hooks and context are keyed to a module instance, so two instances means hooks called against one and read by the other. The tell that a candidate has actually shipped a library is that they mention this fails only in the consumer's repo, never in the library's own tests.

**★ Why does the UMD format need `output.globals` when ESM and CJS do not?**
Because UMD's fallback path has no module system. Loaded through a plain script tag, there is no `import` and no `require` to resolve `react` with — the only place to look is a global. `output.globals` is the map from module specifier to that global's name, so `{ react: 'React' }` tells the bundle to reach for `window.React`. ESM and CJS never need it because both have a real resolver. This is also why the bug ships: the format that needs the extra configuration is the one nobody exercises in CI.

**★ Is a more granular chunk graph always better for caching?**
No, and the trade-off is legible. Finer chunks mean a smaller invalidated set per deploy, which is the win. They also mean more requests, more request overhead, and — because chunks that import each other must be fetched in dependency order — deeper request waterfalls, which is the loss. On a high-latency connection the loss dominates quickly. The right granularity follows change frequency, not directory structure: group modules that change together, which is why "one chunk per `node_modules` package" is the classic over-correction. It looks principled and is really just mirroring a folder layout.

**What does `chunkSizeWarningLimit` measure, and why is the default 500?**
It compares the **uncompressed** size of an emitted chunk, in kB, against the limit, and warns above it. The reason it is uncompressed is stated in the build reference's own reasoning: JS size relates to *execution* time, and gzip does not make a script faster to parse and run — it only makes it faster to arrive. So the warning is about main-thread cost, not bandwidth, and 500 kB is a heuristic about how much JavaScript a page can afford to evaluate rather than how much it can afford to download. Raising the limit changes nothing except whether you are told.

---

← [Dev Server Mechanics](../04-dev-server-mechanics/01-native-esm-and-hmr.md) · [Vite overview](../../README.md) · Next → [Asset Handling](../06-asset-handling/01-static-asset-imports.md)
