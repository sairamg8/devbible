---
title: "11.3 · return await, and the small ones"
sidebar_label: "03 · return await and others"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`async function`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function), [`await`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await), [`Promise.prototype.then()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then), [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises). Documentation-validated.

**A collection of smaller mistakes, led by the one that is famously "redundant" and
sometimes essential.**

## `return await`

Outside a `try`, `return p` and `return await p` produce the same result. Adoption
([05 · 03](../05-promises/03-value-vs-promise.md)) means a returned promise is flattened
either way, so the `await` only costs a microtask tick.

```js
async function f() { return getUser(id); }         // fine
async function g() { return await getUser(id); }   // same result, one extra tick
```

That is why linters flag it — and why the rule has an exception.

🔴 **Inside a `try`, they are genuinely different.**

```js
async function load(id) {
  try {
    return getUser(id);          // ⚠️ the catch cannot see a rejection
  } catch (e) {
    return null;                 // never runs
  }
}
```

`return p` hands the promise to the caller and **exits the `try` block immediately**. The
promise settles later, outside any local scope, so the rejection surfaces in the caller.
`return await p` keeps the suspension inside the block, so the `catch` works.

The same applies to `finally`, where the consequence is worse than a missed `catch`:

```js
async function withLock(fn) {
  await lock.acquire();
  try {
    return fn();                 // ⚠️ lock released BEFORE the work finishes
  } finally {
    await lock.release();
  }
}
```

**Without the `await`, cleanup runs when the promise is *returned*, not when it settles.** A
lock released early, a connection closed under an in-flight query, a span ended before the
work it measures. This is the strongest reason to know the rule rather than deferring to the
linter.

**The rule:** drop `await` on a `return` outside `try`/`finally`; keep it inside.
(`no-return-await` was deprecated in ESLint in favour of the type-aware
`@typescript-eslint/return-await`, which understands the `try` case.)

## `async` with no `await`

```js
async function getConfig() {     // ⚠️ nothing is awaited
  return CONFIG;
}
```

Not wrong, but it wraps a synchronous value in a promise and forces every caller to `await`
it. Usually a leftover from a refactor. `require-await` flags it.

The inverse is worth stating too: **marking a pure pass-through `async` costs the promise
reference** ([07 · 01](../07-async-await/01-always-a-promise.md)) and buys nothing.

```js
async function getUser(id) { return fetchUser(id); }   // ⚠️ new reference every call
function getUser(id) { return fetchUser(id); }         // ✅ same promise
```

## Mixing `await` and `.then`

```js
const data = await fetch(url).then((r) => r.json());   // ⚠️ two idioms, one line
```

It works. It also means a reader has to track two error-handling models at once — the `.then`
chain's and the `try`/`catch`'s — and the `.then` handler's throws land in the enclosing
`try` while looking as though they belong to the chain. Pick one:

```js
const res = await fetch(url);
const data = await res.json();
```

## Calling the function instead of passing it

```js
doThing().then(handleResult());     // ⚠️ handleResult runs NOW; its return value is the handler
doThing().then(handleResult);       // ✅
```

`then` expects a function. Passing `handleResult()` calls it immediately, during the
synchronous pass, and hands `then` whatever it returned — usually `undefined`, which
[05 · 02](../05-promises/02-then-catch-finally.md) tells us is replaced by the identity
function. So the chain silently passes the value through and the "handler" ran at the wrong
time.

## `.then(fn, fn2)` where you meant `.then(fn).catch(fn2)`

From [06 · 02](../06-chaining/02-error-propagation.md): the two-argument form does **not**
catch a throw from its own fulfilment handler. Use the trailing `catch` unless excluding the
handler is deliberate.

## `await` in a loop over independent work

The waterfall, covered fully in
[09 · Sequential vs parallel `await`](../09-sequential-vs-parallel/README.md). Listed here
because it belongs on any anti-pattern list — but it is only an anti-pattern when the
iterations are independent. Pagination needs the loop.

## A `catch` that only logs

```js
.catch((e) => log(e))            // ⚠️ chain now fulfils with undefined
```

Handling **restores** the chain, so the failure becomes a successful `undefined` that
surfaces somewhere unrelated. A `catch` returns a deliberate fallback or re-throws.

## Nesting without a reason

Nesting is justified **only** to scope a `catch`, per MDN
([06 · 02](../06-chaining/02-error-propagation.md)); MDN adds that without sophisticated
error handling *"you very likely don't need nested `then` handlers"*. Nesting that came from
a forgotten `return` looks identical in a diff — which is why an intentional inner `catch`
deserves a comment saying so.

## The list, as a review checklist

| Pattern | Why it is wrong | Instead |
|---|---|---|
| `new Promise` around a promise | reimplements `then`; missing `reject` paths hang forever | return the chain |
| missing `return` / `await` | floating promise: no sequencing, no error handling | own every promise |
| `forEach(async …)` | return value discarded | `for...of` or `Promise.all(map(…))` |
| `return p` inside `try` | `catch`/`finally` never see it; cleanup runs early | `return await p` |
| `return await p` outside `try` | one wasted tick | `return p` |
| `async` with no `await` | wraps a sync value; costs the reference on a pass-through | drop `async` |
| `.then(fn())` | calls `fn` immediately | `.then(fn)` |
| `.then(f, g)` for general errors | `g` misses `f`'s throws | `.then(f).catch(g)` |
| `catch` that only logs | fulfils with `undefined` | return a fallback or re-throw |
| `await` in a loop over independent work | N sequential round trips | `Promise.all` |
| nesting without scoping a `catch` | rebuilds the pyramid | flatten |

## Gotchas

**Symptom:** A `catch` in the same function never fires for a returned call's rejection
**Cause:** `return p` exits the `try` before the promise settles.
**Fix:** `return await p`.

**Symptom:** A lock or connection is released while work is still using it
**Cause:** `return p` inside `try`/`finally` — cleanup runs at return, not at settle.
**Fix:** `return await p`. This is the costlier half of the `return await` rule.

**Symptom:** A handler ran immediately, before the promise settled
**Cause:** `.then(fn())` calls `fn` during the synchronous pass and passes its return value.
**Fix:** `.then(fn)`.

**Symptom:** A value passes through a `.then` untouched
**Cause:** The "handler" was `undefined` — often from `.then(fn())` — and a non-function
`onFulfilled` is replaced by the identity function.
**Fix:** Pass the function itself.

**Symptom:** Two calls to a pass-through function return promises that are not `===`
**Cause:** The function is marked `async`, so it creates a new promise each time.
**Fix:** Drop `async` and return the promise directly.

**Symptom:** The linter says `return await` is redundant, but removing it broke error
handling
**Cause:** It was inside a `try`. The old `no-return-await` rule did not understand that case
and was deprecated for it.
**Fix:** Use `@typescript-eslint/return-await`, which does.

## Interview questions

**★ Is `return await` an anti-pattern?**
Only outside a `try`, where it costs one tick and nothing else. **Inside a `try` it is
required**: `return p` exits the block before the promise settles, so the local `catch` never
sees the rejection — and with `try`/`finally`, cleanup runs before the work finishes,
releasing a lock or closing a connection early.

**★ What is wrong with `.then(handleResult())`?**
It calls `handleResult` immediately, during the synchronous pass, and passes its return value
to `then`. If that is `undefined`, `then` substitutes the identity function, so the chain
silently passes the value through and the handler ran at the wrong time.

**★ Why avoid marking a pure pass-through function `async`?**
It allocates a new promise on every call instead of returning the existing one, so promise
identity is lost — and it adds a tick. `Promise.resolve(p)` returns `p` itself; an `async`
function cannot.

**★ Name the anti-patterns you would look for in review.**
`new Promise` around an existing promise; a missing `return` or `await`; `forEach(async …)`;
`return p` inside a `try`; a `catch` that only logs; `.then(f, g)` used for general error
handling; `await` in a loop over independent work; and nesting that is not scoping a `catch`.

**★ Why is a logging-only `catch` an anti-pattern?**
Because handling **restores** the chain — it fulfils with `undefined`, and the failure
resurfaces as a confusing error somewhere unrelated. Return a deliberate fallback or
re-throw.

**Which of these can tooling catch?**
The floating-promise family, via `@typescript-eslint/no-floating-promises` and
`no-misused-promises`, plus `return-await` and `require-await`. They need type information —
which is much of the practical case for TypeScript in async-heavy code.

---

← Prev [02 · Floating promises](./02-floating-promises.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
