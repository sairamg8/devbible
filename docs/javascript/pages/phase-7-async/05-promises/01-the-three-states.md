---
title: "05.1 · The three states"
sidebar_label: "01 · The three states"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise), [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises). Documentation-validated.

**A promise is an object with a state machine in it, and the state machine only ever runs
forwards, once.** Almost everything promises guarantee follows from that sentence.

MDN's definition of the object:

> "A `Promise` is an object representing the eventual completion or failure of an
> asynchronous operation. Essentially, a promise is a returned object to which you attach
> callbacks, **instead of passing callbacks into a function**."

That last clause is the structural change from [04 · Callbacks](../04-callbacks/README.md).
The continuation no longer disappears into someone else's function — **you get an object
back**, and you attach to it on your own terms.

## The three states

> - "**pending**: initial state, neither fulfilled nor rejected."
> - "**fulfilled**: meaning that the operation was completed successfully."
> - "**rejected**: meaning that the operation failed."

And the word for "not pending any more":

> "A promise is said to be **settled** if it is either fulfilled or rejected, but not
> pending."

```
            ┌──────────────► fulfilled (value)
  pending ──┤                    ▲
            └──────────────► rejected (reason)
                  settled ───────┘
```

🔴 **The transition happens at most once, and it is irreversible.** A fulfilled promise can
never become rejected, a rejected one can never become fulfilled, and neither can go back to
pending. There is no `promise.reset()`, no second value, no re-arming.

This is the property that answers the entire trust table from
[04 · 03 · Inversion of control](../04-callbacks/03-inversion-of-control.md):

| Callback failure | Why a promise cannot do it |
|---|---|
| called twice | the state transition happens **once**; later settlement attempts are ignored |
| called too early | handlers are always called asynchronously (see [chunk 02](./02-then-catch-finally.md)) |
| never called | still possible — but it leaves a **pending object** you can inspect or race |
| late attach misses the result | a settled promise **keeps** its value and hands it to any later handler |

**A promise is one-shot by construction.** That is also the limit: it cannot model a stream
of events, which is why `addEventListener` is not going anywhere.

## "Resolved" is not a synonym for "fulfilled"

This is the terminology trap, and MDN calls it out explicitly:

> "The term **resolved** has a distinct meaning: this means that the promise is settled or
> 'locked-in' to match the eventual state of another promise, and further resolving or
> rejecting it has no effect."
>
> "Importantly, **resolved promises are often equivalent to fulfilled promises
> colloquially, but a resolved promise can be pending or rejected as well.**"

MDN's example:

```js
new Promise((resolveOuter) => {
  resolveOuter(
    new Promise((resolveInner) => {
      setTimeout(resolveInner, 1000);
    }),
  );
});
```

> "This promise is already **resolved** at the time it's created (because `resolveOuter` is
> called synchronously), but it is resolved **with another promise**, and therefore won't be
> **fulfilled** until 1 second later, when the inner promise fulfills."

Put plainly:

| Word | Means |
|---|---|
| **pending** | no outcome yet |
| **fulfilled** | has a value |
| **rejected** | has a reason |
| **settled** | fulfilled or rejected — the machine has stopped |
| **resolved** | its fate is **decided** — either settled, or locked onto another promise that has not settled yet |

🔴 **"Resolved" describes the decision, not the outcome.** Calling `resolve(anotherPromise)`
resolves your promise immediately while leaving it pending, because it has adopted the other
promise's eventual state. That adoption is the mechanism behind flattening, covered in
[chunk 03](./03-value-vs-promise.md).

Note also what the naming of `new Promise((resolve, reject) => …)` implies: the first
parameter is `resolve`, **not** `fulfill`, precisely because passing it a promise does not
fulfil anything.

## The state is not readable from JavaScript

There is no `promise.state`, no `promise.value`, and no synchronous way to ask whether a
promise has settled. The state is an internal slot; a devtools inspector can show it, your
code cannot.

```js
const p = fetch(url);
// p.state      → undefined. There is no such property.
// p.value      → undefined. There is no such property.
```

**The only way to read a promise's outcome is to attach a handler and be called back later**
— which necessarily means at least one microtask later, even if it settled minutes ago.

This is a deliberate design choice, not an omission. A synchronous `isSettled()` would let
you write code that behaves differently depending on timing — exactly the "Zalgo" problem
from [04 · 02](../04-callbacks/02-error-first.md) that promises exist to prevent.

The practical consequence catches everyone once:

```js
function getUser() {
  return fetch("/me").then((r) => r.json());
}

const user = getUser();
console.log(user.name);      // ⚠️ undefined — `user` is a Promise, not a user
```

