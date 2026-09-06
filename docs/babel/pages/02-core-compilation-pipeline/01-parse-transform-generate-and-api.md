---
title: "Babel Core Pipeline: Parse \u2192 Transform \u2192 Generate & Programmatic API"
sidebar_label: "Babel Core Pipeline"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Babel documentation at babeljs.io for **Babel 8.0.1** — npm
> `latest` for `@babel/core`, read from `npm view @babel/core dist-tags` on 2026-09-06 —
> [Options](https://babeljs.io/docs/options) (`caller`, `env`, merging) and
> [Plugins](https://babeljs.io/docs/plugins). The `@babel/core` export list, the parser's node
> type names and the `NodePath`/`Scope` method surface were **probed** on the packages installed
> in this checkout (`@babel/core`, `@babel/parser`, `@babel/traverse`, `@babel/types` all
> 7.29.7, Node 24.20.0) — not on 8.x, which is not installed here. Documentation-validated,
> **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session 4e8d4393

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

Every one of those names exists on the installed package — probed with
`Object.keys(require('@babel/core'))` on **7.29.7**, which also exposes `parse`/`parseSync`/
`parseAsync`, `loadOptions`, `loadPartialConfig`, `createConfigItem`, `template`, `traverse`,
`types`, `version` and `DEFAULT_EXTENSIONS`. `loadPartialConfig` is the one worth knowing about:
it answers "what config would Babel actually use for this file?" without transforming anything.

Config resolution merges: programmatic options, `babel.config.*`, `.babelrc*`, `package.json#babel`, env blocks, overrides, and **caller** metadata from integrations (babel-loader, babel-jest) that toggle plugin behavior.

`caller` is not decoration — it is how a bundler tells Babel what *it* can handle. The options
reference describes it as an object identifying the tool wrapping Babel, carrying capability
flags including `supportsStaticESM`, `supportsDynamicImport` and `supportsTopLevelAwait`
([Options](https://babeljs.io/docs/options)). That is the channel `@babel/preset-env`'s
`modules: "auto"` reads to decide whether to rewrite your `import` statements at all.

### 2.3 AST Fundamentals & Paths

- **Nodes** are plain objects with `type` and type-specific fields—shared mental model with ESLint’s ESTree (Babel adds fields/nodes for TypeScript, etc.).  
  ⚠️ **"Shared mental model" is not "same node names."** Probed on `@babel/parser` **7.29.7**:
  `parse('const a = "x";')` gives the initialiser node type `StringLiteral`, and
  `parse('const a = 1;')` gives `NumericLiteral`. ESTree calls both of those `Literal`. So an
  ESLint-shaped `Literal(node)` visitor never fires under Babel — this is the first deviation you
  hit, before you get anywhere near TypeScript nodes.  
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

## Gotchas

**★ Babel's AST is not ESTree's, and the first place it bites is literals.** Symptom: a visitor
ported from an ESLint rule silently matches nothing. Cause: ESTree has one `Literal` node; Babel
has `StringLiteral`, `NumericLiteral`, `BooleanLiteral`, `NullLiteral`, `RegExpLiteral` — probed
on `@babel/parser` 7.29.7. Fix: use the Babel type names, or `t.isLiteral(node)` when you
genuinely mean "any literal". Dump the tree from the parser before writing the visitor rather
than guessing the type name.

**★ Omitting `filename` changes what the pipeline does, not just what the error says.** Plugins
key decisions on the extension — `@babel/preset-typescript` needs it to know whether it is
looking at `.ts` or `.tsx`, and `overrides`/`test`/`include`/`exclude` are file-path matchers with
nothing to match against. Source-map `sources` entries come from it too. Fix: always pass
`filename`, even a virtual one like `virtual.ts`, exactly as the example above does.

**★ `babelrc: false, configFile: false` in a programmatic transform is not boilerplate.**
Without it, your one-off script inherits whatever config the repo happens to have — so a codemod
run inside an app targeting IE11 gets its output downlevelled to ES5 before you write it back to
disk. Symptom: a codemod that "reformats the whole file" and produces an enormous diff. Fix: turn
config discovery off for tooling, and turn it on deliberately when you actually want the project's
pipeline.

**★ Sync and async entry points exist for a reason, and the reason is that configs and plugins
can be async.** `@babel/core` exposes both variants of every operation (probed: `transform`,
`transformSync`, `transformAsync`, `transformFile*`, `transformFromAst*`, `parse*`,
`loadOptions*`, `loadPartialConfig*`). If your config file exports an async function, or a preset
resolves asynchronously, the sync entry point has no way to await it. ⚠️ This pass did not verify
what error Babel raises in that case, so do not promise a reader a specific message — just reach
for the async variant in anything that is not already a synchronous integration.

**★ `@babel/generator` is a printer, not a formatter.** Its own package description is
*"Turns an AST into code"* (read from the installed 7.29.7 `package.json`). It will not reproduce
your original spacing, quote style or line breaks in untouched regions of a codemodded file. Fix:
run Prettier (or your formatter of choice) over the output as a separate step, and never review a
codemod diff before you do — otherwise every file looks 100% changed.

**★ Mutate through the path, not around it.** `@babel/traverse` describes itself as the module
that *"maintains the overall tree state, and is responsible for replacing, removing, and adding
nodes"* (installed 7.29.7 package description). Swapping `path.node` fields by hand bypasses the
bookkeeping that keeps scope and the traversal queue honest. Fix: `path.replaceWith`,
`path.insertBefore`, `path.remove`, and `@babel/types` builders for the nodes themselves.

**★ The `Identifier` visitor in the sketch above fires on more than variables.** `obj.DEPRECATED`
has an `Identifier` as its member-expression property, and `{ DEPRECATED }` has one as an object
key — so a blanket `path.node.name = 'SUPPORTED'` renames property accesses and object keys too.
Fix, and this is a genuinely probed API on `NodePath.prototype` 7.29.7:

```js
Identifier(path) {
  if (!path.isReferencedIdentifier()) return;   // skips property keys and non-reference positions
  if (path.node.name !== 'DEPRECATED') return;
  path.node.name = 'SUPPORTED';
}
```

If what you actually want is to rename a *binding* and every reference to it, that is
`path.scope.rename('DEPRECATED', 'SUPPORTED')` — also probed present on `Scope.prototype`.

**★ Injected temporaries must come from the scope, not from your imagination.** The scenario
above is the whole gotcha: a hardcoded `_foo` collides with a `_foo` that already exists in a
nested scope, and the failure is a shadowing or TDZ bug in one package rather than a compile
error. Fix: `path.scope.generateUidIdentifier('foo')` (probed on `Scope.prototype` 7.29.7), which
allocates a name nothing in scope is using.

**★ Nested traversal is the other infinite-loop shape.** Inserting nodes during a traversal means
the new nodes get visited; a visitor that inserts what it matches never terminates. Fix:
`path.skip()` after the replacement, a marker on generated nodes, or a guard that makes the
generated shape fail the match — see
[custom plugins](../06-authoring-custom-plugins/01-visitors-paths-types-and-testing.md).

## Interview questions

**★ Walk me through Babel's three stages and name the package that owns each.**
Parse — `@babel/parser`, *"A JavaScript parser"*, source text to AST. Transform —
`@babel/traverse` plus the plugins' visitors, described by the package itself as the module that
*"maintains the overall tree state, and is responsible for replacing, removing, and adding
nodes"*. Generate — `@babel/generator`, *"Turns an AST into code"*, producing the output string
and the source map. `@babel/core` is the orchestration layer that resolves config, runs the three
in order and exposes `transform*`. Everything else — `@babel/types` for builders,
`@babel/template` for building AST from source strings — hangs off the transform stage.

**★ Why does Babel give plugins a `path` instead of just the node?**
Because almost everything a transform needs to decide is *not* in the node. A node knows its own
type and fields; a path knows its parent, its position in the parent's child list, the scope it
sits in, and the bindings visible from there. It is also the only handle that can mutate the tree
safely — `replaceWith`, `insertBefore`, `remove` — because those operations have to update the
traversal queue and the scope information, which a bare node object cannot do. The node is data;
the path is the node plus its context plus the API.

**★ What is `caller`, and why does `babel-loader` set it?**
It is the object a wrapping tool passes to Babel to identify itself and declare what it supports —
the options reference names `supportsStaticESM`, `supportsDynamicImport` and
`supportsTopLevelAwait` among its flags. It exists so that config does not have to be duplicated
per integration: `@babel/preset-env`'s `modules: "auto"` asks the caller whether ES modules survive
downstream, so the same config emits ESM under a bundler and CommonJS under a test runner that
said it cannot handle ESM.

**★ A codemod introduces a temporary variable. Why not just call it `_tmp`?**
Because you do not know what `_tmp` means at that point in the program. If any enclosing or
nested scope already binds it, your insertion either shadows something the surrounding code
depends on or gets shadowed itself, and the result is a runtime bug in one package rather than a
compile failure — which is exactly the scenario on this page. `path.scope.generateUidIdentifier`
asks the scope for a name that is free, which is the only way to be sure at transform time.

**★ Your codemod ran, the tests pass, and the diff is every line of every file. What happened?**
Two independent causes, and you should check both. First, `@babel/generator` reprints the whole
file from the AST — it is not a surgical editor, so formatting that Babel prints differently from
how you wrote it shows up as changed lines. Second, if you did not pass `configFile: false` and
`babelrc: false`, the project's own Babel config ran too, so your codemod also downlevelled the
syntax. Fix the second with config flags, and the first by running the formatter afterwards.

**★ How would you find out which config Babel is actually applying to a given file?**
`loadPartialConfig` from `@babel/core` (probed present on 7.29.7). It runs the whole
configuration-resolution process — project-wide config, file-relative config, `env` blocks,
`overrides`, caller data — and hands back the resolved options and the list of config files it
consulted, without compiling anything. That turns "why isn't my transform applying?" from
guesswork into a printout.

**★ Is Babel's AST the same as ESLint's?**
Close, deliberately, but not identical. Both descend from ESTree, so the overall shape and most
node names match. Babel diverges where it needs to carry more information — it splits ESTree's
single `Literal` into `StringLiteral`, `NumericLiteral` and friends (probed on 7.29.7), and it
adds a large set of nodes for TypeScript, JSX and proposals that ESTree does not define. So a
visitor is usually portable in structure and rarely portable verbatim.
