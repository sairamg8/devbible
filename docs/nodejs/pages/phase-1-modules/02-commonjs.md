---
title: "CommonJS — require and the module cache"
sidebar_label: "02 · CommonJS"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS). CommonJS is not deprecated
> and is not going away — most of npm is still published this way.

**Node's original module system: synchronous, dynamic, and cached by resolved
path. You write ESM, but you will read CommonJS every day.**

## The wrapper

A `.cjs` file — or any `.js` file in a package without `"type": "module"` — is not
executed as-is. Node wraps it in a function first:

```js
// pseudo-code — what Node does to every CommonJS file
function (exports, require, module, __filename, __dirname) {
  // your file's code goes here
}
```

That is where those five names come from. They are **function parameters**, not
globals, which is why they do not exist in ESM:

```js
// wrapper.js
console.log(typeof require, typeof module, typeof exports, typeof __filename, typeof __dirname);
console.log('module.exports === exports?', module.exports === exports);
console.log('arguments.length in wrapper:', arguments.length);
```

```console
$ node wrapper.js
function object object string string
module.exports === exports? true
arguments.length in wrapper: 5
```

## `module.exports` vs `exports`

`exports` starts out as a second name pointing at the same object as
`module.exports`. **Only `module.exports` is what `require` returns.** Reassigning
the shorthand breaks the link and exports nothing:

```js
// broken.js
exports = { hello: 'world' };         // ❌ reassigns the local variable only
```

```js
// works.js
exports.hello = 'world';              // ✅ mutates the shared object
```

```js
// works2.js
module.exports = { hello: 'world' };  // ✅ replaces it properly
```

```console
$ node -e "console.log('broken.js →', require('./broken.js')); \
           console.log('works.js  →', require('./works.js')); \
           console.log('works2.js →', require('./works2.js'));"
broken.js → {}
works.js  → { hello: 'world' }
works2.js → { hello: 'world' }
```

The rule that avoids the whole class of bug: **use `module.exports` everywhere and
never type bare `exports`.** Attach properties (`module.exports.foo = …`) or assign
the object once at the bottom of the file.

## The module cache

A module's body runs **once per resolved path**, for the life of the process.
Every later `require` of the same file returns the same object.

```js
// logger.js
let calls = 0;
function log(msg) { calls += 1; console.log(`[${calls}] ${msg}`); }
module.exports = { log, get calls() { return calls; } };
```

```js
// a.js
const logger = require('./logger');
logger.log('from a');
module.exports = logger;
```

```js
// main.js
const logger = require('./logger');
const fromA = require('./a');
logger.log('from main');
console.log('same object?', logger === fromA, '| calls:', logger.calls);
```

```console
$ node main.js
[1] from a
[2] from main
same object? true | calls: 2
```

Two consequences worth internalising:

1. **A module is a singleton.** Anything you put at module scope — a database
   pool, a counter, a config object — is shared process-wide. That is how you get
   one connection pool, and also how one test leaks state into the next.
2. **Side effects at module scope run exactly once**, at first require, in
   whatever order the graph happens to resolve. Depending on that order is fragile.

The cache is keyed by **fully resolved filename**, and you can see it:

```js
// cachekeys.js
require('./logger');
require('node:path');
console.log(Object.keys(require.cache).filter(k => !k.includes('node_modules')).map(k => k.split('/').pop()));
console.log('is node:path in require.cache?', Object.keys(require.cache).some(k => k.includes('path')));
```

```console
$ node cachekeys.js
[ 'cachekeys.js', 'logger.js' ]
is node:path in require.cache? false
```

**Core modules are not in `require.cache`** — they are compiled into the binary and
resolved before the cache is consulted. See [the `node:` prefix](03-node-prefix.md).

### Busting the cache

You *can* delete an entry, and almost always should not:

```js
// recache.js
const p = require.resolve('./logger');
const first = require('./logger');
delete require.cache[p];
const second = require('./logger');
console.log('same after delete?', first === second);
```

