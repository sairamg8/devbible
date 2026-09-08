---
title: "module.rules Becomes Its Own Topic, But DefinePlugin → define and mode → --mode Are Small, Self-Contained Translations Worth Doing Right the First Time"
sidebar_label: "01k · loaders, define & mode"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [Migration from v7](https://vite.dev/guide/migration), [Env Variables and Modes](https://vite.dev/guide/env-and-mode). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+ · webpack 5.110.3**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ `module.rules`, `DefinePlugin` and `mode`

Three more fields from a webpack config, at three different depths. `module.rules` gets one
paragraph here and a pointer, because the real content already exists elsewhere in this
corpus at Master tier. `DefinePlugin` and `mode` get the full treatment, because neither is
covered anywhere else in this depth.

## `module.rules` → plugins — pointer, not a repeat

Every `module.rules` entry selected a **loader** by file extension; Vite has no loader
concept at all, and each rule becomes either something Vite already does natively (most of
the common ones — TS/JSX, CSS, Sass, static assets) or a plugin with a structurally different
interface. That translation — the shape difference between a loader and a plugin, the four
things a hasty port drops (id filtering, source maps, HMR, ordering), and how to estimate the
work honestly — is covered exhaustively in
**[topic 17, "Loaders Become Plugins"](../17-the-2026-toolchain-landscape/02b-loaders-become-plugins.md)**,
and the "what deletes vs. what needs a plugin" table is in
**[topic 17, "What Transfers From webpack to Vite"](../17-the-2026-toolchain-landscape/02-webpack-to-vite-parity.md)**.
Read those before writing a single custom transform — most `module.rules` entries do not need
one.

## `DefinePlugin` → `define`

Both do the same job: a compile-time, textual find-and-replace of an identifier throughout
your source, most commonly used to strip dead `if (process.env.NODE_ENV === 'production')`
branches before they ship.

```javascript
// BEFORE — webpack.config.js
const webpack = require('webpack');

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      __APP_VERSION__: JSON.stringify(require('./package.json').version),
      __FEATURE_FLAGS__: JSON.stringify({ newDashboard: true }),
    }),
  ],
};
```

```typescript
// AFTER — vite.config.ts. Same substitution semantics, different config surface.
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __FEATURE_FLAGS__: JSON.stringify({ newDashboard: true }),
    // process.env.NODE_ENV needs NO entry here — Vite already replaces it
    // based on the build mode, the same way DefinePlugin's most common use did.
  },
});
```

Both tools require the same easy-to-forget detail: **string values must be pre-stringified**
with `JSON.stringify`, because `define` is a literal text substitution, not a value
assignment — `__APP_VERSION__: pkg.version` would splice the raw, unquoted version string
into your code as if it were a JavaScript expression, which for a value like `1.4.0` breaks
outright and for a value like `main` silently becomes a reference to an undefined variable
named `main`.

⚠️ **This is where the two tools stop being equivalent, not where they start.** `define`'s
object-value semantics changed between Vite 7 and 8 in a way that matters for anyone defining
a shared object rather than primitives — covered in the next chunk of this topic, on
upgrading Vite itself, since it is a Vite-8-specific behaviour change rather than a
webpack-vs-Vite difference.

## `mode` → `--mode`

webpack's `mode` is a string (`'development'` | `'production'` | `'none'`) that sets several
defaults at once — minification, `process.env.NODE_ENV`, tree-shaking aggressiveness — and is
usually set per npm script rather than typed by hand.

```json
// BEFORE — package.json
{
  "scripts": {
    "build": "webpack --mode production",
    "build:staging": "webpack --mode production --env staging"
  }
}
```

Vite's mode is a different, and more general, concept: it is not a build-optimisation switch,
it is the name of the **environment** — used to select which `.env.<mode>` file to load — and
it defaults sensibly (`vite` runs in `'development'`, `vite build` runs in `'production'`)
without you setting anything.

```json
// AFTER — package.json
{
  "scripts": {
    "build": "vite build",
    "build:staging": "vite build --mode staging"
  }
}
```

```bash
# .env.staging — loaded automatically because --mode staging was passed
VITE_API_URL=https://staging-api.acme.com
```

The practical difference that trips people up: **webpack's `mode` and Vite's `mode` do not
map 1:1 to "dev vs. prod" once you have more than two environments.** webpack's `mode` only
ever had three legal values, so a `staging` build was `--mode production --env staging` with
`env` doing the real work; Vite's `--mode` string is free-form, and `staging` is exactly as
valid a mode as `production`, resolving `.env.staging` on its own. A migration that keeps
threading a separate `--env`-shaped flag through `vite build` is solving a problem Vite's
`--mode` already solves natively.

```typescript
// If build behaviour (not just env vars) needs to differ by mode/command,
// defineConfig accepts a function — this is webpack's per-environment
// `module.exports = (env, argv) => ({...})` pattern, reshaped.
import { defineConfig } from 'vite';

export default defineConfig(({ command, mode }) => ({
  build: {
    sourcemap: mode === 'staging', // ship source maps to staging only
    minify: command === 'build',
  },
}));
```

---

## Gotchas

**★ Symptom: `DefinePlugin`'s string value is spliced into the output as bare, unquoted text and the build fails with a syntax error.** Cause: the value was not passed through `JSON.stringify` — `define` performs a literal text substitution, so an unquoted string is inserted as if it were source code. Fix: always `JSON.stringify` the value, exactly as `DefinePlugin` also required; this is not a Vite-specific gotcha, but it is the single most common mistake in a `DefinePlugin` → `define` port because people copy the *value* and forget it was already being stringified somewhere else in the old config.

**★ Symptom: `process.env.NODE_ENV` was explicitly defined via `DefinePlugin` and the port carries that entry over into `define`, and something behaves oddly around it.** Cause: Vite already substitutes `process.env.NODE_ENV`-shaped checks based on the active mode as part of its own pipeline; adding a redundant `define` entry for the exact same key is usually harmless but is dead configuration inherited for no reason. Fix: remove the redundant entry and confirm the mode-based behaviour Vite already provides covers the same cases before assuming a custom one is still needed.

**★ Symptom: a `staging` build script that used to pass `webpack --mode production --env staging` gets ported as `vite build --mode production` and staging-specific env vars never load.** Cause: the two `mode` concepts were conflated — webpack's `mode` controls optimisation level and had nothing to do with which env file loaded (that was `--env`'s job), while Vite's `--mode` is the string that selects `.env.<mode>` directly. Fix: `vite build --mode staging`, and let Vite's build optimisations follow the `command` (`build` vs `serve`), not a separate flag that no longer exists.

