---
title: "babel/cli & Codemods on Babel\u2019s Parser"
sidebar_label: "babel/cli & Codemods on Babel\u2019s Parser"
sidebar_position: 1
---

# 🧰 @babel/cli & Codemods on Babel’s Parser

Covers syllabus **§13.1 @babel/cli** and **§13.2 Codemods**.

## 1. Concept & Under-the-Hood Mechanics

### 13.1 @babel/cli

```bash
babel src --out-dir lib
babel src --out-dir lib --copy-files
babel src --extensions ".ts,.tsx,.js" --out-dir lib
```

Used for **library builds** that don’t need a full bundler, or for debugging emit. `--copy-files` copies non-JS assets; `--extensions` includes TS/TSX.

### 13.2 Codemods (jscodeshift et al.)

**jscodeshift** builds on Babel’s parser (and often recast for printing) to run repo-wide mechanical refactors. Prefer codemods when changes are **structural** beyond ESLint fixers (renaming APIs across hundreds of call shapes, converting classic to automatic JSX runtime patterns, etc.).

Lint autofix is for local, rule-scoped edits; codemods are migration engines.

---

## 2. Real-World Engineering Scenario

**Scenario: rename `createStore` to `configureStore` across 400 files.**

ESLint fix cannot safely rewrite all import variants. A jscodeshift transform updates imports and call sites; CI snapshot tests of the codemod prevent drift. Babel knowledge of `ImportDeclaration` / `CallExpression` paths is the skill transfer from plugin authoring.

---

## 3. Production-Grade Code Example

```json
{
  "scripts": {
    "build:lib": "babel src --out-dir lib --extensions \".ts,.tsx\" --source-maps"
  }
}
```

```js
// codemod sketch (jscodeshift)
export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);
  root
    .find(j.Identifier, { name: 'createStore' })
    .replaceWith(j.identifier('configureStore'));
  return root.toSource();
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ CLI build without typecheck
Ship broken types—pair with `tsc` for `.d.ts` emit (`tsc --emitDeclarationOnly`) if publishing types.

### ⚠️ Codemod without dry-run / git cleanliness
Impossible to review—always branch + format after.

### ⚠️ Parsing TS without TS parser plugins in jscodeshift
Parse failures—set parser to tsx.

### ⚠️ Using Babel CLI as a formatter
Output style is not Prettier; run Prettier after.
