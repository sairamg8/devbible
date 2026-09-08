---
title: "The cost of a backtracking search is read off its call tree — branching factor to the power of depth, times work per node, plus the snapshot at every leaf — and the sentence that completes the answer is that the output has that size too, so the enumeration is optimal"
sidebar_label: "06c · The cost of the search tree"
sidebar_position: 6.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The tree bound, the geometric-series argument and the output-optimality
> claim are **mathematics, derived on this page, not cited**. The stack discussion deliberately
> carries **no number**: the runtime limit is engine- and platform-dependent and is not a
> specification guarantee — MDN documents only that exceeding it throws, and that the error type
> differs by engine
> ([*"too much recursion"*](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion)).
> Part of the skeleton topic — [06b](06b-copies-and-the-two-path-designs.md) is the memory design,
> [06d](06d-subsets-and-combinations.md) is the enumerations. **No sandbox run;
> no timings.**

**"It's exponential" is half an answer, and the missing half is what an interviewer is listening
for: the output of an enumeration problem is itself exponential, so the algorithm is
output-optimal and the only thing left to optimise is which subtrees get visited at all.** This
chunk reads the bound off the search tree the way
[phase 1 reads any recursion tree](../phase-1-complexity/02b-recursion-as-a-tree.md), derives the
three standard enumeration bounds rather than quoting them, and separates the two space figures
that get merged into one wrong number — the Θ(depth) stack and the exponential output.

## Summing the tree

Calls per level, times work per call, over the depth.

- **Branching factor `b`, depth `d`.** Nodes number at most `1 + b + b² + … + b^d`. For `b ≥ 2`
  that geometric series is `(b^(d+1) − 1)/(b − 1)`, which is Θ(b^d) — **the last level alone
  accounts for a constant fraction of the whole tree.** Everything else on this page and in
  [06h](06h-feasibility-pruning.md) is a consequence of that sentence.
- **Work per node** is the choice loop plus the feasibility test, plus Θ(1) for the choose and the
  un-choose (in the mutating design — Θ(depth) in the copying one, per
  [06b](06b-copies-and-the-two-path-designs.md)).
- **Work per leaf** additionally includes the Θ(d) snapshot, and for pure enumeration problems
  that snapshot is the *dominant* term, not a rounding error.

So the total is `Θ(nodes × work-per-node + leaves × depth)`, and for the enumerations below the
second term wins.

## The three standard bounds, derived

| Enumeration | Leaves | Path length | Total |
|---|---|---|---|
| subsets of `n` | 2^n | up to `n` | Θ(n · 2^n) |
| permutations of `n` | n! | `n` | Θ(n · n!) |
| combinations `C(n, k)` | C(n, k) | `k` | Θ(k · C(n, k)) |

**Subsets.** Each element is in or out, so there are 2^n subsets. Their *total* size is
n · 2^(n−1) — each of the n elements appears in exactly half the subsets — so writing the answer
costs Θ(n · 2^n). Being able to derive `n · 2^(n−1)` rather than hand-waving "each subset is up to
n long" is the difference between two answers to the same question.

A detail that gets challenged: in the start-index formulation, how many *nodes* does the tree
have? Exactly 2^n, because the search emits on entry and each node corresponds to exactly one
subset. The tree is not binary — the node at `start = i` has `n − i` children — and the branching
factor shrinks as `start` advances, yet the sum still comes to 2^n. Deriving that is a good check
that you know what tree you are talking about.

**Permutations.** n choices at the root, n−1 below each of those, and so on: n! leaves, each a
path of length n. The internal nodes number `n!·(1 + 1/1! + 1/2! + …)`, which is Θ(n!) — again the
last level dominates. Total Θ(n · n!).

**Permutations of a multiset** — the duplicate-skipping variant in
[06g](06g-duplicates-in-permutations.md) — has `n! / (m₁! · m₂! · …)` leaves, where the
`mᵢ` are the multiplicities. That is the correct bound to state for "permutations with duplicates",
and it is strictly smaller than n! whenever any element repeats.

**Combinations.** `C(n, k)` leaves, each of length k. Note the naive tree has more nodes than
leaves by a wide margin unless you prune: a node at depth `j` with `start = i` cannot complete if
fewer than `k − j` candidates remain, and cutting those is feasibility pruning
([06h](06h-feasibility-pruning.md)) rather than a change to the bound.

## The sentence that completes the answer

> **The output alone has that size, so no algorithm can be asymptotically faster — the enumeration
> is output-optimal.**

