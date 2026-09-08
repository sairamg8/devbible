---
title: "Bound pruning turns a backtracking search into branch and bound, and its one correctness requirement is that the estimate be optimistic — derived by relaxing a constraint rather than by guessing, because an estimate that is occasionally too pessimistic deletes the optimum and reports a plausible wrong answer"
sidebar_label: "06i · Bound pruning and ordering"
sidebar_position: 6.8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. Branch and bound, the admissibility requirement on the estimate, and the
> ordering heuristics are **common practice, derived on this page, not cited to a source**. The
> running example is the corpus's PERN storefront. Java targets **JDK 25**; TypeScript first, Java
> second. Feasibility pruning is [06h](06h-feasibility-pruning.md); the DP contrast belongs to
> [Part 6 of the syllabus](../../syllabus/06-backtracking-greedy-and-dp.md). **No sandbox run; no
> timings.**

**Bound pruning only exists when the question asks for a best rather than for all, and it swaps the
feasibility question "can this branch contain an answer" for "can this branch contain a *better*
answer".** That needs three things the feasibility test does not: an objective, an incumbent — the
best complete answer found so far — and an optimistic estimate of what any completion of the
current path could achieve. The estimate is where it goes wrong, and it goes wrong quietly: a
pessimistic estimate prunes the subtree containing the optimum and the search returns a valid,
plausible, suboptimal answer with no error and nothing to trace.

## The mechanism

At every node, compare `costSoFar + optimisticRemainder` against the incumbent. If it is not better,
cut — nothing below can beat what you already have.

🔴 **Optimistic is a correctness requirement, not a preference.** For a minimisation the estimate
must be a *lower* bound on the true remaining cost of every completion; for a maximisation, an upper
bound. This is exactly the admissibility condition a heuristic needs in A\*, and for the same
reason: the moment the estimate can exceed the truth, the comparison can reject a branch that would
have won.

**The way to get one you can trust is to relax the problem, not to estimate it.** Drop a constraint
and solve what is left; the relaxed optimum is never worse than the true one, so it is a valid bound
by construction rather than by hope.

| Problem | Relaxation that gives the bound |
|---|---|
| fulfilment with a per-warehouse dispatch fee | ignore the fees; sum each remaining line's cheapest unit cost |
| 0/1 knapsack | allow fractional items — the greedy fractional solution is an upper bound |
| scheduling with precedence | ignore precedence; sum the remaining durations |
| travelling salesman | sum the cheapest edge incident to each unvisited city, halved |
| cutting stock | round the total required length up to whole stock lengths |

The second property to want is that the bound is O(1) at each node from state you already maintain.
A bound that costs O(n) to evaluate can easily cost more than the subtree it prunes, and precomputing
a suffix array before the search usually converts it.

## Worked: cheapest fulfilment for a storefront order

Each order line can ship from any warehouse that stocks it, at a per-warehouse cost, and every
*distinct* warehouse used adds a fixed dispatch fee. Minimise the total.

```ts
type Line = { sku: string; costByWarehouse: number[] };   // cost per warehouse index, in cents

export function cheapestFulfilment(lines: Line[], dispatchFee: number): number {
  // Optimistic remainder: the cheapest each remaining line could possibly be, ignoring dispatch
  // fees entirely. Ignoring a cost that is always ≥ 0 can only under-estimate — a valid lower bound.
  const cheapestPerLine = lines.map(l => Math.min(...l.costByWarehouse));
  const suffixMin: number[] = new Array(lines.length + 1).fill(0);
  for (let i = lines.length - 1; i >= 0; i--) suffixMin[i] = suffixMin[i + 1] + cheapestPerLine[i];

  let best = Number.POSITIVE_INFINITY;
  const usedWarehouses = new Set<number>();

  const go = (i: number, costSoFar: number): void => {
    if (costSoFar + suffixMin[i] >= best) return;      // 🔴 bound prune, before the base case
    if (i === lines.length) { best = costSoFar; return; }

    for (let w = 0; w < lines[i].costByWarehouse.length; w++) {
      const isNew = !usedWarehouses.has(w);
      const extra = lines[i].costByWarehouse[w] + (isNew ? dispatchFee : 0);
      if (isNew) usedWarehouses.add(w);                // conditional choose
      go(i + 1, costSoFar + extra);                    // explore
      if (isNew) usedWarehouses.delete(w);             // 🔴 conditional un-choose — same condition
    }
  };

  go(0, 0);
  return best;
}
```

