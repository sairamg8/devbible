---
title: "CJS ↔ ESM interop"
sidebar_label: "04 · CJS ↔ ESM interop"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS). `require()` of an ES module
> was added in v22.0.0 / v20.17.0, unflagged in **v23.0.0 / v22.12.0 / v20.19.0**,
> and **shed its experimental label in v24.15.0** — so it is fully stable on the
> target runtime. Advice written before 2025 says this is impossible; it is not.

**You write ESM. Half of npm is CommonJS. Both directions work now, with one hard
boundary and one predictable surprise.**

## Importing CommonJS from ESM

This has always worked. `module.exports` arrives as the **default** export:

```js
// legacy.cjs
function greet(name) { return `hello ${name}`; }
module.exports = { greet, VERSION: '1.0.0' };
```

```js
// from-esm.js
import legacy from './legacy.cjs';      // module.exports lands on default
import { greet } from './legacy.cjs';   // named, detected by static analysis
console.log(legacy.greet('world'), '|', legacy.VERSION);
console.log(greet('again'));
```

```console
$ node from-esm.js
hello world | 1.0.0
hello again
```

The named import works because Node runs a **static analysis** pass — cjs-module-lexer
— over the CommonJS source, looking for recognisable assignment patterns, and
synthesises named exports from what it finds.

### Where the analysis gives up

It reads source text; it does not execute the module. Anything computed at runtime
is invisible:

```js
// dynamic.cjs
const key = 'computed' + 'Name';
module.exports[key] = () => 'built at runtime';
module.exports.static = () => 'visible';
```

```console
$ node fails.js          # contains: import { computedName } from './dynamic.cjs';
SyntaxError: Named export 'computedName' not found. The requested module
'./dynamic.cjs' is a CommonJS module, which may not support all module.exports
as named exports.
```

The fix is always the same — take the default and destructure at runtime:

```js
// fixed.js
import mod from './dynamic.cjs';
console.log(mod.computedName(), '|', mod.static());
```

```console
$ node fixed.js
built at runtime | visible
```

**Rule of thumb:** for a CommonJS dependency, default-import first and destructure
from the object. Named imports from CJS are a convenience that works most of the
time, not a guarantee.

## `require()`-ing an ES module

The direction that used to be impossible. In Node 24 a CommonJS file can `require`
an ES module directly:

```js
// esm-side.js
export const answer = 42;
export default function hello() { return 'from esm'; }
```

```js
// require-esm.cjs
const mod = require('./esm-side.js');
console.log('keys:', Object.keys(mod));
console.log('answer:', mod.answer, '| default():', mod.default());
console.log('__esModule marker:', mod.__esModule);
```

```console
$ node require-esm.cjs
keys: [ '__esModule', 'answer', 'default' ]
answer: 42 | default(): from esm
__esModule marker: true
```

You get the **module namespace object**, not the default export. A default export
is at `.default` — `require('./esm-side.js')` is not callable even though the
module has a default function. The `__esModule: true` marker is there so bundler
output and transpiled code can tell the two shapes apart.

### The hard boundary: top-level `await`

`require` is synchronous and there is nothing for it to block on:

```js
// tla-side.js
await new Promise(r => setTimeout(r, 10));
export const late = 'resolved';
```

```console
$ node require-tla.cjs
ERR_REQUIRE_ASYNC_MODULE — require() cannot be used on an ESM graph with top-level
await. Use import() instead. To see where the top-level await comes from, use
--experimental-print-required-tla.
```

Note **"ESM graph"** — it fails if top-level `await` appears anywhere in the
imported subtree, not just in the file you named. That flag is how you find it.

The escape hatch from CommonJS is dynamic `import()`, which returns a promise and
therefore has something to wait on:

```js
// works-anyway.cjs
(async () => {
  const { late } = await import('./tla-side.js');
  console.log(late);
})();
```

## `createRequire` — CommonJS helpers inside ESM

`require` does not exist in an ES module. When you need it — usually for
synchronous JSON, or a package that only resolves properly through CJS — build one:

```js
// createreq.js
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const pkg = require('./data.json');     // sync JSON, no import attribute needed
console.log('via createRequire:', pkg.name, pkg.port);
console.log('resolve:', require.resolve('./legacy.cjs').split('/').pop());
```

