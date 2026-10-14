---
title: "Linter & Type-Checker Interop with Babel"
sidebar_label: "Linter & Type-Checker Interop with Babel"
sidebar_position: 1
---

# 🔍 Linter & Type-Checker Interop with Babel

Covers syllabus **§9.1 @babel/eslint-parser** and **§9.2 Coexisting with tsc**.

Cross-link: [ESLint language options](../../../eslint-oxlint/pages/04-eslint-language-options-globals-and-parsing/01-language-options-and-file-targeting.md) (syllabus ESLint §4).

## 1. Concept & Under-the-Hood Mechanics

### 9.1 @babel/eslint-parser

ESLint needs a parser that understands the syntax you write. In **2026**, most TS apps use **`typescript-eslint`’s parser**, not Babel’s.

`@babel/eslint-parser` still appears when:

- You rely on experimental syntax typescript-eslint/espree cannot parse  
- Legacy repos already wired Babel as the single syntax source of truth  

**Tradeoff:** swapping to Babel’s parser can **lose or complicate type-aware linting** that depends on typescript-eslint’s TS program integration. Prefer typescript-eslint unless you have a documented syntax requirement.

### 9.2 Coexisting with tsc

Division of labor:

| Tool | Owns |
| --- | --- |
| Babel / SWC / esbuild | Emit/strip/transform for runtime |
| `tsc --noEmit` | Type correctness |
| ESLint / Oxlint | Patterns, a11y, hooks, policy |

CI should require **both** transform success and typecheck success as separate steps.

---

## 2. Real-World Engineering Scenario

**Scenario: team enables @babel/eslint-parser “to match Babel.”**

Type-aware rules stop working; floating promises regress. The syntax was already standard TSX. Revert to typescript-eslint parser; keep Babel only in the build.

---

## 3. Production-Grade Code Example

```js
// Rare: eslint.config.mjs with Babel parser (legacy/experimental)
import babelParser from '@babel/eslint-parser';

export default [
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ['@babel/preset-react'],
        },
      },
    },
  },
];
```

```json
// package.json CI scripts
{
  "scripts": {
    "typecheck": "tsc -b --pretty false",
    "build": "vite build",
    "lint": "oxlint && eslint .",
    "ci": "pnpm typecheck && pnpm lint && pnpm build"
  }
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ requireConfigFile mistakes
Parser cannot find babel config—parse errors on valid app code.

### ⚠️ Assuming ESLint type-aware works identically under Babel parser
It generally does not—verify before committing.

### ⚠️ CI only running `build`
Types never gate merges—add `typecheck`.

### ⚠️ Duplicate language features enabled in Babel and ESLint inconsistently
Optional chaining parses in one tool and fails in another—align versions.

{/* LINKMAP:START */}

## Further reading

*Best explanations found elsewhere on the web — added alongside this page, nothing here replaces it.*

- **Read this:** [@babel/eslint-parser](https://babeljs.io/docs/babel-eslint-parser) — babeljs.io: use it only if Babel transforms your code, `requireConfigFile`, `babelOptions`, limits (core rules need `@babel/eslint-plugin`, no TypeScript linting with Babel's plugin, needs `@babel/core` 7.2.0+); the Babel 8 guide says it drop
- **Also good:** [@babel/plugin-transform-typescript](https://babeljs.io/docs/babel-plugin-transform-typescript) — babeljs.io: the plugin "does not add the ability to type-check", so `tsc` stays in CI (*read*)

{/* LINKMAP:END */}