```console
$ node recache.js
same after delete? false
```

The trade-off: the old object still exists wherever it was already captured, so
now two versions of the "singleton" are live at once. Anything holding a reference
to the first one keeps it. Use `--watch` for reloading in development, and a
proper dependency-injection seam for tests, instead.

## `require` is synchronous

`require` reads and compiles the file **on the main thread, blocking the event
loop**. That is fine at startup and expensive later.

```js
// ❌ blocks the event loop on the first request that hits this route
app.get('/report', (req, res) => {
  const pdf = require('heavy-pdf-library');
  res.send(pdf.render());
});
```

Require everything at module scope, where the cost is paid once during boot. The
one legitimate exception is a genuinely optional dependency, and `await import()`
is the better tool for that anyway.

Synchronicity is also *why* CommonJS cannot load ESM that uses top-level `await`
— there is nothing to block on. See [interop](04-cjs-esm-interop.md).

## Gotchas

**Symptom:** A module exports `{}` even though you assigned to `exports`
**Cause:** `exports = …` rebinds the parameter and severs the link to
`module.exports`.
**Fix:** `module.exports = …`. Never assign to bare `exports`.

**Symptom:** Changing a value in one file does not change what another file sees
**Cause:** `const { count } = require('./counter')` copies the value at require
time. CommonJS has no live bindings.
**Fix:** Export a function or getter, or read `mod.count` through the module
object instead of destructuring.

**Symptom:** Test state leaks between test files
**Cause:** The module cache is per process, so module-scope state persists across
every test that requires it.
**Fix:** Reset explicitly in a hook, or have the module export a factory the test
calls fresh.

**Symptom:** `Warning: Accessing non-existent property 'x' of module exports inside
circular dependency`
**Cause:** Two modules require each other; one got a partially-populated exports
object. Covered fully in [circular dependencies](06-circular-dependencies.md).
**Fix:** Break the cycle — extract the shared piece into a third module.

**Symptom:** The first request to an endpoint is slow, later ones are fast
**Cause:** A `require` inside the handler, compiling a large dependency
synchronously on first hit.
**Fix:** Move it to module scope.

## Interview questions

**★ What is the difference between `module.exports` and `exports`?**
`exports` is a local variable initialised to point at the same object as
`module.exports`. `require` returns `module.exports`. Mutating `exports` works
because both names reference one object; *assigning* to `exports` only rebinds the
local name and exports nothing.

**★ How many times does a CommonJS module's code run?**
Once per resolved path per process. The result is cached in `require.cache`, so
every subsequent `require` returns the same exports object without re-executing
the file. That is what makes every module a de facto singleton.

**★ Is `require` synchronous or asynchronous, and why does it matter?**
Synchronous. It reads, compiles and executes the module on the main thread,
blocking the event loop for the duration. Harmless at startup; a latency spike if
you do it inside a request handler.

**★ What is the module wrapper?**
Before executing a CommonJS file, Node wraps it in a function taking `exports`,
`require`, `module`, `__filename` and `__dirname`. That gives each file its own
scope — top-level `var` does not leak — and explains why those five names exist in
CJS but not in ESM.

**Why are core modules not in `require.cache`?**
They are compiled into the Node binary and resolved by the loader before the
user-module cache is consulted, so there is nothing to cache by filename.

**When is it correct to delete something from `require.cache`?**
Almost never in application code. Any reference already captured elsewhere keeps
the old object alive, so you end up with two live copies of a supposed singleton.
Use `--watch` in development and dependency injection in tests.

**Does CommonJS have live bindings like ESM?**
No. `require` returns an object; destructuring it copies values at that moment.
If the exporting module later reassigns a primitive, importers that destructured
never see it.

---

← Prev: [ESM](01-esm.md) · Next → [The `node:` prefix](03-node-prefix.md)
