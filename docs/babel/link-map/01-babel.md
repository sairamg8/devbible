---
title: "Link map · Babel · Part 1 (all sections)"
sidebar_label: "01 · babel"
sidebar_position: 1
---

# Link map · Babel · Part 1 (all sections)

Covers every topic page of the Babel track, sections 01 to 16 (`docs/babel/pages/`). This track has no syllabus, so topics come from our page tree: one topic per numbered page, split into several blocks (IDs such as T04-01a) where one page covers distinct sub-topics. All 16 pages are written.
*read* = I read the passage that supports the claim in the fetched text; *headings only* = fetched at 200, headings or opening checked. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line.

🔴 **Version note.** Our pages say `> Verified: 2026-09-06` against **Babel 8.0.1**. The babeljs.io pages fetched on 2026-10-14 already document Babel 8 (for example `useBuiltIns` and `corejs` on transform-runtime marked removed), so they match. The babel-loader README and the Plugin Handbook are written for Babel 7 and older, and the Jest and Next.js picks assume Babel 7 era defaults. Each such pick is flagged in its block.

---

## Section 01 — Why Babel and the compiler landscape

### T01-01 · What Babel is and when it still matters — Topic · ✅ written `docs/babel/pages/01-why-babel-and-the-compiler-landscape/01-what-babel-is-and-when-it-matters.md`
- **Read this:** [What is Babel?](https://babeljs.io/docs/) · babeljs.io · the one-page definition: a compiler for ES2015 and later, JSX, Flow and TypeScript, pluggable and spec compliant (*read*) · covers our angle: **partial** — no comparison with SWC, esbuild or tsc · fetched 2026-10-14
- **Also good:** [Migrating from Babel](https://swc.rs/docs/migrating-from-babel) · swc.rs · SWC states it targets drop-in CLI replacement and covers stage 3 proposals and preset-env transforms (*read*) · fetched 2026-10-14
- **Also good:** [Oxc transformer](https://oxc.rs/docs/guide/usage/transformer) · oxc.rs · the transform order: TypeScript strip, JSX, then lowering ES2026 down to ES2015; makes no Babel compatibility claim (*read*) · fetched 2026-10-14
- **Our delta:** the decision table (when Babel is still the right tool in 2026) and the "we always had it" anti-pattern.

## Section 02 — Core compilation pipeline

### T02-01 · Parse, transform, generate and the programmatic API — Topic · ✅ written `docs/babel/pages/02-core-compilation-pipeline/01-parse-transform-generate-and-api.md`
- **Read this:** [@babel/core](https://babeljs.io/docs/babel-core) · babeljs.io · `transformSync` and `transformAsync` returning code, map and ast; `parse*`; `loadPartialConfig` for resolving config without transforming; says the callback-less `transform` is removed in Babel 8 (*read*) · covers our angle: **partial** — API reference, not the three-stage model · fetched 2026-10-14
- **Also good:** [@babel/parser](https://babeljs.io/docs/babel-parser) · babeljs.io · the `plugins` option (first options win when repeated) and `errorRecovery` with an `errors` array (*read*) · fetched 2026-10-14
- **Also good:** [@babel/traverse](https://babeljs.io/docs/babel-traverse) · babeljs.io · a very short page: install and two visitor examples; no scope coverage (*read*) · fetched 2026-10-14
- **Our delta:** why `filename` matters for config lookup, and the path versus node mutation rules.

## Section 03 — Configuration system

### T03-01 · Config files, root, env and overrides — Topic · ✅ written `docs/babel/pages/03-configuration-system/01-config-files-root-env-overrides.md`
- **Read this:** [Config Files](https://babeljs.io/docs/config-files) · babeljs.io · project-wide `babel.config.json` versus file-relative `.babelrc.json`, the stop at `package.json`, `api.env`/`api.cache` and the monorepo section (*read*) · covers our angle: **full** for file forms and root; `overrides` gets a single sentence · fetched 2026-10-14
- **Also good:** [Options](https://babeljs.io/docs/options) · babeljs.io · `overrides` and `env` merge rules (no nesting), `babelrcRoots`, `root`/`rootMode` values `root`, `upward`, `upward-optional`, and `caller` (*read*) · fetched 2026-10-14
- **Our delta:** the NODE_ENV=production-in-tests trap and the `.babelrc` fighting `babel.config.js` pitfall.

## Section 04 — Presets

### T04-01a · `@babel/preset-env`: targets, polyfills and the Babel 8 boundary — Topic · ✅ written `docs/babel/pages/04-presets/01-env-react-typescript-and-framework.md`
- **Read this:** [@babel/preset-env](https://babeljs.io/docs/babel-preset-env) · babeljs.io · `targets`, browserslist integration, `modules`, and `useBuiltIns`/`corejs` (marked removed in Babel 8, use `babel-plugin-polyfill-corejs3`) (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Babel 8 migration](https://babeljs.io/docs/v8-migration) · babeljs.io · default targets become browserslist `defaults`; `loose` and `spec` removed in favor of `assumptions`; `modules: "auto"` assumes ESM; Node `^22.18.0 || >=24.11.0` (*read*) · fetched 2026-10-14
- **Also good:** [Usage Guide](https://babeljs.io/docs/usage) · babeljs.io · `@babel/polyfill` deprecated since 7.4.0, `core-js/stable`, `usage` versus `entry` (*read*) · fetched 2026-10-14
- **Our delta:** which options moved where in Babel 8 and why polyfills belong in app code, not libraries.

### T04-01b · `@babel/preset-react`, `@babel/preset-typescript` and framework bundles — Topic · ✅ written `docs/babel/pages/04-presets/01b-react-typescript-and-framework-presets.md`
- **Read this:** [@babel/preset-react](https://babeljs.io/docs/babel-preset-react) · babeljs.io · automatic runtime (`importSource`, `development`) versus classic (`pragma`, `pragmaFrag`) (*read*) · covers our angle: **partial** — nothing on framework presets · fetched 2026-10-14
- **Also good:** [@babel/preset-typescript](https://babeljs.io/docs/babel-preset-typescript) · babeljs.io · `allowNamespaces`, `optimizeConstEnums`, `onlyRemoveTypeImports` (default true in v8) (*read*) · fetched 2026-10-14
- **Also good:** [How to configure Babel in Next.js](https://nextjs.org/docs/pages/guides/babel) · nextjs.org, Pages Router guide, lastUpdated 2025-04-24 · `next/babel` preset and customizing its sub-options; Pages Router page, check against the 16.x App Router docs (*read*) · fetched 2026-10-14
- **Our delta:** the "succeeds with type errors" trap and why a custom Babel config in Next changes the compiler.

## Section 05 — Plugin ecosystem

### T05-01a · Syntax versus transform plugins, ordering and stage proposals — Topic · ✅ written `docs/babel/pages/05-plugin-ecosystem/01-syntax-transform-stage-macros.md`
- **Read this:** [Plugins](https://babeljs.io/docs/plugins) · babeljs.io · transform versus syntax plugins; plugins run before presets, first to last; presets last to first (*read*) · covers our angle: **partial** — nothing on stage proposals · fetched 2026-10-14
- **Also good:** [Presets](https://babeljs.io/docs/presets) · babeljs.io · the official preset list, stage-X presets, "Preset Ordering" reversed (*read*) · fetched 2026-10-14
- **Our delta:** the stage-2-syntax-in-shared-packages risk and duplicate Emotion/styled-components plugins.

### T05-01b · Macros with `babel-plugin-macros` — Topic · ✅ written `docs/babel/pages/05-plugin-ecosystem/01-syntax-transform-stage-macros.md`
- **Read this:** [babel-plugin-macros](https://github.com/kentcdodds/babel-plugin-macros) · GitHub README (Kent C. Dodds) · the problem (per-library plugin config) and the single standard interface; explicit imports that run at compile time (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** documenting the Babel requirement when a library ships a macro.

## Section 06 — Authoring custom plugins

### T06-01 · Visitors, paths, types and testing — Topic · ✅ written `docs/babel/pages/06-authoring-custom-plugins/01-visitors-paths-types-and-testing.md`
- **Read this:** [@babel/types](https://babeljs.io/docs/babel-types) · babeljs.io · each node type's builder, `is`/`assert` helpers, property types and aliases (first 100000 chars *read*; the rest not read) · covers our angle: **partial** — builders only · fetched 2026-10-14
- **Also good:** [@babel/traverse](https://babeljs.io/docs/babel-traverse) · babeljs.io · minimal visitor and `path.isIdentifier` example (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Babel Plugin Handbook](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md) · Jamie Kyle, GitHub · the long-form explanation of visitors, paths, scope (binding, UID, rename), manipulation, and testing with snapshot, AST and exec tests plus babel-plugin-tester; mixes Babel 6 and 7 names, so check API names against the docs · fetched 2026-10-14 (*read*)
- **Our delta:** the missing `loc`/`raw` fields trap and removing still-referenced declarations.

## Section 07 — TypeScript and JSX handling

### T07-01 · Type stripping, unsupported features and the JSX runtime — Topic · ✅ written `docs/babel/pages/07-typescript-and-jsx-handling/01-type-stripping-unsupported-and-jsx-runtime.md`
- **Read this:** [@babel/plugin-transform-typescript](https://babeljs.io/docs/babel-plugin-transform-typescript) · babeljs.io · caveats: no type-checking, tsconfig ignored (behaves as isolatedModules), no exported `var`/`let`, and the namespace limits (*read*) · covers our angle: **full** for the TypeScript half · fetched 2026-10-14
- **Also good:** [Introducing the New JSX Transform](https://legacy.reactjs.org/blog/2020/09/22/introducing-the-new-jsx-transform.html) · React blog, 2020-09-22 · what changes, Babel 7.9.0+, `runtime: "automatic"`; says Babel 8 makes it the default (*read*) · fetched 2026-10-14
- **Also good:** [isolatedModules](https://www.typescriptlang.org/tsconfig/isolatedModules.html) · typescriptlang.org · why single-file transpilers break on type re-exports, namespaces in scripts and const enum members (*read*) · fetched 2026-10-14
- **Our delta:** `jsx: react-jsx` in tsconfig versus a classic Babel runtime, and const enums crossing package boundaries.

## Section 08 — Build tool integration

### T08-01a · Webpack and Rollup: `babel-loader` and `@rollup/plugin-babel` — Topic · ✅ written `docs/babel/pages/08-build-tool-integration/01-webpack-vite-jest-rollup.md`
- **Read this:** [babel-loader](https://github.com/babel/babel-loader) · GitHub README · options (`cacheDirectory`, `cacheCompression`), exclude `node_modules`, transform-runtime for helper bloat; written for Babel 7 (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [@rollup/plugin-babel](https://github.com/rollup/plugins/tree/master/packages/babel) · GitHub README · `babelHelpers` modes `bundled`, `runtime`, `inline`, `external` and when to use each (*read*) · fetched 2026-10-14
- **Also good:** [babel-loader on webpack.js.org](https://webpack.js.org/loaders/babel-loader) · webpack.js.org · short mirror of the README, notes the loader is community maintained and supports Rspack (*read*) · fetched 2026-10-14
- **Our delta:** one shared Babel config across webpack and Jest, and mismatched source maps.

### T08-01b · Vite and Jest: the Babel paths — Topic · ✅ written `docs/babel/pages/08-build-tool-integration/01-webpack-vite-jest-rollup.md`
- **Read this:** [Getting Started: Using Babel](https://jestjs.io/docs/getting-started) · jestjs.io · `babel-jest` runs automatically when a Babel config exists, `targets: {node: 'current'}`, `api.env('test')`, and the "Jest does not type-check" warning (*read*) · covers our angle: **full** for Jest · fetched 2026-10-14
- **Also good:** [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react) · GitHub README · current README documents Babel only for the React Compiler preset via `@rolldown/plugin-babel`, so our page's "plugin-react Babel path" wording should be re-checked (*read*) · covers our angle: **partial** — version drift flagged · fetched 2026-10-14
- **Our delta:** why forcing Vite onto the Babel path costs speed for no gain.

## Section 09 — Linter and type-checker interop

### T09-01 · `@babel/eslint-parser` and `tsc` — Topic · ✅ written `docs/babel/pages/09-linter-and-type-checker-interop/01-babel-eslint-parser-and-tsc.md`
- **Read this:** [@babel/eslint-parser](https://babeljs.io/docs/babel-eslint-parser) · babeljs.io · when to use it, `requireConfigFile`, `babelOptions`, limits (core rules, no TypeScript linting with Babel's plugin, needs `@babel/core` 7.2.0+) (*read*) · covers our angle: **full** for the parser · fetched 2026-10-14
- **Also good:** [@babel/plugin-transform-typescript](https://babeljs.io/docs/babel-plugin-transform-typescript) · babeljs.io · "Babel doesn't check types", so `tsc` stays in CI (*read*) · fetched 2026-10-14
- **Our delta:** type-aware lint rules do not come from Babel's AST, and the CI that only runs build.

## Section 10 — Source maps and debugging

### T10-01 · Source maps and inspecting output — Topic · ✅ written `docs/babel/pages/10-source-maps-and-debugging/01-maps-and-inspecting-output.md`
- **Read this:** [Options: source map options](https://babeljs.io/docs/options) · babeljs.io · `sourceMaps` (`true`, `"inline"`, `"both"`) and `inputSourceMap` default true (*read*) · covers our angle: **partial** — flags only · fetched 2026-10-14
- **Also good:** [What are source maps?](https://web.dev/articles/source-maps) · web.dev, last updated 2023-03-31 · the `mappings` VLQ field, extensions, and drawbacks such as optimized-away variables (*read*) · fetched 2026-10-14
- **Our delta:** inline maps in production bundles and wrong `sources` paths under monorepo roots.

## Section 11 — Performance and caching

### T11-01 · Compilation cost, caching and reducing surface — Topic · ✅ written `docs/babel/pages/11-performance-and-caching/01-cost-caching-and-surface-reduction.md`
- **Read this:** [babel-loader: Troubleshooting](https://github.com/babel/babel-loader) · GitHub README · "babel-loader is slow!": transform fewer files, exclude `node_modules`, `cacheDirectory` (README says up to 2x) (*read*) · covers our angle: **partial** — webpack only · fetched 2026-10-14
- **Also good:** [Config Files: api.cache](https://babeljs.io/docs/config-files) · babeljs.io · config function caching via `api.cache` and `api.env`; do not mix `api.env` with `forever()`/`never()` (*read*) · fetched 2026-10-14
- **Also good:** [@babel/register](https://babeljs.io/docs/babel-register) · babeljs.io · JSON cache in the temp dir, `BABEL_CACHE_PATH`, `BABEL_DISABLE_CACHE` (*read*) · fetched 2026-10-14
- **Our delta:** key the cache on `babel.config.js`, and shrink browserslist instead of micro-tuning.

## Section 12 — Monorepo and multi-package strategies

### T12-01 · Shared root config and cross-package compilation — Topic · ✅ written `docs/babel/pages/12-monorepo-and-multi-package-strategies/01-shared-root-and-cross-package.md`
- **Read this:** [Config Files: Monorepos](https://babeljs.io/docs/config-files) · babeljs.io · root `babel.config.json` first, then subpackage `.babelrc.json`, with `babelrcRoots`; `rootMode: "upward"` when running from a subpackage (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Options: rootMode and babelrcRoots](https://babeljs.io/docs/options) · babeljs.io · exact semantics of `root`, `rootMode`, `babelrcRoots` (*read*) · fetched 2026-10-14
- **Our delta:** contradictory per-package targets and publishing TypeScript source without telling consumers.

## Section 13 — CLI and programmatic tooling

### T13-01 · `@babel/cli` and codemods on Babel's parser — Topic · ✅ written `docs/babel/pages/13-cli-and-programmatic-tooling/01-cli-and-codemods.md`
- **Read this:** [@babel/cli](https://babeljs.io/docs/babel-cli) · babeljs.io · `--out-dir`, `--watch`, `--ignore`, `--copy-files`, `--extensions`, `--source-maps` (*read*) · covers our angle: **full** for the CLI half · fetched 2026-10-14
- **Also good:** [jscodeshift](https://github.com/facebook/jscodeshift) · GitHub README · `--parser` babel/babylon/flow/ts/tsx (default babel), `--dry`, `--print`, transform shape, `testUtils` (*read*) · covers our angle: **full** for codemods · fetched 2026-10-14
- **Our delta:** CLI is not a type checker or formatter; parse TS with the right parser option.

## Section 14 — Node.js and backend usage

### T14-01 · `@babel/register` and ESM/CJS for backends — Topic · ✅ written `docs/babel/pages/14-nodejs-backend-usage/01-register-and-esm-cjs.md`
- **Read this:** [@babel/register](https://babeljs.io/docs/babel-register) · babeljs.io · ignores `node_modules` by default, `only`/`ignore`, does not compile native ESM on the fly (*read*) · covers our angle: **partial** — no ESM/CJS half · fetched 2026-10-14
- **Also good:** [Node.js Packages](https://nodejs.org/api/packages.html) · nodejs.org · `type`, `.mjs`/`.cjs`, conditional exports (`import`, `require`, `module-sync`); the dual-package section only links to an examples repo (*read*) · fetched 2026-10-14
- **Also good:** [@babel/node](https://babeljs.io/docs/babel-node) · babeljs.io · "You should not be using babel-node in production" (*read*) · fetched 2026-10-14
- **Our delta:** `exports` misconfiguration and mixing ts-node with babel-node.

## Section 15 — Migration and decision recipes

### T15-01a · Moving to SWC or esbuild — Topic · ✅ written `docs/babel/pages/15-migration-and-decision-recipes/01-swc-esbuild-keep-or-audit.md`
- **Read this:** [SWC compilation config](https://swc.rs/docs/configuration/compilation) · swc.rs · `env.targets` as the preset-env equivalent (not combinable with `jsc.target`), `jsc.transform.react`, plugins under `jsc.experimental` (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [esbuild: TypeScript caveats](https://esbuild.github.io/content-types/) · esbuild.github.io · no type-check, no `declaration`, no `emitDecoratorMetadata`, isolatedModules needed (*read*) · fetched 2026-10-14
- **Also good:** [SWC disabled](https://nextjs.org/docs/messages/swc-disabled) · nextjs.org · a Babel config makes Next fall back to Babel; `experimental.forceSwcTransforms`; text dates from Next 12, so check against 16.x (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Jest: Babel to SWC](https://www.joshuakgoldberg.com/blog/jest-babel-to-swc) · Josh Goldberg, 2022-02-21 · a worked migration with the real traps: missing `regenerator-runtime`, coverage on re-export files, 77% larger node_modules · fetched 2026-10-14 (*read*)
- **Our delta:** golden emit tests before removing plugins.

### T15-01b · Keeping Babel deliberately and auditing inherited config — Topic · ✅ written `docs/babel/pages/15-migration-and-decision-recipes/01-swc-esbuild-keep-or-audit.md`
- **Read this:** [Babel 8 migration](https://babeljs.io/docs/v8-migration) · babeljs.io · the list of renamed and removed packages and options to audit against (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [@babel/plugin-transform-runtime](https://babeljs.io/docs/babel-plugin-transform-runtime) · babeljs.io · helper aliasing to `@babel/runtime`; `corejs` option removed in Babel 8 (*read*) · fetched 2026-10-14
- **Our delta:** documenting why Babel stays, and `babel-jest` left behind after an "app" migration.

## Section 16 — Real-world workflows and recipes

### T16-01 · Setup, debug and migrate recipes — Topic · ✅ written `docs/babel/pages/16-real-world-workflows-and-recipes/01-setup-debug-and-migrate.md`
- **Read this:** [Usage Guide](https://babeljs.io/docs/usage) · babeljs.io · install `@babel/core`, `@babel/cli`, `@babel/preset-env`, add targets, compile `src` to `lib` (*read*) · covers our angle: **partial** — the setup recipe only · fetched 2026-10-14
- **Also good:** [Getting Started: Using Babel](https://jestjs.io/docs/getting-started) · jestjs.io · the Jest-side setup recipe (*read*) · fetched 2026-10-14
- **Also good:** [babel-loader: debug logging](https://github.com/babel/babel-loader) · GitHub README · `stats.loggingDebug: ["babel-loader"]` for webpack debugging (*read*) · fetched 2026-10-14
- **Our delta:** module-resolver alias drift from tsconfig, and debugging outside the full Next production build.
