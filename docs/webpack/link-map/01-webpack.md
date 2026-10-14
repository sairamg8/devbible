---
title: "Link map · Webpack · Part 1 (sections 01–end)"
sidebar_label: "01 · webpack"
sidebar_position: 1
---

# Link map · Webpack · Part 1 (sections 01–end)

Covers every topic of the webpack track: sections 01 to 16, 21 topic pages (one chunk file each). Webpack has no syllabus directory, so topics come from the page tree. Pages with several distinct sub-topics are split into blocks a, b (same page path, own picks). Every topic has a written page of ours, shown by its path.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line.

🔴 **Version note.** Our track targets **webpack 5**. Official picks are the live webpack.js.org pages, which on 2026-10-14 already document 5.10x-era options (`devtool` arrays 5.105+, `performance` checks 5.110+, `cache.compression: 'zstd'` 5.109+, built-in `?inline` and `?url` suffixes 5.109+, native HTML and file copying 5.111+). Treat those as newer than the baseline of our pages. Our pages carry no `> Verified:` line, so no per-page version was compared; where an official page contradicts or outgrows a claim of ours, the block's delta says so. Module Federation has two official sources: webpack.js.org (the built-in plugin) and module-federation.io (Module Federation 2.0). Most third-party picks were written for webpack 4 or early 5; each says so.

---

## Section 01 — Core concepts

