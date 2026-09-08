---
title: "The interview move that matters most in counting is deciding whether a 'how many ways' question has a closed form or is dynamic programming in disguise — and the test is mechanical: try to write the count as a function of a state, then ask how large the state space is"
sidebar_label: "08f · Closed form, or DP?"
sidebar_position: 8.5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The decision procedure, the worked recurrences and the fragility argument
> are **mathematics and common practice, derived on this page, not cited to a source**. The
> dynamic-programming catalogue itself belongs to
> [Part 6 of the syllabus](../../syllabus/06-backtracking-greedy-and-dp.md); this page owns only
> the recognition step. Java targets **JDK 25**; TypeScript first, Java second. Builds on
> [08](08-combinatorics-for-counting-problems.md) through
> [08e](08e-inclusion-exclusion-and-derangements.md). **No sandbox run.**

**Almost every "count the ways" question is one of three things, and telling them apart takes about
thirty seconds if you know what to ask.** It is a closed form when the object decomposes into
independent choices, or into a symmetric over-count you can divide away. It is a dynamic program
when the choices are *coupled* — the options at step `i` depend on what happened earlier — but the
part of the history that matters is small. It is neither when the coupling needs the whole history,
and then you are enumerating and the answer is exponential. Getting this wrong in either direction
is expensive: hunting for a formula that does not exist burns the whole interview, and writing a
Θ(n·k) table for something that is `C(m+n, n)` says you did not look.

## The test, in order

Ask these four questions about the object being counted, in this order. Stop at the first yes.

**1 · Does the construction factor into independent choices?** If the *number* of options at each
step does not depend on the earlier choices, multiply — closed form. Product variants, functions from
one set to another, sequences over a fixed alphabet.

**2 · Is it an easy count divided by a symmetry?** Count with an artificial order or with labels,
then divide by the number of arrangements that produce the same object. Combinations, multiset
permutations, stars and bars, necklaces.

**3 · Does it match a classical family by a bijection?** Lattice paths that must not cross a line,
non-crossing structures, "a running total that never goes negative" — Catalan
([08d](08d-catalan-numbers.md)). A handful of overlapping forbidden properties — inclusion–exclusion
([08e](08e-inclusion-exclusion-and-derangements.md)). Recognising the bijection *is* the answer here.

**4 · Otherwise: what is the smallest summary of the history that determines the rest?** That summary
is the DP state. Write `f(state)` and count the states. Polynomially many, with cheap transitions —
dynamic programming. Exponentially many — either a bitmask DP if the state is a subset of a small
set, or an enumeration with pruning ([06h](06h-feasibility-pruning.md)).

🔴 **Step 4 is the one people skip.** "I can't find a formula" is not an answer; "the count depends on
the history only through *X*, and there are `n·k` values of *X*" is. The question being tested is
whether you can name the state, not whether you remember a formula.

## The pairs that look identical and are not

| Question | Answer | Why |
|---|---|---|
| paths on an empty `m × n` grid, right/down only | `C(m+n−2, m−1)` | choose which steps are "down" — independent |
| the same grid **with obstacles** | Θ(m·n) DP | an obstacle couples the choices; no formula survives |
| arrangements of `n` distinct items | `n!` | independent choices |
| arrangements with **no item in its own place** | `D_n`, by inclusion–exclusion | overlapping forbidden positions |
| binary strings of length `n` | `2^n` | independent |
| binary strings of length `n` **with no two adjacent 1s** | Fibonacci DP | each choice constrains the next |
| ways to climb `n` stairs in 1 or 2 steps | Fibonacci DP | a recurrence, and the closed form is unusable in integers |
| ways to make `n` from unlimited coins | Θ(n · coins) DP | no closed form for general coin sets |
| BST **shapes** on `n` keys | Catalan `C_n` | the root split gives a convolution |
| BST shapes with a **depth limit** | DP over `(keys, depth)` | the constraint breaks the reflection argument |
| subsets of `n` items | `2^n` | independent include/exclude |
| subsets summing to `T` | Θ(n·T) DP | the running sum couples the choices |

Read down the pairs: **in every case, the closed form dies the moment a constraint couples two
choices, and the recurrence survives.** That is the general lesson and it is worth saying out loud —
closed forms are fragile, recurrences are robust — because it tells an interviewer you know *why* the
formula stopped applying rather than merely that it did.

## Worked: the same problem on both sides of the line

Unique paths on a grid, and then with obstacles.

