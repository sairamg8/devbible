---
title: "02 · Interop, both ways"
sidebar_label: "02 · Interop, both ways"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against the Node.js documentation — [Modules: ECMAScript modules § Interoperability with CommonJS](https://nodejs.org/api/esm.html), [Modules: CommonJS modules § Loading ECMAScript modules using `require()`](https://nodejs.org/api/modules.html), [Packages § `exports`](https://nodejs.org/api/packages.html#exports) — and the TypeScript reference [`esModuleInterop`](https://www.typescriptlang.org/tsconfig/esModuleInterop.html). Documentation-validated; **no runs, no timings, no console blocks**.

⚠️ **Version numbers move.** Everything below is as the Node documentation read on the verification
date; check your own runtime's docs before depending on a boundary version.

## Importing CommonJS from an ES module — mostly fine

```js
import cjs from './thing.cjs';        // the module.exports object, as the default export
import { name } from './thing.cjs';   // often works — see below
```

**The default export is `module.exports`.** That part is simple and reliable.

🔴 **Named imports from CommonJS are a best-effort guess, not a contract.** Node performs *"a
heuristic static analysis … against the source text of the CommonJS module to get a best-effort
static list of exports"* — it reads the file looking for recognisable assignment patterns, because
CommonJS has no static export list to read.

**Which means it works until the module does something clever:**

```js
// exports.a = 1  →  detected
// module.exports = { a: 1 }  →  detected
// for (const k of keys) exports[k] = make(k)   →  NOT detected
```

**The reliable fallback is always available:**

```js
import pkg from 'legacy-thing';
const { doThing } = pkg;      // destructure at run time; nothing to detect
```

⚠️ **`SyntaxError: The requested module … does not provide an export named 'x'` is this failure**,
and it happens at link time — before a line of your code runs — which is why it is not catchable
with a `try`.

## Requiring an ES module from CommonJS — newer, and conditional

`require()` of an ES module is supported (the docs record it as added in **v22.0.0** and marked
stable in **v25.4.0**), with one hard condition:

🔴 **The ES module must be fully synchronous.** A module using top-level `await` cannot be
`require`d, and Node throws **`ERR_REQUIRE_ASYNC_MODULE`**. Dynamic `import()` is the answer there
([05 · The expression](../05-dynamic-import/01-the-expression.md)) — and it returns a promise, which
is the point.

**What you get back is the module namespace object**, the same shape dynamic `import()` gives —
so a default export arrives as `.default`, not as the value itself. A package that wants
`require('pkg')` to return one thing can say so with the documented `'module.exports'` export name.

| From | To | How it goes |
|---|---|---|
| ESM | CJS | default = `module.exports`; named imports by heuristic detection |
| CJS | ESM | namespace object; synchronous modules only, else `ERR_REQUIRE_ASYNC_MODULE` |
| either | either, asynchronously | `import()` always works, and returns a promise |

## What an ES module does not have, and what to use instead

Node's documentation lists the CommonJS conveniences that simply do not exist in ESM. The
replacements are the useful half:

| Missing in ESM | Use |
|---|---|
| `__filename` | `import.meta.filename` |
| `__dirname` | `import.meta.dirname` |
| `require` | `import`, or `module.createRequire()` when you truly need it |
| `require.resolve` | `import.meta.resolve()` (or `createRequire`) |
| `require.main` | `import.meta.main` |
| `require.cache` | nothing — *"`require.cache` is not used by `import`"*; the ESM loader has its own |
| native addons | `module.createRequire()` — addons are not supported through `import` |
| `NODE_PATH` | nothing — it is not part of resolving `import` specifiers |

**The path idiom worth memorising**, because reading a file next to the module is the single most
common thing `__dirname` was used for:

```js
import { readFileSync } from 'node:fs';
const data = readFileSync(new URL('./data.json', import.meta.url));
```

**And the escape hatch, when a dependency is CommonJS-only and you need `require` semantics:**

```js
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const addon = require('./build/Release/addon.node');
```

## Interop through a bundler: `__esModule` and the default that is not

Long before Node's `require(esm)`, transpilers had to make `import` work when the output was
CommonJS, and the convention they settled on is still everywhere in build output:

- **Transpiled ES modules mark themselves** with `exports.__esModule = true`.
- **Interop helpers check that mark**: if it is present, the default export is `.default`; if it is
  absent, the whole `module.exports` *is* the default.

TypeScript's `esModuleInterop` is the documented version of this. Its own reference names the two
problems it fixes — a namespace import being treated as callable, which *"is not valid according to
the spec"*, and `import x from 'cjs'` compiling to `require('cjs').default` when most CommonJS
packages export no such thing — and it emits the `__importDefault` and `__importStar` helpers to
bridge them. It also implies `allowSyntheticDefaultImports`, which is why the editor stops
complaining the moment you turn it on.

🔴 **This is where the classic `TypeError: x is not a function` on a default import comes from.**
The bundler or compiler guessed which side of the `__esModule` fence a package sits on, and guessed
differently from how the package was actually built. The tell is that the same import works in one
tool and not another.

## The dual-package hazard, restated

A package that publishes both an ESM and a CommonJS build through `exports` conditions can end up
loaded **twice in one process** — once through `import`, once through `require` — because those two
loaders keep separate caches ([01 · The CommonJS model](./01-the-commonjs-model.md)).

**Two copies means two module states**, so:

- a "singleton" is two objects,
- `instanceof` fails across the boundary
  ([08 · Cause chains and boundaries](../08-custom-error-classes/02-cause-chains-and-boundaries.md)),
- and a registry populated by one copy looks empty to the other.

**What actually helps:** force one condition for the dependency, deduplicate it in the tree, and
branch on a `code` or a string tag rather than a class identity
([13 · What a bundler does](../13-bundlers-and-the-build/01-what-a-bundler-does.md)).

## Gotchas

**Symptom: `does not provide an export named 'x'` for a CommonJS package.**
Cause — the named-export heuristic could not detect that export; it is computed, not written
literally.
Fix — default-import the module and destructure at run time.

**Symptom: `ERR_REQUIRE_ASYNC_MODULE`.**
Cause — the ES module uses top-level `await`, which `require` cannot support.
Fix — load it with dynamic `import()`, and make the caller async.

**Symptom: `require('esm-pkg')` returned an object with a `default` property.**
Cause — `require(esm)` yields the namespace object, exactly as `import()` does.
Fix — read `.default`, or use a package that declares the `'module.exports'` export name.

**Symptom: `__dirname is not defined` after converting a file to ESM.**
Cause — the wrapper's parameters do not exist in an ES module.
Fix — `import.meta.dirname`, or `new URL('./x', import.meta.url)` for file paths.

**Symptom: a default import is `undefined` in one tool and correct in another.**
Cause — the `__esModule` interop guess differs between the two toolchains.
Fix — pin the interop setting, import the namespace explicitly, or use the package's documented
entry.

**Symptom: `instanceof` fails against a class from a library you imported.**
Cause — the dual-package hazard: two copies with separate module state.
Fix — force one resolution condition, deduplicate, and test on a `code` rather than a class.

**Symptom: monkey-patching `require.cache` had no effect on an ES module.**
Cause — the ESM loader has its own cache, documented as separate.
Fix — do not build on either cache; inject the dependency instead.

## Interview questions

**★ How do named imports from a CommonJS module work?**
Node runs a heuristic static analysis of the source to guess an export list. It works for ordinary
assignment patterns and fails on computed ones — where the fix is a default import plus run-time
destructuring.

**★ When can `require` not load an ES module?**
When it is not fully synchronous — top-level `await` makes it async, and Node throws
`ERR_REQUIRE_ASYNC_MODULE`. Use dynamic `import()`.

**★ What does `require(esm)` return?**
The module namespace object, like `import()` — so a default export is on `.default` unless the
package uses the `'module.exports'` export name.

**★ What replaces `__dirname` in an ES module?**
`import.meta.dirname`, or `new URL('./file', import.meta.url)` when you are reading a file next to
the module.

**★ What is `__esModule` for?**
It is the transpiler convention that marks a transpiled ES module, so interop helpers know whether
the default export is `.default` or the whole `module.exports`.

**★ What is the dual-package hazard?**
One package loaded twice — once as ESM, once as CommonJS, in separate loader caches — giving two
module states, so singletons and `instanceof` break.

**★ How do you get `require` inside an ES module when you genuinely need it?**
`createRequire(import.meta.url)` from `node:module` — which is also how native addons are loaded,
since `import` does not support them.

---

← Prev: [01 · The CommonJS model](./01-the-commonjs-model.md)
