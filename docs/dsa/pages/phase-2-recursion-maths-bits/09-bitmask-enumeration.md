---
title: "A subset of an n-element set is an integer between 0 and 2^n − 1, and that single bijection is the whole technique — it turns a set you cannot compare or index by into a small integer you can use as an array subscript"
sidebar_label: "09 · Bitmask enumeration"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The set-to-integer bijection, the subset counts and the complexity
> arithmetic are **mathematics derived on this page**, not cited. The JavaScript 32-bit truncation
> that bounds the technique is quoted from MDN,
> [Bitwise AND](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_AND),
> and worked through in [09b](09b-precedence-and-the-32-bit-loop-bound.md). Java's `Integer` bit
> methods and their zero cases are quoted in
> [04d](04d-counting-set-bits-and-the-platform-methods.md) from the JDK 25 javadoc. **No sandbox
> run**: this page carries code and derivations, never program output.
> Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**There is exactly one idea in bitmask enumeration, and it is a bijection: label the elements of a
set `0 … n-1`, and every subset becomes the integer whose bit `i` is set when element `i` is in.
Everything else — the DP, the travelling salesman, the partition counting — is bookkeeping on top of
that one correspondence.** The payoff is not that bits are fast. It is that a *subset*, which is
otherwise a `Set` you cannot compare, hash cheaply or use as an array index, becomes a small integer
that you can do all three with. A memo keyed by "which items have I used" stops being a
`Map<string, number>` over serialised keys and becomes `dp[mask]`.

[Topic 04](04-bit-manipulation.md) owns the bit operations themselves — `x & (x-1)`,
`x & -x`, popcount, the submask walk. This topic owns *using them as an algorithm*: the enumeration
loop, the order you generate masks in, the shape of a DP over masks, and the honest ceiling where
the whole family stops being admissible. Nothing below re-derives an idiom from 04; it links to it.

## The bijection, stated properly

Fix an ordering of the `n` elements — an array is already one. Define, for a subset `S`:

```
code(S) = Σ over i in S of 2^i
```

This is a **bijection** between the `2^n` subsets and the integers `0 … 2^n − 1`, because binary
representation is unique: each integer in that range has exactly one `n`-bit expansion, and each
expansion names exactly one subset. `0` is the empty set, `2^n − 1` (all ones, `(1 << n) - 1`) is
the full set.

Under the bijection every set operation is one machine instruction:

| Set operation | Mask expression |
|---|---|
| `i ∈ S` | `(mask >> i & 1) === 1`, or `(mask & (1 << i)) !== 0` |
| `S ∪ {i}` | `mask \| (1 << i)` |
| `S \ {i}` | `mask & ~(1 << i)` |
| toggle `i` | `mask ^ (1 << i)` |
| `A ∪ B` · `A ∩ B` · `A \ B` | `a \| b` · `a & b` · `a & ~b` |
| `A ⊆ B` | `(a & b) === a` |
| complement within `n` items | `mask ^ ((1 << n) - 1)` |
| `\|S\|` | popcount — [04d](04d-counting-set-bits-and-the-platform-methods.md) |
| lowest element of `S` | `mask & -mask` — [04c](04c-clearing-and-isolating-the-lowest-bit.md) |

That table is the whole reason the representation exists. A `Set<number>` supports the same
operations in time proportional to its size; the mask supports them in one operation each, and — the
part that actually matters — supports **equality and array indexing**, which a `Set` does not.

🔴 **The bijection is only well-defined relative to the ordering you fixed.** Nothing in the mask
records which array it was built against. Two functions in the same solution that disagree about
element order produce masks that are individually valid and jointly meaningless, and the bug shows up
as a wrong answer with no bad index and no exception.

## The enumeration loop

```ts
export function forEachSubset(n: number, fn: (mask: number) => void): void {
  const limit = 1 << n;              // 2^n — see 09b before trusting this for n >= 31
  for (let mask = 0; mask < limit; mask++) fn(mask);
}
```

Reading membership out is the inner loop, and it is `Θ(n)` per mask, so a full enumeration that
touches every element of every subset is `Θ(2^n · n)`:

```ts
export function powerSet<T>(items: readonly T[]): T[][] {
  const n = items.length;
  const out: T[][] = [];
  for (let mask = 0; mask < (1 << n); mask++) {
    const subset: T[] = [];
    for (let i = 0; i < n; i++) {
      if ((mask & (1 << i)) !== 0) subset.push(items[i]);
    }
    out.push(subset);
  }
  return out;
}
```

