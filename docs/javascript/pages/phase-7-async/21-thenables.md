---
title: "21 · Thenables"
sidebar_label: "21 · Thenables"
sidebar_position: 21
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Promise.resolve()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/resolve), [`Promise()` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise), [`await`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await), [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises) — and ECMAScript [§ `NewPromiseResolveThenableJob`](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-newpromiseresolvethenablejob), [§ Promise resolve functions](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise-resolve-functions). Documentation-validated; **no timings, no console blocks**.

🔴 **A thenable is any object or function with a callable `then` method. That is the entire
definition — no `Promise` in sight.** Wherever the language accepts a promise, it accepts a
thenable, because it never checks the class; it checks for `then`.

```js
const thenable = {
  then(resolve, reject) { resolve(42); },
};

await thenable;                 // 42
Promise.resolve(thenable);      // a real promise that follows it
```

## Where the duck-typing happens

| Operation | With a thenable |
|---|---|
| `await x` | calls `x.then(res, rej)` and waits for it |
| `Promise.resolve(x)` | returns a **new** promise following `x` |
| `resolve(x)` inside an executor | the promise **adopts** `x` |
| `return x` from `.then` / an `async` function | the chain waits for `x` |
| `Promise.all` / `race` / `any` / `allSettled` inputs | each element is resolved this way |
| `reject(x)` | 🔴 **no adoption** — `x` becomes the reason as-is |

The asymmetry in that last row is the one to remember, and it is the same fact as
[13 · Rule 4](./13-creating-promises/01-the-executor.md): only the *resolve* path unwraps.

**This is why promise libraries interoperate at all.** jQuery's `jqXHR`, Bluebird, Angular's
`$q`, an old vendor SDK — none of them are native promises, and every one of them can be
`await`ed, because they all expose `then`.

## How the language treats one, exactly

The specification is precise, and each step corresponds to a real failure mode:

1. **Is the value an object (or function)?** If not, it is a plain value.
2. **Read `.then` once.** If the *getter* throws, the promise rejects with that error.
3. **Is `then` callable?** If not — a string, a number, `null` — the value is treated as an
   ordinary value and fulfils as itself.
4. **If it is callable**, a job is queued to call `then(resolveFn, rejectFn)`. Adoption is
   therefore **asynchronous**, and it costs extra microtask ticks on top of a plain value.
5. **The resolving functions are one-shot.** A thenable that calls `resolve` twice, or calls both
   `resolve` and `reject`, gets the first outcome only — the language guards this, so a badly
   written thenable cannot corrupt a native promise.

⚠️ **Step 2 means `then` is read as a property, not looked up on each call.** A getter with side
effects runs once, and it runs at resolve time.

⚠️ **Step 4 is why `await` on a thenable is measurably later than `await` on a plain value** in
tick terms. It never changes *what* you get, only the interleaving — the kind of detail
[03 · The drain order](./03-microtasks-vs-macrotasks/01-the-drain-order.md) exists to settle.

## The accidental thenable

🔴 **Any object that happens to have a callable `then` will be treated as a promise.** This is
the trap, and it does not announce itself:

```js
class Query {
  then(cb) { /* the author meant a builder step, not a promise */ }
}

async function load() {
  return new Query();      // ❌ the caller awaits the Query, not gets it
}
```

An `async` function **cannot return a thenable** — the return value is resolved, so the caller
receives whatever the thenable settles with. If `then` never calls its callback, the caller's
`await` hangs forever with no error.

**Where this actually bites:**

| Source | What happens |
|---|---|
| A record from a database or API with a `then` **column** | if the value is not callable, nothing — it fulfils normally |
| A class with a `then` method meaning something else | 🔴 adopted; the object is never delivered |
| A mock or stub with a generic `then` | tests hang or resolve to `undefined` |
| An object built from user input | a callable `then` is untrusted code your resolve path will call |

**To hand back an object that is a thenable, wrap it:**

```js
return { value: thenableThing };        // ✅ the wrapper is not thenable
// or
return [thenableThing];
```

There is no flag that says "resolve this as a value". Wrapping is the only mechanism.

## Deliberately thenable: the lazy builder

The pattern is not always accidental — it is how query builders and lazy tasks let you write
`await` without a `.run()`:

