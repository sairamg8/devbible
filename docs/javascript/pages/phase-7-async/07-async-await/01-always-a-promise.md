---
title: "07.1 · An async function always returns a promise"
sidebar_label: "01 · Always a promise"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`async function`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function), [`await`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await). Documentation-validated.

**`async` is a promise-returning wrapper applied to a function, and it applies
unconditionally.** MDN:

> "Async functions **always** return a promise. If the return value of an async function is
> not explicitly a promise, it will be implicitly wrapped in a promise."

There is no path out of an `async` function that is not a promise. Not a plain value, not a
throw, not an early `return`. Once the `async` keyword is there, the return type is fixed.

## The three exits

```js
async function a() { return 1; }                 // fulfils with 1
async function b() { return Promise.resolve(1); } // ALSO fulfils with 1 — adopted
async function c() { throw new Error("x"); }      // REJECTS with the error
```

MDN's own comparison for the simple case:

```js
async function foo() {
  return 1;
}

// Is similar to:
function foo() {
  return Promise.resolve(1);
}
```

`b` is the adoption rule from [05 · 03](../05-promises/03-value-vs-promise.md) — a returned
promise is flattened, never nested, so you never get a `Promise<Promise<T>>`.

🔴 **`c` is the one people get wrong: an `async` function never throws synchronously.**

```js
async function validate(input) {
  if (!input) throw new Error("input required");   // does NOT throw at the call site
  return await save(input);
}

try {
  validate(null);        // ⚠️ catches nothing — the call returns a rejected promise
} catch (e) {
  // never runs
}
```

The throw happens *inside* the function, and `async` converts it into a rejection of the
returned promise. The `try` around the **call** sees a normal return. To catch it you must
`await` the call, or attach a `.catch`.

This matters for argument validation: putting a check before the first `await` makes it run
**immediately** (see [chunk 02](./02-where-it-suspends.md)), which is genuinely useful, but
it does **not** make it throw synchronously. If you want a synchronous throw for programmer
errors, the check has to live in a non-`async` wrapper:

```js
function validate(input) {                     // NOT async
  if (!input) throw new Error("input required");  // throws synchronously
  return doValidate(input);                       // returns a promise
}
async function doValidate(input) { return await save(input); }
```

## `return p` is not `return Promise.resolve(p)`

MDN is precise about a difference that looks pedantic and occasionally is not:

> "**they are not equivalent**"

```js
const p = new Promise((res, rej) => {
  res(1);
});

async function asyncReturn() {
  return p;
}

function basicReturn() {
  return Promise.resolve(p);
}

console.log(p === basicReturn()); // true
console.log(p === asyncReturn()); // false
```

`Promise.resolve(p)` returns **the same promise** when handed a native promise —
it is a no-op. An `async` function cannot do that: it must create its own promise and
resolve it *with* `p`, so the reference differs.

**Where this bites:** identity comparisons and caches keyed by promise reference.

```js
const inflight = new Map();
function get(key) {
  if (!inflight.has(key)) inflight.set(key, fetchIt(key));
  return inflight.get(key);          // same reference every time
}

async function get2(key) {           // ⚠️ new promise reference on every call
  if (!inflight.has(key)) inflight.set(key, fetchIt(key));
  return inflight.get(key);
}
```

Both de-duplicate the *request* correctly — only one `fetchIt` runs — so the deduplication
works either way. But `get2 !== get2` for the returned objects, so any code comparing
promise identity, or using one as a `WeakMap` key, breaks. Marking a pure pass-through
function `async` costs you the reference and buys nothing.

## What it desugars to

MDN gives the minimal case:

```js
async function foo() {
  await 1;
}

// Is also equivalent to:
function foo() {
  return Promise.resolve(1).then(() => undefined);
}
```

Read that carefully — it encodes three separate facts:

1. **`await 1` becomes `Promise.resolve(1)`.** A non-promise is wrapped, not short-circuited.
2. **The code after the `await` becomes a `.then` handler** — a continuation.
3. **The function's own return value is the chain's promise.**

So `async`/`await` is [06 · Chaining](../06-chaining/README.md) with the chain written by
the engine. MDN says as much about the intent:

