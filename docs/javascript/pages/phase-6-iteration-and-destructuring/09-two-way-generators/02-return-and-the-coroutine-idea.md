---
title: "09.2 · `return()`, cleanup and the coroutine idea"
sidebar_label: "02 · `return()`, cleanup and the coroutine idea"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Generator.prototype.return()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator/return), [`Generator.prototype.throw()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator/throw) and [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols). Documentation-validated.

`return()` is the third channel into a running generator, and the one the language itself
uses — every `break` out of a `for...of` calls it
([04.2](../04-iteration-protocols/02-making-your-own-object-iterable.md)). MDN:

> "The `return()` method acts as if a `return` statement is inserted in the generator's
> body at the current suspended position, which finishes the generator and allows it to
> perform cleanup tasks when combined with a `try...finally` block."

```js
function* gen() { yield 1; yield 2; yield 3; }

const g = gen();
g.next();          // { value: 1,     done: false }
g.return("foo");   // { value: "foo", done: true  }
g.next();          // { value: undefined, done: true }
```

The argument becomes the completion value; with no argument, `value` is `undefined`.

## `finally` gets to speak — and can even yield

This is the corner worth knowing, because it is the one case where `return()` comes back
with **`done: false`**. MDN's example:

```js
function* gen() {
  yield 1;
  try {
    yield 2;
    yield 3;
  } finally {
    yield "cleanup";
  }
}

const g2 = gen();
g2.next();                    // { value: 1, done: false }
g2.next();                    // { value: 2, done: false }

g2.return("early return");    // { value: 'cleanup', done: false }   ← not done!
g2.next();                    // { value: 'early return', done: true }
```

MDN's own description of the `done` field: it is `false` *"only happens if the `return` is
captured in a `try...finally` with more `yield` expressions in the `finally` block"* — and
the pending completion value is **preserved**, arriving on the following `next()`.

A `finally` block can also **override** the completion value outright:

```js
function* gen() {
  try { yield 1; } finally { return "cleanup"; }
}

const g = gen();
g.next();                  // { value: 1, done: false }
g.return("early return");  // { value: 'cleanup', done: true }
```

**Two practical rules follow.** Do not `yield` inside a `finally` unless you mean to
prolong a generator that is being closed — a `for...of` `break` will pull those values.
And do not `return` from a `finally` unless you intend to discard whatever completion value
the caller asked for.

On an already-finished generator, `return()` is harmless and simply reports completion:

```js
g.return();    // { value: undefined, done: true }
g.return(1);   // { value: 1, done: true }
```

## The three channels, side by side

| Method | Behaves as if… | Generator continues? |
|---|---|---|
| `next(v)` | the suspended `yield` evaluates to `v` | yes |
| `throw(e)` | `throw e` at the suspended position | **only if it catches** |
| `return(v)` | `return v` at the suspended position | **only if `finally` yields** |

All three run `finally` blocks on the way out, which is why cleanup written once in a
`finally` covers a normal end, an early `break`, an injected error and an explicit close.

## The coroutine idea — and where `async`/`await` came from

A generator that suspends, hands a *request* out, and resumes with a *result* is a
**coroutine**: a function with more than one entry point, cooperatively scheduled. Give one
a driver that understands promises and you have `async`/`await`, several years before it
existed:

```js
function run(genFn) {
  const it = genFn();
  return new Promise((resolve, reject) => {
    const step = (method, arg) => {
      let res;
      try { res = it[method](arg); } catch (e) { return reject(e); }
      if (res.done) return resolve(res.value);
      Promise.resolve(res.value).then(
        (v) => step("next", v),          // resume with the resolved value
        (e) => step("throw", e),         // inject the rejection at the yield
      );
    };
    step("next");
  });
}

run(function* () {
  const user = yield fetch("/me").then((r) => r.json());
  const orders = yield fetch(`/orders?u=${user.id}`).then((r) => r.json());
  return orders.length;
});
```

Line for line, that is `async`/`await`:

| Generator + driver | `async`/`await` |
|---|---|
| `function*` | `async function` |
| `yield promise` | `await promise` |
| `step("next", v)` on fulfilment | resumption after `await` |
| `step("throw", e)` on rejection | the `await` throwing |
| the driver returning a promise | the async function's promise |

**This is the answer to "how does `await` actually pause a function".** It does not block
the thread; the function is suspended exactly as a generator is, and a scheduler resumes it
when the promise settles ([Phase 7 · 07 · `async`/`await`](../../phase-7-async/07-async-await/README.md)).
The `then`-based driver above is why libraries like `co` existed before ES2017, and why the
transpiled output of an `async function` for an older target is a generator plus a runtime
helper.

## Where it is still used directly

- **redux-saga** — effects are yielded as plain objects, the middleware performs them. The
  testability argument from [09.1](./01-talking-back.md) is the reason.
- **State machines and interpreters** — a generator *is* a resumable program counter.
- **Parsers and protocol readers** — pause for more input, resume where you stopped.
- **Cooperative scheduling** — yield between units of work so a scheduler can interleave
  them. Note the caveat from [05.2](../05-generators/02-lazy-sequences.md): `yield` alone
  does not release the main thread; something has to actually schedule the resumption.

For everything else, use `async`/`await`. **Knowing the equivalence is the point** — it
turns `await` from magic into a mechanism you can explain, which is exactly what this Know
tier is for.

## Gotchas

**Symptom:** `return()` came back with `done: false`
**Cause:** The suspended `yield` was inside a `try` whose `finally` contains a `yield` —
MDN's documented case.
**Fix:** Expected. The completion value is preserved and arrives on the next `next()`. Do
not `yield` in a `finally` unless you mean this.

**Symptom:** The completion value passed to `return(v)` was replaced
**Cause:** A `return` inside the `finally` block overrides it.
**Fix:** Do not `return` from `finally` unless discarding the caller's value is intended.

**Symptom:** Cleanup ran twice
**Cause:** `finally` runs on the normal path *and* on `return()`/`throw()`; a `break` after
the generator already finished calls `return()` on a completed generator.
**Fix:** Make cleanup idempotent — `return()` on a completed generator is a no-op that just
reports `{ value, done: true }`.

**Symptom:** A hand-written promise driver swallowed errors
**Cause:** `it.next()` can throw synchronously (an error before the first `yield`), and a
rejection must be routed back with `it.throw(e)`, not merely logged.
**Fix:** Wrap the `it[method](arg)` call in `try/catch` and reject, exactly as in the driver
above.

**Symptom:** Yielding between units of CPU work did not keep the UI responsive
**Cause:** `yield` suspends the generator, not the thread; without a scheduler that resumes
it later, nothing yields to the browser.
**Fix:** Resume from a task/`setTimeout`/scheduler callback, or move the work to a Worker.

## Interview questions

**★ What does `generator.return(value)` do?**
It behaves as if `return value` were written at the suspended position: the generator
finishes and `{ value, done: true }` comes back. Combined with `try...finally`, it is how a
generator performs cleanup when a consumer stops early — which is what `break` in a
`for...of` triggers.

**★ Can `return()` fail to finish the generator?**
Yes, in one documented case: if the suspended `yield` is inside a `try` whose `finally`
contains a `yield`, `return()` yields that value with `done: false`, and the pending
completion value arrives on the next `next()`.

**★ How are generators related to `async`/`await`?**
`async`/`await` is a generator plus a promise-aware driver. `yield promise` corresponds to
`await promise`; the driver resumes with `next(value)` on fulfilment and `throw(error)` on
rejection, and returns a promise for the generator's completion value. Async functions
transpiled for older targets are literally this.

**★ Why does `await` not block the thread?**
Because the function is *suspended* the way a generator is, not paused in place. Its frame
is set aside and resumed by the scheduler when the promise settles, so the event loop keeps
running in between.

**What still uses two-way generators directly?**
redux-saga, state machines and interpreters, incremental parsers, and cooperative
schedulers — cases where you want the flow to be inspectable, resumable or driven by
something other than the promise machinery.

**What runs on `throw()`, `return()` and a normal finish alike?**
`finally` blocks. That is why generator cleanup is written once, in a `finally` around the
yields.

---

← Prev [Talking back](./01-talking-back.md) · [Topic index](./README.md)
