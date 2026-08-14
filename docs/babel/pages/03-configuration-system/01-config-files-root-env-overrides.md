---
title: "Babel Configuration: Files, Root, env & overrides"
sidebar_label: "Babel Configuration"
sidebar_position: 1
---

# 📋 Babel Configuration: Files, Root, env & overrides

Covers syllabus **§3.1 Config File Forms**, **§3.2 Root/Monorepos**, **§3.3 env-based Config**, and **§3.4 overrides**.

## 1. Concept & Under-the-Hood Mechanics

### 3.1 Config File Forms

| Form | Scope |
| --- | --- |
| `babel.config.js` / `.cjs` / `.mjs` / `.json` | **Project-wide** — monorepo root config applies across packages when resolved as root |
| `.babelrc` / `.babelrc.json` | **File-relative** — package-local; does not automatically apply across package boundaries the same way |
| `package.json` `"babel"` | Inline small-repo config |

### 3.2 Config Resolution & Root (Monorepos)

- **`root` / `rootMode: 'upward' | 'upward-optional'`** — find monorepo root config when compiling from a package subdirectory.  
- **`babelrcRoots`** — allow specific packages’ `.babelrc` to load when using a shared root config.  

This is **not** the same as ESLint's flat-config resolution model: flat config is a single non-cascading array evaluated from the project root, not a per-directory lookup at all (that per-directory cascade was legacy `.eslintrc`'s behavior, which flat config replaced). Babel's root/rootMode resolution is its own distinct model and a common source of "why didn't my transform apply?" bugs—see [recipes](../16-real-world-workflows-and-recipes/01-setup-debug-and-migrate.md).

### 3.3 env-based Config

The `"env"` key selects blocks via `BABEL_ENV` or fallback `NODE_ENV` (`development`, `production`, `test`). Classic pattern: enable **CommonJS modules** only under `env.test` for Jest, keep ESM for modern bundlers in development/production.

### 3.4 overrides

`overrides: [{ test, include, exclude, plugins, presets }]` applies different pipelines to path globs (e.g. legacy folder needs older targets).

---

## 2. Real-World Engineering Scenario

**Scenario: workspace package not transformed in the app build.**

App depends on `@acme/ui` published as raw ESM+JSX from source. Root has no `babel.config.js`; only `apps/web/.babelrc`. Babel never applies to files under `packages/ui` because `.babelrc` is package-scoped. Fix: root `babel.config.js` + `rootMode: 'upward'` from the bundler context, or compile packages before publish.

---

## 3. Production-Grade Code Example

```js
// babel.config.js (repo root)
module.exports = {
  rootMode: 'upward-optional',
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' }, modules: false }],
    ['@babel/preset-react', { runtime: 'automatic' }],
    '@babel/preset-typescript',
  ],
  env: {
    test: {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript',
      ],
    },
  },
  overrides: [
    {
      test: ['./packages/legacy/**'],
      presets: [
        ['@babel/preset-env', { targets: { ie: '11' } }],
      ],
    },
  ],
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Both babel.config.js and nested .babelrc fighting
Unpredictable merges—prefer one strategy.

### ⚠️ `NODE_ENV=production` during tests accidentally
Skips test env block; Jest gets ESM when it expected CJS (or the reverse).

### ⚠️ Setting `modules: false` for Jest without an ESM runner
Hard-to-parse import errors—use env.test.

### ⚠️ Forgetting monorepo root when using babel-loader in a package
Transforms silently no-op on linked workspace sources.
