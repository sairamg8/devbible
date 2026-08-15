---
title: "14.1 · Writing `promisify`"
sidebar_label: "01 · Writing it"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Promise()` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise), [`Function.prototype.call()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/call), [`Reflect.apply()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/apply), [`Object.getOwnPropertyDescriptors()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptors), [`Symbol.for()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/for) — and Node.js [`util.promisify`](https://nodejs.org/api/util.html#utilpromisifyoriginal) plus its implementation in [`lib/internal/util.js`](https://github.com/nodejs/node/blob/main/lib/internal/util.js). Documentation-validated; **nothing was run**.

**One convention makes this mechanical.** A callback API can be bridged to promises without
knowing anything about it, provided it obeys the shape Node's documentation calls *the common
error-first callback style*: **the callback is the last argument, and it is called
`(err, value)`**.

```js
readFile("a.txt", "utf8", (err, text) => { /* err is null on success */ });
```

Everything below is the price of turning that one sentence into a function that survives
review.

## The five-line version

```js
const promisify = (fn) => (...args) =>
  new Promise((resolve, reject) =>
    fn(...args, (err, value) => (err ? reject(err) : resolve(value))));
```

It is correct for the common case and wrong in four ways, each of which is a question:
it loses `this`, it throws away every callback value after the first, it ignores an API
that has published its own promise version, and the function it returns is anonymous with
the wrong arity.

## The version to write when asked

```js
promisify.custom = Symbol.for("nodejs.util.promisify.custom");

function promisify(original) {
  if (typeof original !== "function") {
    throw new TypeError("The 'original' argument must be of type function");
  }

  const custom = original[promisify.custom];                  // 1 · published version wins
  if (custom) {
    if (typeof custom !== "function") {
      throw new TypeError("The 'util.promisify.custom' property must be of type function");
    }
    return custom;
  }

  function promisified(...args) {
    return new Promise((resolve, reject) => {
      original.call(this, ...args, (err, ...values) => {      // 2 · callback last, `this` kept
        if (err) reject(err);                                 // 3 · truthiness, deliberately
        else resolve(values[0]);                              // 4 · one value out
      });
    });
  }

  Object.setPrototypeOf(promisified, Object.getPrototypeOf(original));
  return Object.defineProperties(                             // 5 · keep the identity
    promisified,
    Object.getOwnPropertyDescriptors(original),
  );
}
```

Node's own implementation is this shape — `ReflectApply(original, this, args)` in place of
`call`, `resolve(values[0])`, `ObjectSetPrototypeOf` then
`ObjectDefineProperties(fn, ObjectGetOwnPropertyDescriptors(original))`. The rest of this
page is why each line is there.

## 1 · A published implementation beats a generic wrapper

Node's documentation: *"If there is an `original[util.promisify.custom]` property present,
`promisify` will return its value"*, and *"If `promisify.custom` is defined but is not a
function, `promisify()` will throw an error."*

The symbol is **registered**, not local: *"In addition to being accessible through
`util.promisify.custom`, this symbol is registered globally and can be accessed in any
environment as `Symbol.for('nodejs.util.promisify.custom')`."*

That word does real work. `Symbol.for` looks a key up in a runtime-wide registry, so two
copies of a library — a bundled one and a `node_modules` one, or code in a different realm —
produce the **same** symbol. A plain `Symbol('promisify.custom')` would produce two, the
lookup would miss, and the API would silently get the generic wrapper instead of the one its
authors wrote. Registered symbols are the mechanism for a protocol that crosses module
boundaries; that is the whole reason this one is registered.

📌 Node also stamps the wrapper it builds with the same symbol, pointing at itself, which makes
`promisify(promisify(fn))` return the first wrapper rather than double-wrapping. It is a one-line
idempotence guarantee and worth copying.

## 2 · `this` has to survive, so the wrapper cannot be an arrow

```js
const read = promisify(db.query);
read("SELECT 1");                  // ⛔ inside query, `this` is undefined
```

`promisified` is declared with `function`, so it receives the receiver from the call site, and
`original.call(this, ...)` forwards it. An arrow would capture `this` from `promisify`'s own
scope and the method would run detached — the failure reads as
`Cannot read properties of undefined`, from inside library code you did not write
([02 · `call`, `apply` and `bind`](../02-call-apply-bind/README.md),
[Phase 3 · 03 · `this`](../../phase-3-functions/03-this/README.md)).

Two consequences the wrapper cannot fix for you:

- **Extracting a method loses the receiver before `promisify` ever sees it.**
  `promisify(db.query)` then `read(...)` is a bare call. Either call it as a method
  (`obj.read = promisify(obj.query)`) or bind first (`promisify(db.query.bind(db))`).
- **Private fields raise the stakes.** A method touching `#state` throws a `TypeError` rather
  than reading `undefined`, which at least fails loudly.

## 3 · `if (err)` is a truthiness test, and that is on purpose

Node's wrapper tests `if (err)` — not `err != null`. The convention is that the error slot is
`null` or `undefined` on success, and every value that is not is a failure.

The cost is real but narrow: an API that reports success by passing `0`, `''` or `false` into
the first slot will resolve, not reject. That is not error-first, and no generic promisifier
can rescue it — it needs a hand-written adapter
([14.2](./02-what-it-cannot-bridge.md)).

The mirror image is worth carrying: Node's `util.callbackify`, going the other way, documents
that *"Since `null` has a special meaning as the first argument to a callback, if a wrapped
function rejects a `Promise` with a falsy value as a reason, the value is wrapped in an `Error`
with the original value stored in a field named `reason`."* Both halves of the bridge have to
take a position on falsy errors; the promise side rejects on truthiness, the callback side
re-wraps falsiness.

## 4 · The executor's synchrony does two jobs, and hides one problem

MDN: *"The `executor` is called synchronously (as soon as the `Promise` is constructed)"*, and
*"If an error is thrown in the `executor`, the promise is rejected, unless `resolveFunc` or
`rejectFunc` has already been called."*

**The job it does for you.** A callback API that validates its arguments and throws
*before* going asynchronous — a bad path, a missing option — throws inside the executor. The
constructor turns that into a rejection, so the caller's `try`/`catch` around an `await`, or a
`.catch()`, sees it. Without this, a promisified function would be able to fail in two
different ways and every call site would need both handlers.

**The problem it hides.** Read the exception in MDN's sentence. If the original calls its
callback and *then* throws — a listener that fails after signalling success — the promise has
already settled, so rejecting is a no-op and the throw is swallowed by the constructor with
nothing to show for it. Nothing propagates to the caller either, because the executor is not
running on their stack any more. That error is gone. It is a genuine limitation of wrapping,
not a bug in the wrapper, and it is one reason a library's own promise API is better than a
wrapper over its callback API.

## 5 · Settling once makes a double callback harmless — and invisible

MDN: *"Only the first call to `resolveFunc` or `rejectFunc` affects the promise's eventual
state, and subsequent calls to either function can neither change the fulfillment value/rejection
reason nor toggle its eventual state."*

A callback API that fires twice — the classic retry-that-forgot-to-`return` — cannot corrupt the
promise. The first result wins and the rest are dropped. This is the single biggest correctness
win of the bridge, and it is free.

⚠️ **It is also a silencer.** The bug is still there, still doing whatever else it does, and the
promise gives you no way to notice. If you are wrapping code you own, fix the double call; do not
let the wrapper launder it.

## 6 · One value goes out

`resolve` takes one argument. A callback of the form `(err, a, b)` therefore loses `b`:

```js
someApi((err, stdout, stderr) => …);       // two values
await promisified();                        // ⛔ stdout only
```

Rest-collecting the values (`(err, ...values)`) makes the shape explicit at the point where it is
discarded, and gives you an opt-in:

```js
function promisify(original, { multiArgs = false } = {}) {
  // … resolve(multiArgs ? values : values[0]);
}
```

Node does not expose an option for this. It resolves `values[0]`, and leaves the multi-value case
to `promisify.custom` — which is how `child_process.exec` produces an object rather than a tuple.
[14.2](./02-what-it-cannot-bridge.md) works through that example.

**Prefer a named object to an array** when you do add the option. `const { stdout } = await run(cmd)`
survives a new value being added in the middle; `const [stdout, stderr] = …` does not.

## 7 · Keep the function's identity

The wrapper is a different function object from the original, and by default it says so:

```js
promisified.name;      // "promisified", not "readFile"
promisified.length;    // 0 — it is (...args)
promisified.custom;    // any property the original carried is gone
```

`Object.defineProperties(promisified, Object.getOwnPropertyDescriptors(original))` copies all of
them back, descriptors and all — getters stay getters, non-enumerable stays non-enumerable, which
a spread or `Object.assign` would flatten. `Object.setPrototypeOf` keeps anything the original
inherited.

This is not cosmetic. `name` is what appears in stack traces and test output, `length` is what
arity-sniffing helpers read ([13 · `curry`](../13-curry-pipe-compose/01-curry.md) is one), and
a function that carries data on itself — a `.schema`, a `.displayName`, a framework marker — loses
it otherwise.

⚠️ **`name` and `length` are configurable but not writable**, so a plain assignment fails silently
in sloppy mode and throws in a module. `defineProperty` is the only route.

## Gotchas

**Symptom:** `Cannot read properties of undefined` from inside the library.
**Cause:** The method was extracted before wrapping, so `this` was lost at the call site.
**Fix:** `promisify(api.method.bind(api))`, or assign the wrapper back onto the object.

**Symptom:** The wrapper resolves when the API clearly failed.
**Cause:** The API is not error-first — its first callback argument is a value, and a falsy one
counts as success under `if (err)`.
**Fix:** Write an adapter for that API's shape rather than a generic promisifier
([14.2](./02-what-it-cannot-bridge.md)).

**Symptom:** Only the first of several callback values arrives.
**Cause:** `resolve` takes one argument.
**Fix:** `multiArgs`, or a `promisify.custom` implementation that resolves a named object.

**Symptom:** A custom promisified version is ignored, but only in one build.
**Cause:** The symbol was created with `Symbol()` somewhere, or two copies of the module are
installed, so the two symbols are not the same value.
**Fix:** `Symbol.for("nodejs.util.promisify.custom")` — the global registry is the point.

**Symptom:** An error thrown by the API vanished entirely.
**Cause:** It threw *after* calling the callback; the promise had already settled, so the
constructor's rejection was a no-op.
**Fix:** Nothing in the wrapper can catch it — fix the original, or use its native promise API.

**Symptom:** Test output and stack traces show `promisified` everywhere.
**Cause:** The wrapper's own `name`.
**Fix:** Copy the original's own property descriptors onto it.

## Interview questions

**★ Implement `promisify`.**
Return a `function` (not an arrow) that returns `new Promise`, calls the original with
`original.call(this, ...args, cb)`, and in the callback rejects when the first argument is truthy
and otherwise resolves the second. The `function` and the explicit `this` forwarding are what
keep it usable on methods.

**★ Why must the wrapper use `function` rather than an arrow?**
So the receiver from the call site reaches the original. An arrow captures `this` lexically, and a
promisified method then runs detached.

**★ What happens if the callback is invoked twice?**
Nothing — a promise settles once and later `resolve`/`reject` calls are ignored. The wrapper is
safe, but it also hides the bug, so fix the original if you own it.

**★ What happens if the original throws synchronously?**
The executor runs synchronously, so the constructor converts the throw into a rejection and the
caller sees one failure channel. The exception is a throw *after* the callback has already
settled the promise: that error is discarded.

**★ Why does `util.promisify.custom` use `Symbol.for` rather than `Symbol`?**
Because the registry is global, so duplicate copies of a module — or another realm — resolve to
the same symbol. A local symbol would make the lookup miss and silently fall back to the generic
wrapper.

**How do you handle a callback that passes more than one value?**
`resolve` carries one value, so either opt into an array with a `multiArgs` flag or publish a
`promisify.custom` implementation that resolves a named object. Node takes the second route for
`child_process.exec`.

**Why copy the original's properties onto the wrapper?**
`name`, `length` and any data the function carried are part of its public surface — stack traces,
arity checks and framework markers all read them. `Object.getOwnPropertyDescriptors` plus
`Object.defineProperties` preserves them exactly, including getters and non-enumerables.

---

[Topic index](./README.md) · Next → [What it cannot bridge](./02-what-it-cannot-bridge.md)
