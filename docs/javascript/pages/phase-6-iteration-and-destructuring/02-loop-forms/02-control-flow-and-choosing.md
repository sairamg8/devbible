---
title: "02.2 · Control flow: `break`, `await` and choosing"
sidebar_label: "02 · Control flow and choosing"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`for...of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of), [`forEach`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach), [`for...in`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...in). Documentation-validated.

[Chunk 1](./01-what-each-iterates.md) covered *what* each loop iterates. This is the
half that decides which one you can actually use: **what control flow works inside it.**

## The capability table

| | `for` / `for...of` | `forEach` | `map`/`filter`/… |
|---|---|---|---|
| `break` | ✅ | ❌ | ❌ |
| `continue` | ✅ | ❌ (`return` skips one) | ❌ |
| `return` from the **enclosing** function | ✅ | ❌ — returns from the callback | ❌ |
| `await` between iterations | ✅ | ❌ — not awaited | ❌ |
| Produces a value | ❌ | ❌ (`undefined`) | ✅ |

**That table is the whole decision.** If the body needs any of the first four rows,
`forEach` and the array methods are out — MDN: *"There is no way to stop or break a
`forEach()` loop other than by throwing an exception. If you need such behavior, the
`forEach()` method is the wrong tool."*

## `return` inside `forEach` is the subtle one

```js
function findUser(users, id) {
  users.forEach((u) => {
    if (u.id === id) return u;   // ❌ returns from the CALLBACK, not findUser
  });
  return null;                    // always reached
}
```

The `return` exits the arrow function and `forEach` carries on. `findUser` always returns
`null`. This compiles, passes review, and fails silently — the worst combination.

```js
function findUser(users, id) {
  return users.find((u) => u.id === id) ?? null;   // ✅
}
```

Inside `forEach`, `return` behaves like `continue` — it skips the rest of *that
iteration*. That is occasionally useful and always worth a comment, because it reads like
`break` to anyone skimming.

## `await` only works in a real loop

```js
// ❌ nothing is awaited; the loop finishes before any promise settles
items.forEach(async (item) => {
  await save(item);
});

// ✅ sequential — each iteration waits
for (const item of items) {
  await save(item);
}

