---
title: "03.2 · Searching over an answer"
sidebar_label: "02 · Over an answer"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — algorithmic material at the standard treatment; JavaScript specifics against MDN ([`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER), [`Number.EPSILON`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/EPSILON), [`Math.ceil()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/ceil)). Documentation-validated; **no timings**.

**The version that separates people who memorised binary search from people who understand it.**
There is no array. You binary-search the *space of possible answers*, and the comparison is a
function you write.

## The idea

If a predicate is **monotonic** over the answer range — false, false, …, false, true, true, …,
true — then binary search finds the boundary. That is the only requirement.

```js
function searchAnswer(lo, hi, isGoodEnough) {
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);     // 🔴 not >>, see below
    if (isGoodEnough(mid)) hi = mid;                // mid works — try smaller
    else lo = mid + 1;                              // mid fails — go bigger
  }
  return lo;                                        // smallest value that works
}
```

Same template as [01 · The template](./01-the-template.md), with `isGoodEnough(mid)` in place of
`arr[mid] >= target`.

🔴 **Use `Math.floor((hi - lo) / 2)` here, not `>>`.** The answer range is frequently larger than
2³¹ — a capacity, a total weight, a number of nanoseconds — and `>>` coerces to 32-bit signed,
silently producing a negative midpoint. This is the concrete case behind the warning in the
previous chunk, and it is the one that actually bites.

⚠️ **The range must also stay inside `Number.MAX_SAFE_INTEGER`** (2⁵³ − 1). Above it, `mid + 1`
may equal `mid` and the loop never terminates. `BigInt` is the fix if the range is genuinely that
large.

## The worked example: ship capacity

*Given package weights and D days, find the smallest ship capacity that delivers everything in
order within D days.*

There is no array to search. The **answer** ranges from `max(weights)` (a ship must carry the
heaviest single package) to `sum(weights)` (carry everything in one day). And the predicate is
monotonic: **if capacity C works, every capacity above C also works.**

```js
function shipCapacity(weights, days) {
  const canDo = (capacity) => {
    let needed = 1, load = 0;
    for (const w of weights) {
      if (load + w > capacity) { needed++; load = 0; }
      load += w;
    }
    return needed <= days;
  };

  let lo = Math.max(...weights);          // ⚠️ spread — see the note
  let hi = weights.reduce((a, b) => a + b, 0);

  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (canDo(mid)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}
```

**O(n log(sum))** — the check is O(n) and the search is logarithmic in the *value* range, not in n.
Naming that complexity correctly is part of the answer.

⚠️ **`Math.max(...weights)` throws `RangeError: Maximum call stack size exceeded` on a large
array**, because spread passes every element as an argument. Above roughly 100,000 elements use a
reduce or a loop. It is a genuine JavaScript-specific failure that language-agnostic solutions do
not have.

## Recognising it

🔴 **Three signals, and you need all three:**

1. The question asks for a **minimum or maximum value** that satisfies a condition — "smallest
   capacity", "minimum days", "largest minimum distance", "maximum number of…".
2. Checking a **specific** candidate is easy (usually a linear pass).
3. The check is **monotonic** — if a value works, everything above (or below) it works too.

Signal 3 is the one to verify explicitly. If the predicate flickers, binary search returns an
arbitrary boundary and the answer is wrong in a way that passes small tests.

**The family:**

| Problem | Search over | Predicate |
|---|---|---|
| Ship capacity in D days | capacity | can deliver within D days |
| Koko eating bananas | eating speed | finishes within H hours |
| Split array into k subarrays, minimise the largest sum | that largest sum | a valid split exists |
| Minimum time to complete tasks | time | all tasks fit |
| Largest minimum distance between points | distance | that many points can be placed |
| Median of two sorted arrays | partition index | left halves are ≤ right halves |
| `sqrt(x)` as an integer | the root | `mid * mid <= x` |

## Floating-point ranges

When the answer is real-valued, "shrink until the interval is empty" never happens.

