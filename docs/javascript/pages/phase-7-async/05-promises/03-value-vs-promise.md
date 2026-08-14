---
title: "05.3 · Returning a value vs a promise"
sidebar_label: "03 · Value vs promise"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Promise.prototype.then()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then), [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise), [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises). Documentation-validated.

**Whatever a handler returns decides what the next promise is.** This is the single rule
that makes chaining work, and the single rule whose exceptions produce the two most common
promise bugs in real code.

## The six outcomes

MDN states them exhaustively, for the promise `p` that `then()` returns:

> If the handler function:
>
> - **returns a value**: `p` gets fulfilled with the returned value as its value.
> - **doesn't return anything**: `p` gets fulfilled with `undefined` as its value.
> - **throws an error**: `p` gets rejected with the thrown error as its value.
> - **returns an already fulfilled promise**: `p` gets fulfilled with **that promise's
>   value** as its value.
> - **returns an already rejected promise**: `p` gets rejected with **that promise's value**
>   as its value.
> - **returns another pending promise**: `p` is pending and becomes fulfilled/rejected with
>   that promise's value **immediately after that promise becomes fulfilled/rejected**.

Read the last three together and you have the whole of it:

🔴 **Return a plain value and it is wrapped. Return a promise and it is *adopted*, not
wrapped.** You never get a `Promise<Promise<T>>` out of a handler — the chain flattens
automatically.

```js
Promise.resolve(1).then(() => 2);                    // fulfils with 2
Promise.resolve(1).then(() => Promise.resolve(2));   // fulfils with 2 — NOT with a promise
```

Both produce the same thing. That is *adoption* (also called assimilation): the outer
promise locks onto the inner one's eventual state, which is precisely the **"resolved"**
condition from [chunk 01](./01-the-three-states.md) — resolved immediately, fulfilled only
when the inner promise settles.

The practical payoff is that a handler can be **freely refactored between sync and async**
without changing its callers:

```js
.then((id) => users[id])              // synchronous lookup
.then((id) => fetchUser(id))          // now asynchronous — the chain does not care
```

Nothing downstream changes. This is the property callbacks never had.

## Bug one: the forgotten `return`

```js
fetchUser(id)
  .then((user) => {
    fetchPosts(user.id).then((posts) => render(posts));   // ⚠️ no return
  })
  .then(() => console.log("done"));
```

The outer handler **returns nothing**, so — MDN — *"p gets fulfilled with `undefined`"*
**immediately**, without waiting for `fetchPosts`. `"done"` logs while the posts request is
still in flight, and the chain has silently forked into two independent timelines.

Worse: the inner promise is now **floating**. If `fetchPosts` rejects, nothing in the outer
chain is listening, so it becomes an unhandled rejection instead of reaching the outer
`.catch`.

```js
fetchUser(id)
  .then((user) => fetchPosts(user.id))     // ✅ returned — the chain waits
  .then((posts) => render(posts))
  .then(() => console.log("done"));
```

**The tell is a nested `.then` inside a `.then`.** Nesting is not illegal, but it is nearly
always the forgotten `return` — and it recreates the pyramid promises were adopted to avoid
([04 · 04](../04-callbacks/04-callback-hell.md)).

This is also the clearest argument for arrow bodies without braces: `(user) => fetchPosts(user.id)`
cannot forget to return.

## Bug two: returning inside `catch` without meaning to

A `catch` handler follows the same six rules — so returning a value from it **fulfils** the
chain:

```js
fetchConfig()
  .catch((e) => {
    log(e);
    return DEFAULTS;        // deliberate: a fallback
  })
  .then((cfg) => start(cfg));   // runs, with DEFAULTS
```

That is a legitimate and useful pattern — recovery with a default. The bug is doing it by
accident:

```js
.catch((e) => log(e))       // ⚠️ log() returns undefined → chain fulfils with undefined
.then((cfg) => start(cfg))  // start(undefined)
```

**Same rule, opposite intent.** Decide explicitly: return a fallback to recover, or `throw e`
to keep failing.

## Throwing and returning a rejected promise are the same thing

```js
.then(() => { throw new Error("x"); })
.then(() => Promise.reject(new Error("x")));
```

Both reject the next promise with that error. `throw` is usually clearer inside a handler,
and it is the only form that works from a synchronous helper.