> "The purpose of `async`/`await` is to simplify the syntax necessary to consume
> promise-based APIs. The behavior of `async`/`await` is **similar to combining generators
> and promises**."

That generator comparison is the accurate mental model: the function can **suspend and
resume**, which a plain function cannot, and the promise is what decides when it resumes.

## What you actually gain over a chain

Since the semantics are the same, the case for `async`/`await` is entirely about what you
can write:

| With a chain | With `async`/`await` |
|---|---|
| `.catch()` | real `try`/`catch`/`finally`, including nesting for scope |
| `reduce` over promises to sequence a list | an ordinary `for` loop |
| ternaries, or a branch returning different chains | ordinary `if`/`else` |
| values threaded through handler arguments | ordinary `const` in one scope |
| stack traces that lose frames across links | frames preserved across `await` in modern engines |

🔴 **The last row is underrated.** Intermediate values being ordinary local variables — all
visible to every later line, all visible in a debugger — is the largest practical
difference. In a chain, getting step 1's value into step 3 means threading it through step
2's return.

## Gotchas

**Symptom:** `try`/`catch` around a call to an `async` function catches nothing
**Cause:** The function returns a **rejected promise**; it does not throw. MDN: async
functions *"always return a promise"*.
**Fix:** `await` the call inside the `try`, or attach `.catch()` to it.

**Symptom:** A validation error is reported far from where the function was called
**Cause:** Same reason — the throw became a rejection, surfacing wherever the promise is
finally handled.
**Fix:** For synchronous argument checks, put them in a **non-`async` wrapper** that throws
and then delegates to an `async` function.

**Symptom:** A promise returned from an `async` pass-through is not `===` the one it
received
**Cause:** MDN: `Promise.resolve(p)` returns the same reference; an `async` function creates
a new promise resolved *with* `p`.
**Fix:** Drop the `async` keyword on a pure pass-through — just `return` the promise.

**Symptom:** You expected `Promise<Promise<T>>` from `return somePromise`
**Cause:** Adoption. The returned promise is flattened.
**Fix:** Expected — and the reason `return p` and `return await p` usually behave the same.

**Symptom:** An `async` function with no `await` in it still defers its result
**Cause:** The return value is wrapped in a promise regardless, so the caller must still
await it.
**Fix:** Expected. If nothing is awaited, the `async` keyword is likely unnecessary.

## Interview questions

**★ What does an `async` function return?**
Always a promise. MDN: *"If the return value of an async function is not explicitly a
promise, it will be implicitly wrapped in a promise."* A `return` fulfils it, a `throw`
rejects it, and a returned promise is **adopted**, never nested.

**★ Does an `async` function ever throw synchronously?**
No. A throw anywhere inside it — including before the first `await` — becomes a **rejection
of the returned promise**. So `try { asyncFn() } catch {}` without an `await` catches
nothing. Synchronous argument validation must live in a non-`async` wrapper.

**★ Is `return p` inside an `async` function the same as `return Promise.resolve(p)`?**
Semantically for the value, but **not by identity**. MDN's example:
`p === basicReturn()` is `true` while `p === asyncReturn()` is `false`, because
`Promise.resolve` passes a native promise through unchanged while an `async` function must
create its own.

**★ What does `async function foo() { await 1; }` desugar to?**
MDN: `function foo() { return Promise.resolve(1).then(() => undefined); }`. Which shows
that a non-promise is **wrapped** rather than skipped, the code after the `await` becomes a
continuation, and the function's return value is the chain's promise.

**★ If the semantics equal a chain, why use `async`/`await`?**
For what you can write: real `try`/`catch`/`finally`, ordinary loops and `if`/`else` instead
of `reduce` and ternaries, and intermediate values as ordinary local variables visible to
every later line and to a debugger — rather than threaded through handler arguments.

**What is the closest mental model for how it suspends?**
Generators. MDN: *"the behavior of `async`/`await` is similar to combining generators and
promises"* — the function suspends and resumes, and the awaited promise decides when.

---

[Topic index](./README.md) · Next → [02 · Exactly where it suspends](./02-where-it-suspends.md)
