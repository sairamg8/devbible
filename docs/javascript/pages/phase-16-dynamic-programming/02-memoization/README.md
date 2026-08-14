---
title: "02 · Memoization, top-down"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — algorithmic material at the standard treatment; JavaScript specifics against MDN ([`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Map.prototype.has()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/has), [`Infinity`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Infinity), [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)). Documentation-validated; **no timings**.

**Three additive lines turn a brute-force recursion into dynamic programming**, and they are the
same three every time. That is the entire argument for writing the brute force first.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The mechanical transformation](./01-the-transformation.md)** | The three lines — cache, check before computing, store before returning — and coin change worked from brute force to DP; 🔴 **`Infinity` rather than `-1` for "impossible"**, so the arithmetic needs no special case; 🔴 **`cache.has` versus a truthiness check**, where `0`/`false`/`""` silently revert the DP to exponential with no wrong answer to warn you; primitive keys, nested maps, and when a plain array beats a `Map`; 🔴 **the generic `memoize` wrapper that does nothing for a recursive function**; and what memoization does **not** fix |
| 2 | **[Choosing the key and converting](./02-keys-and-conversion.md)** | A key-choice table; 🔴 **never key on a substring** — the most common accidental slowdown in string DP; bitmask keys, and ⚠️ **the 31-item limit** because bitwise operators are 32-bit signed; the **four mechanical steps** of converting to bottom-up, of which 🔴 **only the iteration order requires thought** — and getting it backwards yields a plausible wrong answer; the two real reasons to convert (the stack, and space); and rolling arrays, with the honest note that they cost readability |

## The three sentences to keep

1. **Cache, check, store** — the recursion itself does not change, which is why the brute force
   comes first.
2. **`cache.has(key)`, never a truthiness check.** `0` is a legitimate answer, and a falsy check
   makes the DP exponential again with no visible symptom.
3. **Memoization does not reduce recursion depth.** That, not elegance, is why you convert to
   bottom-up.

## Phase gate

You are done with this topic when you can convert any brute force to top-down DP without thinking,
say why `has` is required, choose a key for a two-dimensional state and justify the multiplier,
convert to bottom-up and explain how you picked the iteration order, and state both complexities.

## Where this connects

- [01 · What DP is](../01-what-dp-is/README.md) — the conditions that license this transformation
- [03 · A problem-solving method](../03-problem-solving-method/README.md) — where the brute force comes from
- [Phase 14 · 02 · Hash maps and hash sets](../../phase-14-data-structures/02-hash-maps-and-sets/README.md) — SameValueZero, and why array keys never hit
- [Phase 14 · 04 · Stack](../../phase-14-data-structures/04-stack/README.md) — the recursion depth that forces the conversion

---

Start → [01 · The mechanical transformation](./01-the-transformation.md)