An interviewer asking for all subsets of 20 elements is not asking you to beat 2^20; they are
checking that you can see the exponential is in the problem statement rather than in your code.
Saying "O(2^n), sorry, that's the best I can do" and saying "Θ(n · 2^n), which is optimal because
the output is that large" are read very differently, and only the second one closes the question.

The converse matters just as much and is the setup for
[Part 6 of the syllabus](../../syllabus/06-backtracking-greedy-and-dp.md): when the question asks
for a **count** or a **best**, rather than for all the answers, the output is Θ(1) and the
output-optimality argument evaporates — which is exactly the signal that the problem is probably
not backtracking at all. Enumerate to list; do something else to count or to optimise.

## When the b^d bound is loose, say so

Where the tree is not uniform — pruning cuts subtrees, choices run out early, duplicates are
skipped — `b^d` is an upper bound that can be *very* loose. The honest statement is:

> "O(b^d) worst case. Pruning is what makes it tractable in practice, and I can't give a tighter
> bound without an assumption about the input."

That is a correct and complete answer, and it is better than inventing a tighter figure. N-Queens
is the standard illustration: the naive bound is n^n, the used-column constraint alone brings it to
n!, and the number of nodes actually visited after diagonal pruning is far below that — with no
simple closed form. Quoting a specific node count for N-Queens is quoting something nobody derived.

The same caution applies to problems where the *answer count* is the bound: "combination sum" style
searches are bounded by the number of solutions times the path length, and the number of solutions
depends on the numbers in the input, not just on `n`. Saying "output-sensitive: O(answers × k) plus
the cost of the pruned traversal" is a real bound and is more informative than a power of two.

## Two space figures, not one

They get merged and the merged number is wrong.

**Auxiliary space is Θ(depth).** The recursion stack holds Θ(d) frames and the path holds Θ(d)
entries, regardless of how many nodes the search visits — see
[Phase 1 · Space and the recursion stack](../phase-1-complexity/04-space-and-the-recursion-stack.md).
For subsets and permutations that is Θ(n). For N-Queens it is Θ(n) for the board plus Θ(n) for the
conflict sets.

**Output space is the enumeration's size** — Θ(n · 2^n), Θ(n · n!) — and it is not auxiliary. State
it separately, or state that you are excluding it. Both conventions are accepted; silently mixing
them is what makes an answer sound confused.

## Why the stack is never the problem here

The recursion depth is the number of **choices on one route**, not the number of nodes visited: n
for permutations, n for subsets, the board size for N-Queens. The tree has exponentially many nodes
and *linear* depth, so the stack holds Θ(depth) frames while the search does Θ(b^depth) work.

The consequence: converting a backtracking search to an explicit stack — the technique in
[Phase 1 · Tail calls, and the explicit stack](../phase-1-complexity/04b-tail-calls-and-the-explicit-stack.md)
— buys nothing, because depth was never the constraint. That conversion is the right move for a
recursion over a linked list or a degenerate tree, where the depth *is* n on an input of size n and
n can be a million. It is the wrong reflex for a choice tree, where n is 20 because 2^20 answers is
already all anyone wants.

No number belongs in this answer. The runtime limit is engine- and platform-dependent and is not a
specification guarantee; MDN documents only that exceeding it throws, and that Firefox raises
`InternalError` while Chrome and Safari raise `RangeError`.

## Gotchas

**★ Symptom: the complexity given as "O(2^n)" and the interviewer pushes back.** Cause: the Θ(n)
per-leaf snapshot was dropped from the sum. Fix: Θ(n · 2^n) for subsets and Θ(n · n!) for
permutations — and follow it immediately with the reason it cannot be improved, because that is the
half of the answer being tested.

**★ Symptom: an exact node count quoted for N-Queens or for a pruned search.** Cause: a
half-remembered figure presented as a derivation. Fix: state the worst-case bound you can derive
(n! from the column constraint) and say plainly that the pruned count has no simple closed form.
Nobody expects the number; everybody notices a fabricated one.

**★ Symptom: space claimed as O(2^n) because the answers are stored.** Cause: output space counted
as auxiliary space. Fix: two figures — Θ(depth) auxiliary, Θ(output) for the results — and say
which convention you are using. The two are not interchangeable and an interviewer probing space is
usually probing the first.

**Symptom: "I'll convert it to an explicit stack to avoid overflow."** Cause: a deep-recursion
reflex applied to a wide-and-shallow tree. Fix: the depth is the number of choices, which is small;
the width is what is exponential, and no data-structure change touches width. The fix for a
backtracking search that is too slow is pruning, never an explicit stack.

