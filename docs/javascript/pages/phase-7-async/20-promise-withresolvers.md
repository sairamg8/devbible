---
title: "20 · `Promise.withResolvers`"
sidebar_label: "20 · Promise.withResolvers"
sidebar_position: 20
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Promise.withResolvers()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers), [`Promise()` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise), [`unhandledrejection`](https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event) — and ECMAScript [§ `Promise.withResolvers`](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise.withresolvers). Documentation-validated; **no timings, no console blocks**.

```js
const { promise, resolve, reject } = Promise.withResolvers();
```

One static method that hands you a promise and its two settle functions, instead of smuggling
them out of a constructor. It is the standardised form of a pattern the ecosystem called a
**deferred** for a decade.

## The pattern it replaces

```js
// the old deferred — correct, but it reads like a workaround
let resolve, reject;
const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
```

That code works, and it is worth knowing *why*: the executor runs **synchronously** during
construction ([13 · The executor](./13-creating-promises/01-the-executor.md)), so by the time
`new Promise(...)` returns, `resolve` and `reject` are already assigned. Nothing about it is a
trick — but it needs `let` in an outer scope, two names that TypeScript will insist are
possibly-undefined, and a reader who knows the executor timing.

`Promise.withResolvers()` is the same thing with none of that:

| | Deferred by hand | `Promise.withResolvers()` |
|---|---|---|
| Declarations | `let` × 2, then `const` | one destructuring `const` |
| Types | `resolve` is `… \| undefined` without a cast | inferred cleanly |
| Reads as | "extract the resolvers" | "give me a promise and its resolvers" |
| Works on subclasses | needs the subclass constructor | ✅ generic — `MyPromise.withResolvers()` |

**It is generic.** Called on a subclass, it constructs that subclass — the specification uses
`this` as the constructor — so a `Promise` subclass gets its own `withResolvers` for free.

## When it is the right tool — and when it is the anti-pattern

🔴 **The constructor and `withResolvers` are the same decision.** Both are for **bridging a
non-promise source into the promise world**, and both are the explicit-construction
anti-pattern anywhere else
([11 · The explicit-construction anti-pattern](./11-anti-patterns/01-explicit-construction.md)).

**Use it when the thing that settles the promise is somewhere the executor cannot reach:**

```js
// a one-shot signal any part of the module can fire
const { promise: ready, resolve: markReady } = Promise.withResolvers();
export { ready };
socket.addEventListener('open', () => markReady(), { once: true });
```

```js
// a request/response bridge over a message-based transport
const pending = new Map();

function send(payload) {
  const id = crypto.randomUUID();
  const { promise, resolve, reject } = Promise.withResolvers();
  pending.set(id, { resolve, reject });
  worker.postMessage({ id, payload });
  return promise;                                   // settled later, by the message handler
}

worker.addEventListener('message', ({ data }) => {
  const entry = pending.get(data.id);
  if (!entry) return;
  pending.delete(data.id);                          // 🔴 or the map grows forever
  data.error ? entry.reject(new Error(data.error, { cause: data.error })) : entry.resolve(data.result);
});
```

That correlation-by-id shape is where `withResolvers` genuinely reads better than the
constructor: the resolver has to be **stored**, not called from inside an executor. Web Workers,
WebSocket RPC, `postMessage`, IndexedDB request objects and any queue that settles work later all
have this shape.

**Do not use it to wrap something that already returns a promise**, and do not use it where an
`async` function would do. If you can write the settle logic inside an executor, use
`new Promise` — the resolvers cannot then leak, which is a real safety property.

## The three hazards

**1 · A promise nobody settles hangs forever.** Handing the resolvers to arbitrary code means no
single place guarantees settlement. A pending promise never errors, never times out and never
appears in a log — attach a timeout when the source might not answer:

```js
const { promise, resolve, reject } = Promise.withResolvers();
const t = setTimeout(() => reject(new Error('no response')), 5000);
promise.finally(() => clearTimeout(t));            // ✅ and clean the timer up either way
```

