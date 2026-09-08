---
title: "Pruning is the only lever on a backtracking search with exponential leverage, and feasibility pruning is the half that needs nothing but the constraints — provided the test stays O(1), which means the state it reads is maintained incrementally rather than rescanned from the path"
sidebar_label: "06h · Feasibility pruning"
sidebar_position: 6.7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The two pruning classes, the `break`-versus-`continue` condition and the
> incremental-state argument are **common practice and mathematics, derived on this page, not cited
> to a source**. The geometric-levels argument they rest on is
> [06c](06c-the-cost-of-the-search-tree.md). Java targets **JDK 25**; TypeScript first, Java
> second. Bound pruning is [06i](06i-bound-pruning-and-ordering.md) and N-Queens is
> [06j](06j-n-queens-and-symmetry.md). **No sandbox run; no timings.**

**Every backtracking search has the same asymptotic class with and without pruning, and only one of
the two returns.** That is not a paradox — it is what it means for a bound to be a worst case. What
pruning changes is the number of nodes actually visited, and because
[06c](06c-the-cost-of-the-search-tree.md) showed the levels of the tree grow geometrically, cutting a
node at depth `k` deletes roughly `b^(d−k)` descendants. There are exactly two kinds of cut. This
chunk is the first: **this branch contains no valid answer**, which needs nothing but the problem's
own constraints.

## The two classes, side by side

| | **Feasibility pruning** | **Bound pruning** |
|---|---|---|
| Claim | this branch contains **no valid** answer | this branch contains **no better** answer |
| Needs | the constraints | an objective, a best-so-far, an optimistic estimate |
| Applies to | "find all" and "find one" | "find the best" only |
| Correctness risk | a test too strong deletes valid answers | an estimate not optimistic deletes the optimum |
| Effect if omitted | slow but correct | slow but correct |
| Also called | constraint propagation | branch and bound |

Both are *only* about speed when they are right, and both silently change the answer when they are
wrong. That asymmetry is the thing to hold onto: an omitted prune costs time; a wrong prune costs
correctness, and produces a plausible smaller answer set rather than an error.

## The three shapes of a feasibility test

**A constraint the new choice violates directly.** Two queens on a column, a repeated digit in a
Sudoku row, a character already used. Held in a set so the test is O(1):

```ts
if (cols.has(c) || diag.has(r - c) || anti.has(r + c)) continue;   // O(1), from incremental state
```

**A counting argument on what remains.** The `i <= n - need + 1` bound in
[06d](06d-subsets-and-combinations.md): fewer candidates remain than the answer still needs, so no
leaf exists below this node. It costs one comparison and it fires at every level.

**A monotone measure that has already passed its target.** On sorted positive candidates, once
`a[i] > target` no later candidate can fit either:

```ts
// candidates sorted ascending; every later candidate is at least as large
for (let i = start; i < a.length; i++) {
  if (a[i] > target) break;     // 🔴 break, not continue — the rest cannot fit either
  path.push(a[i]);
  go(i, target - a[i]);
  path.pop();
}
```

```java
// Java: the same shape. `a` is sorted ascending and every candidate is positive.
for (int i = start; i < a.length; i++) {
    if (a[i] > target) break;                    // monotone: later candidates are larger
    path.add(a[i]);
    go(a, i, target - a[i], path, out);
    path.remove(path.size() - 1);
}
```

`break` versus `continue` deserves the pause. `continue` skips one candidate; `break` abandons every
remaining sibling, and it is valid **only** when the candidates are ordered so that one failure
implies every later failure. On a sorted array of positive numbers that holds. On an unsorted array,
or with negative candidates, it silently deletes answers. Sorting the candidates specifically to
enable the `break` is legitimate and common preprocessing — say that you are doing it and why,
because an interviewer who sees `break` will check that you know the condition it rests on.

## Where the check goes

Two placements, both correct, with materially different constants:

