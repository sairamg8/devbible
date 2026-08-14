---
title: "11.1 · The explicit-construction anti-pattern"
sidebar_label: "01 · Explicit construction"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises), [`Promise()` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise), [`Promise.resolve()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/resolve), [`async function`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function). Documentation-validated.

**Wrapping something that is already a promise in `new Promise`.** It is the most common
promise anti-pattern, it is usually written by someone who understands promises perfectly
well, and it silently discards error handling.

```js
// ⚠️ anti-pattern
function getUser(id) {
  return new Promise((resolve, reject) => {
    fetch(`/users/${id}`)
      .then((r) => r.json())
      .then((data) => resolve(data))
      .catch((e) => reject(e));
  });
}

// ✅ the same thing
function getUser(id) {
  return fetch(`/users/${id}`).then((r) => r.json());
}
```

The second version is not merely shorter. **The first one is a reimplementation of `then`,
and it is a worse one.**

## Why it is harmful, not just verbose

**1. It re-creates error propagation by hand, and hand-written propagation has gaps.** The
example above happens to include the `.catch`; the version that ships usually does not, and
then a failed `fetch` leaves the outer promise **pending forever**. There is no error, no
rejection, no timeout — the caller simply waits. This is the never-called callback from
[04 · 03](../04-callbacks/03-inversion-of-control.md), rebuilt on top of a mechanism that
had already solved it.

**2. Throws inside the executor are not reliably converted.** From
[05 · 02](../05-promises/02-then-catch-finally.md), only a **synchronous** throw during the
executor becomes a rejection. A throw inside any callback you register in there does not:

```js
return new Promise((resolve) => {
  fetch(url).then((r) => {
    resolve(JSON.parse(r.body));   // ⚠️ a JSON.parse throw rejects nothing
  });
});
```

That throw lands on the global error handler, and the returned promise stays pending. The
plain chain version cannot have this bug, because a throw in a `.then` handler rejects the
next promise automatically.

**3. It loses the reference.** `Promise.resolve(p)` returns **the same promise** when given a
native one; `new Promise(…)` always creates another. That is the same identity point MDN
makes about `async` functions ([07 · 01](../07-async-await/01-always-a-promise.md)), and it
matters wherever promises are compared or cached by reference.

**4. It hides intent.** A reader has to check the executor for a missed `reject` path. A
returned chain has nothing to check.

## The same anti-pattern in `async` clothing

```js
// ⚠️ the deferred anti-pattern
function getUser(id) {
  let resolve, reject;
  const p = new Promise((res, rej) => { resolve = res; reject = rej; });
  fetchUser(id).then(resolve, reject);
  return p;
}
```

Hoisting `resolve`/`reject` out of the executor to settle the promise from elsewhere is the
"deferred" pattern. Occasionally it is genuinely needed — when the thing that settles the
promise is structurally elsewhere, such as a message handler matching a request id — and for
those cases the language now provides `Promise.withResolvers()`, covered in
[20 · `Promise.withResolvers`](../README.md). Reaching for it to wrap a call you could
simply have returned is the anti-pattern.

Two more variants worth recognising:

```js
async function f() {
  return new Promise((resolve) => resolve(compute()));   // ⚠️ both wrappers, one value
}
return Promise.resolve(await something());               // ⚠️ await already unwrapped it
```

## When `new Promise` is correct

There is exactly one common case, and MDN describes it as the intended use:

> "The best practice is to **wrap the callback-accepting functions at the lowest possible
> level**, and then never call them directly again."

MDN's own template:

```js
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

wait(10 * 1000)
  .then(() => saySomething("10 seconds"))
  .catch(failureCallback);
```

**`new Promise` is the bridge from a callback API to a promise API, and nothing else.** The
test is simple: *is there a promise in the executor already?* If yes, you do not need the
constructor. If the thing inside takes a callback — `setTimeout`, an event, a Node-style
`(err, data)` function, a `FileReader` — the constructor is the right and only tool.

A correct error-first bridge, which is the shape worth memorising:

```js
function readFileP(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, (err, data) => {
      if (err) return reject(err);      // the `return` matters here too
      resolve(data);
    });
  });
}
```

Note the `if (err) return reject(err)` — the same missing-`return` bug from
[04 · 02](../04-callbacks/02-error-first.md), which here would call `resolve` after `reject`.
That second call is harmlessly ignored ([05 · 01](./../05-promises/01-the-three-states.md)),
which is a rare case of the one-shot state machine covering for you.

Node ships `util.promisify` for exactly this shape, and most platform APIs now offer promise
versions (`fs/promises`), so the number of places you should be writing this by hand keeps
shrinking.

## Gotchas

**Symptom:** A caller waits forever with no error
**Cause:** A hand-built `new Promise` whose inner chain has no `.catch`, so `reject` is never
called on failure.
**Fix:** Return the chain directly instead of wrapping it.

**Symptom:** A `JSON.parse` failure inside a `new Promise` executor crashes globally instead
of rejecting
**Cause:** Only a **synchronous** throw during the executor becomes a rejection; a throw in a
callback registered inside it does not.
**Fix:** Return the chain, where a throw in a handler rejects automatically.

**Symptom:** Two calls that should return the same promise are not `===`
**Cause:** `new Promise` always allocates a new one, where `Promise.resolve(p)` returns `p`
itself.
**Fix:** Return the existing promise.

**Symptom:** `resolve` and `reject` are hoisted into outer variables
**Cause:** The deferred pattern, usually unnecessary.
**Fix:** Return the promise directly. If the settlement genuinely happens elsewhere, use
`Promise.withResolvers()`.

**Symptom:** `return new Promise((resolve) => resolve(x))` inside an `async` function
**Cause:** Double wrapping — the `async` keyword already wraps the return value.
**Fix:** `return x`.

**Symptom:** A promisified callback function resolves *and* rejects
**Cause:** A missing `return` before `reject(err)`, so `resolve` runs too.
**Fix:** `if (err) return reject(err)`. The second settlement is ignored, but the bug will
bite in a variant where it is not the last statement.

## Interview questions

**★ What is the explicit-construction (or "promise constructor") anti-pattern?**
Wrapping something that is already a promise in `new Promise(…)`. It reimplements `then` by
hand, and hand-written propagation has gaps — most commonly a missing `reject` path, which
leaves the caller **pending forever** with no error at all.

**★ Give a concrete harm beyond verbosity.**
A throw inside a callback registered in the executor rejects nothing — only a *synchronous*
throw during the executor is converted — so a `JSON.parse` failure crashes globally while the
promise stays pending. In a plain chain, a throw in a handler rejects the next promise
automatically.

**★ When is `new Promise` the right tool?**
Bridging a **callback API** to a promise. MDN: *"wrap the callback-accepting functions at the
lowest possible level, and then never call them directly again."* The test: if there is
already a promise inside the executor, you do not need the constructor.

**★ What is the deferred pattern and when is it justified?**
Hoisting `resolve`/`reject` out of the executor so the promise can be settled from elsewhere.
Justified when the settlement genuinely happens somewhere structurally separate — a message
handler matching a request id — and the language now provides `Promise.withResolvers()` for
it. Using it to wrap a call you could have returned is the anti-pattern.

**★ Why does `if (err) return reject(err)` need the `return`?**
Otherwise `resolve` runs immediately afterwards. The second settlement is ignored because a
promise settles once — but relying on that is relying on an accident, and the same missing
`return` is a genuine bug in any other position.

**Is `Promise.resolve(p)` the same as `new Promise(r => r(p))`?**
Not by identity: `Promise.resolve` returns **`p` itself** when given a native promise, while
the constructor always allocates a new one.

---

[Topic index](./README.md) · Next → [02 · Floating promises and the forgotten `return`](./02-floating-promises.md)