```ts
// No obstacles: pure multiplication-and-divide. Θ(min(m, n)) time, Θ(1) space.
export function uniquePaths(m: number, n: number): number {
  return choose(m + n - 2, m - 1);        // choose which of the m+n−2 steps go down
}

// With obstacles: the closed form is gone; the recurrence is not.
export function uniquePathsWithObstacles(grid: number[][]): number {
  const m = grid.length, n = grid[0].length;
  const dp = new Array<number>(n).fill(0);
  dp[0] = grid[0][0] === 1 ? 0 : 1;
  for (let r = 0; r < m; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c] === 1) { dp[c] = 0; continue; }        // blocked: no paths end here
      else if (c > 0) dp[c] += dp[c - 1];                   // from the left; dp[c] is from above
    }
  }
  return dp[n - 1];                                          // Θ(m·n) time, Θ(n) space
}
```

```java
// Java: the obstacle version, one row of state. `long` because path counts grow like a binomial.
public static long uniquePathsWithObstacles(int[][] grid) {
    int m = grid.length, n = grid[0].length;
    long[] dp = new long[n];
    dp[0] = grid[0][0] == 1 ? 0L : 1L;
    for (int r = 0; r < m; r++) {
        for (int c = 0; c < n; c++) {
            if (grid[r][c] == 1) dp[c] = 0L;
            else if (c > 0) dp[c] += dp[c - 1];
        }
    }
    return dp[n - 1];
}
```

The state here is `(row, column)` and the transition is "the last step was from above or from the
left" — a decomposition on the **last decision**, which is the shape of essentially every counting
DP. Say the state and the transition and the code follows; reach for the code first and you will
spend the time rediscovering them.

## The second half of step 4: read the constraints for the answer

The input limits usually settle it before the mathematics does, and quoting the reasoning is a strong
signal:

| Constraint in the statement | What it implies |
|---|---|
| `n ≤ 20`, "count the ways" | subset/bitmask enumeration, or a DP over subsets — 2^n is affordable |
| `n ≤ 100`, a second dimension `≤ 100` | a two-dimensional table, Θ(n²) |
| `n ≤ 10^5`, answer modulo a prime | Θ(n) or Θ(n log n) — a precomputed factorial table with inverses, or a linear DP |
| `n ≤ 10^18` | a closed form, matrix exponentiation, or digit DP — nothing that iterates over `n` |
| "modulo 10^9 + 7" at all | the exact answer does not fit; see [08](08-combinatorics-for-counting-problems.md) |

The `n ≤ 10^18` row is the one that most often *forces* the closed form: if you cannot iterate over
`n`, a recurrence has to be either solved in closed form or evaluated by matrix exponentiation, which
is that topic's business ([Matrix exponentiation](12-matrix-exponentiation.md)).

## When the answer is "both"

Some counts have a closed form *and* a DP, and choosing between them is a real decision rather than a
tie. Binomial coefficients are the standard case: the multiplicative loop is Θ(k) for one value, and
Pascal's table is Θ(n²) once and Θ(1) per query with no division — which is why the table wins under
a modulus and loses for a single large-`n` query
([08b](08b-pascals-rule-and-the-dp-table.md)). Catalan numbers are the same story: closed form for
one value, convolution DP when there is an extra constraint or a modulus
([08d](08d-catalan-numbers.md)).

The tiebreakers, in order: **does the problem need many values or one; is there a modulus (which
makes division expensive and addition free); and is the closed form's derivation still valid under
the problem's constraints.** That third one is the one that catches people — a formula recalled for
the unconstrained version of a problem is a wrong answer, not an approximation.

## Gotchas

**★ Symptom: twenty minutes spent hunting for a formula that does not exist.** Cause: skipping step
4 — "I can't find a closed form" treated as a dead end rather than as the signal to name a state. Fix:
write `f(state) = …` explicitly and count the states. If the count is polynomial you have the
algorithm; if it is exponential in a small `n`, it is a bitmask DP; if neither, it is an enumeration
with pruning.

**★ Symptom: a closed form recalled for the unconstrained problem and applied to the constrained
one.** Cause: matching the problem's *shape* rather than checking its constraints — grid paths with
obstacles answered with `C(m+n−2, m−1)`, BST shapes with a depth limit answered with `C_n`. Fix:
every closed form on these pages has a derivation that assumes no extra constraint; when a constraint
is added, the derivation is what breaks, and the recurrence underneath it is what survives.

**★ Symptom: a Θ(n·k) DP written for something that is a single binomial.** Cause: not running step
1 or 2 — the choices really were independent, or the over-count really was a clean division. Fix:
before writing a table, ask whether any choice constrains a later one. If none does, it is a product;
if the only coupling is order-irrelevance, it is a division.

