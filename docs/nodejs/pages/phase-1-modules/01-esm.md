---
title: "ESM — the standard module system"
sidebar_label: "01 · ESM"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS). ESM is the default for new
> code. Write this unless something forces you not to.

**One file, one module, explicit inputs and outputs — resolved before any of your
code runs.**

## Exporting

Two kinds of export, and they are not rivals — most files use named, some add a
default.

```js
// math.js
export const PI = 3.14159;                                  // named
export function area(r) { return PI * r * r; }              // named
export default function circumference(r) { return 2 * PI * r; }   // default
```

The `default` export is just a named export whose name happens to be `default`.
Nothing more magical than that:

```js
// app.js
import circumference, { PI, area } from './math.js';
import * as math from './math.js';

console.log(PI, area(2).toFixed(3), circumference(2).toFixed(3));
console.log(Object.keys(math));
console.log(typeof math.default);
```

```console
$ node app.js
3.14159 12.566 12.566
[ 'PI', 'area', 'default' ]
function
```

**Prefer named exports.** A default export is renamed at every import site, so
`import db from './client.js'` and `import connection from './client.js'` are the
same thing with two names — grep stops working and refactors stop propagating.
Named exports also let Node detect the export list statically, which is what makes
[interop with CommonJS](04-cjs-esm-interop.md) work.

The trade-off: a default export is one character shorter to import and reads
better for a module that genuinely *is* one thing — a React component, an Express
middleware factory.

## The extension is not optional

```js
import { area } from './math';      // ❌ ERR_MODULE_NOT_FOUND
import { area } from './math.js';   // ✅
```

ESM does not guess. CommonJS tries `./math`, then `./math.js`, then
`./math/index.js`; ESM asks for exactly the URL you wrote. That is what makes
resolution fast and cacheable, and it is the single most common error when
converting a codebase. Full comparison in [Module resolution](05-module-resolution.md).

Bare specifiers — `import express from 'express'` — are the exception. Those are
package names, and they go through the `node_modules` lookup.

## Imports are hoisted and run first

This trips people who expect top-to-bottom execution:

```js
// side.js
console.log('2 — side.js body');
export const value = 'from side';
```

```js
// hoist.js
console.log('1 — this logs SECOND, not first');
import { value } from './side.js';
console.log('3 —', value);
```

```console
$ node hoist.js
2 — side.js body
1 — this logs SECOND, not first
3 — from side
```

Node parses the whole file, resolves and evaluates every import, *then* runs the
body. An `import` cannot be conditional, cannot sit inside an `if`, and cannot use
a runtime-computed path. When you need any of those, use `import()` — below.

## Imports are live, read-only bindings

An import is a **view onto the exporting module's variable**, not a copy of its
value at import time.

```js
// counter.js
export let count = 0;
export function bump() { count += 1; }
```

```js
// live.js
import { count, bump } from './counter.js';
console.log('before', count);
bump();
console.log('after ', count);
```

```console
$ node live.js
before 0
after  1
```

`count` changed without being re-imported. CommonJS does not do this — `const { count } = require('./counter.js')` copies the number once and never sees the update.

The binding is read-only from the importing side:

```console
$ node readonly.js          # contains: count = 5
TypeError: Assignment to constant variable.
```

Only the module that owns a binding may change it. This is a feature: state has
exactly one writer, and you can find it.

## Top-level `await`

An ES module may `await` at the top level, outside any function.

```js
// tla.js
const started = Date.now();
const { setTimeout: sleep } = await import('node:timers/promises');
await sleep(50);
console.log('top-level await worked after', Date.now() - started >= 50 ? '>=50ms' : '<50ms');
export const ready = true;
```

```console
$ node tla.js
top-level await worked after >=50ms
```

Anything that imports `tla.js` waits for that `await` to settle before its own
body runs. That is the point — a module can finish connecting to a database
before it exports the connection — and also the cost: **top-level `await` in a
widely-imported module delays everything downstream**, and it makes the module
impossible to `require()` from CommonJS (see
[interop](04-cjs-esm-interop.md)).

Use it for genuine startup work. Do not use it for a config file that fifty
modules import.

## Dynamic `import()`

`import()` is a function that returns a promise for the module namespace. It takes
a runtime value, so it can be conditional, lazy, or computed.