```console
$ node createreq.js
via createRequire: config 8080
resolve: legacy.cjs
```

The argument sets the resolution base — pass `import.meta.url` so relative paths
resolve against *this* file, exactly as they would in CommonJS.

Use it sparingly. It is an escape hatch, and every call reintroduces synchronous,
event-loop-blocking loading into an otherwise async graph.

## JSON in ESM

The native way needs an import attribute:

```js
// json-esm.js
import data from './data.json' with { type: 'json' };
console.log('via import attribute:', data.name, data.port);
```

```console
$ node json-esm.js
via import attribute: config 8080
```

Without it you get `ERR_IMPORT_ATTRIBUTE_MISSING`. The attribute is a security
requirement, not ceremony: it stops a server from swapping a `.json` response for
executable JavaScript.

For reading your own `package.json` at runtime, `createRequire` is often simpler —
and `fs.readFileSync` plus `JSON.parse` is clearer still, because it makes the
file read visible.

## Gotchas

**Symptom:** `SyntaxError: Named export 'x' not found` from a CommonJS package
that clearly has `x`
**Cause:** cjs-module-lexer could not see the assignment — it was computed, in a
loop, or behind a re-export.
**Fix:** `import pkg from 'the-package'` then `const { x } = pkg;`

**Symptom:** `require()` of an ESM package returns an object whose `default` is
what you wanted
**Cause:** `require(esm)` yields the namespace object, not the default export.
**Fix:** `const mod = require('./m.js').default;` — and check for `__esModule` if
you must support both shapes.

**Symptom:** `ERR_REQUIRE_ASYNC_MODULE` naming a file that has no `await` in it
**Cause:** Top-level `await` is somewhere else in that module's import graph.
**Fix:** Run with `--experimental-print-required-tla` to locate it, then either
remove it or switch the caller to `await import()`.

**Symptom:** `ERR_IMPORT_ATTRIBUTE_MISSING` on a JSON import that used to work
**Cause:** Code written against the old `assert { type: 'json' }` syntax, or none
at all.
**Fix:** `with { type: 'json' }`. The `assert` keyword was the earlier spelling
and is gone.

**Symptom:** A dual-published package behaves differently under `import` and
`require`
**Cause:** The dual package hazard — the `import` and `require` conditions point at
different files, so module-scope state exists twice.
**Fix:** Keep state out of module scope, or ship a single ESM build and let
`require(esm)` serve CJS consumers. See [the `exports` map](08-exports-map.md).

## Interview questions

**★ Can you `require()` an ES module in Node 24?**
Yes — unflagged in v23.0.0 / v22.12.0 / v20.19.0 and no longer experimental as of
v24.15.0. It returns the module namespace object, so a default export is at
`.default`. The one case that still fails is an ESM graph
containing top-level `await`, which throws `ERR_REQUIRE_ASYNC_MODULE` because
`require` is synchronous.

**★ Why does importing a named export from a CommonJS module sometimes fail?**
Node statically analyses the CJS source to synthesise named exports. The analysis
does not run the code, so exports assigned through computed keys, loops or
conditionals are invisible. Import the default and destructure instead.

**★ How do you use `require` inside an ES module?**
`createRequire(import.meta.url)` from `node:module`. The argument fixes the
resolution base so relative specifiers behave as they would in CommonJS.

**★ What is the dual package hazard?**
When a package ships separate CJS and ESM builds, an application can end up
loading both. Module-scope state — caches, registries, `instanceof` checks — then
exists twice and the two copies disagree. Avoiding it means keeping state out of
module scope or shipping one build.

**How do you import JSON from an ES module?**
`import data from './x.json' with { type: 'json' }`. The attribute is mandatory;
it prevents a server from substituting executable code for data.

**What does `__esModule: true` mean on a required module?**
It is a marker saying "this object is a transpiled or real ESM namespace, so the
real default is at `.default`." Node sets it on the namespace returned by
`require(esm)` so interop code can distinguish it from a plain CJS export object.

---

← Prev: [The `node:` prefix](03-node-prefix.md) · Next → [Module resolution](05-module-resolution.md)
