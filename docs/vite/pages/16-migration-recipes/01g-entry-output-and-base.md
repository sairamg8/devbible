---
title: "webpack's entry and output Blocks Do Not Configure Anything in Vite — They Delete, Because index.html Is the Entry and outDir/assetsDir/base Are the Only Output Knobs Left"
sidebar_label: "01g · entry & output → index.html"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the Vite documentation — [Build Options](https://vite.dev/config/build-options), [Shared Options](https://vite.dev/config/shared-options), [Migration from v7](https://vite.dev/guide/migration). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+ · webpack 5.110.3**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ Translating `entry` and `output`

**A webpack config's `entry` and `output` blocks are the two fields with the least Vite
equivalent to write, because most of what they configure is a default in Vite rather than
an option.** This chunk is the field-by-field translation for a config you inherited and
need running under Vite this week — not the argument for doing it, which
[topic 17](../17-the-2026-toolchain-landscape/02-webpack-to-vite-parity.md) already made.

## `entry` → `index.html`

webpack's `entry` names a JavaScript file; the bundler builds a dependency graph starting
there and webpack itself decides where the resulting script tag goes, via
`HtmlWebpackPlugin`. Vite inverts this: **the HTML file is the entry**, and the module graph
starts at whatever `<script type="module">` it contains.

```javascript
// BEFORE — webpack.config.js
module.exports = {
  entry: './src/index.tsx',
  output: { path: __dirname + '/dist', filename: '[name].[contenthash].js' },
  plugins: [new HtmlWebpackPlugin({ template: './public/index.html' })],
};
```

```html
<!-- AFTER — index.html, moved to the PROJECT ROOT. No template, no plugin. -->
<!DOCTYPE html>
<html lang="en">
  <head><meta charset="UTF-8" /></head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
```

There is no `vite.config.ts` field for this. Deleting `entry` and `HtmlWebpackPlugin`, and
writing the script tag by hand, **is** the port.

### When you still need to set an input explicitly

Two cases keep a real Vite option alive: a config-driven entry (SSR, a non-standard file
layout) or multiple HTML pages.

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        main: 'index.html',
        admin: 'admin/index.html', // multi-page app: one HTML file per page
      },
    },
  },
});
```

> *"Instead of `build.rolldownOptions.input`, it is recommended to set the top-level
> [`input`](https://vite.dev/config/shared-options#input) option, because it will be used in
> dev as well. If `build.rolldownOptions.input` is set, it overrides the top-level `input`
> option for build only."* — [Build Options](https://vite.dev/config/build-options)

That is a real behavioural difference, not a style preference: `build.rolldownOptions.input`
only takes effect for `vite build`. If you set it and then try to reach the second page from
`vite dev`, it will not resolve — the dev server never read it. Use the top-level `input`
(under `defineConfig`, not `build`) unless the input genuinely must differ between dev and
build.

## `output` → `build.outDir`, `build.assetsDir`, `base`

| webpack | Vite | Default |
|---|---|---|
| `output.path` | `build.outDir` | `'dist'` |
| `output.filename` (nested assets) | `build.assetsDir` | `'assets'` |
| `output.publicPath` | `base` (top-level, not under `build`) | `'/'` |

> *"Specify the output directory (relative to project root)."* — `build.outDir`, default
> `'dist'`. *"Specify the directory to nest generated assets under (relative to
> `build.outDir`)."* — `build.assetsDir`, default `'assets'` — [Build Options](https://vite.dev/config/build-options)

Content hashing (`[contenthash]` in webpack's `filename`) is **on by default** for the
production build — there is no filename template to write, because there is no case where
you would turn it off for a normal app.

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'build', // webpack output.path: __dirname + '/build'
    assetsDir: 'static', // webpack: assets nested under a "static/" prefix
  },
});
```

### `base` is the field most people forget, because webpack's equivalent lives somewhere else

`output.publicPath` in webpack is usually set once and forgotten; the same field in Vite is
`base`, and it is **top-level**, not nested under `build` — a config ported by grepping for
`output` and pasting everything under `build` silently drops it.

