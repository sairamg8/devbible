---
title: "Link map · Vite · Part 4 (sections 14–16)"
sidebar_label: "04 · testing deploy migration"
sidebar_position: 4
---

# Link map · Vite · Part 4 (sections 14–16)

Covers sections 14 (testing integration), 15 (deployment considerations) and 16 (migration recipes) of `docs/vite/pages/`. Each section is one numbered topic page split into chunks (10, 15 and 15 chunk files), so each is written as several blocks, one per cluster of chunks. IDs are `T<section>-01a`, `T<section>-01b` and so on; the path is the first chunk of the cluster.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up after searching, the block has no "Beyond the docs" line.

🔴 **Version note.** Our pages were verified on 2026-09-08 against Vite 8 (Rolldown, Oxc) and a Vitest that the docs now label 5.0 (the live migration guide is titled "Migrating to Vitest 5.0"). Official picks are vite.dev, rolldown.rs and vitest.dev. Several migration-era third-party picks (Robin Wieruch 2023, Cassidy Williams 2023) were written for Vite 4 and esbuild: the concepts hold, but `esbuild.*` options are now `oxc.*`, and the default build target moved (Vite 8 migration guide). Each such block says so.

---

## Section 14 — Testing integration

### T14-01a · Vitest and Vite: shared config, transform boundary, environments — Topic · ✅ written `docs/vite/pages/14-testing-integration/01-vitest-relationship.md`
- **Read this:** [Configuring Vitest](https://vitest.dev/config/file) · vitest.dev · states that a `vitest.config.ts` has higher priority and overrides `vite.config.ts`, with the `mergeConfig` pattern for keeping both · (*read*) · covers our angle: **full** for the replace-not-layer rule · fetched 2026-10-14
- **Also good:** [server](https://vitest.dev/config/server) · vitest.dev · `server.deps.external` means the engine loads it directly, `server.deps.inline` means Vite transforms it; note the `server` option is marked deprecated on the live page (*read*) · fetched 2026-10-14
- **Also good:** [Test Environment](https://vitest.dev/guide/environment) · vitest.dev · `node` default, `jsdom`, `happy-dom`, `edge-runtime`, per-file control comment, and "browser is not an environment, create a project" (*read*) · fetched 2026-10-14
- **Our delta:** `test.deps.optimizer` as the third mechanism, and the exact `environmentMatchGlobs` removal. I could not confirm that removal on the official pages; only third-party blogs state it, so treat that sentence as unconfirmed.

### T14-01b · Browser Mode and mocking — Topic · ✅ written `docs/vite/pages/14-testing-integration/01c-browser-mode.md`
- **Read this:** [Browser Mode](https://vitest.dev/guide/browser/) · vitest.dev · installation, the three providers (preview, playwright, webdriverio), and "always requires a provider"; the page never says "experimental" (*read*) · covers our angle: **partial** — no component-vs-E2E comparison · fetched 2026-10-14
- **Read this (mocking):** [vi](https://vitest.dev/api/vi) · vitest.dev · `vi.mock` is moved to the top of the file, a factory cannot use outside variables unless they come from `vi.hoisted`, `vi.doMock` is the unhoisted alternative (*read*) · covers our angle: **full** except the Vitest 5 throw-on-unhoistable change · fetched 2026-10-14
- **Also good:** [Mocking](https://vitest.dev/guide/mocking) · vitest.dev · cheat sheet with a one-line hoisting warning (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Vitest Browser Mode vs Playwright](https://epicweb.dev/vitest-browser-mode-vs-playwright) · Artem Zakharchenko, Epic Web, 2025-11-12 · Browser Mode runs the test file in the browser (component level), Playwright is E2E with page as the unit · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [vi.mock hoists. Your closure variables do not.](https://mergify.com/blog/vitest-vimock-hoisting-traps) · Rémy Duthu, Mergify, 2026-05-11 · the ReferenceError, why declaring inside the factory loses the handle, and the `vi.hoisted` fix; the post is part of a vendor guide that promotes Mergify's product · fetched 2026-10-14 (*read*)
- **Our delta:** Vitest 5 throwing where 4 warned, and why Browser Mode does not replace a Playwright suite.

### T14-01c · Setup files, coverage and in-source testing — Topic · ✅ written `docs/vite/pages/14-testing-integration/01e-setup-and-teardown.md`
- **Read this:** [setupFiles](https://vitest.dev/config/setupfiles) · vitest.dev · runs in the same process as tests, before each test file, unlike `globalSetup`, which runs once in the main thread before any worker exists (*read*) · covers our angle: **partial** — `globalSetup` has its own config page, not fetched · fetched 2026-10-14
- **Read this (coverage):** [Coverage](https://vitest.dev/guide/coverage) · vitest.dev · V8 is the default and runs without instrumentation; since 3.2.0 AST-based remapping gives reports the page describes as matching Istanbul; Istanbul works on any runtime (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Read this (in-source):** [In-Source Testing](https://vitest.dev/guide/in-source) · vitest.dev · setting `import.meta.vitest` to `undefined` through `define` lets the bundler drop the test blocks as dead code (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Vitest Setup Files vs Global Setup: Choose the Correct Lifecycle](https://qaskills.sh/blog/vitest-setup-files-vs-global-setup) · QASkills.sh (author not named), 2026-08-07 · ownership matrix, `provide` and `inject` for passing values out of global setup, `EADDRINUSE` from top-level server code · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [V8 Coverage vs Istanbul: Performance and Accuracy](https://dev.to/stevez/v8-coverage-vs-istanbul-performance-and-accuracy-3ei8) · Steve Zhang, DEV Community, year not shown · the instrumentation-versus-engine model and "do not merge the two"; its claim that V8 is less accurate predates the 3.2.0 remapping change, so the official page wins on accuracy · fetched 2026-10-14 (*read*)
- **Our delta:** none for in-source testing: no good non-official explanation found after searching.

### T14-01d · CI execution, reporters and migrating from Jest — Topic · ✅ written `docs/vite/pages/14-testing-integration/01h-ci-execution-and-reporters.md`
- **Read this:** [Command Line Interface](https://vitest.dev/guide/cli) · vitest.dev · `vitest` runs once in CI or without a TTY, `vitest run`, `--reporter` values, `--outputFile`; several defaults depend on `process.env.CI` (*read*) · covers our angle: **partial** — the page does not say `forks` is the default pool, and I did not check the Vitest 5 stdout change · fetched 2026-10-14
- **Read this (Jest):** [Migrating from Jest](https://vitest.dev/guide/migration/jest) · vitest.dev · hooks run as a stack unless `sequence.hooks` is `'list'`; `__mocks__` loads only when `vi.mock()` is called; a factory must name each export (*read*) · covers our angle: **partial** — the page has no hoisting section · fetched 2026-10-14
- **Also good:** [Migration Guide](https://vitest.dev/guide/migration) · vitest.dev · Vitest 5.0 breaking changes, including "Hoisted Mocking Calls Must Be at the Top Level" and `clearMocks` on by default (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Migration from Jest to Vitest: A Real-World Experience with 2900+ Tests](https://dev.to/56_kode/migration-from-jest-to-vitest-a-real-world-experience-with-2900-tests-39np) · 56kode, DEV Community, 2024-12-18 · uneven speed gains, empty snapshots Jest had passed, Happy DOM swap; written for Vitest 2 era · fetched 2026-10-14 (*read*)
- **Our delta:** the `forks` default pool and the Vitest 5 reporter-stdout change need a primary source we did not find.

## Section 15 — Deployment considerations

### T15-01a · `base`, `dist/` shape, `public/` and `vite preview` — Topic · ✅ written `docs/vite/pages/15-deployment-considerations/01-shipping-the-build.md`
- **Read this:** [Building for Production](https://vite.dev/guide/build) · vite.dev · Public Base Path: `base` rewrites asset paths, `import.meta.env.BASE_URL` for runtime URLs, relative base needs `import.meta` support (*read*) · covers our angle: **full** for base · fetched 2026-10-14
- **Also good:** [Deploying a Static Site](https://vite.dev/guide/static-deploy) · vite.dev · project sites on a subpath need `base` set to the repo name; `vite preview` "not meant as a production server" (*read*) · fetched 2026-10-14
- **Also good:** [Build Options](https://vite.dev/config/build-options) · vite.dev · `outDir` (`dist`), `assetsDir` (`assets`), `emptyOutDir` (true when inside root) (*read*) · fetched 2026-10-14
- **Also good:** [Static Asset Handling](https://vite.dev/guide/assets) · vite.dev · `public/` is for files never referenced in source, files needing exact names, or URLs without an import; copied unchanged, referenced as `/icon.png` (*read*) · fetched 2026-10-14
- **Our delta:** the "green build, blank page" diagnosis walk-through; no good non-official explanation found after searching (results were forum threads).

### T15-01b · SPA fallback, caching and library mode — Topic · ✅ written `docs/vite/pages/15-deployment-considerations/01d-spa-fallback-hosted-platforms.md`
- **Read this:** [Rewrites and proxies](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/) · Netlify Docs · a 200 status makes a redirect a rewrite; `/*  /index.html  200` for pushState apps; does not override existing files unless `200!` (*read*) · covers our angle: **partial** — one hosted platform only · fetched 2026-10-14
- **Also good:** [Generate custom error responses](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/GeneratingCustomErrorResponses.html) · AWS CloudFront guide · the topic index only; the 403/404 to 200 mapping lives on its sub-page "Change response codes returned by CloudFront", which I did not fetch (*headings only*) · fetched 2026-10-14
- **Also good:** [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) · nginx.org · `try_files` checks files in order and uses the first found (*read*) · fetched 2026-10-14
- **Also good:** [HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching) · MDN · cache busting with hashed filenames and `public, max-age=31536000, immutable`; the HTML main resource uses `no-cache` (*read*) · covers our angle: **full** for the caching rule · fetched 2026-10-14
- **Beyond the docs:** [How to Fix Cannot GET Errors After Deploying an SPA](https://blog.openreplay.com/fix-cannot-get-spa-deployment/) · OpenReplay Team, 2026-09-08 · one table of nginx, Apache, Netlify, Vercel and S3 plus CloudFront fixes, and the soft-404 trade-off · fetched 2026-10-14 (*read*)
- **Our delta:** library-mode deployment and Apache details; I did not confirm the Apache rule against Apache docs.

### T15-01c · Build target, env baking and production sourcemaps — Topic · ✅ written `docs/vite/pages/15-deployment-considerations/01g-build-target-and-legacy-browsers.md`
- **Read this:** [Building for Production](https://vite.dev/guide/build) · vite.dev · Browser Compatibility: default targets Baseline Widely Available, lower targets still need native dynamic import and `import.meta`, no polyfills, `@vitejs/plugin-legacy` for older browsers (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Env Variables and Modes](https://vite.dev/guide/env-and-mode) · vite.dev · `import.meta.env` constants are "statically replaced at build time" (*read*) · fetched 2026-10-14
- **Also good:** [Build Options](https://vite.dev/config/build-options) · vite.dev · `build.target` default `'baseline-widely-available'` as of 2026-01-01; `build.sourcemap` values `true`, `'inline'`, `'hidden'` (*read*) · fetched 2026-10-14
- **Also good:** [Vite for Express (source map upload)](https://docs.sentry.io/platforms/javascript/guides/express/sourcemaps/uploading/vite/) · Sentry docs · vendor docs: `"hidden"` plus `filesToDeleteAfterUpload`, or deny `.js.map` on the server (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Runtime Environment Variables for React Apps with Nginx and Docker](https://dev.to/imzihad21/runtime-environment-variables-for-react-apps-with-nginx-and-docker-3p62) · ZèD (imzihad21), DEV Community, 2025-12-25 · template file plus `envsubst` at container start, loaded before the bundle, public values only; not Vite-specific · fetched 2026-10-14 (*read*)
- **Our delta:** the "fetch a config file" variant and why `hidden` still writes the file.

### T15-01d · SSR deploy, manifest and module preload — Topic · ✅ written `docs/vite/pages/15-deployment-considerations/01j-deploying-an-ssr-node-app.md`
- **Read this:** [Server-Side Rendering](https://vite.dev/guide/ssr) · vite.dev · Building for Production (client build to `dist/client`, `--ssr` build to `dist/server`), SSR Externals, `ssr.noExternal` (*read*) · covers our angle: **partial** — no container-image reasoning · fetched 2026-10-14
- **Read this (manifest):** [Backend Integration](https://vite.dev/guide/backend-integration) · vite.dev · `build.manifest: true` writes `.vite/manifest.json`; shape of a chunk entry; add `import 'vite/modulepreload-polyfill'` at the start of the entry when you own the template (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Speculative loading](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Speculative_loading) · MDN · `modulepreload` fetches, parses and compiles a module into the module map, unlike plain `preload` (*read*) · fetched 2026-10-14
- **Our delta:** no good non-official explanation found after searching (the backend-manifest search returned only Vite's own page and a .NET tutorial).

### T15-01e · Content Security Policy and Docker build args — Topic · ✅ written `docs/vite/pages/15-deployment-considerations/01m-content-security-policy.md`
- **Read this:** [Features](https://vite.dev/guide/features) · vite.dev · `html.cspNonce` adds a nonce to script, style and link tags plus a `csp-nonce` meta tag; the placeholder must be replaced per request (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) · MDN · nonces must differ per response and cannot be used with static HTML (*read*) · fetched 2026-10-14
- **Read this (Docker):** [Build variables](https://docs.docker.com/build/building/variables/) · Docker Docs · `ARG` is absent from containers unless passed in, `ENV` persists; neither is for secrets (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** none: no good non-official explanation found after searching.

## Section 16 — Migration recipes

### T16-01a · CRA to Vite: structural inversion, env vars and JSX extensions — Topic · ✅ written `docs/vite/pages/16-migration-recipes/01-cra-to-vite-migration.md`
- **Read this:** [Getting Started](https://vite.dev/guide/) · vite.dev · "index.html and Project Root": `index.html` is the entry in the module graph, URLs are rebased so `%PUBLIC_URL%` is not needed (*read*) · covers our angle: **full** for the inversion · fetched 2026-10-14
- **Also good:** [Env Variables and Modes](https://vite.dev/guide/env-and-mode) · vite.dev · `VITE_` prefix exposure, `import.meta.env`, HTML constant replacement (*read*) · fetched 2026-10-14
- **Also good:** [Sunsetting Create React App](https://react.dev/blog/2025/02/14/sunsetting-create-react-app) · react.dev · why CRA is deprecated and the option of moving to Vite, Parcel or Rsbuild (*read*) · fetched 2026-10-14
- **Also good:** [Migration from v7](https://vite.dev/guide/migration) · vite.dev · `esbuild` options become `oxc`, `oxc.jsx` mapping (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Migrate to Vite from Create React App (CRA)](https://www.robinwieruch.de/vite-create-react-app/) · Robin Wieruch, 2023-03-29 · env prefix, moving `index.html`, renaming `.js` to `.jsx`; the CRA sunset post itself links to it; pre-Vite 8, so it does not say Oxc decides JSX from the extension · fetched 2026-10-14 (*read*)
- **Our delta:** the Oxc extension-only JSX rule is not stated on any page I read; our own page cites Shared Options for it.

### T16-01b · CRA leftovers: aliases, SVG, proxy and eject — Topic · ✅ written `docs/vite/pages/16-migration-recipes/01c-absolute-imports-and-path-aliases.md`
- **Read this:** [Importing a Component](https://create-react-app.dev/docs/importing-a-component/) · Create React App docs · absolute imports via `baseUrl: "src"` in `jsconfig.json` or `tsconfig.json`, the narrow feature our page contrasts with (*read*) · covers our angle: **partial** — the CRA side only · fetched 2026-10-14
- **Also good:** [Shared Options](https://vite.dev/config/shared-options) · vite.dev · `resolve.alias`, `resolve.tsconfigPaths` (default false, only for files in the tsconfig `include`), `oxc`, `define` (*read*) · fetched 2026-10-14
- **Also good:** [Server Options](https://vite.dev/config/server-options) · vite.dev · `server.proxy` syntax; compare with the CRA side: [Proxying API Requests in Development](https://create-react-app.dev/docs/proxying-api-requests-in-development/) (*read*) · fetched 2026-10-14
- **Also good:** [Available Scripts](https://create-react-app.dev/docs/available-scripts/) · CRA docs · `npm run eject` is one-way and copies webpack and Babel config into the project (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Importing SVG files as React components with Vite](https://cassidoo.co/post/svg-react-vite/) · Cassidy Williams, 2023-01-06 · CRA gave an SVG component for free and Vite does not; pair it with the plugin README [vite-plugin-svgr](https://github.com/pd4d10/vite-plugin-svgr), which shows the current `?react` suffix (the post predates it) · fetched 2026-10-14 (*read*)
- **Our delta:** PWA replacement and CRACO analysis; no good explanation found after searching.

### T16-01c · webpack entry, devServer, `require.context` and CommonJS — Topic · ✅ written `docs/vite/pages/16-migration-recipes/01g-entry-output-and-base.md`
- **Read this:** [Features](https://vite.dev/guide/features) · vite.dev · Glob Import: lazy by default, `eager: true`, patterns must be literals, relative, root-absolute or alias (*read*) · covers our angle: **full** for the literal-argument constraint · fetched 2026-10-14
- **Read this (webpack side):** [Dependency Management](https://webpack.js.org/guides/dependency-management/) · webpack docs · `require.context(directory, useSubdirectories, regExp, mode)` and "The arguments passed to `require.context` must be literals" (*read*) · fetched 2026-10-14
- **Also good:** [DevServer](https://webpack.js.org/configuration/dev-server/) · webpack docs · the `historyApiFallback` and `proxy` options our page maps from (*read*) · fetched 2026-10-14
- **Also good:** [Modules: CommonJS modules](https://nodejs.org/api/modules.html) · Node.js docs · the module wrapper that supplies `require`, `module`, `exports`, `__filename`, `__dirname` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How we migrated to ViteJS](https://retool.com/blog/vitejs-migration) · Juan Lasheras, Retool, 2025-04-16 · converting CommonJS source to ESM, `require` forcing async rewrites, Jest ESM trouble, and a cookie plus Nginx gradual rollout; it was a Rollup-era migration, so its bundle-size findings are pre-Rolldown · fetched 2026-10-14 (*read*)
- **Our delta:** `outDir`, `assetsDir` and `base` as the only output knobs is covered in the Build Options page above, not in a migration guide.

### T16-01d · Loaders, `define`, `splitChunks`, `noParse` and Module Federation — Topic · ✅ written `docs/vite/pages/16-migration-recipes/01k-loaders-define-and-mode.md`
- **Read this:** [codeSplitting](https://rolldown.rs/reference/OutputOptions.codeSplitting) · rolldown.rs · `groups` with `name`, `test`, `priority`, `minSize`, `maxSize`; the page does not define `priority`, only shows it in examples (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Manual Code Splitting](https://rolldown.rs/in-depth/advanced-chunks) · rolldown.rs · why and how to group, `maxSize` behaviour; does not cover priority either (*read*) · fetched 2026-10-14
- **Also good:** [SplitChunksPlugin](https://webpack.js.org/plugins/split-chunks-plugin/) · webpack docs · `cacheGroups`, `test`, `priority` (higher wins), the model our page maps from (*read*) · fetched 2026-10-14
- **Also good:** [Module](https://webpack.js.org/configuration/module/) · webpack docs · `module.noParse` text (*read*) · fetched 2026-10-14
- **Read this (federation):** [ModuleFederationPlugin](https://webpack.js.org/plugins/module-federation-plugin/) · webpack docs · `exposes`, `remotes`, `shared` with `singleton`, `requiredVersion`, `strictVersion` (*read*), and [Vite Module Federation Plugin](https://module-federation.io/integrations/build-tool/vite) · module-federation.io · install, `module-federation.config.ts`, register in Vite; all options but `dev` supported (*headings only*) · covers our angle: **partial** — nothing on publish-date vetting · fetched 2026-10-14
- **Also good:** [Migration from v7](https://vite.dev/guide/migration) · vite.dev · object `manualChunks` removed, function form deprecated, `codeSplitting` is the replacement; `define` and `mode` are on the Shared Options and Env pages above (*read*) · fetched 2026-10-14
- **Our delta:** the `define` and `--mode` translation tables; the blog guides I found were generic webpack-to-Vite listings (PkgPulse, knowledgelib) of uneven quality and were left out. The Vite 8 `codeSplitting` option itself is better explained on the Rolldown pages than on any article I found.
