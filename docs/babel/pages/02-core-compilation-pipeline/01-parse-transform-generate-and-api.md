---
title: "Babel Core Pipeline: Parse \u2192 Transform \u2192 Generate & Programmatic API"
sidebar_label: "Babel Core Pipeline"
sidebar_position: 1
---

# ⚙️ Babel Core Pipeline: Parse → Transform → Generate & Programmatic API

Covers syllabus **§2.1 Parse → Transform → Generate**, **§2.2 @babel/core API**, and **§2.3 AST Fundamentals & Paths**.

## 1. Concept & Under-the-Hood Mechanics

### 2.1 Parse → Transform → Generate

```
source text
   │
   ▼
@babel/parser  ──►  AST (ESTree-derived / Babel AST extensions)
   │
   ▼
@babel/traverse + plugin visitors  ──►  mutated AST
   │
   ▼
@babel/generator  ──►  code string + source map
```

- **Parser** applies syntax plugins so modern grammar parses.  
- **Visitors** register on node types (`Identifier`, `CallExpression`, `JSXElement`, …).  
- **Generator** prints code; formatting is not Prettier-grade—don’t use Babel as a formatter.

### 2.2 @babel/core Programmatic API

| API | Use |
| --- | --- |
| `transformSync` / `transformAsync` | Transform a code string |
| `transformFileSync` / async variants | Transform a file path |
| `transformFromAstSync` | Already have an AST (pipeline tooling) |

Config resolution merges: programmatic options, `babel.config.*`, `.babelrc*`, `package.json#babel`, env blocks, overrides, and **caller** metadata from integrations (babel-loader, babel-jest) that toggle plugin behavior.

### 2.3 AST Fundamentals & Paths

- **Nodes** are plain objects with `type` and type-specific fields—shared mental model with ESLint’s ESTree (Babel adds fields/nodes for TypeScript, etc.).  
- **`Path`** wraps a node with parent links, scope, and mutation helpers (`replaceWith`, `remove`, …).  
- **Scope** tracks bindings/references so plugins can rename safely and avoid shadowing when injecting temporaries (`scope.generateUidIdentifier`).

---

## 2. Real-World Engineering Scenario

**Scenario: codemod corrupts bindings.**

A plugin replaces `foo()` with `const _foo = foo(); _foo()` but reuses the name `_foo` inside nested scopes that already bind `_foo`. Runtime TDZ/shadow bugs appear only in one package. Root cause: not using `path.scope.generateUidIdentifier`. Fix: always allocate temps via scope APIs.

---

## 3. Production-Grade Code Example

```js
// tools/transform-once.mjs
import { transformSync } from '@babel/core';

const result = transformSync(`const x: number = 1;`, {
  filename: 'virtual.ts',
  presets: ['@babel/preset-typescript', ['@babel/preset-env', { targets: { node: '20' } }]],
  babelrc: false,
  configFile: false,
});

console.log(result.code);
```

```js
// Visitor sketch
export default function myPlugin() {
  return {
    visitor: {
      Identifier(path) {
        if (path.node.name === 'DEPRECATED') {
          path.node.name = 'SUPPORTED';
        }
      },
    },
  };
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Mutating `path.node` inconsistently without path APIs
Can desync scope/path caches—prefer `path.replaceWith` / `@babel/types` builders.

### ⚠️ Forgetting `filename` in programmatic transforms
Breaks plugin decisions that key on extensions (TS/TSX) and source maps.

### ⚠️ Nested traversal infinite loops
After inserting nodes, use `path.skip()` or carefully structured enter/exit—see [custom plugins](../06-authoring-custom-plugins/01-visitors-paths-types-and-testing.md).

### ⚠️ Expecting ESLint and Babel ASTs to be identical
Close but not identical—especially TypeScript and experimental syntax.
