---
name: devbible-javascript-concepts-phase16
description: Load-bearing claims and sources for JavaScript phase 16 — dynamic programming and the problem-solving method
metadata:
  type: reference
---

*Child of [[devbible-javascript-concepts]]. Open when working on phase 16 or any DSA phase.*

Provenance: **documentation-validated**. Algorithmic results are standard; JavaScript-specific
claims checked against MDN. 🔴 **No page prints a timing.**

Phase 16 has **3 Master topics**. ✅ **All done** (commit `718d9b5`). 04–16 deferred.
Phase gate — *"solve coin change top-down, convert to bottom-up without looking, state both
complexities"* — is fully covered across 02·01, 02·02 and 03·02.

## Topic 01 · What DP is
- 🔴 **Two conditions, and they do different jobs**: **overlapping subproblems** makes DP
  *possible*; **optimal substructure** makes it *correct*. The second is the one people skip.
- 🔴 **The counterexample to have ready: longest SIMPLE path in a graph** — subproblems overlap but
  substructure is not optimal (paths might share a vertex), so caching gives a *fast wrong answer*.
- Runnable tests: "does the recursion get called twice with the same arguments?" and "if I hand you
  optimal sub-answers, can you combine them without knowing how they were built?"
- Recognition: "count the ways" / "min or max cost" / "is it possible" **+** choices at each step
  **+** a brute force that visibly recomputes. Counter-signals: "find ALL" → backtracking;
  uniform-cost shortest path → BFS; k largest → heap; contiguous+incremental → sliding window.
- ⚠️ **Rule greedy out first.** Coin change `[1,5,10,25]` greedy is correct; **`[1,3,4]` amount 6
  greedy gives 3, answer is 2**. If greedy cannot be proven safe, use DP — and say that is why.
- 🔴 **Memoization does NOT fix a stack overflow** — it reduces distinct calls, not depth. That,
  not elegance, is the usual reason to go bottom-up.
- State complexity as **states × work per state** — it also tells you instantly whether DP helped.

## Topic 01 · 02 — Spotting the state
- A state = the smallest set of values determining the rest; "what would I tell someone taking
  over?"
- 🔴 **The five-step checklist's step 2 is the whole trick: the brute force's parameters ARE the
  candidate state.** The state is read off, not invented.
- House robber: `i` alone suffices if framed as take-and-skip vs skip; `(i, tookPrevious)` is also
  correct with **twice the states** — spotting the redundant dimension is the skill.
- Knapsack needs `(index, remainingCapacity)`; 🔴 **pseudo-polynomial** — polynomial in the
  capacity's *value*, so capacity 10⁹ defeats it with 20 items.
- Three mistakes: too much state (exponential table = memoized brute force); 🔴 **too little state
  → "correct on small inputs, wrong on large ones"**, because collisions need two paths to reach
  one key; and **a non-hashable state** — `Map` keys that are arrays compare by reference.
- ⚠️ `Infinity` not `-1` as the impossible sentinel, so `1 + x` and `Math.min` need no guard.

## Topic 02 · Memoization, top-down
- **Three additive lines**: cache; check before computing; store before returning. The recursion is
  unchanged — which is the argument for writing the brute force first.
- 🔴 **`cache.has(key)`, never a truthiness check.** `0`, `false`, `""`, `NaN` are legitimate DP
  results and all falsy → the DP silently reverts to exponential **with no wrong answer** to warn
  you. `??` is subtly wrong too if `undefined`/`null` can be stored.
- 🔴 **The generic `memoize(fnInner)` wrapper does nothing for a recursive function** — inner calls
  bypass the wrapper, so only the outermost call is cached and it stays O(2ⁿ) *while looking
  memoized*. Recurse through the wrapped binding, or use a local cache + inner helper.
- ⚠️ A module-level memoize cache never evicts → a leak for request-scoped work.
- Keys: 🔴 **never key on a substring** (`s.slice(i)` allocates per call — the most common
  accidental slowdown in string DP); index instead. Bitmask keys for a used-set; ⚠️ **32-bit signed
  → safe to 31 items, `1 << 31` is negative** (TSP-style DP hits it at n = 32).
- Encoded 2-D key: `i * (m + 1) + j` — multiply by the **second** dimension's size.
- **Four conversion steps** (cache→table, base→initial value, recursion→ordered loop,
  return→table entry); 🔴 **only the iteration order needs thought**, and reversing it gives a
  plausible wrong answer. `dp[i+1]` in the recurrence ⇒ loop downwards.
- ⚠️ **Bottom-up is not always faster** — it computes every state, including unreachable ones.

## Topic 03 · A problem-solving method
- Seven steps: clarify → examples → brute force → optimise → code → test → complexity.
  🔴 **Steps 1–4 are a third of the time and decide the outcome.**
- ⚠️ **"How large is n?" is the highest-value question** — it converts optimisation from taste to
  arithmetic (n≤20 exponential ok; n≤1000 O(n²); n≥10⁵ needs O(n log n) *and* recursion depth is a
  risk).
- Examples must be written **before** any code, or they get reverse-engineered from the bug.
- 🔴 **The brute force is the input to the optimisation** — its parameters are the DP state; what
  it scans repeatedly becomes the hash-map lookup.
- Signal→pattern table, then 🔴 **say why the near-misses do not fit** (the phase-15 gate).
- Three transformations: scan-in-loop → lookup; sort → adjacency; revisiting recursion → memoise.
- Testing includes a 🔴 **JavaScript-specific bug pass**: `sort()` without a comparator, array keys
  in a `Map`, `shift()` in a loop, sums over `MAX_SAFE_INTEGER`.
- Close by **volunteering the trade not taken**.
- **The worked run (coin change)** demonstrates: three clarifying answers changing the solution; an
  example chosen to *disprove greedy*; BFS named as a valid near-miss and dismissed with a reason;
  a trace that confirms the `amount = 0` path depends on a line outside the loop; and a complexity
  statement naming **where the approach dies** (pseudo-polynomial at amount 10⁹) and why the
  rolling-array optimisation **does not apply** here.
- ⚠️ The run deliberately notes it does *not* show being stuck; the recovery is step 2 — walk a
  concrete example by hand.
