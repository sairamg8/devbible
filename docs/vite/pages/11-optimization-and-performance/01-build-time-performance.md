---
title: "Vite performance is three separate clocks — cold dev start, in-session page loads, and vite build — and nearly every knob you can turn moves exactly one of them"
sidebar_label: "01 · Build-time performance"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Performance](https://vite.dev/guide/performance), [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling), [Build Options](https://vite.dev/config/build-options), [Features](https://vite.dev/guide/features), [Migration from v7](https://vite.dev/guide/migration). Documentation-validated; **no sandbox run, no timings, no benchmarks**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Build-Time Performance: The Three Clocks

**"Vite is slow" is never a single complaint, and the option that fixes one version of it usually does nothing for the other two.** Cold dev server start is dominated by dependency pre-bundling and by plugin startup hooks. In-session page loads are dominated by per-file transform cost and request waterfalls. `vite build` is dominated by the bundler, the minifier, sourcemap generation, and — in almost every real CI pipeline — by `tsc`, which Vite does not run at all. Vite 8 replaced esbuild and Rollup with Oxc and Rolldown, which moves the second and third clocks and leaves the largest number in most CI profiles completely untouched. This page is the map; the chunks that follow are the mechanisms.

## 1. Under-The-Hood Mechanics

### The three clocks, and what runs on each

```text
CLOCK 1 — cold dev start (`vite`, first run, no cache)
        │
        ├── config load (Rolldown bundles vite.config.ts to a temp file)
        ├── plugin `config` / `configResolved` / `buildStart` hooks   ← awaited, serial-ish
        └── dependency pre-bundling                                   ← Rolldown on v8
                └── writes node_modules/.vite

CLOCK 2 — in-session page load / reload (dev server already up)
        │
        ├── per-file transform, ON DEMAND, only for what the browser asks for
        ├── plugin `resolveId` / `load` / `transform` per file
        ├── resolve.extensions filesystem probing
        └── request waterfalls (barrel files, deep import chains)

CLOCK 3 — `vite build`
        │
        ├── Rolldown bundle + tree-shake + chunking
        ├── Oxc transform to build.target, Oxc minify
        ├── sourcemap generation                 (build.sourcemap, default false)
        ├── gzip size reporting                  (build.reportCompressedSize, default TRUE)
        └── ⛔ NOT tsc. NOT eslint. Those are separate processes you also pay for.
```

🔴 **Pre-bundling is on clock 1 and clock 2 only.** The docs are unambiguous:

> *"Dependency pre-bundling only applies in development mode."* — [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling)

and the option reference repeats it for the whole `optimizeDeps` namespace:

> *"Unless noted, the options in this section are only applied to the dependency optimizer, which is only used in dev."* — [Dep Optimization Options](https://vite.dev/config/dep-optimization-options)

That single fact retires a large class of misdirected tuning: `optimizeDeps.include` cannot make your production build faster or smaller, because it does not participate in the production build. Conversely, `build.reportCompressedSize` cannot make your dev server start faster.

### What Vite 8 actually changed

> *"Vite 8 uses [Rolldown](https://rolldown.rs/) and [Oxc](https://oxc.rs/) based tools instead of [esbuild](https://esbuild.github.io/) and [Rollup](https://rollupjs.org/)."* — [Migration from v7](https://vite.dev/guide/migration)

Three consequences land inside this topic:

| Area | Vite 7 | Vite 8 |
|---|---|---|
| Dependency pre-bundling | esbuild | **Rolldown** — *"Rolldown is now used for dependency optimization instead of esbuild."* |
| Production bundling | Rollup | **Rolldown**, and `build.rollupOptions` is renamed to `build.rolldownOptions` (old name kept as an alias) |
| Chunk grouping | `output.manualChunks` object or function | object form **removed**, function form **deprecated**, replaced by Rolldown's `codeSplitting` |

The package manifest is the hardest evidence here, not the prose: `vite@8.2.2` declares `rolldown ~1.2.4` as a runtime dependency and does **not** depend on `rollup` at all; `esbuild` survives only as an *optional peer*, which the migration guide states directly — *"`esbuild` is no longer directly used by Vite and is now an optional dependency."*

### What did not change

Vite's dev server has never bundled your source. That is the design, not an optimisation, and it is why clock 2 behaves nothing like a webpack rebuild:

> *"The Vite dev server only transforms files as requested by the browser, which allows it to start up quickly and only apply transformations for used files."* — [Performance](https://vite.dev/guide/performance)

The cost that follows from on-demand transformation is the waterfall: the server cannot know that `a.js` imports `b.js` until it has transformed `a.js`. Swapping the bundler does not remove a waterfall, because a waterfall is a property of the import graph.

### The map of this topic

| Chunk | What it settles |
|---|---|
| [01a · Dependency pre-bundling](01a-dependency-pre-bundling.md) | why the step exists at all, and what triggers a re-bundle mid-session |
| [01b · The pre-bundle cache](01b-the-pre-bundle-cache.md) | 🔴 `node_modules/.vite`, the exact four invalidation inputs, and the browser's hard cache |
| [01c · `optimizeDeps.include` / `exclude`](01c-optimizedeps-include-and-exclude.md) | the documented decision rule, linked packages, nested CJS |
| [01d · Chunk splitting after `manualChunks`](01d-chunk-splitting-after-manualchunks.md) | 🔴 what v8 removed and the `codeSplitting` replacement, from the Rolldown reference |
| [01e · Tuning `codeSplitting` groups](01e-tuning-codesplitting-groups.md) | `priority`, `test`, size floors, `entriesAware`, the forced `runtime.js` chunk |
| [01f · Chunk-size warnings and size reporting](01f-chunk-size-warnings-and-size-reporting.md) | ⚠️ the limit is **uncompressed**; what `reportCompressedSize` costs |
| [01g · Preloading and cache granularity](01g-preloading-and-cache-granularity.md) | `modulePreload`, async chunk preload, `chunkImportMap` |
| [01h · Sourcemaps, target and minifiers](01h-sourcemaps-target-and-minifiers.md) | the three build-time costs you can actually turn off |
| **01i · Type-checking is not the bundler's job** *(not written yet)* | 🔴 why `tsc` dominates CI and Vite will never fix it |
| **01j · The dev-server costs Vite cannot remove** *(not written yet)* | plugins, resolve probing, barrel files, warmup, profiling |

---

## 2. Real-World Engineering Scenario

**Scenario**: a team upgrades a large React app from Vite 7 to Vite 8 specifically to make CI faster, and the pipeline barely moves.

The upgrade is real — the bundler and the minifier both changed engine. But the CI job was `tsc --noEmit && eslint . && vite build`, and the `vite build` step was never the majority of it. Type-checking a large TypeScript project requires the whole module graph and cannot be made incremental by changing a bundler that never type-checked in the first place. The team's own profile, once they took one, showed the bundle step shrinking and the total wall time dominated by the two static-analysis steps that Vite explicitly recommends you run *separately*:

> *"we recommend separating static analysis checks from Vite's transform pipeline. This principle applies to other static analysis checks such as ESLint."* — [Features → TypeScript](https://vite.dev/guide/features)

The fix was not a Vite option. It was `tsc --build` with project references and incremental output, ESLint's cache, and running the three steps concurrently instead of serially. Full treatment in **01i** *(not written yet)*.

---

## 3. Production-Grade Code Example

```typescript
// vite.config.ts (Vite 8) — annotated by WHICH CLOCK each option moves.
import { defineConfig } from 'vite';

export default defineConfig({
  // ── CLOCK 1 + 2 only. Dev-only namespace; has no effect on `vite build`. ──
  optimizeDeps: {
    // Force a linked workspace package through pre-bundling because it ships CJS.
    include: ['@acme/legacy-charts'],
    // Small, already-valid ESM: let the browser fetch it directly, no pre-bundle.
    exclude: ['@acme/design-tokens'],
  },

  // ── CLOCK 2 only. Pre-transforms files the browser is about to ask for. ──
  server: {
    warmup: {
      clientFiles: ['./src/app/AppShell.tsx', './src/lib/format.ts'],
    },
  },

  // ── CLOCK 3 only. None of these touch the dev server. ──
  build: {
    // Explicit, so a moving default cannot silently raise your browser floor.
    target: ['chrome111', 'edge111', 'firefox114', 'safari16.4', 'ios16.4'],

    // Default is `true`. Gzipping every output file is real build time you can
    // decline when nobody reads the number.
    reportCompressedSize: false,

    // Default is `false`. Turning it on is a deliberate purchase, not free.
    sourcemap: 'hidden',

    // v8 name. `rollupOptions` still resolves as a deprecated alias.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'vendor', test: /node_modules/, minSize: 20000 }],
        },
      },
    },
  },
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: tuning `optimizeDeps` to make the production build smaller

`optimizeDeps` is a dev-only namespace. The reference says so at the top of the page, and the deprecated `optimizeDeps.disabled` entry records when the build-time variant was withdrawn:

> *"As of Vite 5.1, pre-bundling of dependencies during build have been removed."* — [Dep Optimization Options](https://vite.dev/config/dep-optimization-options)

If your production chunks are wrong, the options that matter are under `build`, not `optimizeDeps`.

### ⚠️ Pitfall 2: treating `vite build` wall time as "the build"

```bash
# ❌ What is actually being measured when someone says "the build got faster"
vite build

# ✅ What CI actually runs, and where the time usually is
tsc --noEmit && eslint . --cache && vite build
```

Changing the bundler moves the third term. Nothing about a Vite major changes the first two.

### ⚠️ Pitfall 3: benchmarking a cold start against a warm cache

The first `vite` run after a lockfile change pre-bundles; the next one reads `node_modules/.vite` and does not. Comparing those two runs measures the cache, not the change you made. [01b](01b-the-pre-bundle-cache.md) lists the exact four inputs that decide which of the two you are about to get.

---

## Gotchas

**★ Symptom: an `optimizeDeps` change makes no difference to the production bundle.** Cause: the entire namespace is dev-only — *"the options in this section are only applied to the dependency optimizer, which is only used in dev."* Fix: move the intent to the right namespace. To keep a package out of the *bundle*, use `build.rolldownOptions.external`; to control which chunk it lands in, use `codeSplitting` groups, covered in [01d](01d-chunk-splitting-after-manualchunks.md).

**★ Symptom: after the Vite 8 upgrade a lint or type says `build.rollupOptions` is deprecated, but everything still works.** Cause: it is now an alias — *"This option is an alias of `build.rolldownOptions` option. Use `build.rolldownOptions` option instead."* Fix: rename it. Behaviour is unchanged, which is exactly why this rots in configs for entire majors.

**★ Symptom: CI time did not drop after upgrading to Vite 8.** Cause: `vite build` was not the dominant term. Vite *"does **NOT** perform type checking"*, so a pipeline whose largest step is `tsc` is unaffected by a bundler swap. Fix: profile the pipeline step by step before attributing a number to a tool. **01i** *(not written yet)* covers what to do with the result.

**★ Symptom: `vite build` output is enormous and unminified — but only for the SSR build.** Cause: `build.minify` defaults to *"`'oxc'` for client build, `false` for SSR build."* Fix: usually nothing. Minifying server code buys no transfer saving and costs readable stack traces. See [01h](01h-sourcemaps-target-and-minifiers.md).

**★ Symptom: a config that worked on Vite 7 now errors on `build.rollupOptions.watch.chokidar`.** Cause: *"The `build.rollupOptions.watch.chokidar` option was removed."* Fix: *"Please migrate to the [`build.rolldownOptions.watch.watcher`](https://rolldown.rs/reference/InputOptions.watch#watcher) option."* This is one of the few v8 renames that is a hard removal rather than an alias.

## Interview questions

**★ Someone says "our Vite build is slow." What do you ask first?**
Which of the three clocks. Cold dev start, in-session reloads, and `vite build` have almost disjoint cost structures, and the tuning surfaces do not overlap: `optimizeDeps.*` and plugin startup hooks own the first, per-file transform and request waterfalls own the second, and the bundler, minifier, sourcemap and size-reporting steps own the third. A person who answers "add `manualChunks`" to a cold-start complaint has confused a clock-3 option with a clock-1 problem — and on Vite 8 they have also named an option whose object form no longer exists.

**★ Why does `optimizeDeps` not apply to production builds?**
Because the problem it solves does not exist there. Pre-bundling exists so the dev server can serve `node_modules` as native ESM over HTTP without CommonJS breaking the browser and without a 600-request fan-out for a package that ships many small files. A production build bundles everything anyway, so both problems are already solved by the bundler that is running. Vite briefly shipped an experimental build-time optimizer and withdrew it — *"As of Vite 5.1, pre-bundling of dependencies during build have been removed."*

**★ Vite 8 replaced two tools with two other tools. Which of your performance problems does that plausibly fix, and which does it definitely not?**
It plausibly moves bundling, transpiling and minifying — Rolldown replaces Rollup for the build and esbuild for dependency optimization, and Oxc replaces esbuild for transform and minify. It definitely does not move type-checking, linting, your own plugins' `transform` cost, your import graph's waterfall depth, or the number of filesystem probes an extensionless import costs. A useful way to phrase this in an interview: a faster engine changes the constant factor of the work Vite does, and changes nothing about work Vite never did.

**★ Why is comparing "before" and "after" build numbers on your laptop nearly always wrong?**
Because the two runs almost never share a cache state. The pre-bundle cache in `node_modules/.vite` is keyed on lockfile content, patch directory mtime, relevant `vite.config` fields and `NODE_ENV` — so a config edit made *as part of the experiment* invalidates it and the "after" run pays a cold pre-bundle the "before" run did not. The disciplined version is to fix the cache state explicitly (`--force` on both runs, or a warm cache on both) and to say which you did.

---

← [SSR Support](../10-ssr-support/01-server-side-rendering-primitives.md) · [Vite overview](../../README.md) · Next → [01a · Dependency pre-bundling](01a-dependency-pre-bundling.md)
