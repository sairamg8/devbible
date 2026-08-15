---
title: "08.1 · What can stop, and what cannot"
sidebar_label: "01 · What can stop, and what cannot"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Array.prototype.forEach`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach), [`some`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some), [`every`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every), [`find`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find) and [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols). Documentation-validated.

**Half of JavaScript's iteration constructs can stop in the middle and half cannot**, and
the split is not obvious from how they look. `for...of` and `forEach` read almost
identically at the call site; one takes `break` and the other has no mechanism for it at
all.

MDN is blunt about the one that cannot:

> "There is no way to stop or break a `forEach()` loop other than by throwing an exception.
> If you need such behavior, the `forEach()` method is the wrong tool."

## The table

| Construct | Stops early? | How |
|---|---|---|
| `for` / `for...of` / `for...in` | ✅ | `break`, `return`, `throw`, labelled `break` |
| `while` / `do…while` | ✅ | same |
| **`forEach`** | ❌ | **nothing** — `return` skips one element, that is all |
| `map` / `filter` / `flatMap` | ❌ | always visit every element |
| `reduce` / `reduceRight` | ❌ | always visit every element |
| `some` | ✅ | stops at the first callback returning truthy |
| `every` | ✅ | stops at the first callback returning falsy |
| `find` / `findIndex` / `findLast` / `findLastIndex` | ✅ | stops at the first match |
| `includes` / `indexOf` / `lastIndexOf` | ✅ | stops at the first match |
| `Iterator.prototype.take` / `find` / `some` / `every` | ✅ | lazily — the source is never pulled further |

MDN names the same set: early termination *"may be accomplished with"* looping statements
and *"`every()`, `some()`, `find()`, and `findIndex()` — these stop iteration immediately
when further iteration is not necessary."*

## `return` inside `forEach` is not `break`

This is the mistake, and it is quiet because the code still runs:

```js
orders.forEach((o) => {
  if (o.cancelled) return;    // SKIPS this one — same as `continue`
  process(o);
});

