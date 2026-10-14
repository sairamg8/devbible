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

{/* LINKMAP:START */}

## Further reading

*Best explanations found elsewhere on the web — added alongside this page, nothing here replaces it.*

- **Read this:** [@babel/plugin-transform-typescript](https://babeljs.io/docs/babel-plugin-transform-typescript) — babeljs.io: caveats: it does not add type-checking, `tsconfig.json` changes are not picked up (behaves as if `isolatedModules` is on), no exported `var`/`let` in namespaces, and namespaces do not share scope (*read*)
- **Also good:** [Introducing the New JSX Transform](https://legacy.reactjs.org/blog/2020/09/22/introducing-the-new-jsx-transform.html) — React blog, 2020-09-22: what changes, Babel 7.9.0+, `runtime: "automatic"`; says Babel 8 makes automatic the default, which is now true (*read*)
- **Also good:** [isolatedModules](https://www.typescriptlang.org/tsconfig/isolatedModules.html) — typescriptlang.org: why single-file transpilers break on type re-exports, namespaces in non-module files and ambient const enum members (*read*)

{/* LINKMAP:END */}
