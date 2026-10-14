---
title: "Authoring Custom Babel Plugins"
sidebar_label: "Authoring Custom Babel Plugins"
sidebar_position: 1
---

# 🛠️ Authoring Custom Babel Plugins

Covers syllabus **§6.1 Visitor Pattern**, **§6.2 Path & Scope**, **§6.3 @babel/types**, and **§6.4 Testing**.

## 1. Concept & Under-the-Hood Mechanics

### 6.1 Visitor Pattern

Plugins return `{ visitor: { NodeType(path, state) {} } }` with optional `enter`/`exit`. Traversal is depth-first. Mutating the tree while traversing requires care—`path.skip()`, `path.traverse` for nested scans, avoid re-entering generated nodes forever.

### 6.2 Path & Scope APIs

| API | Use |
| --- | --- |
| `path.replaceWith(node)` | Replace node |
| `path.insertBefore` / `insertAfter` | Inject siblings |
| `path.remove()` | Delete |
| `scope.generateUidIdentifier(name)` | Collision-safe temps |
| `scope.getBinding(name)` | Find binding; check referenced before removing “unused” decls |

### 6.3 @babel/types Builders

Build nodes with `t.identifier`, `t.callExpression`, etc., not ad-hoc objects. Use `t.isX` / `t.assertX` for narrowing.

### 6.4 Testing

- **`babel-plugin-tester`** — fixture folders with input/output  
- **Snapshots** — catch accidental output churn  

---

## 2. Real-World Engineering Scenario

**Scenario: infinite loop plugin in CI.**

A plugin on `CallExpression` wraps every call in `log(call)` but the inserted `log(...)` is also a `CallExpression`, re-entering forever until stack overflow. Fix: mark inserted nodes / `path.skip()` / check callee name before wrapping.

---

## 3. Production-Grade Code Example

```js
// babel-plugin-replace-logger.js
import * as t from '@babel/types';

export default function replaceLogger() {
  return {
    name: 'replace-logger',
    visitor: {
      CallExpression(path) {
        const callee = path.node.callee;
        if (!t.isMemberExpression(callee)) return;
        if (
          t.isIdentifier(callee.object, { name: 'LegacyLogger' }) &&
          t.isIdentifier(callee.property, { name: 'log' })
        ) {
          path.replaceWith(
            t.callExpression(
              t.memberExpression(t.identifier('console'), t.identifier('log')),
              path.node.arguments,
            ),
          );
          path.skip();
        }
      },
    },
  };
}
```

```js
// test with babel-plugin-tester (sketch)
import pluginTester from 'babel-plugin-tester';
import plugin from '../babel-plugin-replace-logger.js';

pluginTester({
  plugin,
  babelOptions: { parserOpts: { sourceType: 'module' } },
  tests: [
    {
      code: `LegacyLogger.log('x');`,
      output: `console.log('x');`,
    },
  ],
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Hand-built AST missing `loc`/`raw` fields
Usually OK for emit; can break plugins that read locations—prefer builders.

### ⚠️ Removing declarations still referenced
Use binding reference counts.

### ⚠️ Testing only the happy path string
Add fixtures for optional chaining, TS, and JSX if your plugin claims to support them.

### ⚠️ Publishing plugins without `name`
Harder debugging in Babel error stacks—set `name` in the plugin object.

{/* LINKMAP:START */}

## Further reading

*Best explanations found elsewhere on the web — added alongside this page, nothing here replaces it.*

- **Read this:** [@babel/types](https://babeljs.io/docs/babel-types) — babeljs.io: each node type's builder, `is`/`assert` helpers, field types and aliases (first 100000 of about 170000 chars *read*; the rest not read, so `loc` and `raw` coverage is unchecked)
- **Also good:** [@babel/traverse](https://babeljs.io/docs/babel-traverse) — babeljs.io: minimal visitor and node-type examples (*read*)
- **Beyond the docs:** [Babel Plugin Handbook](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md) — Jamie Kyle, GitHub: the long-form explanation of visitors, paths, scope and bindings, UID generation and renaming, manipulation, and unit testing with snapshot, AST and exec tests plus babel-plugin-tester; it has no version note, and its testing exam

{/* LINKMAP:END */}