```java
// Java: the same bound test at the top of the call, before the completion check.
private void go(int i, int costSoFar) {
    if (costSoFar + suffixMin[i] >= best) return;      // prune
    if (i == lines.size()) { best = costSoFar; return; }
    for (int w = 0; w < warehouses; w++) {
        boolean isNew = usedWarehouses.add(w);         // Set.add returns false if already present
        int extra = lines.get(i).costAt(w) + (isNew ? dispatchFee : 0);
        go(i + 1, costSoFar + extra);
        if (isNew) usedWarehouses.remove(w);           // conditional undo, keyed off the same flag
    }
}
```

Three things carry this example.

**The bound ignores dispatch fees**, which is what makes it optimistic: the true remaining cost is at
least the sum of the per-line minima, never less. Adding a guess at the fees would make it tighter
and wrong.

**The un-choose is conditional.** `usedWarehouses.delete(w)` runs only if *this* node added `w`;
otherwise it removes a mark an ancestor owns, and the ancestor's later siblings then pay a dispatch
fee they should not. **A conditional choose needs a conditional un-choose keyed off the same
boolean**, and Java's `Set.add` returning `false` when the element is present gives you that flag for
free.

**`best` is deliberately never undone.** It is a global improving bound, not per-path state — the one
piece of shared state in a backtracking search that must survive across branches, and the reason the
rule from [06](06-the-backtracking-skeleton.md) is stated as "undo everything *per-path*". It is
worth a comment, because a mutation with no matching inverse looks exactly like the bug this topic
spends most of its time warning about.

## Collecting all optimal answers, not just the value

A common follow-up, and the change is subtler than it looks. Comparing with `>=` cuts branches that
merely *tie* the incumbent, which is correct for "what is the minimum" and wrong for "give me every
cheapest fulfilment". For the all-optima version:

```ts
if (costSoFar + suffixMin[i] > best) return;     // strict: keep ties alive
if (i === lines.length) {
  if (costSoFar < best) { best = costSoFar; solutions.length = 0; }  // strictly better: reset
  if (costSoFar === best) solutions.push(snapshot());                // ties accumulate
  return;
}
```

The cost of keeping ties is real — every tying branch is fully explored — and it is exactly the
trade the question is testing. Say which version the question wants before writing the comparison.

## Ordering: the free multiplier

Neither class of pruning cares what order candidates are tried in, and both work far better in some
orders than others. This is the cheapest remaining lever after the prune itself.

- **Most-constrained-variable first.** Choose the *position* with the fewest legal candidates rather
  than the next position in sequence. In Sudoku that is the empty cell with the fewest possibilities;
  it makes the tree narrow at the top, where [06c](06c-the-cost-of-the-search-tree.md) says the nodes
  are.
- **Least-constraining-value first.** Among candidates for that position, try the one that rules out
  fewest options elsewhere — it reaches a leaf sooner, which improves the incumbent sooner, which
  strengthens every subsequent bound prune.
- **Get a real incumbent before you start.** A greedy first descent — cheapest warehouse per line,
  ignoring fees — gives a finite `best` immediately. Starting at infinity means no prune can fire
  until the first complete answer is found, and on a wide tree that can be a long way in.

All three are heuristics in the strict sense: they change which nodes are visited, never which
answers exist. That is what makes them safe to propose — unlike a bad bound, a bad ordering costs
only time.

## Gotchas

**★ Symptom: a bound-pruned search returns a valid but suboptimal answer.** Cause: the estimate is
not optimistic — for a minimisation it must be a lower bound on every completion, and one that is
occasionally too high prunes the branch containing the optimum. Fix: derive the estimate by
*relaxing* a constraint (drop the fee, allow fractional items, ignore precedence) so it is provably
never worse than reality; a relaxation is optimistic by construction, a guess is not.

**★ Symptom: a conditional choose with an unconditional un-choose corrupts an ancestor's state.**
Cause: `if (isNew) set.add(w)` paired with a bare `set.delete(w)`, which removes a mark the ancestor
placed — so the ancestor's later siblings behave as if the resource were free. Fix: capture the
boolean at the choose and gate the un-choose on the same boolean; in Java, `Set.add`'s return value
is that boolean.

**★ Symptom: the incumbent is reset between branches and no pruning ever happens.** Cause: `best`
treated as per-path state and undone with everything else. Fix: `best` is a deliberately global
improving bound and must survive across branches — the single exception to "undo everything". The
search still returns the right answer without it, just exhaustively, which is why this one shows up
as a timeout rather than as a wrong result.

**★ Symptom: "give me all the cheapest options" returns only one.** Cause: `>=` in the bound test,
which cuts branches that tie the incumbent. Fix: `>` for the all-optima variant, plus a leaf handler
that resets the collection on a strict improvement and appends on a tie. Decide which the question
wants before writing the comparison.

**★ Symptom: the bound is correct and the search is still slow.** Cause: `best` starts at infinity,
so no prune can fire until the first leaf, and on a wide tree the first leaf is deep in. Fix: seed
the incumbent with a greedy solution before the search — any valid complete answer works, and a good
one prunes immediately.