// ✅ concurrent — all start, then wait for all
await Promise.all(items.map((item) => save(item)));
```

The `forEach` version discards every promise, so subsequent code runs before any save
completes, and a rejection becomes an **unhandled rejection** rather than something your
`try`/`catch` sees.

**The choice between the last two is real:**

- **`for...of` + `await`** — sequential. Ordered, bounded concurrency of one, and a
  `try`/`catch` around the loop catches everything. Use it when operations depend on each
  other, or when the target cannot take parallel load (rate limits, a database
  connection pool).
- **`Promise.all` + `map`** — concurrent. Much faster for independent I/O, but it starts
  **every** request at once. Ten thousand items means ten thousand simultaneous requests.
  `Promise.allSettled` when partial failure is acceptable; a batching helper when the
  count is unbounded.

`for await...of` is the third form, for async **iterables** — a paginated API, a stream —
and it belongs to phase 6's later topics.

## Labels, for the nested case

```js
outer: for (const row of rows) {
  for (const cell of row) {
    if (cell === target) break outer;   // breaks BOTH loops
  }
}
```

`break` and `continue` accept a label, which is the clean answer to "how do I exit two
loops". The alternative — a flag variable checked in the outer condition — is worse. This
only works with real loops; there is no labelled escape from `forEach`.

Extracting the nested loops into a function and using `return` is usually cleaner still.

## Iterating while modifying

The rule from [Phase 5 · 04](../../phase-5-built-in-library/04-array-iteration-methods/02-callbacks-holes-and-async.md)
applies to loops too, with one difference:

- **`forEach` and the array methods** fix their range **before** the first callback, so
  appended elements are never visited.
- **`for...of`** uses the **iterator**, which reads `length` as it goes — so elements
  appended during iteration *are* visited, and an unconditional `push` inside a
  `for...of` over the same array is an infinite loop.

Both skip or double-visit elements when you remove during iteration. **Do not mutate the
collection you are iterating**; build a new one, or iterate a copy (`[...items]`).

## Choosing, in order

1. **Producing a new collection?** → `map`, `filter`, `flatMap`. Not a loop.
2. **Reducing to one value?** → `reduce`, or a loop if the fold is awkward
   ([Phase 5 · 05](../../phase-5-built-in-library/05-reduce/02-when-not-to-use-it.md)).
3. **Looking for one thing?** → `find`, `findIndex`, `some`, `every` — they short-circuit.
4. **Need `break`, `continue`, `return` or `await`?** → `for...of`.
5. **Just side effects, no control flow?** → `forEach` or `for...of`; either is fine.
6. **Need the index as a number?** → `for (const [i, x] of arr.entries())`, or a classic
   `for`.
7. **Object properties?** → `Object.entries`/`keys` with `for...of`.
8. **`for...in`?** → almost never.

The classic indexed `for` still wins in one place: when you need to control the index
directly — stepping by two, iterating backwards (which is how you remove elements safely,
per [Phase 5 · 02 · `splice`](../../phase-5-built-in-library/02-adding-and-removing/02-splice.md)),
or comparing adjacent elements.

## Gotchas

**Symptom:** A function always returns the fallback despite finding a match
**Cause:** `return` inside a `forEach` callback returns from the **callback**, not the
enclosing function.
**Fix:** `find`, or a `for...of` with `return`.

**Symptom:** Async work in a loop appears not to run, and errors escape `try`/`catch`
**Cause:** `forEach` does not await; every promise is discarded, so rejections become
unhandled.
**Fix:** `for...of` with `await` for sequential, `Promise.all(map(…))` for concurrent.

**Symptom:** Thousands of simultaneous requests from a `Promise.all`
**Cause:** It starts **every** promise at once.
**Fix:** Batch, or use a concurrency-limited helper, or go sequential if the total time
allows.

**Symptom:** `break` does not compile inside a callback
**Cause:** `break` is a loop statement; a callback is a function body.
**Fix:** `for...of`, or `some`/`every` if a boolean is the real goal.

**Symptom:** An infinite loop when pushing inside `for...of` over the same array
**Cause:** `for...of` uses the iterator, which re-reads `length` — unlike `forEach`,
whose range is fixed up front.
**Fix:** Iterate a copy (`[...items]`) or build a separate output array.

**Symptom:** Exiting two nested loops needs a flag variable
**Cause:** Plain `break` only exits the innermost loop.
**Fix:** A **label** — `outer: for (…) { … break outer; }` — or extract to a function and
`return`.

## Interview questions

**★ Why can you not `break` out of `forEach`?**
Because the body is a **callback function**, not a loop body — `break` is a loop
statement and does not exist there. MDN says the only way to stop it is throwing, and
that *"the `forEach()` method is the wrong tool"* if you need early exit. Use `for...of`,
or `find`/`some`/`every`.

**★ What does `return` do inside a `forEach` callback?**
It returns from the **callback**, acting like `continue`. It does **not** return from the
enclosing function — a silent bug, since the enclosing function then falls through to its
own return.

**★ What is the difference between `for...of` with `await` and `Promise.all` over a
`map`?**
The first is **sequential** — one at a time, ordered, and a `try`/`catch` around the loop
catches everything. The second is **concurrent** — every operation starts at once, which
is much faster for independent I/O but unbounded. Choose by whether the operations are
independent and whether the target can take the load.

**★ Why is `forEach(async …)` wrong?**
Because `forEach` discards the returned promises: nothing is awaited, subsequent code
runs before the work completes, and a rejection becomes an **unhandled rejection**
outside any `try`/`catch`.

**How do you break out of nested loops?**
A **label**: `outer: for (…) { for (…) { break outer; } }`. Or extract the nested loops
into a function and `return`, which is usually cleaner.

**When is a classic indexed `for` still the right choice?**
When you control the index — stepping by more than one, iterating **backwards** (the safe
way to remove elements in place), or comparing adjacent elements.

---

← [What each one iterates](./01-what-each-iterates.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
