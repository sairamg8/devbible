---
title: "Link map · Vite · Part 3 (sections 09–13)"
sidebar_label: "03 · css ssr optimisation"
sidebar_position: 3
---

# Link map · Vite · Part 3 (sections 09–13)

Covers sections 09 (CSS handling), 10 (SSR support), 11 (optimisation and performance), 12 (path resolution and aliases) and 13 (worker and WASM support) of `docs/vite/pages/`. Each section is one numbered topic page split into chunks (10, 11, 10, 15 and 5 chunks), so each is written as several blocks that each cover a coherent cluster of chunks; the path shown is the first chunk of the cluster. All 17 blocks have written pages of ours.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. No `#anchors` are given except ones seen as heading ids on the fetched page. Where no good non-official explanation turned up after searching, the block has no "Beyond the docs" line.

🔴 **Version note.** Our pages in this part were verified 2026-09-07 and 2026-09-08 against **Vite 8.2.2**. The official links point at vite.dev, which served **v8.3.4** on 2026-10-14, and at rolldown.rs. Official pages are the current ones, so option names and defaults match Vite 8 (Rolldown, Oxc, Lightning CSS minification). Anything labelled v2 to v7 in search results was skipped on purpose.

---

## Section 09 — CSS handling

### T09-01a · The CSS pipeline: `@import`, PostCSS and preprocessors — Topic · ✅ written `docs/vite/pages/09-css-handling/01-styling-pipeline.md`
- **Read this:** [Features › CSS](https://vite.dev/guide/features) · vite.dev · the CSS section: `@import` inlining and `url()` rebasing, PostCSS discovery via postcss-load-config, and the Sass, Less and Stylus support that needs the package installed yourself (*read*) · covers our angle: **partial** — states each feature, but does not lay the stages out as one ordered chain or say which stage owns a rule · fetched 2026-10-14
- **Also good:** [Shared Options › `css.postcss`, `css.preprocessorOptions`](https://vite.dev/config/shared-options) · vite.dev · the option reference: `css.postcss`, `css.preprocessorOptions`, its `additionalData` subheading, and `css.preprocessorMaxWorkers` (*read*) · fetched 2026-10-14
- **Our delta:** the fixed stage order, the silent global effect of a workspace PostCSS config, `sass-embedded` versus `sass` fallback, and the Stylus rebasing caveat.

### T09-01b · CSS Modules: the filename rule and the edge cases — Topic · ✅ written `docs/vite/pages/09-css-handling/01d-css-modules.md`
- **Read this:** [Features › CSS Modules](https://vite.dev/guide/features) · vite.dev · any `.module.css` file returns an object of class names, tuned by `css.modules`; named imports need `localsConvention` set to a camelCase mode (*read*) · covers our angle: **partial** — the basic rule only; nothing on `?inline`, `?url`, SSR or HMR behaviour · fetched 2026-10-14
- **Also good:** [Shared Options › `css.modules`](https://vite.dev/config/shared-options) · vite.dev · the option reference (`css.modules` heading confirmed; option details not read) (*headings only*) · fetched 2026-10-14
- **Our delta:** why a CSS module is a JS module of strings, and everything that follows from it (HMR, `?inline`, `?url` throwing, SSR).

### T09-01c · Lightning CSS, `?inline`/`?raw`/`?url`, code splitting and minification targets — Topic · ✅ written `docs/vite/pages/09-css-handling/01e-lightning-css.md`
- **Read this:** [Getting Started (Vite section)](https://lightningcss.dev/docs.html) · lightningcss.dev · the three config places: `css.transformer: 'lightningcss'`, `css.lightningcss.targets` via `browserslistToTargets()`, and `build.cssMinify: 'lightningcss'` (*read*) · covers our angle: **partial** — the swap config only; says nothing about Vite 8 already minifying with it by default · fetched 2026-10-14
- **Also good:** [Build Options › `build.cssTarget`, `cssMinify`, `cssCodeSplit`](https://vite.dev/config/build-options) · vite.dev · `cssTarget` defaults to `build.target`, `cssMinify` defaults to `'lightningcss'`, `cssCodeSplit` to `true` (*read*) · fetched 2026-10-14
- **Also good:** [Features › Disabling CSS injection into the page](https://vite.dev/guide/features) · vite.dev · the `?inline` query; `?raw` and `?url` live on [Static Asset Handling](https://vite.dev/guide/assets) (*read*) · fetched 2026-10-14
- **Our delta:** the FOUC non-problem with code splitting, and `cssTarget` overriding `css.lightningcss.targets`.

---

## Section 10 — SSR support

### T10-01a · SSR primitives, the dev request and environments — Topic · ✅ written `docs/vite/pages/10-ssr-support/01-server-side-rendering-primitives.md`
- **Read this:** [Server-Side Rendering](https://vite.dev/guide/ssr) · vite.dev · source structure, dev server in middleware mode with `appType: 'custom'`, and the note that it is a low-level API for framework authors (*read*) · covers our angle: **partial** — the Express example, not the six-step pipeline reasoning · fetched 2026-10-14
- **Also good:** [Environment API](https://vite.dev/guide/api-environment) · vite.dev · `client` and `ssr` environments always exist in dev; the top-level `ssr` property is slated for deprecation once the API is stable (*read*) · fetched 2026-10-14
- **Our delta:** why each step exists (the file Node runs is not the file you wrote), and SSR as one environment among many.

### T10-01b · The module runner and non-Node environments — Topic · ✅ written `docs/vite/pages/10-ssr-support/01c-the-module-runner.md`
- **Read this:** [Environment API for Frameworks](https://vite.dev/guide/api-environment-frameworks) · vite.dev · `RunnableDevEnvironment` (same runtime, values pass directly, `runner` replaces `server.ssrLoadModule`) versus `FetchableDevEnvironment` (Request and Response) (*read*) · covers our angle: **full** — both environment kinds and the replacement are stated · fetched 2026-10-14
- **Also good:** [Environment API for Runtimes](https://vite.dev/guide/api-environment-runtimes) · vite.dev · `ModuleRunner` from `vite/module-runner`, `import(url)`, `ESModulesEvaluator`, transport; it does not say `ssrLoadModule` is deprecated, so that claim in our page rests on the frameworks page (*read*) · fetched 2026-10-14
- **Our delta:** the deprecation-path framing and the hot-channel option.

### T10-01c · Externals, `ssr.target` and resolve conditions — Topic · ✅ written `docs/vite/pages/10-ssr-support/01d-ssr-externals.md`
- **Read this:** [SSR Options](https://vite.dev/config/ssr-options) · vite.dev · all deps externalised except linked ones; `noExternal` and `external` priority; `ssr.target` `node` or `webworker`; `ssr.resolve.conditions` versus `externalConditions` (*read*) · covers our angle: **full** — every option and default · fetched 2026-10-14
- **Also good:** [SSR Externals, SSR Target, SSR Resolve Conditions](https://vite.dev/guide/ssr) · vite.dev · the guide's short versions of the same three sections (*read*) · fetched 2026-10-14
- **Our delta:** the parse-error story (default externalisation right about the wrong package) and why the same import resolves to a different file.

### T10-01d · Production SSR builds, the SSR manifest and the `ssr` hook flag — Topic · ✅ written `docs/vite/pages/10-ssr-support/01f-the-two-builds.md`
- **Read this:** [Building for Production and Generating Preload Directives](https://vite.dev/guide/ssr) · vite.dev · `build:client` plus `build:server --ssr`, the `--ssrManifest` flag and preload tags, and the `ssr` property on `resolveId`, `load` and `transform` options (*read*) · covers our angle: **partial** — does not cover building all environments in one process · fetched 2026-10-14
- **Also good:** [Environment API for Plugins](https://vite.dev/guide/api-environment-plugins) · vite.dev · `this.environment` replaces the boolean `ssr`; also per-environment state and build hooks (*read*) · fetched 2026-10-14
- **Also good:** [Environment API for Frameworks › builder.buildApp](https://vite.dev/guide/api-environment-frameworks) · vite.dev · `builder.buildApp`, the `buildApp` hook and `createBuilder` (*read*) · fetched 2026-10-14
- **Our delta:** why the manifest comes from the client build, and what replaces files-on-disk state passing.

---

## Section 11 — Optimisation and performance

### T11-01a · Three clocks, dependency pre-bundling and its caches — Topic · ✅ written `docs/vite/pages/11-optimization-and-performance/01-build-time-performance.md`
- **Read this:** [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling) · vite.dev · the two reasons (CommonJS to ESM, many-file packages to one), linked-package handling, and the file system cache keyed on lockfile, patches folder, relevant config and `NODE_ENV` (*read*) · covers our angle: **full** — including the immutable browser cache and `--force` · fetched 2026-10-14
- **Also good:** [Performance](https://vite.dev/guide/performance) · vite.dev · audit plugins, trim `resolve.extensions`, avoid barrel files, `server.warmup`, `vite --profile` (*read*) · fetched 2026-10-14
- **Our delta:** the three-clock framing, `include` versus `exclude`, and that Rolldown now does the pre-bundle.

### T11-01b · `codeSplitting` groups, priority and sizing — Topic · ✅ written `docs/vite/pages/11-optimization-and-performance/01d-chunk-splitting-after-manualchunks.md`
- **Read this:** [CodeSplittingGroup](https://rolldown.rs/reference/TypeAlias.CodeSplittingGroup) · rolldown.rs · `priority` default 0 with ties to the earlier group, `minSize` and `maxSize` in bytes, `entriesAware` default false, `minShareCount`, `test`, `name` (*read*) · covers our angle: **full** — every field our two pages lean on · fetched 2026-10-14
- **Also good:** [Advanced chunks](https://rolldown.rs/in-depth/advanced-chunks) · rolldown.rs · a module is captured by manual or automatic splitting, not both; recursive dependency capture; limitations (*read*) · fetched 2026-10-14
- **Also good:** [Migration from v7](https://vite.dev/guide/migration) · vite.dev · the entry for the removed object form and deprecated function form of `manualChunks` (*headings only*) · fetched 2026-10-14
- **Our delta:** the catch-all-above-specific-groups trap, and the lightest entry paying for the heaviest one.

### T11-01c · Size reporting, preloading, sourcemaps, target and minifiers — Topic · ✅ written `docs/vite/pages/11-optimization-and-performance/01f-chunk-size-warnings-and-size-reporting.md`
- **Read this:** [Build Options](https://vite.dev/config/build-options) · vite.dev · `chunkSizeWarningLimit` 500 kB compared against uncompressed size, `modulePreload` default `{ polyfill: true }`, `sourcemap` false, `target` Baseline widely available, `minify` Oxc for the client (*read*) · covers our angle: **full** — all defaults in one page · fetched 2026-10-14
- **Also good:** [Building for Production](https://vite.dev/guide/build) · vite.dev · chunking strategy via `output.codeSplitting` and the `vite:preloadError` event (*read*) · fetched 2026-10-14
- **Our delta:** which engine each of the three costs moved to, and the default browser floor moving without a config edit.

---

## Section 12 — Path resolution and aliases

### T12-01a · `resolve.alias`, tsconfig paths and aliases beyond JS — Topic · ✅ written `docs/vite/pages/12-path-resolution-and-aliases/01-resolve-options.md`
- **Read this:** [Shared Options › `resolve.alias`, `resolve.tsconfigPaths`](https://vite.dev/config/shared-options) · vite.dev · object and array formats for `alias`, plus the built-in `tsconfigPaths` option (*read*) · covers our angle: **partial** — the option list, not why a relative path or `__dirname` fails silently · fetched 2026-10-14
- **Beyond the docs:** [Vite: fix failed to resolve import path aliases](https://blog.openreplay.com/vite-fix-failed-to-resolve-import-path-aliases/) · OpenReplay Team, 2025-10-31 · shows the two configs that must agree (`resolve.alias` and tsconfig `paths`), the plugin route, and the `__dirname` in ESM and missing `@types/node` causes; predates `resolve.tsconfigPaths` coverage · fetched 2026-10-14 (*read*)
- **Our delta:** aliases reaching CSS `@import` and `url()` but never a raw HTML attribute, and stubbing or monorepo-source aliasing.

### T12-01b · `extensions`, `dedupe` and `preserveSymlinks` — Topic · ✅ written `docs/vite/pages/12-path-resolution-and-aliases/01c-resolve-extensions.md`
- **Read this:** [Shared Options › `resolve.dedupe`, `extensions`, `preserveSymlinks`](https://vite.dev/config/shared-options) · vite.dev · the three option entries (*read*) · covers our angle: **partial** — reference text only; no cost model or `server.fs.allow` link · fetched 2026-10-14
- **Also good:** [Performance › Reduce Resolve Operations](https://vite.dev/guide/performance) · vite.dev · explicit paths with extensions, trim `resolve.extensions` (*read*) · fetched 2026-10-14
- **Our delta:** one `stat` per entry per import, dedupe fixing resolution not versions, and symlink identity cascading into 403s.

### T12-01c · `exports`, `imports`, conditions and `mainFields` — Topic · ✅ written `docs/vite/pages/12-path-resolution-and-aliases/01g-the-exports-and-imports-fields.md`
- **Read this:** [Node.js Modules: Packages](https://nodejs.org/api/packages.html) · nodejs.org · "all subpaths of the package are encapsulated", earlier condition entries win, `imports` keys start with `#`, self-reference needs `exports` (*read*) · covers our angle: **full** — the Node rules Vite inherits · fetched 2026-10-14
- **Also good:** [Shared Options › `resolve.conditions`, `resolve.mainFields`](https://vite.dev/config/shared-options) · vite.dev · Vite's default conditions and the field fallback (*read*) · fetched 2026-10-14
- **Also good:** [Migration from v7 › Removed Module Resolution Using Format Sniffing](https://vite.dev/guide/migration) · vite.dev · the Vite 8 removal our `mainFields` page names (*headings only*) · fetched 2026-10-14
- **Our delta:** the browser-branch default for dual packages and the `ERR_PACKAGE_PATH_NOT_EXPORTED` failure mode.

### T12-01d · Node built-ins, externalisation, dual packages and debugging resolution — Topic · ✅ written `docs/vite/pages/12-path-resolution-and-aliases/01j-node-builtins-in-browser-code.md`
- **Read this:** [Troubleshooting › Module externalized for browser compatibility](https://vite.dev/guide/troubleshooting) · vite.dev · Vite does not polyfill Node modules, so browser code should avoid them (*read*) · covers our angle: **partial** — no mention of `ERR_PACKAGE_PATH_NOT_EXPORTED` or "Failed to resolve import" · fetched 2026-10-14
- **Also good:** [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling) · vite.dev · CommonJS to ESM conversion in pre-bundling, the context for our dual-package page (*read*) · fetched 2026-10-14
- **Beyond the docs:** [vite-plugin-node-polyfills](https://github.com/davidmyersdev/vite-plugin-node-polyfills) · David Myers, GitHub README, undated · the escape hatch when a library really needs `Buffer` or `process`: `include`, `exclude`, `globals`, `overrides` (*read*) · fetched 2026-10-14
- **Our delta:** why there is no `resolve.builtins`, and telling the two error classes apart by pipeline stage.

---

## Section 13 — Worker and WASM support

### T13-01a · Workers: build configuration, messaging and types — Topic · ✅ written `docs/vite/pages/13-worker-and-wasm-support/01-advanced-runtime-targets.md`
- **Read this:** [Worker Options](https://vite.dev/config/worker-options) · vite.dev · `worker.format` defaults to `'iife'`, `worker.plugins` is a function returning fresh instances, `worker.rolldownOptions` (*read*) · covers our angle: **full** — the separate worker build and its default format · fetched 2026-10-14
- **Also good:** [Features › Web Workers](https://vite.dev/guide/features) and [Static Asset Handling](https://vite.dev/guide/assets) · vite.dev · constructor imports versus `?worker`, `?sharedworker`, `?worker&inline` (*read*) · fetched 2026-10-14
- **Also good:** [Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects) · MDN · copy by default, transfer detaches the original, zero-copy for `ArrayBuffer`; with [The structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm) (functions throw `DataCloneError`) and [SharedWorker](https://developer.mozilla.org/en-US/docs/Web/API/SharedWorker) (the `port`, `onconnect`, `port.start()`) (*read*) · fetched 2026-10-14
- **Our delta:** typing message payloads yourself; `vite/client` only types the imports.

### T13-01b · WebAssembly: bare `.wasm` versus `?init` — Topic · ✅ written `docs/vite/pages/13-worker-and-wasm-support/01c-webassembly-imports.md`
- **Read this:** [Features › WebAssembly](https://vite.dev/guide/features) · vite.dev · sections on ESM integration, manual initialization and accessing the module; the ESM form needs top-level await (*headings only*) · covers our angle: **partial** — I confirmed the headings, not the full wording of each section · fetched 2026-10-14
- **Beyond the docs:** [vite-plugin-wasm](https://github.com/Menci/vite-plugin-wasm) · Menci, GitHub README, undated · WebAssembly ESM integration like webpack's `asyncWebAssembly`; needs top-level await support or a plugin, and `wasm()` must also go in `worker.plugins`; says it works with Vite 2 to 8 · fetched 2026-10-14 (*read*)
- **Our delta:** the two import forms as different features, and typing `?init` results.
