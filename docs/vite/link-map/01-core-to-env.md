---
title: "Link map · Vite · Part 1 (sections 01–07)"
sidebar_label: "01 · core to env"
sidebar_position: 1
---

# Link map · Vite · Part 1 (sections 01–07)

Covers sections 01 to 07 of `docs/vite/pages/`: core architecture, CLI and scaffolding, configuration, dev server mechanics, build system, asset handling, and env variables and modes. Sections 01 to 06 are one page each. Section 07 is two groups (G01 with 10 chunks, G02 with 8 chunks), split into five and three clusters, so there are 14 blocks.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up after searching, the block has no "Beyond the docs" line. Every link below was fetched on 2026-10-14 and returned 200 with no redirect.

🔴 **Version note.** Our pages say `Verified: 2026-09-06 … Vite 8.2.2 · Node.js 20.19+ / 22.12+` (section 07: 2026-09-07). The live vite.dev docs now render as v8.3.4, so wording can differ slightly from what we verified. Official links point at vite.dev (current major), plus rolldown.rs, oxc.rs and nodejs.org where a claim leans on them. Do not mix in v5 to v7 docs: they describe esbuild and Rollup, and a different default config loader. The Rolldown guide URL `vite.dev/guide/rolldown` answers 301 to `v7.vite.dev/guide/rolldown`, so it is not used.

---

## Section 01 — Core architecture

