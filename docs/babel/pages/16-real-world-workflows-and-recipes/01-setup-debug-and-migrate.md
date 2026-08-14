---
title: "Babel Real-World Workflows & Recipes"
sidebar_label: "Babel Real-World Workflows & Recipes"
sidebar_position: 1
---

# 🍳 Babel Real-World Workflows & Recipes

Covers syllabus **§16.1 Setup**, **§16.2 Debugging**, and **§16.3 Migration** recipes.

## 1. Concept & Under-the-Hood Mechanics

These playbooks compose earlier sections into tasks a senior engineer runs end-to-end: stand up a library pipeline, debug “transform didn’t apply,” and decide whether Babel should remain.

---

## 2. Real-World Engineering Scenario

You inherit a polyrepo merge: one package uses Babel+CLI, one uses Vite+SWC, tests use babel-jest with a third config. On-call pages from “Cannot use import statement” in CI. The recipes below are the stabilization path.

---

## 3. Production-Grade Code Example

### 16.1 Setup Recipes

#### Bare library build (preset-env + CLI)

```bash
pnpm add -D @babel/core @babel/cli @babel/preset-env @babel/preset-typescript
```

```js
// babel.config.js
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: '18' }, modules: 'commonjs' }],
    '@babel/preset-typescript',
  ],
};
```

```json
{
  "scripts": {
    "build": "babel src --out-dir dist --extensions \".ts\" --source-maps"
  }
}
```

#### Styled-components / Emotion pipeline

```js
module.exports = {
  presets: [
    ['@babel/preset-env', { modules: false }],
    ['@babel/preset-react', { runtime: 'automatic' }],
    '@babel/preset-typescript',
  ],
  plugins: [
    ['babel-plugin-styled-components', { displayName: true, pure: true }],
    // OR '@emotion/babel-plugin' — not both casually
  ],
};
```

#### Path alias via module-resolver (match tsconfig)

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

```js
// babel.config.js plugins entry
[
  'module-resolver',
  { alias: { '@': './src' } },
]
```

Also set Jest `moduleNameMapper` / bundler alias—Babel alone does not fix Vite resolve.

### 16.2 Debugging Recipes

#### “Why didn’t my transform apply?”

Checklist:

1. Which config file won? (`babel.config.js` vs `.babelrc` vs `package.json`)  
2. Monorepo: is root config visible? `rootMode` / cwd of the tool  
3. `overrides` / `exclude` accidentally skipping the file  
4. `env` block: is `BABEL_ENV`/`NODE_ENV` what you think?  
5. Is the bundler even using Babel (SWC path active)?  

```bash
DEBUG=babel* # may help with some tooling; also use
npx babel path/to/file.tsx --out-file /tmp/out.js
```

#### Broken third-party ESM package in Jest

```
SyntaxError: Cannot use import statement outside a module
```

```js
// jest.config.js
transformIgnorePatterns: [
  '/node_modules/(?!(package-a|package-b)/)',
],
```

Ensure babel-jest applies preset-env to those packages.

### 16.3 Migration Recipes

#### Audit whether Babel is still needed

| Question | If no for all… |
| --- | --- |
| Custom Babel plugins? | |
| macros? | |
| Targets SWC/esbuild cannot hit? | |
| Codemod-only usage? | Keep Babel as a **dev tool**, not app compile |

If all no for **app compile** → migrate to framework default compiler.

#### Trim preset-env output

1. Record bundle size / polyfill size  
2. Tighten browserslist  
3. Rebuild and compare  
4. Run smoke tests on supported browsers  

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Fixing Jest ESM errors by babel-compiling all of node_modules
CI time explosion—allowlist packages only.

### ⚠️ module-resolver alias drift from tsconfig
Types pass, runtime fails (or the reverse)—generate one map or use a shared JSON.

### ⚠️ Debugging only in the Next production build
Isolate with `@babel/cli` first.

### ⚠️ Declaring “Babel free” while babel-jest remains
Be precise: free from **app compile** vs free from **repo entirely**.

### ⚠️ Migration without documenting the decision
The next hire reintroduces babel.config.js “for React.”
