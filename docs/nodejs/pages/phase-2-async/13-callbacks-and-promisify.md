---
title: "Callbacks, promisify and callbackify"
sidebar_label: "13 · Callbacks and promisify"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**The convention Node was built on, and the two functions that bridge it to
promises. You will not write callbacks, but you will wrap them.**

## The error-first convention

Every classic Node async API takes a callback whose **first parameter is the
error**:

```js
// convention.cjs
function readConfig(name, cb) {
  if (!name) return cb(new Error('name required'));      // error path: cb(err)
  setTimeout(() => cb(null, { name, port: 8080 }), 10);   // success: cb(null, value)
}

readConfig('app', (err, config) => {
  if (err) return console.error('failed:', err.message);
  console.log('loaded:', config);
});
```

```console
$ node convention.cjs
loaded: { name: 'app', port: 8080 }
```

Three rules make a callback API well-behaved, and breaking any of them is why
callback code got its reputation:

1. **Error first, value second.** `cb(err)` or `cb(null, value)` — never both.
2. **Call it exactly once.** Calling twice causes duplicated work that is very hard
   to trace. Note the `return` before each `cb(...)` above.
3. **Call it asynchronously, always.** A callback that sometimes fires
   synchronously and sometimes not produces order-dependent bugs. Defer with
   `process.nextTick` if you have an early return — see
   [page 03](03-microtasks-and-macrotasks.md).

## `promisify` — callback API to promise

```js
// promisify.mjs
import { promisify, callbackify } from 'node:util';

function readConfig(name, cb) {
  if (!name) return cb(new Error('name required'));
  setTimeout(() => cb(null, { name, port: 8080 }), 10);
}

const readConfigAsync = promisify(readConfig);
console.log('promisified →', await readConfigAsync('app'));
try { await readConfigAsync(''); } catch (e) { console.log('promisified error →', e.message); }
```

```console
$ node promisify.mjs
promisified → { name: 'app', port: 8080 }
promisified error → name required
```

`promisify` requires the error-first convention — it assumes the last argument is
a callback taking `(err, value)`. Functions that break it need a manual wrapper:

```js
// A callback with two success values, or a non-standard shape
const parseAsync = (input) => new Promise((resolve, reject) => {
  legacyParse(input, (err, head, body) => {
    if (err) reject(err);
    else resolve({ head, body });          // combine into one value
  });
});
```

This is the **one legitimate use of the `new Promise` constructor** — wrapping a
callback API. Using it anywhere else is the explicit-construction antipattern,
covered in [anti-patterns](17-promise-antipatterns.md).

## `callbackify` — the other direction

For when you must hand an async function to something that expects a callback:

```js
const getUser = async (id) => ({ id, name: 'ada' });
const getUserCb = callbackify(getUser);
getUserCb(7, (err, user) => console.log('callbackified →', err, user));
```

```console
callbackified → null { id: 7, name: 'ada' }
```

Rare in application code. It exists for library authors maintaining a callback API
over a promise-based implementation.

## Most of the time you need neither

Node's own APIs already ship promise versions. **Prefer them over promisifying:**

| Callback form | Promise form |
|---|---|
| `require('node:fs')` | `require('node:fs/promises')` |
| `require('node:dns')` | `require('node:dns/promises')` |
| `setTimeout(cb, ms)` | `require('node:timers/promises')` |
| `stream.pipeline(…, cb)` | `require('node:stream/promises')` |
| `child_process.exec(…, cb)` | `promisify(exec)` — no built-in promise form |
| `readline` | `readline/promises` |

```js
import { readFile } from 'node:fs/promises';
console.log('fs/promises →', (await readFile('package.json', 'utf8')).trim().slice(0, 20) + '…');
```

```console
fs/promises → { "name": "p2", "typ…
```

The promise variants are not `promisify` applied at load time — they are separate
implementations, sometimes with better ergonomics (`fs/promises` file handles
support `for await`, for instance).

## `util.promisify.custom`

When a function's promise form should not be the mechanical translation, the
author can define one:

```js
// custom.cjs
const { promisify } = require('node:util');

function getSize(path, cb) { cb(null, 42, 'bytes'); }   // two success values
getSize[promisify.custom] = (path) => Promise.resolve({ size: 42, unit: 'bytes' });

promisify(getSize)('/tmp/x').then(v => console.log('custom promisify →', v));
```

```console
$ node custom.cjs
custom promisify → { size: 42, unit: 'bytes' }
```

Worth recognising when you see it; `promisify` checks for that symbol first.

## Gotchas

**Symptom:** `promisify` produces a promise that never settles
**Cause:** The function does not use the error-first convention, or never calls its
callback on some path.
**Fix:** Wrap manually with `new Promise`.

**Symptom:** A promisified function loses a second success value
**Cause:** `promisify` resolves with the first value after `err` only.
**Fix:** A manual wrapper that combines them, or `promisify.custom`.

**Symptom:** A promisified method throws "cannot read property of undefined"
**Cause:** `this` was lost — `promisify(obj.method)` detaches it.
**Fix:** `promisify(obj.method.bind(obj))`.

**Symptom:** Callback fires twice, work happens twice
**Cause:** A missing `return` before an early `cb(err)`.
**Fix:** `return cb(err)` everywhere. Promisified versions hide the second call
silently, since a promise settles once.

**Symptom:** Order-dependent bug that only appears on the error path
**Cause:** The callback fires synchronously on early validation failure but
asynchronously otherwise.
**Fix:** Defer the sync path with `process.nextTick`.

## Interview questions

**★ What is the error-first callback convention?**
The callback's first parameter is an error (or `null`), and the value follows. It
gave Node a single uniform way to signal failure across every async API before
promises existed, and it is what `util.promisify` depends on.

**★ What does `util.promisify` require of a function?**
That its last argument is a callback following the error-first convention, called
exactly once. Functions with multiple success values, a non-standard callback
position, or a different argument order need a manual wrapper or a
`util.promisify.custom` implementation.

**★ When is `new Promise(...)` the right thing to write?**
Only when wrapping a callback-based or event-based API that has no promise form.
Using it around code that already returns promises is the explicit-construction
antipattern.

**★ Why should a callback never fire synchronously on some paths and
asynchronously on others?**
Because callers cannot reason about ordering — code after the call may or may not
have run when the callback fires. Defer the synchronous path with
`process.nextTick` so the behaviour is uniform.

**Do you still need `promisify` for Node's built-in modules?**
Mostly not — `fs/promises`, `dns/promises`, `timers/promises`, `stream/promises`
and `readline/promises` exist as separate implementations. `child_process.exec` is
the common exception where `promisify` is still the answer.

---

← Prev: [Floating promises](12-floating-promises.md) · Next → [Concurrency control](14-concurrency-control.md)