### T01-01 · The dual-engine model — Topic · ✅ written `docs/vite/pages/01-core-architecture/01-dual-engine-model.md`
- **Read this:** [Why Vite](https://vite.dev/guide/why) · vite.dev · native ESM served on demand with HMR touching only the edited module, why production still bundles (nested imports cost round trips), and the esbuild plus Rollup history that Rolldown unifies; our page quotes it (*read*) · covers our angle: **full** for the two modes · fetched 2026-10-14
- **Also good:** [Announcing Vite 8](https://vite.dev/blog/announcing-vite8) · vite.dev blog · two pipelines meant two plugin systems, Vite 8 ships Rolldown as one bundler, and an experimental Full Bundle Mode that bundles during development; the 10 to 30x figure is theirs (*read*) · covers our angle: **partial** — never uses the words native ESM · fetched 2026-10-14
- **Also good:** [Migration from v7](https://vite.dev/guide/migration) · vite.dev · `rollupOptions` becomes `rolldownOptions` (deprecated alias), esbuild is now an optional dependency, Oxc transforms, Rolldown does dependency optimization (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Vite v8 Rust (InfoQ)](https://infoq.com/news/2026/05/vite-v8-rust/) · Daniel Curtis, InfoQ, 2026-05-19 · plain news write-up of the esbuild plus Rollup problem and the single-bundler fix; repeats the vite.dev 10 to 30x claim · fetched 2026-10-14 (*read*)
- **Our delta:** the two-mode diagram and the dev/prod mapping. Gap: our page says dev never bundles, but the Vite 8 blog and the `vite` option list (`--experimentalBundle`) describe an experimental dev bundling mode that our corpus does not mention. The page deliberately gives no timings, so the 10 to 30x number is absent by design.

## Section 02 — CLI and scaffolding

### T02-01 · `create vite` and the core commands — Topic · ✅ written `docs/vite/pages/02-cli-and-scaffolding/01-commands-and-templates.md`
- **Read this:** [Getting Started](https://vite.dev/guide/) · vite.dev · the `create vite` command per package manager, `--template`, the extra `--` on npm 7+, `.` for current directory, `--no-interactive`, the 18 template names, the three default scripts, and the Node line our page quotes: "20.19+, 22.12+" with a warning that some templates need more (*read*) · covers our angle: **full** for scaffolding · fetched 2026-10-14
- **Also good:** [Command Line Interface](https://vite.dev/guide/cli) · vite.dev · `vite`, `vite build`, `vite optimize` (marked deprecated, pre-bundling is automatic), `vite preview`, and the options each takes; `--configLoader` is listed on all four (*read*) · fetched 2026-10-14
- **Also good:** [create-vite README](https://github.com/vitejs/vite/tree/main/packages/create-vite) · vitejs/vite repo · the same preset list including `react-compiler` and `react-compiler-ts`; the plain `template-react-ts` README there says the React Compiler is off by default for dev and build cost (*read*) · fetched 2026-10-14
- **Our delta:** the missing-`--` mechanism (npm intercepts the flag) is our own explanation. Correction needed on our page: it calls `vite optimize` unconfirmed, but the CLI page documents it as deprecated. No page I fetched says what the `react-compiler` presets change, so our "new React additions" wording is as far as sources go. No good non-official explanation found (search returned mirrors of the README).

## Section 03 — Configuration

### T03-01 · `vite.config.ts`, `defineConfig()` and conditional config — Topic · ✅ written `docs/vite/pages/03-configuration/01-vite-config-file.md`
- **Read this:** [Configuring Vite](https://vite.dev/config/) · vite.dev · config file resolution, `defineConfig`, the function form receiving `command`, `mode`, `isSsrBuild`, `isPreview`, and the warning to compare the last two explicitly against `true` and `false` (*read*) · covers our angle: **partial** — our page lists only `command` and `mode`; the other two and the warning are only here · fetched 2026-10-14
- **Also good:** [Shared Options](https://vite.dev/config/shared-options) · vite.dev · the defaults our page marks "not re-checked": `root` is `process.cwd()`, `base` is `/`, `publicDir` is `"public"` (false disables), `envDir` is `root`; `mode` defaults per command and `--mode` overrides config (*read*) · all four match our page · fetched 2026-10-14
- **Our delta:** the `command` versus `mode` orthogonality (`vite build --mode staging`) and the `root` versus config-location chicken-and-egg are ours; the project-root resolution line it quotes is on Getting Started. That page said it could not name the config loader: Configuring Vite now says Rolldown bundles the config by default. There is no config-versus-CLI precedence table anywhere; the only documented override is `--mode` over config `mode`. No good non-official explanation found (results were official docs and skill listings).

## Section 04 — Dev server mechanics

### T04-01 · Native ESM serving, HMR and dependency pre-bundling — Topic · ✅ written `docs/vite/pages/04-dev-server-mechanics/01-native-esm-and-hmr.md`
- **Read this:** [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling) · vite.dev · the two reasons (CommonJS and UMD compatibility, one request instead of 600 for `lodash-es`), dev only, four cache inputs (lockfile, patches folder, config fields, `NODE_ENV`), `--force`, Rolldown does it, and the `max-age=31536000,immutable` browser cache (*read*) · covers our angle: **full** for pre-bundling · fetched 2026-10-14
- **Read this:** [HMR API](https://vite.dev/guide/api-hmr) · vite.dev · `accept`, `dispose`, `prune`, `data` (mutate, never reassign), `invalidate`, `on`/`off`/`send`; `decline` is a no-op (*read*) · covers our angle: **full** for the client API · fetched 2026-10-14
- **Also good:** [Features](https://vite.dev/guide/features) · vite.dev · bare imports are rewritten to `/node_modules/.vite/deps/my-dep.js` with a `?v=` hash, React Fast Refresh and Vue SFC HMR ship first party, Preact via `@prefresh/vite` (*read*) · fetched 2026-10-14
- **Our delta:** the in-memory module-graph explanation (changed module plus importers up to the nearest accepting boundary) is ours; no linked page states it. Not on our page: the rewritten `/node_modules/.vite/deps/` URLs, the browser's immutable cache of them (a second cache that explains "my fix did not apply"), and `decline`. No good non-official explanation found (search returned only the HMR API page).

## Section 05 — Build system

### T05-01 · `rolldownOptions`, chunk splitting and library mode — Topic · ✅ written `docs/vite/pages/05-build-system-rollup/01-build-options.md`
- **Read this:** [Build Options](https://vite.dev/config/build-options) · vite.dev · `build.rolldownOptions` (`rollupOptions` is a deprecated alias), `build.lib` default formats `es` and `umd` (`es` and `cjs` for several entries), `build.target` default `baseline-widely-available`, `chunkSizeWarningLimit` 500 compared to uncompressed size (*read*) · covers our angle: **full** for options · fetched 2026-10-14
- **Read this:** [Building for Production](https://vite.dev/guide/build) · vite.dev · chunking through `build.rolldownOptions.output.codeSplitting` (no example, links to Rolldown), library mode (externals, `globals`, `main`/`module`/`exports`), multi-page entries (*read*) · covers our angle: **full**, plus multi-page, which our page lacks · fetched 2026-10-14
- **Also good:** [Migration from v7](https://vite.dev/guide/migration) · vite.dev · object-form `manualChunks` not supported, function form deprecated, "Rolldown has the more flexible `codeSplitting`"; the page does not say outright that it replaces them; new `build.target` floor (Chrome and Edge 111, Firefox 114, Safari 16.4) (*read*) · fetched 2026-10-14
- **Also good:** [codeSplitting reference](https://rolldown.rs/reference/OutputOptions.codeSplitting) · rolldown.rs · `true` by default, `false` inlines dynamic imports, or an object with `groups` plus global fallbacks `minSize`, `maxSize`, `minShareCount`, `includeDependenciesRecursively`; warns manual splitting can change execution order. Per-group fields (`name`, `test`, `priority`) are on a group page that returned 404, so they are unconfirmed here (*read*) · fetched 2026-10-14
- **Beyond the docs:** [サンプルプロジェクトを作ってVite 7からVite 8への移行手順を確認してみた](https://dev.classmethod.jp/articles/vite7-to-vite8-migration-pitfalls/) · Nishimura Yuji, Classmethod, 2026-04-23 · tried 7.3.2 to 8.0.10: object `manualChunks` breaks the build, the function form still runs, and a `codeSplitting` group with a regex `test` gave the same vendor chunk; Japanese, a version older than ours · fetched 2026-10-14 (*read*)
- **Our delta:** our page gives no `codeSplitting` example and says so. Also, its library snippet still writes `rollupOptions`, the deprecated alias. For groups, see section 11 of our pages and the Rolldown guide [Manual Code Splitting](https://rolldown.rs/in-depth/advanced-chunks) (*read*; shows `test` and `name`, no priority).

## Section 06 — Asset handling

### T06-01 · Static imports, `public/` and special import suffixes — Topic · ✅ written `docs/vite/pages/06-asset-handling/01-static-asset-imports.md`
- **Read this:** [Static Asset Handling](https://vite.dev/guide/assets) · vite.dev · import returns the public URL (`/src/img.png` in dev, hashed path in build), inlining under `assetsInlineLimit`, `?url` for unknown types, `?raw`, `?inline` and `?no-inline`, the three reasons for `public/`, "prefer importing" (*read*) · covers our angle: **full**; it says hashed names but nothing about caching · fetched 2026-10-14
- **Also good:** [Build Options](https://vite.dev/config/build-options) · vite.dev · `assetsInlineLimit` default 4096, `copyPublicDir` default true, and `build.lib` makes the limit ignored so assets always inline (*read*) · fetched 2026-10-14
- **Also good:** [Features: glob import](https://vite.dev/guide/features) · vite.dev · `import.meta.glob` lazy by default, `{ eager: true }`, patterns relative or absolute, all arguments must be literals; our page says it did not re-fetch this (*read*) · fetched 2026-10-14
- **Our delta:** the cache and invalidation consequences of `public/` versus an import, and the `?url` versus `?no-inline` correction, are ours. Not on our page: library mode ignoring the limit, `copyPublicDir`. No good non-official explanation found (results were official docs and other frameworks' docs).

## Section 07 — Env variables and modes

### T07-01a · The env system, static replacement, the five built-in constants and string values — Topic · ✅ written `docs/vite/pages/07-env-variables-and-modes/01-environment-system.md`
Covers chunks 01 and 01c.
- **Read this:** [Env Variables and Modes](https://vite.dev/guide/env-and-mode) · vite.dev · `import.meta.env`, `MODE`, `BASE_URL`, `PROD`, `DEV`, `SSR` "statically replaced at build time to make tree-shaking effective", the four `.env` files, mode file above generic, existing shell variables outrank files, "loaded at the start of Vite. Restart the server", values are strings (*read*) · covers our angle: **full** for the rules, **partial** for cost and the coercion pitfalls · fetched 2026-10-14
- **Also good:** [Shared Options: envPrefix](https://vite.dev/config/shared-options) · vite.dev · default `VITE_`; an empty prefix would expose everything and Vite throws (*read*) · fetched 2026-10-14
- **Our delta:** the `Number()`-on-missing and string-versus-boolean pitfalls, and the CI assertion for shell variables outranking files. The page notes the docs do not rank `.env.local` against `.env.[mode]`; I found no page that does. No good non-official explanation found beyond a thin env.dev summary that adds nothing to the docs.

### T07-01b · What static replacement costs, and the `VITE_` gate — Topic · ✅ written `docs/vite/pages/07-env-variables-and-modes/01a-build-time-vs-runtime-config.md`
Covers chunks 01a and 01b.
- **Read this:** [Env Variables and Modes](https://vite.dev/guide/env-and-mode) · vite.dev · replacement at build time, `VITE_` variables exposed to client source, "`VITE_*` variables should not contain sensitive information such as API keys" (*read*) · covers our angle: **partial** — the current page does not state the dynamic-key rule (`import.meta.env[k]`); our page derives it from "statically replaced", which is sound but inferred · fetched 2026-10-14
- **Also good:** [Shared Options: envPrefix](https://vite.dev/config/shared-options) · vite.dev · why an empty prefix is refused; widening it exposes more (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Build-Time vs Runtime Environment Variables](https://env.dev/guides/build-time-env-variables) · env.dev, updated 2026-06-23 · the `grep -rF` check on `dist/` for a baked-in value and the runtime-config options (entrypoint writes `config.json` or `window.__CONFIG__`); generic, not Vite-specific · fetched 2026-10-14 (*read*)
- **Our delta:** one-artefact promotion, dynamic-key failures, bundle auditing for Vite 8 output.

### T07-01c · `BASE_URL`, `SSR`, modes versus `NODE_ENV`, modes in CI and containers — Topic · ✅ written `docs/vite/pages/07-env-variables-and-modes/01d-base-url-and-ssr.md`
Covers chunks 01d, 01e, 01f.
- **Read this:** [Env Variables and Modes](https://vite.dev/guide/env-and-mode) · vite.dev · `dev` defaults to development, `build` to production, `--mode` picks the `.env.[mode]` file, `NODE_ENV=development vite build` keeps mode `production`, "two different concepts" (*read*) · covers our angle: **full** for the axes, **partial** for CI and containers · fetched 2026-10-14
- **Also good:** [Shared Options: mode and base](https://vite.dev/config/shared-options) · vite.dev · mode precedence and the forms `base` accepts, which `BASE_URL` mirrors (*read*) · fetched 2026-10-14
- **Also good:** [Command Line Interface](https://vite.dev/guide/cli) · vite.dev · `vite preview` takes `--mode`, `--outDir` and `--base` (*read*) · fetched 2026-10-14
- **Also good:** [Server-Side Rendering](https://vite.dev/guide/ssr) · vite.dev · `import.meta.env.SSR` "statically replaced during build so it will allow tree-shaking of unused branches" (*read*) · fetched 2026-10-14
- **Also good:** [Development and production](https://nodejs.org/en/learn/getting-started/nodejs-the-difference-between-development-and-production) · Node.js · run with `NODE_ENV=production`, anything else is an "antipattern" because behaviour diverges; backs our "two useful values" rule (*read*) · fetched 2026-10-14
- **Our delta:** the two-axes table and the CI job layout. `SSR` as a constant, not an access control, is our own point. Note: our page says branch removal is "not documented either way"; the SSR guide does say unused branches can be tree-shaken, so that scope note is stale.

### T07-01d · `dotenv-expand`: why `$` truncates a value — Topic · ✅ written `docs/vite/pages/07-env-variables-and-modes/01g-dotenv-expansion.md`
Covers chunk 01g.
- **Read this:** [Env Variables and Modes](https://vite.dev/guide/env-and-mode) · vite.dev · "Vite uses dotenv-expand", `$KEY` expansion, `\$` for a literal dollar, and the three-line example where `test$foo` becomes `test` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [motdotla/dotenv-expand](https://github.com/motdotla/dotenv-expand) · upstream README · braced and unbraced forms, `${MISSING:-default}`, the alternate-value form, the `processEnv` option; backslash escaping is not documented there, it points to dotenvx docs for the rules (*read*) · fetched 2026-10-14
- **Our delta:** the silent-truncation story and the CI lint. Not on our page: default and alternate-value forms, which the README documents. The page says it did not fetch dotenv-expand; the README now settles defaults but not escaping or quoting. No good non-official explanation found (results were other tools' docs).

### T07-01e · Composition, the prefix filter's position and sharing one `.env` across tools — Topic · ✅ written `docs/vite/pages/07-env-variables-and-modes/01h-env-composition-and-interop.md`
Covers chunks 01h and 01i.
- **Read this:** [Env Variables and Modes](https://vite.dev/guide/env-and-mode) · vite.dev · reverse-order expansion is supported, "does not work in shell scripts and other tools like docker compose", and "recommended to avoid relying on this behavior" (*read*) · covers our angle: **full** for reverse order; nothing on the prefix filter's position · fetched 2026-10-14
- **Also good:** [Environment variables (.env files)](https://nodejs.org/api/environment_variables.html) · Node.js · a third reader of `.env`: `--env-file`, `process.loadEnvFile`, quoting, `export` ignored, values always strings; documents no `$VAR` expansion; Stable (*read*) · fetched 2026-10-14
- **Also good:** [Interpolation (Docker Compose)](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/) · Docker · `$VAR` and `${VAR}` in unquoted and double-quoted values, `${VAR:-default}`, shell beats `--env-file` beats `.env`; says nothing on forward references or escaping (*read*) · fetched 2026-10-14
- **Our delta:** reverse-order expansion is documented by Vite (an earlier draft of this block said otherwise). Ours: expansion before the prefix filter is inferred, as the page says, and no linked page states it. The comparison table's docker compose column (`\$` as a literal dollar, forward references) rests on the Vite sentence alone; the Compose page I read does not confirm it. No good non-official explanation found.

### T07-02a · Why the config cannot read its own `.env`, `loadEnv`, conditional config and the config loader — Topic · ✅ written `docs/vite/pages/07-env-variables-and-modes/02-config-time-env-and-define.md`
Covers chunks 02, 02a, 02b.
- **Read this:** [Configuring Vite](https://vite.dev/config/) · vite.dev · `.env*` files load after the config resolves, `loadEnv(mode, process.cwd(), '')`, the `bundle` default loader (Rolldown, temp file in `node_modules/.vite-temp`), `--configLoader native` on Node 22.18+, planned default in a future major, and the breakpoint note (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Command Line Interface](https://vite.dev/guide/cli) · vite.dev · `--configLoader` listed on every command (*read*) · fetched 2026-10-14
- **Also good:** [Node.js TypeScript](https://nodejs.org/api/typescript.html) · Node.js · type stripping on by default from v22.18.0 and v23.6.0, Stable from v24.12 and v25.2; erasable syntax only (enums, runtime namespaces and parameter properties fail), `tsconfig.json` ignored so `paths` do not apply, no `.tsx`, no files under `node_modules`, extensions required (*read*) · fetched 2026-10-14
- **Our delta:** why `process.env` is empty in the config, and the two flags that are not booleans. The Node page gives the real limit for `native` as erasable syntax; our page words it as "type-directed emit". No good non-official explanation found that was current for Vite 8 (results were Vite 6/7 era, Chinese-language source walkthroughs I did not fetch, and an env.dev note that only says the config runs before `.env`).

### T07-02b · `define` substitution and HTML `%VAR%` replacement — Topic · ✅ written `docs/vite/pages/07-env-variables-and-modes/02c-define-and-html-replacement.md`
Covers chunks 02c, 02d.
- **Read this:** [Shared Options: define](https://vite.dev/config/shared-options) · vite.dev · globals in dev, static replacement in build, done by Oxc, values must be a string with a JSON-serialisable value or a single identifier (*read*) · covers our angle: **full** for define · fetched 2026-10-14
- **Read this:** [Env Variables and Modes](https://vite.dev/guide/env-and-mode) · vite.dev · `%CONST_NAME%` in HTML; unknown names are left as-is, unlike `undefined` in JavaScript (*read*) · covers our angle: **full** for HTML · fetched 2026-10-14
- **Also good:** [Global variable replacement](https://oxc.rs/docs/guide/usage/transformer/global-variable-replacement) · Oxc · `define` keys can be identifiers, dotted members such as `import.meta.env.MODE`, or `typeof` forms; values are code, so a string needs its own quotes; objects are not shared; `inject` runs before `define` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Vite 環境で index.html から環境変数を参照する](https://dev.classmethod.jp/articles/vite-index-html-read-env-variables/) · cho-megumi, Classmethod, 2022-08-23 · the problem it reproduces (`import.meta` in an inline HTML script) and a `transformIndexHtml` plus `loadEnv` plugin; Japanese, tested on Vite 3.0.7, concept only, and the built-in `%CONST_NAME%` above now covers the plain case · fetched 2026-10-14 (*read*)
- **Our delta:** the failure a user sees (a literal `%VITE_X%` in the page) before any test does.

### T07-02c · Typing `import.meta.env`, types that lie, and the validation boundary — Topic · ✅ written `docs/vite/pages/07-env-variables-and-modes/02e-typing-import-meta-env.md`
Covers chunks 02e, 02f, 02g.
- **Read this:** [Env Variables and Modes](https://vite.dev/guide/env-and-mode) · vite.dev · augment `ImportMetaEnv` in `vite-env.d.ts`; a top-level `import` in that file breaks the augmentation (*read*) · covers our angle: **partial** — typing only, no validation · fetched 2026-10-14
- **Also good:** [Shared Options: define](https://vite.dev/config/shared-options) · vite.dev · declare `define` constants in `vite-env.d.ts` for type checks (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How to Type Environment Variables in TypeScript](https://blog.openreplay.com/type-environment-variables-typescript/) · OpenReplay Team, 2026-02-02 · types alone do not stop a missing value, with a Zod parse at startup; it has an `ImportMetaEnv` section, but the Zod example parses `process.env`, so adapt it for `import.meta.env` · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Validate env plugin for Vite](https://dev.to/julienr/validate-env-plugin-for-vite-mfb) · Julien Ripouteau, DEV Community, 2022-10-02 · a plugin (`@julr/vite-plugin-validate-env`) that fails the dev server or build on a bad variable and generates the types; the [repo README](https://github.com/Julien-R44/vite-plugin-validate-env) (*read*) is newer (standard-schema: Zod, Valibot, ArkType) but states no Vite range, so check Vite 8 support before use · fetched 2026-10-14 (*read*)
- **Our delta:** what CI must check because TypeScript cannot. The build-time plugin route fails earlier than our page's boot-time Zod example.
