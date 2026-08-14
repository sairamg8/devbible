---
title: "04.3 · Inversion of control"
sidebar_label: "03 · Inversion of control"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises), [Callback function](https://developer.mozilla.org/en-US/docs/Glossary/Callback_function). Documentation-validated.

**This is the real problem with callbacks, and it is not the one everybody names.** The
indentation of [callback hell](./04-callback-hell.md) is cosmetic — you can flatten it in
ten minutes and fix nothing. What actually breaks is underneath: **you handed control of
your own continuation to someone else's code, and the language gives you no way to hold
them to anything.**

## The inversion

Recall MDN's framing of the two roles from [chunk 01](./01-the-pattern.md):

> "The provider of the API (called the *caller*) takes the function and calls back (or
> executes) the function at some point inside the caller's body. **The caller is
> responsible for passing the right parameters** into the callback function."

Normally *you* are in control: you call a function, it returns, you continue. With a
callback that flips. **The rest of your program is now a function in a third party's
hands**, and they decide its fate.

That is the trade. These are the ways it breaks — none of which the language prevents:

| The caller might… | What you get |
|---|---|
| call it **too early** (synchronously) | state read before it was set — the "Zalgo" problem |
| call it **too late** | a spinner that spins forever; a timeout that never fires |
| **never** call it | your continuation silently dropped, no error anywhere |
| call it **more than once** | a payment charged twice, a listener stacked, a counter doubled |
| call it with **wrong arguments** | `undefined` propagating into unrelated code |
| **swallow** an error your callback threw | a failure that leaves no trace at all |

🔴 **None of these produce an exception. Every one of them fails silently**, which is why
they are found late and debugged badly. A crash tells you where to look; a callback that
was never called tells you nothing at all.

## Called too early — the one MDN documents

MDN names this failure directly, while explaining what promises are for:

> "Callbacks added with `then()` will never be invoked before the completion of the current
> run of the JavaScript event loop. This prevents the **'Zalgo' state problem** where
> callbacks might be called synchronously in some cases but asynchronously in others."

Read that as a statement about raw callbacks: **they carry no such guarantee**, and a
promise is partly *defined* by supplying one. Chunk 02 covers the producer-side fix
(`queueMicrotask` on the fast path); the point here is that as a **consumer** you cannot fix
it, cannot detect it from the call site, and are simply trusting that the author thought
about it.

## Called more than once — the expensive one

```js
function charge(order, cb) {
  gateway.submit(order, (err, receipt) => {
    if (err) cb(err);          // ⚠️ no return
    cb(null, receipt);         // runs on the error path too
  });
}
```

The missing `return` from [chunk 02](./02-error-first.md), seen from the other side: the
consumer's callback is invoked **twice** on failure — once with an error, once with
`undefined` as the receipt. If that callback sends a confirmation email, two go out. If it
increments a retry counter, the count is wrong. And the producer's own tests, which
probably assert on the happy path, pass.

Defending against it from the consumer side is possible, and how ugly it is tells you how
weak the contract is:

```js
function once(fn) {
  let called = false;
  return (...args) => {
    if (called) return;
    called = true;
    fn(...args);
  };
}

charge(order, once((err, receipt) => { /* … */ }));
```

**That `once` wrapper is exactly what a promise gives you for free.** A promise settles once
and stays settled — no wrapper, no flag, and a second `resolve()` is simply ignored by the
specification rather than by your discipline.

## Never called — the invisible one

```js
function load(id, cb) {
  if (!cache.ready) return;        // ⚠️ caller waits forever
  …
}
```

There is no diagnostic for this. The operation does not fail, it does not succeed, and
nothing is logged. The user sees a spinner. In a request handler it is worse — the response
is never sent, the socket stays open, and the leak is a slow one.

A promise does not prevent the bug, but it **makes it visible**: a promise that never
settles is a pending promise you can inspect, race against a timeout, or catch with an
unhandled-rejection style audit. A callback that was never called leaves no object behind at
all.

## What promises actually buy

The three guarantees MDN lists, each answering a row from the trust table:

