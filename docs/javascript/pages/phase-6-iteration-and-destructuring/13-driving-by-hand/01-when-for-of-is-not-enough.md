---
title: "13.1 · When `for...of` is not enough"
sidebar_label: "01 · When `for...of` is not enough"
sidebar_position: 1
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-15 against MDN — [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols), [`Generator.prototype.next()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator/next) and [`Generator.prototype.return()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator/return). Documentation-validated.

`for...of` is the right way to consume an iterator **when the consumption pattern is
"one value, then the next, until done"**. Calling `next()` yourself is for the cases where
it is not — and there are only four of them worth the trouble.

```js
const it = source[Symbol.iterator]();
let result;
while (!(result = it.next()).done) {
  use(result.value);
}
```

That loop is strictly worse than `for...of` for ordinary iteration: more code, and it drops
the automatic cleanup. **Reach for it only when one of the four applies.**

## 1 · You need the completion value

Built-in consumers discard the `value` that arrives with `done: true`
([05.1](../05-generators/01-pause-and-resume.md)). A manual loop is the only way to read it:

```js
function* parse(tokens) {
  while (moreItems(tokens)) yield item(tokens);
  return { warnings, consumed };        // the SUMMARY, not an item
}

const it = parse(tokens);
let r;
while (!(r = it.next()).done) handle(r.value);
const summary = r.value;                // { warnings, consumed }
```

The alternative — pushing the summary into the stream as a specially-shaped value — makes
every consumer branch on "is this an item or the summary". **The completion value exists so
that the stream and the result can be different things.**

## 2 · You need to look ahead

A parser almost always needs "what is next, without consuming it". No protocol method
offers that, so you buffer one value:

```js
class Peekable {
  #it; #buf = [];
  constructor(iterable) { this.#it = iterable[Symbol.iterator](); }

  peek() {
    if (!this.#buf.length) {
      const r = this.#it.next();
      if (r.done) return r;                 // { value, done: true }
      this.#buf.push(r.value);
    }
    return { value: this.#buf[0], done: false };
  }

  next() {
    if (this.#buf.length) return { value: this.#buf.shift(), done: false };
    return this.#it.next();
  }

  return(value) { this.#buf.length = 0; return this.#it.return?.(value) ?? { value, done: true }; }
  [Symbol.iterator]() { return this; }
}
```

Two details make it correct rather than nearly-correct: **`return()` is forwarded** so
closing the wrapper closes the source (with `?.` because `return` is optional in the
protocol), and `[Symbol.iterator]()` returns `this`, so the wrapper can still be used with
`for...of` once you are done peeking.

```js
const p = new Peekable(tokens);
while (!p.peek().done) {
  if (p.peek().value.type === "open") parseBlock(p);
  else p.next();
}
```

## 3 · You are consuming several iterators together

`for...of` drives exactly one. Merging, zipping or comparing two ordered streams means
calling `next()` on each, independently — the subject of
[13.2](./02-multi-iterator-algorithms.md).

## 4 · The consumer is a state machine, not a loop

Event-driven or frame-driven code does not have a loop to put `for...of` in. It has a
callback that must produce **one more value each time it fires**:

```js
const steps = animationSteps();          // a generator

function frame() {
  const { value, done } = steps.next();
  if (done) return;
  apply(value);
  requestAnimationFrame(frame);
}
```

The generator holds the position; the callback pulls one step per frame. **This is the
shape behind incremental rendering, chunked work and cooperative scheduling** — a loop
would block, and the pull-per-tick is the point
([05.2](../05-generators/02-lazy-sequences.md) on `yield` not releasing the thread).

## You now own the cleanup

This is the cost, and it is easy to forget. `for...of` calls `return()` on early exit; a
manual loop does not. **If you stop pulling, close it yourself:**

```js
const it = source[Symbol.iterator]();
try {
  while (!(r = it.next()).done) {
    if (enough(r.value)) break;
  }
} finally {
  it.return?.();          // release the source — nothing else will
}
```

`it.return?.()` because `return` is optional in the protocol, and `finally` so it also runs
when the body throws. On an already-finished iterator, `return()` is harmless — it reports
`{ value: undefined, done: true }`.

And when `next()` **throws**, MDN's guidance is to stop: *"you may catch the error and retry
calling `next()`, but in general you should assume the iterator is already closed."* Treat a
throwing iterator as finished rather than resuming it.

## Gotchas

**Symptom:** The manual loop ran one iteration too many
**Cause:** Using `value` from the result that also had `done: true`.
**Fix:** Check `done` before using `value` — `while (!(r = it.next()).done)`.

**Symptom:** The loop never ended
**Cause:** `next()` was called on the *iterable* instead of an iterator, or the result object
is reused/mutated.
**Fix:** Get the iterator once — `const it = x[Symbol.iterator]()` — and re-read `next()`
each turn.

**Symptom:** A resource leaked after a manual `break`
**Cause:** Nothing called `return()`; that is `for...of`'s job, not the protocol's.
**Fix:** `try { … } finally { it.return?.(); }`.

**Symptom:** `it.return is not a function`
**Cause:** `return` is **optional** on the iterator protocol.
**Fix:** Optional call — `it.return?.()`.

**Symptom:** Resuming after `next()` threw produced nonsense
**Cause:** MDN: *"in general you should assume the iterator is already closed."*
**Fix:** Stop consuming it and surface the error.

**Symptom:** A `Peekable` wrapper broke cleanup of its source
**Cause:** The wrapper implemented `next` but not `return`.
**Fix:** Forward `return()` (and clear the buffer) as above.

## Interview questions

**★ When would you call `next()` instead of using `for...of`?**
Four cases: you need the completion value that arrives with `done: true`; you need lookahead
(`peek`); you are driving several iterators together; or the consumer is a callback or state
machine with no loop to put `for...of` in.

**★ What do you give up by driving an iterator by hand?**
Automatic closing. `for...of` calls `return()` on `break`, `return` or `throw`; a manual loop
must do it in a `finally`, using `it.return?.()` because `return` is optional.

**★ How do you implement `peek()`?**
Buffer one value: `peek()` pulls from the source if the buffer is empty and returns the
buffered value without consuming it; `next()` drains the buffer first. Forward `return()` to
the source and make the wrapper iterable so it can go back into a `for...of`.

**★ How do you read a generator's `return` value?**
Only from a manual loop — keep the last result object and read `.value` once `.done` is
`true`. Every built-in consumer discards it. Inside another generator, `yield*` evaluates to
it.

**What should you do if `next()` throws?**
Assume the iterator is closed and stop. MDN allows retrying but advises against relying on
it — if `next()` threw, cleanup has generally already happened.

---

[Topic index](./README.md) · Next → [Multi-iterator algorithms](./02-multi-iterator-algorithms.md)