orders.forEach((o) => {
  if (found) return;          // does NOT stop the loop; every remaining order is still visited
});
```

The callback is an ordinary function — returning from it returns from *that call*, not
from `forEach`. MDN: *"The return value of the callback function is discarded."*
Semantically `return` in a `forEach` callback is `continue`, never `break`.

## `some` and `every` as a break

When the loop exists to answer a yes/no question, these *are* the early-exit loops:

```js
const hasAdmin = users.some((u) => u.role === "admin");     // stops at the first admin
const allValid = users.every((u) => u.email.includes("@")); // stops at the first invalid
```

`some` is "does any", `every` is "do all" — and `every` short-circuits on the **first
failure**, which is what makes it a validation loop that does not waste work.

They are also the honest version of the "abuse `some` to break" trick:

```js
items.some((x) => { doWork(x); return x.isLast; });   // works, and reads badly
for (const x of items) { doWork(x); if (x.isLast) break; }   // say what you mean
```

**If the return value is not the point, use a loop.** `some` used for side effects is a
`for...of` in disguise, and every reader has to stop and work that out.

## Throwing to escape a `forEach`

MDN's phrasing — *"other than by throwing an exception"* — is a statement of fact, not a
recommendation:

```js
try {
  items.forEach((x) => { if (x.bad) throw new StopIteration(); });
} catch { /* … */ }
```

**Do not do this.** Exceptions are for exceptional conditions; here they are control flow
wearing a costume, and the `catch` will swallow real errors from `x.bad` or from anything
the callback calls. Rewrite as `for...of` with a `break`, or as `find`/`some`.

## `break` closes the iterator

Every early exit from a `for...of` — `break`, `return`, `throw` — calls the iterator's
`return()` if it has one, as covered in
[04.2](../04-iteration-protocols/02-making-your-own-object-iterable.md). That is what
releases a file handle, cancels a request, or runs a generator's `finally`:

```js
for (const line of readLines(file)) {
  if (line.startsWith("#")) continue;
  if (line === "END") break;          // readLines' finally/return() runs — the handle closes
}
```

`forEach` has no equivalent, because there is nothing to close: it drove the array to
completion. **This is a real reason to prefer `for...of` over `forEach` for anything
backed by a resource**, quite apart from being able to stop.

## Nested loops: labels, or extract a function

```js
outer:
for (const row of rows) {
  for (const cell of row) {
    if (cell === target) break outer;   // leaves BOTH loops
  }
}
```

A bare `break` leaves only the inner loop, which is the bug labels exist to fix. The usual
alternative is cleaner still:

```js
const findCell = (rows, target) => {
  for (const row of rows) for (const cell of row) if (cell === target) return cell;
};
```

**`return` is the labelled break you already know.** Extracting the search into a function
turns "leave two loops" into "leave the function", and gives the operation a name.

## `for...of` is also the loop that handles `await`

`forEach` cannot stop, and it cannot wait either. MDN: *"`forEach()` expects a synchronous
function — it does not wait for promises"*, with the example where `sum` ends as `0`
instead of `14`:

```js
ratings.forEach(async (rating) => { sum = await sumFunction(sum, rating); });
console.log(sum);   // 0 — every callback is still pending
```

The `async` callback returns a promise, `forEach` discards it, and the loop is over before
any of them settle. Use `for...of` with `await` for sequential work, or `Promise.all` over
a `map` for concurrent
([Phase 7 · 09](../../phase-7-async/09-sequential-vs-parallel/README.md)) — and
`for await...of` for an async source
([06 · Async iterators](../06-async-iterators/README.md)).

## Gotchas

**Symptom:** `return` inside `forEach` did not stop the loop
**Cause:** It returns from the callback only — MDN: *"The return value of the callback
function is discarded."*
**Fix:** `for...of` with `break`, or `some`/`find` if the loop is answering a question.

**Symptom:** A `break` inside `forEach` is a `SyntaxError`
**Cause:** `break` is only valid inside a loop statement; the callback is a function body.
**Fix:** Use a real loop.

**Symptom:** A thrown sentinel used to escape `forEach` swallowed a genuine bug
**Cause:** The surrounding `catch` cannot tell the sentinel from a real error.
**Fix:** Never use exceptions as control flow here — `for...of` and `break`.

**Symptom:** Only the inner of two nested loops stopped
**Cause:** `break` leaves the innermost loop.
**Fix:** A labelled `break outer`, or extract the search into a function and `return`.

**Symptom:** An `async` callback in `forEach` produced no effect
**Cause:** *"`forEach()` expects a synchronous function — it does not wait for promises."*
**Fix:** `for...of` with `await`, or `Promise.all(items.map(fn))`.

**Symptom:** A file handle or subscription stayed open after the loop
**Cause:** `forEach` ran to completion, so nothing closed the source; or the iterator has
no `return()`.
**Fix:** `for...of` (which calls `return()` on early exit) and cleanup in a `finally`.

**Symptom:** `some` is being used purely for its side effects
**Cause:** It was chosen because it can stop, not because the boolean is wanted.
**Fix:** `for...of` with `break` — same behaviour, and it reads as what it is.

## Interview questions

**★ How do you break out of a `forEach`?**
You cannot. MDN: *"There is no way to stop or break a `forEach()` loop other than by
throwing an exception. If you need such behavior, the `forEach()` method is the wrong
tool."* Use `for...of` with `break`, or `some`/`every`/`find`/`findIndex`, which stop as
soon as further iteration is unnecessary.

**★ What does `return` do inside a `forEach` callback?**
It ends that one callback invocation — the equivalent of `continue`. The return value is
discarded and iteration carries on.

**★ Which array methods short-circuit?**
`some`, `every`, `find`, `findIndex`, `findLast`, `findLastIndex`, `includes`, `indexOf`
and `lastIndexOf`. `map`, `filter`, `flatMap`, `reduce` and `forEach` always visit every
element.

**★ Why does an `async` callback inside `forEach` not work as expected?**
`forEach` does not await the promise the callback returns — it discards it and moves on,
so the loop finishes before any of the work does. Use `for...of` with `await`, or
`Promise.all` over a `map`.

**How do you break out of nested loops?**
A labelled `break outer`, or — usually better — extract the inner search into a function
and `return` from it, which names the operation as well as exiting it.

**What does `break` do beyond ending the loop?**
It closes the iterator: the `return()` method is called if present, so a generator's
`finally` runs and resources held by the iterator are released. `forEach` offers nothing
equivalent.

---

[Topic index](./README.md) · Next → [The cost of chaining](./02-the-cost-of-chaining.md)
