---
title: "06.1 · Flattening"
sidebar_label: "01 · Flattening"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises), [`Promise.prototype.then()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then). Documentation-validated.

**A chain exists because `then` returns a new promise.** Not the same promise, not `this` —
a new one, whose fate is decided by the handler. Everything a chain does follows from that
one fact plus the adoption rule from
[05 · 03](../05-promises/03-value-vs-promise.md).

MDN states it plainly:

> "The `then()` function returns a **new promise**, different from the original:"

```js
const promise = doSomething();
const promise2 = promise.then(successCallback, failureCallback);
```

> "`promise2` represents the completion not just of `doSomething()`, but also of the
> `successCallback` or `failureCallback` you passed in… **This enables creating longer
> chains of processing** where each promise represents the completion of one asynchronous
> step."

🔴 **Each link's promise represents "the previous step *and* my handler".** That is why a
throw in a handler rejects the *next* promise rather than the one you attached to, and why
the chain can be read as a pipeline.

## The flat shape

```js
doSomething()
  .then((result) => doSomethingElse(result))
  .then((newResult) => doThirdThing(newResult))
  .then((finalResult) => {
    console.log(`Got the final result: ${finalResult}`);
  })
  .catch(failureCallback);
```

Compare the callback rendering of the identical operation from
[04 · 04](../04-callbacks/04-callback-hell.md), where `failureCallback` had to be passed
three separate times and each step cost a level of indentation.

**The flatness is a consequence, not a feature.** Because each handler's return value is
adopted rather than wrapped, step 2's result is available as step 3's *argument* — at the
same level — instead of only inside a nested closure. The pyramid formed because callbacks
had no return value to sequence on; a chain has one.

## Always return the promise

MDN gives this its own section, and it is the single most consequential rule in this topic:

> "If the previous handler started a promise but did not return it, there's no way to track
> its settlement anymore, and the promise is said to be 'floating'."

```js
doSomething()
  .then((url) => {
    // Missing `return` keyword in front of fetch(url).
    fetch(url);
  })
  .then((result) => {
    // result is undefined, because nothing is returned from the previous
    // handler. There's no way to know the return value of the fetch()
    // call anymore, or whether it succeeded at all.
  });
```

With the `return`:

```js
doSomething()
  .then((url) => {
    // `return` keyword added
    return fetch(url);
  })
  .then((result) => {
    // result is a Response object
  });
```

MDN's warning about the consequence:

> "**Floating promises could be worse if you have race conditions** — if the promise from
> the last handler is not returned, the next `then` handler will be called early, and any
> value it reads may be incomplete."

Two distinct damages, and people usually only notice the first:

1. **Sequencing breaks.** The next handler runs immediately with `undefined`.
2. **Error handling breaks.** The floating promise is no longer part of the chain, so its
   rejection cannot reach the chain's `.catch` — it becomes an unhandled rejection.

The mechanical reason is the "doesn't return anything → fulfilled with `undefined`" rule from
[05 · 03](../05-promises/03-value-vs-promise.md). Nothing about chaining is special here; the
chain simply makes the consequence visible three lines later instead of immediately.

**Practical defence:** prefer concise arrow bodies, which cannot forget.

```js
.then((url) => fetch(url))        // no braces, no missing return possible
.then((url) => { return fetch(url); })   // braces — the `return` is now yours to remember
```

## A chain is sequential, never concurrent

This is worth stating explicitly because the flat, tidy shape of a chain hides it:

```js
fetchA()
  .then(() => fetchB())
  .then(() => fetchC());
```

`fetchB` does not start until `fetchA` has settled. **Three round trips, one after another.**
If the three are independent, this is a waterfall you built by accident, and the fix is a
combinator rather than a chain:

```js
Promise.all([fetchA(), fetchB(), fetchC()]).then(([a, b, c]) => { … });
```

MDN calls these the **composition** tools and lists four — `Promise.all`, `allSettled`,
`any`, `race` — covered in
[10 · The combinators](../README.md). The chain is for *dependent* steps; the combinators
are for independent ones. Choosing wrongly is
[09 · Sequential vs parallel `await`](../README.md), the topic entirely devoted to this
mistake.

### Sequential composition over a list

When the steps genuinely are sequential and you have them in an array, MDN gives the
idiom:

```js
[func1, func2, func3]
  .reduce((p, f) => p.then(f), Promise.resolve())
  .then((result3) => {
    /* use result3 */
  });
```

> "which is equivalent to:"

```js
Promise.resolve()
  .then(func1)
  .then(func2)
  .then(func3)
  .then((result3) => {
    /* use result3 */
  });
```

`Promise.resolve()` is the seed — an already-fulfilled promise to hang the first link on.
This is the standard way to run an unknown number of steps in order, and it is worth
recognising because a `reduce` over promises is otherwise cryptic on first reading.

Note the shape `p.then(f)` — passing the function **by reference**, not `p.then(() => f())`.
That works because the previous result is passed as the argument automatically, and it is
the one place where point-free style genuinely reads better here.

## Gotchas

**Symptom:** A handler receives `undefined` instead of the previous step's result
**Cause:** The previous handler had a braced body and no `return`. MDN: *"result is
undefined, because nothing is returned from the previous handler."*
**Fix:** `return` the promise, or drop the braces so the arrow returns implicitly.

**Symptom:** A step's failure never reaches the chain's `.catch` and shows as an unhandled
rejection
**Cause:** That step's promise was **floating** — started but not returned, so it is not part
of the chain.
**Fix:** Return it. MDN: *"there's no way to track its settlement anymore."*

**Symptom:** Values read in a later handler are incomplete or stale
**Cause:** MDN's race-condition warning — *"if the promise from the last handler is not
returned, the next `then` handler will be called early."*
**Fix:** Same fix. The missing `return` is almost always the cause of an "impossible" timing
bug in a chain.

**Symptom:** Three independent requests take three times as long as expected
**Cause:** They were chained. A chain is **strictly sequential** — each link waits for the
previous one to settle.
**Fix:** `Promise.all([a(), b(), c()])` for independent work. Reserve the chain for
dependent steps.

**Symptom:** A `throw` in one handler rejects a promise you did not expect
**Cause:** Each link's promise represents *"the previous step and my handler"*, so the throw
rejects the **next** promise in the chain, not the one you attached to.
**Fix:** Expected. Place `catch` after the link whose failures you mean to handle.

## Interview questions

**★ Why can promises be chained at all?**
Because `then` *"returns a new promise, different from the original"*, and that promise
represents the completion of the previous step **and** the handler. Combined with adoption —
a returned promise is flattened, not nested — each handler's result becomes the next
handler's argument at the same level.

**★ What happens if you forget to `return` inside a `then`?**
Two things. The handler fulfils with `undefined`, so the next link runs **immediately** with
the wrong value; and the started promise **floats** — MDN: *"there's no way to track its
settlement anymore"* — so its rejection cannot reach the chain's `catch` and surfaces as an
unhandled rejection instead.

**★ Is a promise chain concurrent?**
No — strictly sequential. Each link waits for the previous to settle. Independent work
belongs in `Promise.all` and friends, which MDN calls the composition tools. Chaining
independent requests is the accidental waterfall.

**★ How do you run an unknown number of async steps in order?**
MDN's reduce idiom: `[f1, f2, f3].reduce((p, f) => p.then(f), Promise.resolve())`, seeded
with an already-fulfilled promise. Equivalent to writing the `.then` chain by hand.

**Why does `.then((url) => fetch(url))` work but `.then((url) => { fetch(url); })` not?**
The concise arrow body returns implicitly; the braced one returns `undefined`. It is the
same rule, and it is why concise bodies are the safer default in a chain.

---

[Topic index](./README.md) · Next → [02 · Error propagation](./02-error-propagation.md)
