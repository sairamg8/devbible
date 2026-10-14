---
title: "Link map · Vite · Part 1 (sections 01–07)"
sidebar_label: "01 · core to env"
sidebar_position: 1
---

# Link map · Vite · Part 1 (sections 01–07)

Covers sections 01 to 07 of `docs/vite/pages/`: core architecture, CLI and scaffolding, configuration, dev server mechanics, build system, asset handling, and env variables and modes. Sections 01 to 06 are one page each. Section 07 is two groups (G01 with 10 chunks, G02 with 8 chunks) and is split into three clusters each, so there are 12 blocks.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up after searching, the block has no "Beyond the docs" line.

🔴 **Version note.** Our pages say `Verified: 2026-09-06 … Vite 8.2.2 · Node.js 20.19+ / 22.12+`. The live vite.dev docs now render as v8.3.4, so wording can differ slightly from what we verified. Official links point at vite.dev (current major). Do not mix in v5 to v7 docs: they describe esbuild and Rollup, and a different default config loader. The Rolldown guide URL `vite.dev/guide/rolldown` now redirects to the v7 docs, so it is not used.

---

## Section 01 — Core architecture

### T01-01 · The dual-engine model — Topic · ✅ written `docs/vite/pages/01-core-architecture/01-dual-engine-model.md`
- **Read this:** [Announcing Vite 8](https://vite.dev/blog/announcing-vite8) · vite.dev blog · states the problem (esbuild in dev, Rollup in build, two plugin systems to keep aligned) and that Vite 8 ships Rolldown as one Rust bundler (*read*) · covers our angle: **partial** — says the engines merged, not how dev still serves native ESM · fetched 2026-10-14
- **Also good:** [Why Vite](https://vite.dev/guide/why) · vite.dev · native ESM dev server loads modules on request, while production still bundles to avoid round trips (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Migration from v7](https://vite.dev/guide/migration) · vite.dev · `rollupOptions` renamed `rolldownOptions`, esbuild no longer used directly, pre-bundling runs on Rolldown (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Vite v8 Rust (InfoQ)](https://infoq.com/news/2026/05/vite-v8-rust/) · Daniel Curtis, InfoQ, 2026-05-19 · plain news write-up of the dual-bundler problem and the 10 to 30x build claim · fetched 2026-10-14 (*read*)
- **Our delta:** the "dual-engine" framing, what stays native-ESM in dev, and the claim-by-claim check against the migration page.

## Section 02 — CLI and scaffolding

### T02-01 · `create vite` and the core commands — Topic · ✅ written `docs/vite/pages/02-cli-and-scaffolding/01-commands-and-templates.md`
- **Read this:** [Getting Started](https://vite.dev/guide/) · vite.dev · the `create vite` command per package manager, `--template`, the extra `--` on npm 7+, `.` for current directory, `--no-interactive`, template list, the three default scripts (*read*) · covers our angle: **full** for scaffolding — flags beyond these are in the CLI page · fetched 2026-10-14
- **Also good:** [Command Line Interface](https://vite.dev/guide/cli) · vite.dev · `vite`, `vite build`, `vite optimize` (marked deprecated), `vite preview`, and the options each takes; `--configLoader` is shared (*read*) · fetched 2026-10-14
- **Our delta:** which template picks a different compiler (the `react-compiler` variants), and the optimize deprecation as a gotcha.

## Section 03 — Configuration

### T03-01 · `vite.config.ts`, `defineConfig()` and conditional config — Topic · ✅ written `docs/vite/pages/03-configuration/01-vite-config-file.md`
- **Read this:** [Configuring Vite](https://vite.dev/config/) · vite.dev · config file resolution, `defineConfig`, the function form receiving `command`, `mode`, `isSsrBuild`, `isPreview`, and the warning to compare the last two explicitly (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Shared Options](https://vite.dev/config/shared-options) · vite.dev · `mode` precedence (CLI over config over default), `base`, `envDir`, `envPrefix` (*read*) · fetched 2026-10-14
- **Our delta:** the config-versus-CLI precedence told as one table. No good non-official explanation found that was current for Vite 8.

## Section 04 — Dev server mechanics

### T04-01 · Native ESM serving, HMR and dependency pre-bundling — Topic · ✅ written `docs/vite/pages/04-dev-server-mechanics/01-native-esm-and-hmr.md`
- **Read this:** [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling) · vite.dev · the two reasons (CommonJS and UMD compatibility, one request instead of 600 for `lodash-es`), dev only, cache keys, `--force`, the immutable browser cache (*read*) · covers our angle: **full** for pre-bundling · fetched 2026-10-14
- **Read this:** [HMR API](https://vite.dev/guide/api-hmr) · vite.dev · `accept`, `dispose`, `prune`, `data`, `invalidate`, `on`/`off`/`send`; `decline` is a no-op (*read*) · covers our angle: **full** for the client API · fetched 2026-10-14
- **Also good:** [Features](https://vite.dev/guide/features) · vite.dev · bare-import rewriting to `/node_modules/.vite/deps/` and which frameworks ship HMR integrations (*read*) · fetched 2026-10-14
- **Our delta:** why the browser sees rewritten URLs, and the order cache invalidation is decided in. No good non-official explanation found that was current for Vite 8.

## Section 05 — Build system

### T05-01 · `rolldownOptions`, chunk splitting and library mode — Topic · ✅ written `docs/vite/pages/05-build-system-rollup/01-build-options.md`
- **Read this:** [Build Options](https://vite.dev/config/build-options) · vite.dev · `build.rolldownOptions` (and `rollupOptions` as deprecated alias), `build.lib` formats and defaults, `build.target` default `baseline-widely-available`, chunk size warning limit (*read*) · covers our angle: **full** for options · fetched 2026-10-14
- **Read this:** [Building for Production](https://vite.dev/guide/build) · vite.dev · chunking through `output.codeSplitting`, library mode (externals, `globals`, `main`/`module`/`exports`), multi-page entries (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Migration from v7](https://vite.dev/guide/migration) · vite.dev · object-form `manualChunks` unsupported, function form deprecated, `codeSplitting` as the replacement (*read*) · fetched 2026-10-14
- **Our delta:** the sub-options of `codeSplitting` groups are not on these pages; see the Rolldown docs, which I did not fetch. No good non-official explanation found that was current for Vite 8.

## Section 06 — Asset handling

### T06-01 · Static imports, `public/` and special import suffixes — Topic · ✅ written `docs/vite/pages/06-asset-handling/01-static-asset-imports.md`
- **Read this:** [Static Asset Handling](https://vite.dev/guide/assets) · vite.dev · import returns the public URL, inlining under `assetsInlineLimit`, `?url`, `?raw`, `?inline` and `?no-inline`, and when `public/` is right (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Build Options](https://vite.dev/config/build-options) · vite.dev · `assetsInlineLimit` default 4096, `copyPublicDir`, and library mode ignoring the inline limit (*read*) · fetched 2026-10-14
- **Our delta:** hashing and cache consequences of choosing `public/` over an import. No good non-official explanation found that was current for Vite 8.

## Section 07 — Env variables and modes

### T07-01a · The env system, static replacement, the `VITE_` gate, built-in constants — Topic · ✅ written `docs/vite/pages/07-env-variables-and-modes/01-environment-system.md`
Covers chunks 01, 01a, 01b, 01c.
- **Read this:** [Env Variables and Modes](https://vite.dev/guide/env-and-mode) · vite.dev · `import.meta.env`, the five constants (`MODE`, `BASE_URL`, `PROD`, `DEV`, `SSR`) replaced at build time, `VITE_` exposure, values are strings, the secrets warning (*read*) · covers our angle: **full** for the rules, **partial** for cost and the auditing method · fetched 2026-10-14
- **Also good:** [Shared Options: envPrefix](https://vite.dev/config/shared-options) · vite.dev · default `VITE_`; an empty prefix would expose everything and Vite throws (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Build-Time vs Runtime Environment Variables](https://env.dev/guides/build-time-env-variables) · env.dev, updated 2026-06-23 · the `grep -rF` check on `dist/` for a baked-in value and the runtime-config options · generic, not Vite-specific · fetched 2026-10-14 (*read*)
- **Our delta:** one-artefact promotion, dynamic-key failures, bundle auditing for Vite 8 output.

### T07-01b · `BASE_URL`, `SSR`, modes versus `NODE_ENV`, modes in CI and containers — Topic · ✅ written `docs/vite/pages/07-env-variables-and-modes/01d-base-url-and-ssr.md`
Covers chunks 01d, 01e, 01f.
- **Read this:** [Env Variables and Modes](https://vite.dev/guide/env-and-mode) · vite.dev · `dev` defaults to development, `build` to production, `--mode` picks the `.env.[mode]` file, and `NODE_ENV=development vite build` still runs in production mode (*read*) · covers our angle: **full** for the axes, **partial** for CI and containers · fetched 2026-10-14
- **Also good:** [Shared Options: mode and base](https://vite.dev/config/shared-options) · vite.dev · mode precedence and the forms `base` accepts, which `BASE_URL` mirrors (*read*) · fetched 2026-10-14
- **Also good:** [Command Line Interface](https://vite.dev/guide/cli) · vite.dev · `vite preview` takes `--mode`, `--outDir` and `--base` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Fix Undefined Vite Environment Variables on Cloud Run](https://oneuptime.com/blog/post/2026-09-13-vite-env-undefined-cloud-run/view) · OneUptime, 2026-09-13 per the URL, not confirmed on the page · container-side view of why a runtime variable never reaches the bundle · fetched 2026-10-14 (*headings only*)
- **Our delta:** the two-axes table and the CI job layout. `SSR` as a constant, not an access control, is our own point.

### T07-01c · `dotenv-expand`, composition and sharing one `.env` across tools — Topic · ✅ written `docs/vite/pages/07-env-variables-and-modes/01g-dotenv-expansion.md`
Covers chunks 01g, 01h, 01i.
- **Read this:** [Env Variables and Modes](https://vite.dev/guide/env-and-mode) · vite.dev · `$KEY` expansion, `\$` for a literal dollar, and the advice not to rely on forward references that shells and docker compose do not support; load order and priority of already-set variables (*read*) · covers our angle: **partial** — the one paragraph the whole cluster elaborates · fetched 2026-10-14
- **Also good:** [motdotla/dotenv-expand](https://github.com/motdotla/dotenv-expand) · upstream README · `$VAR` and braced forms, `${MISSING:-default}`, alternate-value form, the `processEnv` option; escaping is not documented there (*read*) · fetched 2026-10-14
- **Our delta:** reverse-order expansion and the "shared file is not a single source of truth" argument. Not on the docs side. No good non-official explanation found.

### T07-02a · Why the config cannot read its own `.env`, `loadEnv`, conditional config and the config loader — Topic · ✅ written `docs/vite/pages/07-env-variables-and-modes/02-config-time-env-and-define.md`
Covers chunks 02, 02a, 02b.
- **Read this:** [Configuring Vite](https://vite.dev/config/) · vite.dev · `.env*` files load after the config resolves, `loadEnv(mode, process.cwd(), '')` for all variables, the `bundle` default loader with Rolldown, `--configLoader native`, planned default in a future major, and the debugging note for breakpoints (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Command Line Interface](https://vite.dev/guide/cli) · vite.dev · `--configLoader` listed as a common option (*read*) · fetched 2026-10-14
- **Our delta:** why `process.env` is empty in the config, and the two flags that are not booleans. No good non-official explanation found that was current for Vite 8 (search results were Vite 6/7 era or Chinese-language source walkthroughs I did not fetch).

### T07-02b · `define` substitution and HTML `%VAR%` replacement — Topic · ✅ written `docs/vite/pages/07-env-variables-and-modes/02c-define-and-html-replacement.md`
Covers chunks 02c, 02d.
- **Read this:** [Shared Options: define](https://vite.dev/config/shared-options) · vite.dev · globals in dev, static replacement in build, done by Oxc, values must be JSON-serialisable or a single identifier (*read*) · covers our angle: **full** for define · fetched 2026-10-14
- **Read this:** [Env Variables and Modes](https://vite.dev/guide/env-and-mode) · vite.dev · `%CONST_NAME%` in HTML; unknown names are left as-is, unlike `undefined` in JavaScript (*read*) · covers our angle: **full** for HTML · fetched 2026-10-14
- **Beyond the docs:** [Vite 環境で index.html から環境変数を参照する](https://dev.classmethod.jp/articles/vite-index-html-read-env-variables/) · cho-megumi, Classmethod, 2022-08-23 · the problem it reproduces (`import.meta` in an inline HTML script) and a `transformIndexHtml` plus `loadEnv` plugin; Japanese, written for Vite 3, concept only · fetched 2026-10-14 (*read*)
- **Our delta:** the failure a user sees (a literal `%VITE_X%` in the page) before any test does.

### T07-02c · Typing `import.meta.env`, types that lie, and the validation boundary — Topic · ✅ written `docs/vite/pages/07-env-variables-and-modes/02e-typing-import-meta-env.md`
Covers chunks 02e, 02f, 02g.
- **Read this:** [Env Variables and Modes](https://vite.dev/guide/env-and-mode) · vite.dev · augment `ImportMetaEnv` in `vite-env.d.ts`; a top-level `import` in that file breaks the augmentation (*read*) · covers our angle: **partial** — typing only, no validation · fetched 2026-10-14
- **Also good:** [Shared Options: define](https://vite.dev/config/shared-options) · vite.dev · declare `define` constants in `vite-env.d.ts` for type checks (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How to Type Environment Variables in TypeScript](https://blog.openreplay.com/type-environment-variables-typescript/) · OpenReplay Team, 2026-02-02 · types alone do not stop a missing value, with a Zod parse at startup; the Zod example parses `process.env`, so adapt it for `import.meta.env` · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Validate env plugin for Vite](https://dev.to/julienr/validate-env-plugin-for-vite-mfb) · Julien Ripouteau, DEV Community, 2022-10-02 · a plugin that fails the dev server or build on a bad variable and generates the types; written in 2022, check the package's current Vite support before use · fetched 2026-10-14 (*read*)
- **Our delta:** what CI must check because TypeScript cannot.