```java
static <T> List<List<T>> powerSet(List<T> items) {
    int n = items.size();
    List<List<T>> out = new ArrayList<>(1 << n);
    for (int mask = 0; mask < (1 << n); mask++) {
        List<T> subset = new ArrayList<>(Integer.bitCount(mask));
        for (int i = 0; i < n; i++) {
            if ((mask & (1 << i)) != 0) subset.add(items.get(i));
        }
        out.add(subset);
    }
    return out;
}
```

**`Θ(2^n · n)` is a lower bound for this problem, not an inefficiency** — the output alone has
`2^n` subsets whose sizes sum to `n · 2^(n-1)`, because each of the `n` elements appears in exactly
half of the subsets. There is no cleverer way to *print* every subset. The optimisation that matters
is not producing them at all, which is what a DP over masks does
([09e](09e-dp-over-masks-the-shape-and-the-cost.md)).

If you only need the elements that are present, iterate the set bits instead of all `n` positions —
`m &= m - 1` peels one per iteration, so the inner loop runs `popcount(mask)` times rather than `n`
([04c](04c-clearing-and-isolating-the-lowest-bit.md),
[04d](04d-counting-set-bits-and-the-platform-methods.md)):

```java
for (int m = mask; m != 0; m &= m - 1) {
    int i = Integer.numberOfTrailingZeros(m);       // safe: m != 0 is the loop condition
    subset.add(items.get(i));
}
```

Summed over all masks that is `n · 2^(n-1)` iterations rather than `n · 2^n` — the same complexity
class, half the work, and it is the form to write when the body is expensive.

## The recursive version, and when to prefer it

[06d](06d-subsets-and-combinations.md) generates the same `2^n` subsets by backtracking: include
element `i`, recurse, exclude it, recurse. The two are the same enumeration — the recursion's
include/exclude decisions *are* the bits of the mask, read off the path from root to leaf. Choose
between them on these grounds:

- **The mask loop wins** when you need the subset as a *key* — memoisation, a `dp` array, a visited
  set, deduplication — because the mask already is one, and when you want a flat iterative loop with
  no stack ([phase 1 · space and the recursion stack](../phase-1-complexity/04-space-and-the-recursion-stack.md)).
- **The recursion wins** when you want to **prune**. A mask loop visits all `2^n` masks
  unconditionally; a backtracking search can cut a whole subtree the moment the partial subset is
  infeasible ([06h](06h-feasibility-pruning.md), [06i](06i-bound-pruning-and-ordering.md)). If most
  subsets are invalid, pruning beats enumeration by an amount no bit trick recovers, because it
  changes the number of nodes visited rather than the cost per node
  ([06c](06c-the-cost-of-the-search-tree.md)).
- **The recursion wins** when `n` exceeds 31, because the counter no longer fits in a JavaScript
  bitwise operand ([09b](09b-precedence-and-the-32-bit-loop-bound.md)) — though by then the
  enumeration is unrunnable for other reasons ([09i](09i-where-n-stops-fitting.md)).
- **Duplicates in the input are the recursion's problem, not the mask's.** Two equal elements
  produce two distinct masks that name the same multiset, so a mask enumeration over
  `[1, 2, 2]` yields the subset `{2}` twice. [06f](06f-duplicates-in-subsets-and-combinations.md)
  handles this properly with sorting and a skip rule; the mask equivalent is to deduplicate the
  *results*, which is strictly more work.

## The canonical problems this representation is for

- **Power set / all subsets** — the loop above, `Θ(2^n · n)`.
- **All subsets summing to a target, or matching a predicate** — the same loop with a test; the
  meet-in-the-middle refinement splits the items into two halves of `n/2` and enumerates `2^(n/2)`
  masks on each side, which is the standard escape when `n` is around 40
  ([09i](09i-where-n-stops-fitting.md)).
- **Assignment / matching** — assign `n` jobs to `n` workers minimising total cost. `dp[mask]` over
  the set of assigned jobs; `Θ(2^n · n)` ([09e](09e-dp-over-masks-the-shape-and-the-cost.md)).
