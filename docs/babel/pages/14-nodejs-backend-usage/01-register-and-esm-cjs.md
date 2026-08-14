---
title: "Node.js / Backend Babel Usage"
sidebar_label: "Node.js / Backend Babel Usage"
sidebar_position: 1
---

# 🟢 Node.js / Backend Babel Usage

Covers syllabus **§14.1 Runtime Registration** and **§14.2 ESM/CJS Interop**.

## 1. Concept & Under-the-Hood Mechanics

### 14.1 Runtime Registration

| Tool | Role |
| --- | --- |
| `@babel/register` | Hooks `require` to compile on the fly — **dev only** |
| `@babel/node` | Node CLI wrapper using register for scripts |

**Never** use `@babel/register` as the production server loader—startup cost, cache complexity, and security/review surface. Precompile with CLI or a bundler for prod.

### 14.2 ESM/CJS for Backend Packages

- Dual publish: compile once to CJS, once to ESM (`modules: false` vs `commonjs`), or use a modern dual-package pattern carefully.  
- **`package.json` `"type": "module"`** interacts with Babel’s `modules` option—mismatches produce `require` of ESM or extension resolution errors.  

---

## 2. Real-World Engineering Scenario

**Scenario: production memory leak traced to @babel/register left in Docker CMD.**

Someone copied a dev start script to prod. Every request path paid transform costs; memory grew. Fix: `node dist/server.js` from precompiled output; remove register from prod image.

---

## 3. Production-Grade Code Example

```js
// babel.config.js for a Node library
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: { node: '20' },
        modules: process.env.BABEL_MODULE === 'esm' ? false : 'commonjs',
      },
    ],
    '@babel/preset-typescript',
  ],
};
```

```json
{
  "scripts": {
    "build:cjs": "babel src --out-dir dist/cjs --extensions .ts",
    "build:esm": "BABEL_MODULE=esm babel src --out-dir dist/esm --extensions .ts",
    "dev": "babel-node --extensions .ts src/index.ts"
  }
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ register in production
Operational hazard—ban in deploy scripts.

### ⚠️ Dual package hazard (Node “exports” misconfiguration)
Conditional exports must match actual emit format.

### ⚠️ Mixing ts-node and babel-node without policy
Two transform pipelines diverge—pick one for scripts.

### ⚠️ Ignoring .mjs/.cjs extension rules under "type": "module"
Resolution bugs that only appear in consumers.