```js
function searchReal(lo, hi, isGoodEnough, iterations = 100) {
  for (let i = 0; i < iterations; i++) {           // 🔴 fixed count, not a tolerance
    const mid = (lo + hi) / 2;
    if (isGoodEnough(mid)) hi = mid;
    else lo = mid + 1e-12;
  }
  return lo;
}
```

🔴 **Iterate a fixed number of times rather than looping until `hi - lo < epsilon`.** Each
iteration halves the interval, so 100 iterations is far past double precision — the loop is
guaranteed to terminate, and there is no epsilon to choose wrongly. A tolerance-based loop can spin
forever when the values are large enough that halving no longer changes the representable value.

`Number.EPSILON` (about 2.22 × 10⁻¹⁶) is the smallest difference from 1.0 — it is a *relative*
bound, so using it as an absolute tolerance on large numbers is another way this goes wrong.

## Gotchas

**Symptom:** A negative midpoint on a large range
**Cause:** `>>` coerces to 32-bit signed.
**Fix:** `Math.floor((hi - lo) / 2)` when the range can exceed 2³¹.

**Symptom:** An infinite loop on a very large range
**Cause:** Above `Number.MAX_SAFE_INTEGER`, `mid + 1 === mid`.
**Fix:** `BigInt`, or bound the range.

**Symptom:** The answer is wrong although each check is right
**Cause:** The predicate is not monotonic over the range.
**Fix:** Verify monotonicity explicitly; if it flickers, this is not the pattern.

**Symptom:** `RangeError` from `Math.max(...arr)`
**Cause:** Spread passes every element as an argument, exceeding the call-stack limit.
**Fix:** `arr.reduce((a, b) => Math.max(a, b), -Infinity)`.

**Symptom:** The complexity is quoted as O(log n)
**Cause:** It is O(n log(range)) — the check is linear and the search is over values, not indices.
**Fix:** State both factors.

**Symptom:** A floating-point search never terminates
**Cause:** Looping until `hi - lo < epsilon` on large values.
**Fix:** A fixed iteration count — 100 halvings exhausts double precision.

**Symptom:** The bounds are wrong and the answer is impossible
**Cause:** `lo` set below the minimum feasible value (e.g. below the heaviest package).
**Fix:** Derive the bounds from the problem's constraints, and check both ends are feasible.

## Interview questions

**★ What does "binary search over the answer" mean?**
Instead of searching an array, you search the range of possible answers. It works whenever the
predicate "does this candidate satisfy the requirement?" is **monotonic** over that range — false
up to some boundary, true after it. The comparison is a function you write rather than an array
lookup.

**★ How do you recognise it from a problem statement?**
Three signals together: it asks for a minimum or maximum value satisfying a condition; checking a
specific candidate is easy; and the check is monotonic. The third is the one to verify explicitly.

**★ Ship-capacity problem — what are the bounds and the complexity?**
`lo = max(weights)` (a ship must carry the heaviest package) and `hi = sum(weights)` (everything in
one day). The predicate is a linear greedy pass, so the whole thing is **O(n log(sum))** — the
search is logarithmic in the value range, not in n.

**★ Why `Math.floor((hi - lo) / 2)` rather than `>>` here specifically?**
Because the answer range routinely exceeds 2³¹, and `>>` coerces to 32-bit signed — producing a
negative midpoint. For arrays it cannot happen; for answer ranges it can and does.

**★ What breaks above `Number.MAX_SAFE_INTEGER`?**
`mid + 1` can equal `mid`, so the interval stops shrinking and the loop never terminates. Use
`BigInt`, or establish that the range is smaller than 2⁵³.

**★ How do you binary-search a real-valued answer?**
Iterate a **fixed** number of times — 100 halvings is far past double precision — rather than
looping until the interval is smaller than some epsilon. A tolerance-based loop can spin forever
when halving no longer changes the representable value.

**Why is `Math.max(...weights)` a risk?**
Spread passes every element as a separate argument, so a large array overflows the call stack with
a `RangeError`. Use `reduce` above roughly 100,000 elements.

---

← [01 · The template](./01-the-template.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
