---
title: "02 · The complexity classes you actually meet"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort), [`Array.prototype.push()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push), [`Array.prototype.includes()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes). Documentation-validated; **no timings**.

**Six classes cover essentially all code you will write or be asked about**, and the useful skill
is recognising which one you are in from the shape of the code — plus knowing the ladder out when
the answer is one you cannot afford.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[O(1) to O(n log n)](./01-constant-to-linearithmic.md)** | Constant — and why *"constant"* means independent of n, not fast (a round trip is O(1)); what the spec really promises about `Map` (**sublinear**, not O(1)) and why `push` is amortised O(1) while `shift` is O(n); logarithmic, with the intuition that log₂ of a billion is 30 — and 🔴 **why binary search only pays once you search repeatedly**; linear as the class most code should stay in; and linearithmic as the practical floor for imposing order, with the **comparator called O(n log n) times** as the hidden multiplier |
| 2 | **[O(n²) and worse](./02-quadratic-and-worse.md)** | The quadratic you can see and 🔴 **the one-line version that actually ships**; where quadratic is genuinely fine and where it is a time bomb (n bounded by a CSV import); sorting to exploit adjacency; exponential and the wall at n ≈ 40, with **the test that decides whether memoisation helps** — does the recursion revisit states?; factorial and 13! ; the growth table showing **quadratic is the dangerous column, not the exponential ones**; and the six-step escape ladder |

## The three sentences to keep

1. **Constant means independent of n, not fast.** Sublinear is what `Map` actually guarantees.
2. **Quadratic is the dangerous class** — exponential hangs in testing, quadratic passes review
   and fails in production.
3. **If a recursion revisits states, memoise; if every leaf is distinct output, change the
   question.**

## Phase gate

You are done with this topic when you can name the class from a code shape without hesitating,
say why binary search does not always pay for itself, explain the difference between an
exponential that memoises away and one that does not, and give the ladder out of a quadratic in
order.

## Where this connects

- [01 · Big-O notation](../01-big-o/README.md) — the notation, and reading a bound off a loop nest
- [03 · Choosing a structure from the operations you need](../03-choosing-a-structure/README.md) — how to land in the class you want by construction
- [Phase 5 · 06 · `sort`](../../phase-5-built-in-library/06-sort/README.md) — the comparator that gets called O(n log n) times
- [Phase 5 · 10 · `Map` vs `Object`](../../phase-5-built-in-library/10-map-vs-object/README.md) — the lookup structure the escape ladder starts with

---

Start → [01 · O(1) to O(n log n)](./01-constant-to-linearithmic.md)
