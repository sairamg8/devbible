---
title: "04.4 · Callback hell"
sidebar_label: "04 · Callback hell"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Introducing asynchronous JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Async_JS/Introducing), [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises). Documentation-validated.

**The famous problem, and the least important one.** [Chunk 03](./03-inversion-of-control.md)
covered what actually breaks. This chunk covers what everybody *names* — and, more usefully,
**why the nesting is forced** rather than being a discipline failure, and why the popular fix
does not fix it.

## The pyramid

MDN's example of sequencing three steps:

```js
function doStep1(init, callback) {
  const result = init + 1;
  callback(result);
}

function doStep2(init, callback) {
  const result = init + 2;
  callback(result);
}

function doStep3(init, callback) {
  const result = init + 3;
  callback(result);
}

function doOperation() {
  doStep1(0, (result1) => {
    doStep2(result1, (result2) => {
      doStep3(result2, (result3) => {
        console.log(`result: ${result3}`);
      });
    });
  });
}

doOperation();
```

MDN's verdict:

> "Because we have to call callbacks inside callbacks, we get a deeply nested
> `doOperation()` function, which is much harder to read and debug. This is sometimes
> called **'callback hell'** or the **'pyramid of doom'** (because the indentation looks
> like a pyramid on its side)."

## Why it forms, mechanically

**Because a callback-based function has no return value to sequence on.**

Step 2 needs step 1's result. The only place that result exists is *inside* step 1's
callback — it is a parameter of that function and nothing outside can see it. So step 2 must
be written there. Step 3 needs step 2's result, so it goes inside step 2's callback.

**Each dependency costs exactly one level of indentation, and there is nowhere else to put
it.**

Contrast a synchronous pipeline, where each step hands its value *back* to the caller and
the code stays flat:

```js
const a = step1(0);
const b = step2(a);
const c = step3(b);       // flat, because every step RETURNS
```

🔴 **Nesting is not sloppiness. It is the direct consequence of results being delivered by
call instead of by return.** That framing matters, because it tells you what a real fix has
to do: give the operation a **return value** that represents the eventual result. That value
is a promise.

## The part that actually hurts

MDN, in the same section:

> "When we nest callbacks like this, it can also get very hard to handle errors: often you
> have to handle errors at each level of the 'pyramid', instead of having error handling
> only once at the top level."

This is the real cost, and it is worse than that sentence suggests. With error-first
callbacks the pyramid grows an `if (err)` at **every** level:

```js
doStep1(0, (err1, result1) => {
  if (err1) return done(err1);
  doStep2(result1, (err2, result2) => {
    if (err2) return done(err2);          // repeated
    doStep3(result2, (err3, result3) => {
      if (err3) return done(err3);        // repeated again
      done(null, result3);
    });
  });
});
```

Three near-identical error branches, each of which must remember to `return`, and **any one
of them omitted leaves a path where the operation neither completes nor reports** — the
invisible failure from chunk 03. MDN's version without error handling is the *optimistic*
picture of this code.

The promise form MDN gives for the same shape collapses that from one branch per level to a
single terminal clause:

```js
doSomething()
  .then((result) => doSomethingElse(result))
  .then((newResult) => doThirdThing(newResult))
  .then((finalResult) => {
    console.log(`Got the final result: ${finalResult}`);
  })
  .catch(failureCallback);
```

**One `.catch` covers the whole chain**, because a rejection propagates down it. Compare
MDN's callback rendering of the identical operation, where `failureCallback` is passed three
separate times:

```js
doSomething(function (result) {
  doSomethingElse(result, function (newResult) {
    doThirdThing(newResult, function (finalResult) {
      console.log(`Got the final result: ${finalResult}`);
    }, failureCallback);
  }, failureCallback);
}, failureCallback);
```

That is the substance of [06 · Chaining](../README.md), later in this phase.

## Flattening with named functions is not the fix

The usual first suggestion — hoist each callback into a named function — does remove the
indentation:

```js
function onStep1(err, r1) { if (err) return done(err); doStep2(r1, onStep2); }
function onStep2(err, r2) { if (err) return done(err); doStep3(r2, onStep3); }
function onStep3(err, r3) { if (err) return done(err); done(null, r3); }

doStep1(0, onStep1);
```

It reads better in a diff and worse in your head:

- **The sequence is now invisible.** Four top-level functions with no ordering between them;
  you recover the order by tracing names.
- **You lose the closure.** In the nested version `onStep3` could see `result1`. Here it
  cannot, so any value needed later must be threaded manually through every intermediate
  step — usually by widening each callback's signature or smuggling a mutable object along.