**Symptom: a bound of n^n given for permutations.** Cause: counting the loop as n choices at every
level while ignoring the `used[]` constraint that removes one option per level. Fix: n · (n−1) ·
(n−2) · … = n!, and the `used` array is exactly what makes it a factorial rather than a power.

**Symptom: "each subset is length n, so the output is n · 2^n" challenged and no derivation
available.** Cause: an upper bound used where the exact sum was asked for. Fix: each of the n
elements is in exactly half the subsets, so the total output size is n · 2^(n−1) — the same Θ
class, and the derivation is one line.

**Symptom: the bound for "permutations with duplicates" given as n!.** Cause: the multiset
correction ignored. Fix: `n! / (m₁! · m₂! · …)` leaves, where `mᵢ` are the multiplicities — which is
also why the duplicate-skipping code in [06g](06g-duplicates-in-permutations.md) does not
merely deduplicate the output, it never generates the duplicates.

## Interview questions

**★ What is the complexity of generating all subsets, and can it be improved?**
Θ(n · 2^n). There are 2^n subsets and their total size is n · 2^(n−1), so simply writing the answer
costs that much. It cannot be improved, and that is the point: the exponential lives in the output
size, not in the algorithm, so the enumeration is output-optimal. Auxiliary space is Θ(n) — one
path and n stack frames — excluding the output. The same argument gives Θ(n · n!) for permutations
and Θ(k · C(n, k)) for combinations. What remains to optimise in such a problem is never the
asymptotic class; it is pruning, which changes which subtrees are visited at all.

**★ Is a backtracking search at risk of a stack overflow?**
Almost never on interview-sized inputs, and the reason is the precise part: the recursion depth is
the number of choices on one route — n for permutations, n for subsets, the board size for
N-Queens — not the number of nodes visited. The tree has exponentially many nodes and linear depth,
so the stack holds Θ(depth) frames while the search does Θ(b^depth) work. Converting to an explicit
stack therefore buys nothing. The runtime limit itself is engine- and platform-dependent and is not
a specification guarantee, so no number belongs in the answer — only the structural claim.

**★ Why is pruning near the root worth more than pruning near the leaves?**
Because in a tree with branching factor `b ≥ 2` the number of nodes at depth `k` is `b^k`, so the
levels grow geometrically and the last level alone is a constant fraction of the whole tree.
Cutting a node at depth `k` removes roughly `b^(d−k)` nodes; cutting one at depth `d−1` removes `b`.
A cheap test applied high in the tree therefore deletes exponentially more work than an expensive
test applied low — which is the entire justification for maintaining conflict sets and running sums
incrementally so the feasibility check is O(1) at every node instead of recomputed from the path.

**★ How do you state the complexity of a search whose pruning you cannot analyse?**
Give the worst-case bound you can derive, name the pruning, and say the pruned count has no closed
form. For N-Queens: n^n if you ignore constraints, n! once columns are distinct, and far fewer
nodes than that once the diagonals are pruned — with no simple expression for the real figure. For
solution-count-driven searches, give an output-sensitive bound instead: O(answers × path length)
plus the cost of the pruned traversal. Both are honest, both are more informative than a made-up
exponent, and an interviewer who asked the question already knows there is no clean answer.

**What changes about the bound if you copy the path down each branch instead of mutating it?**
Every edge of the tree costs Θ(depth) instead of Θ(1), so the traversal term goes from Θ(nodes) to
Θ(nodes × depth). For an enumeration whose leaves already pay Θ(depth) for the snapshot, that turns
a term you were ignoring into one of the same order as the dominant one — subsets stay Θ(n · 2^n)
because the node count and the leaf count are within a constant factor, but for a heavily pruned
search with few leaves and many internal nodes the copying design is asymptotically worse. Live
memory also rises from Θ(depth) to Θ(depth²), one path per stack frame.

**Why does the "output-optimal" argument stop working when the question asks for a count?**
Because it rests on the output being as large as the work. If the question is "how many subsets sum
to k" rather than "list them", the output is a single number, so there is no lower bound coming
from the output at all — and the existence of a polynomial or pseudo-polynomial algorithm becomes
an open question you are expected to answer rather than dismiss. That is the boundary between this
topic and dynamic programming: enumerate to list, count or optimise by other means. The counting
side is [Part 6](../../syllabus/06-backtracking-greedy-and-dp.md) and the combinatorial side is
this phase's own [08 · Combinatorics for counting problems](08-combinatorics-for-counting-problems.md).

---

← Prev: [06b · Copies and the two path designs](06b-copies-and-the-two-path-designs.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [06d · Subsets and combinations](06d-subsets-and-combinations.md)