```js
class Query {
  #build() { /* … */ }
  then(onFulfilled, onRejected) {
    return this.#execute().then(onFulfilled, onRejected);   // 🔴 execute on await
  }
  catch(fn) { return this.then(undefined, fn); }
  finally(fn) { return this.then().finally(fn); }
}

const rows = await db.select('*').from('users').where({ id: 1 });   // runs here, not before
```

Three rules if you write one:

- **Return a real promise from `then`**, not `this` — returning `this` risks a chain that never
  progresses, and the caller expects promise semantics from the result.
- **Provide `catch` and `finally` too.** `await` only needs `then`, but callers will chain, and
  a half-thenable breaks in surprising places.
- **Decide what a second `await` does.** Executing twice is usually wrong; cache the promise on
  first use ([16 · in-flight deduplication](./16-concurrency-limiting/02-the-bounded-pool.md)).

⚠️ **A lazy thenable also means the work never runs if nobody awaits it**, which is a quiet class
of bug: a builder assigned to a variable and forgotten does nothing at all, and no floating-promise
lint rule catches it because there is no promise.

## Normalising at the boundary

When a value may be a promise, a thenable or neither, one call settles it:

```js
const result = await Promise.resolve(maybeThenable);
```

`Promise.resolve` returns the **same object** for a native promise and a new following promise
for a thenable, so it is the cheap, correct normaliser — and the reason library code uses it
before touching an input. A bare `await` does the same thing and is usually clearer.

🔴 **Do not detect promises with `instanceof Promise`.** It is false for every non-native
thenable, and false across realms — an iframe or a Node `vm` context has its own `Promise`. Test
the duck if you must test at all:

```js
const isThenable = (v) => v != null && typeof v.then === 'function';
```

## Gotchas

**Symptom: an `async` function's caller receives `undefined` instead of the object.**
Cause — the object was a thenable, so the return value was resolved rather than delivered.
Fix — wrap it: `return { value: obj }`.

**Symptom: an `await` hangs forever with no error.**
Cause — a thenable whose `then` never calls either callback.
Fix — do not make the object thenable, or ensure `then` always settles.

**Symptom: `x instanceof Promise` is false for something you can `await`.**
Cause — a non-native thenable, or a promise from another realm.
Fix — duck-type `typeof x.then === 'function'`, or stop testing and just `await`.

**Symptom: a property getter runs at an unexpected moment.**
Cause — `then` is read once when the value is resolved.
Fix — do not put side effects in a `then` getter.

**Symptom: a query builder ran twice.**
Cause — a thenable executed on each `await`.
Fix — cache the promise on first `then`.

**Symptom: a query builder never ran at all.**
Cause — nobody awaited the lazy thenable, so no work was triggered.
Fix — an explicit `.execute()` alongside the thenable, or a lint rule for unused builder results.

**Symptom: a thenable called `resolve` twice and nothing broke.**
Cause — correct: the resolving functions are one-shot by specification.
Fix — none needed; but a double call is still a bug in the thenable.

## Interview questions

**★ What is a thenable?**
Any object or function with a callable `then` method. The language never checks for `Promise` — it
duck-types, which is why non-native promise libraries interoperate with `await`.

**★ What does `await` do with a thenable?**
Reads `.then` once, and if it is callable queues a job to call `then(resolve, reject)`, then waits
for whichever is called first. Adoption is asynchronous and costs extra microtask ticks.

**★ Can an `async` function return a thenable?**
No. The return value is resolved, so the caller gets whatever the thenable settles with. Wrap it
in a plain object or array to hand it back intact.

**★ Why is `instanceof Promise` a bad promise check?**
It is false for every non-native thenable and false across realms. Duck-type `then`, or simply
`await` the value.

**★ Why would you make a class thenable on purpose?**
So `await builder.where(...)` executes lazily without a separate `.run()`. Return a real promise
from `then`, add `catch` and `finally`, and decide what a second `await` means.

**★ Can a badly written thenable break a native promise?**
No. The resolving functions are one-shot — the first `resolve` or `reject` wins and the rest are
ignored.

**What happens if `then` exists but is a string?**
Nothing special: `then` must be *callable*, so the value fulfils as an ordinary object.

---

← [20 · `Promise.withResolvers`](./20-promise-withresolvers.md) · [Phase index](./README.md)
