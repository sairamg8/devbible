---
title: "Babel Presets: env, React, TypeScript & Framework Bundles"
sidebar_label: "Babel Presets"
sidebar_position: 1
---

# 🎁 Babel Presets: env, React, TypeScript & Framework Bundles

Covers syllabus **§4.1 preset-env**, **§4.2 preset-react**, **§4.3 preset-typescript**, and **§4.4 Framework-Bundled Presets**.

## 1. Concept & Under-the-Hood Mechanics

### 4.1 @babel/preset-env

Selects transforms/polyfills from **targets**:

- `targets` option or **browserslist** (`.browserslistrc`, `package.json#browserslist`)  
- **`useBuiltIns`:** `'usage'` | `'entry'` | `false` — automatic `core-js` injection strategy  
- **`corejs`:** major version must match installed `core-js`  
- **`modules`:** `false` for bundlers (preserve ES modules); `commonjs` for Node/Jest  
- **`include` / `exclude`:** force specific plugins on/off  

`usage` polyfills only detected features but can miss edge paths; `entry` injects based on full target matrix at a single entry import—bundle size tradeoffs matter.

### 4.2 @babel/preset-react

| Runtime | Emit |
| --- | --- |
| `classic` | `React.createElement` — needs `React` in scope historically. **This remains the preset's own default** — `automatic` is not applied unless you set it. |
| `automatic` (recommended for React 17+) | `jsx`/`jsxs` from `react/jsx-runtime`. Frameworks (Next.js, Vite's React plugin, CRA-successors) set this for you; a bare `@babel/preset-react` does not pick it automatically. |

`development: true` uses `jsx-dev-runtime` for better component stacks.

### 4.3 @babel/preset-typescript

**Type-stripping only**—no type checking. Align with TS:

- Prefer `isolatedModules` / `verbatimModuleSyntax` on the TS side so constructs Babel cannot emit (`const enum`, some re-export patterns) are forbidden at typecheck time.

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
        useBuiltIns: 'usage',
        corejs: 3,
        modules: false,
        exclude: ['transform-typeof-symbol'], // example surgical exclude
      },
    ],
    ['@babel/preset-react', { runtime: 'automatic', development: process.env.BABEL_ENV === 'development' }],
    ['@babel/preset-typescript', { isTSX: true, allExtensions: true }],
  ],
};
```

```json
// package.json
{
  "browserslist": ["defaults and fully supports es6-module"]
}
```

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
