---
title: "06.2 · Error propagation"
sidebar_label: "02 · Error propagation"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises), [`Promise.prototype.then()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then). Documentation-validated.

**A chain propagates errors the way a `try` block does, and that is the explicit design
goal.** MDN sets the two side by side:

> "If there's an exception, the browser will look down the chain for `.catch()` handlers or
> `onRejected`. **This is very much modeled after how synchronous code works:**"

```js
try {
  const result = syncDoSomething();
  const newResult = syncDoSomethingElse(result);
  const finalResult = syncDoThirdThing(newResult);
  console.log(`Got the final result: ${finalResult}`);
} catch (error) {
  failureCallback(error);
}
```

> "This symmetry with asynchronous code culminates in the `async`/`await` syntax."

And the promise equivalent:

```js
doSomething()
  .then((result) => doSomethingElse(result))
  .then((newResult) => doThirdThing(newResult))
  .then((finalResult) => console.log(`Got the final result: ${finalResult}`))
  .catch(failureCallback);
```

MDN's summary of what that buys:

> "Promises solve a fundamental flaw with the callback pyramid of doom, by **catching all
> errors, even thrown exceptions and programming errors**."

🔴 **"Even programming errors" is the part worth pausing on.** A `TypeError` from a typo in
handler two is caught by the same `.catch` that catches a network failure in step one. In
the callback version, that `TypeError` would have escaped to `uncaughtException` — which is
the strongest single argument for the chain.

## There is no propagation mechanism

It looks like a rule but it is not one. From
[05 · 02](../05-promises/02-then-catch-finally.md): a `then` whose `onRejected` is not a
function gets the default `(x) => { throw x; }`. So a rejection arriving at a `.then(fn)`
is re-thrown, rejecting that link's promise, which arrives at the next `.then(fn)`, which
re-throws it…

**"Skipping to the catch" is that default handler firing once per link.** Which means the
mental model is exact: a rejection walks the chain link by link until something supplies a
real `onRejected`.

Two consequences fall straight out:

**A `.then` with two arguments does not catch its own handler's throw.**

```js
doSomething().then(
  (v) => { throw new Error("boom"); },   // this throw…
  (e) => handle(e),                      // …is NOT caught here
);
```

The rejection handler belongs to `doSomething()`, not to the fulfilment handler beside it.
A trailing `.catch` does catch it, because it is attached to the *next* promise:

```js
doSomething()
  .then((v) => { throw new Error("boom"); })
  .catch((e) => handle(e));              // ✅ catches it
```

🔴 **`.then(fn, onErr)` and `.then(fn).catch(onErr)` are not equivalent.** The two-argument
form handles only upstream failures; the trailing `catch` also handles failures in `fn`
itself. Prefer the trailing `catch` unless you specifically want to exclude the handler.

**A `catch` only sees what is upstream of it.** A `catch` in the middle of a chain cannot
catch anything that happens after it:

```js
fetchData()
  .catch(handleFetchError)      // only fetchData's failures
  .then((d) => render(d));      // a throw here reaches nothing — unhandled rejection
```

## Chaining after a `catch`

Because handling restores the chain ([05 · 02](../05-promises/02-then-catch-finally.md)),
work can continue after a failure. MDN's example:

```js
doSomething()
  .then(() => {
    throw new Error("Something failed");

    console.log("Do this");
  })
  .catch(() => {
    console.error("Do that");
  })
  .then(() => {
    console.log("Do this, no matter what happened before");
  });
```

MDN's stated output:

```
Do that
Do this, no matter what happened before
```

> "Note that the text 'Do this' is not displayed because the 'Something failed' error caused
> a rejection."

This is the promise form of "recover and carry on". The final `.then` runs on **both** paths
— the success path where the `catch` was skipped, and the failure path where the `catch`
handled it and fulfilled. If you want something to run on both paths *without* claiming to
have handled anything, that is `finally`, in [chunk 03](./03-finally-and-timing.md).

## Nesting on purpose — scoping a `catch`

Flat is the default, but MDN documents the one case where nesting is the right answer:

> "Nesting is a control structure to limit the scope of `catch` statements. Specifically, a
> nested `catch` only catches failures in its scope and below, not errors higher up in the
> chain outside the nested scope."

```js
doSomethingCritical()
  .then((result) =>
    doSomethingOptional(result)
      .then((optionalResult) => doSomethingExtraNice(optionalResult))
      .catch((e) => {}),
  ) // Ignore if optional stuff fails; proceed.
  .then(() => moreCriticalStuff())
  .catch((e) => console.error(`Critical failure: ${e.message}`));
```

MDN's explanation:

> "the inner error-silencing `catch` handler only catches failures from
> `doSomethingOptional()` and `doSomethingExtraNice()`, after which the code resumes with
> `moreCriticalStuff()`. **Importantly, if `doSomethingCritical()` fails, its error is
> caught by the final (outer) `catch` only, and does not get swallowed by the inner `catch`
> handler.**"

That last sentence is the whole point: a flat chain with a mid-chain `catch` would swallow
the *critical* error too. Nesting is how you say "these two steps are allowed to fail".

But MDN immediately fences it in:

> "**If you don't have sophisticated error handling, you very likely don't need nested
> `then` handlers.** Instead, use a flat chain and put the error handling logic at the end."

🔴 **Nesting is a deliberate scoping tool, not a style.** Nesting because you forgot to
return ([chunk 01](./01-flattening.md)) is the bug; nesting to scope a `catch` is the
feature. They look identical in a diff, which is exactly why the distinction is worth
knowing — and why a comment on the inner `catch` earns its place.

The `async`/`await` rendering makes the scoping visible as ordinary nested `try` blocks,
which is MDN's own comparison:

```js
async function main() {
  try {
    const result = await doSomethingCritical();
    try {
      const optionalResult = await doSomethingOptional(result);
      await doSomethingExtraNice(optionalResult);
    } catch (e) {
      // Ignore failures in optional steps and proceed.
    }
    await moreCriticalStuff();
  } catch (e) {
    console.error(`Critical failure: ${e.message}`);
  }
}
```

## Where to put the `catch`

A short decision rule:

| Intent | Placement |
|---|---|
| handle any failure in the whole operation | **one `catch` at the end** — the default |
| let two optional steps fail without killing the operation | **nested `catch`** around just those steps |
| handle upstream failures but let this handler's own throws propagate | `.then(fn, onErr)` — the two-argument form |
| recover with a fallback value and continue | `catch` returning a value, mid-chain, deliberately |

**And one rule with no exceptions: every chain ends in a `catch` or is returned to someone
who provides one.** A chain that ends in a bare `.then` is a floating promise at the top
level, and its rejections go to the unhandled-rejection handler — the subject of
[08 · Error handling in async code](../README.md).

## Gotchas

**Symptom:** A `TypeError` from a bug in a handler is caught by the network-error `catch`
**Cause:** By design. MDN: promises catch *"all errors, even thrown exceptions and
programming errors"*.
**Fix:** Expected, and a feature. If you need to distinguish, inspect the error type inside
the `catch` rather than adding more `catch` clauses.

**Symptom:** `.then(onOk, onErr)` did not catch an error thrown by `onOk`
**Cause:** `onErr` handles rejections of the **upstream** promise, not of `onOk`, which
rejects the *next* promise.
**Fix:** Use `.then(onOk).catch(onErr)` unless excluding the handler is deliberate.

**Symptom:** An error after a mid-chain `catch` becomes an unhandled rejection
**Cause:** A `catch` only sees what is **upstream** of it.
**Fix:** Put the general `catch` at the end. Mid-chain `catch` is for recovery, not for
coverage.

**Symptom:** A mid-chain `catch` swallowed a critical error it was never meant to see
**Cause:** A flat `catch` catches everything upstream, including steps you did not intend to
make optional.
**Fix:** MDN's nesting pattern — put the tolerant `catch` **inside** a handler, scoped to
just the optional steps.

**Symptom:** Code after a `catch` runs even though the operation failed
**Cause:** Handling **restores** the chain; the `catch` fulfilled. MDN's own example prints
*"Do this, no matter what happened before"*.
**Fix:** Re-throw from the `catch` if the failure should stop the chain.

**Symptom:** A rejection appears to skip several handlers
**Cause:** It does not skip — each `then` without a rejection handler re-throws it via the
default `(x) => { throw x; }`.
**Fix:** Expected. It is the same walk a synchronous exception makes up the call stack.

## Interview questions

**★ How do errors propagate down a promise chain?**
Link by link. Each `then` without an `onRejected` gets the default thrower
`(x) => { throw x; }`, so the rejection rejects that link's promise and moves on. MDN frames
the whole design as *"modeled after how synchronous code works"*, culminating in
`async`/`await`.

**★ What does a promise chain catch that a callback pyramid does not?**
MDN: *"all errors, even thrown exceptions and programming errors."* A `TypeError` in a
handler lands in the same `.catch` as a network failure; in the callback version it would
escape to `uncaughtException`.

**★ Is `.then(f, g)` the same as `.then(f).catch(g)`?**
No. In the two-argument form, `g` handles only **upstream** rejections — a throw inside `f`
is not caught by it, because that throw rejects the next promise. The trailing `catch`
catches both. Prefer the trailing form unless the exclusion is intentional.

**★ When should a chain be nested rather than flat?**
Only to **scope a `catch`**. MDN: *"a nested `catch` only catches failures in its scope and
below"* — the pattern for letting optional steps fail while a critical failure still reaches
the outer handler. MDN adds that without sophisticated error handling *"you very likely
don't need nested `then` handlers"*.

**★ Does the chain stop after a `catch`?**
No — handling restores it. MDN's example prints *"Do that"* then *"Do this, no matter what
happened before"*. Re-throw from the `catch` if you want the failure to keep propagating.

**Where should the `catch` go?**
At the end, as the default — one handler for the whole operation. Mid-chain `catch` means
"recover here and continue", and a nested one means "these steps may fail". Every chain must
end in a `catch` or be returned to a caller that supplies one.

---

← Prev [01 · Flattening](./01-flattening.md) · [Topic index](./README.md) · Next → [03 · `finally` and timing](./03-finally-and-timing.md)
