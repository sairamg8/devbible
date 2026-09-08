---
title: "noParse and externals Are webpack Options With No Vite Setting of the Same Name, and the Fact That One Ports Cleanly and the Other Does Not Tells You Something About Both Bundlers"
sidebar_label: "01m · noParse & externals"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [Building for Production § Library Mode](https://vite.dev/guide/build). `ProvidePlugin` and custom-loader equivalents are cross-linked rather than re-verified here; see the citations on those sections. **No sandbox run, no timings**. Target: **Vite 8.2.2 · webpack 5.110.3**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ `noParse`, `externals`, and the Rest of the Webpack-Only Surface

**Two more webpack options with no Vite equivalent, plus the two this corpus already
covered.** `noParse` and `externals` are genuinely new ground; `ProvidePlugin` and custom
loaders already have exhaustive treatments elsewhere and get one paragraph each here, with a
pointer.

## `externals` → `build.rolldownOptions.external`

webpack's `externals` tells the bundler "this specifier exists at runtime, do not bundle it
— assume it's a global or will be provided by the environment." The most common use is
excluding a peer dependency from an app bundle, or excluding Node built-ins from a
server-side bundle.

```javascript
// BEFORE — webpack.config.js
module.exports = {
  externals: {
    react: 'React', // assume a global `React` exists (loaded via a <script> CDN tag)
    'react-dom': 'ReactDOM',
  },
};
```

Vite's equivalent lives under `rolldownOptions`, and the documentation shows it specifically
in the context of **library mode** — this is the field's natural home, since an application
build almost never wants an unresolved external dependency, while a published library
frequently must:

> *"make sure to externalize deps that shouldn't be bundled into your library"* —
> [Building for Production](https://vite.dev/guide/build)

```typescript
// AFTER — vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rolldownOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: { react: 'React', 'react-dom': 'ReactDOM' }, // for UMD/IIFE output only
      },
    },
  },
});
```

The `output.globals` map is only meaningful for UMD/IIFE output formats — it tells Rolldown
what global variable name to substitute for the externalised import when the output can't
use a real `import` statement. An ES-module build has no need for it, because externalised
imports simply stay as `import` statements the runtime resolves itself.

## `noParse` → nothing, and the reason is structural

webpack's `module.noParse` tells webpack to skip parsing a matched module entirely — no AST
walk, no dependency graph traversal inside that file — as a targeted performance escape
hatch for large, pre-bundled libraries (a minified vendor file, for instance) that webpack
would otherwise spend real time parsing for no benefit, since the file has no `require`/`import`
calls worth discovering.

Vite has no direct equivalent, for two reasons that are worth understanding rather than
memorising:

1. **The dev server does not parse your source into a bundle at all** — it serves ESM
   directly, so there is no per-file parse cost to skip in the sense `noParse` addressed.
2. **The production build's parser is Oxc**, a Rust parser built to be fast enough that
   hand-picking files to exclude from parsing is not a lever the tool exposes — the
   performance problem `noParse` solved in webpack's JavaScript-implemented pipeline is a
   different scale of problem for a native-code parser.

If a specific vendored file is genuinely large enough to matter, the closer lever is keeping
it out of your own module graph at all — served as a static asset via the `public/`
directory with a plain `<script>` tag, exactly as it might have been pre-webpack — rather
than looking for a parsing exclusion inside Vite's config.

## Config that reads `process.env` directly, outside of `mode`

A webpack config that branches on an arbitrary environment variable — `process.env.CI`,
`process.env.ANALYZE`, a custom flag unrelated to `development`/`production`/`staging` — is a
different case from `mode`-based branching, covered in the previous chunk of this topic.
`vite.config.ts` is a plain Node module and can read `process.env` exactly the same way:

```javascript
// BEFORE — webpack.config.js
module.exports = {
  plugins: process.env.ANALYZE
    ? [new BundleAnalyzerPlugin()]
    : [],
};
```

```typescript
// AFTER — vite.config.ts. process.env works here — this file is plain Node, not
// application source, so this is NOT the "process is not defined" trap.
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: process.env.ANALYZE ? [visualizer()] : [],
});
```

The mechanical translation is identical to the source file itself, because the config file's
execution environment did not change — it is the *application* code, served to the browser,
where `process.env` stops existing by default, a distinction covered in this topic's chunk on
CommonJS in application source.

## `ProvidePlugin` and custom loaders — already covered, pointer only

`ProvidePlugin`'s on-demand global injection has no Vite equivalent, and the reasoning —
`define`'s textual substitution is not demand-driven, and the actual fix is an explicit
import — is covered in full, with a worked `Buffer` example, in
**[topic 17, "Three Capabilities With No Vite Equivalent"](../17-the-2026-toolchain-landscape/02a-the-four-that-do-not-transfer.md)**.
Custom loaders — the loader-vs-plugin interface difference, id filtering, source maps, HMR,
ordering, and where to search before writing one — are covered at Master tier in
**[topic 17, "Loaders Become Plugins"](../17-the-2026-toolchain-landscape/02b-loaders-become-plugins.md)**.

---

## Gotchas

**★ Symptom: `output.globals` is set but the build still fails with "React is not defined" in a UMD build.** Cause: `output.globals` only maps an externalised import to a global variable name in the *output* — it does not create that global. The consuming HTML page still needs to load `react` via a real `<script>` tag before your bundle runs. Fix: confirm the consuming page's script order actually defines the global before your externalised bundle executes; `globals` is a naming contract, not a loader.

**★ Symptom: `externals` is set on an application build (not a library) and the app fails to load in the browser with unresolved-specifier errors.** Cause: `rolldownOptions.external` tells the bundle "do not include this — assume the runtime provides it," which is correct for a published library whose consumer supplies the dependency, and almost always wrong for an application, which has no such consumer. Fix: `external` is a library-mode option; an application build should let Vite bundle its dependencies, and reach for `external` only when publishing a package meant to be consumed alongside a peer dependency.

**★ Symptom: a huge vendored file that had `module.noParse` under webpack now visibly slows the dev server.** Cause: there is no direct equivalent, and the dev server serves the file as an ESM module like any other — if it is genuinely large and has no internal imports worth discovering, it was never a good fit for the module graph in the first place. Fix: move it to `public/` and load it with a plain `<script>` tag, exactly as `noParse` implicitly acknowledged by opting it out of the graph.

**★ Symptom: `process.env.SOME_FLAG` read inside `vite.config.ts` works fine, and the same pattern copy-pasted into `src/config.ts` throws "process is not defined".** Cause: conflating two different execution contexts that happen to share a syntax — `vite.config.ts` runs under Node before any browser code exists, and application source under `src/` is served to the browser, where `process` is not a global unless something explicitly defines it. Fix: use `import.meta.env` for anything that needs to be read in application source, and reserve raw `process.env` reads for the config file itself.

---

## Interview questions

**★ Why does `externals` have a clean Vite equivalent while `ProvidePlugin` and `noParse` do not, when all three are "webpack-only options"?**
Because `externals` solves a problem that exists identically in both tools' *build phase* —
"do not include this dependency, assume the environment provides it" — which is a property of
how a bundle is assembled, not of how webpack specifically assembles it, so Rolldown exposes
the same concept under `rolldownOptions.external`. `ProvidePlugin` and `noParse`, by contrast,
solve problems specific to webpack's own architecture: `ProvidePlugin`'s on-demand global
injection depends on webpack's ability to rewrite a free identifier into an import mid-parse,
and `noParse`'s performance escape hatch depends on parsing being expensive enough in
webpack's JavaScript pipeline to be worth skipping selectively. Neither of those architectural
facts is true of Rolldown, so neither option has anywhere to land.

**★ A migration keeps a webpack-style `if (process.env.ANALYZE) { … }` branch verbatim inside `vite.config.ts`. Is that safe, and why is it different from the same pattern inside application source?**
It is safe, and the reason is worth being precise about: `vite.config.ts` is not the code
Vite serves to the browser — it is a plain Node module that Vite itself loads with Node's own
module system, at a point before any dev server or browser is involved. `process.env`
exists there exactly as it always did under webpack's config file, which was also just a
plain Node module. The distinction that actually matters is the one covered in this topic's
CommonJS chunk: application source under `src/`, once it ships to the browser as ESM, has no
`process` global by default, and that is a completely separate fact from anything about the
config file's own environment.

**★ Why is `externals` documented under Vite's library-mode guide rather than the general build-options reference?**
Because externalising a dependency only makes sense when something *else* is expected to
supply it at runtime, and that expectation is structurally different for an app versus a
library. An application is the end of the chain — nothing downstream will supply a missing
dependency, so bundling everything is almost always correct. A published library sits in the
*middle* of a chain — its consumer's own build will supply `react` or whatever peer
dependency was externalised, and bundling it anyway risks shipping a second copy that
conflicts with the consumer's. Documenting the option where the decision actually needs to be
made, rather than in the general build reference, reflects that it is a decision tied to what
kind of artefact you are producing, not a generic build tuning knob.

---

← [01l · splitChunks → codeSplitting](01l-splitchunks-to-code-splitting.md) · [Vite overview](../../README.md) · Next → [01n · Module Federation](01n-module-federation-migration.md)
