---
title: "Link map · Babel · Part 1 (all sections)"
sidebar_label: "01 · babel"
sidebar_position: 1
---

# Link map · Babel · Part 1 (all sections)

Covers every topic page of the Babel track, sections 01 to 16 (`docs/babel/pages/`). This track has no syllabus, so topics come from our page tree: one topic per numbered page, split into several blocks (IDs such as T04-01a) where one page covers distinct sub-topics. All 16 pages are written.
*read* = I read the passage that supports the claim in the fetched text; *headings only* = fetched at 200, headings or opening checked. No `#anchors` are given. Where no good non-official explanation turned up after searching, the block has no "Beyond the docs" line. One page (SitePoint's AST tutorial) answered 403 and was dropped.

🔴 **Version note.** Babel 8.0.0 was released on 2026-06-16 ([release post](https://babeljs.io/blog/2026/06/16/8.0.0)) and 8.0.1 followed on 2026-06-17; Babel 7 stops getting backports and gets security fixes only until June 2027 (7.29.0 was the last 7.x minor). What changed: ESM-only packages (Node `^22.18.0 || >=24.11.0` per the migration guide), no ES5 default (preset-env targets Browserslist `defaults`), `loose` and `spec` replaced by `assumptions`, `useBuiltIns` and `corejs` removed from preset-env and transform-runtime, JSX runtime `automatic` by default, `onlyRemoveTypeImports` true by default. The babeljs.io pages fetched on 2026-10-14 already document Babel 8, so those picks match our sections 01 to 04, which say `> Verified: 2026-09-06` against Babel 8.0.1 and already cover these changes. Sections 05 to 16 carry no `> Verified` line, and their Babel 7 era claims were not re-checked against Babel 8. The Plugin Handbook, the babel-loader README (it lists Babel 8 only as `^8.0.0-alpha` for loader 10.x), the Jest guide and the Next.js Pages guide are written for Babel 7 or earlier; each such pick is flagged in its block.

🔴 **Two of our pages need a re-check against current docs.** (1) Section 08 says the standard `@vitejs/plugin-react` "already runs Babel on every `.jsx`/`.tsx` file by default in dev". That held for plugin-react 5 and earlier. Since plugin-react 6.0.0 (2026-03-12, Vite 8 required) Babel is no longer a dependency, React Refresh runs in Oxc, and Babel is added separately with `@rolldown/plugin-babel`; the current README has no `babel` option on `react()`. (2) Sections 04 (framework presets) and 15 say a Babel config makes Next.js drop SWC. The Turbopack page (Next 16) says Turbopack uses Babel for files when a config exists, but SWC still does Next's internal transforms; only the `--webpack` mode disables SWC. See T04-01b and T08-01b.

---

## Section 01 — Why Babel and the compiler landscape

### T01-01 · What Babel is and when it still matters — Topic · ✅ written `docs/babel/pages/01-why-babel-and-the-compiler-landscape/01-what-babel-is-and-when-it-matters.md`
- **Read this:** [What is Babel?](https://babeljs.io/docs/) · babeljs.io · the one-page definition: a toolchain that converts ECMAScript 2015+ into backwards-compatible JavaScript, plus syntax transforms, polyfills via core-js, codemods, JSX, and stripping Flow and TypeScript annotations without type-checking (*read*) · covers our angle: **partial** — no comparison with SWC, esbuild or tsc · fetched 2026-10-14
- **Also good:** [Migrating from Babel](https://swc.rs/docs/migrating-from-babel) · swc.rs · says the SWC CLI is "designed to be a drop-in replacement for Babel" and supports all stage 3 proposals and preset-env including bugfix transforms (*read*) · fetched 2026-10-14
- **Also good:** [Oxc transformer](https://oxc.rs/docs/guide/usage/transformer) · oxc.rs · fixed transform order: React Compiler, TypeScript strip, decorators, plugins, React Refresh, JSX, then lowering ES2026 down to ES2015; no Babel compatibility claim beyond an external `babelHelpers` option (*read*) · fetched 2026-10-14
- **Our delta:** the decision table (when Babel is still the right tool in 2026) and the "we always had it" anti-pattern.

## Section 02 — Core compilation pipeline

### T02-01 · Parse, transform, generate and the programmatic API — Topic · ✅ written `docs/babel/pages/02-core-compilation-pipeline/01-parse-transform-generate-and-api.md`
- **Read this:** [@babel/core](https://babeljs.io/docs/babel-core) · babeljs.io · `transformSync` and `transformAsync` returning code, map and ast; `loadPartialConfig` resolves plugins and presets and goes no further; the callback-less `transform` still behaves synchronously and "this backward-compatibility will be dropped in Babel 8", so use `transformSync` (*read*) · covers our angle: **partial** — API reference, not the three-stage model · fetched 2026-10-14
- **Also good:** [@babel/parser](https://babeljs.io/docs/babel-parser) · babeljs.io · the `plugins` option (first options win when a plugin is repeated) and `errorRecovery` with an `errors` array that can still throw on unrecoverable errors (*read*) · fetched 2026-10-14
- **Also good:** [@babel/traverse](https://babeljs.io/docs/babel-traverse) · babeljs.io · a very short quick-start: install and two visitor examples; nothing on scope, and it points to the plugin handbook (*read*) · fetched 2026-10-14
- **Our delta:** why `filename` matters for config lookup, and the path versus node mutation rules.

## Section 03 — Configuration system

### T03-01 · Config files, root, env and overrides — Topic · ✅ written `docs/babel/pages/03-configuration-system/01-config-files-root-env-overrides.md`
- **Read this:** [Config Files](https://babeljs.io/docs/config-files) · babeljs.io · project-wide `babel.config.json` versus file-relative `.babelrc.json`, the search stopping at `package.json`, `api.env`/`api.cache` and the monorepo section (*read*) · covers our angle: **full** for file forms and root; `overrides` appears only in the monorepo section · fetched 2026-10-14
- **Also good:** [Options](https://babeljs.io/docs/options) · babeljs.io · `env` and `overrides` may not be nested, `babelrcRoots`, `root`/`rootMode` values `root`, `upward`, `upward-optional`, and `caller` (*read*) · fetched 2026-10-14
- **Our delta:** the NODE_ENV=production-in-tests trap and the `.babelrc` fighting `babel.config.js` pitfall.

## Section 04 — Presets

### T04-01a · `@babel/preset-env`: targets, polyfills and the Babel 8 boundary — Topic · ✅ written `docs/babel/pages/04-presets/01-env-react-typescript-and-framework.md`
- **Read this:** [@babel/preset-env](https://babeljs.io/docs/babel-preset-env) · babeljs.io · `targets`, Browserslist (".browserslistrc recommended"), `modules`, and `useBuiltIns` marked "removed in Babel 8" with `babel-plugin-polyfill-corejs3` as the replacement; the `corejs` section carries no separate notice (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Babel 8 migration](https://babeljs.io/docs/v8-migration) · babeljs.io · default targets become Browserslist `defaults`; `loose` and `spec` removed in favor of `assumptions`; `modules: "auto"` assumes ESM; Node `^22.18.0 || >=24.11.0` (*read*) · fetched 2026-10-14
- **Also good:** [Usage Guide](https://babeljs.io/docs/usage) · babeljs.io · `@babel/polyfill` deprecated since 7.4.0, `core-js/stable`, `usage` versus `entry`; still documents `useBuiltIns`, so it is Babel 7 text on that point (*read*) · fetched 2026-10-14
- **Our delta:** which options moved where in Babel 8 and why polyfills belong in app code, not libraries.

### T04-01b · `@babel/preset-react`, `@babel/preset-typescript` and framework bundles — Topic · ✅ written `docs/babel/pages/04-presets/01b-react-typescript-and-framework-presets.md`
- **Read this:** [@babel/preset-react](https://babeljs.io/docs/babel-preset-react) · babeljs.io · automatic runtime (`importSource`, `development`) versus classic (`pragma`, `pragmaFrag`); `runtime` documented as defaulting to `automatic`, with no Babel 8 mention on the page (*read*) · covers our angle: **partial** — nothing on framework presets · fetched 2026-10-14
- **Also good:** [@babel/preset-typescript](https://babeljs.io/docs/babel-preset-typescript) · babeljs.io · `allowNamespaces`, `optimizeConstEnums`, and `onlyRemoveTypeImports` (default false in 7.9.0, true in 8.0.0) (*read*) · fetched 2026-10-14
- **Also good:** [How to configure Babel in Next.js](https://nextjs.org/docs/pages/guides/babel) · nextjs.org, Pages Router guide, lastUpdated 2025-04-24 · `next/babel` preset must be listed once a config exists, and its sub-options are customizable (*read*) · fetched 2026-10-14
- **Also good:** [Turbopack](https://nextjs.org/docs/app/api-reference/turbopack) · nextjs.org, App Router docs, lastUpdated 2026-10-06 · since Next 16 Turbopack uses Babel automatically when a config file exists, SWC still does the internal transforms, and webpack mode disables SWC when a Babel config is present (*read*) · fetched 2026-10-14
- **Our delta:** the "succeeds with type errors" trap and why a custom Babel config in Next changes the compiler; our page should say that this holds for webpack mode and differs under Turbopack.

## Section 05 — Plugin ecosystem

### T05-01a · Syntax versus transform plugins, ordering and stage proposals — Topic · ✅ written `docs/babel/pages/05-plugin-ecosystem/01-syntax-transform-stage-macros.md`
- **Read this:** [Plugins](https://babeljs.io/docs/plugins) · babeljs.io · transform plugins enable their syntax plugin; syntax plugins only parse; plugins run before presets, first to last; presets last to first (*read*) · covers our angle: **partial** — nothing on stage proposals · fetched 2026-10-14
- **Also good:** [Presets](https://babeljs.io/docs/presets) · babeljs.io · the official preset list, "Preset Ordering" reversed, and the note that the Stage-X presets were deprecated in Babel 7 and are no longer published (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Babel Plugin "Ordering"](https://jamie.build/babel-plugin-ordering.html) · James Kyle, undated · argues the plugin list is not an execution order: visitors merge into one traversal, so order only decides between visitors on the same node, and two plugins that both want to go first have no clean fix · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [The Mysterious Case of Emotion and "exports is not defined"](https://dev.to/laurenashpole/the-mysterious-case-of-emotion-and-exports-is-not-defined-24m2) · Lauren Ashpole, DEV Community, 2021-11-03 · a real ordering bug: the commonjs module transform had to run after Emotion's preset, but plugins always run first; fixed by listing the preset's plugins individually · fetched 2026-10-14 (*read*)
- **Our delta:** the stage-2-syntax-in-shared-packages risk and duplicate Emotion/styled-components plugins.

### T05-01b · Macros with `babel-plugin-macros` — Topic · ✅ written `docs/babel/pages/05-plugin-ecosystem/01-syntax-transform-stage-macros.md`
- **Read this:** [babel-plugin-macros](https://github.com/kentcdodds/babel-plugin-macros) · GitHub README (Kent C. Dodds) · the problem (each plugin must be configured individually) and the single standard interface; explicit imports make the compile-time step visible; the README says nothing on maintenance status (*read*) · covers our angle: **partial** — how macros work, nothing on shipping a macro from a library or on SWC-only pipelines · fetched 2026-10-14
- **Beyond the docs:** [Zero-config code transformation with babel-plugin-macros](https://babeljs.io/blog/2017/09/11/zero-config-with-babel-macros) · Kent C. Dodds, guest post on the Babel blog, 2017-09-11 · why plugins hide transforms, need out-of-band config and conflict in one AST walk, versus an explicit, importable macro; the 2017 post predates later releases · fetched 2026-10-14 (*read*)
- **Our delta:** documenting the Babel requirement when a library ships a macro.

## Section 06 — Authoring custom plugins

### T06-01 · Visitors, paths, types and testing — Topic · ✅ written `docs/babel/pages/06-authoring-custom-plugins/01-visitors-paths-types-and-testing.md`
- **Read this:** [@babel/types](https://babeljs.io/docs/babel-types) · babeljs.io · each node type's builder, `is`/`assert` helpers, field types and aliases (first 100000 of about 170000 chars *read*; the rest not read, so `loc` and `raw` coverage is unchecked) · covers our angle: **partial** — builders only · fetched 2026-10-14
- **Also good:** [@babel/traverse](https://babeljs.io/docs/babel-traverse) · babeljs.io · minimal visitor and node-type examples (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Babel Plugin Handbook](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md) · Jamie Kyle, GitHub · the long-form explanation of visitors, paths, scope and bindings, UID generation and renaming, manipulation, and unit testing with snapshot, AST and exec tests plus babel-plugin-tester; it has no version note, and its testing example imports `babel-core` while the API section uses `@babel/` packages, so check API names against the docs · fetched 2026-10-14 (*read*)
- **Our delta:** the missing `loc`/`raw` fields trap and removing still-referenced declarations.

## Section 07 — TypeScript and JSX handling

### T07-01 · Type stripping, unsupported features and the JSX runtime — Topic · ✅ written `docs/babel/pages/07-typescript-and-jsx-handling/01-type-stripping-unsupported-and-jsx-runtime.md`
- **Read this:** [@babel/plugin-transform-typescript](https://babeljs.io/docs/babel-plugin-transform-typescript) · babeljs.io · caveats: it does not add type-checking, `tsconfig.json` changes are not picked up (behaves as if `isolatedModules` is on), no exported `var`/`let` in namespaces, and namespaces do not share scope (*read*) · covers our angle: **full** for the TypeScript half · fetched 2026-10-14
- **Also good:** [Introducing the New JSX Transform](https://legacy.reactjs.org/blog/2020/09/22/introducing-the-new-jsx-transform.html) · React blog, 2020-09-22 · what changes, Babel 7.9.0+, `runtime: "automatic"`; says Babel 8 makes automatic the default, which is now true (*read*) · fetched 2026-10-14
- **Also good:** [isolatedModules](https://www.typescriptlang.org/tsconfig/isolatedModules.html) · typescriptlang.org · why single-file transpilers break on type re-exports, namespaces in non-module files and ambient const enum members (*read*) · fetched 2026-10-14
- **Our delta:** `jsx: react-jsx` in tsconfig versus a classic Babel runtime, and const enums crossing package boundaries.

## Section 08 — Build tool integration

### T08-01a · Webpack and Rollup: `babel-loader` and `@rollup/plugin-babel` — Topic · ✅ written `docs/babel/pages/08-build-tool-integration/01-webpack-vite-jest-rollup.md`
- **Read this:** [babel-loader](https://github.com/babel/babel-loader) · GitHub README · `cacheDirectory` and `cacheCompression`, exclude `node_modules`, transform-runtime for helper bloat; written for Babel 7, and loader 10.x lists Babel `^7.12.0 || ^8.0.0-alpha` only (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [@rollup/plugin-babel](https://github.com/rollup/plugins/tree/master/packages/babel) · GitHub README · `babelHelpers` modes `bundled` (default), `runtime`, `inline` (not recommended) and `external`, and when to use each (*read*) · fetched 2026-10-14
- **Also good:** [babel-loader on webpack.js.org](https://webpack.js.org/loaders/babel-loader) · webpack.js.org · the README rendered inside webpack's docs; says the loader is community maintained and works with webpack or Rspack (*read*) · fetched 2026-10-14
- **Our delta:** one shared Babel config across webpack and Jest, and mismatched source maps.

### T08-01b · Vite and Jest: the Babel paths — Topic · ✅ written `docs/babel/pages/08-build-tool-integration/01-webpack-vite-jest-rollup.md`
- **Read this:** [Getting Started: Using Babel](https://jestjs.io/docs/getting-started) · jestjs.io · `babel-jest` transforms automatically when a Babel config exists, `targets: {node: 'current'}`, `api.env('test')`, and the "Jest does not type-check" warning (in the TypeScript subsection) (*read*) · covers our angle: **partial** — nothing on `transformIgnorePatterns` · fetched 2026-10-14
- **Also good:** [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react) · GitHub README · Babel appears only for the React Compiler preset via `@rolldown/plugin-babel`; `react()` has no `babel` option, and the `compiler` option uses Oxc (*read*) · covers our angle: **partial** — contradicts our "Babel runs by default in dev" wording for plugin-react 6 · fetched 2026-10-14
- **Also good:** [plugin-react CHANGELOG](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/CHANGELOG.md) · GitHub · 6.0.0 removed Babel as a dependency (Vite 8 does the refresh transform with Oxc); Vite 7 and below are no longer supported by 6.x; 5.1.4 still had the `babel` option (*read*) · fetched 2026-10-14
- **Beyond the docs:** [React Compiler 1.0 + Vite 8: The Right Way to Install After plugin-react v6 Drops Babel](https://recca0120.github.io/en/2026/04/14/react-compiler-vite-v6/) · recca0120 Tech Notes, 2026-04-14 · shows the install and `babel()` plus `reactCompilerPreset()` order for Vite 8, and says the old `react({ babel })` form still applies to Vite 7 and earlier · fetched 2026-10-14 (*read*)
- **Our delta:** why forcing Vite onto the Babel path costs speed for no gain; true for plugin-react 5 and earlier, while on 6 Babel only runs if you add `@rolldown/plugin-babel`.

## Section 09 — Linter and type-checker interop

### T09-01 · `@babel/eslint-parser` and `tsc` — Topic · ✅ written `docs/babel/pages/09-linter-and-type-checker-interop/01-babel-eslint-parser-and-tsc.md`
- **Read this:** [@babel/eslint-parser](https://babeljs.io/docs/babel-eslint-parser) · babeljs.io · use it only if Babel transforms your code, `requireConfigFile`, `babelOptions`, limits (core rules need `@babel/eslint-plugin`, no TypeScript linting with Babel's plugin, needs `@babel/core` 7.2.0+); the Babel 8 guide says it drops ESLint 7 and 8 (*read*) · covers our angle: **full** for the parser · fetched 2026-10-14
- **Also good:** [@babel/plugin-transform-typescript](https://babeljs.io/docs/babel-plugin-transform-typescript) · babeljs.io · the plugin "does not add the ability to type-check", so `tsc` stays in CI (*read*) · fetched 2026-10-14
- **Our delta:** type-aware lint rules do not come from Babel's AST, and the CI that only runs build.

## Section 10 — Source maps and debugging

### T10-01 · Source maps and inspecting output — Topic · ✅ written `docs/babel/pages/10-source-maps-and-debugging/01-maps-and-inspecting-output.md`
- **Read this:** [Options: source map options](https://babeljs.io/docs/options) · babeljs.io · `sourceMaps` (`true`, `"inline"`, `"both"`) and `inputSourceMap` default true (*read*) · covers our angle: **partial** — flags only · fetched 2026-10-14
- **Also good:** [What are source maps?](https://web.dev/articles/source-maps) · web.dev, last updated 2023-03-31 · the `mappings` field as base 64 VLQ, the `.map` extension, and drawbacks such as optimized-away variables (*read*) · fetched 2026-10-14
- **Beyond the docs:** [The Inner Workings of JavaScript Source Maps](https://blog.polarsignals.com/blog/posts/2025/11/04/javascript-source-maps-internals) · Manoj Vivek, Polar Signals blog, 2025-11-04 · decodes `mappings` step by step (relative deltas, 5-bit groups, Base64) and explains `sources` and `sourcesContent`, usually left out of production builds · fetched 2026-10-14 (*read*)
- **Our delta:** inline maps in production bundles and wrong `sources` paths under monorepo roots.

## Section 11 — Performance and caching

### T11-01 · Compilation cost, caching and reducing surface — Topic · ✅ written `docs/babel/pages/11-performance-and-caching/01-cost-caching-and-surface-reduction.md`
- **Read this:** [babel-loader: Troubleshooting](https://github.com/babel/babel-loader) · GitHub README · "babel-loader is slow!": transform fewer files, exclude `node_modules`, `cacheDirectory` (README says up to 2x) (*read*) · covers our angle: **partial** — webpack only · fetched 2026-10-14
- **Also good:** [Config Files: api.cache](https://babeljs.io/docs/config-files) · babeljs.io · config function caching via `api.cache` and `api.env`; do not mix `api.env` with `forever()` or `never()` (*read*) · fetched 2026-10-14
- **Also good:** [@babel/register](https://babeljs.io/docs/babel-register) · babeljs.io · JSON cache in the temp dir, `BABEL_CACHE_PATH`, `BABEL_DISABLE_CACHE` (*read*) · fetched 2026-10-14
- **Our delta:** key the cache on `babel.config.js`, and shrink browserslist instead of micro-tuning.

## Section 12 — Monorepo and multi-package strategies

### T12-01 · Shared root config and cross-package compilation — Topic · ✅ written `docs/babel/pages/12-monorepo-and-multi-package-strategies/01-shared-root-and-cross-package.md`
- **Read this:** [Config Files: Monorepos](https://babeljs.io/docs/config-files) · babeljs.io · root `babel.config.json` with `overrides`, subpackage `.babelrc.json` ignored unless listed in `babelrcRoots`; `rootMode: "upward"` when running from a subpackage, passable to the CLI, `@babel/register`, babel-loader or a Jest transformer (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Options: rootMode and babelrcRoots](https://babeljs.io/docs/options) · babeljs.io · exact semantics of `root`, `rootMode` (`upward` throws when no root config is found, `upward-optional` falls back), `babelrcRoots` (*read*) · fetched 2026-10-14
- **Our delta:** contradictory per-package targets and publishing TypeScript source without telling consumers.

## Section 13 — CLI and programmatic tooling

### T13-01 · `@babel/cli` and codemods on Babel's parser — Topic · ✅ written `docs/babel/pages/13-cli-and-programmatic-tooling/01-cli-and-codemods.md`
- **Read this:** [@babel/cli](https://babeljs.io/docs/babel-cli) · babeljs.io · `--out-dir`, `--watch`, `--ignore`, `--copy-files`, `--extensions`, `--source-maps` (*read*) · covers our angle: **full** for the CLI half · fetched 2026-10-14
- **Also good:** [jscodeshift](https://github.com/facebook/jscodeshift) · GitHub README · `--parser` babel/babylon/flow/ts/tsx (default babel), `--dry`, `--print`, transform shape, `testUtils` (*read*) · covers our angle: **full** for codemods · fetched 2026-10-14
- **Beyond the docs:** [Effective Refactoring with Codemods](https://carloscuesta.me/blog/effective-refactoring-with-codemods) · Carlos Cuesta, 2023-01-29 · builds a lodash `get` to optional chaining codemod in AST Explorer with `@babel/parser` and jscodeshift, exporting `parser = 'babel'` and finishing with `toSource()` · fetched 2026-10-14 (*read*)
- **Our delta:** CLI is not a type checker or formatter; parse TS with the right parser option.

## Section 14 — Node.js and backend usage

### T14-01 · `@babel/register` and ESM/CJS for backends — Topic · ✅ written `docs/babel/pages/14-nodejs-backend-usage/01-register-and-esm-cjs.md`
- **Read this:** [@babel/register](https://babeljs.io/docs/babel-register) · babeljs.io · ignores `node_modules` by default, `only`/`ignore` (not supported in config files), does not compile native ESM on the fly; the page does not mention Babel 8 being ESM-only (*read*) · covers our angle: **partial** — no ESM/CJS half · fetched 2026-10-14
- **Also good:** [Publishing a package](https://nodejs.org/learn/modules/publishing-a-package) · nodejs.org · `exports` conditions, `import` is not ESM and `require` is not CJS, the dual package hazard (two instances, `instanceof` fails) and the `node`/`default` split that avoids it (*read*) · fetched 2026-10-14
- **Also good:** [Node.js Packages](https://nodejs.org/api/packages.html) · nodejs.org · `type`, `.mjs`/`.cjs`, conditional exports (`import`, `require`, `module-sync`); its dual-package section only links to an examples repo (*read*) · fetched 2026-10-14
- **Also good:** [@babel/node](https://babeljs.io/docs/babel-node) · babeljs.io · "You should not be using `babel-node` in production" (*read*) · fetched 2026-10-14
- **Our delta:** `exports` misconfiguration and mixing ts-node with babel-node.

## Section 15 — Migration and decision recipes

### T15-01a · Moving to SWC or esbuild — Topic · ✅ written `docs/babel/pages/15-migration-and-decision-recipes/01-swc-esbuild-keep-or-audit.md`
- **Read this:** [SWC compilation config](https://swc.rs/docs/configuration/compilation) · swc.rs · `env.targets` as the preset-env equivalent (does not work with `jsc.target`), `jsc.transform.react` (default runtime classic), plugins under `jsc.experimental` (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [esbuild: TypeScript caveats](https://esbuild.github.io/content-types/) · esbuild.github.io · no type-check, no `declaration`, no `emitDecoratorMetadata`, isolatedModules needed (*read*) · fetched 2026-10-14
- **Also good:** [SWC disabled](https://nextjs.org/docs/messages/swc-disabled) · nextjs.org · a Babel config makes Next fall back to Babel; `experimental.forceSwcTransforms`; text dates from Next 12, and Next 16 Turbopack behaves differently (see T04-01b) (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Jest: Babel to SWC](https://www.joshuakgoldberg.com/blog/jest-babel-to-swc) · Josh Goldberg, 2022-02-21 · a worked migration with the real traps: missing `regenerator-runtime`, coverage on re-export files, node_modules 186M to 330M; written for an early `@swc/jest`, and the author notes 0.2.18 later auto-detects the target · fetched 2026-10-14 (*read*)
- **Our delta:** golden emit tests before removing plugins.

### T15-01b · Keeping Babel deliberately and auditing inherited config — Topic · ✅ written `docs/babel/pages/15-migration-and-decision-recipes/01-swc-esbuild-keep-or-audit.md`
- **Read this:** [Babel 8 migration](https://babeljs.io/docs/v8-migration) · babeljs.io · the list of renamed and removed packages and options to audit against, including syntax plugins that are no longer needed (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [@babel/plugin-transform-runtime](https://babeljs.io/docs/babel-plugin-transform-runtime) · babeljs.io · helper aliasing to `@babel/runtime`; `corejs` option "removed in Babel 8" (`useBuiltIns` is not mentioned as a Babel 8 removal on this page) (*read*) · fetched 2026-10-14
- **Also good:** [Releasing Babel 8 today](https://babeljs.io/blog/2026/06/16/8.0.0) · babeljs.io blog, 2026-06-16 · the release post: ESM-only, no ES5 default, `loose`/`spec` removed, Babel 7 security fixes until June 2027 (*read*) · fetched 2026-10-14
- **Our delta:** documenting why Babel stays, and `babel-jest` left behind after an "app" migration.

## Section 16 — Real-world workflows and recipes

### T16-01 · Setup, debug and migrate recipes — Topic · ✅ written `docs/babel/pages/16-real-world-workflows-and-recipes/01-setup-debug-and-migrate.md`
- **Read this:** [Usage Guide](https://babeljs.io/docs/usage) · babeljs.io · install `@babel/core`, `@babel/cli`, `@babel/preset-env`, add targets, compile `src` to `lib` (*read*) · covers our angle: **partial** — the setup recipe only · fetched 2026-10-14
- **Also good:** [Getting Started: Using Babel](https://jestjs.io/docs/getting-started) · jestjs.io · the Jest-side setup recipe (*read*) · fetched 2026-10-14
- **Also good:** [babel-loader: debug logging](https://github.com/babel/babel-loader) · GitHub README · `stats.loggingDebug: ["babel-loader"]` for webpack debugging (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Jest and ESM: Cannot use import statement outside a module](https://dev.to/steveruizok/jest-and-esm-cannot-use-import-statement-outside-a-module-4mmj) · Steve Ruiz, DEV Community, 2021-06-25 · the error from an ESM-only dependency in node_modules, fixed with `babel-jest` plus a `transformIgnorePatterns` exception for the named packages; Next.js example from 2021 · fetched 2026-10-14 (*read*)
- **Our delta:** module-resolver alias drift from tsconfig, and debugging outside the full Next production build.
