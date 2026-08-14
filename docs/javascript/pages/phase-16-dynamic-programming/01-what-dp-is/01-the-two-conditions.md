---
title: "01.1 · The two conditions"
sidebar_label: "01 · The two conditions"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — algorithmic material at the standard treatment; JavaScript specifics against MDN ([`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER), [`RangeError`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RangeError)). Documentation-validated; **no timings**.

**Dynamic programming is a two-condition test, not a technique to learn.** If both conditions
hold, the mechanical transformation in [02 · Memoization](../02-memoization/README.md) applies and
the problem is solved. If either fails, no amount of caching helps — and knowing *which* one fails
tells you what to do instead.

## Condition 1 — overlapping subproblems

**The same subproblem is solved more than once.**

```js
function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}
```

`fib(5)` calls `fib(3)` twice, `fib(2)` three times, `fib(1)` five times. The recursion tree has
O(2ⁿ) nodes but only **n distinct** arguments — so the vast majority of the work is recomputation.

🔴 **This is the condition that makes DP *possible*.** Cache the n distinct results and the
exponential collapses to linear.

**The test, stated as something you can actually run:** *does the recursion ever get called twice
with the same arguments?* Write the brute force, look at what the recursive calls receive, and ask
whether those arguments repeat. If every call has a unique argument tuple — as in generating all
2ⁿ subsets — **there are no overlapping subproblems and DP does nothing**. The output really is
exponential ([Phase 13 · 02 · 02](../../phase-13-complexity/02-complexity-classes/02-quadratic-and-worse.md)).

## Condition 2 — optimal substructure

**The optimal answer is built from optimal answers to subproblems.**

Coin change has it: the fewest coins for amount *n* is one more than the fewest coins for
*n − coin*, minimised over coins. You can solve the subproblem without knowing anything about how
it will be used.

🔴 **This is the condition that makes DP *correct***, and it is the one people skip. Overlapping
subproblems without optimal substructure gives you a fast wrong answer.

**Where it fails:** when a subproblem's best answer depends on context outside itself. The
canonical example is the **longest simple path** in a graph — the longest path from A to C is not
built from the longest path from A to B, because the two might reuse a vertex, which the "simple"
constraint forbids. The subproblem cannot be solved in isolation, so the DP recurrence is wrong
even though the subproblems visibly overlap.

**The test:** *if I hand you the optimal answer to every smaller case, can you combine them into
the optimal answer here — without re-examining how those answers were built?* If you need to know
the *contents* of the sub-answers rather than their values, substructure is not optimal.

## Recognising DP from a problem statement

🔴 **Three signals; the first two together are usually enough:**

1. **"Count the number of ways", "the minimum/maximum cost", or "is it possible"** — DP answers
   these three shapes far more often than any other.
2. **Choices at each step**, where the choice affects what remains — take this coin or not, take
   this item or not, jump 1 or 2.
3. **A brute force that is exponential and visibly recomputes.**

**Strong counter-signals** — these usually mean *not* DP:

- "Find *all* the ways" (not count) → backtracking; the output is exponential by definition.
- "The shortest path with uniform edge cost" → BFS.
- "The k largest" → a heap.
- "A contiguous subarray with a simple property" → sliding window
  ([Phase 15 · 02](../../phase-15-algorithm-patterns/02-sliding-window/README.md)).

⚠️ **Greedy is the alternative to check first.** When a locally best choice is provably globally
best — as in coin change with a *canonical* coin system — greedy is O(n) and DP is overkill. Coin
change is the standard illustration because greedy is correct for `[1, 5, 10, 25]` and **wrong**
for `[1, 3, 4]` with amount 6 (greedy gives 4+1+1 = 3 coins; the answer is 3+3 = 2). **If you
cannot prove greedy is safe, use DP** — and say that is why.

## The two directions

| | Top-down (memoization) | Bottom-up (tabulation) |
|---|---|---|
| Shape | recursion + cache | loop filling a table |
| Order | driven by the recursion | you choose it, and must get it right |
| Computes | only the states actually needed | every state in the table |
| Risk | 🔴 **call-stack overflow** | wrong iteration order |
| Space | cache + stack frames | table, often reducible to O(1) rows |

**Write top-down first.** It is a mechanical transformation of the brute force you already have,
the recursion decides the evaluation order for you, and it skips unreachable states. Convert to
bottom-up when the recursion depth threatens the stack or when you want the space optimisation.

🔴 **The stack limit is a real constraint in JavaScript**, not a theoretical one — a memoized
recursion over an input of 100,000 elements throws `RangeError: Maximum call stack size exceeded`
([Phase 14 · 04](../../phase-14-data-structures/04-stack/README.md)). That, rather than elegance,
is usually the reason to convert.

## Stating the complexity

**Time = (number of distinct states) × (work per state).** Space = states + recursion depth.

```js
// coin change: amounts 0..n, and for each we try every coin
// states = n + 1, work per state = coins.length
// → O(n · coins.length) time, O(n) space
```

🔴 **Say it in that form.** "O(n·m)" alone invites "why?"; "there are n·m states and each does
constant work" is the answer, and it also tells you immediately whether the DP is even feasible —
if the state count is exponential, DP has not helped.

## Gotchas

**Symptom:** Memoizing changes nothing
**Cause:** No overlapping subproblems — every call has unique arguments.
**Fix:** The output is genuinely exponential. Prune, approximate, or change the requirement.

**Symptom:** A DP solution is fast and wrong
**Cause:** Optimal substructure does not hold — a subproblem's best answer depends on context.
**Fix:** Enlarge the state so it captures the context, or accept that DP does not apply.

**Symptom:** Greedy passes the examples and fails on a hidden case
**Cause:** The locally best choice is not globally best — coin change with `[1,3,4]`.
**Fix:** Use DP unless greedy can be proven safe.

**Symptom:** `RangeError: Maximum call stack size exceeded` in a memoized solution
**Cause:** Recursion depth, which memoization does not reduce.
**Fix:** Convert to bottom-up.

**Symptom:** The DP table does not fit in memory
**Cause:** The state space is exponential — DP did not help.
**Fix:** Reconsider the state, or the problem.

**Symptom:** A backtracking problem is attacked with DP
**Cause:** "Find all" was read as "count".
**Fix:** Counting is DP; enumerating is backtracking, and its cost is the output size.

**Symptom:** Large counts come out subtly wrong
**Cause:** Results exceeded `Number.MAX_SAFE_INTEGER`.
**Fix:** `BigInt`, or the modulus the problem specifies.

## Interview questions

**★ What are the two conditions for DP?**
**Overlapping subproblems** — the same subproblem is solved more than once, which is what makes
caching *possible*; and **optimal substructure** — the optimal answer is built from optimal
sub-answers, which is what makes it *correct*. Both are required, and the second is the one people
skip.

**★ Give a problem with overlapping subproblems but no optimal substructure.**
Longest **simple** path in a graph. The subproblems overlap, but the longest path from A to C is
not built from the longest A→B path — they might share a vertex, which the simple-path constraint
forbids. So the recurrence is wrong even though caching would work.

**★ How do you recognise DP from a problem statement?**
"Count the ways", "minimum/maximum cost", or "is it possible", **plus** choices at each step that
affect what remains, **plus** a brute force that visibly recomputes. "Find all the ways" is the
counter-signal — that is backtracking, and its cost is the output size.

**★ When is greedy enough?**
When a locally optimal choice is provably globally optimal. Coin change is the standard
illustration: greedy is correct for `[1,5,10,25]` and wrong for `[1,3,4]` at amount 6 — greedy
gives three coins, the answer is two. If you cannot prove greedy is safe, use DP.

**★ Top-down or bottom-up first?**
Top-down. It is a mechanical transformation of the brute force, the recursion picks the evaluation
order for you, and it only computes states you actually reach. Convert to bottom-up when recursion
depth threatens the stack — which in JavaScript is a real limit — or for the space optimisation.

**★ How do you state a DP's complexity?**
States × work per state. "There are n·m states and each does constant work" answers the follow-up
before it is asked, and it immediately tells you whether the DP is feasible — an exponential state
count means DP has not helped.

**Does memoization fix a stack overflow?**
No. It reduces the number of *distinct* calls, not the recursion **depth**. A memoized solution
over a deep input still overflows; only converting to a loop fixes that.

---

[Topic index](./README.md) · Next → [02 · Spotting the state](./02-spotting-the-state.md)
