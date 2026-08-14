---
title: "Build System: Rollup Options, `manualChunks` & Library Mode"
sidebar_label: "Build System"
sidebar_position: 1
---

# ⚡ Build System: Rollup Options, `manualChunks` & Library Mode

## 1. Under-The-Hood Mechanics

`vite build` hands off to **Rollup** — a genuinely different bundler from the dev server's esbuild-based pipeline, chosen specifically for its mature tree-shaking and plugin ecosystem, well-suited for producing final, optimized production artifacts (as opposed to esbuild's dev-time priority: raw transform speed).

```
vite build
        │
        ▼
Rollup bundles the app's ESM module graph
        │
        ├── rollupOptions   ──► pass-through raw Rollup config (input, output, external)
        ├── manualChunks       ──► custom control over vendor/route-based chunk splitting
        ├── build.target         ──► esbuild transpile target applied WITHIN Rollup's pipeline
        └── build.lib               ──► LIBRARY mode — publishing a package, not an app
```

### `manualChunks`: Deliberate Chunk Splitting Strategy
Left to its own defaults, Rollup makes reasonable but generic chunking decisions — `manualChunks` (a function or object mapping) lets an engineer deliberately group specific modules into specific named chunks, most commonly isolating rarely-changing vendor dependencies (React, a UI library) into their own chunk so a code change to first-party app code doesn't invalidate the browser's long-term cache of that stable vendor chunk (the same underlying motivation as Webpack's `SplitChunksPlugin` cache groups, covered in the [Webpack code splitting doc](../../../webpack/pages/07-code-splitting/01-splitting-strategies.md)).

### `build.target`: esbuild's Role Inside the Rollup Pipeline
Even though Rollup does the actual bundling, Vite still uses esbuild internally **within** that pipeline for fast per-file transpilation (down to `build.target`'s specified JS compatibility level) — this is why esbuild and Rollup aren't mutually exclusive in the production build; each does a distinct part of the job.

### `build.lib`: A Fundamentally Different Output Shape
Library mode changes Vite's build output from "an app's final bundle" to "a publishable package" — `formats: ['es', 'cjs', 'umd']` produces multiple module-format variants of the same library source, analogous to the dual ESM/CJS package exports pattern covered in the JavaScript modules doc, but generated automatically by Vite's build tooling rather than hand-configured.

---

## 2. Real-World Engineering Scenario

**Scenario**: A React App Where Every Deploy Invalidated the Browser Cache for the Entire Vendor Bundle.
Without `manualChunks`, Rollup's default chunking occasionally grouped first-party app code and third-party vendor code (React, a UI library) into overlapping chunks — meaning a small app-code bug fix deploy busted the browser's cached copy of React itself for every returning visitor, forcing an unnecessary re-download of a large, rarely-actually-changing dependency. Explicitly configuring `manualChunks` to isolate `react`/`react-dom` into their own dedicated chunk meant only the genuinely-changed app-code chunk's cache was invalidated on subsequent deploys — vendor code stayed cached across releases where it hadn't actually changed.

---

## 3. Production-Grade Code Example

```typescript
// vite.config.ts — deliberate vendor chunk isolation for long-term browser caching
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020', // esbuild transpiles to this target WITHIN the Rollup pipeline
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'], // isolated — stays cache-valid across app-only deploys
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
    chunkSizeWarningLimit: 600, // in KB — tuned above default for a chunk deliberately grouping several UI primitives
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

### ⚠️ Pitfall 2: Over-Granular `manualChunks` Producing Many Small, Request-Heavy Chunks
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

### ⚠️ Pitfall 3: Forgetting UMD Format Requires `output.globals` for Every External
```typescript
// ❌ WRONG: UMD format needs to know what GLOBAL VARIABLE name each external dependency
// maps to when loaded via a plain <script> tag — omitting this produces a UMD bundle that
// throws "React is not defined" when actually used in a non-module <script> context
rollupOptions: { external: ['react'] }, // missing output.globals — UMD build is broken

// ✅ CORRECT: declare the global name mapping for every external, specifically for UMD
rollupOptions: { external: ['react'], output: { globals: { react: 'React' } } },
```
