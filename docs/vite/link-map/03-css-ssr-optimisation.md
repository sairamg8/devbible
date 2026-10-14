---
title: "Link map · Vite · Part 3 (sections 09–13)"
sidebar_label: "03 · css ssr optimisation"
sidebar_position: 3
---

# Link map · Vite · Part 3 (sections 09–13)

Covers sections 09 (CSS handling), 10 (SSR support), 11 (optimisation and performance), 12 (path resolution and aliases) and 13 (worker and WASM support) of `docs/vite/pages/`. Each section is one numbered topic page split into chunks (10, 11, 10, 15 and 5 chunks), so each is written as several blocks that each cover a coherent cluster of chunks; the path shown is the first chunk of the cluster. All 16 blocks have written pages of ours.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. No `#anchors` are given except ones seen as heading ids on the fetched page. Where no good non-official explanation turned up after searching (Vite 6 to 8 era only; hits that were wrong, undated-in-year, or written for Vite 5 or older were rejected), the block has no "Beyond the docs" line.

🔴 **Version note.** Our pages in this part were verified 2026-09-07 and 2026-09-08 against **Vite 8.2.2**. The official links point at vite.dev, which served **v8.3.4** on 2026-10-14, and at rolldown.rs. Official pages are the current ones, so option names and defaults match Vite 8 (Rolldown, Oxc, Lightning CSS minification). Anything labelled v2 to v7 in search results was skipped on purpose.

---

## Section 09 — CSS handling

