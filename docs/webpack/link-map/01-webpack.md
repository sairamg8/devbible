---
title: "Link map · Webpack · Part 1 (sections 01–end)"
sidebar_label: "01 · webpack"
sidebar_position: 1
---

# Link map · Webpack · Part 1 (sections 01–end)

Covers every topic of the webpack track: sections 01 to 16, 21 topic pages (one chunk file each, so each page is one topic and one block). Every topic has a written page of ours, shown by its path. Webpack has no syllabus directory, so topics come from the page tree.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line.

🔴 **Version note.** Our track targets **webpack 5**. Official picks are the live webpack.js.org pages (the version selector defaults to 5), which on 2026-10-14 already document 5.10x-era options (`devtool` arrays 5.105+, `performance` checks 5.110+, `cache.compression: 'zstd'` 5.109+). Treat those as newer than the baseline of our pages. Module Federation has two official sources: webpack.js.org (the built-in plugin) and module-federation.io (Module Federation 2.0, with manifest, runtime API and runtime hooks). Our pages do not carry a `> Verified:` line I could find, so no per-page version was compared. Most third-party picks were written for webpack 4 or early 5; each says so.

---

## Section 01 — Core concepts

### T01-01 · Five core concepts and the module graph — Topic · ✅ written `docs/webpack/pages/01-core-concepts/01-five-core-concepts-and-module-graph.md`
- **Read this:** [Concepts](https://webpack.js.org/concepts/) · webpack.js.org · entry, output, loaders, plugins, mode, and the statement that webpack bundles every module reachable from the entries (*read*) · covers our angle: **partial** — a short overview; the graph is described in one paragraph · fetched 2026-10-14
- **Also good:** [Loaders](https://webpack.js.org/concepts/loaders/) · webpack.js.org · loaders run right to left (bottom to top), and the last loader must return content matching the module type (*read*) · fetched 2026-10-14
- **Our delta:** the module graph as a data structure, and the mental model of how the five parts interact.

## Section 02 — Configuration

### T02-01 · Entry and output deep dive — Topic · ✅ written `docs/webpack/pages/02-configuration/01-entry-and-output-deep-dive.md`
- **Read this:** [Entry Points](https://webpack.js.org/concepts/entry-points/) · webpack.js.org · single and object syntax, and the EntryDescription object (`dependOn`, `filename`, `import`, `runtime`, `publicPath`) with the rule that `runtime` and `dependOn` cannot combine (*read*) · covers our angle: **full** for entry · fetched 2026-10-14
- **Also good:** [Output](https://webpack.js.org/configuration/output/) · webpack.js.org · `output.filename` templates, `chunkFilename`, `clean` (5.20+), `publicPath`; a very long page, `publicPath` body not read (*headings only*) · fetched 2026-10-14
- **Our delta:** which output option governs which file kind, and the `publicPath` runtime failure modes.

## Section 03 — Module resolution

### T03-01 · The `resolve` object — Topic · ✅ written `docs/webpack/pages/03-module-resolution/01-the-resolve-object.md`
- **Read this:** [Resolve](https://webpack.js.org/configuration/resolve/) · webpack.js.org · `alias` (trailing `$` for exact match, `false` to ignore), `extensions` with `'...'`, `mainFields` defaults (`browser`, `module`, `main` for web), `conditionNames`, `exportsFields`, `fallback` for the missing Node polyfills (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Module Resolution](https://webpack.js.org/concepts/module-resolution/) · webpack.js.org · absolute, relative and module paths, then `exportsFields` before `extensions` and `mainFields` (*read*) · fetched 2026-10-14
- **Our delta:** the order of precedence between `exports` and `mainFields` as a debugging checklist.

## Section 04 — Loaders

### T04-01 · Transpilation and style loaders — Topic · ✅ written `docs/webpack/pages/04-loaders/01-transpilation-and-style-loaders.md`
- **Read this:** [babel-loader](https://webpack.js.org/loaders/babel-loader/) · webpack.js.org · usage, `cacheDirectory` (default false, up to 2x faster), `exclude` for `node_modules`, troubleshooting; a third-party package, loader 10 needs webpack 5.61+ (*read*) · covers our angle: **partial** — JS side only · fetched 2026-10-14
- **Also good:** [MiniCssExtractPlugin](https://webpack.js.org/plugins/mini-css-extract-plugin/) · webpack.js.org · extracts CSS to files, pairs `MiniCssExtractPlugin.loader` with `css-loader`; returned 200 but the page text did not render for my reader, so it was not read (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Difference between style-loader and mini-css-extract-plugin](https://maxrozen.com/difference-between-style-loader-mini-css-extract-plugin) · Max Rozen, undated · style-loader injects style tags (fine for dev and critical CSS), the plugin emits one CSS file per JS file that imports CSS · fetched 2026-10-14 (*read*)
- **Our delta:** the full chain (Sass, PostCSS, CSS Modules) and the dev/prod switch.

### T04-02 · Loader mechanics: pitching and async — Topic · ✅ written `docs/webpack/pages/04-loaders/02-loader-mechanics-pitching-and-async.md`
- **Read this:** [Loader Interface](https://webpack.js.org/api/loaders/) · webpack.js.org · sync and async loaders (`this.async()` or an async function), raw loaders, the Pitching Loader section (pitch runs left to right, returning a value short-circuits the chain), and `this.getOptions(schema)` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Loaders](https://survivejs.com/webpack/extending/loaders/) · SurviveJS (book excerpt, author and date not shown) · builds loaders with loader-runner, covers pitch loaders and a caching loader that passes state from pitch to the normal phase · fetched 2026-10-14 (*read*)
- **Our delta:** the pitch-then-normal ordering diagram and the `loader-utils` to `this.getOptions` migration.

## Section 05 — Asset modules

### T05-01 · Built-in asset types — Topic · ✅ written `docs/webpack/pages/05-asset-modules/01-built-in-asset-types.md`
- **Read this:** [Asset Modules](https://webpack.js.org/guides/asset-modules/) · webpack.js.org · `asset/resource`, `asset/inline`, `asset/source`, `asset`, bytes type; `parser.dataUrlCondition.maxSize` (8 KB default) and `generator.filename` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Webpack 5 Asset Modules](https://dev.to/smelukov/webpack-5-asset-modules-2o3h) · Sergey Melyukov, DEV Community, 2020-02-16 · the feature author explains the replacement of file-loader, url-loader and raw-loader; written during the beta, so `experiments: { asset: true }` is obsolete · fetched 2026-10-14 (*read*)
- **Our delta:** migration table from the v4 loaders and the `?inline` and `?url` query suffixes.

## Section 06 — Plugins

### T06-01 · Essential plugins — Topic · ✅ written `docs/webpack/pages/06-plugins/01-essential-plugins.md`
- **Read this:** [DefinePlugin](https://webpack.js.org/plugins/define-plugin/) · webpack.js.org · text replacement, so each value needs real quotes (`JSON.stringify("production")`), feature flags, `runtimeValue` (*read*) · covers our angle: **partial** — one plugin of several · fetched 2026-10-14
- **Also good:** [Plugins](https://webpack.js.org/concepts/plugins/) · webpack.js.org · plugin anatomy, usage via `plugins` array, `processAssets` rather than `emit` (*read*) · fetched 2026-10-14
- **Also good:** [HtmlWebpackPlugin](https://webpack.js.org/plugins/html-webpack-plugin/) and [CopyWebpackPlugin](https://webpack.js.org/plugins/copy-webpack-plugin/) · webpack.js.org · third-party plugins; both returned 200 (*headings only*) · fetched 2026-10-14
- **Our delta:** which plugins are built in versus separate packages, and an ordering table.

## Section 07 — Code splitting

### T07-01 · Splitting strategies — Topic · ✅ written `docs/webpack/pages/07-code-splitting/01-splitting-strategies.md`
- **Read this:** [Code Splitting](https://webpack.js.org/guides/code-splitting/) · webpack.js.org · the three approaches (entry points, prevent duplication with `dependOn` and `splitChunks`, dynamic imports), prefetch versus preload, `ChunkLoadError` tips (*read*) · covers our angle: **partial** — `runtimeChunk` appears only inside the entry example · fetched 2026-10-14
- **Also good:** [SplitChunksPlugin](https://webpack.js.org/plugins/split-chunks-plugin/) · webpack.js.org · defaults (`chunks: async`, `minSize` 20000 in production, `maxAsyncRequests` 30), every option, `cacheGroups` (*read*) · fetched 2026-10-14
- **Our delta:** choosing `chunks: all`, and runtime chunk trade-offs.

## Section 08 — Optimization

### T08-01 · Production optimizations — Topic · ✅ written `docs/webpack/pages/08-optimization/01-production-optimizations.md`
- **Read this:** [Tree Shaking](https://webpack.js.org/guides/tree-shaking/) · webpack.js.org · `sideEffects` versus `usedExports`, the include/skip/exclude decision per module, `/*#__PURE__*/`, and the pitfall that `sideEffects: false` drops CSS imports (*read*) · covers our angle: **partial** — minification is only a short section · fetched 2026-10-14
- **Also good:** [ModuleConcatenationPlugin](https://webpack.js.org/plugins/module-concatenation-plugin/) · webpack.js.org · scope hoisting, bailout table (non-ES modules, `eval`, `module.hot`), `--stats-optimization-bailout` (*read*) · fetched 2026-10-14
- **Our delta:** Terser options and the order in which the three steps run.

## Section 09 — Dev server and HMR

### T09-01 · Dev server and hot module replacement — Topic · ✅ written `docs/webpack/pages/09-dev-server-and-hmr/01-dev-server-and-hot-module-replacement.md`
- **Read this:** [Hot Module Replacement](https://webpack.js.org/concepts/hot-module-replacement/) · webpack.js.org · how it works in the app, compiler, module and runtime; update bubbling, with the `top.js`, `middle.js`, `leaf.js` example (*read*) · covers our angle: **partial** — little on the server · fetched 2026-10-14
- **Also good:** [devServer](https://webpack.js.org/configuration/dev-server/) · webpack.js.org · `hot` (true, `'only'`, false; on by default since v4), `proxy`, `historyApiFallback`, `static`, `client.overlay`; page covers dev-server v5 and mentions v6 (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Deep dive into HMR with webpack, part two](https://blog.nativescript.org/deep-dive-into-hot-module-replacement-with-webpack-part-two-handling-updates/) · Stanimira Vlaeva, NativeScript blog, 2019-02-12 · hand-written `module.hot.accept` and dispose handlers, self-accepted versus parent-accepted; no webpack version stated · fetched 2026-10-14 (*read*)
- **Our delta:** the proxy and history fallback recipes, and React Refresh versus manual accept.

## Section 10 — Caching strategies

### T10-01 · Long-term caching — Topic · ✅ written `docs/webpack/pages/10-caching-strategies/01-long-term-caching.md`
- **Read this:** [Caching](https://webpack.js.org/guides/caching/) · webpack.js.org · `[contenthash]`, `runtimeChunk: 'single'`, `moduleIds: 'deterministic'`, vendor cache group, and a deploy-time `ChunkLoadError` section (*read*) · covers our angle: **partial** — browser caching only; one example still prints webpack 4.12 output · fetched 2026-10-14
- **Also good:** [Cache](https://webpack.js.org/configuration/cache/) · webpack.js.org · `type: 'filesystem'`, `cacheDirectory`, `buildDependencies`, `version`, CI sharing needs the same absolute path (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Adding hashes to filenames](https://survivejs.com/webpack/optimizing/adding-hashes-to-filenames/) · SurviveJS, undated, sample output from webpack 5.5.0 · hashes in `output.filename`, `chunkFilename`, `assetModuleFilename` and MiniCssExtractPlugin · fetched 2026-10-14 (*read*)
- **Our delta:** the two cache layers (browser versus build) kept apart, and a CDN invalidation checklist.

## Section 11 — Module Federation

### T11-01 · Fundamentals: remotes and exposes — Topic · ✅ written `docs/webpack/pages/11-module-federation/01-fundamentals-remotes-and-exposes.md`
- **Read this:** [Module Federation](https://webpack.js.org/concepts/module-federation/) · webpack.js.org · motivation, local versus remote modules, async-only access, the container with `get` and `init`, share scopes, troubleshooting (*read*) · covers our angle: **full** for concepts · fetched 2026-10-14
- **Also good:** [ModuleFederationPlugin](https://webpack.js.org/plugins/module-federation-plugin/) · webpack.js.org · `name`, `filename`, `remotes` (`name@url`), `remoteType`, `exposes` (string or object), `shared` (*read*) · fetched 2026-10-14
- **Also good:** [Webpack integration](https://module-federation.io/integrations/bundler/webpack) · module-federation.io · setup page for Module Federation 2.0 on webpack (*headings only*) · fetched 2026-10-14
- **Our delta:** a runnable two-app host and remote pair, and the `bootstrap.js` async-boundary pattern.

### T11-02 · Shared dependencies and version negotiation — Topic · ✅ written `docs/webpack/pages/11-module-federation/02-shared-dependencies-and-version-negotiation.md`
- **Read this:** [shared](https://module-federation.io/configure/shared) · module-federation.io · `singleton` (higher version wins, lower side warned), `requiredVersion`, `eager`, `shareScope`, prefix matching with a trailing slash; does not document `strictVersion` (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [ModuleFederationPlugin: sharing hints](https://webpack.js.org/plugins/module-federation-plugin/) · webpack.js.org · the full hint list including `strictVersion`, `shareKey`, `import: false`, `packageName` (*read*) · fetched 2026-10-14
- **Also good:** [Runtime troubleshooting](https://module-federation.io/guide/troubleshooting/runtime) · module-federation.io · RUNTIME-005, 006, 012 and 015 for shared failures; duplicate React gives "Invalid hook call" (*read*) · fetched 2026-10-14
- **Our delta:** a decision table for which hint to set when, and where the two docs disagree.

### T11-03 · Dynamic remotes and runtime loading — Topic · ✅ written `docs/webpack/pages/11-module-federation/03-dynamic-remotes-and-runtime-loading.md`
- **Read this:** [Runtime API](https://module-federation.io/guide/runtime/runtime-api) · module-federation.io · `createInstance`, `registerRemotes`, `loadRemote`, `registerShared`, `preloadRemote`; `init` is flagged "use with caution" (*read*) · covers our angle: **partial** — the webpack-native route is not covered · fetched 2026-10-14
- **Also good:** [Module Federation: Dynamic Remote Containers](https://webpack.js.org/concepts/module-federation/) · webpack.js.org · promise-based remotes and dynamic public path (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Dynamic remotes in webpack module federation](https://h3manth.com/posts/dynamic-remotes-webpack-module-federation/) · Hemanth HM, 2021-06-06 · the manual loader: inject the script, init the share scope, call `get`, then lazy-load; webpack 5.0-era API · fetched 2026-10-14 (*read*)
- **Our delta:** choosing between promise remotes and the 2.0 runtime API.

### T11-04 · Architecture patterns and topologies — Topic · ✅ written `docs/webpack/pages/11-module-federation/04-architecture-patterns-and-topologies.md`
- **Read this:** [Module Federation: use cases](https://webpack.js.org/concepts/module-federation/) · webpack.js.org · separate builds per page, component library as container (*read*) · covers our angle: **partial** — no topology guidance · fetched 2026-10-14
- **Beyond the docs:** [Module Federation and federated application architectures](https://rangle.io/blog/module-federation-federated-application-architectures) · Michael Mrowetz, Rangle, 2020-06-29 · hosts, remotes and bi-directional hosts; design-system remote, multi-SPA, shell-driven and multi-shell patterns · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Micro frontends with Webpack Module Federation](https://techblog.telia.no/blog/micro-frontends-with-webpack-module-federation) · Helene Grini, Telia, 2021-03-22 · a real shell with bi-directional remotes, singleton React, and the doubt about main as a shared library · fetched 2026-10-14 (*read*)
- **Our delta:** a topology comparison with failure blast radius.

### T11-05 · Production ops and troubleshooting — Topic · ✅ written `docs/webpack/pages/11-module-federation/05-production-ops-and-troubleshooting.md`
- **Read this:** [Runtime troubleshooting](https://module-federation.io/guide/troubleshooting/runtime) · module-federation.io · 14 error codes RUNTIME-001 to 015 (no 011) with causes and fixes (*read*) · covers our angle: **full** for diagnosis · fetched 2026-10-14
- **Also good:** [Error handling for remote module rendering](https://module-federation.io/blog/error-load-remote) · module-federation.io · three layers: retry plugin, `errorLoadRemote` hook, error boundary (*read*) · fetched 2026-10-14
- **Also good:** [Manifest and Snapshot](https://module-federation.io/guide/basic/manifest-snapshot.html) · module-federation.io · `mf-manifest.json`, `mf-stats.json`, snapshot for preload, `disableSnapshot` trade-off (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Error boundaries and federation](https://stevekinney.com/courses/enterprise-ui/error-boundaries-and-federation) · Steve Kinney, course page, modified 2026-09-14 · why a React error boundary does not catch a remote that is down at startup (*read*) · fetched 2026-10-14
- **Our delta:** a rollout and rollback runbook and cache headers for the remote entry file.

## Section 12 — Source maps

### T12-01 · The `devtool` options — Topic · ✅ written `docs/webpack/pages/12-source-maps/01-devtool-options.md`
- **Read this:** [Devtool](https://webpack.js.org/configuration/devtool/) · webpack.js.org · development picks (`eval`, `eval-source-map`, `eval-cheap-module-source-map`), production picks (`false`, `source-map`, `nosources-source-map`), `hidden-source-map` for error reporting, array form (5.105+) (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Source maps](https://survivejs.com/webpack/building/source-maps/) · SurviveJS, undated · inline for dev, separate files for production, and a quality versus speed walk-through (*read*) · fetched 2026-10-14
- **Our delta:** uploading maps to an error tracker without serving them.

## Section 13 — Multi-config and environment

### T13-01 · Config composition — Topic · ✅ written `docs/webpack/pages/13-multi-config-and-environment/01-config-composition.md`
- **Read this:** [Configuration Types](https://webpack.js.org/configuration/configuration-types/) · webpack.js.org · function export with `env` and `argv`, promise export (CLI only), array of configs, `dependencies`, `parallelism` (5.22+), `--config-name` (*read*) · covers our angle: **partial** — no merge pattern · fetched 2026-10-14
- **Our delta:** `webpack-merge` layering (its README was not fetched here) and `--env` versus `--mode`.

## Section 14 — Performance analysis

### T14-01 · Diagnostics and bundle analysis — Topic · ✅ written `docs/webpack/pages/14-performance-analysis/01-diagnostics-and-bundle-analysis.md`
- **Read this:** [Performance](https://webpack.js.org/configuration/performance/) · webpack.js.org · `hints` (warning by default in production), `maxAssetSize` and `maxEntrypointSize` (250000 bytes), `assetFilter`, new opt-in checks from 5.110 (*read*) · covers our angle: **full** for budgets; the page is newer than our baseline · fetched 2026-10-14
- **Also good:** [webpack-bundle-analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer) · GitHub README · `webpack --profile --json > stats.json` then the CLI, or the plugin with `generateStatsFile` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Build analysis](https://survivejs.com/webpack/optimizing/build-analysis/) · SurviveJS, undated · tool survey grouped by purpose: dependency, composition, comparison, duplicates, why a module is included (*read*) · fetched 2026-10-14
- **Our delta:** reading a treemap for the real culprit, plus a CI budget gate.

## Section 15 — Advanced custom tooling

### T15-01 · Custom loaders and plugins — Topic · ✅ written `docs/webpack/pages/15-advanced-custom-tooling/01-custom-loaders-and-plugins.md`
- **Read this:** [Writing a Plugin](https://webpack.js.org/contribute/writing-a-plugin/) · webpack.js.org · compiler versus compilation, `processAssets` stages, async hooks, watch `modifiedFiles`, cacheable classes; options validation changed at 5.106 (*read*) · covers our angle: **full** for plugins · fetched 2026-10-14
- **Also good:** [Writing a Loader](https://webpack.js.org/contribute/writing-a-loader/) · webpack.js.org · the official loader guide; returned 200 (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Loaders](https://survivejs.com/webpack/extending/loaders/) · SurviveJS, undated · loader-runner debugging, async and pitch loaders, caching; plugin side not covered · fetched 2026-10-14 (*read*)
- **Our delta:** an end-to-end plugin test with a real compiler.

## Section 16 — Real-world workflows and recipes

### T16-01 · Diagnosing a bloated bundle — Topic · ✅ written `docs/webpack/pages/16-real-world-workflows-and-recipes/01-diagnosing-a-bloated-bundle.md`
- **Read this:** [Setting performance budgets with webpack](https://web.dev/articles/codelab-setting-performance-budgets-with-webpack) · web.dev codelab, 2019-01-31 · measure a 323 KiB bundle, set `maxAssetSize` and `maxEntrypointSize`, drop moment.js, reach 97.7 KiB, keep the budget (*read*) · covers our angle: **partial** — one cause only; written for webpack 4 · fetched 2026-10-14
- **Also good:** [Tree Shaking](https://webpack.js.org/guides/tree-shaking/) · webpack.js.org · the `sideEffects` pitfalls for libraries (*read*) · fetched 2026-10-14
- **Beyond the docs:** [A dirty webpack trick that reduced our gzipped bundle size by 55kb](https://swizec.com/blog/a-dirty-webpack-trick-that-reduced-our-gzipped-bundle-size-by-55kb/) · Swizec Teller, 2017-06-15 · audit, ignore Moment locales with `IgnorePlugin`, replace Lodash with modular packages; the author calls it brittle, and modern tree shaking covers part of it · fetched 2026-10-14 (*read*)
- **Our delta:** a start-to-finish order of attack (analyze, split, shake, replace, budget) in one flow.