**Symptom: a bound test placed after the base case, and a non-improving answer is recorded.**
Cause: the leaf emits before the bound is consulted. Fix: prune at the very top of the call, before
the completion check.

**Symptom: evaluating the bound costs more than the subtree it prunes.** Cause: an O(n) estimate
recomputed at every node. Fix: precompute a suffix array of per-item minima before the search so the
estimate is one array read and one addition; if that is impossible, a weaker O(1) bound usually beats
a tighter O(n) one.

**Symptom: an "ordering heuristic" changes the set of answers.** Cause: the heuristic is skipping
candidates rather than reordering them. Fix: a reordering is a permutation of the same candidate
list; if anything is dropped it is a prune, and it needs a correctness argument of its own.

**Symptom: the bound uses floating-point currency and prunes a branch that ties exactly.** Cause: an
exact `>=` comparison on accumulated doubles, where the accumulated and the estimated total differ in
the last bits. Fix: integer minor units throughout — the same reason
[06](06-the-backtracking-skeleton.md) warns that a floating-point running sum is not exactly
restorable by its undo.

## Interview questions

**★ How do you construct an optimistic bound you can trust?**
By relaxing the problem rather than estimating it. Drop a constraint and solve what remains: for the
fulfilment search, ignore the per-warehouse dispatch fee and sum the cheapest possible cost of each
remaining line; for 0/1 knapsack, allow fractional items and take the greedy value; for scheduling,
ignore precedence and sum the remaining durations. A relaxation's optimum is never worse than the
true optimum, so the bound is valid by construction rather than by hope. The second property to want
is O(1) evaluation from state you already maintain — a suffix array of per-line minima computed once
before the search — because a bound costing O(n) per node can easily cost more than the subtree it
prunes.

**★ What is the one piece of state in a backtracking search that must not be undone?**
The incumbent — the best answer found so far in a bound-pruned search. Everything else is per-path
and must be restored on the way out, but `best` is a global improving bound whose entire purpose is
to carry information from one branch to a later one. Undoing it makes every prune impossible and the
search degenerates to exhaustive enumeration that still returns the right answer, just far too
slowly — which is why the symptom is a timeout rather than a wrong result. It deserves a comment in
the code, because a mutation with no matching inverse is exactly the shape of the bug everyone is
trained to look for here.

**★ Your bound-pruned search returns a suboptimal answer. What is the first hypothesis?**
That the estimate is not optimistic. A feasibility bug deletes valid answers and a missing un-choose
corrupts later branches, but only a bound that can exceed the true remaining cost produces a *valid*
answer that simply is not the best one — the search prunes the winning subtree and reports the
runner-up, with no error anywhere. Check the estimate against its relaxation: is there any input
where the true remaining cost could be *less* than what the estimate returns? If yes, that is the
bug, and the fix is to weaken the estimate until it cannot be.

**★ How would you speed up a search that is already pruned as hard as you can manage?**
Ordering, which is free in correctness terms because it only permutes the candidate list. Pick the
most-constrained position next rather than the next in sequence, so the tree is narrow near the root
where the levels are largest. Among that position's candidates, prefer the one that constrains the
rest least, so a leaf is reached sooner and the incumbent improves earlier. And seed the incumbent
with a greedy descent before the search starts, since beginning at infinity means no prune can fire
until the first complete answer. All three change which nodes are visited and never which answers
exist, which is what makes them safe to suggest — unlike a bound you cannot prove is optimistic.

**What changes if the question asks for every optimal solution rather than the optimal value?**
The comparison, and the cost. The bound test must become strict — `>` rather than `>=` — because a
branch that only ties the incumbent may still contain an optimal solution you are being asked to
report, and `>=` cuts exactly those. The leaf handler then resets the collection on a strict
improvement and appends on a tie. The price is that every tying branch is explored in full, which on
a problem with many optima can be most of the tree; that trade is usually the point of the question,
so name it rather than discovering it.

**When is bound pruning the wrong tool entirely?**
When the objective has optimal substructure over a small state space — then it is a dynamic
programming problem, and branch and bound is an exponential way to compute something polynomial. The
test is whether the best completion of a path depends on the whole path or only on a small summary
of it: if "the cheapest way to finish" depends only on which lines remain and which warehouses are
already open, and the number of such states is manageable, memoise on that state instead of
searching. Branch and bound earns its place when the state that matters *is* the whole path, or when
the state space is too large to tabulate. That boundary is
[Part 6](../../syllabus/06-backtracking-greedy-and-dp.md).

---

← Prev: [06h · Feasibility pruning](06h-feasibility-pruning.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [06j · N-Queens and symmetry](06j-n-queens-and-symmetry.md)