**2 · Anyone holding `resolve` can settle it.** That is the whole point, and also the risk — the
resolvers are capabilities. Keep them module-private; return only the `promise` from anything
public.

**3 · The stored entry outlives the operation.** A `Map` of pending resolvers is exactly the
long-lived structure that leaks: delete on settle, in a `finally` if necessary, or you retain
every response's closure for the life of the page
([Phase 8 · 04 · The four leaks](../phase-8-modules-errors/04-leaks/02-the-four-leaks.md)).

## Rejecting before anyone is listening is fine

A common worry, and it is unfounded within one task:

```js
const { promise, reject } = Promise.withResolvers();
reject(new Error('nope'));
promise.catch(handle);              // ✅ attached later in the same task — no warning
```

Unhandled-rejection detection happens at the **microtask checkpoint**, after the current
synchronous code has run, so a handler attached anywhere in the same task is in time. Attaching
in a *later* task is not — that is a genuine `unhandledrejection`, and it is
[08 · Unhandled rejections](./08-error-handling/03-unhandled-rejections.md).

## Availability

`Promise.withResolvers` is ES2024 and widely available in current browsers and Node. In a
codebase that must run somewhere older, the two-line deferred above is the polyfill — and it is
exactly what a transpiler emits.

```js
Promise.withResolvers ??= function () {
  let resolve, reject;
  const promise = new this((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
```

⚠️ **Note `new this`, not `new Promise`** — that is what keeps the polyfill generic over
subclasses, matching the specification.

## Gotchas

**Symptom: a promise from `withResolvers` never settles and nothing is logged.**
Cause — no code path called `resolve` or `reject`.
Fix — a timeout that rejects, cleared in `finally`; a pending promise is silent by design.

**Symptom: something unrelated resolved your promise.**
Cause — the resolvers were exposed beyond the module that owns them.
Fix — return only the `promise`; keep `resolve`/`reject` private.

**Symptom: memory grows in a request/response bridge.**
Cause — the pending map entry was not deleted when the response arrived, or on failure.
Fix — delete in every path, including the timeout and the error path.

**Symptom: TypeScript says `resolve` is possibly `undefined`.**
Cause — the hand-rolled deferred with `let`.
Fix — `Promise.withResolvers()`, which infers cleanly.

**Symptom: `Promise.withResolvers is not a function`.**
Cause — an older runtime.
Fix — the two-line polyfill, constructing with `new this`.

**Symptom: an `unhandledrejection` fires for a promise you do handle.**
Cause — the `.catch` was attached in a later task, after the microtask checkpoint.
Fix — attach the handler in the same task the promise is created in.

## Interview questions

**★ What does `Promise.withResolvers()` return?**
An object with `promise`, `resolve` and `reject` — the promise and its two settle functions,
without extracting them from an executor.

**★ Why did the hand-rolled deferred work at all?**
Because the executor runs synchronously during `new Promise(...)`, so the outer variables are
assigned before the constructor returns.

**★ When is it the right tool?**
When whatever settles the promise is somewhere an executor cannot reach — a message handler
correlating responses by id, a one-shot readiness signal, an event on another object. Not for
wrapping something that already returns a promise.

**★ What is the main risk?**
A promise nobody settles, and resolvers handed to code that should not have them. Add a timeout,
and keep the resolvers private.

**★ Does it work with a `Promise` subclass?**
Yes — it is generic and constructs using `this`, so `MySubclass.withResolvers()` gives a
`MySubclass`.

**★ Is rejecting before attaching a `.catch` a problem?**
Not within the same task. Unhandled-rejection detection runs at the microtask checkpoint, so a
handler attached later in the same synchronous run is in time.

---

← [19 · Event loop: browser vs Node](./19-event-loop-browser-vs-node/README.md) ·
[Phase index](./README.md)
