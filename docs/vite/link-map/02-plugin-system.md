---
title: "Link map · Vite · Part 2 (section 08)"
sidebar_label: "02 · plugin system"
sidebar_position: 2
---

# Link map · Vite · Part 2 (section 08)

Covers section 08 (plugin system) of `docs/vite/pages/08-plugin-system/`. It is one numbered topic page split into 42 chunk files (`01` to `01u`), so it is mapped as five clusters of chunks, `T08-01a` to `T08-01e`. Each block shows the first chunk file of its cluster. Every block is ✅ written.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. Third-party links carry a date only where the page shows one. Anchors are given only where I saw the heading id on the fetched page.

🔴 **Version note.** Our pages were written against **Vite 8.2.2** (`> Verified: 2026-09-07`, documentation-validated, no sandbox). Official links point at the current vite.dev and rolldown.rs docs, which were live on 2026-10-14. The Vite Plugin API page now says Vite plugins extend **Rolldown's** plugin interface; older mirrors (v2 to v6 subdomains, mintlify, tessl, jsdelivr copies) describe Rollup and sometimes use older names, so they are not used as picks. Third-party picks below were written for earlier Vite lines and are flagged where it matters.

---

## Section 08 — Plugin system

### T08-01a · Plugin API on Vite 8, conventions, the hook set and per-environment hooks — Topic · ✅ written `docs/vite/pages/08-plugin-system/01-plugin-api.md`
Clusters chunks 01 to 01c.
- **Read this:** [Plugin API](https://vite.dev/guide/api-plugin) · vite.dev · the whole page: Conventions, Rolldown Hooks, Vite Specific Hooks, Plugin Context Meta, with a Kind/Scope label on each hook that links to the Environment API page (*read*) · covers our angle: **partial** — states that hooks differ between dev and build and which are per-environment, but does not frame the dev-versus-build asymmetry as a bug class · fetched 2026-10-14
- **Also good:** [Rolldown Interface.Plugin](https://www.rolldown.rs/reference/Interface.Plugin) · rolldown.rs reference · the base interface Vite extends: `name`, `api`, `meta`, `version`, every build and output hook with its Kind (async, parallel / async, first / async, sequential), and a `filter` option on `load`, `resolveId`, `transform`, `renderChunk` (*read*) · fetched 2026-10-14
- **Also good:** [Environment API for Plugins](https://vite.dev/guide/api-environment-plugins) · vite.dev · Per-environment Hooks and Global Hooks, Accessing the Current Environment in Hooks (`this.environment`) (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Build and Use Plugins in Vite](https://blog.openreplay.com/build-use-plugins-vite/) · OpenReplay Team, 2025-11-01 · a gentler tour of `config`, `configResolved`, `transform`, `load`, `resolveId`, `configureServer`, `transformIndexHtml` with `enforce` and `apply`; names no Vite version, so treat Rolldown details as missing · fetched 2026-10-14 (*read*)
- **Our delta:** the Rolldown-not-Rollup framing, the `rolldown-plugin-` versus `vite-plugin-` prefix as an interface claim, preset ordering, and the importer that lies in dev.

### T08-01b · Config hooks, hook kinds, preset coupling, server hooks — Topic · ✅ written `docs/vite/pages/08-plugin-system/01d-config-and-configresolved.md`
Clusters chunks 01d to 01k: `config`, `configResolved`, `sequential` versus `parallel`, accidental serialisation, `configureServer`, `configurePreviewServer`, storing the server.
- **Read this:** [Plugin API — configResolved](https://vite.dev/guide/api-plugin) · vite.dev · the `config`, `configResolved`, `configureServer` and `configurePreviewServer` h3 sections, each with its Type and Kind line; `config` notes plugins are resolved before it runs, so adding plugins from it has no effect; `configureServer` runs before internal middlewares (*read*) · covers our angle: **partial** — no discussion of why a `parallel` violation hides until an `await` is added, nor of the CI-only `TypeError` from a stored server · fetched 2026-10-14
- **Also good:** [Rollup Plugin Development — Build Hooks](https://rollupjs.org/plugin-development/) · rollupjs.org · defines `async`, `first`, `sequential`, `parallel` and the object-form `order`, `sequential`, `filter` options; the only place the Kind vocabulary is defined in prose (*read*) · fetched 2026-10-14
- **Also good:** [Vite 8 migration — Advanced](https://vite.dev/guide/migration) · vite.dev · says parallel hooks now run sequentially, which is the official source for the accidental-serialisation chunk (*read*) · fetched 2026-10-14
- **Our delta:** the preset factory beats picking the right hook, and why `if (server)` guards turn a loud crash into a silent production regression. No good independent article found after searching, so no Beyond line.

### T08-01c · `transformIndexHtml`, tag descriptors, escaping and execution contract — Topic · ✅ written `docs/vite/pages/08-plugin-system/01l-transform-index-html.md`
Clusters chunks 01l to 01nd: `order`, tag descriptors and `injectTo`, `children` as markup, nested descriptors, `{ html, tags }`, sequential per-environment composition, the transform context.
- **Read this:** [Plugin API — transformIndexHtml](https://vite.dev/guide/api-plugin) · vite.dev · the hook signature, `order: 'pre' | 'post'`, tag descriptor fields and `injectTo` values, the context object (*read*) · covers our angle: **partial** — documents the fields but not the escaping asymmetry between `attrs` and `children`, nor the guard-flag trap across environments · fetched 2026-10-14
- **Also good:** [Environment API for Plugins](https://vite.dev/guide/api-environment-plugins) · vite.dev · why a hook that runs per environment runs twice on a framework with a client and a server environment (*read*) · fetched 2026-10-14
- **Beyond the docs:** none found. The searches returned only mirrors of the official text (tessl.io, jsdelivr copies, a code mirror), which are not independent explanations and are not linked.
- **Our delta:** the whole composition story: string form edits the previous output, descriptors do not fail silently, and a framework can own the entry file so the hook never ran.

### T08-01d · HMR from a plugin: `handleHotUpdate`, `hotUpdate`, custom events, client API — Topic · ✅ written `docs/vite/pages/08-plugin-system/01o-handle-hot-update.md`
Clusters chunks 01o to 01oe: return contract, full-reload recipe, `hotUpdate`, per-environment state, `server.ws.send`, `hot.on`, `accept`, `dispose`, `prune`, `data`, `invalidate`, typing custom events.
- **Read this:** [HMR API](https://vite.dev/guide/api-hmr) · vite.dev · `hot.accept(cb)` with the whitespace-sensitive `import.meta.hot.accept(` rule, `dispose`, `prune`, `data`, `decline`, `invalidate`, `on`, `off`, `send` (*read*) · covers our angle: **full** for the client half (chunks 01odb to 01odd); **partial** for the server half · fetched 2026-10-14
- **Also good:** [HMR hotUpdate Plugin Hook](https://vite.dev/changes/hotupdate-hook) · vite.dev · why `handleHotUpdate` mixes client and SSR modules, `this.environment.hot.send`, the `create` / `update` / `delete` type field, and the `future.removePluginHookHandleHotUpdate` flag; deprecation has no date (*read*) · fetched 2026-10-14
- **Also good:** [Plugin API — handleHotUpdate and Client-server Communication](https://vite.dev/guide/api-plugin) · vite.dev · the three documented choices, `server.ws.send`, `client.send`, and TypeScript for Custom Events (*read*) · fetched 2026-10-14
- **Also good:** [Environment API for Plugins — per-environment state](https://vite.dev/guide/api-environment-plugins) · vite.dev · The `hotUpdate` Hook and Per-environment State in Plugins, the `Map` keyed by environment, and the start/end and `watchChange` opt-in flags (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Hot module reloading for content in SvelteKit](https://dev.to/dimfeld/hot-module-reloading-for-content-in-sveltekit-137e) · Daniel Imfeld, 2021-11-01 · a real plugin: `handleHotUpdate` maps a changed markdown file to a custom `content-update` event via `server.ws.send`, returns an empty module list, and the client listens with `import.meta.hot`; written for Vite 2 era, uses `server.ws` not `this.environment.hot` · fetched 2026-10-14 (*read*)
- **Our delta:** the three-return-value table, why `[]` is a claim of ownership, listener lifecycle on a top-level `hot.on`, and `CustomEventMap` being opt-in.

### T08-01e · Ordering, `apply`, hook filters, virtual modules, Rolldown compatibility, path normalisation — Topic · ✅ written `docs/vite/pages/08-plugin-system/01p-plugin-ordering-and-enforce.md`
Clusters chunks 01p to 01u: `enforce` bands, `enforce` versus hook `order` versus Kind, spreading to add `enforce` / `apply`, conditional application, hook filters, virtual modules, compatibility criteria, `createFilter`.
- **Read this:** [Plugin API — Plugin Ordering and Conditional Application](https://vite.dev/guide/api-plugin) · vite.dev · the resolved order list, `apply` as `'serve'`, `'build'` or a function, and the Rolldown Plugin Compatibility, Path Normalization and Importing a Virtual File sections (*read*) · covers our angle: **partial** — the sections exist but are short; the seven-slot order and the preset-spread failure are our own derivation · fetched 2026-10-14
- **Also good:** [Hook Filters](https://rolldown.rs/plugins/hook-filters) · rolldown.rs · filter keys `id`, `moduleType`, `code`; supported on `resolveId`, `load`, `transform`, `renderChunk`; `exclude` beats `include`; multiple keys are ANDed; works in Vite 6.3.0 and later, older Vite calls the handler anyway; composable filters are Rolldown-only (*read*) · fetched 2026-10-14
- **Also good:** [Using Plugins](https://vite.dev/guide/using-plugins) · vite.dev · the user-side view of `enforce` (`pre`, default, `post`) and `apply` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Build a Vite plugin from scratch](https://flaviocopes.com/vite-plugin-tutorial/) · Flavio Copes, updated 2026-08-03 · builds `vite-plugin-note` end to end with a `transform` for a custom file type and a `virtual:notes` module, plus ordering, testing and packaging; does not cover filters or the `/@id/__x00__` encoding · fetched 2026-10-14 (*read*)
- **Our delta:** the NUL-prefix and dev-URL encoding, owing a virtual module its own types and watcher mapping, the Windows path bug, and the redundant in-handler check that stays correct. `vite-plugin-inspect` (github.com/antfu-collective/vite-plugin-inspect) is useful for debugging order; its v12 needs Vite 8 and a DevTools package, so it is not linked as a pick.
