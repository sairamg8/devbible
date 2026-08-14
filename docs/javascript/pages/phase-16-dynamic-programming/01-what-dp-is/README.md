---
title: "01 · What DP is"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — algorithmic material at the standard treatment; JavaScript specifics against MDN ([`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Infinity`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Infinity), [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER), [`RangeError`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RangeError)). Documentation-validated; **no timings**.

**Dynamic programming is a two-condition test, not a technique.** If both conditions hold the
transformation is mechanical; if either fails, no amount of caching helps — and knowing which one
failed tells you what to reach for instead.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The two conditions](./01-the-two-conditions.md)** | **Overlapping subproblems** (what makes DP *possible*) and **optimal substructure** (what makes it *correct*), each with a runnable test; 🔴 **a problem that has the first and not the second** — longest simple path — and why caching there gives a fast wrong answer; the three recognition signals and the counter-signals; ⚠️ **greedy as the alternative to rule out first**, with coin change `[1,3,4]` as the case where greedy is wrong; the two directions and why 🔴 **memoization does not fix a stack overflow**; and stating complexity as *states × work per state* |
| 2 | **[Spotting the state](./02-spotting-the-state.md)** | What a state is, in two interchangeable formulations; coin change and house robber worked, including 🔴 **the redundant second dimension** most people add; knapsack, where a second dimension is genuinely needed, and 🔴 **"pseudo-polynomial"** — why a capacity of 10⁹ defeats DP with 20 items; the three state-design mistakes, with **too little state presenting as "correct on small inputs, wrong on large ones"**; the JavaScript-specific bug of 🔴 **array keys comparing by reference so the cache never hits**; and a five-step checklist whose 🔴 **second step is the whole trick** — the brute force's parameters *are* the state |

## The three sentences to keep

1. **Overlapping subproblems make DP possible; optimal substructure makes it correct.** Check both.
2. **The state is whatever the brute-force recursion already passes down** — do not invent it,
   read it off.
3. **A `Map` key that is an array never hits.** Encode the state as a string or integer.

## Phase gate

You are done with this topic when you can test a problem for both conditions rather than
pattern-matching, name a problem that fails the second, justify each dimension of a state you
propose, and say why a memoized solution can still overflow the stack.

## Where this connects

- [02 · Memoization, top-down](../02-memoization/README.md) — the mechanical transformation these conditions license
- [03 · A problem-solving method](../03-problem-solving-method/README.md) — where "write the brute force first" comes from
- [Phase 13 · 02 · The complexity classes](../../phase-13-complexity/02-complexity-classes/README.md) — the memoisation test for an exponential recursion
- [Phase 15 · 02 · Sliding window](../../phase-15-algorithm-patterns/02-sliding-window/README.md) — one of the counter-signals

---

Start → [01 · The two conditions](./01-the-two-conditions.md)
