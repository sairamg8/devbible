---
title: "Link map · Vite · Part 5 (sections 17–18)"
sidebar_label: "05 · toolchain microservices"
sidebar_position: 5
---

# Link map · Vite · Part 5 (sections 17–18)

Covers section 17 (the 2026 toolchain landscape) and section 18 (microservices architecture) of `docs/vite/pages/`. The track has no syllabus, so topics come from our page tree: 3 topic groups in section 17 and 9 in section 18. Groups with several chunks (the dev proxy, Module Federation, and four two-chunk groups) are split into clusters, which gives 3 + 16 = 19 blocks, and every one has a written page of ours.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up after searching, the block has no "Beyond the docs" line. Three pages (SitePoint, the wala.bearblog post, docs.webpack.js.org) did not load for me and are not used.

🔴 **Version note.** Our pages were verified on 2026-09-07 and 2026-09-08 against Vite 8 and Rolldown. The Vite docs I fetched on 2026-10-14 are the v8.3.4 build. Rolldown reached 1.0 on 2026-05-07, and Vite+ reached 1.0 on 2026-09-28, which is after our section 17 pages were verified. Check `docs/vite/pages/17-the-2026-toolchain-landscape/` for Vite+ wording before trusting it. Official sources here are vite.dev, rolldown.rs, oxc.rs, module-federation.io and webpack.js.org (for the shared-option semantics Module Federation inherits), plus MDN for browser behaviour.

---

## Section 17 — The 2026 toolchain landscape