> 1. "Callbacks added with `then()` will never be invoked before the completion of the
>    current run of the JavaScript event loop."
> 2. "These callbacks will be invoked even if they were added **after** the success or
>    failure of the asynchronous operation."
> 3. "Multiple callbacks may be added by calling `then()` several times. They will be
>    invoked one after another, in the order in which they were inserted."

- **Guarantee 1 kills *too early*.** Ordering stops depending on which branch the callee took.
- **Guarantee 2 kills a race a callback API cannot even express.** With a raw callback you
  must register **before** the operation finishes, because there is nowhere for a late
  listener to attach. A promise holds its settled value and hands it to whoever asks,
  whenever they ask.
- **Guarantee 3 replaces the single callback slot with a list**, in insertion order — so two
  independent parts of the program can both await the same operation.

And the fourth, which MDN states as the nature of the object rather than as a numbered
guarantee: a promise represents *"the eventual completion or failure"* of an operation and
**settles once**, which is the `once` wrapper made structural.

🔴 **The honest summary: promises did not fix nesting, they fixed the contract.** The
flatter syntax of a chain is a consequence of `then()` returning a new promise, not the
purpose of it. That is worth being precise about, because "promises fix callback hell" is
the answer that gets given in interviews and it is the shallow half of the truth.

## Gotchas

**Symptom:** A confirmation fires twice, but only when the operation fails
**Cause:** The callback was invoked more than once — usually `if (err) cb(err);` without a
`return`, falling through into the success call.
**Fix:** `return` on every error branch. Wrap with `once()` at the boundary of an API you do
not control, or use a promise, which can only settle once.

**Symptom:** An operation neither completes nor errors — a spinner spins forever, a response
is never sent
**Cause:** A path through the callee that never invokes the callback at all. Nothing in the
language requires it to.
**Fix:** Race a timeout at the call site. Prefer an API returning a promise, where "never
settles" is at least an inspectable pending object.

**Symptom:** A late listener never receives a result that already arrived
**Cause:** A raw callback must be registered **before** the operation finishes — there is no
slot to attach to afterwards.
**Fix:** Use a promise. MDN's guarantee 2: callbacks *"will be invoked even if they were
added after the success or failure"*.

**Symptom:** Only one part of the program can react to an operation
**Cause:** A callback API has a single callback slot; passing a second one replaces or is
ignored.
**Fix:** A promise accepts multiple `then()` handlers, *"invoked one after another, in the
order in which they were inserted"*.

**Symptom:** Ordering changed after an unrelated caching change
**Cause:** The callee became synchronous on the hot path — "Zalgo". The consumer cannot see
this from the call site.
**Fix:** Producer side, defer with `queueMicrotask`. Consumer side, wrap the API so it
returns a promise, which guarantees the deferral.

## Interview questions

**★ What is "inversion of control" in the context of callbacks?**
You hand the rest of your program to someone else's function, and they decide when, how
often, and with what arguments it runs. The failure modes — too early, too late, never,
twice, wrong arguments, swallowed errors — are **all silent**, and the language enforces
none of the contract. This is the real problem with callbacks; the nesting is cosmetic.

**★ Do promises fix callback hell?**
They fix the **contract**, and flatter code follows from it. MDN's three guarantees: never
invoked before the current event-loop run completes (kills "Zalgo"), invoked even if
attached *after* settling, and multiple handlers in insertion order — plus settling exactly
once. The flat chain is a side effect of `then()` returning a new promise.

**★ Why is "the callback was never called" such a bad failure?**
Because it produces no error, no log and no object. The operation neither succeeds nor
fails. A promise does not prevent it but makes it **visible** — a pending promise can be
inspected or raced against a timeout.

**★ Write a guard against a callback being invoked twice.**
A `once` wrapper holding a `called` boolean that returns early on the second invocation.
Then note that this is precisely what a promise provides structurally, since a promise
settles once and later settlement attempts are ignored.

**Why can't a raw callback be attached after the operation finishes?**
There is nowhere to attach it — the callee holds one slot and has already used it. A promise
retains its settled value, which is MDN's guarantee 2 and the reason two independent
consumers can both await the same in-flight request.

---

← Prev [02 · The error-first convention](./02-error-first.md) · [Topic index](./README.md) · Next → [04 · Callback hell](./04-callback-hell.md)