**★ Symptom: a counting DP that recomputes and is exponential.** Cause: the recurrence written and
the memo forgotten — the recursion then has one leaf per object, so counting costs the same as
enumerating. Fix: memoise on the state, or build bottom-up. This is exactly the difference between
the two `C(n, k)` recursions in [08b](08b-pascals-rule-and-the-dp-table.md).

**★ Symptom: the DP state includes information the answer does not depend on, and the table does not
fit.** Cause: carrying the whole path instead of its summary. Fix: the state is the *smallest* thing
that determines the rest — for subset-sum counting it is the running total, not which items were
chosen; for no-two-adjacent it is the last decision, not the whole string. Halving the state
dimension is usually a matter of asking what the transition actually reads.

**Symptom: the constraints in the problem statement never consulted.** Cause: treating the limits as
noise. Fix: `n ≤ 20` says bitmask, `n ≤ 10^5` with a modulus says linear, `n ≤ 10^18` says closed form
or matrix exponentiation. The limits are the setter telling you the intended complexity, and reading
them out loud is a cheap way to show you did.

**Symptom: the closed form is right and the submission is wrong under a modulus.** Cause: a division
in the formula, which is not a modular operation. Fix: either replace the division with a modular
inverse, or use the additive DP form, which never divides — the reason Pascal's table and the Catalan
convolution are the modulus-friendly implementations.

## Interview questions

**★ How do you decide whether a counting problem has a closed form or needs a DP?**
Four questions in order. Does the construction factor into independent choices, where the *number* of
options at each step does not depend on earlier ones — then multiply. Is it an easy ordered count
divided by a symmetry — then it is a combination, a multiset permutation or stars and bars. Does it
match a classical family by a bijection — non-crossing structures and never-negative running totals
are Catalan, a handful of overlapping forbidden properties is inclusion–exclusion. If none of those,
ask what the smallest summary of the history is that determines the remaining count: that is the DP
state, and counting the states tells you whether it is polynomial, a bitmask DP, or an enumeration.
The last step is the one that separates a good answer from a stuck one.

**★ Give an example of two problems that look identical and are on opposite sides of the line.**
Counting right/down paths across an `m × n` grid is `C(m+n−2, m−1)` — the path is determined by which
of the `m+n−2` steps go down, and those choices are unconstrained. Add a single blocked cell and
there is no closed form at all: the obstacle couples the choices, and the answer is a Θ(m·n) table
whose state is `(row, column)` and whose transition splits on whether the last step came from above
or from the left. The general pattern is that the closed form dies the moment a constraint couples
two choices, while the recurrence underneath it survives unchanged — which is why it is worth being
able to derive the formula rather than recall it, since the derivation shows you exactly which
assumption the constraint broke.

**★ A problem says `n ≤ 10^18` and asks for a count. What does that tell you?**
That no algorithm may iterate over `n`, so the answer is a closed form, a matrix exponentiation of a
linear recurrence, or a digit DP over the ~60 bits or ~19 decimal digits of `n`. It also strongly
implies the count will not fit in a machine integer, so expect a modulus. Reading the limits this way
is fast and reliable: `n ≤ 20` means a subset enumeration or a bitmask DP is intended, `n ≤ 100` with
a second dimension means a two-dimensional table, `n ≤ 10^5` with a modulus means linear or
linearithmic. The limits are the setter stating the intended complexity.

**★ What is the state, and how do you know it is small enough?**
The state is the minimum summary of the history that determines how many completions remain. For
counting subsets that sum to `T`, it is the running total and the index — not which items were
chosen. For counting binary strings with no two adjacent ones, it is the index and the last bit — not
the string. The test is mechanical: write the transition and see what it reads; anything the
transition never reads does not belong in the state. Then multiply the ranges. If the product is
polynomial you have an algorithm, if it is `2^n` for a small `n` you have a bitmask DP, and if it is
neither the problem is an enumeration and the answer is exponential — which is a legitimate final
answer when the output is exponential too.

**Why do people say a counting problem is "dynamic programming in disguise"?**
Because the phrasing hides the recurrence. "How many ways" sounds like it wants a formula, so the
instinct is to search memory for one; but the moment any choice constrains a later choice, no formula
exists and what is left is a recurrence over a state — which is dynamic programming whether or not
the problem uses the words. The disguise is usually one clause: "with no two adjacent", "avoiding the
blocked cells", "such that the running total never goes negative", "using each coin at most twice".
Each of those clauses is the coupling, and finding it is the same skill as finding the assumption a
closed-form derivation would have needed.

---

← Prev: [08e · Inclusion–exclusion, derangements](08e-inclusion-exclusion-and-derangements.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [08g · The pigeonhole principle](08g-the-pigeonhole-principle.md)