- **Travelling salesman over `n` cities** — `dp[mask][last]`; `Θ(2^n · n²)` time and `Θ(2^n · n)`
  memory ([09f](09f-dp-over-masks-with-a-last-element.md)).
- **"Can these tasks be split into k groups"**, set cover, and minimum-partition problems — a DP
  whose transition enumerates submasks, `Θ(3^n)`
  ([04f](04f-submasks-and-the-3-to-the-n-count.md), [09g](09g-submask-dp-and-partitions.md)).
- **Counting set partitions**, Hamiltonian path counts, and any "visit each element exactly once in
  some order" objective where only the *set* visited so far matters, not the order it was visited in.
- **Sum over subsets** — for every mask, aggregate a value over all of its submasks, in
  `Θ(2^n · n)` rather than `Θ(3^n)` ([09h](09h-sum-over-subsets-and-the-mobius-inverse.md)).

The shape they share: **the state is a set, and the order in which the set was built does not
change the future.** That is the test for whether a problem is a bitmask DP at all, and it is worth
saying in those words before writing anything. TSP is the instructive near-miss — the order *does*
matter, but only through its last element, which is why one extra dimension buys the whole problem.

## Where the rest of this topic goes

- [09b](09b-precedence-and-the-32-bit-loop-bound.md) — the operator-precedence bug that reads
  correctly, and the two distinct failures at `n = 31` and `n = 32`.
- [09c](09c-generating-masks-in-a-useful-order.md) — ascending, descending and by popcount; why
  the order is a correctness property of a DP rather than a preference, and how to nest the loops.
- [09d](09d-fixed-size-subsets-and-gray-code.md) — the `C(n, k)` masks of one popcount without
  visiting the rest, Gray-code order for incremental evaluation, and ranking a `k`-subset.
- [09e](09e-dp-over-masks-the-shape-and-the-cost.md) — `dp[mask]` when the set is a sufficient
  state: the assignment problem, push against pull, and `Θ(2^n · n)`.
- [09f](09f-dp-over-masks-with-a-last-element.md) — `dp[mask][last]` when it is not: the tour,
  `Θ(2^n · n²)`, path reconstruction and the counting variant.
- [09g](09g-submask-dp-and-partitions.md) — the `Θ(3^n)` partition DP, its symmetry breaking, and
  the reformulation that escapes it.
- [09h](09h-sum-over-subsets-and-the-mobius-inverse.md) — the SOS / zeta transform, its inverse, and
  the `Θ(2^n · n)` it buys.
- [09i](09i-where-n-stops-fitting.md) — the honest limit: what the constraint is telling you, and
  why memory runs out before time does.

Dynamic programming as a subject — states, transitions, the pull/push duality, memo versus table —
belongs to [part 6 of the syllabus](../../syllabus/06-backtracking-greedy-and-dp.md). This topic
previews the mask-shaped instance of it and does not teach DP from scratch.

## Gotchas

**★ Symptom: two functions in the same solution disagree about which element bit 3 means.** Cause:
the bijection is defined relative to a fixed ordering, and one path sorted the input while another
used the original array. Fix: establish the ordering once, at the point the mask domain is created,
and pass the ordered array everywhere. Never sort *after* masks exist.

**★ Symptom: the enumeration includes the empty set when the problem excludes it, or vice versa.**
Cause: `mask = 0` is a legitimate subset — the empty one — and `for (mask = 1; ...)` silently drops
it while `mask <= (1 << n) - 1` silently keeps it. Fix: decide explicitly and comment the decision.
A partition or set-cover DP that never considers the empty part gets a wrong answer, not a crash.

**★ Symptom: `powerSet` on `[1, 2, 2]` returns eight subsets where seven are wanted.** Cause: the
bijection is over *positions*, not values, so duplicate elements produce distinct masks naming the
same multiset. Fix: this is not a masking problem — use the sorted skip rule from
[06f](06f-duplicates-in-subsets-and-combinations.md), or deduplicate the results by a canonical key.
Deduplicating masks is impossible; only the decoded subsets can be compared.

**Symptom: an index derived from a mask lands out of range.** Cause:
`Integer.numberOfTrailingZeros` returns `32` on an empty mask, not `-1`
([04d](04d-counting-set-bits-and-the-platform-methods.md)). Fix: make `m != 0` the loop condition so
the index is never taken on an empty mask.