```ts
for (const c of candidates) {
  if (!feasible(c)) continue;   // ✅ in the parent's loop — the child frame is never created
  choose(c); go(); unchoose(c);
}

// versus
const go = (): void => {
  if (!feasibleHere()) return;  // in the child — a choose, a call, a frame and an un-choose first
  …
};
```

Testing in the parent avoids a call, a stack frame and the choose/un-choose pair for every rejected
candidate. Testing in the child is sometimes unavoidable — a test that depends on accumulated state
the child computes — and is often clearer. The rule of thumb: **candidate filters go in the parent's
loop; state-dependent tests go at the top of the child, before the base case.**

The "before the base case" clause is not decoration. A test placed after the completion check still
emits the leaf, so a search that prunes correctly everywhere else records an answer its own test
rejects.

## Keep the test O(1) by keeping the state incremental

A feasibility test that rescans the path is O(depth), and paying that at every candidate at every
node multiplies the entire search. Maintain the derived state alongside the path and update it in
the choose and the un-choose:

| Recomputed each node (O(depth)) | Incremental (O(1)) |
|---|---|
| scan the path for a queen sharing a diagonal | three `Set`s: columns, `r − c`, `r + c` |
| sum the path to check a budget | a running total passed as a parameter |
| scan for a repeated character | a `count[26]` array, incremented and decremented |
| re-derive how many candidates remain | `need = k − path.length`, computed in O(1) |
| re-check a whole Sudoku row/column/box | three bitmask arrays, one bit per digit |

The incremental version costs one more thing to undo, which is one more chance to get the un-choose
wrong. That is the genuine trade, and it is why [06](06-the-backtracking-skeleton.md)'s table of
"state that is not the path" is the first thing to re-read when a *pruned* search starts returning
wrong answers — the prune is usually right and its state is usually not being restored.

Note the choice between a `Set` and a plain array. For a bounded, small key space — columns 0…n−1,
digits 1…9, letters a…z — a boolean array or an integer bitmask is both faster and easier to undo
than a hash set, and the diagonal keys `r − c` (which ranges over `−(n−1)…(n−1)`) become array
indices after adding `n − 1`. Reach for a `Set` when the key space is unbounded or non-numeric.

## When feasibility pruning goes wrong

A test that is *too strong* deletes valid answers, and the failure looks exactly like a correct
search on a problem with fewer solutions. Two ways it happens.

**The test encodes a constraint the problem does not have.** "No two chosen items from the same
category" when the problem said "at most two". The fix is not in the code; it is re-reading the
statement, and the tell is that the answer set is a strict subset of the expected one with no
structure to the omissions.

**The test reads stale state.** The prune is right and the state it consults was not restored by a
sibling's un-choose, so the test rejects a candidate that is actually available. The tell is
different and much more useful: the *first* branch explored gives correct results and later ones do
not. If a search's first answer is right and its tenth is missing, look at the un-choose of the
pruning state before you look at the prune.

## Gotchas

**★ Symptom: `break` used instead of `continue` and answers go missing.** Cause: `break` abandons
all remaining siblings and is valid only when the candidates are ordered so that one failure implies
every later one fails. Fix: sort the candidates so that is true and say so, or use `continue`. With
negative candidates in the list, no sort makes it valid.

**★ Symptom: the search is correct but visits far more nodes than it should.** Cause: the
feasibility test rescans the path, so it is O(depth) and cannot be afforded at every candidate — or
it lives in the child, so a choose, a call and a frame are paid per rejected candidate. Fix:
incremental state updated in the choose and un-choose, and candidate filters in the parent's loop.

**★ Symptom: pruning added, and the stated complexity revised downwards.** Cause: confusing which
nodes are visited with the worst-case bound. Fix: the class does not change — say "O(b^d) worst
case; pruning is what makes it tractable, and I can't tighten the bound without an assumption about
the input."