The one place they differ is in reachability: a `throw` inside a **callback you passed to
something else** — a `setTimeout`, a `forEach` — is not in the handler's own execution, so it
does not reject anything. That is the [04 · 02](../04-callbacks/02-error-first.md) rule
again, and no amount of promise syntax fixes it.

## Returning a thenable

Because adoption is defined on **thenables**, not on native promises
([chunk 01](./01-the-three-states.md)), a handler that returns any object with a callable
`then` gets the same treatment:

```js
.then(() => ({ then(res) { res(42); } }))   // fulfils with 42, not with the object
```

Useful for interoperation, and the source of the accidental-assimilation bug when a data
object happens to carry a `then` field.

## What `async` functions do with the same rule

An `async` function is this rule with different syntax. It **always** returns a promise, and
`return x` inside it behaves exactly like returning `x` from a `then` handler:

```js
async function f() { return 1; }                    // fulfils with 1
async function g() { return Promise.resolve(1); }   // ALSO fulfils with 1 — adopted, not nested
async function h() { throw new Error("x"); }        // rejects
```

🔴 **`return somePromise` from an `async` function does not produce a nested promise** — the
same adoption applies. This is why `return await p` and `return p` usually behave
identically, and the difference between them (a `try`/`catch` around the return) belongs to
[11 · Promise anti-patterns](../README.md).

## Gotchas

**Symptom:** A later `.then` runs before the work in an earlier one has finished
**Cause:** The earlier handler did not **return** its inner promise, so MDN's *"doesn't
return anything → fulfilled with `undefined`"* applied immediately.
**Fix:** `return` the inner promise. A nested `.then` inside a `.then` is the tell.

**Symptom:** An inner request's failure becomes an unhandled rejection instead of reaching
`.catch`
**Cause:** Same missing `return` — the inner promise is floating, not part of the chain.
**Fix:** Return it so the chain adopts it, and its rejection propagates.

**Symptom:** A handler receives `undefined` when it expected a value
**Cause:** The previous handler had a braced body with no `return`, or was a `catch` whose
last expression was a `log()` call.
**Fix:** Return explicitly, or use a concise arrow body that cannot forget.

**Symptom:** After a `catch`, the chain continues with `undefined` instead of failing
**Cause:** `catch` follows the same six rules — a handler returning nothing **fulfils** with
`undefined`.
**Fix:** `throw e` to keep failing; return a fallback only when recovery is intended.

**Symptom:** You expected a `Promise<Promise<T>>` and got a `Promise<T>`
**Cause:** Adoption — MDN: returning a promise makes `p` settle with *"that promise's
value"*, not with the promise.
**Fix:** Expected, and the point. A chain cannot nest promise layers.

**Symptom:** An object returned from an `async` function came back as something else
**Cause:** It was a **thenable** — it had a callable `then` — so it was adopted.
**Fix:** Do not name a data field `then`; wrap the object if you cannot rename it.

## Interview questions

**★ What does returning a value from a `.then` handler do, versus returning a promise?**
A plain value **fulfils** the next promise with it. A promise is **adopted**: MDN says `p`
settles with *"that promise's value"*, so you never get a nested promise. That flattening is
what lets a handler switch between synchronous and asynchronous implementations without any
caller changing.

**★ What happens if a handler returns nothing?**
MDN: *"p gets fulfilled with `undefined`"* — and **immediately**. This is the forgotten-
`return` bug: the chain proceeds while the inner work is still running, and the inner
promise's rejection escapes the chain entirely.

**★ Why is a `.then` nested inside another `.then` a code smell?**
Because it almost always means the inner promise was not returned, so the chain does not
wait for it and cannot catch its errors. It also rebuilds the nesting promises were adopted
to remove.

**★ Is `throw err` the same as `return Promise.reject(err)` inside a handler?**
Yes for the resulting promise — both reject it with that error. They differ only in
reachability: a `throw` inside a callback you handed to something else (a `setTimeout`, a
`forEach`) is not part of the handler's execution and rejects nothing.

**★ Does `return Promise.resolve(1)` from an `async` function give a nested promise?**
No. The same adoption rule applies, so it fulfils with **1**. An `async` function always
returns a promise, and `return x` behaves exactly like returning `x` from a `then` handler.

**When is returning a value from `catch` correct?**
When you are deliberately recovering with a fallback — the chain fulfils and continues. It is
a bug when it happens by accident, e.g. `.catch((e) => log(e))`, where `log`'s `undefined`
becomes the next handler's input.

---

← Prev [02 · `then`, `catch` and `finally`](./02-then-catch-finally.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