**Symptom: `mask` used as a `Map` key gives fewer or more distinct entries than expected.** Cause:
bit 31 made the mask negative, and normalising with `>>> 0` in one place and not another gives two
different keys for the same bit pattern. Fix: pick one normalisation and apply it at the boundary;
the simplest is to cap `n` at 30 so a mask is never negative
([09b](09b-precedence-and-the-32-bit-loop-bound.md)).

**Symptom: the power-set enumeration is far slower than the same problem's backtracking solution.**
Cause: the mask loop visits `2^n` masks unconditionally; the recursion prunes. Fix: if the problem
has a feasibility test that fails early, the enumeration is the wrong tool — the mask is a *state*
representation, not automatically the right *search* strategy.

**Symptom: `new ArrayList<>(1 << n)` throws or allocates absurdly.** Cause: the initial-capacity
argument is the full output size, which for `n = 25` is beyond what the result was ever going to
hold in memory. Fix: only pre-size when you have already established that the full output fits;
otherwise let the list grow, and reconsider whether you need the output materialised at all.

## Interview questions

**★ Why represent a subset as an integer at all?**
Because it makes a set into a value with the three properties a set does not have: cheap equality,
cheap hashing, and usability as an array index. That last one is the point — `dp[mask]` is a flat
array lookup where a `Set`-keyed memo would be a serialise-and-hash on every read. On top of that
every set operation becomes a single machine instruction: union is `|`, intersection is `&`,
difference is `a & ~b`, subset test is `(a & b) === a`, cardinality is a popcount. The speed is a
bonus; the indexability is the reason.

**★ Walk me through enumerating every subset, and tell me what it costs.**
Label the elements `0 … n-1`, then loop a counter `mask` from `0` to `2^n − 1` — the binary
expansion of each counter value *is* a subset, uniquely, because binary representation is unique.
Read membership with `(mask & (1 << i)) !== 0`. Producing every subset explicitly is `Θ(2^n · n)`,
and that is optimal for that problem because the output itself has that size: each element is in
exactly half the subsets, so the sizes sum to `n · 2^(n-1)`. If you only need the elements that are
present, peel with `m &= m - 1` and the inner loop runs `popcount(mask)` times instead of `n`.

**★ How do you know a problem is a bitmask-DP problem?**
The state is a *set*, and the order in which the set was assembled does not affect the future cost.
"Which jobs are done" qualifies; "which jobs are done, and in what order" does not — unless the only
order-dependent thing is the last element, which is exactly why TSP carries `dp[mask][last]` and why
one extra dimension rescues it. The second test is arithmetic, not intuition: `n` must be small
enough that `2^n` states fit in memory, which in practice means the statement says something like
`n ≤ 20`. If it says `n ≤ 1000`, the answer is not a bitmask, whatever the problem looks like.

**★ When would you use backtracking instead of a mask loop for subsets?**
When pruning is available. The mask loop is unconditional — it visits all `2^n` masks whatever the
constraints are. Backtracking builds the subset incrementally, so an infeasible prefix kills an
entire subtree, and on a heavily constrained problem that is a change in the number of nodes visited
rather than a constant factor per node. The mask loop wins the other way round: when you need the
subset as a memo key or a `dp` index, when the body is uniform, or when you want to avoid the
recursion stack entirely.

**★ Your input has duplicate elements. Does the bitmask enumeration still work?**
It enumerates correctly over *positions* and incorrectly over *values*: `[1, 2, 2]` has eight
position-subsets but only six distinct value-subsets, and the mask has no way to know two positions
are interchangeable. There is no masking fix, because the collision is in the decoding, not the
encoding. Sort the input and use the backtracking skip rule, or decode to a canonical form and
deduplicate — and say which, because "it still works" is the wrong answer.

**Why not just use a `Set` and a `Map` keyed by it?**
Because a `Set` has no useful value equality — two sets with the same members are different objects
and different `Map` keys — so you would have to serialise it to a string on every memo read and
write. That turns an array index into a string build plus a hash, per state, and a bitmask DP does
that millions of times. If `n` were large enough that the mask did not fit, the `Set` would not save
you either: the number of states is the problem, not their representation.

---

← Prev: [08g · The pigeonhole principle](08g-the-pigeonhole-principle.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [09b · Precedence and the 32-bit bound](09b-precedence-and-the-32-bit-loop-bound.md)
