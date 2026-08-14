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