**A function that returns a promise returns the promise immediately**, with the value not
yet in it. There is no unwrapping without `await` or `.then`.

## Thenables — promise is a shape, not just a class

MDN:

> "A **thenable** implements the `.then()` method, which is called with two callbacks: one
> for when the promise is fulfilled, one for when it's rejected. **Promises are thenables as
> well.**"
>
> "To interoperate with existing Promise implementations, the language allows using
> thenables in place of promises. For example, `Promise.resolve` will not only resolve
> promises, but also trace thenables."

So "is this a promise?" is the wrong question — the language asks **"does it have a callable
`then`?"** and treats anything that does as a promise. That is why code written against
jQuery deferreds or Bluebird still works with `await`.

It also means an ordinary object can be accidentally awaited:

```js
const notAPromise = {
  then(resolve) { resolve(42); },
};

// await notAPromise  → 42, because it is a thenable
```

🔴 **The failure mode is an object with an unrelated `then` property.** A data object with a
field named `then` — a config, a parsed JSON payload, an ORM row — will be *assimilated* if
it is ever returned from an async function or a `.then` handler, and the value you get back
will not be the object. It is rare, and utterly baffling when it happens.

## Gotchas

**Symptom:** A function returning a promise gives you `undefined` when you read a property
**Cause:** The call returns the **promise object**, not the value. The value does not exist
yet.
**Fix:** `await` it, or read it inside `.then`. There is no synchronous unwrap.

**Symptom:** You want to check whether a promise has finished, and cannot find the property
**Cause:** State and value are **internal slots**. There is no `promise.state` or
`promise.value` in the language.
**Fix:** Attach a handler. If you genuinely need a synchronous flag, set one yourself inside
the handler.

**Symptom:** `resolve(somePromise)` did not settle the promise
**Cause:** It **resolved** it, which is not the same as fulfilling it. MDN: *"a resolved
promise can be pending or rejected as well."* It is now locked onto the inner promise's
eventual state.
**Fix:** Expected. Wait for the inner promise; the outer settles when it does.

**Symptom:** A second `resolve()` or a `reject()` after `resolve()` had no effect
**Cause:** The transition happens **once**, and further attempts are ignored — MDN:
*"further resolving or rejecting it has no effect."*
**Fix:** Expected, and it is the guarantee that replaces the `once()` wrapper a callback API
needs.

**Symptom:** An object came back changed after being returned from an `async` function
**Cause:** It had a callable `then` property, so it was treated as a **thenable** and
assimilated.
**Fix:** Do not name a data property `then`. If you must, wrap the object —
`return { value: obj }`.

**Symptom:** A non-native promise library's object works with `await` and you expected it not to
**Cause:** `await` accepts any **thenable**, not only native promises.
**Fix:** Expected, and deliberate — it is how interoperation with older libraries works.

## Interview questions

**★ What are the states of a promise?**
**pending**, **fulfilled** and **rejected**. MDN: *"a promise is said to be settled if it is
either fulfilled or rejected, but not pending."* The transition happens **at most once** and
is irreversible — that one-shot property is what replaces the `once()` guard a callback API
needs.

**★ What is the difference between "resolved" and "fulfilled"?**
**Fulfilled** means it has a value. **Resolved** means its fate is *decided* — MDN:
*"settled or 'locked-in' to match the eventual state of another promise."* A promise
resolved **with another promise** is resolved and still **pending**, and will not fulfil
until the inner one does. That is why the executor parameter is named `resolve`, not
`fulfill`.

**★ How do you synchronously check whether a promise has settled?**
You cannot. State and value are internal slots — there is no `promise.state`. You attach a
handler and are called back at least one microtask later. This is deliberate: a synchronous
check would reintroduce timing-dependent behaviour.

**★ What is a thenable?**
Any object with a callable `then` method. MDN: *"the language allows using thenables in
place of promises"*, and `Promise.resolve` traces them. `await` accepts any thenable, which
is how non-native promise libraries interoperate — and why an object with an unrelated
`then` property gets assimilated by mistake.

**Why can't a promise replace an event listener?**
Because it settles **once**. An event source produces many values over time; a promise
represents *"the eventual completion or failure"* of a single operation.

**What happens if you call `resolve()` twice?**
Nothing on the second call. The state machine has already transitioned, and MDN notes that
*"further resolving or rejecting it has no effect"*.

---

[Topic index](./README.md) · Next → [02 · `then`, `catch` and `finally`](./02-then-catch-finally.md)
