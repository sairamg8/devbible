---
title: "08.1 · try/catch around await"
sidebar_label: "01 · try/catch around await"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`await`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await), [`async function`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function), [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises). Documentation-validated.

**`await` is what reconnects asynchronous failures to the exception channel.** From
[04 · 02](../04-callbacks/02-error-first.md), a callback cannot throw at its caller because
the stack is gone. `await` puts the continuation back into the same function, so an ordinary
`try` block works again — and MDN describes exactly this as the point of the syntax:

> "This symmetry with asynchronous code culminates in the `async`/`await` syntax."

```js
try {
  const user = await getUser(id);      // a rejection here becomes a throw
  render(user);
} catch (e) {
  report(e);
}
```

A rejected promise that is `await`ed **throws at the `await`**. That is the whole mechanism.

## What the `try` block does and does not cover

The rule is narrow and worth stating exactly: **`try` catches what is `await`ed inside it,
plus any synchronous throw inside it.** Everything else is outside.

### It does not catch a call you forgot to `await`

```js
try {
  getUser(id);              // ⚠️ not awaited — returns a promise, does not throw
} catch (e) {
  // never runs; the rejection floats
}
```

This is the [07 · 01](../07-async-await/01-always-a-promise.md) rule from the other side: an
`async` function returns a rejected promise rather than throwing. Without the `await` there
is nothing for `catch` to catch, and the rejection becomes unhandled
([chunk 03](./03-unhandled-rejections.md)).

🔴 **A missing `await` silently disables the `try` around it.** It is invisible in review
because the code looks correct.

### `return` inside `try` is the subtle case

```js
async function load(id) {
  try {
    return getUser(id);          // ⚠️ returns the promise WITHOUT awaiting it
  } catch (e) {
    return null;                 // never runs for a getUser rejection
  }
}
```

The promise is returned to the caller, and the `try` block exits before it settles — so the
rejection surfaces in the *caller*, not here. If you want the local `catch` to see it, you
must `return await`:

```js
    return await getUser(id);    // ✅ the catch can see the rejection
```

**This is the one place `return await` is not redundant.** Outside a `try`, `return p` and
`return await p` behave the same (adoption, [05 · 03](../05-promises/03-value-vs-promise.md))
and `return await` merely costs a tick — which is why linters flag it. Inside a `try`, they
are genuinely different, and the lint rule has an exception for exactly this case.

### It does not catch errors in callbacks you pass elsewhere

```js
try {
  items.forEach(async (item) => {
    await process(item);         // ⚠️ rejections here reach nothing
  });
} catch (e) {}
```

`forEach` discards the returned promises ([07 · 03](../07-async-await/03-reading-the-ordering.md)),
so nothing is awaited in the `try` and every rejection floats. `for...of` fixes it, because
the `await` is then genuinely inside the block.

## Catching at the right level

The most common structural mistake is a `try`/`catch` around every `await`:

```js
async function checkout(cart) {
  let user;
  try { user = await getUser(cart.userId); } catch (e) { report(e); }
  let total;
  try { total = await price(cart); } catch (e) { report(e); }   // runs with user undefined
  return await charge(user, total);
}
```

Every `catch` here **swallows** and continues, so a failure in step one produces a confusing
failure in step three. This is the `if (err)`-without-`return` bug from
[04 · 02](../04-callbacks/02-error-first.md) wearing different syntax.

One `try` around the operation is almost always right, because the steps form one unit of
work:

```js
async function checkout(cart) {
  try {
    const user = await getUser(cart.userId);
    const total = await price(cart);
    return await charge(user, total);
  } catch (e) {
    report(e);
    throw e;                     // let the caller decide what the failure means
  }
}
```

Narrow the scope only when a step is genuinely **optional** — the same reasoning as MDN's
nested-`catch` pattern in [06 · 02](../06-chaining/02-error-propagation.md), where an inner
handler exists specifically so that optional steps may fail without killing the operation.

## `finally` behaves normally here

Unlike `Promise.prototype.finally` ([06 · 03](../06-chaining/03-finally-and-timing.md)), a
`finally` **block** is ordinary language semantics: it runs on both paths, and a `return` or
`throw` inside it overrides the outcome exactly as in synchronous code.

