---
title: "A worker gets its own Rolldown build with its own plugin list and its own output format, and the default format is the one nobody expects"
sidebar_label: "01a · Worker build configuration"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the Vite documentation — [Worker Options](https://vite.dev/config/worker-options), [Migration from v7](https://vite.dev/guide/migration). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ Configuring the worker build: format, plugins, rolldownOptions

**A worker is not just a file Vite happens to notice — once detected, it becomes the entry point of a second, independent Rolldown build, with its own output format, its own plugin pipeline, and its own bundler options, none of which inherit from `build.*` or `plugins` in your top-level config by default.** That independence is deliberate — a worker's runtime environment (no DOM, no `window`, sometimes no module support at all) is different enough from the main thread's that treating it as "just another chunk of the same build" would be wrong. But it means every one of the three `worker.*` options exists because the obvious assumption — "it'll just follow the main config" — is false, and the surprises cluster around exactly the three settings this page covers.

## `worker.format` — and the default that surprises people

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  worker: {
    format: 'es', // explicit — the undocumented-feeling default is 'iife'
  },
});
```

Per the [Worker Options](https://vite.dev/config/worker-options) reference, `worker.format` is typed `'es' | 'iife'` with **default: `'iife'`**. That default is easy to miss because nothing about writing `import`/`export` inside a worker source file warns you that the *built* artifact might not be a module at all — the source-level syntax works identically under either format in dev, since dev serves workers as native ESM regardless (see [01](01-advanced-runtime-targets.md)). The difference only shows up in the production build, and it shows up as a working worker either way — `'iife'` self-executes and never needs `type: 'module'` on the `Worker` construction, so there's no error to notice. What you lose silently is the ability for the worker's *own* code to use dynamic `import()` cleanly and to benefit from code-splitting inside the worker bundle itself; an IIFE worker is one flat, non-splittable file.

```typescript
// image-filter.worker.ts — this source is identical either way; the DIFFERENCE
// is entirely in what worker.format produces from it.
import { convolve } from './kernels/convolve';
import { sobel } from './kernels/sobel';

self.onmessage = (event: MessageEvent<{ imageData: ImageData; kernel: 'convolve' | 'sobel' }>) => {
  const apply = event.data.kernel === 'sobel' ? sobel : convolve;
  const filtered = apply(event.data.imageData);
  self.postMessage({ result: filtered });
};
```

Set `format: 'es'` explicitly when you want the worker's build to stay split across chunks (useful if the worker itself dynamically `import()`s large, rarely-used kernels), and keep it on `'iife'` — or set it explicitly, so a reader doesn't have to know the default — when the worker must run in a context with no module-worker support at all.

## `worker.plugins` — why it is a function, never an array

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import glslify from 'vite-plugin-glslify';

export default defineConfig({
  plugins: [
    // this list applies to the MAIN app build and, in dev, is what the dev
    // server uses for everything including files a worker imports on request
  ],
  worker: {
    format: 'es',
    // 🔴 a FUNCTION returning plugins, not an array of plugin instances
    plugins: () => [glslify()],
  },
});
```

The reference gives `worker.plugins` the type `() => (Plugin | Plugin[])[]` and is explicit about why a function is required rather than an array:

> Plugin instances must be created fresh inside the function because the worker bundles run as **parallel Rolldown builds** — the docs' own wording is that they *"are used in parallel rolldown worker builds"* — and a plugin instance shared by reference with `config.plugins` would be mutated or hold state across builds that are running concurrently, not sequentially. A factory function guarantees each worker build gets its own instance.

The second half of the same rule is the one that actually causes reported bugs: **`config.plugins` applies only during development; for production builds, worker plugin configuration must happen here instead.** A plugin registered only in the top-level `plugins` array transforms the worker's source correctly in dev — because dev serves everything, workers included, through the same pipeline — and then silently stops running the moment you build, because the worker build is Rolldown running with `worker.plugins`, not with the top-level `plugins` list at all.

```typescript
// ❌ WRONG — works in `vite dev`, silently drops the transform in `vite build`
export default defineConfig({
  plugins: [glslify()], // only reaches the worker's source during dev
  worker: {
    format: 'es',
    // plugins left unset — the production worker build never sees glslify()
  },
});

// ✅ CORRECT — the worker build gets its own copy, independent of the main list
export default defineConfig({
  plugins: [glslify()], // still needed for the main app's own .glsl imports
  worker: {
    format: 'es',
    plugins: () => [glslify()], // duplicated deliberately — separate build, separate list
  },
});
```