- **The per-level `if (err) return done(err)` is still there**, once per function.

🔴 **And it fixes none of the trust problems from chunk 03.** Called twice, called never,
called synchronously — all still possible. That is the tell that indentation was never the
real issue: the fix that addresses only indentation leaves every actual bug in place.

## When a callback is still the right answer

Reaching for a promise is not automatically correct. Promises are **one-shot** — they settle
once. Callbacks are not, and where the event recurs the callback is the better model:

| Use a callback when | Because |
|---|---|
| the work is **synchronous** — `map`, `filter`, `sort`'s comparator | there is nothing to await; a promise would only add a microtask tick |
| the event happens **many times** — `addEventListener`, streams, observers | a promise settles once and cannot represent a stream of events |
| you are **scheduling** — `queueMicrotask`, `requestAnimationFrame` | there is no value to resolve; you are handing over code, not requesting a result |
| you are **writing** an API that must serve both | use callbacks internally, expose a promise outward |

The rule that falls out, first stated in [chunk 01](./01-the-pattern.md): **use a promise for
"one result, later"; use a callback for "a function to run" or "many results over time".**
`async`/`await` is only ever an improvement on the first.

## Gotchas

**Symptom:** Flattening the pyramid into named functions did not make the bugs go away
**Cause:** The indentation was the symptom. The trust problems and the per-level error
handling are the disease.
**Fix:** Change the contract, not the layout — return promises.

**Symptom:** After extracting named callbacks, a later step can no longer see an earlier
result
**Cause:** Extraction destroyed the closure the nesting provided.
**Fix:** Thread the value explicitly, or use a promise chain, where each `then` receives the
previous value as its argument.

**Symptom:** An error in a middle step of a nested chain vanishes entirely
**Cause:** One level's `if (err)` was omitted, or lacked its `return`, so the failure was
neither propagated nor completed. MDN: *"you have to handle errors at each level of the
pyramid"*.
**Fix:** A promise chain with a single terminal `.catch`, which receives rejections from
every step.

**Symptom:** The same `failureCallback` is passed at three different nesting levels
**Cause:** Callback APIs have no propagation — each level must be told about failure
separately.
**Fix:** One `.catch()` at the end of a chain replaces all of them.

**Symptom:** Converting a many-shot event source to a promise loses every event after the
first
**Cause:** A promise settles **once**.
**Fix:** Keep the callback. Promises are the wrong shape for recurring events.

**Symptom:** Wrapping a synchronous `map` callback in a promise made the code slower and
harder to read
**Cause:** There was nothing asynchronous to model; the promise only added a microtask tick
and a layer.
**Fix:** Synchronous callbacks stay callbacks.

## Interview questions

**★ What is callback hell, and why does it actually form?**
MDN: *"we get a deeply nested `doOperation()` function… sometimes called 'callback hell' or
the 'pyramid of doom'."* It forms because **a callback API returns nothing to sequence on** —
step 2 needs step 1's result, which exists only inside step 1's callback, so it must be
written there. One dependency, one level of nesting. It is forced by the shape of the API,
not by poor style.

**★ What is the worst part of nesting — the indentation?**
No. MDN: *"it can also get very hard to handle errors: often you have to handle errors at
each level of the 'pyramid', instead of having error handling only once at the top level."*
Every level needs its own `if (err) return`, and a single omission creates a path that
neither completes nor reports.

**★ Why doesn't extracting named functions solve it?**
It removes indentation and nothing else. The sequence becomes invisible across several
top-level functions, you lose the closure over earlier results and must thread them
manually, the per-level error branch remains, and every trust problem — called twice, called
never, called synchronously — is untouched.

**★ Is a callback always worse than a promise?**
No. Promises are one-shot. For synchronous work (`map`, a `sort` comparator), many-shot
events (`addEventListener`, streams) and pure scheduling (`queueMicrotask`,
`requestAnimationFrame`), the callback is the correct model. Use a promise for
"one result, later".

**How does a promise chain fix the error handling specifically?**
A rejection propagates down the chain, so **one terminal `.catch()`** handles a failure from
any step — replacing MDN's callback version, which passes `failureCallback` separately at
every nesting level.

**What would a real fix for the pyramid have to do?**
Give the operation a **return value** representing the eventual result, so steps can be
sequenced by return rather than by call. That value is a promise, and flat chaining follows
from `then()` returning a new one.

---

← Prev [03 · Inversion of control](./03-inversion-of-control.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
