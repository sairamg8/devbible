---
title: "02 · Tree shaking, and what defeats it"
sidebar_label: "02 · Tree shaking"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Tree shaking](https://developer.mozilla.org/en-US/docs/Glossary/Tree_shaking), [`import`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import), [`export`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export), [Minification](https://developer.mozilla.org/en-US/docs/Glossary/Minification) — webpack [Guides § Tree Shaking](https://webpack.js.org/guides/tree-shaking/), Rollup [Configuration options § `treeshake`](https://rollupjs.org/configuration-options/#treeshake), and Node.js [Packages § `exports`](https://nodejs.org/api/packages.html#exports). Documentation-validated; **no bundle sizes, no build times, no console blocks**.

## Tree shaking is *keeping*, not removing

The name suggests a bundler walks your output deleting things. It is the other way round: the
bundler starts at the entry point, follows every `import` it can resolve statically, and **keeps
what it can prove is reachable**. Everything it never reached is simply never emitted.

MDN's definition is exactly this: tree shaking "relies on the `import` and `export` statements to
detect if code modules are exported and imported for use between JavaScript files".

🔴 **That inverts where the burden sits.** You are not asking the bundler to find dead code — you
are asking it to *prove* code is dead. Anything it cannot prove, it keeps. Every rule below is
some version of "you took away the proof".

**This is why it needs ES modules and nothing else works.** `import`/`export` are static: the
specifier is a string literal, the bindings are known before a line runs
([01 · Import and export](../01-es-modules/01-import-and-export.md)). `require()` is an ordinary
function call with a computable argument, and `module.exports` can be reassigned at run time — so
a CommonJS module's shape is only knowable by running it, and a bundler will not run it.

⚠️ **The most common self-inflicted wound: transpiling modules away before the bundler sees
them.** If your compiler is configured to emit CommonJS, the bundler receives `require()` calls
and has nothing to shake. webpack's guide names this directly — leave module syntax alone
(`modules: false` in Babel's preset, `"module": "esnext"`-style output in TypeScript) and let the
bundler do the downlevelling.

## The thing that actually blocks it: side effects

Reachability is easy. The hard question is the one a bundler must answer before dropping an
unused import:

> If I never evaluate this module at all, does anything change?

A module is not just a bag of exports — its **top level is code that runs**
([02 · Singletons and strict mode](../02-module-semantics/01-singletons-and-strict.md)). Importing
it may register a custom element, install a polyfill, push a locale onto a global, or inject a
stylesheet. If the bundler skips it to save size, the application breaks in a way that has nothing
to do with the import you removed.

So the default is conservative: **assume a module has side effects, and evaluate it**. Rollup
spells this out in `treeshake.moduleSideEffects` — the default is that imported modules may have
side effects, and only with `false` is code retained *solely* on the basis that its exports are
used.

Which means the useful lever is not "shake harder". It is **telling the bundler where side effects
are not**.

## `sideEffects` in `package.json` — a promise, not a setting

```json
{ "name": "thing", "sideEffects": false }
```

webpack's wording for what this buys: *"If no direct export from a module flagged with
no-sideEffects is used, the bundler can skip evaluating the module for side effects."*

Three forms, and the third is the one most packages need:

| Value | Meaning |
|---|---|
| `true` (the default) | every file may have side effects — include it if it is imported at all |
| `false` | **nothing** in this package does anything on import; unused modules can be skipped whole |
| `["./src/register.js", "**/*.css"]` | glob patterns naming the files that *do*, everything else is pure |

🔴 **It works at a different level from unused-export elimination, and that is the whole point.**
webpack contrasts the two plainly — its `usedExports` analysis drops unused exports statement by
statement and cannot skip a module's dependencies, while **`sideEffects` "allows to skip whole
modules/files and the complete subtree"**. One removes a function; the other removes a package and
everything that package imported.

⚠️ **The classic breakage: `"sideEffects": false` in an app that imports CSS.** webpack warns
about it in as many words — any imported file is subject to tree shaking, so a bare
`import './styles.css'` is an import whose exports are never used, and it is dropped in the
production build. Your styles disappear from the build and only from the build. `"sideEffects":
["**/*.css"]` is the fix, and the same reasoning covers polyfill imports, `reflect-metadata`,
side-effectful registration files and anything imported purely for what it does.

**Treat the flag as a claim you are making on behalf of every file you ship.** It is checked by
nobody. A wrong `false` does not fail the build — it produces an application missing a piece.

## `/*#__PURE__*/` — annotating a call the bundler cannot judge

Unused *exports* are one thing; an unused **result of a call** is harder, because calling might do
something:

```js
export const logger = createLogger('app');   // is this safe to drop if `logger` is unused?
```

The bundler cannot know what `createLogger` does. The convention both webpack and Rollup honour is
an annotation on the call site:

```js
export const logger = /*#__PURE__*/ createLogger('app');
```

Rollup's description: if a function call is preceded by this annotation, it assumes the call is
safe to remove when the result is unused. webpack documents the same comment, plus a newer
`/*#__NO_SIDE_EFFECTS__*/` annotation placed on a **function declaration**, which marks every call
to that function pure instead of annotating each call site.

**This is mostly a library-author's tool** — it is how a package makes its own factory calls
droppable — but it is worth recognising in output you are reading, and worth reaching for when a
constant in your own module is created eagerly by a call and pulls in a subtree with it.

Rollup exposes the two remaining knobs in the same place, and both are trades against correctness:
`propertyReadSideEffects: false` says reading a property can never run a getter, and its
`"smallest"` preset applies the most aggressive assumptions while `"safest"` keeps stricter spec
compliance and retains more code. **Reach for the aggressive settings last**, after the structural
fixes below, because when they are wrong the failure is a missing side effect at run time rather
than a build error.

## What actually defeats it, in the order you will meet it

**1 · A CommonJS dependency.** No static shape, so the whole module is kept. Look for an ESM build
of the package, or a `browser`/`import` condition in its `exports` map
([01 · What a bundler does](./01-what-a-bundler-does.md)). This is the single most common reason a
"tree-shakeable" import is not.

**2 · Re-export barrels.** An `index.js` that re-exports fifty modules turns one import into fifty
edges:

```js
// components/index.js
export * from './Button.js';
export * from './DataGrid.js';   // …and 48 more
```

```js
import { Button } from './components/index.js';   // touches the whole barrel
```

If every file behind the barrel is provably pure, a good bundler still drops the rest. The moment
**one** of them has a side effect — or is CommonJS, or the package has no `sideEffects` flag —
that subtree is retained, and you imported a design system to use a button. It is also a real
cost in the dev server, which must resolve and transform every file the barrel names.

🔴 **Import the module, not the barrel** (`import { Button } from './components/Button.js'`) when
size matters. That single change is usually worth more than any bundler configuration.

**3 · A namespace import you then index dynamically.**

```js
import * as icons from './icons.js';
const Icon = icons[name];        // every icon is now reachable
```

The bundler cannot know which key you will use, so it keeps all of them. If the set is genuinely
dynamic, that is a job for `import()` with a computed-but-analysable specifier
([05 · Code splitting](../05-dynamic-import/02-code-splitting.md)) or an explicit map.

**4 · Side effects in your own modules.** Top-level work — mutating a global, registering a
listener, starting a timer, an eager `new` of something that touches the DOM — makes the module
unskippable. Keep the top level to declarations, and export an `init()` for the rest.

**5 · Class fields, decorators and getters.** Anything that *looks* like it could run code on
evaluation is treated as if it will. This is where `propertyReadSideEffects` and the "safest"
versus "smallest" presets bite, and where two bundlers legitimately disagree about the same file.

**6 · Development mode.** webpack's guide is explicit that the full effect requires a production
build. Never judge shaking from the dev server — it is the other code path
([01 · What a bundler does](./01-what-a-bundler-does.md)).

## Gotchas

**Symptom: my styles vanished, but only in the production build.**
Cause — `"sideEffects": false` with `import './x.css'`; the import's exports are unused, so it is
dropped.
Fix — list the globs: `"sideEffects": ["**/*.css"]`, plus any registration or polyfill file.

**Symptom: I import one function from a package and get the whole thing.**
Cause — the resolved build is CommonJS, or the package declares no `sideEffects`.
Fix — resolve to its ESM build via the `exports` conditions; failing that, import the deep module
directly if the package exposes one, or replace the dependency.

**Symptom: importing one component pulls in the whole library.**
Cause — a re-export barrel, with at least one impure or CJS file behind it.
Fix — import the concrete module path; keep barrels for authoring convenience, not for consumers.

**Symptom: nothing is shaken at all.**
Cause — modules were transpiled to CommonJS before the bundler ran.
Fix — `modules: false` (or the equivalent), and let the bundler downlevel.

**Symptom: a polyfill stopped being applied.**
Cause — an import kept only for its side effect, in a package or file claimed pure.
Fix — add it to the `sideEffects` list; a bare `import 'x'` is exactly the case the flag exists
for.

**Symptom: `/*#__PURE__*/` had no effect.**
Cause — the annotation must sit immediately before the *call*, and the result must genuinely be
unused; a value assigned to an exported binding that something imports is used.
Fix — check placement first, then whether anything still reads the binding.

**Symptom: two bundlers give different results for the same file.**
Cause — different default assumptions about property reads and module side effects.
Fix — do not chase parity; fix the structural cause (CJS, barrel, top-level work) that both agree
on.

## Interview questions

**★ What does tree shaking actually do?**
It keeps what it can prove is reachable from the entry points by following static `import`/`export`
edges, and never emits the rest. It is not a deletion pass over finished output.

**★ Why does it need ES modules?**
Because their structure is static — specifiers are literals and bindings are known before
execution. `require()` is a function call and `module.exports` is mutable, so a CommonJS module's
shape is only knowable by running it.

**★ What is `sideEffects` in `package.json`?**
A claim that importing a file does nothing observable, which lets the bundler skip whole modules —
and their subtrees — when none of their exports are used. `true` by default, `false` for a fully
pure package, or an array of globs naming the files that are not.

**★ Why did `"sideEffects": false` break the CSS?**
A CSS import has no used exports, so it is dropped. Any file imported purely for its effect must
be listed.

**★ Why is unused-export elimination weaker than the `sideEffects` flag?**
It works statement by statement inside a module and cannot skip that module's dependencies. The
flag removes the module and everything it pulled in.

**★ Why does a barrel file hurt?**
One import becomes an edge to every re-exported module; a single impure or CommonJS file behind
the barrel retains that subtree. Import the concrete module instead.

**★ What does `/*#__PURE__*/` mean?**
It tells the bundler a call has no side effects, so the call can be removed when its result is
unused. `/*#__NO_SIDE_EFFECTS__*/` says the same about every call to a declared function.

**Why can't the bundler shake `icons[name]`?**
A computed key is not statically known, so every member of the namespace stays reachable.

---

← Prev: [01 · What a bundler actually does](./01-what-a-bundler-does.md)