## `worker.rolldownOptions` — and the Vite 8 rename

```typescript
// vite.config.ts
export default defineConfig({
  worker: {
    format: 'es',
    rolldownOptions: {
      // options Rolldown accepts for the worker's own bundle — output naming,
      // external dependencies specific to the worker, etc.
      output: {
        entryFileNames: 'workers/[name]-[hash].js',
      },
    },
  },
});
```

🔴 **`worker.rollupOptions` — the name this option had before Vite 8 — is now deprecated**, and the migration guide states it plainly:

> *"The following options are deprecated and will be removed in the future: `build.rollupOptions`: renamed to `build.rolldownOptions` / `worker.rollupOptions`: renamed to `worker.rolldownOptions`"* — [Migration from v7](https://vite.dev/guide/migration)

This is the same rename `build.rollupOptions → build.rolldownOptions` gets, applied to the worker-specific option too, and it exists for the same reason: Vite 8 replaced Rollup with Rolldown for every bundling step, including the worker build, so an option literally named `rollupOptions` was renamed to match. The old name is kept as a deprecated alias — it still works — but a config carrying `worker.rollupOptions` is reading as a Vite 7-era file, and the option types it accepts are Rollup's, not Rolldown's, which is where a subtle option-shape mismatch can surface on an upgrade even though nothing throws at config-load time.

## Its own module graph means its own build, which means duplication is possible

Because the worker is a **separate entry point** into a separate Rolldown build, any module imported by *both* the main app and the worker gets processed and emitted **twice** — once as part of the main chunk graph, once as part of the worker's. There is no cross-graph deduplication between the main build and a worker build; Rolldown's chunk-splitting only operates within one graph.

```typescript
// shared/format-bytes.ts — imported by BOTH the main thread and a worker
export function formatBytes(n: number): string {
  return `${(n / 1024).toFixed(1)} KB`;
}

// main.ts
import { formatBytes } from './shared/format-bytes';
// main.ts's build emits formatBytes() as part of the main chunk graph

// image-filter.worker.ts
import { formatBytes } from './shared/format-bytes';
// the worker's SEPARATE build emits formatBytes() AGAIN, inside the worker's own bundle
```

For a small utility like `formatBytes`, this duplication is noise. For a large shared dependency — a validation schema library, a date library, a chunk of business logic reused between a main-thread preview and a worker-side computation — it means the same code ships to the browser twice, once in the app's chunks and once inside the worker's chunk, with no shared cache between them even though both are served from the same origin. There is no config flag that fixes this; it's a structural consequence of the worker having its own module graph. The mitigation is architectural: keep what a worker imports from `shared/` deliberately small, or accept the duplication as the cost of the isolation.

## Asset URLs referenced from inside a worker

An asset import inside a worker's source (`import iconUrl from './icon.svg'`, or a `new URL('./data.bin', import.meta.url)` inside the worker file) resolves the same way it would in the main app — Vite's asset pipeline runs identically for a module regardless of which build graph it's being pulled into. The URL that comes out is resolved relative to the **final deployed location of the built asset**, not relative to the worker script's own path, which matters because a worker's built output commonly lands in a different subdirectory (`assets/` or a worker-specific folder, depending on `worker.rolldownOptions.output.entryFileNames`) than the main chunks. See topic 06's [asset imports](../06-asset-handling/01-static-asset-imports.md) for the base mechanism — nothing about it is worker-specific except that you're now resolving it from inside a build graph that has a different entry point.

## Gotchas

**★ Symptom: a plugin transform (a `.glsl` loader, an SVG-to-component transform) works in `vite dev` for files imported by a worker, then the production build fails to apply it and ships raw, untransformed source into the worker chunk.** Cause: the transform is registered only in the top-level `plugins` array. Dev routes every file, worker-imported or not, through the same pipeline, so it works there. The production worker build is a separate Rolldown invocation driven by `worker.plugins`, and the top-level list never reaches it. Fix: duplicate the plugin into `worker.plugins` as a factory function.
```typescript
worker: {
  plugins: () => [glslify()],
},
```

**★ Symptom: a worker built for a browser extension or an older embedded WebView runs with no error and no output — no `postMessage` ever seems to fire.** Cause: the worker's actual runtime doesn't support module workers, `worker.format` was left on its default (`'iife'`, not `'es'` — the common wrong assumption), so the build *should* have been safe... except the reverse mistake also happens: someone explicitly set `format: 'es'` believing that was already the default, shipped it, and the target runtime silently fails to execute a module-format worker with no console error surfaced back to the page. Fix: state the format explicitly rather than relying on either assumption about the default, and confirm the target actually supports `type: 'module'` workers before choosing `'es'`.
```typescript
worker: { format: 'iife' }, // explicit — safe for a runtime with no module-worker support
```

**★ Symptom: `worker.plugins: [somePlugin()]` throws a type error, or silently does nothing depending on the Vite minor version.** Cause: `worker.plugins` is typed as `() => (Plugin | Plugin[])[]` — a function — not `(Plugin | Plugin[])[]`, an array. Passing an array directly is the single most common mistake with this option because every *other* plugins list in a Vite config (`plugins`, most other `*.plugins`) is a plain array. Fix: wrap it.
```typescript
// ❌
worker: { plugins: [glslify()] },
// ✅
worker: { plugins: () => [glslify()] },
```

**★ Symptom: a shared validation or formatting module appears twice in the network panel — once in a main-thread chunk, once inside the worker's bundle — and the total transferred bytes are noticeably higher than expected.** Cause: the worker's build is a structurally separate Rolldown graph with no chunk-sharing against the main build; any module both graphs import gets bundled into both outputs independently. Fix: there is no config-level dedup. Either accept the duplication for small shared modules, or restructure so the worker imports only what it strictly needs rather than a shared barrel file that pulls in far more than the worker's own logic requires.

**★ Symptom: a config carries `worker.rollupOptions` and a newly-installed plugin's types don't fit the shape the option expects.** Cause: `worker.rollupOptions` is the pre-Vite-8 name, kept only as a deprecated alias; its type was Rollup's `RollupOptions`, and the option it aliases now, `worker.rolldownOptions`, is typed against Rolldown's option shape instead. The two are similar but not identical, and a plugin authored against Rolldown's interface may not match what the deprecated alias's types expect. Fix: rename to `worker.rolldownOptions` rather than working around the mismatch.

## Interview questions

**★ Why does a worker need its own `plugins` config instead of inheriting the main `plugins` array?**
Because the worker's production build is a genuinely separate Rolldown invocation, running in parallel with — not sequentially inside — the main build. The top-level `plugins` array is only consulted by the dev server (which serves every file, worker-imported or not, through one pipeline) and by the main build's own Rolldown invocation; it was never wired into the worker build's invocation. `worker.plugins` exists specifically to give that separate build its own list, and it has to be a factory function rather than a shared array because "parallel" is literal — if two builds shared one plugin instance by reference, one build's transform state could leak into or race against the other's.

**★ What does `worker.format: 'iife'` cost you, and why is it the default anyway?**
It costs you dynamic `import()` support and code-splitting inside the worker's own bundle — an IIFE is one flat script, so anything the worker itself would want to lazy-load has to be inlined into that one file instead of split into its own chunk. It's the default because it is the maximally compatible choice: an IIFE worker never depends on the browser supporting `type: 'module'` workers at all, which — per the [Features](https://vite.dev/guide/features) note on browser support for module workers — is a genuinely newer, less universal capability than module `<script>` tag support. Vite's dev server serves workers as native ESM regardless of `format`, so choosing `'iife'` costs nothing in dev; the cost only shows up in what the production artifact can do internally.

**★ You share a utility module between the main thread and a worker. Does it get bundled once or twice?**
Twice. The worker is the entry point of its own, independent Rolldown build — that is the entire meaning of "a worker gets its own module graph" — and Rolldown's code-splitting and chunk-sharing operate within one build's graph, never across two separate invocations. There is no config option that deduplicates a module shared between the main build and a worker build; the two outputs are produced independently and served independently, so the shared module's code physically exists twice in what ships to the browser. The only lever is architectural — minimize what the worker imports from shared code, rather than trying to configure the duplication away.

---

← [01 · Worker & WASM import surface](01-advanced-runtime-targets.md) · [Vite overview](../../README.md) · Next → [01b · Shared workers & messaging](01b-shared-workers-and-messaging.md)
