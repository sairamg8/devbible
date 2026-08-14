---
title: "04.2 · The error-first convention"
sidebar_label: "02 · Error-first"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the Node.js [Errors](https://nodejs.org/api/errors.html) guide (*Error propagation and interception*) and MDN — [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises), [Callback function](https://developer.mozilla.org/en-US/docs/Glossary/Callback_function). Documentation-validated.

**An asynchronous callback cannot `throw` at you.** By the time it runs, your `try`/`catch`
is long gone — the stack that set up the operation has unwound. That is the
*"a job is considered completed when the stack is empty"* rule from
[02 · The event loop](../02-the-event-loop/README.md), and it is the entire reason this
convention exists.

If the error cannot travel through the exception channel, it has to travel as **data**,
through the same channel as the result.

## The convention

Node's Errors guide:

> "Most asynchronous methods that accept a `callback` function will accept an `Error`
> object passed as the **first argument** to that function. If that first argument is not
> `null` and is an instance of `Error`, then an error occurred that should be handled."

Node's example:

```js
const fs = require('node:fs');
fs.readFile('a file that does not exist', (err, data) => {
  if (err) {
    console.error('There was an error reading the file!', err);
    return;
  }
  // Otherwise handle the data
});
```

**Why the error goes first, and not last.** A trailing error argument is easy to omit and
easy to forget — you write `(data) => …`, the code works on the happy path, and the failure
argument silently does not exist. Putting it in **position zero** makes it impossible to
reach the result without stepping over the error first. The convention is ugly on purpose.

The corollary, which is easy to miss: **on success the first argument is `null`, not
absent.** `cb(result)` from a function documented as error-first is a bug — the consumer
reads your result as the error.

## The missing `return`

```js
readConfig(path, (err, config) => {
  if (err) {
    log(err);
    return;              // ⚠️ this return is load-bearing
  }
  start(config);
});
```

🔴 **The single most common error-first bug is the missing `return`.** Without it,
execution falls through to `start(config)` with `config` as `undefined`, and the failure you
carefully logged becomes a *second*, unrelated crash further down — usually
`TypeError: Cannot read properties of undefined`. **The stack trace then points at `start`,
not at the failed read**, and you debug the wrong function.

The `if (err) return;` guard is not a style preference. **It is the only thing separating
the two branches**, because unlike `catch`, an `if` does not end the block for you. This is
the whole difference:

```js
try { … } catch (e) { … }        // the two paths are structurally exclusive
if (err) { … } /* … */           // the two paths are exclusive only if YOU say so
```

Seen from the producer side the same slip is worse — it calls the consumer's callback
**twice**. That is [chunk 03](./03-inversion-of-control.md).

## `try`/`catch` cannot reach an async callback

```js
try {
  fs.readFile(path, (err, data) => {
    JSON.parse(data);        // throws — but not into this try
  });
} catch (e) {
  // ⚠️ never runs
}
```

The `try` block finishes the moment `readFile` returns, which is immediately. The callback
runs in a **later task**, on a fresh stack, with no relationship to that `try`. In Node the
throw reaches `uncaughtException` and terminates the process by default; in a browser it
reaches `window.onerror`.

**Fix:** put the `try` *inside* the callback, where the risky work actually is, and route
the error back through the callback.

```js
fs.readFile(path, (err, data) => {
  if (err) return done(err);
  let parsed;
  try {
    parsed = JSON.parse(data);
  } catch (e) {
    return done(e);           // back through the same channel
  }
  done(null, parsed);
});
```

That is the whole discipline: **inside an async callback, every error must be converted
into a call, because there is no caller left to throw to.**

This is also the cleanest way to state what `async`/`await` gives back — it restores
`try`/`catch` over asynchronous work, by making the continuation part of the same function
rather than a separate one.

## Writing a callback API that is bearable

Two rules, and neither can be fixed by the consumer from outside.

### 1. Be consistently asynchronous

If a function calls its callback synchronously on a cache hit and asynchronously on a miss,
callers cannot reason about it at all — it is MDN's `value = 1 / value = 2` case, decided
at runtime by data. MDN names the problem while listing what promises guarantee:

> "Callbacks added with `then()` will never be invoked before the completion of the current
> run of the JavaScript event loop. **This prevents the 'Zalgo' state problem where
> callbacks might be called synchronously in some cases but asynchronously in others.**"

A callback-based function has to enforce that itself, by deferring the fast path:

```js
function get(key, cb) {
  if (cache.has(key)) {
    queueMicrotask(() => cb(null, cache.get(key)));   // defer, so it is ALWAYS async
    return;
  }
  fetchIt(key, cb);
}
```

`queueMicrotask` is the right primitive here rather than `setTimeout(…, 0)` — it defers by
the smallest amount that satisfies the guarantee. Same reasoning as
[03 · 02 · Using microtasks deliberately](../03-microtasks-vs-macrotasks/02-using-microtasks.md),
which covers the identical bug from the scheduling side.

### 2. Call the callback exactly once, on every path

Nothing in the language enforces either half. Audit for the early `return` that forgets to
call back at all, and the error branch that falls through into the success call.

```js
function load(id, cb) {
  if (!id) return;                    // ⚠️ silently never calls back — caller hangs forever
  if (!id) return cb(new Error('id required'));   // ✅
  …
}
```

## Gotchas

**Symptom:** `TypeError: Cannot read properties of undefined` downstream of a failed I/O
call
**Cause:** A missing `return` after `if (err)`. The error branch logged and fell through
into the success path with an `undefined` result.
**Fix:** `if (err) { handle(err); return; }` — always return, or use `else`. The stack trace
will otherwise point at the wrong function.

**Symptom:** `try`/`catch` around an async call never catches anything
**Cause:** The `try` block completes before the callback runs; the callback executes on a
new stack in a later task.
**Fix:** Put the `try` inside the callback and pass the error onward as `cb(err)`.

**Symptom:** An exception in a callback crashes the process instead of being handled
**Cause:** There is no caller on the stack to catch it, so it reaches `uncaughtException`
(Node) or `window.onerror` (browser).
**Fix:** Catch inside the callback; convert the throw into a `cb(err)` call.

**Symptom:** The consumer treats a successful result as an error
**Cause:** The producer called `cb(result)` instead of `cb(null, result)`. On success the
first argument must be **`null`**, not omitted.
**Fix:** Always pass `null` as the first argument on the success path.

**Symptom:** A function behaves differently on a cache hit than on a miss
**Cause:** Synchronous on one path, asynchronous on the other — the "Zalgo" problem MDN
names.
**Fix:** Defer the fast path with `queueMicrotask` so the function is *always* async.

**Symptom:** A caller hangs forever with no error
**Cause:** A guard clause that `return`s without invoking the callback at all.
**Fix:** Every exit path must call the callback exactly once —
`if (!id) return cb(new Error(…))`.

## Interview questions

**★ Why is the error the first argument in Node-style callbacks?**
Because an async callback cannot `throw` at its caller — the stack is gone by the time it
runs — so the error must arrive as data. Node: *"an `Error` object passed as the first
argument… if that first argument is not `null` … an error occurred that should be
handled."* First position makes it impossible to reach the result without stepping over the
error.

**★ What is wrong with this?** `if (err) { log(err); } doWork(data);`
**The missing `return`.** After logging, execution falls into `doWork` with `data` as
`undefined`, producing a second, unrelated error whose stack trace points at the wrong
function. An `if` does not end the block the way `catch` does.

**★ Why doesn't `try`/`catch` around `fs.readFile` catch a read error?**
Because the `try` block finishes when `readFile` returns, which is immediately. The
callback runs later on a fresh stack with no connection to that `try`. Errors come back
through the `err` parameter, not through the exception channel. `async`/`await` is what
restores `try`/`catch` over async work.

**★ What is the "Zalgo" problem?**
A function that calls its callback synchronously on some paths and asynchronously on
others, so callers cannot reason about ordering. MDN cites it as exactly what promise
semantics prevent. In a callback API, fix it by deferring the synchronous path with
`queueMicrotask`.

**What are the two rules for writing a callback-taking function?**
Be **consistently asynchronous** — never sync on one path and async on another — and call
the callback **exactly once on every path**, including early guard clauses. Neither is
enforced by the language, and neither can be fixed by the consumer.

**On success, what should the first argument be?**
`null` — explicitly, not omitted. `cb(result)` from an error-first API makes the consumer
read the result as an error.

---

← Prev [01 · The pattern](./01-the-pattern.md) · [Topic index](./README.md) · Next → [03 · Inversion of control](./03-inversion-of-control.md)
