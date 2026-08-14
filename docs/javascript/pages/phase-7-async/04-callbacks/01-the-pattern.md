---
title: "04.1 · The pattern"
sidebar_label: "01 · The pattern"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Callback function](https://developer.mozilla.org/en-US/docs/Glossary/Callback_function), [Introducing asynchronous JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Async_JS/Introducing). Documentation-validated.

**A callback is not an async feature.** It is a function you hand to someone else so they
can call it, and whether that happens now or in ten seconds is a completely separate
question — one the callback's own syntax does not answer. Almost every callback bug starts
by confusing those two things.

MDN's definition:

> "A callback function is a function passed into another function as an argument, which is
> then invoked inside the outer function to complete some kind of routine or action."

And the roles it names, which are worth keeping straight because the rest of this topic is
about the relationship between them:

> "The consumer of a callback-based API writes a function that is passed into the API. The
> provider of the API (called the *caller*) takes the function and calls back (or executes)
> the function at some point inside the caller's body. **The caller is responsible for
> passing the right parameters** into the callback function."

You write the function. **Someone else decides when it runs, how often, and what arguments
it gets.** Hold on to that sentence — it is the whole of
[chunk 03](./03-inversion-of-control.md).

## Synchronous and asynchronous callbacks look identical

MDN is explicit that there are two kinds:

> "There are two ways in which the callback may be called: *synchronous* and
> *asynchronous*. Synchronous callbacks are called immediately after the invocation of the
> outer function, with no intervening asynchronous tasks. Asynchronous callbacks are called
> at some point later, after an asynchronous operation has completed."

Here is MDN's demonstration that **the call site cannot tell which you have**:

```js
let value = 1;

doSomething(() => {
  value = 2;
});

console.log(value); // 1 or 2?
```

> "If `doSomething` calls the callback synchronously, then the last statement would log `2`
> because `value = 2` is synchronously executed; otherwise, if the callback is
> asynchronous, the last statement would log `1` because `value = 2` is only executed after
> the `console.log` statement."

The two implementations differ by one line:

```js
function doSomething(callback) {   // synchronous
  callback();
}

function doSomething(callback) {   // asynchronous
  setTimeout(callback, 0);
}
```

Nothing at the call site changes. **The `(err, data) => {}` you pass to `fs.readFile` and
the `x => x * 2` you pass to `map` are the same language construct**, and the difference
between them lives entirely in code you did not write.

MDN's own examples of each:

| | Examples |
|---|---|
| **Synchronous callbacks** | `Array.prototype.map()`, `Array.prototype.forEach()` |
| **Asynchronous callbacks** | `setTimeout()`, `Promise.prototype.then()` |

🔴 **This is why "does this run in order?" is not answerable from the syntax.** It is
answerable only from the documentation of the function you are calling. A reader who
assumes every callback is deferred will misread `sort`; a reader who assumes every callback
is immediate will misread `readFile`. Both assumptions are common, and each is wrong half
the time.

## Why the language needs the pattern at all

Because of run-to-completion. From
[01 · Synchronous vs asynchronous](../01-sync-vs-async/README.md): a function cannot be
preempted, so a function that has to *wait* for something has only two options — block the
one thread, or **return immediately and leave behind instructions for later**.

A callback is those instructions. It is the most direct possible encoding of "when the disk
comes back, do this", and it predates promises by the entire early history of the platform.

Everything in this phase after this topic — promises, `async`/`await` — is a **wrapper over
the same mechanism**, not a replacement for it. `await` still ends up as a function the
runtime calls later; the machinery underneath is the microtask queue from
[03 · Microtasks vs macrotasks](../03-microtasks-vs-macrotasks/README.md).

## Where callbacks are still the only answer

**A callback is not legacy. Callback *sequencing* is** — and that distinction is the point
of this whole topic.

- **Event handlers are callbacks** — `addEventListener('click', fn)` hands the platform a
  function to call, possibly many times, possibly never. A promise settles once and cannot
  express that.
- **Array methods take callbacks** — `map`, `filter`, `sort`'s comparator. These are
  synchronous; there is nothing to await.
- **Node's stream and older `fs` APIs are callback-based**, and much of the ecosystem under
  them still is.
- **`queueMicrotask` and `requestAnimationFrame`** take a callback and no promise, because
  there is no value to resolve — you are scheduling code, not requesting a result.

The decision rule, stated once here and returned to in
[chunk 04](./04-callback-hell.md): **use a promise for "one result, later"; use a callback
for "a function to run" or "many results over time".**

## Gotchas

**Symptom:** Code after a callback-taking function runs before the callback does
**Cause:** The callback is asynchronous; the outer function returns immediately and the
callback is queued as a task or microtask.
**Fix:** Expected. Move the dependent code *into* the callback. Nothing written after the
call can see its result.

**Symptom:** A callback ran immediately when you expected it to be deferred, or the reverse
**Cause:** MDN: synchronous callbacks are *"called immediately after the invocation of the
outer function"*, asynchronous ones *"at some point later"* — **the syntax is identical**.
**Fix:** Read the documentation of the function you are calling. `map`/`forEach`/`sort` are
synchronous; `setTimeout`/`then` are not.

**Symptom:** A value assigned inside a callback reads as stale outside it
**Cause:** MDN's `value = 1 / value = 2` case — the assignment has not happened yet at the
point you read it.
**Fix:** Do not read across the boundary. Either the read belongs inside the callback, or
the API should return a promise you can await.

**Symptom:** Converting an event handler to a promise loses every event after the first
**Cause:** A promise settles **once**; an event source is many-shot.
**Fix:** Keep the callback. Promises are the wrong shape for recurring events.

## Interview questions

**★ What is a callback?**
MDN: *"a function passed into another function as an argument, which is then invoked inside
the outer function"*. The consequence that matters is the split of responsibility — you
write the function, but **the caller decides when it runs, how often, and with what
arguments**.

**★ Is a callback asynchronous?**
Not inherently. MDN separates **synchronous** callbacks (`map`, `forEach` — called
immediately, with no intervening async task) from **asynchronous** ones (`setTimeout`,
`then`). **The call site looks identical for both**, so the only way to know is the
documentation of the function you are passing it to.

**★ Why does the language need callbacks at all?**
Run-to-completion. A function cannot be preempted, so anything that must wait either blocks
the single thread or returns immediately and leaves instructions for later. A callback is
the most direct encoding of those instructions.

**Are callbacks obsolete now that we have `async`/`await`?**
No — only callback *sequencing* is. Event handlers, array methods, `queueMicrotask` and
`requestAnimationFrame` are all callbacks, and promises are built on the same mechanism.
What promises replace is chaining one deferred callback after another.

**When would you deliberately choose a callback over a promise?**
Synchronous work (`map`, a `sort` comparator), many-shot events (`addEventListener`,
streams, observers), and pure scheduling (`queueMicrotask`, `requestAnimationFrame`). A
promise is one-shot, so it cannot model a stream of events.

---

[Topic index](./README.md) · Next → [02 · The error-first convention](./02-error-first.md)
