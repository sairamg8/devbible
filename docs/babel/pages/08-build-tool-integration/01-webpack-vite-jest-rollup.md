---
title: "Build Tool Integration: Webpack, Vite, Jest & Rollup"
sidebar_label: "Build Tool Integration"
sidebar_position: 1
---

# 🔗 Build Tool Integration: Webpack, Vite, Jest & Rollup

Covers syllabus **§8.1 babel-loader**, **§8.2 Vite Babel path**, **§8.3 babel-jest**, and **§8.4 Rollup plugin-babel**.

Cross-links: [Webpack loaders](../../../webpack/pages/04-loaders/01-transpilation-and-style-loaders.md) (syllabus §4), [Vite plugins](../../../vite/pages/08-plugin-system/01-plugin-api.md) (syllabus §8), [Jest](../../../jest-rtl/pages/01-jest-core-concepts/01-test-structure.md).

## 1. Concept & Under-the-Hood Mechanics

### 8.1 Webpack (`babel-loader`)

- **`cacheDirectory`** / compression options — persistent transform cache across builds  
- **`exclude: /node_modules/`** — default wisdom; exceptions for ESM packages that ship modern syntax (`include` specific packages or use `exclude` function)  
- Align `sourceMaps` with Webpack `devtool`  

### 8.2 Vite (`@vitejs/plugin-react` Babel path)

The standard `@vitejs/plugin-react` (non-SWC) already runs Babel on every `.jsx`/`.tsx` file **by default in dev**, applying `react-refresh/babel` plus jsx-self/jsx-source — Fast Refresh boundary registration needs real AST plugin support that esbuild alone can't provide, so this isn't an opt-in path. Passing custom **Babel plugins** to the React plugin adds to that already-running step; it doesn't turn Babel on. The only way to avoid Babel entirely is switching to the separate `@vitejs/plugin-react-swc` package, which reimplements Fast Refresh instrumentation in SWC. Prefer `-swc` unless a Babel-only plugin is mandatory, and know that dev-server Babel cost exists even with zero custom plugins configured.

### 8.3 Jest (`babel-jest`)

- Auto-detects `babel.config.*` when `transform` is default  
- **`transformIgnorePatterns`** — force transform of ESM-only dependencies that would otherwise throw `Cannot use import statement outside a module`  

### 8.4 Rollup/Rolldown (`@rollup/plugin-babel`)

Library authors still use Babel for **target matrices** and plugin codegen when Rolldown/esbuild output is insufficient for their support policy.

---

## 2. Real-World Engineering Scenario

**Scenario: Vite dev is fast; Jest is slow and fails on a dependency.**

App uses Vite+SWC; Jest still uses babel-jest with full preset-env + styled-components. A new dependency ships ESM-only. Tests crash until `transformIgnorePatterns` is updated. Longer-term: align Jest on `swc-jest` or Vite-node/Vitest to match the app compiler.

---

## 3. Production-Grade Code Example

```js
// webpack rule sketch
module.exports = {
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
            rootMode: 'upward',
          },
        },
      },
    ],
  },
};
```

```ts
// vite.config.ts — Babel only when a plugin requires it
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-styled-components', { displayName: true }]],
      },
    }),
  ],
});
```

```js
// jest.config.js
module.exports = {
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  transformIgnorePatterns: ['/node_modules/(?!(some-esm-lib)/)'],
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Transpiling all of node_modules
CI times explode—exclude by default; allowlist exceptions.

### ⚠️ Different Babel config for Webpack vs Jest
“Works in app, fails in test” — share root `babel.config.js` with env blocks.

### ⚠️ Forcing Vite Babel path for no reason
Deletes the point of Vite’s speed—audit plugins annually.

### ⚠️ source map mismatches
Debug points land on wrong lines—unify babel sourceMaps + bundler devtool.

{/* LINKMAP:START */}

## Further reading

*Best explanations found elsewhere on the web — added alongside this page, nothing here replaces it.*

- **Read this:** [babel-loader](https://github.com/babel/babel-loader) — GitHub README: `cacheDirectory` and `cacheCompression`, exclude `node_modules`, transform-runtime for helper bloat; written for Babel 7, and loader 10.x lists Babel `^7.12.0 || ^8.0.0-alpha` only (*read*)
- **Also good:** [@rollup/plugin-babel](https://github.com/rollup/plugins/tree/master/packages/babel) — GitHub README: `babelHelpers` modes `bundled` (default), `runtime`, `inline` (not recommended) and `external`, and when to use each (*read*)
- **Also good:** [babel-loader on webpack.js.org](https://webpack.js.org/loaders/babel-loader) — webpack.js.org: the README rendered inside webpack's docs; says the loader is community maintained and works with webpack or Rspack (*read*)
- **Read this:** [Getting Started: Using Babel](https://jestjs.io/docs/getting-started) — jestjs.io: `babel-jest` transforms automatically when a Babel config exists, `targets: &#123;node: 'current'&#125;`, `api.env('test')`, and the "Jest does not type-check" warning (in the TypeScript subsection) (*read*)
- **Also good:** [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react) — GitHub README: Babel appears only for the React Compiler preset via `@rolldown/plugin-babel`; `react()` has no `babel` option, and the `compiler` option uses Oxc (*read*)
- **Also good:** [plugin-react CHANGELOG](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/CHANGELOG.md) — GitHub: 6.0.0 removed Babel as a dependency (Vite 8 does the refresh transform with Oxc); Vite 7 and below are no longer supported by 6.x; 5.1.4 still had the `babel` option (*read*)
- **Beyond the docs:** [React Compiler 1.0 + Vite 8: The Right Way to Install After plugin-react v6 Drops Babel](https://recca0120.github.io/en/2026/04/14/react-compiler-vite-v6/) — recca0120 Tech Notes, 2026-04-14: shows the install and `babel()` plus `reactCompilerPreset()` order for Vite 8, and says the old `react(&#123; babel &#125;)` form still applies to Vite 7 and earlier

{/* LINKMAP:END */}