**★ Symptom: the first answers are correct and later ones are missing.** Cause: the pruning state
is not being restored by the un-choose, so a later sibling's feasibility test reads a constraint an
earlier subtree left behind. Fix: every set added to, array marked or counter incremented as part of
the prune needs its inverse in the same loop body — the prune is fine, its bookkeeping is not. This
symptom is diagnostic and worth remembering: **a wrong prune fails from the first branch; a
missing undo fails from the second.**

**Symptom: valid answers missing from the very first branch onwards.** Cause: the test encodes a
constraint the problem does not impose. Fix: re-read the statement — this is not a code bug, and no
amount of tracing will show it.

**Symptom: a feasibility test placed after the base case, and a leaf is emitted that the test
rejects.** Cause: the completion check runs first. Fix: prune at the very top of the call.

**Symptom: a `Set<number>` of diagonal keys is slower than expected and awkward to undo.** Cause: a
hash structure used for a small bounded key space. Fix: a boolean array indexed by `r - c + n - 1`,
or a bitmask — both are O(1) with a smaller constant and their undo is a single assignment.

**Symptom: the prune is correct but the search still times out on the largest case.** Cause: the
test fires only near the leaves, where the geometric argument says there is little to save. Fix:
find a test that can fire higher — a counting argument on the remaining candidates usually can,
because it only needs the path length rather than the path's contents.

## Interview questions

**★ What are the two kinds of pruning, and what does each need to be correct?**
Feasibility pruning claims this branch contains no valid answer, and it needs only the problem's
constraints — a queen already on that column, fewer candidates left than the answer still requires,
a sorted candidate already larger than the remaining target. Bound pruning claims this branch
contains no *better* answer, and it needs an objective, the best complete answer found so far, and
an optimistic estimate of what any completion could achieve; the estimate must never be worse than
the truth or the search prunes the branch containing the optimum. Feasibility pruning applies to
"find all" and "find one"; bound pruning only exists when there is something to optimise.

**★ Why does pruning not change the complexity, and what do you say instead?**
Because the complexity is a worst-case bound and pruning removes nodes the worst case does not
contain. The honest statement is "O(b^d) worst case; pruning is what makes it tractable in practice,
and I can't give you a tighter bound without an assumption about the input" — that is a complete
answer, not a hedge. What pruning does change is where the work is: the levels of the tree grow
geometrically, so cutting a node at depth k deletes roughly `b^(d−k)` descendants, and a cheap test
high in the tree deletes exponentially more work than an expensive test low in it. That is the whole
reason to keep the feasibility state incremental and the test O(1).

**★ Where do you put the pruning test — in the loop or at the top of the recursive call?**
Candidate filters go in the parent's loop, because rejecting there avoids a choose, a call, a frame
and an un-choose for every rejected candidate. Tests that depend on state the child accumulates go
at the top of the child, and specifically *before* the base case, since a test after the completion
check will emit a leaf the test itself rejects. Both placements are correct; the difference is a
constant factor per rejected candidate, and on an exponential search a constant factor is worth
having.

**★ When is `break` valid in a backtracking loop, and when is it a bug?**
It is valid exactly when the candidates are ordered so that one candidate failing implies every
later candidate fails — sorted ascending positive numbers against a shrinking target is the standard
case, because if `a[i]` already exceeds the target then so does everything after it. It is a bug on
unsorted candidates, and it is a bug even on sorted candidates if negatives are allowed, because a
negative later in the list could bring the total back under the target. The tell that someone has
copied the pattern without the condition is a `break` on an array the code never sorted.

**A pruned search returns fewer answers than expected. How do you narrow it down without a
debugger?**
By which answers are missing. If the very first branch is already incomplete, the test itself
encodes a constraint the problem does not have — a specification bug, not a code bug, and tracing
will not reveal it. If the first branch is correct and later ones are missing, the pruning *state*
is not being restored: some set, counter or marked cell that the test consults was left dirty by an
earlier subtree's un-choose. That split covers nearly every case and costs nothing to check, which
matters because these searches are exponential and stepping through one is not a strategy.

{/* FOOTER */}
