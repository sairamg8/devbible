---
title: "Monorepo & Multi-Package Babel Strategies"
sidebar_label: "Monorepo & Multi-Package Babel Strategies"
sidebar_position: 1
---

# 📁 Monorepo & Multi-Package Babel Strategies

Covers syllabus **§12.1 Shared Root Config** and **§12.2 Cross-Package Compilation**.

## 1. Concept & Under-the-Hood Mechanics

### 12.1 Shared Root Config

One **`babel.config.js` at the repo root** keeps targets/presets consistent. Use `overrides` / `env` for divergent packages (Node CLI vs browser app).

### 12.2 Cross-Package Compilation

`.babelrc` in an app **does not** reliably transform sibling workspace packages consumed as source. You need:

- Root `babel.config.js`, and  
- Bundler/`rootMode` setup that resolves it, **or**  
- Precompile packages before consumption  

**Publishing strategies:**

| Approach | Pros | Cons |
| --- | --- | --- |
| Publish precompiled `dist` | Consumers need no Babel | Dual ESM/CJS complexity |
| Consume source in monorepo | Fast iteration | Every consumer must transform JSX/TS |

---

## 2. Real-World Engineering Scenario

**Scenario: `@acme/ui` JSX breaks the Next app after moving to SWC.**

While both used Babel root config, SWC in the app didn’t apply the same Emotion plugin to package sources. Fix: either compile `@acme/ui` to plain JS in its build, or configure SWC plugins for Emotion monorepo-wide.

---

## 3. Production-Grade Code Example

```js
// babel.config.js (root)
module.exports = {
  babelrcRoots: ['.', './packages/*'],
  presets: [
    ['@babel/preset-env', { modules: false }],
    ['@babel/preset-react', { runtime: 'automatic' }],
    '@babel/preset-typescript',
  ],
  overrides: [
    {
      test: ['./packages/cli/**'],
      presets: [
        ['@babel/preset-env', { targets: { node: '20' }, modules: 'commonjs' }],
      ],
    },
  ],
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Per-package contradictory targets
Browser package accidentally compiled with `node: current` only.

### ⚠️ Publishing source TypeScript without declaring consumer transform requirements
Downstream support nightmare.

### ⚠️ babelrcRoots wildcards that include apps twice
Confusing double application—test with `@babel/cli` on a package file.

### ⚠️ Forgetting test env for Jest in monorepo root config
Tests break only in packages that relied on local .babelrc before centralization.