### T01-01 · Five core concepts and the module graph — Topic · ✅ written `docs/webpack/pages/01-core-concepts/01-five-core-concepts-and-module-graph.md`
- **Read this:** [Concepts](https://webpack.js.org/concepts/) · webpack.js.org · entry, output, loaders, plugins, mode; it says "dependency graph" and never "module graph" (*read*) · covers our angle: **partial** — a short overview · fetched 2026-10-14
- **Also good:** [Under the hood](https://webpack.js.org/concepts/under-the-hood/) · webpack.js.org · modules, ModuleGraph, chunks, ChunkGraph and the build lifecycle, aimed at plugin authors (*read*); [Loaders](https://webpack.js.org/concepts/loaders/) · loaders run right to left, the last one must return content matching the module type, and CSS can now be built in via `type: 'css/auto'` (*read*) · fetched 2026-10-14
- **Our delta:** the end-to-end pipeline diagram (resolver, loaders, parser, chunking, output) plus module types; the official Concepts page does not draw it.

## Section 02 — Configuration

### T02-01a · Entry shapes and dynamic entry — Topic · ✅ written `docs/webpack/pages/02-configuration/01-entry-and-output-deep-dive.md`
- **Read this:** [Entry and Context](https://webpack.js.org/configuration/entry-context/) · webpack.js.org · object syntax, the entry descriptor, and the function (dynamic) entry returning a promise, re-invoked on every make (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Entry Points](https://webpack.js.org/concepts/entry-points/) · webpack.js.org · EntryDescription (`dependOn`, `filename`, `import`, `runtime`, `publicPath`); `runtime` and `dependOn` cannot combine; documents no function entry (*read*) · fetched 2026-10-14
- **Our delta:** the glob-scanned async entry recipe; the page's entry shapes are the same as the docs.

### T02-01b · Output filenames and library builds — Topic · ✅ written `docs/webpack/pages/02-configuration/01-entry-and-output-deep-dive.md`
- **Read this:** [Output](https://webpack.js.org/configuration/output/) · webpack.js.org · `chunkFilename` and `assetModuleFilename` defaults, `clean` (5.20+), `globalObject`, `library.type` (`umd`, `commonjs2`, `module`), and `publicPath` (`'auto'` default for web, runtime override with `__webpack_public_path__`) (*read*; a very long page, read in two passes) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Authoring Libraries](https://webpack.js.org/guides/author-libraries/) · webpack.js.org · UMD output with `globalObject: 'this'`, per-target `externals`, `peerDependencies`, `main` versus `module` (*read*) · fetched 2026-10-14
- **Our delta:** which template governs which file kind. Watch one claim: the output docs mark `[hash]` as a deprecated alias of `[fullhash]`, while our pitfall still teaches `[hash]`.

## Section 03 — Module resolution

### T03-01 · The `resolve` object — Topic · ✅ written `docs/webpack/pages/03-module-resolution/01-the-resolve-object.md`
- **Read this:** [Resolve](https://webpack.js.org/configuration/resolve/) · webpack.js.org · `alias` (trailing `$` for exact match, `false` to ignore), `extensions` with `'...'`, `mainFields` defaults (`browser`, `module`, `main` for web; `module`, `main` otherwise), `conditionNames`, `exportsFields`, `fallback` for missing Node polyfills (*read*) · covers our angle: **full** for the options our page lists · fetched 2026-10-14
- **Also good:** [Module Resolution](https://webpack.js.org/concepts/module-resolution/) · webpack.js.org · absolute, relative and module paths; its steps imply `exportsFields` is checked first and `mainFields` only for a folder (*read*); [enhanced-resolve](https://github.com/webpack/enhanced-resolve) · GitHub README · the resolver's option table and its relative versus bare-module pipeline (*read*) · fetched 2026-10-14
- **Our delta:** our page never mentions `exports`, `exportsFields` or `conditionNames`, so a `package.json` `exports` map beating `mainFields` is a gap to fill, not something it already covers.

## Section 04 — Loaders

### T04-01a · Style loader pipeline and extraction — Topic · ✅ written `docs/webpack/pages/04-loaders/01-transpilation-and-style-loaders.md`
- **Read this:** [MiniCssExtractPlugin](https://github.com/webpack/mini-css-extract-plugin) · GitHub README (the webpack.js.org page returned 200 but empty to my reader) · `MiniCssExtractPlugin.loader` before `css-loader`, `style-loader` for dev, `filename`, `chunkFilename`, `insert`; the README now marks the plugin deprecated in favor of native CSS (*read*) · covers our angle: **partial** — the plugin chain is covered, native CSS is not · fetched 2026-10-14
- **Beyond the docs:** [Difference between style-loader and mini-css-extract-plugin](https://maxrozen.com/difference-between-style-loader-mini-css-extract-plugin) · Max Rozen, undated · style-loader injects style tags (fine for dev), the plugin emits one CSS file per JS file that imports CSS; no webpack version stated · fetched 2026-10-14 (*read*)
- **Our delta:** the full chain (sass, postcss, css-loader modules) with the dev/prod switch; the deprecation note and `experiments.css` route are not in our page.

### T04-01b · Babel and TypeScript transpilation — Topic · ✅ written `docs/webpack/pages/04-loaders/01-transpilation-and-style-loaders.md`
- **Read this:** [babel-loader](https://webpack.js.org/loaders/babel-loader/) · webpack.js.org · `cacheDirectory` (default false, "as much as 2x" with no benchmark), `exclude` for `node_modules`, troubleshooting; a third-party package, loader 10 needs webpack 5.61+ (*read*) · covers our angle: **partial** — JS side only · fetched 2026-10-14
- **Also good:** [ts-loader](https://github.com/TypeStrong/ts-loader) · GitHub README · `transpileOnly` speeds builds and loses type checking, so pair it with fork-ts-checker (*read*); [fork-ts-checker-webpack-plugin](https://github.com/TypeStrong/fork-ts-checker-webpack-plugin) · type checking in a separate process; `async` defaults to true in development mode only (*read*) · fetched 2026-10-14
- **Our delta:** the babel-plus-checker split and the dev/CI `async` switch; our "ts-loader blocks the whole compilation" wording is stronger than either README.

### T04-02 · Loader mechanics: pitching and async — Topic · ✅ written `docs/webpack/pages/04-loaders/02-loader-mechanics-pitching-and-async.md`
- **Read this:** [Loader Interface](https://webpack.js.org/api/loaders/) · webpack.js.org · sync and async loaders (`this.async()` or an async function), raw loaders, Pitching Loader (pitch runs left to right, a returned value skips the rest), `this.getOptions(schema)` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Extending with Loaders](https://survivejs.com/webpack/extending/loaders/) · SurviveJS (author and date not shown) · loader-runner debugging, async loaders, pitch loaders, a caching loader that passes data from pitch to the normal phase; no webpack version stated · fetched 2026-10-14 (*read*)
- **Our delta:** the two-pass ordering diagram. The official page says `this.getOptions` substitutes `loader-utils`' version but states no removal; our page does not discuss that migration.
## Section 05 — Asset modules

### T05-01 · Built-in asset types — Topic · ✅ written `docs/webpack/pages/05-asset-modules/01-built-in-asset-types.md`
- **Read this:** [Asset Modules](https://webpack.js.org/guides/asset-modules/) · webpack.js.org · `asset/resource`, `asset/inline`, `asset/source`, `asset/bytes`, `asset`; `parser.dataUrlCondition.maxSize` (8 KB default), `generator.filename`, built-in `?raw`, `?inline`, `?url` suffixes (5.109+, under `experiments.futureDefaults`) (*read*) · covers our angle: **partial** — our page omits `asset/bytes` and the suffixes · fetched 2026-10-14
- **Beyond the docs:** [Webpack 5 Asset Modules](https://dev.to/smelukov/webpack-5-asset-modules-2o3h) · Sergey Melyukov, DEV Community, 2020-02-16 · maps `asset/resource`, `asset/inline`, `asset/source` to file-loader, url-loader, raw-loader; written during the beta, so `experiments: { asset: true }` is obsolete, and it has no suffix coverage · fetched 2026-10-14 (*read*)
- **Our delta:** the font-inlining pitfall and why `file-loader` options do not carry over; there is no full migration table in our page.

## Section 06 — Plugins

### T06-01a · Built-in plugins: DefinePlugin and ProvidePlugin — Topic · ✅ written `docs/webpack/pages/06-plugins/01-essential-plugins.md`
- **Read this:** [DefinePlugin](https://webpack.js.org/plugins/define-plugin/) · webpack.js.org · text replacement, so values need real quotes (`JSON.stringify`), feature flags, `runtimeValue`; it does not say whether `mode` sets `NODE_ENV` (*read*) · covers our angle: **full** for DefinePlugin · fetched 2026-10-14
- **Also good:** [ProvidePlugin](https://webpack.js.org/plugins/provide-plugin/) · webpack.js.org · identifier to module, array form for named exports, `default` for ES2015 default exports; the page gives no advice on sparing use (*read*); [Plugins](https://webpack.js.org/concepts/plugins/) · plugin anatomy, and prose warning that emitting from the `emit` hook skips optimization (*read*) · fetched 2026-10-14
- **Our delta:** the secrets-in-bundle pitfall; BannerPlugin has no fetched source.

### T06-01b · Third-party plugins: Html, MiniCss, Copy — Topic · ✅ written `docs/webpack/pages/06-plugins/01-essential-plugins.md`
- **Read this:** [html-webpack-plugin](https://github.com/jantimon/html-webpack-plugin) · GitHub README · `template`, `filename`, `inject`, `chunks`, `minify` (default on only in production); independent project; README marks it deprecated for webpack's native HTML (*read*) · covers our angle: **full** for options, **missing** the deprecation · fetched 2026-10-14
- **Also good:** [copy-webpack-plugin](https://github.com/webpack/copy-webpack-plugin) · GitHub README · `patterns` with `from`, `to`, `globOptions.ignore`, `noErrorOnMissing`; archived, and webpack 5.111+ copies natively through `output.copy` (*read*); MiniCssExtractPlugin is covered in T04-01a · fetched 2026-10-14
- **Our delta:** which plugins are built in and which are separate packages. The webpack.js.org pages for these three rendered empty to my reader, so the READMEs stand in; the HtmlWebpackPlugin injection-order pitfall has no source fetched.

## Section 07 — Code splitting

### T07-01a · Dynamic imports, prefetch and preload — Topic · ✅ written `docs/webpack/pages/07-code-splitting/01-splitting-strategies.md`
- **Read this:** [Code Splitting](https://webpack.js.org/guides/code-splitting/) · webpack.js.org · entry points, `dependOn` and SplitChunks, dynamic `import()`, prefetch versus preload, `ChunkLoadError` tips, `webpackExports`; no `webpackChunkName` (*read*) · covers our angle: **full** for prefetch and preload · fetched 2026-10-14
- **Our delta:** the lazy-loaded heavy editor scenario with `React.lazy`; chunk naming via magic comments comes from the API pages, not this guide.

### T07-01b · splitChunks and the runtime chunk — Topic · ✅ written `docs/webpack/pages/07-code-splitting/01-splitting-strategies.md`
- **Read this:** [SplitChunksPlugin](https://webpack.js.org/plugins/split-chunks-plugin/) · webpack.js.org · production defaults (`chunks: async`, `minSize` 20000, `maxAsyncRequests` 30, `maxInitialRequests` 30), `defaultVendors` and `default` cache groups, `priority`; says nothing of `runtimeChunk` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Bundle Splitting](https://survivejs.com/webpack/building/bundle-splitting/) · SurviveJS, undated, sample output from webpack 5.5.0 · vendor bundle, `chunks: all`, `cacheGroups`; and [Separating a Runtime](https://survivejs.com/webpack/optimizing/separating-runtime/) · why the runtime manifest invalidates other bundles, `runtimeChunk: { name: 'runtime' }` · fetched 2026-10-14 (*read*)
- **Our delta:** the `reactVendor` cache-group trade-off and the many-tiny-chunks pitfall; the production-default `minSize` is the docs' number.

## Section 08 — Optimization

### T08-01a · Tree shaking and sideEffects — Topic · ✅ written `docs/webpack/pages/08-optimization/01-production-optimizations.md`
- **Read this:** [Tree Shaking](https://webpack.js.org/guides/tree-shaking/) · webpack.js.org · `sideEffects` (array of globs) versus `usedExports`, `/*#__PURE__*/`, the CSS-dropped-by-`sideEffects: false` example, four common pitfalls (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Tree-Shaking: A Reference Guide](https://www.smashingmagazine.com/2021/05/tree-shaking-reference-guide) · Atila Fassina, Smashing Magazine, 2021-05-14 · ES modules versus CommonJS, side effects, scope hoisting, a checklist; no single webpack version targeted · fetched 2026-10-14 (*read*)
- **Our delta:** the barrel-import scenario with `huge-ui-library`; the docs add `/*#__NO_SIDE_EFFECTS__*/` (5.107+), which our page lacks.

### T08-01b · Minification, scope hoisting and module ids — Topic · ✅ written `docs/webpack/pages/08-optimization/01-production-optimizations.md`
- **Read this:** [Optimization](https://webpack.js.org/configuration/optimization/) · webpack.js.org · production defaults for `moduleIds` (deterministic), `concatenateModules`, `usedExports`, `minimize`, and the `'...'` minimizer shorthand (*read*) · covers our angle: **full** for the options · fetched 2026-10-14
- **Also good:** [ModuleConcatenationPlugin](https://webpack.js.org/plugins/module-concatenation-plugin/) · webpack.js.org · scope hoisting, bailouts (non-ES modules, `eval`, `module.hot`), `stats.optimizationBailout` (*read*) · fetched 2026-10-14
- **Our delta:** Terser's `drop_console` pitfall (the Terser plugin page did not render, so Terser options are unsourced). Our page frames `moduleIds: 'deterministic'` as an opt-in; the docs make it the production default.

## Section 09 — Dev server and HMR

### T09-01a · Dev server: proxy and history fallback — Topic · ✅ written `docs/webpack/pages/09-dev-server-and-hmr/01-dev-server-and-hot-module-replacement.md`
- **Read this:** [devServer](https://webpack.js.org/configuration/dev-server/) · webpack.js.org · `hot` (true, `'only'`, false; default true since v4), array-form `proxy` with `context`, `historyApiFallback`, `static`, `client.overlay`; scope is dev-server v5 with some v6 text (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** the proxy and history-fallback recipes plus the `ws: true` and masked-404 pitfalls; our proxy array matches the v5 form.

### T09-01b · Hot module replacement and accept boundaries — Topic · ✅ written `docs/webpack/pages/09-dev-server-and-hmr/01-dev-server-and-hot-module-replacement.md`
- **Read this:** [Hot Module Replacement](https://webpack.js.org/concepts/hot-module-replacement/) · webpack.js.org · how it works in the app, compiler, module and runtime; update bubbling through `top.js`, `middle.js`, `leaf.js`; no `module.hot.accept` code sample (*read*) · covers our angle: **partial** — little on the server · fetched 2026-10-14
- **Beyond the docs:** [Deep dive into HMR with webpack, part two](https://blog.nativescript.org/deep-dive-into-hot-module-replacement-with-webpack-part-two-handling-updates/) · Stanimira Vlaeva, NativeScript blog, 2019-02-12 · hand-written `module.hot.accept` and `dispose`, self-accepted versus parent-accepted; no webpack version stated · fetched 2026-10-14 (*read*)
- **Our delta:** React Fast Refresh versus a manual accept boundary; React Refresh itself has no fetched source.

## Section 10 — Caching strategies

### T10-01a · Content hashes and runtime chunk — Topic · ✅ written `docs/webpack/pages/10-caching-strategies/01-long-term-caching.md`
- **Read this:** [Caching](https://webpack.js.org/guides/caching/) · webpack.js.org · `[contenthash]`, `runtimeChunk: 'single'`, `moduleIds: 'deterministic'` (already the production default), vendor cache group, deploy-time `ChunkLoadError`; one sample still prints webpack 4.12.0 output (*read*) · covers our angle: **partial** — browser caching only · fetched 2026-10-14
- **Beyond the docs:** [Adding hashes to filenames](https://survivejs.com/webpack/optimizing/adding-hashes-to-filenames/) · SurviveJS, undated, sample output from webpack 5.5.0 · hashes in `output.filename`, `chunkFilename`, `assetModuleFilename` and MiniCssExtractPlugin · fetched 2026-10-14 (*read*)
- **Our delta:** the hash-flavor comparison. Our page uses `[hash]`, which the output docs call a deprecated alias of `[fullhash]`; this guide never mentions it. There is no CDN invalidation checklist in the page.

### T10-01b · Persistent filesystem build cache — Topic · ✅ written `docs/webpack/pages/10-caching-strategies/01-long-term-caching.md`
- **Read this:** [Cache](https://webpack.js.org/configuration/cache/) · webpack.js.org · `type: 'filesystem'`, `cacheDirectory`, `buildDependencies` (recommend `config: [__filename]`), `version`, `compression` (`'zstd'` needs 5.109+ and Node 22.15+), CI sharing needs the same absolute path, GitHub Actions setup (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** the lockfile-keyed `actions/cache` step and the stale-transform pitfall; the docs add `compression`, `maxAge` and `readonly`, which our page lacks.

## Section 11 — Module Federation

### T11-01 · Fundamentals: remotes and exposes — Topic · ✅ written `docs/webpack/pages/11-module-federation/01-fundamentals-remotes-and-exposes.md`
- **Read this:** [Module Federation](https://webpack.js.org/concepts/module-federation/) · webpack.js.org · local versus remote modules, container with `get` and `init`, share scopes, use cases, and troubleshooting including the `bootstrap.js` async boundary for "Shared module is not available for eager consumption" (*read*) · covers our angle: **full** for concepts · fetched 2026-10-14
- **Also good:** [ModuleFederationPlugin](https://webpack.js.org/plugins/module-federation-plugin/) · webpack.js.org · `name`, `filename`, `remotes` (`name@url`), `remoteType`, `exposes` (string or object), `shared` (*read*); [Webpack integration](https://module-federation.io/integrations/bundler/webpack) · module-federation.io · `@module-federation/enhanced/webpack` plugin and `module-federation.config.js` quick start; a partial page with unrendered placeholders (*read*) · fetched 2026-10-14
- **Our delta:** a host and remote config pair. Our page lacks the `bootstrap.js` pattern, and its claim that a static import "forces eager resolution" is not what the docs say (they tie the eager error to shared modules in the entry chunk).

### T11-02 · Shared dependencies and version negotiation — Topic · ✅ written `docs/webpack/pages/11-module-federation/02-shared-dependencies-and-version-negotiation.md`
- **Read this:** [shared](https://module-federation.io/configure/shared) · module-federation.io · `singleton` (higher version wins, lower side warned), `requiredVersion`, `eager`, `shareScope`, prefix matching with a trailing slash; does not document `strictVersion` (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [ModuleFederationPlugin: sharing hints](https://webpack.js.org/plugins/module-federation-plugin/) · webpack.js.org · all hints, and `strictVersion` defaults to true when a local fallback exists and the module is not a singleton (*read*); [Runtime troubleshooting](https://module-federation.io/guide/troubleshooting/runtime) · RUNTIME-005, 006, 012 and 015 for shared failures, duplicate React shows "Invalid hook call" (*read*) · fetched 2026-10-14
- **Our delta:** a decision table for which hint to set when. Our page calls `strictVersion: false` the default, which contradicts that webpack.js.org default; check it.

### T11-03 · Dynamic remotes and runtime loading — Topic · ✅ written `docs/webpack/pages/11-module-federation/03-dynamic-remotes-and-runtime-loading.md`
- **Read this:** [Runtime API](https://module-federation.io/guide/runtime/runtime-api) · module-federation.io · `createInstance`, `registerRemotes`, `loadRemote`, `registerShared`, `preloadRemote`; only `init` is flagged "use with caution" (*read*) · covers our angle: **partial** — we name `loadRemote` but show the hand-rolled loader · fetched 2026-10-14
- **Also good:** [Module Federation: Dynamic Remote Containers](https://webpack.js.org/concepts/module-federation/) · webpack.js.org · who loads the container, promise-based remotes (`promise new Promise(...)`), dynamic public path (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Dynamic remotes in webpack module federation](https://h3manth.com/scribe/dynamic-remotes-webpack-module-federation/) · Hemanth HM, 2021-06-06 · `__webpack_init_sharing__`, `container.init`, `container.get`; the script-injection step is described but not in the code; no webpack version stated · fetched 2026-10-14 (*read*)
- **Our delta:** the per-tenant React example. Promise-based remotes, the webpack-native route, are not in our page.

### T11-04 · Architecture patterns and topologies — Topic · ✅ written `docs/webpack/pages/11-module-federation/04-architecture-patterns-and-topologies.md`
- **Read this:** [Module Federation: use cases](https://webpack.js.org/concepts/module-federation/) · webpack.js.org · separate builds per page, component library as container (*read*) · covers our angle: **partial** — no topology guidance · fetched 2026-10-14
- **Beyond the docs:** [Module Federation and federated application architectures](https://rangle.io/blog/module-federation-federated-application-architectures) · Michael Mrowetz, Rangle, 2020-06-29 · host, remote and bi-directional host; design system, multi-SPA, shell-driven and multi-shell patterns · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Micro frontends with Webpack Module Federation](https://techblog.telia.no/blog/micro-frontends-with-webpack-module-federation) · Helene Grini, Telia, 2021-03-22 · bi-directional remotes, singleton React, doubt that `main` scales as a shared library (the page never calls it an app shell) · fetched 2026-10-14 (*read*)
- **Our delta:** four topologies plus a server-composition contrast; the blast-radius point is made only for the bidirectional case.

### T11-05 · Production ops and troubleshooting — Topic · ✅ written `docs/webpack/pages/11-module-federation/05-production-ops-and-troubleshooting.md`
- **Read this:** [Runtime troubleshooting](https://module-federation.io/guide/troubleshooting/runtime) · module-federation.io · 14 error codes RUNTIME-001 to 015 (no 011) with causes and fixes (*read*) · covers our angle: **partial** — our page names no error codes · fetched 2026-10-14
- **Also good:** [Error handling for remote module rendering](https://module-federation.io/blog/error-load-remote) · module-federation.io · retry plugin, `errorLoadRemote` hook, error boundary; undated (*read*); [Manifest and Snapshot](https://module-federation.io/guide/basic/manifest-snapshot.html) · `mf-manifest.json`, `mf-stats.json`, snapshot preload, `disableSnapshot` trade-off (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Error boundaries and federation](https://stevekinney.com/courses/enterprise-ui/error-boundaries-and-federation) · Steve Kinney, course page, modified 2026-09-14 · a down remote fails before React mounts, so no boundary exists to catch it (*read*) · fetched 2026-10-14
- **Our delta:** `remoteEntry.js` cache headers, an error boundary and a circuit breaker; the page has no rollout runbook and not the manifest or retry plugin.

## Section 12 — Source maps

### T12-01 · The `devtool` options — Topic · ✅ written `docs/webpack/pages/12-source-maps/01-devtool-options.md`
- **Read this:** [Devtool](https://webpack.js.org/configuration/devtool/) · webpack.js.org · development picks (`eval`, `eval-source-map`, `eval-cheap-module-source-map`), production (`false`, `source-map`, `nosources-source-map`), `hidden-source-map` for error reporting, array form (5.105+); no error-tracker upload (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Source maps](https://survivejs.com/webpack/building/source-maps/) · SurviveJS, undated, mentions "webpack 4 or newer" · inline versus separate maps and a quality-versus-speed walk-through; uses pre-5 names like `cheap-eval-source-map` · fetched 2026-10-14 (*read*)
- **Our delta:** uploading maps to an error tracker then deleting them before deploy; the docs only warn not to deploy hidden maps.

## Section 13 — Multi-config and environment

### T13-01a · webpack-merge and the env function — Topic · ✅ written `docs/webpack/pages/13-multi-config-and-environment/01-config-composition.md`
- **Read this:** [Configuration Types](https://webpack.js.org/configuration/configuration-types/) · webpack.js.org · function export with `env` and `argv`, promise export (CLI only), no mention of webpack-merge (*read*) · covers our angle: **full** for the function form · fetched 2026-10-14
- **Also good:** [webpack-merge](https://github.com/survivejs/webpack-merge) · GitHub README · `merge` concatenates arrays and rightmost wins, `mergeWithRules`, `mergeWithCustomize`, no promises (*read*); [Production](https://webpack.js.org/guides/production/) · common, dev and prod files merged, `mode` configures `NODE_ENV` via DefinePlugin (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Composing configuration](https://survivejs.com/webpack/developing/composing-configuration/) · SurviveJS, undated · `webpack.parts.js` composed with `merge`; it says `mode` does not set `NODE_ENV` inside the config file, so it contradicts the Production guide's wording · fetched 2026-10-14 (*read*)
- **Our delta:** the `mergeWithRules` fix for duplicated plugins is only named in our pitfall, and `--env` versus `--mode` is shown but not contrasted.

### T13-01b · Multi-compiler array builds — Topic · ✅ written `docs/webpack/pages/13-multi-config-and-environment/01-config-composition.md`
- **Read this:** [Configuration Types: multiple configurations](https://webpack.js.org/configuration/configuration-types/) · webpack.js.org · array of configs, `dependencies` by `name`, `parallelism` (5.22+), `--config-name` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** a client plus Node server SSR pair with `webpack-node-externals`; our "runs sequentially unless parallelism" claim is unsourced: the docs describe `parallelism` as a limit on concurrent compilers and say nothing about a sequential default.

## Section 14 — Performance analysis

### T14-01 · Diagnostics and bundle analysis — Topic · ✅ written `docs/webpack/pages/14-performance-analysis/01-diagnostics-and-bundle-analysis.md`
- **Read this:** [Performance](https://webpack.js.org/configuration/performance/) · webpack.js.org · `hints` (warning by default in production), `maxAssetSize` and `maxEntrypointSize` (250000 bytes), `assetFilter`, opt-in checks from 5.110 such as `duplicatePackages` (*read*) · covers our angle: **full** for budgets; the page is newer than our baseline · fetched 2026-10-14
- **Also good:** [webpack-bundle-analyzer](https://github.com/webpack/webpack-bundle-analyzer) · GitHub README · `webpack --profile --json > stats.json` then the CLI, or the plugin with `generateStatsFile`; `stat`, `parsed`, `gzip`, `brotli` sizes (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Build analysis](https://survivejs.com/webpack/optimizing/build-analysis/) · SurviveJS, undated · tools grouped by purpose: dependency, composition, comparison, duplicates, why a module is included · fetched 2026-10-14 (*read*)
- **Our delta:** a `stats.toJson` CI gate and the compressed-size pitfall; the new built-in `performance` checks replace some of what the page does by hand.

## Section 15 — Advanced custom tooling

### T15-01a · Writing a custom loader — Topic · ✅ written `docs/webpack/pages/15-advanced-custom-tooling/01-custom-loaders-and-plugins.md`
- **Read this:** [Writing a Loader](https://webpack.js.org/contribute/writing-a-loader/) · webpack.js.org · local testing, chaining, guidelines (stateless, `this.addDependency`, no absolute paths, peer dependencies), a Jest plus `memfs` test (*read*) · covers our angle: **partial** — our page has `this.callback` and source maps, not these guidelines · fetched 2026-10-14
- **Also good:** [Loader Interface](https://webpack.js.org/api/loaders/) · the loader context API, including `this.getOptions(schema)` (*read*); [Extending with Loaders](https://survivejs.com/webpack/extending/loaders/) · SurviveJS, undated · loader-runner debugging (*read*) · fetched 2026-10-14
- **Our delta:** the source-map-forwarding pitfall for `this.callback`; neither source covers it as a named pitfall.

### T15-01b · Writing a custom plugin — Topic · ✅ written `docs/webpack/pages/15-advanced-custom-tooling/01-custom-loaders-and-plugins.md`
- **Read this:** [Writing a Plugin](https://webpack.js.org/contribute/writing-a-plugin/) · webpack.js.org · compiler versus compilation, `tapAsync` and `tapPromise`, `compilation.emitAsset`, `processAssets` stages, watch `modifiedFiles`, cacheable classes; options validation changed at 5.106; it has a Testing section (*read*) · covers our angle: **full** for concepts · fetched 2026-10-14
- **Our delta:** our manifest plugin assigns `compilation.assets[...]` inside `compiler.hooks.emit` and cites `optimizeChunkAssets`; the official guide adds assets with `emitAsset` and `processAssets`. I did not verify that the older forms are deprecated, only that the guide does not use them. We have no end-to-end plugin test.

## Section 16 — Real-world workflows and recipes

### T16-01 · Diagnosing a bloated bundle — Topic · ✅ written `docs/webpack/pages/16-real-world-workflows-and-recipes/01-diagnosing-a-bloated-bundle.md`
- **Read this:** [Setting performance budgets with webpack](https://web.dev/articles/codelab-setting-performance-budgets-with-webpack) · web.dev codelab, last updated 2019-01-31 · measure a 323 KiB bundle, budget at 100000 bytes, drop moment.js, reach 97.7 KiB, monitor; webpack version unstated and the era is webpack 4 · covers our angle: **partial** — one cause only (*read*) · fetched 2026-10-14
- **Also good:** [Tree Shaking](https://webpack.js.org/guides/tree-shaking/) · the `sideEffects` pitfalls for libraries (*read*); [Performance](https://webpack.js.org/configuration/performance/) · `duplicatePackages` and `unsplitVendors` checks (*read*) · fetched 2026-10-14
- **Beyond the docs:** [A dirty webpack trick that reduced our gzipped bundle size by 55kb](https://swizec.com/blog/a-dirty-webpack-trick-that-reduced-our-gzipped-bundle-size-by-55kb/) · Swizec Teller, 2017-06-15 · `IgnorePlugin` for Moment locales, Lodash replaced by modular packages; webpack 2, the author says it "might be brittle" · fetched 2026-10-14 (*read*)
- **Our delta:** the treemap-to-cause table and the five-step order (analyze, deduplicate, `sideEffects`, trace transitive, narrow browserslist) plus a CI guard; the page has no split step.