### T17-01 · The 2026 bundler landscape and choosing one — Topic · ✅ written `docs/vite/pages/17-the-2026-toolchain-landscape/01-the-2026-bundler-landscape.md`
- **Read this:** [Why Vite](https://vite.dev/guide/why) · vite.dev · why bundling is still needed in production, and the "A Unified Toolchain" section on Rolldown and Oxc replacing esbuild and Rollup (*read*) · covers our angle: **partial** — states Vite's own position, not the other four bundlers or how to choose · fetched 2026-10-14
- **Also good:** [Rolldown introduction](https://rolldown.rs/guide/introduction) · rolldown.rs · what Rolldown is and that it is "primarily designed to serve as the underlying bundler in Vite"; the page still lists minification and HMR as work in progress, so it lags the 1.0 release (*read*) · fetched 2026-10-14
- **Also good:** [Vite 8.0 is out](https://vite.dev/blog/announcing-vite8) · vite.dev blog, 2026-03-12 · Vite 8 replaces esbuild plus Rollup with Rolldown, claims builds up to 10-30x faster with plugins still working (*read*) · fetched 2026-10-14
- **Our delta:** the five-bundler comparison and the decision rule "match the change to the complaint". No official page compares competing bundlers, because each project documents only itself.

### T17-02 · What transfers from webpack to Vite — Topic · ✅ written `docs/vite/pages/17-the-2026-toolchain-landscape/02-webpack-to-vite-parity.md`
- **Read this:** [Migration from v7](https://vite.dev/guide/migration) · vite.dev · official, but it is Vite 7 to 8, not webpack to Vite; its Rolldown section covers `manualChunks` object form removal and CommonJS interop, which bite webpack ports (*read*) · covers our angle: **partial** — no webpack mapping at all · fetched 2026-10-14
- **Also good:** [Features](https://vite.dev/guide/features) · vite.dev · built-in handling that deletes loaders: npm dependency pre-bundling, `new Worker(new URL(...))`, glob import (the `require.context` replacement) (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Migrating Webpack to Vite 2026: Large App Guide](https://www.pkgpulse.com/guides/webpack-to-vite-migration-large-codebases-2026) · PkgPulse Team, 2026-03-16 · a webpack-to-Vite mapping table: `splitChunks` to `manualChunks` (with the Vite 8 `advancedChunks` note), `ProvidePlugin` to a polyfill plugin, `DefinePlugin` to `define`, custom loaders to `transform` hooks · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [How we migrated to ViteJS](https://retool.com/blog/vitejs-migration) · Juan Lasheras, Retool, 2025-04-16 · a real migration: old packages assuming Node builtins, and Rollup producing more chunks than webpack because it does not duplicate shared code (*read*) · fetched 2026-10-14
- **Our delta:** the three capabilities with no Vite equivalent (`splitChunks` duplication, `ProvidePlugin`, Node built-ins) and the four things a hasty loader port drops. The two third-party pages give the mapping and the chunk-duplication surprise, but neither lists what a loader port loses. Retool does not discuss loaders directly.

### T17-03 · The adjacent toolchain: lint, format, test, package managers — Topic · ✅ written `docs/vite/pages/17-the-2026-toolchain-landscape/03-the-adjacent-toolchain.md`
- **Read this:** [Oxlint overview](https://oxc.rs/docs/guide/usage/linter) · oxc.rs · what Oxlint is, 871 built-in rules, type-aware linting through the TypeScript Go port, and the project's own claim of 50 to 100 times faster than ESLint, which is a vendor benchmark (*read*) · covers our angle: **partial** — lint only, nothing on formatter, test runner or package managers · fetched 2026-10-14
- **Also good:** [Announcing Vite+ 1.0](https://voidzero.dev/posts/announcing-vite-plus-1-0) · VoidZero, 2026-09-28 · `vp` commands: `check` (Oxfmt plus Oxlint), `test` (Vitest 5), `build`, `pack` (tsdown), `run`; MIT licensed (*read*) · fetched 2026-10-14
- **Also good:** [Announcing Vite+ Alpha](https://voidzero.dev/posts/announcing-vite-plus-alpha) · VoidZero, 2026-03-13 · the first bundle list; superseded by the 1.0 post, kept for the history (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Four months of VoidZero at Cloudflare](https://blog.cloudflare.com/voidzero-update/) · Cloudflare Blog, 2026-09-28 · progress report: Vitest 5, stable tsgolint, Oxfmt formatters in Rust, and the ownership change; every speed figure is a vendor claim (*read*) · fetched 2026-10-14
- **Our delta:** our page predates Vite+ 1.0 (verified 2026-09-07), so it may call Vite+ alpha or beta. Check that line. Package managers are not covered by any of the picks.

---

## Section 18 — Microservices architecture

### T18-01 · What microservices mean to a Vite build, and the BFF — Topic · ✅ written `docs/vite/pages/18-microservices-architecture/01-what-microservices-mean-to-a-vite-build.md`
- **Read this:** [Backends for Frontends pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/backends-for-frontends) · Microsoft Azure Architecture Center, updated 2026 · one backend per frontend, the extra network hop, when it does not pay off, and the API-gateway alternative (*read*) · covers our angle: **partial** — the server side only; the browser's seven-DNS, seven-handshake cost is not discussed · fetched 2026-10-14
- **Also good:** [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) · MDN · preflight and credentialed requests, the cost our fan-out argument counts (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Backends For Frontends](https://samnewman.io/patterns/architectural/bff/) · Sam Newman, 2015-11-18 · the original pattern: "one experience, one BFF", with team ownership deciding how many (*read*) · fetched 2026-10-14
- **Our delta:** the three shapes in which "microservices" reaches a Vite build, and the point that no bundler option fixes the fan-out.

### T18-02a · The dev proxy against many services — Topic · ✅ written `docs/vite/pages/18-microservices-architecture/02-the-dev-proxy-against-many-services.md`
- **Read this:** [Server Options: server.proxy](https://vite.dev/config/server-options) · vite.dev (v8.3.4) · path-prefix or `^` regexp keys, options extend `http-proxy-3`, `target`, `changeOrigin`, `rewrite`, `ws`, `configure` (*read*) · covers our angle: **full** for the options; no deployment-shape rationale · fetched 2026-10-14
- **Our delta:** why each option exists (forty services behind one origin). The docs list the options and do not say which real deployment needed which. No good non-official page found; the blog posts surfaced only repeat the basic `target` example.

### T18-02b · CORS, cookies and the proxy hiding them — Topic · ✅ written `docs/vite/pages/18-microservices-architecture/02a-cors-cookies-and-websockets-through-the-proxy.md`
- **Read this:** [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) · MDN · `credentials: "include"`, no wildcard `Access-Control-Allow-Origin` with credentials, third-party cookies and `SameSite` (*read*) · covers our angle: **partial** — the rules the proxy hides, but nothing about Vite · fetched 2026-10-14
- **Also good:** [Server Options](https://vite.dev/config/server-options) · vite.dev · the section intro says options apply to dev only unless noted, which is why the proxy is absent in a deploy (*read*) · fetched 2026-10-14
- **Our delta:** the argument that a same-origin dev proxy hides these bugs until deploy. I found no authoritative source that makes that argument; blog posts assert it, none cites a spec.

### T18-02c · WebSocket origin checks, HMR and the vite preview recipe — Topic · ✅ written `docs/vite/pages/18-microservices-architecture/02a2-websocket-origin-checks-and-the-preview-verification-recipe.md`
- **Read this:** [Server Options: server.proxy and server.ws](https://vite.dev/config/server-options) · vite.dev · Vite does not check WebSocket request origins before proxying, `rewriteWsOrigin` bypasses the target's check, and HMR falls back to a direct connection when a front proxy lacks WebSocket support (*read*) · covers our angle: **full** for the warning and the fallback · fetched 2026-10-14
- **Also good:** [Deploying a Static Site](https://vite.dev/guide/static-deploy) · vite.dev · `vite preview` serves `dist` on port 4173 and "is not meant as a production server" (*read*) · covers our angle: **partial** — the command, not our verification recipe · fetched 2026-10-14
- **Our delta:** the preview-based recipe and the point that `configure` and `ws` never reach the build (chunk 02b). The `proxy` section does not say dev-only itself; only the section intro does.

### T18-03 · Service URLs baked in at build time, and runtime config — Topic · ✅ written `docs/vite/pages/18-microservices-architecture/03-service-urls-are-baked-in-at-build-time.md`
- **Read this:** [Env Variables and Modes](https://vite.dev/guide/env-and-mode) · vite.dev · `import.meta.env` is replaced at build, only `VITE_` variables are exposed, and they "should not contain sensitive information" (*read*) · covers our angle: **partial** — the problem, but no fix and no mention of promoting one build across environments · fetched 2026-10-14
- **Beyond the docs:** [Fix Undefined Vite Environment Variables on Cloud Run](https://oneuptime.com/blog/post/2026-09-13-vite-env-undefined-cloud-run/view) · OneUptime, 2026-09 · build-arg versus a `/runtime-config.json` route with `Cache-Control: no-store`; its own examples are marked untested on a real project (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Setting up dynamic environment variables with Vite and Docker](https://dev.to/dutchskull/setting-up-dynamic-environment-variables-with-vite-and-docker-5cmj) · Dutchskull, DEV Community, 2024-06-18 · placeholder values baked at build, then `sed` at container start before Nginx serves; the one comment on the post questions its security (*read*) · fetched 2026-10-14
- **Our delta:** the argument that one bundle welded to one environment cannot be promoted. Vite has no official page on runtime config, so the fix is entirely community pattern.

### T18-04 · One repo, many Vite apps, shared packages — Topic · ✅ written `docs/vite/pages/18-microservices-architecture/04-one-repo-many-vite-apps.md`
- **Read this:** [Dependency Pre-Bundling: Monorepos and Linked Dependencies](https://vite.dev/guide/dep-pre-bundling) · vite.dev · a linked package outside `node_modules` is treated as source, must be ESM or go in `optimizeDeps.include`, and needs `--force` after changes (*read*) · covers our angle: **partial** — the page gives no `exclude` example for a source-consumed design system · fetched 2026-10-14
- **Also good:** [Shared Options: resolve.dedupe](https://vite.dev/config/shared-options) · vite.dev · force one copy of a dependency when hoisting or linking in a monorepo creates duplicates (*read*) · fetched 2026-10-14
- **Also good:** [Building for Production: Multi-Page App](https://vite.dev/guide/build) · vite.dev · the alternative to separate apps: several HTML entries in one build (*read*) · fetched 2026-10-14
- **Our delta:** the "same deploy schedule" test for separate apps versus one multi-page build. No good non-official explanation turned up; results were member-only posts or unverified snippets.

### T18-05a · Module Federation on Vite — the mechanism — Topic · ✅ written `docs/vite/pages/18-microservices-architecture/05-module-federation-on-vite.md`
- **Read this:** [Module Federation: Vite integration](https://module-federation.io/integrations/build-tool/vite.html) · module-federation.io · quick start with `name`, `manifest`, `remotes`, `exposes`, `shared`; all options supported except `dev` (*read*) · covers our angle: **partial** — a quick start, with no explanation of why each key exists · fetched 2026-10-14
- **Also good:** [module-federation/vite](https://github.com/module-federation/vite) · GitHub README · the plugin repo: the OriginJS migration guide, remote `type: "module"` for ESM remotes, and the note that the object form of `manualChunks` is ignored on Vite 8 (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Micro Frontends](https://martinfowler.com/articles/micro-frontends.html) · Cam Jackson, martinfowler.com, 2019-06-19 · the concept behind it: build-time versus run-time integration, why lockstep releases defeat the point (*read*) · fetched 2026-10-14
- **Our delta:** the claim that Module Federation is the only Vite mechanism sharing running code across separate deploys. That is our synthesis, not stated in any source. The article predates Module Federation, so it covers the idea, not the tool.

### T18-05b · Shared dependencies, singletons and versioning — Topic · ✅ written `docs/vite/pages/18-microservices-architecture/05a-shared-dependencies-and-singleton-breakage.md`
- **Read this:** [Module Federation: shared](https://module-federation.io/configure/shared) · module-federation.io · `singleton`, `requiredVersion`, `eager`, `import: false`; on conflict the higher version loads and the other side gets a warning (*read*) · covers our angle: **partial** — does not define `strictVersion` (it is absent from its `SharedConfig`), so for that use the next link · fetched 2026-10-14
- **Also good:** [webpack ModuleFederationPlugin](https://webpack.js.org/plugins/module-federation-plugin) · webpack.js.org · the origin of these options: `singleton` is "critical" for react, react-dom, `strictVersion` throws at run time, and the default depends on whether a fallback exists. This is webpack's semantics, so verify against the Vite plugin (*read*) · fetched 2026-10-14
- **Our delta:** the `optimizeDeps` gap in chunk 05a2. The plugin README never mentions `optimizeDeps`, so that part has no source here.

### T18-05c · Worked example, version skew, remoteEntry and SRI — Topic · ✅ written `docs/vite/pages/18-microservices-architecture/05b-worked-example-and-the-version-spine.md`
- **Read this:** [Module Federation: manifest](https://module-federation.io/configure/manifest) · module-federation.io · `mf-manifest.json` is "a runtime-oriented manifest" with `exposes`, `shared` and `remotes`, emitted when `manifest` is enabled (*read*) · covers our angle: **partial** — describes the file, not the skew problem · fetched 2026-10-14
- **Also good:** [Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity) · MDN, last modified 2026-04-14 · a hash on the loaded file, and cross-origin use needs CORS; read it to see why a mutable, independently deployed remote entry cannot carry a fixed hash (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Solving micro frontend challenges with Module Federation](https://blog.logrocket.com/solving-micro-frontend-challenges-module-federation) · Peter Aideloje, LogRocket, 2025-01-23 · host and remote basics, version mismatches fixed with singletons, error handling for dynamic loads; webpack-based (*read*) · fetched 2026-10-14
- **Our delta:** version skew as a distributed-systems problem, the unchecked `exposes` contract, and SRI fighting independent deploys. No source states them as one argument. A search for cache-header guidance on `remoteEntry.js` turned up nothing authoritative.

### T18-06 · Import maps, library mode and the other answers — Topic · ✅ written `docs/vite/pages/18-microservices-architecture/06-import-maps-and-the-other-answers.md`
- **Read this:** [`<script type="importmap">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap) · MDN · bare specifiers, path-prefix mapping, `scopes`, an `integrity` map; Baseline widely available since March 2023 (*read*) · covers our angle: **partial** — the browser feature, not the Vite externals recipe · fetched 2026-10-14
- **Also good:** [Building for Production: Library Mode](https://vite.dev/guide/build) · vite.dev · `build.lib`, with dependencies externalized through `rolldownOptions.external` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Micro Frontends](https://martinfowler.com/articles/micro-frontends.html) · Cam Jackson, martinfowler.com, 2019-06-19 · compares iframes, run-time JavaScript, Web Components and server-side composition, with the trade-off of each (*read*) · fetched 2026-10-14
- **Our delta:** the framing of each option as trading away a different piece of what federation buys.

### T18-06b · Custom elements, single-spa and server-side composition — Topic · ✅ written `docs/vite/pages/18-microservices-architecture/06b-composition-alternatives-and-the-decision.md`
- **Read this:** [Using custom elements](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements) · MDN, last modified 2026-09-01 · `customElements.define`, lifecycle callbacks, autonomous elements (*read*) · covers our angle: **partial** — the seam, not its use between teams · fetched 2026-10-14
- **Also good:** [single-spa overview](http://single-spa.js.org/docs/getting-started-overview/) · single-spa.js.org · "a framework for bringing together multiple JavaScript microfrontends" (docs for 6.x) (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Micro Frontends](https://martinfowler.com/articles/micro-frontends.html) · Cam Jackson, martinfowler.com, 2019-06-19 · integration approaches and the downsides section: payload size, environment differences, governance (*read*) · fetched 2026-10-14
- **Our delta:** the six-option decision table. No page compares all six.

### T18-07 · base and asset URLs across origins — Topic · ✅ written `docs/vite/pages/18-microservices-architecture/07-base-and-asset-urls-across-origins.md`
- **Read this:** [Building for Production: Public Base Path](https://vite.dev/guide/build) · vite.dev · `base` or `--base`, `import.meta.env.BASE_URL` for runtime URLs, and relative base (*read*) · covers our angle: **full** for `base`; **partial** for the cross-origin framing · fetched 2026-10-14
- **Also good:** [Shared Options: base](https://vite.dev/config/shared-options) · vite.dev · valid values: an absolute pathname, a full URL (origin ignored in dev), or empty or `./` (*read*) · fetched 2026-10-14
- **Our delta:** "when this bundle asks for its own chunk, what URL does it emit" as the one question every independent piece must answer.

### T18-07b · renderBuiltUrl, server.origin, the manifest and router basename — Topic · ✅ written `docs/vite/pages/18-microservices-architecture/07b-server-origin-manifest-and-the-router-basename.md`
- **Read this:** [Building for Production: Advanced Base Options](https://vite.dev/guide/build) · vite.dev · `experimental.renderBuiltUrl` with `hostType`, returning a string or a `runtime` or `relative` object; "This feature is experimental." (*read*) · covers our angle: **partial** — `server.origin` and the manifest are on other pages · fetched 2026-10-14
- **Also good:** [Module Federation: Vite integration](https://module-federation.io/integrations/build-tool/vite.html) · module-federation.io · its example sets `server.origin` and `base` for a remote (*read*) · fetched 2026-10-14
- **Our delta:** the gateway-composing-several-builds case and the router basename. No good non-official explanation turned up. The `renderBuiltUrl` stability caveat is repeated across docs versions; this page labels it experimental.

### T18-08 · The Environment API and many build targets — Topic · ✅ written `docs/vite/pages/18-microservices-architecture/08-the-environment-api-and-many-build-targets.md`
- **Read this:** [Environment API](https://vite.dev/guide/api-environment) · vite.dev · Vite 6 formalised environments (before, only `client` and `ssr`), as many as an app needs; the page calls it release candidate, with some APIs still experimental (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Vite 6.0 announcement](https://vite.dev/blog/announcing-vite6) · vite.dev blog, 2024-11-26 · the origin: experimental then, aimed at framework and plugin authors, single-page apps unaffected (*read*) · fetched 2026-10-14
- **Our delta:** our page says "Vite 6+" and the API is now release candidate; the 08b chunk's claim that no primary source links it to Module Federation matches what I found, because neither the Environment API page nor the plugin README mentions the other.

### T18-08b · Many deployables is not microservices — Topic · ✅ written `docs/vite/pages/18-microservices-architecture/08b-many-deployables-is-not-microservices.md`
- **Read this:** [Why Vite: A Unified Toolchain and Environment API](https://vite.dev/guide/why) · vite.dev · environments such as edge runtimes, each with its own module resolution (*read*) · covers our angle: **partial** — says what environments are, nothing on what they are not · fetched 2026-10-14
- **Our delta:** the whole point of this chunk is a negative: three outputs from one dependency graph are not independently deployable services. That distinction is ours and no source makes it.

### T18-09 · When not to split the frontend, and the decision framework — Topic · ✅ written `docs/vite/pages/18-microservices-architecture/09-when-not-to-split-the-frontend.md`
- **Read this:** [When microfrontends make sense](https://vercel.com/academy/microfrontends-on-vercel/when-microfrontends) · Vercel Academy, updated 2026-05-06 · warning signs (builds over five minutes, teams blocking each other), counter-signs (under about five developers, builds under three minutes), "Don't adopt them unless they solve problems you actually have" (*read*) · covers our angle: **partial** — a vendor lesson from a company that sells the hosting; thresholds are rules of thumb · fetched 2026-10-14
- **Beyond the docs:** [MonolithFirst](https://martinfowler.com/bliki/MonolithFirst.html) · Martin Fowler, 2015-06-03 · teams that start with microservices often hit trouble, successful systems began as monoliths; about backend services, so it carries over to frontends by analogy (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Micro Frontends: Downsides](https://martinfowler.com/articles/micro-frontends.html) · Cam Jackson, martinfowler.com, 2019-06-19 · payload size, environment differences, operational and governance complexity (*read*) · fetched 2026-10-14
- **Our delta:** the five yes-no tests and the asymmetric migration cost (09b). These are our own synthesis and are not taken from any source above.
