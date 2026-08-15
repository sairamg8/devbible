---
title: "09.1 · Talking back — `next(value)` and `throw()`"
sidebar_label: "01 · Talking back — `next(value)` and `throw()`"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`yield`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/yield), [`function*`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*) and [`Generator.prototype.throw()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator/throw). Documentation-validated.

Everything in [05 · Generators](../05-generators/README.md) treated a generator as a
**source**: values come out, nothing goes in. That is the 95% case. The remaining 5% is
what this topic is about — **`yield` is an expression, and its value is whatever the
consumer sends back.** The generator becomes a two-way channel, and that channel is the
mechanism `async`/`await` is built on.

```js
function* dialogue() {
  const name = yield "What is your name?";
  const age = yield `Hello ${name}. How old are you?`;
  return `${name} is ${age}`;
}

const d = dialogue();
d.next();          // { value: "What is your name?", done: false }
d.next("Ada");     // { value: "Hello Ada. How old are you?", done: false }
d.next(36);        // { value: "Ada is 36", done: true }
```

**Read it as a protocol, not as a loop.** The generator asks; the driver answers. Neither
side knows how the other gets its work done.

## The asymmetry, and the discarded first argument

MDN states the rule that trips everyone:

> "This means `next()` is asymmetric: it always sends a value to the currently suspended
> `yield`, but returns the operand of the next `yield`. The argument passed to the first
> `next()` call cannot be retrieved because there's no currently suspended `yield`."

So in a call sequence, **each `next(v)` resolves the *previous* `yield`**:

| Call | Sends `v` to | Returns |
|---|---|---|
| `d.next()` | nothing — no `yield` is suspended yet | the 1st `yield`'s operand |
| `d.next("Ada")` | the 1st `yield` | the 2nd `yield`'s operand |
| `d.next(36)` | the 2nd `yield` | the `return` value, `done: true` |

**Initial data goes in as a function argument**, never as the first `next()`:

```js
const d = dialogue("Ada");   // ✅
const d = dialogue(); d.next("Ada");   // ⛔ silently discarded
```

A generator written to be driven this way is therefore always "one `next()` ahead" of its
inputs. Priming it with a bare `next()` before the real conversation starts is the standard
opening move, and forgetting it is the standard bug.

## `throw()` — injecting an error at the pause point

MDN: `throw()` *"acts as if a `throw` statement is inserted in the generator's body at the
current suspended position. It informs the generator of an error condition and allows it to
handle the error, or perform cleanup and close itself."*

```js
function* gen() {
  while (true) {
    try {
      yield 42;
    } catch (e) {
      console.log("Error caught!");
    }
  }
}

const g = gen();
g.next();                                  // { value: 42, done: false }
g.throw(new Error("Something went wrong"));
// "Error caught!"
// { value: 42, done: false }
```

Three consequences, all documented:

- **If the generator catches it, iteration continues.** The return value is the ordinary
  `{ value, done }` from the next `yield` — as above, `{ value: 42, done: false }`.
- **If it does not catch it**, MDN: *"it is thrown to the caller of `throw()`"* — and the
  generator is finished.
- **`TypeError` if the generator is already running.** You cannot re-enter it from inside
  its own execution.

This is the *inbound* half of error handling. The outbound half — a `throw` inside the
generator surfacing at the consumer's `next()` — needs no special API.

## The request/response driver

Put `next(value)` and `throw()` together and you have a generator that *asks for work* and
a driver that *does* it. This is the shape worth recognising, because it is the whole idea:

```js
function* task() {
  const user = yield { type: "fetch", url: "/me" };
  const orders = yield { type: "fetch", url: `/orders?user=${user.id}` };
  return orders.length;
}

function run(gen) {                 // the DRIVER — the only part that knows how to fetch
  const it = gen();
  const step = (input) => {
    const { value, done } = it.next(input);
    if (done) return Promise.resolve(value);
    return fetch(value.url)
      .then((r) => r.json())
      .then(step, (err) => {
        it.throw(err);              // let the generator handle it, if it wants to
      });
  };
  return step();
}
```

**The generator contains no promises, no `fetch`, no error handling policy** — only the
sequence of *intentions*. The driver decides how each intention is carried out. Swap the
driver for one that returns canned data and the same generator is a unit test with no
mocking framework:

```js
const it = task();
it.next();                       // { value: {type:"fetch", url:"/me"}, done: false }
it.next({ id: 7 });              // asserts the next request is built from the user
it.next([{}, {}]);               // { value: 2, done: true }
```

That testability — **assert on what was requested, control what comes back, with no
network and no mocks** — is the practical argument for two-way generators, and it is why
the pattern survives in libraries like redux-saga long after `async`/`await` took over
ordinary async code.

## Why you rarely write this today

Because the language now ships the driver. `async`/`await` *is* this pattern with a
promise-aware driver built in, which is the subject of
[09.2](./02-return-and-the-coroutine-idea.md). Reach for a hand-driven generator only when
you need something `await` does not give you:

- **Inspectable intentions** — a test or a middleware layer that sees "fetch `/me`" rather
  than a promise already in flight.
- **A pluggable driver** — the same sequence run against the network, a cache or a replay
  log.
- **Step-at-a-time control** — a state machine, an interpreter, a turn-based flow, a
  parser that pauses for more input.

For "do these three awaits in order", `async`/`await` is shorter, better understood by
every reader, and has better stack traces. **Two-way generators are a tool for building
tools.**

## Gotchas

**Symptom:** The value passed to the first `next()` vanished
**Cause:** MDN: *"The argument passed to the first `next()` call cannot be retrieved because
there's no currently suspended `yield`."*
**Fix:** Pass it as an argument to the generator function.

**Symptom:** The values arrive one step out of phase
**Cause:** `next(v)` resolves the **previous** `yield` and returns the **next** one.
**Fix:** Prime with a bare `next()` before the conversation starts, and read the call table
above.

**Symptom:** `g.throw(err)` blew up the caller instead of the generator
**Cause:** The generator had no `try/catch` around the suspended `yield`, so *"it is thrown
to the caller of `throw()`"*.
**Fix:** Wrap the `yield` in `try/catch` inside the generator — or expect the rejection at
the driver and handle it there.

**Symptom:** `TypeError` from `throw()` or `next()`
**Cause:** The generator is *already running* — something re-entered it from inside its own
execution.
**Fix:** Never call `next`/`throw`/`return` on a generator from within its own body or a
synchronous callback it triggered.

**Symptom:** The generator kept yielding after an injected error
**Cause:** That is correct — a caught `throw()` resumes iteration and returns the next
`{ value, done }`.
**Fix:** If the error should end it, do not catch it, or `return` from the `catch`.

**Symptom:** A hand-driven generator was harder to debug than the `await` version
**Cause:** It is — the stack alternates between generator and driver.
**Fix:** Use `async`/`await` unless you need an inspectable or pluggable driver.

## Interview questions

**★ How do you send a value *into* a generator?**
`gen.next(value)`. `yield` is an expression, and it evaluates to whatever the next `next()`
passes. The first `next()`'s argument is discarded because no `yield` is suspended yet, so
initial data belongs in the generator function's arguments.

**★ Why is `next()` described as asymmetric?**
Because it sends a value to the **currently suspended** `yield` but returns the operand of
the **next** one — the input and the output belong to different `yield`s, one step apart.

**★ What does `generator.throw(err)` do?**
It behaves as if `throw err` were written at the suspended `yield`. If the generator catches
it, iteration continues and `throw()` returns the next `{ value, done }`. If not, the error
propagates to the caller of `throw()` and the generator is finished. It is a `TypeError` if
the generator is already running.

**★ What is the practical use of a two-way generator?**
Separating *what* to do from *how* to do it. The generator yields intentions; a driver
carries them out and sends results back. That makes the flow testable without mocks and the
execution strategy swappable — the model behind redux-saga and behind `async`/`await`
itself.

**When would you not use one?**
For ordinary sequential async work. `async`/`await` is the same pattern with the driver
built in, and it is shorter, more familiar and easier to debug.

---

[Topic index](./README.md) · Next → [`return()`, cleanup and the coroutine idea](./02-return-and-the-coroutine-idea.md)
