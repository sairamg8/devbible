---
title: "Babel Presets: env, React, TypeScript & Framework Bundles"
sidebar_label: "Babel Presets"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

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

# 🎁 Babel Presets: env, React, TypeScript & Framework Bundles

Covers syllabus **§4.1 preset-env**, **§4.2 preset-react**, **§4.3 preset-typescript**, and **§4.4 Framework-Bundled Presets**.

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

### 4.2 @babel/preset-react

| Runtime | Emit |
| --- | --- |
| `classic` | `React.createElement` — needs `React` in scope. **The preset's own default under Babel 7** (probed: `runtime = "classic"` in the installed `@babel/preset-react` 7.29.7), where `automatic` is not applied unless you set it. |
| `automatic` (recommended for React 17+) | `jsx`/`jsxs` from `react/jsx-runtime`. Frameworks (Next.js, Vite's React plugin, CRA-successors) set this for you. 🔴 **Under Babel 8 this is the default** — the option *"defaults to `automatic`"*. |

🔴 **This default flipped, and it is the single most confusing thing about this preset.** Babel 8
lists the change as *"Use the new JSX implementation by default"*, with the migration note: *"If
you are using a modern version of React or Preact, it should work without any configuration
changes. Otherwise, you can pass the `runtime: "classic"` option"*
([Babel 8 breaking changes](https://babeljs.io/docs/v8-migration)). So on Babel 7 a bare
`@babel/preset-react` emits `React.createElement` and needs `React` in scope; on Babel 8 the same
config emits imports from `react/jsx-runtime` and does not. Writing `runtime` explicitly is how you
stop caring which major you are on.

`development: true` uses `jsx-dev-runtime` for better component stacks. ⚠️ Do not hand-wire it:
the current docs say `development` *"defaults to `true` if Babel's `envName` id `"development"`,
and `false` otherwise"* (grammar as published), and `envName` is
`BABEL_ENV || NODE_ENV || "development"` — so the preset already tracks the environment for you.

### 4.3 @babel/preset-typescript

**Type-stripping only**—no type checking, and the docs are blunt about what that costs:

> *"This plugin does not add the ability to type-check the JavaScript passed to it."* … *"Since
> Babel does not type-check, code which is syntactically correct, but would fail the TypeScript
> type-checking may successfully get transformed, and often in unexpected or invalid ways."*
> — [@babel/plugin-transform-typescript](https://babeljs.io/docs/babel-plugin-transform-typescript)

Align with TS:

- Prefer `isolatedModules` / `verbatimModuleSyntax` on the TS side, because Babel compiles one file
  at a time and *"The build process will always behave as though `isolatedModules` is turned on"*.
  Turning the same flag on in `tsconfig.json` makes `tsc` report the constructs that depend on
  cross-file knowledge — ambient declarations, re-exporting a type without `export type` — instead
  of letting Babel emit something plausible and wrong.
- ⚠️ **`const enum` is not one of the things Babel refuses to emit.** The preset ships an
  `optimizeConstEnums` option (default `false`); with it on, *"Babel will inline enum values rather
  than using the usual `enum` output"* and exported const enums become plain object literals,
  *"avoiding cross-file dependency requirements"*. Left off, a `const enum` compiles like a regular
  enum. The real caveat is the *cross-file* case, which no single-file compiler can do — not the
  syntax itself.

### 4.4 Framework-Bundled Presets

- **`next/babel`** — Next.js's bundled preset, shipped inside the `next` package itself (not a separately published `babel-preset-next` package). Reference it as `presets: ['next/babel']` in a custom `babel.config.js`/`.babelrc` when on the Babel path.  
- **`metro-react-native-babel-preset`** (name evolves—check RN version) — React Native entry  
- Always **read the framework default** before adding a custom `babel.config.js` (adding one may disable faster compilers)

---

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

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ preset-typescript “succeeds” with type errors
Always run `tsc --noEmit` separately—see [interop](../09-linter-and-type-checker-interop/01-babel-eslint-parser-and-tsc.md).

### ⚠️ classic JSX runtime + React 17+ automatic assumptions
Missing React imports or double runtimes.

### ⚠️ polyfills in library code with useBuiltIns: usage
Can pollute consumer globals—libraries often use `useBuiltIns: false` and document peer polyfills.

### ⚠️ Adding babel.config.js to Next without reading SWC docs
May silently leave the fast path—measure compile times.
