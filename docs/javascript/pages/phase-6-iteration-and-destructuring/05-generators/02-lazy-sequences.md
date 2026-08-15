---
title: "05.2 · Lazy sequences, and what they are for"
sidebar_label: "02 · Lazy sequences, and what they are for"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`function*`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*), [`yield`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/yield), [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols) and [`Iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator). Documentation-validated.

Generators are usually taught as syntax. The useful framing is the opposite: **a generator
is the cheapest way to express a sequence you do not want to build.** Every array method
in [Phase 5](../../phase-5-built-in-library/README.md) produces a whole new array before
the next step starts. A generator produces one value, waits, and produces the next only
when someone asks.

That is the entire difference, and everything below follows from it.

## Nothing is computed until it is pulled

```js
function* naturals() {
  let n = 1;
  while (true) yield n++;      // an infinite sequence that costs nothing to define
}

function* map(iterable, fn) {
  for (const x of iterable) yield fn(x);
}

function* take(iterable, n) {
  let i = 0;
  for (const x of iterable) {
    if (i++ >= n) return;
    yield x;
  }
}

[...take(map(naturals(), (n) => n * n), 5)];   // [1, 4, 9, 16, 25]
```

**Exactly five squares were computed.** `naturals()` did not produce a million numbers and
`map` did not build an array of them — each `yield` in `take` pulls one value back through
`map` to `naturals`, and when `take` returns, the whole chain stops. The equivalent with
array methods is not slower; it is *impossible*, because `naturals()` as an array never
terminates.

The two properties worth naming:

- **Pull-based.** The consumer drives. Nothing runs ahead of demand.
- **Constant intermediate memory.** A chain of `n` generators holds `n` suspended frames
  and one value in flight — not `n` intermediate arrays.

## The pipeline shape, on real data

```js
function* lines(text) { for (const l of text.split("\n")) yield l; }
function* filter(it, ok) { for (const x of it) if (ok(x)) yield x; }

const firstTenErrors = [...take(filter(lines(log), (l) => l.includes("ERROR")), 10)];
```

Reading with array methods — `log.split("\n").filter(…).slice(0, 10)` — is shorter and,
for a log you already hold in memory, better. **The generator version earns its place when
the source is large, expensive or open-ended**, because it stops reading at the tenth
match instead of scanning everything first.

Same shape, three situations where it is the right call:

| Situation | Why laziness matters |
|---|---|
| Paginated API | Fetch page 2 only if page 1's results were not enough — **07 · Paginating an API with an async generator** *(not written yet)* |
| A very large file or stream | The whole thing never has to be resident |
| A search with an early exit | Stop at the first match rather than mapping everything |
| An infinite or generated sequence | ids, retry delays, cursors, coordinates |

## The built-in version: iterator helpers

Hand-rolled `map`/`filter`/`take` are worth writing once for the mechanics — then use the
built-ins. MDN lists `map`, `filter`, `take`, `drop`, `flatMap`, `reduce`, `toArray`,
`forEach`, `some`, `every`, `find`, `join`, `chunks` and `windows` on `Iterator.prototype`:

```js
naturals().map((n) => n * n).take(5).toArray();   // [1, 4, 9, 16, 25]
```

**These are lazy in the same way**, so `take(5)` still bounds the infinite source. They
exist on generator objects for free because *"all built-in iterators inherit from the
`Iterator` class"*. A hand-written iterator object needs `Iterator.from()` first
([04.2](../04-iteration-protocols/02-making-your-own-object-iterable.md)); the details are
**11 · Iterator helpers** *(not written yet)*.

## Recursive structures, without an accumulator

Traversing a tree is the case where generators beat every alternative on clarity:

```js
function* walk(node) {
  yield node;
  for (const child of node.children ?? []) yield* walk(child);
}

for (const n of walk(root)) if (n.id === wanted) break;   // stops mid-traversal
```

The recursive version with a callback cannot stop early without throwing or threading a
flag through every frame; the version that returns an array has to visit every node before
the caller sees the first one. **`yield*` delegates to another iterable and re-yields
everything it produces** — the mechanism gets its own topic, **10 · `yield*` delegation**
*(not written yet)*.

`yield* someIterable` also works on arrays, `Set`s, strings and other generators, which is
why `*[Symbol.iterator]() { yield* this.items; }` is the standard one-liner for making a
class iterable.

## State without a class

A generator's local variables are its state, and they survive between `next()` calls. That
makes it a compact alternative to a small stateful object:

```js
function* backoff(base = 100, factor = 2, max = 30_000) {
  let delay = base;
  while (true) {
    yield delay;
    delay = Math.min(delay * factor, max);
  }
}

const delays = backoff();
delays.next().value;   // 100
delays.next().value;   // 200
```

No class, no field, no `this`. Compare against a hand-written object with a `#delay`
property and a `next()` method — same behaviour, and the generator makes the *sequence*
the visible thing rather than the bookkeeping. Retry policies, round-robin pickers, id
allocators and cycling colour palettes all fit this shape.

## Where generators are the wrong tool

Be as clear about this as about the wins, because generators are over-applied:

- **A small array you already have.** `arr.filter(…).map(…)` is clearer, and the
  intermediate arrays are not a problem at that size. Reach for laziness when the source is
  big, expensive or infinite — not by default.
- **When the consumer needs `length`, an index, or random access.** An iterator offers
  none of those. If you find yourself collecting it into an array immediately, the
  generator bought nothing.
- **When it must be iterated more than once.** Generator objects are one-shot
  ([05.1](./01-pause-and-resume.md)); either expose a *function* or return an array.
- **CPU-bound work you hoped to make "non-blocking".** `yield` suspends the *generator*,
  not the thread — the event loop is not involved at all
  ([Phase 7 · 02 · The event loop](../../phase-7-async/02-the-event-loop/README.md)). A
  generator will not keep the page responsive; a Web Worker or an explicit yield to the
  scheduler will.
- **Anything asynchronous.** A plain generator cannot `await`. That is
  `async function*` and `for await...of` — **06 · Async iterators** *(not written yet)*.

There is a real cost, too: each `yield` is a suspend-and-resume rather than a straight-line
step, and stack traces through a generator pipeline are harder to read. **No measurement
was run for this page** (see the phase's verification note), so treat that as a reason to
prefer plain array methods until laziness is actually buying you something — not as a
number.

## Gotchas

**Symptom:** A generator pipeline built the whole intermediate result anyway
**Cause:** Something in the chain was greedy — a spread, an `Array.from`, a `.sort()` or a
`toArray()` in the middle.
**Fix:** Keep every stage lazy and materialise once, at the end. `sort` cannot be lazy: it
needs every value.

**Symptom:** `[...naturals()]` froze the tab
**Cause:** Spread is greedy and the sequence is infinite.
**Fix:** Bound it first — `take(n)`, or `break` out of a `for...of`.

**Symptom:** The generator was iterated twice and the second pass saw nothing
**Cause:** One-shot generator object.
**Fix:** Pass the generator **function** or an iterable object with
`*[Symbol.iterator]()`, not the generator object.

**Symptom:** `yield* walk(child)` was written as `yield walk(child)` and the loop produced
generator objects
**Cause:** `yield` emits one value — the generator object itself. `yield*` delegates and
re-yields its values.
**Fix:** Add the `*`.

**Symptom:** Wrapping a slow synchronous computation in a generator did not stop the UI
freezing
**Cause:** `yield` suspends the generator, not the event loop; the work still runs on the
main thread.
**Fix:** A Web Worker, or explicitly yielding to the scheduler between chunks of work.

**Symptom:** `await` inside `function*` is a syntax error
**Cause:** Plain generators are synchronous.
**Fix:** `async function*`, consumed with `for await...of`.

**Symptom:** `.map()` on a hand-written iterator threw `TypeError`
**Cause:** Iterator helpers live on `Iterator.prototype`, which object literals do not
inherit from.
**Fix:** `Iterator.from(it)`, or produce the iterator from a generator function.

## Interview questions

**★ What problem do generators actually solve?**
They express a sequence without building it. Values are produced on demand, so an infinite
or expensive source can be consumed lazily, a pipeline holds one value in flight instead of
an intermediate array per stage, and the consumer can stop early — which array methods
cannot do at all for an unbounded source.

**★ How is `naturals().map(f).take(5)` different from `arr.map(f).slice(0, 5)`?**
The generator version applies `f` five times; the array version applies it to every
element and then discards most of the results. And `naturals()` has no array form — it
never ends. Iterator helpers are lazy; array methods are eager.

**★ When would you *not* use a generator?**
For a small in-memory array (array methods are clearer), when the consumer needs `length`
or indexing, when the sequence must be iterated more than once, and when the goal is
avoiding a UI freeze — `yield` does not release the main thread.

**★ Why are generators good at tree traversal?**
`yield* walk(child)` re-yields a sub-traversal, so a recursive walk becomes three lines and
the caller can `break` mid-traversal. A callback-based walk cannot stop early cleanly; an
array-returning walk must finish before the caller sees anything.

**What does `yield*` do that `yield` does not?**
`yield` emits its operand as a single value; `yield*` treats its operand as an iterable and
yields each of its values in turn, passing through the delegate's completion value.

**How do generators relate to `async`/`await`?**
Both are built on suspending and resuming a function. `await` in an async function pauses
in a way the event loop drives, whereas `yield` pauses in a way the *consumer* drives.
Async generators combine them — `async function*` with `for await...of`.

**Are generators faster than arrays?**
That is the wrong axis. They avoid work that would otherwise be done and avoid intermediate
allocations, but each `yield` costs a suspend and resume. For a small array, plain methods
are the sensible default; laziness pays when the source is large, expensive or unbounded.

---

← Prev [Pause and resume](./01-pause-and-resume.md) · [Topic index](./README.md)
