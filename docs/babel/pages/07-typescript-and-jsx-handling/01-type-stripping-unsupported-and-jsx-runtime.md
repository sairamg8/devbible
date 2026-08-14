---
title: "TypeScript & JSX in Babel: Strip, Gaps & Automatic Runtime"
sidebar_label: "TypeScript & JSX in Babel"
sidebar_position: 1
---

# 🔷 TypeScript & JSX in Babel: Strip, Gaps & Automatic Runtime

Covers syllabus **§7.1 Type-Stripping**, **§7.2 Unsupported TS Features**, and **§7.3 Automatic JSX Runtime**.

## 1. Concept & Under-the-Hood Mechanics

### 7.1 Type-Stripping Semantics

`@babel/preset-typescript` **erases types**. It does not prove soundness. A green Babel build with red `tsc` is normal and dangerous if CI only runs Babel.

Pair with:

- `tsc --noEmit` / project references build  
- and/or type-aware ESLint/Oxlint  

See also [linter interop](../09-linter-and-type-checker-interop/01-babel-eslint-parser-and-tsc.md).

### 7.2 Babel-Unsupported (or Awkward) TS Features

| Feature | Guidance |
| --- | --- |
| `const enum` | Avoid under `isolatedModules`; use regular enums or `as const` objects |
| Legacy `namespace` / `module` | Prefer ES modules; limited support stories |
| `export =` / some CJS interop forms | Prefer ESM `export default` in app code |

TypeScript’s `isolatedModules` / `verbatimModuleSyntax` exist partly so tools like Babel/SWC that compile files in isolation remain safe.

### 7.3 Automatic JSX Runtime

- **`runtime: 'automatic'`** — no need for `import React from 'react'` just for JSX  
- **`jsxImportSource`** — e.g. `@emotion/react` for css prop without per-file pragmas  

Classic runtime still appears in older codebases and some library outputs.

---

## 2. Real-World Engineering Scenario

**Scenario: production bug that “couldn’t compile if types were checked.”**

CI runs `vite build` (esbuild/Babel strip) but not `tsc`. A wrong prop type ships. Incident review adds `tsc -b` as required. Babel was never the villain—the pipeline omitted the typechecker.

---

## 3. Production-Grade Code Example

```js
// babel.config.js
module.exports = {
  presets: [
    [
      '@babel/preset-react',
      {
        runtime: 'automatic',
        importSource: '@emotion/react', // only if using Emotion css prop
      },
    ],
    '@babel/preset-typescript',
  ],
};
```

```json
// tsconfig.json (align with Babel isolation)
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true
  }
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ `jsx: react-jsx` in TS but classic Babel runtime
Duplicate or missing jsx-runtime imports—align configs.

### ⚠️ const enums in published d.ts + Babel consumers
Different emit semantics—ban const enums in shared packages.

### ⚠️ Trusting only webpack babel-loader as “the type gate”
It is not.

### ⚠️ Emotion importSource without the Emotion Babel/SWC plugin when required
css prop may not work as expected—check Emotion docs for your major.