```js
async function withLock(fn) {
  await lock.acquire();
  try {
    return await fn();
  } finally {
    await lock.release();        // runs on success and on failure
  }
}
```

Note `await` inside `finally` is allowed and often necessary — cleanup is frequently
asynchronous. And note the `return await` again: without it, `fn()`'s rejection would escape
the `try`, and worse, the lock would be released **before** the work finished.

## Distinguishing failures

Once errors arrive as exceptions, ordinary techniques apply — but one async-specific point
matters: **a `catch` around an `await` catches everything**, including programming errors,
exactly as a chain's `.catch` does ([06 · 02](../06-chaining/02-error-propagation.md)). A
`TypeError` from a typo lands in the same handler as a network failure.

```js
} catch (e) {
  if (e instanceof HttpError && e.status === 404) return null;   // expected
  throw e;                                                        // everything else
}
```

🔴 **Re-throw what you did not specifically handle.** A `catch` that handles every error
identically turns a bug into a silent wrong answer, and this is far easier to do with
`try`/`catch` than with a chain, because the block form invites putting recovery logic in it.

## Gotchas

**Symptom:** `try`/`catch` around an async call catches nothing
**Cause:** The call was not `await`ed. An `async` function returns a **rejected promise**; it
does not throw.
**Fix:** `await` it inside the `try`, or attach `.catch()`.

**Symptom:** A rejection surfaces in the caller instead of the local `catch`
**Cause:** `return somePromise` inside a `try` — the block exits before the promise settles.
**Fix:** `return await somePromise`. This is the one case where `return await` is not
redundant.

**Symptom:** A lock or connection is released before the work using it finishes
**Cause:** `return fn()` inside a `try`/`finally` — the `finally` runs as soon as the promise
is *returned*, not when it settles.
**Fix:** `return await fn()`.

**Symptom:** Later steps run with `undefined` after an earlier step failed
**Cause:** A `try`/`catch` per `await`, each swallowing and continuing.
**Fix:** One `try` around the whole operation. Narrow the scope only for genuinely optional
steps.

**Symptom:** A rejection inside a `forEach(async …)` reaches no `catch`
**Cause:** `forEach` discards the returned promise, so nothing is awaited inside the `try`.
**Fix:** `for...of` with `await`, or `await Promise.all(arr.map(fn))`.

**Symptom:** A typo's `TypeError` is reported as a network failure
**Cause:** The `catch` treats every error the same.
**Fix:** Match the errors you expect and **re-throw the rest**.

## Interview questions

**★ Why does `try`/`catch` work with `await` but not with callbacks?**
Because `await` puts the continuation back inside the same function, so the failure arrives
as a throw on a stack the `try` block is still on. A callback runs later on a fresh stack,
with the `try` long gone. MDN frames `async`/`await` as the culmination of promises' *"symmetry
with … synchronous code"*.

**★ Why doesn't this catch anything?** `try { doAsyncThing(); } catch (e) {}`
Because the call was not awaited. An `async` function returns a **rejected promise**, and a
promise is not a throw. The rejection floats and becomes unhandled.

**★ When is `return await` not redundant?**
**Inside a `try` block.** `return p` hands the promise to the caller and exits the block, so
the local `catch`/`finally` never sees the rejection; `return await p` keeps it inside. The
same applies to `try`/`finally` around a resource — without the `await`, cleanup runs before
the work finishes.

**★ Should you put a `try`/`catch` around every `await`?**
No. That is the `if (err)`-without-`return` bug in new syntax — each handler swallows and
lets execution continue with a missing value. One `try` around the operation, narrowed only
where a step is genuinely optional.

**★ Does a `catch` around an `await` catch programming errors too?**
Yes — a `TypeError` in the code lands in the same handler as a network failure. So match the
errors you expect and **re-throw the rest**, otherwise a bug becomes a silent wrong answer.

**Does `await` work inside a `finally` block?**
Yes, and it is often required, since cleanup is frequently asynchronous. A `finally` *block*
follows ordinary language semantics, unlike `Promise.prototype.finally`, whose return value
is ignored.

---

[Topic index](./README.md) · Next → [02 · Rejections that vanish](./02-rejections-that-vanish.md)
