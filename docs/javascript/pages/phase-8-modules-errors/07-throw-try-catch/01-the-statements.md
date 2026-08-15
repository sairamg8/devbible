---
title: "01 · `throw`, `try`, `catch`"
sidebar_label: "01 · The statements"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`throw`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/throw), [`try...catch`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch), [`Error`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error), [`Error.cause`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause), [`Error.prototype.stack`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/stack), [Control flow and error handling](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling) — and ECMAScript [§ The `try` Statement](https://tc39.es/ecma262/multipage/ecmascript-language-statements-and-declarations.html#sec-try-statement). Documentation-validated; **no timings, no console blocks**.

⚠️ **The `Error` object itself is Master material** — `message`, `name`, `stack`, `cause` and
checking errors without string matching are
[03 · The `Error` object](../03-error-and-subclasses/01-the-error-object.md). **This page is the
statements**: what `throw` accepts, what `catch` can and cannot do, and the several ways the
control flow surprises people.

## `throw` accepts any value — and you should still throw an `Error`

```js
throw new Error('Order not found');   // ✅
throw 'Order not found';              // ❌ legal, and a mistake
throw { code: 404 };                  // ❌ legal, and a mistake
throw undefined;                      // ❌ legal, genuinely
```

The language places no constraint on the operand. Everything you lose by using it is practical:

| Throwing a non-`Error` costs you | Why it matters |
|---|---|
| **The stack** | there is no `.stack`, so nothing tells you where it came from |
| **`err.message`** | it is `undefined`, and every logger prints `[object Object]` or nothing |
| **`instanceof` checks** | callers cannot classify it |
| **Your error reporter** | most treat non-`Error` values as unactionable noise |
| **`cause` chaining** | there is nothing to attach a cause to |

🔴 **The one that really hurts is the stack**, because it is captured *at construction*, not at
the throw. A string thrown from deep in a call tree arrives with no information about where it
came from at all.

**Rethrow from a `catch` with the original attached** rather than replacing it:

```js
try {
  await save(order);
} catch (err) {
  throw new Error(`Could not save order ${order.id}`, { cause: err });   // ✅ both survive
}
```

`cause` is what turns a rethrow into context instead of destruction — the alternative,
`throw new Error(err.message)`, throws the original's stack away.

## `catch` catches everything thrown in its block — including your own bugs

```js
try {
  const user = await fetchUser(id);
  render(user.naem.first);          // 🔴 a typo — a TypeError
} catch (err) {
  showMessage('Could not load user');   // reports a network problem that never happened
}
```

🔴 **A `try` block that spans more than the risky operation converts your bugs into handled
errors.** The typo above is silently reclassified as a load failure, the reporter never sees it,
and the bug survives for months.

**Keep the `try` narrow:**

```js
let user;
try {
  user = await fetchUser(id);       // ✅ only the operation that can genuinely fail
} catch (err) {
  showMessage('Could not load user');
  return;
}
render(user.name.first);            // a bug here throws, as it should
```

**And rethrow what you did not mean to handle:**

```js
} catch (err) {
  if (!(err instanceof NetworkError)) throw err;   // 🔴 not mine — let it go up
  …
}
```

The narrow-`try` and rethrow-the-rest disciplines are the two halves of the same idea; the design
version of it is **09 · Failing well** *(not written yet)*.

## The optional catch binding

```js
try {
  return JSON.parse(text);
} catch {                    // ✅ no parameter — you genuinely do not need it
  return null;
}
```

Omitting `(err)` is legal and reads better than `catch (_ignored)`. **Use it only when the error
truly carries nothing you need** — a parse you are deliberately treating as "absent". If you find
yourself omitting the binding to silence a linter, that is the empty-catch smell instead.

⚠️ **An empty `catch {}` is not the same as an optional binding.** Swallowing an error with no
action and no comment is the single most expensive habit in this topic: the failure happened, the
program continued in an unknown state, and nothing recorded it.

## `catch` cannot catch what it cannot see

The `try` block's *lexical* extent is what is protected — not everything the code triggers.

```js
try {
  setTimeout(() => { throw new Error('boom'); }, 0);   // 🔴 NOT caught
} catch { }
```

By the time the callback runs, the `try` has long since exited; the throw goes to the global
handler instead. The same applies to event listeners, and — crucially — to anything asynchronous
you did not `await`:

```js
try {
  fetchUser(id);                 // 🔴 no await: the rejection escapes this try
} catch { }

try {
  await fetchUser(id);           // ✅ awaited, so the rejection lands here
} catch { }
```

🔴 **`try`/`catch` catches a rejection only through `await`.** A floating promise is not covered,
which is
[Phase 7 · 08 · Try/catch around await](../../phase-7-async/08-error-handling/01-try-catch-around-await.md)
and [Phase 7 · 11 · Floating promises](../../phase-7-async/11-anti-patterns/02-floating-promises.md).

## Errors thrown in a `catch` block are not caught by that `catch`

```js
try {
  risky();
} catch (err) {
  cleanup();                  // 🔴 if this throws, THAT error propagates and `err` is lost
  throw new Error('failed', { cause: err });
}
```

A `catch` block is ordinary code with no protection of its own. If cleanup can fail, it belongs
in `finally` — or in its own nested `try` — otherwise the second failure hides the first, which
is the diagnosis-destroying version of this bug.

## The `catch` parameter is block-scoped, and shadowing is real

```js
const err = 'outer';
try { … } catch (err) {       // a NEW binding, scoped to the catch block
  console.log(err);           // the caught error, not 'outer'
}
console.log(err);             // 'outer'
```

Harmless in isolation, and a genuine source of confusion in a long function where `err` also
exists outside. **Name nested catch parameters distinctly** — `cause`, `cleanupErr` — when there
is more than one in scope.

## Gotchas

**Symptom: the error report shows no stack.**
Cause — a string or plain object was thrown.
Fix — always `throw new Error(...)`; the stack is captured at construction.

**Symptom: a typo in the success path is reported as a network failure.**
Cause — the `try` block spans more than the operation that can fail.
Fix — narrow the `try`, and rethrow errors you did not mean to handle.

**Symptom: a thrown error inside `setTimeout` reaches the global handler despite a `try`.**
Cause — the callback runs after the `try` block exited.
Fix — handle inside the callback, or use a promise and `await` it.

**Symptom: a rejection escapes a `try`/`catch` that clearly wraps the call.**
Cause — the call was not awaited.
Fix — `await` it, or attach a `.catch`.

**Symptom: the original error disappears and a cleanup error is reported instead.**
Cause — the cleanup threw inside the `catch` block.
Fix — put cleanup in `finally`, or wrap it in its own `try`.

**Symptom: `err.message` is `undefined` in the log.**
Cause — a non-`Error` value was thrown, or an `Error` was replaced by a bare string.
Fix — throw `Error` objects and rethrow with `{ cause }`.

**Symptom: an empty `catch {}` hid a failure for months.**
Cause — the error was swallowed with no action and no record.
Fix — handle, rethrow, or at minimum log with a comment saying why it is safe to ignore.

## Interview questions

**★ Can you `throw` a string?**
Yes, and you should not. You lose the stack — captured at construction — plus `message`,
`instanceof` classification and `cause` chaining, and most reporters discard non-`Error` values.

**★ What is wrong with a large `try` block?**
It catches your own bugs alongside the failure you meant to handle, so a `TypeError` gets reported
as a network error and never reaches your error tracking. Narrow the `try`; rethrow what is not
yours.

**★ Why doesn't `try`/`catch` catch an error thrown inside `setTimeout`?**
Because the callback runs on a later task, after the `try` block has exited. Only what runs
lexically inside the block, or is `await`ed there, is covered.

**★ When is the optional catch binding right?**
When the error genuinely carries nothing you need — `catch { return null }` around a parse you are
treating as "absent". Not as a way to quiet a linter about an unused variable.

**★ What happens if a `catch` block throws?**
That error propagates and the original is lost unless you attached it as a `cause`. Put failure-prone
cleanup in `finally` or its own `try`.

**★ How do you rethrow without destroying information?**
`throw new Error('context', { cause: err })` — the new message says where you were, and `cause`
keeps the original error and its stack.

**Is the `catch` parameter scoped to the block?**
Yes, and it shadows an outer binding of the same name. Give nested catches distinct names.

---

[Topic index](./README.md) · [02 · `finally`, and what it can override](./02-finally.md) →
