---
title: "02 · `finally`, and what it can override"
sidebar_label: "02 · finally"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`try...catch` § The `finally` block](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch#the_finally_block), [`return`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/return), [`Promise.prototype.finally()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/finally), [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) — and ECMAScript [§ The `try` Statement](https://tc39.es/ecma262/multipage/ecmascript-language-statements-and-declarations.html#sec-try-statement). Documentation-validated; **no timings, no console blocks**.

`finally` runs **whatever happens**: normal completion, a caught error, an uncaught error on its
way out, an early `return`, a `break` or a `continue`. That reliability is why it is the right
home for cleanup — and it also gives `finally` a power nothing else in the language has.

## The order, exactly

```js
function f() {
  try {
    return compute();      // 1 · compute() runs, its value is held
  } finally {
    cleanup();             // 2 · runs BEFORE the function actually returns
  }
}                          // 3 · the held value is returned
```

🔴 **The return value is evaluated before `finally` runs, but the return itself happens after.**
So `finally` can observe that a return is pending, and — as below — can replace it.

**Without a `catch`, `finally` still runs on the way out**, and the error continues to propagate
afterwards:

```js
try {
  throw new Error('boom');
} finally {
  release();               // ✅ runs; the error still propagates
}
```

That two-part form — `try`/`finally` with no `catch` — is often exactly right: *clean up, but do
not pretend to handle this.*

## The one that swallows errors

```js
function f() {
  try {
    throw new Error('boom');
  } finally {
    return 'fine';         // 🔴 the error is DISCARDED. f() returns 'fine'.
  }
}
```

🔴 **A `return` in `finally` overrides everything — including a pending exception.** The throw is
abandoned, silently, with no trace anywhere. `break` and `continue` in a `finally` inside a loop
do the same thing, and a `throw` in `finally` replaces the original error rather than chaining to
it.

| In `finally` | Effect on a pending throw or return |
|---|---|
| normal completion | ✅ nothing — the original outcome continues |
| `return x` | 🔴 **replaces it**; a pending error vanishes |
| `throw y` | 🔴 replaces the original error (attach it as `cause` if you must throw) |
| `break` / `continue` | 🔴 replaces it, inside a loop |

**Never put a control-flow statement in `finally`.** It is one of the few things in JavaScript
that is legal, occasionally deliberate, and almost always a bug — linters flag it (`no-unsafe-finally`)
precisely because the silent error loss is so hard to diagnose.

## What belongs in `finally`

Anything that must happen regardless of outcome, and cannot itself fail meaningfully:

```js
async function load(url, { signal }) {
  const ac = new AbortController();
  setBusy(true);
  try {
    return await fetch(url, { signal: AbortSignal.any([signal, ac.signal]) });
  } finally {
    ac.abort();            // release listeners and any in-flight work
    setBusy(false);        // ✅ the flag is restored on success, failure and cancellation
  }
}
```

Releasing a lock, closing a handle, clearing a timer, restoring a disabled button, aborting a
controller, decrementing a counter — all `finally` work. **Anything a `catch` would also need to
do belongs here instead**, so it is written once rather than in both paths.

⚠️ **Cleanup that can fail needs its own `try`.** A throw from `finally` replaces the real error
([the table above](#the-one-that-swallows-errors)), so wrap risky teardown:

```js
} finally {
  try { await stream.close(); } catch (closeErr) { report(closeErr); }   // ✅ never masks
}
```

## `await` inside `finally`

Legal, and it delays the return or the propagation of the error until it settles:

```js
try {
  return await work();
} finally {
  await flushMetrics();     // ⚠️ the caller waits for this too
}
```

That is sometimes what you want and often not — the caller's error arrives later than it should,
and a rejection *from* `flushMetrics` replaces the original. Prefer fire-and-forget with a
deliberate `.catch` for non-essential teardown:

```js
} finally {
  flushMetrics().catch(() => {});      // ✅ does not delay or mask the outcome
}
```

## `finally` versus `.finally()`

They are cousins, not the same thing:

| | `try`/`finally` | `promise.finally(fn)` |
|---|---|---|
| Applies to | a block of code | one promise |
| Receives the outcome | no | no — the callback takes no arguments |
| Passes the outcome through | yes | yes, **unless** the callback throws or returns a rejected promise |
| Can override the outcome | 🔴 yes, via `return` | 🔴 only by throwing |

`promise.finally(fn)` is the promise-chain equivalent: it runs on settle and passes the original
value or rejection through, so it cannot silently convert a rejection into a success the way a
`return` in `finally` can. **In `async`/`await` code, prefer the statement** — it covers the whole
block rather than one promise.

## `using`, where you have it

Explicit resource management adds `using` and `await using` declarations that call a resource's
disposal method when the scope exits — the same guarantee as `finally`, declared at the point the
resource is acquired:

```js
{
  await using handle = await open(path);   // disposed when the block exits, however it exits
  …
}
```

⚠️ **Check availability before relying on it.** It is newer than everything else on this page, and
the `finally` form remains the portable answer.

## Gotchas

**Symptom: an error disappears with no log and no stack.**
Cause — a `return` (or `break`/`continue`) in a `finally` block discarded the pending throw.
Fix — never put control flow in `finally`; enable `no-unsafe-finally`.

**Symptom: the reported error is from cleanup, not from the real failure.**
Cause — the `finally` block threw, replacing the original error.
Fix — wrap risky cleanup in its own `try`, or attach the original as `cause`.

**Symptom: the caller sees the failure noticeably late.**
Cause — an `await` in `finally` delays propagation until it settles.
Fix — do not await non-essential teardown; `.catch(() => {})` it instead.

**Symptom: a loading flag stays set after an error.**
Cause — it was cleared only on the success path.
Fix — clear it in `finally`, which runs on every exit.

**Symptom: `promise.finally(fn)` changed the resolved value.**
Cause — normally it passes through; a throw or a returned rejected promise in the callback
replaces the outcome.
Fix — keep the callback side-effect-only, and handle its own errors.

**Symptom: cleanup runs twice.**
Cause — it is in both `catch` and `finally`.
Fix — `finally` only; that is what it is for.

## Interview questions

**★ When does `finally` run?**
On every exit from the `try` (and `catch`) block: normal completion, a thrown error, an early
`return`, a `break` or a `continue`. The return value is computed first, then `finally` runs, then
the return actually happens.

**★ What does `return` inside `finally` do?**
It overrides everything, including a pending exception — the error is discarded silently. `break`,
`continue` and `throw` in `finally` do the same. It is the classic silent-error-loss bug.

**★ Is `try`/`finally` without a `catch` useful?**
Very. It means "clean up, but do not pretend to handle this": the cleanup runs and the error
continues to propagate.

**★ Where should cleanup go — `catch` or `finally`?**
`finally`, so it is written once and runs on the success path too. Anything that can itself fail
gets its own `try` so it cannot mask the real error.

**★ How does `promise.finally()` differ from a `finally` block?**
It applies to one promise, takes no arguments, and passes the original outcome through — it can
only alter the result by throwing. A `finally` block covers a whole block of code and can override
the outcome with a `return`.

**★ Should you `await` in a `finally` block?**
Only when the teardown genuinely must complete before the caller continues. Otherwise it delays
the result and its rejection can replace the real error.

**What does `using` give you that `finally` does not?**
The same guarantee declared at acquisition rather than in a separate block — where the runtime
supports it.

---

← [01 · The statements](./01-the-statements.md) · [Topic index](./README.md)