```js
// dyn.js
const name = process.argv[2] ?? 'math';
const mod = await import(`./${name}.js`);
console.log('loaded', name, '→', Object.keys(mod));
```

```console
$ node dyn.js math
loaded math → [ 'PI', 'area', 'default' ]
$ node dyn.js counter
loaded counter → [ 'bump', 'count' ]
```

It works in CommonJS files too — it is the only way to load ESM from CJS without
`require()`'s restrictions.

The module is still evaluated **once**, no matter how many times you import it:

```js
// twice.js
const a = await import('./once.js');
const b = await import('./once.js');
console.log('same module object?', a === b, '| same timestamp?', a.t === b.t);
```

```console
$ node twice.js
once.js evaluated
same module object? true | same timestamp? true
```

Use it for: a CLI subcommand you only load when invoked, an optional dependency
that may not be installed, or a heavy module behind a feature flag. Do not reach
for it to break a circular dependency — that hides a design problem rather than
fixing it ([circular dependencies](06-circular-dependencies.md)).

## Gotchas

**Symptom:** `ERR_MODULE_NOT_FOUND` for a file you can see on disk
**Cause:** The import omitted the file extension. ESM does not add `.js` for you.
**Fix:** Write the extension. For a directory, point at the file:
`./routes/index.js`, not `./routes`.

**Symptom:** `Cannot use import statement outside a module`
**Cause:** The file is being treated as CommonJS — no `"type": "module"` and the
file has an ambiguous body, or the extension is `.cjs`.
**Fix:** Add `"type": "module"` to `package.json`, or rename the file to `.mjs`.
See [package.json essentials](07-package-json.md).

**Symptom:** `ReferenceError: require is not defined` in a file you did not change
**Cause:** The package flipped to `"type": "module"`, so every `.js` file in it is
now ESM.
**Fix:** Convert the file, or rename it `.cjs` if it must stay CommonJS.

**Symptom:** A value imported at startup is stale later, but only in CommonJS
consumers
**Cause:** ESM exports are live bindings; a CJS `require` destructure copies the
value once.
**Fix:** Export a getter or a function rather than a mutable primitive if both
worlds must see updates.

**Symptom:** The app takes seconds to start after adding one small module
**Cause:** Top-level `await` somewhere in the import graph — every importer blocks
on it, transitively.
**Fix:** Move the await into an exported `init()` the entry point calls once.

## Interview questions

**★ What is the difference between a named export and a default export?**
A named export is bound to its identifier and must be imported by that name (or
explicitly aliased); a default export is imported under whatever name the consumer
picks. `default` is really just a reserved export name, which is why
`import * as m` shows it as `m.default`. Named exports are preferred because they
survive refactors and let tooling see the export list statically.

**★ Why must you write the file extension in an ESM import?**
ESM resolution is URL-based and deterministic — Node does not probe the filesystem
for `.js`, `.json` and `/index.js` variants the way CommonJS does. Dropping the
guessing makes resolution faster and lets the same specifier mean the same thing
in a browser, but it means `./math` and `./math.js` are different requests.

**★ What are live bindings?**
An ESM import is a reference to the exporting module's variable, not a snapshot of
its value. If the exporter reassigns the variable, every importer sees the new
value immediately. Importers cannot assign to it — the binding is read-only on
their side.

**★ When would you use dynamic `import()` instead of a static `import`?**
When the specifier is only known at runtime, when the module should load lazily
(a CLI subcommand, a rarely-hit code path), when the dependency is optional, or
when you need to load ESM from a CommonJS file. It returns a promise, so it does
not block startup the way a static import does.

**Why does code in an imported module run before code at the top of the importing
module?**
Imports are hoisted. Node resolves and evaluates the entire dependency graph
before executing the body of the module that requested it, so a dependency's
side effects happen first.

**What does top-level `await` cost you?**
Every module that imports yours — directly or transitively — waits for it before
evaluating. It also makes the module un-`require()`-able from CommonJS, which
fails with `ERR_REQUIRE_ASYNC_MODULE`. It is the right tool for genuine startup
work and the wrong tool for anything on a hot import path.

**Can you `import` conditionally?**
Not with a static `import` — it is hoisted and unconditional by design. Use
`await import()` inside the branch instead.

---

← Prev: [Phase 1 overview](README.md) · Next → [CommonJS](02-commonjs.md)