### T09-01a · The CSS pipeline: `@import`, PostCSS and preprocessors — Topic · ✅ written `docs/vite/pages/09-css-handling/01-styling-pipeline.md`
- **Read this:** [Features › CSS](https://vite.dev/guide/features) · vite.dev · the CSS section: `@import` inlining via `postcss-import` with aliases honoured, `url()` rebasing, a valid PostCSS config applied to all imported CSS, minification after PostCSS using `build.cssTarget`, and Sass, Less and Stylus support where you install the preprocessor yourself (Stylus gets no `@import` alias or rebasing) (*read*) · covers our angle: **partial** — states each feature, but does not lay the stages out as one ordered chain or say which stage owns a rule · fetched 2026-10-14
- **Also good:** [Shared Options › `css.postcss`, `css.preprocessorOptions`](https://vite.dev/config/shared-options) · vite.dev · inline `css.postcss` stops the config search; Sass uses `sass-embedded` if installed, otherwise `sass`; `additionalData` is prepended to every file so relative paths break; `css.preprocessorMaxWorkers` defaults to `true` (*read*) · fetched 2026-10-14
- **Our delta:** the fixed stage order, a PostCSS config found at the workspace root silently becoming global (the search stops at the workspace boundary), what happens when the `sass-embedded` native binary is missing, and Stylus rebasing beyond the one-line caveat.

### T09-01b · CSS Modules: the filename rule and the edge cases — Topic · ✅ written `docs/vite/pages/09-css-handling/01d-css-modules.md`
- **Read this:** [Features › CSS Modules](https://vite.dev/guide/features) · vite.dev · any file ending `.module.css` returns a module object, tuned by `css.modules`; named imports work once `localsConvention` is a camelCase mode (`.apply-color` becomes `applyColor`) (*read*) · covers our angle: **partial** — the basic rule and the named-import example; nothing on `?inline` or `?url` applied to a module, SSR or HMR behaviour · fetched 2026-10-14
- **Also good:** [Shared Options › `css.modules`](https://vite.dev/config/shared-options) · vite.dev · options are handed to postcss-modules (`generateScopedName`, `hashPrefix`, `scopeBehaviour`, `globalModulePaths`, `exportGlobals`, `getJSON`, `localsConvention` with four string modes or a function); no effect when Lightning CSS is the transformer (*read*) · fetched 2026-10-14
- **Our delta:** the filename test as one regular expression with no config input, why a CSS module is a JS module of strings, and everything that follows from it (no self-accepting HMR, `?inline` returning text, `?url` throwing, SSR).

### T09-01c · Lightning CSS, `?inline`/`?raw`/`?url`, code splitting and minification targets — Topic · ✅ written `docs/vite/pages/09-css-handling/01e-lightning-css.md`
- **Read this:** [Lightning CSS docs › With Vite](https://lightningcss.dev/docs.html) · lightningcss.dev · the three config places: `css.transformer: 'lightningcss'`, `css.lightningcss.targets` via `browserslistToTargets()`, and `build.cssMinify: 'lightningcss'` (heading id `with-vite`) (*read*) · covers our angle: **partial** — the swap config only; says nothing about Vite 8 already minifying with it by default · fetched 2026-10-14
- **Also good:** [Build Options › `build.cssTarget`, `cssMinify`, `cssCodeSplit`](https://vite.dev/config/build-options) · vite.dev · `cssTarget` defaults to `build.target` and, with `cssMinify: 'lightningcss'`, takes precedence over `css.lightningcss.targets`; `cssMinify` defaults to `'lightningcss'` (`false` if client minify is off); `cssCodeSplit` to `true` (*read*) · fetched 2026-10-14
- **Also good:** [Features › Disabling CSS injection into the page](https://vite.dev/guide/features) · vite.dev · the `?inline` query returns processed CSS as the default export without injecting it; `?raw` and `?url` live on [Static Asset Handling](https://vite.dev/guide/assets) under "Importing Asset as String" and "Explicit URL Imports" (*read*) · fetched 2026-10-14
- **Our delta:** the FOUC non-problem with code splitting, and how `cssTarget` silently inheriting the Baseline `build.target` decides how much modern CSS is lowered (the docs state the precedence over `css.lightningcss.targets` in one line).

---

## Section 10 — SSR support

### T10-01a · SSR primitives, the dev request and environments — Topic · ✅ written `docs/vite/pages/10-ssr-support/01-server-side-rendering-primitives.md`
- **Read this:** [Server-Side Rendering](https://vite.dev/guide/ssr) · vite.dev · source structure, dev server in middleware mode with `appType: 'custom'`, and the note that it is a low-level API for framework authors (its Express example still calls `vite.ssrLoadModule`) (*read*) · covers our angle: **partial** — the Express example, not the six-step pipeline reasoning · fetched 2026-10-14
- **Also good:** [Environment API](https://vite.dev/guide/api-environment) · vite.dev · `client` and `ssr` environments are always present in dev; the top-level `ssr` property is going to be deprecated once the API is stable (*read*) · fetched 2026-10-14
- **Our delta:** why each step exists (the file Node runs is not the file you wrote), and SSR as one environment among many.

### T10-01b · The module runner and non-Node environments — Topic · ✅ written `docs/vite/pages/10-ssr-support/01c-the-module-runner.md`
- **Read this:** [Environment API for Frameworks](https://vite.dev/guide/api-environment-frameworks) · vite.dev · `RunnableDevEnvironment` (same runtime, values pass directly, `runner.import()` is "the modern replacement for `server.ssrLoadModule`") versus `FetchableDevEnvironment` (Request and Response, recommended where possible) (*read*) · covers our angle: **partial** — both environment kinds and the replacement are stated, but the page does not say `ssrLoadModule` is deprecated · fetched 2026-10-14
- **Also good:** [SSR Using ModuleRunner API](https://vite.dev/changes/ssr-using-modulerunner) · vite.dev · the primary source for the deprecation claim: "The deprecation of `server.ssrLoadModule` is planned for a future major", `future.removeSsrLoadModule: 'warn'` to find usages, `ModuleRunner` since v6.0; no version or date is given, so "deprecation path" is accurate and "deprecated" is not (*read*) · fetched 2026-10-14
- **Also good:** [Environment API for Runtimes](https://vite.dev/guide/api-environment-runtimes) · vite.dev · `ModuleRunner` from `vite/module-runner`, `ESModulesEvaluator` (uses `new AsyncFunction`), transport, `HotChannel` and `createServerHotChannel`; it contrasts the runner with `ssrLoadModule` but does not mention deprecation (*read*) · fetched 2026-10-14
- **Our delta:** the deprecation-path framing, `import.meta.hot.accept()` in the server entry, and the per-connection hot-channel client in custom environments.

### T10-01c · Externals, `ssr.target` and resolve conditions — Topic · ✅ written `docs/vite/pages/10-ssr-support/01d-ssr-externals.md`
- **Read this:** [SSR Options](https://vite.dev/config/ssr-options) · vite.dev · all deps externalised except linked ones (`noExternal` default); `external: true` externalises linked ones too; `ssr.target` `node` or `webworker`; `ssr.resolve.conditions` default `module`, `node`, `development|production` versus `externalConditions` default `node`, `module-sync` (*read*) · covers our angle: **full** — every option and default · fetched 2026-10-14
- **Also good:** [SSR Externals, SSR Target, SSR Resolve Conditions](https://vite.dev/guide/ssr) · vite.dev · the guide's short versions of the same three sections (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Broken npm package](https://vike.dev/broken-npm-package) · Vike docs, undated · why a dependency that bundlers accept crashes in Node during SSR (Vite does not transpile npm server code), the error list (`Cannot use import statement outside a module`, `ERR_UNSUPPORTED_DIR_IMPORT` and others), and the fixes `ssr.noExternal`, `vite-plugin-cjs-interop`, or opting out of SSR; its sample output is from Node 18 · fetched 2026-10-14 (*read*)
- **Our delta:** the parse-error story (default externalisation right about the wrong package) and why the same import resolves to a different file.

### T10-01d · Production SSR builds, the SSR manifest and the `ssr` hook flag — Topic · ✅ written `docs/vite/pages/10-ssr-support/01f-the-two-builds.md`
- **Read this:** [Building for Production and Generating Preload Directives](https://vite.dev/guide/ssr) · vite.dev · `build:client` plus `build:server --ssr`, `--ssrManifest` writing `.vite/ssr-manifest.json` (module IDs to chunks and assets, usable for 103 Early Hints), and the `ssr` property on `resolveId`, `load` and `transform` options (*read*) · covers our angle: **partial** — does not cover building all environments in one process · fetched 2026-10-14
- **Also good:** [Environment API for Plugins](https://vite.dev/guide/api-environment-plugins) · vite.dev · `this.environment` in hook context replaces the `ssr` boolean, also during build hooks; plugin state keyed by environment; `applyToEnvironment` (*read*) · fetched 2026-10-14
- **Also good:** [Environment API for Frameworks › builder.buildApp](https://vite.dev/guide/api-environment-frameworks) · vite.dev · `builder.buildApp`, the `buildApp` hook and `createBuilder` as the build-time equivalent of `createServer` (*read*) · fetched 2026-10-14
- **Our delta:** why the manifest comes from the client build, building all environments in one process, and what replaces files-on-disk state passing.

---

## Section 11 — Optimisation and performance

### T11-01a · Three clocks, dependency pre-bundling and its caches — Topic · ✅ written `docs/vite/pages/11-optimization-and-performance/01-build-time-performance.md`
- **Read this:** [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling) · vite.dev · the two reasons (CommonJS to ESM, many-file packages to one), performed with Rolldown, linked-package handling (add to `optimizeDeps.include` if not ESM), and the cache in `node_modules/.vite` keyed on lockfile, patches folder, relevant config and `NODE_ENV` (*read*) · covers our angle: **full** — including the `max-age=31536000,immutable` browser cache and `--force` · fetched 2026-10-14
- **Also good:** [Performance](https://vite.dev/guide/performance) · vite.dev · audit plugins, trim `resolve.extensions`, avoid barrel files, `server.warmup`, `vite --profile` (*read*) · fetched 2026-10-14
- **Our delta:** the three-clock framing (cold start, page loads, `vite build`), the `include` versus `exclude` decision, and which knob moves which clock.

### T11-01b · `codeSplitting` groups, priority and sizing — Topic · ✅ written `docs/vite/pages/11-optimization-and-performance/01d-chunk-splitting-after-manualchunks.md`
- **Read this:** [CodeSplittingGroup](https://rolldown.rs/reference/TypeAlias.CodeSplittingGroup) · rolldown.rs · `priority` default 0 with ties to the smaller index, `minSize` and `maxSize` in bytes, `entriesAware` default false, `minShareCount` default 1, `test`, `name`, plus `minModuleSize`, `maxModuleSize`, `entriesAwareMergeThreshold` and `includeDependenciesRecursively` (*read*) · covers our angle: **full** — every field our three pages lean on · fetched 2026-10-14
- **Also good:** [Advanced chunks](https://rolldown.rs/in-depth/advanced-chunks) · rolldown.rs · a module is captured by manual or automatic splitting, not both; recursive dependency capture; `maxSize` is a target not a limit and `minSize` wins; a runtime chunk is always generated (*read*) · fetched 2026-10-14
- **Also good:** [Migration from v7 › Removed object form `build.rollupOptions.output.manualChunks` and deprecate function form one](https://vite.dev/guide/migration) · vite.dev · the object form is not supported, the function form is deprecated, and the replacement is Rolldown's `codeSplitting`; [Building for Production](https://vite.dev/guide/build) names `build.rolldownOptions.output.codeSplitting` (*read*) · fetched 2026-10-14
- **Our delta:** the catch-all-above-specific-groups trap, and the lightest entry paying for the heaviest one.

### T11-01c · Size reporting, preloading, sourcemaps, target and minifiers — Topic · ✅ written `docs/vite/pages/11-optimization-and-performance/01f-chunk-size-warnings-and-size-reporting.md`
- **Read this:** [Build Options](https://vite.dev/config/build-options) · vite.dev · `chunkSizeWarningLimit` 500 kB compared against the uncompressed chunk size, `modulePreload` default `{ polyfill: true }`, `sourcemap` false, `target` `'baseline-widely-available'` (a date fixed per major; Vite 8 gives Chrome 111, Firefox 114, Safari 16.4), `minify` Oxc for the client and false for SSR (*read*) · covers our angle: **full** — all defaults in one page · fetched 2026-10-14
- **Also good:** [Building for Production](https://vite.dev/guide/build) · vite.dev · chunking strategy via `build.rolldownOptions.output.codeSplitting` and the `vite:preloadError` event (*read*) · fetched 2026-10-14
- **Our delta:** which engine each of the three costs moved to, and the default browser floor being a dated Baseline snapshot that moves at a major rather than through a config edit.

---

## Section 12 — Path resolution and aliases

### T12-01a · `resolve.alias`, tsconfig paths and aliases beyond JS — Topic · ✅ written `docs/vite/pages/12-path-resolution-and-aliases/01-resolve-options.md`
- **Read this:** [Shared Options › `resolve.alias`, `resolve.tsconfigPaths`](https://vite.dev/config/shared-options) · vite.dev · object and array formats for `alias` (first rule wins, use absolute paths for file system targets), plus the built-in `tsconfigPaths` option (default false, applies only to files matched by a tsconfig `files` or `include`, unsupported inside `.less`) (*read*) · covers our angle: **partial** — the option list and the absolute-path advice, not why a relative path or `__dirname` fails silently · fetched 2026-10-14
- **Beyond the docs:** [Vite: fix failed to resolve import path aliases](https://blog.openreplay.com/vite-fix-failed-to-resolve-import-path-aliases/) · OpenReplay Team, 2025-10-31 · shows the two configs that must agree (`resolve.alias` and tsconfig `paths`), the `vite-tsconfig-paths` plugin route, and the `__dirname` in ESM and missing `@types/node` causes; never mentions the built-in `resolve.tsconfigPaths` · fetched 2026-10-14 (*read*)
- **Our delta:** aliases reaching CSS `@import` and `url()` but never a raw HTML attribute, and stubbing or monorepo-source aliasing.

### T12-01b · `extensions`, `dedupe` and `preserveSymlinks` — Topic · ✅ written `docs/vite/pages/12-path-resolution-and-aliases/01c-resolve-extensions.md`
- **Read this:** [Shared Options › `resolve.dedupe`, `extensions`, `preserveSymlinks`](https://vite.dev/config/shared-options) · vite.dev · `extensions` default `.mjs, .js, .mts, .ts, .jsx, .tsx, .json` with advice not to omit extensions for custom types such as `.vue`; `dedupe` forces one copy from the project root; `preserveSymlinks` (default false) decides file identity by the original path (*read*) · covers our angle: **partial** — reference text only; no cost model or `server.fs.allow` link · fetched 2026-10-14
- **Also good:** [Performance › Reduce Resolve Operations](https://vite.dev/guide/performance) · vite.dev · explicit paths with extensions, trim `resolve.extensions` (the trimmed list must still work for files in `node_modules`) (*read*) · fetched 2026-10-14
- **Our delta:** one `stat` per entry per import, dedupe fixing resolution not versions, and symlink identity cascading into 403s.

### T12-01c · `exports`, `imports`, conditions and `mainFields` — Topic · ✅ written `docs/vite/pages/12-path-resolution-and-aliases/01g-the-exports-and-imports-fields.md`
- **Read this:** [Node.js Modules: Packages](https://nodejs.org/api/packages.html) · nodejs.org · "all subpaths of the package are encapsulated" (`ERR_PACKAGE_PATH_NOT_EXPORTED`), earlier condition entries win and `default` goes last, `imports` keys start with `#`, self-reference needs `exports`; this is the latest-branch page, ours cites the Node 22.x one (*read*) · covers our angle: **full** — the Node rules Vite inherits · fetched 2026-10-14
- **Also good:** [Shared Options › `resolve.conditions`, `resolve.mainFields`](https://vite.dev/config/shared-options) · vite.dev · `conditions` default `module`, `browser`, `development|production`; `mainFields` default `browser`, `module`, `jsnext:main`, `jsnext`, lower precedence than `exports` (*read*) · fetched 2026-10-14
- **Also good:** [Migration from v7 › Removed Module Resolution Using Format Sniffing](https://vite.dev/guide/migration) · vite.dev · Vite no longer inspects file contents to choose between `browser` and `module` and always respects the `resolve.mainFields` order; workarounds are an alias or patching the package (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Package exports](https://webpack.js.org/guides/package-exports) · webpack docs, undated · the same `exports` semantics from a bundler's side: unlisted requests fail, conditions are tried in object order and a matched null target stops resolution, `default` or `import` placed early shadows specific ones, and stateless versus stateful dual packages; covers `exports` only, not `imports` · fetched 2026-10-14 (*read*)
- **Our delta:** the browser-branch default for dual packages and the `ERR_PACKAGE_PATH_NOT_EXPORTED` failure mode.

### T12-01d · Node built-ins, externalisation, dual packages and debugging resolution — Topic · ✅ written `docs/vite/pages/12-path-resolution-and-aliases/01j-node-builtins-in-browser-code.md`
- **Read this:** [Troubleshooting › Module externalized for browser compatibility](https://vite.dev/guide/troubleshooting) · vite.dev · the warning appears when a Node.js module is used in the browser, because Vite does not automatically polyfill Node.js modules (the section is two sentences, heading id `module-externalized-for-browser-compatibility`) (*read*) · covers our angle: **partial** — no mention of `ERR_PACKAGE_PATH_NOT_EXPORTED` or "Failed to resolve import" · fetched 2026-10-14
- **Also good:** [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling) · vite.dev · CommonJS to ESM conversion in pre-bundling, the context for our dual-package page (*read*) · fetched 2026-10-14
- **Beyond the docs:** [vite-plugin-node-polyfills](https://github.com/davidmyersdev/vite-plugin-node-polyfills) · David Myers, GitHub README, undated · the escape hatch when a library really needs `Buffer` or `process`: `include`, `exclude`, `globals`, `overrides`, `protocolImports`; the README states no supported Vite versions (*read*) · fetched 2026-10-14
- **Our delta:** why there is no `resolve.builtins`, and telling the two error classes apart by pipeline stage.

---

## Section 13 — Worker and WASM support

### T13-01a · Workers: build configuration, messaging and types — Topic · ✅ written `docs/vite/pages/13-worker-and-wasm-support/01-advanced-runtime-targets.md`
- **Read this:** [Worker Options](https://vite.dev/config/worker-options) · vite.dev · `worker.format` defaults to `'iife'`; `worker.plugins` is a function returning new instances because workers build in parallel, and `config.plugins` reaches workers only in dev; `worker.rolldownOptions` (`worker.rollupOptions` is a deprecated alias) (*read*) · covers our angle: **full** — the separate worker build and its default format · fetched 2026-10-14
- **Also good:** [Features › Web Workers](https://vite.dev/guide/features) and [Static Asset Handling](https://vite.dev/guide/assets) · vite.dev · the `new Worker(new URL(...))` form (recommended; the `new URL()` must sit directly inside the call with static options) versus `?worker`, `?sharedworker`, `?worker&inline`, `?worker&url` (*read*) · fetched 2026-10-14
- **Also good:** [Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects) · MDN · transfer detaches the original and is zero-copy for `ArrayBuffer` (copying is shown by its `structuredClone()` example rather than stated as a rule); with [The structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm) (functions throw `DataCloneError`) and [SharedWorker](https://developer.mozilla.org/en-US/docs/Web/API/SharedWorker) (the `port`, `onconnect`, `port.start()`) (*read*) · fetched 2026-10-14
- **Our delta:** typing message payloads yourself; `vite/client` only types the imports.

### T13-01b · WebAssembly: bare `.wasm` versus `?init` — Topic · ✅ written `docs/vite/pages/13-worker-and-wasm-support/01c-webassembly-imports.md`
- **Read this:** [Features › WebAssembly](https://vite.dev/guide/features) · vite.dev · ESM integration (a bare `.wasm` import behaves as an async module and needs top-level `await`), manual initialization with `?init` (init function returning a Promise of a `WebAssembly.Instance`, optional `importObject`, inlined below `assetsInlineLimit`), accessing the module via `?url` and `WebAssembly.instantiateStreaming`, the `node:fs` limit for SSR builds, and a typing note (`allowArbitraryExtensions` with a `.d.wasm.ts` file) (*read*) · covers our angle: **partial** — every fact is stated, but as sections of one feature rather than two different import contracts, and with no `build.target` consequence for top-level `await` · fetched 2026-10-14
- **Beyond the docs:** [vite-plugin-wasm](https://github.com/Menci/vite-plugin-wasm) · Menci, GitHub README, undated · WebAssembly ESM integration like webpack's `asyncWebAssembly`, wasm-pack support; needs `vite-plugin-top-level-await` unless `build.target` is `esnext`, and `wasm()` must also go in `worker.plugins`; says it supports Vite 2 to 8, so it overlaps with the built-in bare-import form above · fetched 2026-10-14 (*read*)
- **Our delta:** the two import forms as different features, the `build.target` link to top-level `await`, and typing `?init` results (our pages do not cover the `.d.wasm.ts` note for bare imports).