**★ Symptom: `defineConfig`'s function form is reached for immediately, "because webpack's config was a function of `env`," and it turns out not to be needed.** Cause: most webpack configs used the function form purely to read `--mode`/`--env` for **env-var selection**, which Vite already does natively via `.env.<mode>` files with zero config. Fix: use the plain object form of `defineConfig` unless `build`, `plugins`, or `resolve` genuinely need to differ by command or mode — reach for the function form only when the object form cannot express the difference.

---

## Interview questions

**★ Why does `DefinePlugin` → `define` count as "mostly the same semantics" while `output.manualChunks` → Rolldown's `codeSplitting` does not?**
Because `DefinePlugin` and `define` solve exactly the same, narrow problem — compile-time
textual substitution of an identifier — and neither tool's version of it encodes any project-
specific intent beyond "replace this token with this value." `manualChunks`/`splitChunks`, by
contrast, encodes a caching *strategy* specific to one application's dependency graph and
deploy cadence, which is why translating it is a design exercise rather than a syntax swap —
covered in this topic's later chunk on `splitChunks`. The rule of thumb: a config field that
is purely mechanical (do X to token Y) ports cleanly; a config field that encodes a decision
about *this specific app's* behaviour does not, regardless of how similar the two tools' APIs
look on paper.

**★ A team's webpack config used `mode` and `env` together to select a staging build. What is the direct translation, and what is the trap in translating it too literally?**
The direct translation is Vite's `--mode staging`, which loads `.env.staging` on its own —
there is no separate `--env` flag to preserve, because Vite's single `mode` string already
does the job webpack split across two mechanisms (`mode` for optimisation level, `env` for
custom flags read inside the config function). The trap is porting the *shape* rather than
the *intent*: keeping a `--env staging` flag alive and reading it inside `defineConfig`'s
function form, when `mode === 'staging'` inside that same function already carries the
information, just via the mechanism Vite actually built for this. The literal translation
works; it also means carrying forward a webpack-shaped abstraction that Vite's `mode`
concept was specifically designed to replace.

---

← [01j · CommonJS in app source](01j-commonjs-in-application-source.md) · [Vite overview](../../README.md) · Next → [01l · splitChunks → codeSplitting](01l-splitchunks-to-code-splitting.md)