> *"Base public path when served in development or production. Valid values include: Absolute
> URL pathname, e.g. `/foo/`; Full URL, e.g. `https://bar.com/foo/`; Empty string or `./` (for
> embedded deployment)"* — [Shared Options](https://vite.dev/config/shared-options)

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/admin-panel/', // webpack: output.publicPath: '/admin-panel/'
  build: { outDir: 'dist' },
});
```

`base` also affects the **dev server**, not just the production build — this is the one
field in this chunk that genuinely changes behaviour, not just location, relative to
`output.publicPath`, which webpack's `devServer` largely ignored.

## Multi-page apps: documented, not a plugin

webpack's multi-entry apps needed one `HtmlWebpackPlugin` instance per page plus matching
`entry` keys. Vite's answer is the `input` object above, with one HTML file per key — no
plugin, because HTML is already the mechanism, not a template being filled in.

---

## Gotchas

**★ Symptom: a second HTML page works with `vite build` but 404s under `vite dev`.** Cause: the input was set under `build.rolldownOptions.input`, which only applies to the build — the migration guide is explicit that the top-level `input` is what the dev server reads. Fix: move the object to the top-level `input` key (or duplicate it there) unless you specifically need a build-only entry set.

**★ Symptom: assets referenced by absolute path (`/logo.png`) 404 after deploying under a subpath.** Cause: `output.publicPath` was ported into `build.assetsDir`, which only renames the on-disk folder — it does not change how paths are emitted. Fix: set the top-level `base`, not `build.assetsDir`, to the subpath the app is actually served from.

**★ Symptom: `index.html` builds fine locally and the production deploy serves a blank page with console errors about a script 404.** Cause: `base` was never set, and the app is deployed under a subpath (e.g. `https://example.com/app/`) while every emitted script/asset URL assumes root (`/`). Fix: `base: '/app/'` in `vite.config.ts` — this single field is the entire fix, and it is the one most often missing because webpack's `devServer` rarely required its equivalent to be correct for local dev to work.

**★ Symptom: `HtmlWebpackPlugin`'s `templateParameters` (injecting build-time variables into the HTML) has no obvious Vite replacement.** Cause: Vite's `index.html` is not templated by a plugin at all — it is a static file Vite reads directly, plus a small set of `%VITE_*%` env placeholders it substitutes itself. Fix: for anything beyond simple env substitution, a `transformIndexHtml` plugin hook replaces the templating step; the plugin-authoring side of that hook is out of this chunk's scope — see the plugin system topic's HTML hooks if you need to write one.

---

## Interview questions

**★ Why does a webpack `entry`/`output` block shrink to almost nothing in Vite, rather than translating field for field?**
Because the two systems root the module graph differently. webpack starts from a named
JavaScript file and generates HTML around it via a plugin; Vite starts from an HTML file
that already contains the script tag, so there is nothing left for `entry` to configure —
the file *is* the entry, structurally, not by convention. `output.path`/`filename` survive as
`build.outDir`/`assetsDir` because a build still has to land somewhere on disk, but content
hashing is a default rather than a template you write, because Vite has no case where a
normal app build wants it off.

**★ Where does `output.publicPath` go, and why do migrations miss it?**
To the top-level `base` option, not anywhere under `build`. Migrations miss it because the
natural instinct — grep the webpack config for `output.*`, paste the matches under Vite's
`build` key — puts every other `output` field in the right place except this one, and the
config still runs locally without it because local dev is almost always served from `/`. The
failure only appears in a subpath deployment, which is usually a different environment from
whichever one first ran the ported config, so the gap survives review.

**★ What is the actual behavioural difference between the top-level `input` and `build.rolldownOptions.input`, and when does it matter?**
The top-level `input` is read by both the dev server and the build; `build.rolldownOptions.input`
only overrides it for `vite build` and is invisible to `vite dev`. It matters the moment a
multi-page config is ported by only editing the `build` block, which is the natural place to
look because that is where webpack's `entry` conceptually lived — the second page then builds
correctly and 404s the instant someone tries to reach it from the dev server, which is
usually how the gap is found.

---

← [01f · Eject and CRACO apps](01f-eject-and-craco-codebases.md) · [Vite overview](../../README.md) · Next → [01h · devServer → server](01h-devserver-and-resolve.md)
