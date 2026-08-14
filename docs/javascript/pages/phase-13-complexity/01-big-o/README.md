---
title: "01 · Big-O notation"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — definitional material from the standard analysis-of-algorithms treatment; JavaScript-specific claims checked against MDN ([`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Array.prototype.shift()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift)) and the V8 blog ([Elements kinds in V8](https://v8.dev/blog/elements-kinds), [How we made `JSON.stringify` more than twice as fast](https://v8.dev/blog/json-stringify)). Documentation-validated; **no timings**.

**Big-O describes how a cost grows as the input grows** — not a speed, not a duration, not a
claim about your machine. Half of this topic is the notation; the other half is reading a bound
off real JavaScript, where a single method call inside a loop is what makes it quadratic.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What the notation says](./01-what-the-notation-says.md)** | The definition and the two clauses everyone skips — *"beyond some input size"* and *"at most"*, so every O(n) algorithm is truthfully O(n²) and that answer is useless; dropping constants, and 🔴 **why "same complexity" is not "same cost"**; best/average/worst and where the distinction is load-bearing (quicksort, hash collisions); amortised as a guarantee over a *sequence*, not an average; space including the call stack; Ω and Θ; and the honest limits — constants, cache, the engine, and the round trip that dominates most web code |
| 2 | **[Reading a bound off the code](./02-reading-a-bound.md)** | The mechanical rules — sequential adds, nested multiplies, halving is log, divide-plus-linear is n log n — and ⚠️ **why a nested loop is not automatically O(n²)** (bound total iterations, not nesting depth); 🔴 **the table of JavaScript calls that hide a scan** and turn a loop quadratic, with `[...acc, x]` in a `reduce` as the most common accidental O(n²) in modern code; what the spec actually guarantees about `Map` (*sublinear*, not O(1)); V8's `ConsString` and why `+=` in a loop is fine **in V8**; and a worked quadratic-to-linear rewrite |

## The three sentences to keep

1. **Big-O is about growth, not duration** — and it is an upper bound, so give the tightest one
   you can justify.
2. **Count total iterations, not nesting depth.** Two pointers moving forward are linear; one
   `includes` inside a loop is quadratic.
3. **A scan inside a loop becomes a lookup built before the loop.** That single move fixes almost
   every accidental quadratic in application code.

## Phase gate

You are done with this topic when you can read a bound off a loop nest without hesitating, spot
the hidden linear cost in `includes`/`find`/`filter`/`shift`/spread, explain what the
specification actually promises about `Map` lookups, and say why a two-pointer algorithm with two
nested loops is O(n).

## Where this connects

- [02 · The complexity classes you actually meet](../02-complexity-classes/README.md) — each class with a JavaScript example
- [03 · Choosing a structure from the operations you need](../03-choosing-a-structure/README.md) — the decision this analysis feeds
- [Phase 5 · 10 · `Map` vs `Object`](../../phase-5-built-in-library/10-map-vs-object/README.md) — the two structures this topic keeps reaching for
- [Phase 0 · How JavaScript runs](../../phase-0-how-javascript-runs/README.md) — the engine whose behaviour the notation cannot see

---

Start → [01 · What the notation says](./01-what-the-notation-says.md)
