---
title: "10.2 · Composing generators"
sidebar_label: "02 · Composing generators"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`yield*`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/yield*), [`function*`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*) and [`Iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator). Documentation-validated.

Delegation is what makes generators *compose*. Without `yield*`, a generator is a
self-contained loop; with it, a generator is a piece you can name, test and reuse inside
another. The four shapes below are the ones worth recognising.

## 1 · Recursion over a tree

The canonical case, and the one where nothing else comes close:

```js
function* walk(node) {
  yield node;
  for (const child of node.children ?? []) yield* walk(child);
}

for (const n of walk(root)) {
  if (n.id === wanted) break;      // stops mid-traversal; every frame unwinds
}
```

Three lines, depth-first, lazy, and interruptible. The alternatives are worse in specific
ways: an array-returning walk must finish before the caller sees anything; a
callback-based walk cannot stop early without throwing; an explicit stack is more code and
loses the natural expression of "then its children".

**Change the order by moving the `yield`:**

```js
function* postOrder(node) {
  for (const child of node.children ?? []) yield* postOrder(child);
  yield node;                       // children first
}
```

⚠️ **Each level of nesting adds a delegation hop**, so every value from depth *d* passes
through *d* generators on its way out. That is fine for a DOM tree or a file system and
worth a thought for a structure thousands of levels deep — where an explicit stack is the
usual answer. **No measurement is published here** (this repository does not print numbers
it did not run), so treat it as a structural fact rather than a benchmark.

## 2 · Splitting a long generator into named parts

A parser or a protocol reader written as one generator becomes unreadable quickly.
Delegation splits it without changing behaviour:

```js
function* parseMessage(tokens) {
  const header = yield* parseHeader(tokens);      // returns a value, yields nothing
  yield* parseBody(tokens, header.length);        // yields the body's items
  yield* parseTrailer(tokens);
}
```

Each part is a generator in its own right — testable on its own, with its own `finally`
for cleanup. Because `yield*` evaluates to the delegate's completion value
([10.1](./01-what-it-delegates.md)), a sub-generator can both **consume input** and
**return a result**, which is exactly what a header parser needs.

## 3 · Pipelines

Each stage takes an iterable and returns one, so the stages compose by nesting:

```js
function* map(it, fn) { for (const x of it) yield fn(x); }
function* filter(it, ok) { for (const x of it) if (ok(x)) yield x; }
function* chunk(it, n) {
  let buf = [];
  for (const x of it) { buf.push(x); if (buf.length === n) { yield buf; buf = []; } }
  if (buf.length) yield buf;        // the partial last chunk — do not lose it
}

for (const batch of chunk(filter(lines(file), (l) => l.trim()), 500)) {
  await insertAll(batch);
}
```

`chunk` is the one worth keeping: **batching a lazy stream into fixed-size groups** is the
shape behind bulk inserts, batched API calls and progress reporting, and it stays lazy —
each batch is built only when the consumer asks for it.

Two notes. Inside those stages `for…of` + `yield` is deliberate: the loop body transforms
each value, so there is nothing to delegate. And for plain `map`/`filter`/`take` the
built-in **iterator helpers** are better ([05.2](../05-generators/02-lazy-sequences.md));
write your own only for stages the helpers do not have, like `chunk` — and note that
`Iterator.prototype` does now include `chunks()` and `windows()`, so check before writing
one.

## 4 · Concatenating sources

```js
function* concat(...iterables) {
  for (const it of iterables) yield* it;
}

[...concat([1, 2], new Set([3]), "45")];        // [1, 2, 3, "4", "5"]
```

Lazy `concat`: nothing is materialised, and a consumer that stops after the second value
never touches the third source. Compare `[...a, ...b, ...c]`, which builds all of it
immediately. **The lazy version matters when a later source is expensive** — a fallback
that hits the network only if the cache misses.

## Delegation and the two-way channel

Because `next`, `throw` and `return` are all forwarded
([10.1](./01-what-it-delegates.md)), a composed generator keeps working as a coroutine:

```js
function* auth() { const token = yield { type: "login" }; return token; }
function* flow() {
  const token = yield* auth();          // driver's next(value) reaches auth()'s yield
  yield { type: "fetch", token };
}
```

The driver from [09.1](../09-two-way-generators/01-talking-back.md) needs no knowledge that
`flow` delegates. **This is why sagas compose** — an effect yielded five levels deep is
handled by the same middleware as one yielded at the top.

## When not to compose this way

- **Two stages that could be one.** `map(map(xs, f), g)` is `map(xs, (x) => g(f(x)))` —
  fewer hops, same result.
- **Anything eager downstream.** If the pipeline ends in `sort` or a `reduce` over
  everything, laziness bought nothing; use arrays and keep it simple.
- **Where iterator helpers already fit.** `xs.values().filter(f).map(g).take(n)` is shorter
  and needs no custom generators at all.
- **Deep recursion on a huge structure.** Delegation hops accumulate with depth; an
  explicit stack is the standard alternative.

## Gotchas

**Symptom:** A recursive generator returned nothing for children
**Cause:** `yield walk(child)` instead of `yield* walk(child)` — one generator object was
emitted per child.
**Fix:** Add the `*`.

**Symptom:** The last partial batch never appeared
**Cause:** `chunk` yields only when the buffer is full.
**Fix:** Flush after the loop — `if (buf.length) yield buf;`.

**Symptom:** The pipeline ran to completion despite a `break`
**Cause:** A stage collected everything eagerly (a `sort`, an `await Promise.all`, an array
build) before yielding.
**Fix:** Keep every stage one-value-at-a-time; move eager work to the end.

**Symptom:** A composed generator re-ran its first stage twice
**Cause:** Passing a generator *object* into two stages — it is one-shot.
**Fix:** Pass a factory, or an iterable object with `*[Symbol.iterator]()`.

**Symptom:** Deep traversal was slower than an explicit stack
**Cause:** Every value from depth *d* passes through *d* delegating generators.
**Fix:** Flatten the recursion into a stack-based loop when the structure is genuinely deep.

**Symptom:** Reusable `map`/`filter` generators duplicate the standard library
**Cause:** Iterator helpers already provide them.
**Fix:** `xs.values().map(f).filter(g)`; write custom stages only for what the helpers lack.

## Interview questions

**★ How do you write a recursive generator?**
`yield` the current node, then `yield*` the recursive call for each child. Delegation
flattens the nested generators into one sequence, keeps it lazy, and lets the consumer stop
mid-traversal with the whole chain unwinding through each `finally`.

**★ How does a batching stage stay lazy?**
It buffers values as it pulls them and yields a batch when the buffer fills, flushing the
partial batch after the loop. The consumer's pull drives everything, so nothing upstream is
read further than needed.

**★ Why does composing generators not break a two-way driver?**
Because `yield*` forwards `next`, `throw` and `return` to the delegate. A value sent with
`next(v)` reaches the innermost suspended `yield`, and an injected error is offered to the
innermost `try/catch` first.

**★ What is the cost of deep `yield*` recursion?**
Each value crosses one delegation boundary per level of depth. Structurally that is fine
for trees of ordinary depth and worth avoiding for very deep ones, where an explicit stack
is the usual alternative.

**When would you use `concat` as a generator instead of spread?**
When a later source is expensive or infinite. `[...a, ...b]` materialises everything;
delegation touches the second source only if the consumer gets that far.

---

← Prev [What `yield*` delegates](./01-what-it-delegates.md) · [Topic index](./README.md)
