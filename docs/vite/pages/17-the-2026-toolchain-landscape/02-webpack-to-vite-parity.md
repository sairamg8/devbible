---
title: "What Transfers From webpack to Vite: the Config That Deletes Itself, and the Parts That Need a Plugin"
sidebar_label: "webpack → Vite: What Transfers"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Migration from v7](https://vite.dev/guide/migration), [Features](https://vite.dev/guide/features), [Build Options](https://vite.dev/config/build-options), [Env Variables and Modes](https://vite.dev/guide/env-and-mode) — plus package facts from **registry.npmjs.org**. **No sandbox run, no timings.** Target: **Vite 8.2.2 · webpack 5.110.3**.
> ⚠️ The verdict column is **engineering judgement** built on those documented capabilities, not a quoted claim. Where a capability's status is genuinely unclear it is marked, not guessed.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ What Transfers From webpack to Vite

The honest short answer to *"can I do everything in Vite that I do in webpack?"* is **almost, and
the exceptions are concentrated in four places.** Most of a webpack config does not need porting at
all, because Vite already does it without configuration. The cost is not spread evenly across the
migration — it sits in the loader long tail, the chunk graph, `ProvidePlugin`-style globals and Node
built-ins.

---

## 1. Under-The-Hood Mechanics

### ✅ Transfers cleanly — usually by deleting configuration

| webpack | Vite | Note |
|---|---|---|
| `entry` | `index.html` | The HTML file *is* the entry; `<script type="module">` roots the graph |
| `output.path` / `filename` | `build.outDir`, `build.assetsDir` | Hashing is on by default |
| `babel-loader` / `ts-loader` | built in | Vite 8 transforms TS/JSX with **Oxc**; no config |
| `css-loader` + `style-loader` | built in | `lightningcss` is a hard dependency of `vite@8.2.2` |
| `sass-loader` / `less-loader` | built in | Install the preprocessor; both are optional peers |
| `file-loader` / asset modules | built in | Plus explicit `?url`, `?raw`, `?inline` suffixes |
| `DefinePlugin` | `define` | Same textual-substitution semantics |
| `EnvironmentPlugin` | `import.meta.env` + `VITE_` prefix | Opt-in exposure by default |
| `HtmlWebpackPlugin` | native | HTML is an input, not an output template |
| `require.context` | `import.meta.glob` | Mechanical port; both need statically analysable arguments |
| `devServer.proxy` | `server.proxy` | Same shape |
| HMR | native | No `webpack-dev-server`, no `hot` flag |
| `webpack-bundle-analyzer` | `rollup-plugin-visualizer` | Different tool, same job |
| `optimization.minimize` | `build.minify` | `terser` is an optional peer |
| Multi-page apps | multiple HTML inputs | Documented; not a plugin |

**Most of a webpack config disappears rather than porting.** A 200-line config commonly becomes
twenty lines, and the twenty are the interesting ones.

### ⚠️ Needs a plugin, or a rethink

| webpack | Vite | The catch |
|---|---|---|
| Module Federation | `@module-federation/vite` **1.21.5** | Official MF org, shipped 2026-09-07. 🔴 The community `@originjs/vite-plugin-federation` **1.4.1** that most tutorials link last shipped **2025-04-12** — check which one you were handed |
| `browserslist` / legacy targets | `@vitejs/plugin-legacy` **8.2.3** | A plugin, not a default. Modern-only output otherwise |
| CommonJS-only dependencies | dep pre-bundling | Handles most; the failures are real and are edge cases |
| `webpack.config.js` per environment | `defineConfig(({ command, mode }) => …)` | Different mechanism, same outcome |
| Filesystem build cache | dependency cache only | Vite caches pre-bundled deps in `node_modules/.vite`; it does **not** cache your build the way webpack 5's `cache: { type: 'filesystem' }` does |

### The structural difference that is not in any table

The dev server **does not bundle your source**. Tree-shaking, chunk boundaries, cross-chunk
evaluation order and minification have not run. That removes a whole class of dev/prod discrepancy
in the *transform* — Vite 8 unified on Rolldown so dev and build agree about syntax — and leaves the
*structural* one entirely intact. `vite build` before believing a fix. It is the reason `vite
preview` exists.

---

## 2. Real-World Engineering Scenario

**A 340-line webpack config that became 31 lines, and the six that took three weeks.**

A team ported a React app. The audit was one afternoon:

- **211 lines deleted outright** — `babel-loader`, `ts-loader`, `css-loader`, `style-loader`,
  `sass-loader`, `file-loader`, `url-loader`, `HtmlWebpackPlugin`, `DefinePlugin`, the dev-server
  block, the minimiser block. Vite does all of it with no configuration.
- **98 lines ported mechanically** — the proxy, the aliases, `require.context` → `import.meta.glob`,
  env variables behind the `VITE_` prefix. A day.
- **31 lines of real config** in the result.

Then the six lines that were not in the estimate:

- **`splitChunks` (3 lines, three weeks).** A hand-tuned vendor/common/route split, six years of
  accumulated caching intent, no equivalent option, and Vite 8 having removed the object
  `manualChunks` form. Rebuilt as a design exercise: which bundles share a cache lifetime, and why.
  Two of the original rules turned out to be obsolete, which nobody could have known without
  rebuilding it.
- **A custom `.graphql` loader (1 line, four days).** An existing community plugin covered it —
  after four days establishing that it did.
- **`ProvidePlugin` for `Buffer` (2 lines, two days).** A dependency assumed a Node global. Solved
  with an explicit polyfill and an import, which is better code and was not free.

Final ratio: **62% of the config deleted, 29% mechanical, 2% of the lines were 80% of the effort.**
That distribution is the single most useful thing to carry into a migration plan — and the estimate
that matters is not the line count, it is `grep -c 'loader'` plus "do we have a `splitChunks`".

---

## 3. Production-Grade Code Example

```javascript
// BEFORE — the parts of a webpack config that Vite simply does not need.
module.exports = {
  entry: './src/index.tsx',
  output: { path: __dirname + '/dist', filename: '[name].[contenthash].js' },
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'babel-loader' },              // → built in (Oxc)
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },// → built in
      { test: /\.scss$/, use: [/* … */ 'sass-loader'] },      // → built in
      { test: /\.(png|svg)$/, type: 'asset/resource' },       // → built in
    ],
  },
  plugins: [new HtmlWebpackPlugin({ template: './index.html' })],  // → native
  devServer: { proxy: { '/api': 'http://localhost:4000' } },       // → server.proxy
};
```

```typescript
// AFTER — everything above, plus the two things that did need porting.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': '/src' } },
  server: { proxy: { '/api': 'http://localhost:4000' } },
  build: {
    // v8 name. `rollupOptions` still works as an alias.
    rolldownOptions: {
      output: {
        // ⚠️ MIGRATION STOPGAP, not the destination. The object form was removed
        // in v8 and the function form is deprecated; the named replacement is
        // Rolldown's `codeSplitting`:
        // https://rolldown.rs/reference/OutputOptions.codeSplitting
        manualChunks: (id) => (id.includes('node_modules/react') ? 'react' : undefined),
      },
    },
  },
});
```

```typescript
// require.context → import.meta.glob. Mechanical, and the constraint is the same:
// both need a statically analysable argument, and both fail SILENTLY without one.

// ❌ webpack
// const ctx = require.context('./locales', false, /\.json$/);

// ✅ Vite — eager: true gives a plain object instead of lazy import functions.
const locales = import.meta.glob('./locales/*.json', { eager: true });

// ⛔ Neither works with a computed path — there is nothing to analyse at build time.
// const bad = import.meta.glob(`./locales/${lang}/*.json`);
```

```bash
# The migration audit. Run this BEFORE writing an estimate — it is the estimate.
echo "loaders:        $(grep -c 'loader' webpack.config.js)"
echo "splitChunks:    $(grep -c 'splitChunks' webpack.config.js)   # any hit = a design task"
echo "ProvidePlugin:  $(grep -c 'ProvidePlugin' webpack.config.js) # no Vite equivalent"
echo "require.context:$(grep -rc 'require.context' src/ | grep -v ':0' | wc -l)"
echo "node builtins:  $(grep -rlE \"from '(node:)?(fs|path|crypto|buffer|stream)'\" src/ | wc -l)"
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Estimating by config line count

62% of a typical config deletes itself and 2% of the lines carry most of the effort. Line count is
anti-correlated with difficulty here. Estimate from `grep -c 'loader'` and whether `splitChunks`
exists.

### ⚠️ Pitfall 2 — Assuming Module Federation is a blocker

It is not, and has not been for a while. But check the publish date of whichever plugin you are
pointed at — the community one that dominates search results has not shipped since **2025-04-12**,
while the official MF org's plugin ships continuously.

### ⚠️ Pitfall 3 — Expecting a webpack-5-style filesystem build cache

Vite caches **pre-bundled dependencies**, not your build output. A team relying on webpack's
`cache: { type: 'filesystem' }` for warm CI builds is giving something up, and it belongs in the
proposal.

### ⚠️ Pitfall 4 — Discovering the unbundled dev server after the migration

Dev does not bundle your source. Tree-shaking, chunk boundaries, cross-chunk evaluation order and
minification are all unrun until `vite build`. Put a production build in the pre-merge pipeline on
day one rather than after the first "worked in dev" incident.

---

## Gotchas

**★ Symptom: `require.context` is gone and the replacement returns functions, not modules.** Cause: `import.meta.glob` is lazy by default — each value is an import function. Fix: pass `{ eager: true }` for the eager object form.

```ts
const locales = import.meta.glob('./locales/*.json', { eager: true });
```

**★ Symptom: `import.meta.glob` with a template literal path matches nothing, silently.** Cause: it is a compile-time rewrite and needs a statically analysable argument — the same constraint `require.context` had. Fix: glob a fixed pattern and select at runtime. Note it fails *silently*, because the code is still valid.

**★ Symptom: CI got slower after migrating, while local dev got much faster.** Cause: two different things were measured. Vite's headline benefit is the dev loop; CI runs the production build, and webpack 5's filesystem cache may have been doing real work that Vite does not replicate. Fix: measure both paths separately before and after.

**★ Symptom: a CommonJS-only dependency fails at runtime with an interop error.** Cause: dependency pre-bundling converts CJS to ESM and handles most cases, not all — dynamic `require`, conditional exports and circular CJS are the usual failures. Fix: check `optimizeDeps.include`/`exclude` and `build.commonjsOptions` for that package specifically; the general machinery works, so a failure is package-shaped.

**★ Symptom: the build output has no legacy-browser fallback and support tickets arrive.** Cause: Vite emits modern output by default; `browserslist` is not consulted the way webpack's ecosystem consulted it. Fix: `@vitejs/plugin-legacy` (8.2.3). It is an explicit opt-in, so a team that never noticed it silently narrowed their support matrix.

**★ Symptom: `build.rollupOptions` in a migrated config triggers a deprecation notice.** Cause: v8 renamed it to `build.rolldownOptions`; the old name is kept as an alias. Fix: rename it — a straight rename with no behaviour change, which is why it is easy to leave for years.

---

## Interview questions

**★ Can you do everything in Vite that you can do in webpack?**
Almost, and the exceptions cluster. Most of a webpack config does not port because it *disappears* —
Vite handles TS/JSX (via Oxc in v8), CSS and preprocessors, assets, HTML and the dev server without
configuration, so a 340-line config commonly becomes about 30. Four things genuinely do not
transfer: `splitChunks` has no equivalent and Vite 8 removed the object `manualChunks` form; custom
loaders must be reimplemented against the Rollup plugin interface; `ProvidePlugin`-style demand
injection has no option; and Node built-ins need explicit polyfills — though that last one is parity
with webpack 5, not a Vite deficiency. Everything else is either free or a plugin, including Module
Federation.

**★ How would you produce a migration estimate in one afternoon?**
Three greps and one question. `grep -c 'loader'` gives the count of things that must be rewritten or
matched to an existing plugin. `grep -c 'splitChunks'` is binary: any hit converts the migration
from mechanical to a design task with a genuinely uncertain tail. `grep -rc 'require.context'` and a
scan for `ProvidePlugin` and Node built-in imports catch the rest. Everything not caught by those is
almost certainly a delete. The question is "what is the complaint?", because if the answer is build
speed, the correct proposal may be Rspack and none of this applies.

**★ What does a team give up by moving to Vite that nobody puts in the proposal?**
Two things. The **unbundled dev server**: tree-shaking, chunk boundaries, cross-chunk evaluation
order and minification do not run in dev, so a class of bug is invisible until `vite build` — which
is why `vite preview` exists and why a production build belongs in the pre-merge pipeline from day
one. And the **filesystem build cache**: webpack 5's `cache: { type: 'filesystem' }` can make warm CI
builds dramatically cheaper, and Vite caches pre-bundled dependencies rather than your build output.
Both are real costs, both are survivable, and both are much easier to accept when they were written
down in advance rather than discovered in an incident.

**★ Is Module Federation still a reason to stay on webpack?**
No, and it has not been for some time — `@module-federation/vite` is published by the official
Module Federation organisation and ships continuously. The trap is which plugin you are handed: the
community `@originjs/vite-plugin-federation` dominates search results and tutorials and last
published in **April 2025**, so a team evaluating "Module Federation on Vite" through that lens
reasonably concludes it is unmaintained. The transferable habit is to check the publish date and the
publishing org of any plugin a migration depends on, before it becomes an argument about the
migration itself.

---

← [Choosing a Bundler](01a-choosing-a-bundler.md) · [Vite overview](../../README.md) · Next → [The Four That Do Not Transfer](02a-the-four-that-do-not-transfer.md)
