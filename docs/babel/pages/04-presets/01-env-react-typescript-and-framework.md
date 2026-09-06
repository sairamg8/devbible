---
title: "`@babel/preset-env`: targets, polyfills, and the Babel 8 boundary"
sidebar_label: "Babel Presets"
sidebar_position: 1
---

> Verified: 2026-09-06 against the Babel documentation at babeljs.io for **Babel 8.0.1** — npm
> `latest` for `@babel/core`, read from `npm view @babel/core dist-tags` on 2026-09-06 —
> [@babel/preset-env](https://babeljs.io/docs/babel-preset-env),
> [@babel/preset-react](https://babeljs.io/docs/babel-preset-react),
> [@babel/preset-typescript](https://babeljs.io/docs/babel-preset-typescript),
> [@babel/plugin-transform-typescript](https://babeljs.io/docs/babel-plugin-transform-typescript)
> and [Babel 8 breaking changes](https://babeljs.io/docs/v8-migration). Babel 7 defaults marked
> *probed* were read out of the packages installed in this checkout (all 7.29.7).
> Documentation-validated, **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session 4e8d4393

# 🎁 `@babel/preset-env`: targets, polyfills, and the Babel 8 boundary

Covers syllabus **§4.1 preset-env**. The language and framework presets — **§4.2 preset-react**,
**§4.3 preset-typescript** and **§4.4 Framework-Bundled Presets** — are
[01b](01b-react-typescript-and-framework-presets.md); the worked configuration below uses all
four, because a real `babel.config.js` does.

## 1. Concept & Under-the-Hood Mechanics

### 4.1 @babel/preset-env

Selects transforms/polyfills from **targets**:

- `targets` option or **browserslist** (`.browserslistrc`, `package.json#browserslist`)  
- **`useBuiltIns`:** `'usage'` | `'entry'` | `false` (default) — automatic `core-js` injection strategy. 🔴 **Babel 8 removed this option**; see the boundary note below  
- **`corejs`:** major version must match installed `core-js`. Current docs give the default as `"3.0"` and note it only matters alongside `useBuiltIns: usage` or `entry`  
- **`modules`:** `"amd" | "umd" | "systemjs" | "commonjs" | "cjs" | "auto" | false`, default **`"auto"`** — `false` for bundlers (preserve ES modules); `commonjs` for Node/Jest. Under `"auto"` the preset reads *caller* data to decide, which is how one config emits ESM to a bundler and CJS to a test runner  
- **`include` / `exclude`:** arrays of plugin names or RegExps that force specific plugins on/off  

`usage` polyfills only detected features but can miss edge paths; `entry` injects based on full target matrix at a single entry import—bundle size tradeoffs matter.

🔴 **The Babel 8 boundary on polyfills.** The option reference now marks `useBuiltIns` as
*"removed in Babel 8"*, and the migration guide's instruction is to drop it *"along with
`@babel/plugin-transform-runtime`'s `corejs`"* in favour of `babel-plugin-polyfill-corejs3`. The
`corejs` option itself also tightened: *"The `corejs` option must specify the minor version of
core-js 3"* rather than accepting a bare `3`. Everything above still describes Babel 7 — which is
what most repos are on, including this checkout at 7.29.7 — but a Babel 8 upgrade turns those two
keys into a config error, not a silent no-op.

## 2. Real-World Engineering Scenario

**Scenario: bundle +30% after enabling useBuiltIns: 'entry' without core-js version pin.**

Wrong `corejs` option injects mismatched polyfills or duplicates. Fix: install `core-js@3`, set `corejs: 3`, consider `usage` + browserslist tightened to evergreen baselines.

---

## 3. Production-Grade Code Example

```js
// babel.config.js
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        // No explicit `targets` here on purpose — preset-env falls back to
        // browserslist config (package.json below) when `targets` is
        // omitted. Passing both is not additive: an explicit `targets`
        // option makes Babel ignore browserslist entirely, silently
        // orphaning the package.json block.
        useBuiltIns: 'usage', // Babel 7 only — removed in Babel 8
        corejs: 3,            // Babel 8 wants a minor: '3.38' style, and only via the polyfill plugin
        modules: false,
        exclude: ['transform-typeof-symbol'], // example surgical exclude (a real plugin name)
      },
    ],
    ['@babel/preset-react', { runtime: 'automatic', development: process.env.BABEL_ENV === 'development' }],
    ['@babel/preset-typescript', { isTSX: true, allExtensions: true }], // Babel 7 only
  ],
};
```

The same intent under **Babel 8**, where two of those keys no longer exist:

```js
// babel.config.js — Babel 8
module.exports = {
  presets: [
    ['@babel/preset-env', { modules: false }], // targets still from browserslist; no useBuiltIns
    ['@babel/preset-react', {}],               // runtime already defaults to 'automatic'
    // isTSX + allExtensions are gone: "Remove `isTSX` and `allExtensions` options",
    // replaced by ignoreExtensions when you really are compiling TSX from a non-.tsx file
    ['@babel/preset-typescript', { ignoreExtensions: true }],
  ],
  // Polyfill injection moved out of preset-env entirely: the migration guide points at
  // `babel-plugin-polyfill-corejs3`. Configure it from that plugin's own README — this page
  // does not reproduce its options, because they were not verified in this pass.
};
```

```json
// package.json
{
  "browserslist": ["defaults and fully supports es6-module"]
}
```

The comment in that config is the documented rule, not folklore:

> *"By default, `@babel/preset-env` uses browserslist config sources unless either the `targets` or
> `ignoreBrowserslistConfig` options are set."* — [@babel/preset-env](https://babeljs.io/docs/babel-preset-env)

`ignoreBrowserslistConfig` (default `false`) is the explicit switch: *"Toggles whether or not
browserslist config sources are used, which includes searching for any browserslist files or
referencing the browserslist key inside package.json."*

---

## Gotchas

**★ Setting `targets` silently switches your browserslist config off.** *"By default,
`@babel/preset-env` uses browserslist config sources unless either the `targets` or
`ignoreBrowserslistConfig` options are set."* Symptom: a carefully maintained `.browserslistrc`
that no longer affects the output, usually after someone added `targets: { node: 'current' }` to
fix a test run. Fix: pick one source of truth. If both must exist, know that the option wins and
say so in a comment.

**★ Upgrading to Babel 8 changes your output even if your config never mentioned `targets`.**
*"Babel 7 defaults to `targets: ">= 0%"` (all browsers), while Babel 8 defaults to
`targets: "defaults"`"*. A config that relied on the implicit default was compiling for
effectively everything and now compiles for browserslist's `defaults` query — smaller output, and
a different answer to "does this still run on that old device". Fix: set `targets` (or a
browserslist config) explicitly before the upgrade so the change is a decision rather than a
side effect.

**★ `useBuiltIns` and preset-env's `corejs` are gone in Babel 8.** The option reference marks
`useBuiltIns` *"(removed in Babel 8)"*, and the migration guide says to remove it *"along with
`@babel/plugin-transform-runtime`'s `corejs`"* in favour of `babel-plugin-polyfill-corejs3`.
Symptom: a config that has worked for years fails validation immediately after the upgrade. Fix:
move polyfill injection to the polyfill plugin, configured from its own documentation.

**★ `corejs: 3` is no longer specific enough on Babel 8.** *"The `corejs` option must specify the
minor version of core-js 3."* The reason is the one this page's scenario already describes: the
injected polyfills have to match the `core-js` you actually installed, and a bare major lets those
drift apart. Symptom of the drift on Babel 7: `Cannot find module 'core-js/modules/…'` style
resolution failures, or duplicate polyfills inflating the bundle.

**★ `modules: "auto"` is the default, so writing `modules: false` may be undoing something
useful.** Under `"auto"` the preset asks the caller whether ES modules survive downstream; a
bundler says yes and gets ESM, a CommonJS test runner says no and gets CJS — from one config.
Hardcoding `false` removes that, which is fine for a bundler-only pipeline and is exactly what
breaks the test run with an unexpected `import` token.

**★ Polyfilling a library with `useBuiltIns: 'usage'` pollutes your consumers' globals.** The
injected `core-js` modules patch built-ins process-wide, which is the application's decision to
make, not the library's. Fix: libraries ship with `useBuiltIns: false` (or the pure/`runtime`
polyfill route) and document the environments they assume.

**★ `include` and `exclude` are the escape hatch for when the target data is wrong.** Both take
arrays of plugin names or RegExps and force individual plugins on or off regardless of what
`targets` computed. The case they exist for is an engine that claims a feature and ships it
broken, or a transform you want to skip for size. Fix: name the plugin exactly — the example
config's `exclude: ['transform-typeof-symbol']` is a real plugin name, and a misspelt one is not
an error, it is a silently ignored line.

## Interview questions

**★ How does `@babel/preset-env` decide which transforms to apply?**
From `targets`, resolved either from the `targets` option or from a browserslist config — and it is
one or the other: *"By default, `@babel/preset-env` uses browserslist config sources unless either
the `targets` or `ignoreBrowserslistConfig` options are set."* It maps each target to the set of
features that environment lacks, and enables the corresponding transform plugins. `include` and
`exclude` then force individual plugins on or off when the data disagrees with reality — a known
engine bug, or a transform you want to skip for size.

**★ `useBuiltIns: 'usage'` versus `'entry'` versus `false` — how do you choose?**
`false` (the default) injects nothing: your code must already run in the targets, or you polyfill
by hand. `'entry'` replaces a single `core-js` import at your entry point with exactly the
polyfills your target matrix needs — predictable, and it includes things reached only through
dependencies. `'usage'` inspects each file and injects only the polyfills for features it can see
being used — smaller, but "can see" is the catch: a feature reached dynamically, or used inside a
dependency you do not compile, is not seen. Applications choose between `entry` and `usage`;
libraries generally choose `false`, because injecting global polyfills is the application's
decision. And on Babel 8 the whole option is gone — the job moves to
`babel-plugin-polyfill-corejs3`.

**★ Someone adds `targets: { node: 'current' }` to fix a test run and the production bundle grows.
What happened?**
The `targets` option turned browserslist off. The project's `.browserslistrc` had been narrowing
the browser matrix; with `targets` set, that file is no longer consulted at all, so preset-env is
now compiling for a different environment than the team thinks. Fix is either an `env.test` block
that carries the Node target only for the test run, or moving everything into browserslist and
never setting `targets`.

**★ Your `.browserslistrc` and a `targets` option disagree. Which wins, and how would you find
out without reading this page?**
`targets` wins, and browserslist is not consulted at all — the documented rule is that preset-env
*"uses browserslist config sources unless either the `targets` or `ignoreBrowserslistConfig`
options are set."* The way to find out empirically is to change the browserslist query to
something absurd and see whether the output moves; if it does not, something has switched it off.
The way to prevent the question is to pick one source of truth per repository and write a comment
in the other place saying which.

---

← [Track index](../../README.md) · Next → [Preset-react, preset-typescript and the framework bundles](01b-react-typescript-and-framework-presets.md)
