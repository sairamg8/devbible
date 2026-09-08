---
title: "Subsets and combinations are one skeleton with a start index, and the start index is the entire reason each answer is generated once — plus the one-expression bound in the combinations loop that prunes near the root and is routinely omitted"
sidebar_label: "06d · Subsets and combinations"
sidebar_position: 6.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. These enumerations and the start-index argument are **common practice,
> derived on this page, not cited to a source**. Complexity figures are the ones derived in
> [06c](06c-the-cost-of-the-search-tree.md) from the tree, not measured. Java targets **JDK 25**;
> TypeScript first, Java second. Permutations are
> [06e](06e-permutations-and-the-used-array.md), duplicate inputs are
> [06f](06f-duplicates-in-subsets-and-combinations.md), and the harder catalogue is
> [Part 6 of the syllabus](../../syllabus/06-backtracking-greedy-and-dp.md). **No sandbox run.**

**The `start` index is not a loop-bound optimisation; it is the thing that makes the enumeration
order-insensitive.** Because an element can only ever be chosen after the elements before it, each
subset has exactly one route through the search tree — which is why 2^n subsets come out of a tree
with 2^n nodes and no deduplication step anywhere. Delete `start`, loop from `0`, and you have
silently written *orderings of subsets*: the same skeleton, a wildly larger output, and no error
message. This chunk is that family — subsets, its binary twin, and combinations with the
feasibility bound that belongs in the loop header.

## One skeleton, several fillings

| | Choices at a node | Emits at | Next call | Leaves |
|---|---|---|---|---|
| **subsets** | `nums[start …]` | **every node** | `i + 1` | 2^n |
| **subsets, binary form** | take `nums[i]` or skip it | leaves only | `i + 1` on both branches | 2^n |
| **combinations** of size k | `nums[start …]` | nodes where `path.length === k` | `i + 1` | C(n, k) |
| **combinations with reuse** | `nums[start …]` | when the target is met | `i` — not `i + 1` | input-dependent |
| **permutations** ([06e](06e-permutations-and-the-used-array.md)) | every `i` with `!used[i]` | `path.length === n` | all of `0…n−1` | n! |

Everything else — the choose, the explore, the un-choose, the snapshot at the leaf — is identical
in every row.

## Subsets

Every node of the tree *is* a subset, so the emit happens on entry rather than at a base case, and
the recursion terminates because `start` walks off the end of the array.

```ts
export function subsets(nums: number[]): number[][] {
  const out: number[][] = [];
  const path: number[] = [];

  const go = (start: number): void => {
    out.push([...path]);                     // every node is an answer — snapshot it
    for (let i = start; i < nums.length; i++) {
      path.push(nums[i]);                    // choose
      go(i + 1);                             // explore — i + 1: no element is reused
      path.pop();                            // un-choose
    }
  };

  go(0);
  return out;                                // Θ(n · 2^n)
}
```

```java
public List<List<Integer>> subsets(int[] nums) {
    List<List<Integer>> out = new ArrayList<>();
    go(nums, 0, new ArrayList<>(), out);
    return out;
}

private void go(int[] nums, int start, List<Integer> path, List<List<Integer>> out) {
    out.add(new ArrayList<>(path));                 // snapshot — never add `path` itself
    for (int i = start; i < nums.length; i++) {
        path.add(nums[i]);
        go(nums, i + 1, path, out);
        path.remove(path.size() - 1);
    }
}
```

Note there is no base case at all, and that is correct: the loop is empty when `start` reaches
`nums.length`, so the node emits and returns. Adding `if (start === nums.length) return;` is
harmless; adding `if (start === nums.length) { out.push([...path]); return; }` and moving the emit
there is the bug that loses every non-maximal subset.

## The binary include/exclude form

The same enumeration on a different tree, and worth being able to write because some follow-ups are
much easier on it — counting, converting to a bitmask
([Bitmask enumeration](09-bitmask-enumeration.md)), and anything where "the decision at index i" is the
natural state to memoise on:

```ts
// Include/exclude form: a strictly binary tree of depth n, 2^n leaves, emits only at leaves.
export function subsetsBinary(nums: number[]): number[][] {
  const out: number[][] = [];
  const path: number[] = [];
  const go = (i: number): void => {
    if (i === nums.length) { out.push([...path]); return; }
    go(i + 1);                                  // exclude nums[i]
    path.push(nums[i]);
    go(i + 1);                                  // include nums[i]
    path.pop();
  };
  go(0);
  return out;
}
```

The two forms produce the same subsets in a different order. The start-index form has 2^n nodes and
emits at every one; the binary form has 2^n leaves, about 2^(n+1) nodes, and emits only at leaves.
Neither is faster in Θ terms. Prefer the start-index form for the duplicate handling in
[06f](06f-duplicates-in-subsets-and-combinations.md), where "skip equal siblings" is a
statement about one loop and has no clean analogue in the binary form — there the corresponding
move is "skip the whole run of equal values at once", which is a different and fiddlier line.

## Combinations

Same choice rule, a real base case, and one line of feasibility pruning that matters far more than
it looks:

```ts
export function combine(n: number, k: number): number[][] {
  const out: number[][] = [];
  const path: number[] = [];

  const go = (start: number): void => {
    if (path.length === k) { out.push([...path]); return; }
    const need = k - path.length;
    // 🔴 stop early: fewer than `need` candidates remain from i onwards, so no completion exists
    for (let i = start; i <= n - need + 1; i++) {
      path.push(i);
      go(i + 1);
      path.pop();
    }
  };

  go(1);
  return out;                                  // Θ(k · C(n, k))
}
```

```java
public List<List<Integer>> combine(int n, int k) {
    List<List<Integer>> out = new ArrayList<>();
    go(n, k, 1, new ArrayList<>(), out);
    return out;
}

private void go(int n, int k, int start, List<Integer> path, List<List<Integer>> out) {
    if (path.size() == k) { out.add(new ArrayList<>(path)); return; }
    int need = k - path.size();
    for (int i = start; i <= n - need + 1; i++) {   // the same early stop
        path.add(i);
        go(n, k, i + 1, path, out);
        path.remove(path.size() - 1);
    }
}
```

Where `n - need + 1` comes from: at index `i` there are `n − i + 1` candidates remaining, and the
branch can only reach length `k` if `n − i + 1 ≥ need`, which rearranges to `i ≤ n − need + 1`.
This is feasibility pruning, the class developed in [06h](06h-feasibility-pruning.md). Without it
the search is still *correct* — it descends into subtrees that provably contain no leaf and finds
none. With it, whole subtrees vanish near the top of the tree, where
[06c](06c-the-cost-of-the-search-tree.md)'s geometric-series argument says the nodes are.

**Reuse allowed** is a one-character change — recurse on `i` rather than `i + 1`, keeping the
current element in the candidate set for the subtree below it. That is the combination-sum family,
and the change creates a termination obligation: some measure must strictly decrease down every
branch (a remaining target shrinking by at least the smallest positive candidate) or the recursion
never bottoms out. It is why those problems always state that the candidates are positive.
[Part 6](../../syllabus/06-backtracking-greedy-and-dp.md) owns the family.

## Why `start` is the whole difference

One sentence, and it is the one to say: **a `start` index makes the enumeration order-insensitive,
because an element can only be chosen after the elements before it — so each subset is reachable by
exactly one route through the tree.** No deduplication is needed because no duplicate is ever
generated.

Remove `start` and loop from `0` and the same subset becomes reachable by every ordering of its
elements. You have written permutations of every subset: neither of the things you wanted, and the
output size is the tell — much larger than 2^n and not n! either. The count is
`Σ_k C(n,k)·k!`, the number of ordered sequences of distinct elements, which is a genuinely
different object.

The storefront version makes it concrete. "Which combinations of promotions can apply to this
cart?" is a subset enumeration — applying *discount A then B* is the same set of promotions as *B
then A*, so `start` is correct. "In which orders can we attempt these three payment methods?" is a
permutation — the order is the answer. Getting that distinction wrong produces an answer set that
is a multiple of the right one, which in a real system shows up as duplicated work rather than as
a crash.

## Gotchas

**★ Symptom: the loop starts at `0` instead of `start`, and the output contains both `[1,2]` and
`[2,1]`.** Cause: the start index is the only thing making the enumeration order-insensitive. Fix:
loop from `start` and recurse on `i + 1` (no reuse) or `i` (reuse allowed). The output size is
diagnostic: far more than 2^n means you enumerated orderings of subsets, not subsets.

**★ Symptom: `combine` returns the right answers but explores far more nodes than necessary.**
Cause: the `i <= n - need + 1` bound omitted, so the search descends into subtrees with too few
remaining candidates to ever reach length k. Fix: add the bound — it is one expression, it prunes
near the root where the nodes are, and it changes nothing about correctness.

**★ Symptom: the empty set and the singletons are missing from the subsets output.** Cause: the
snapshot moved into a base case that only fires when `start` reaches the end, which turns the
start-index form into a leaves-only enumeration and keeps only the maximal chains. Fix: in the
start-index form every node is an answer, so the snapshot goes at the top of the function with no
guard; only the binary include/exclude form emits at a base case. The two forms have different
emit points and mixing them loses answers.

**Symptom: `combine(n, k)` produces `[1,2]` twice.** Cause: recursing on `i` instead of `i + 1`
while the problem forbids reuse. Fix: `i + 1`. Say the one-character difference out loud as you
write it; it is the same character that separates two whole problem families.

**Symptom: a subsets solution that deduplicates the output at the end.** Cause: treating duplicate
answers as a post-processing problem instead of a generation problem. Fix: with `start` there are
no duplicate answers to remove on distinct input; with duplicate *input* the fix is the
skip-equal-siblings line in [06f](06f-duplicates-in-subsets-and-combinations.md), which never
generates them. A `Set` of stringified answers works, costs Θ(output) extra memory and a
serialisation per leaf, and tells the interviewer you did not find the real fix.

**Symptom: the combinations loop uses `i < n - need + 1` and one answer is missing.** Cause: an
off-by-one in the derived bound — `i` may legitimately equal `n − need + 1`, which is the branch
that takes every remaining candidate. Fix: `<=`, and sanity-check it with `need = 1`, where the
bound must permit `i = n`.

## Interview questions

**★ Why does the subsets skeleton need a start index at all?**
Because without it the same subset is reachable by every ordering of its elements, so the
enumeration produces ordered sequences rather than sets. The start index enforces that an element
is only ever chosen after the elements before it, which gives each subset exactly one route through
the tree — 2^n nodes, 2^n answers, no deduplication step. That is also the reason the subsets
skeleton has no visited set and no `Set` of results: uniqueness is structural, not filtered.

**★ Where does the `i <= n - need + 1` bound in `combine` come from, and what does it buy?**
From counting what remains: at index `i` there are `n − i + 1` candidates left, and the branch can
only reach length `k` if that is at least `need = k − path.length`, which rearranges to
`i ≤ n − need + 1`. It buys nothing in correctness — without it the search simply explores subtrees
containing no leaf — and a great deal in work, because those subtrees are cut near the top of the
tree where the levels are geometrically largest. It is the cheapest feasibility pruning in the
topic and the one most often left out.

**★ How do you turn "combinations" into "combinations where elements may be reused"?**
Recurse on `i` instead of `i + 1`, so the current element stays in the candidate set for the
subtree below it; the start index still prevents the same multiset being generated in several
orders. The obligation the change creates is termination: some measure must strictly decrease down
every branch — a remaining target shrinking by at least the smallest positive candidate, or an
explicit depth cap — or the recursion never bottoms out. That is why combination-sum problems
always specify positive candidates, and it is worth naming the requirement rather than waiting to
be asked.

**How many nodes does the start-index subsets tree have, and why does that differ from the binary
form?**
Exactly 2^n, because the search emits on entry and each node corresponds to one subset: the root is
the empty set, and choosing `nums[i]` from a node gives that node's subset plus that element. The
tree is not binary — the node at `start = i` has `n − i` children — and the sum still comes to 2^n.
The include/exclude form is a strictly binary tree of depth n with 2^n leaves and about 2^(n+1)
nodes, emitting only at leaves. Same enumeration, different tree, same Θ class. The difference
matters when you want to attach state to "the decision at index i", which the binary form gives you
and the start-index form does not — which is exactly the shape a subset-sum DP or a bitmask
enumeration wants.

**A candidate deduplicates the subsets output with a `Set`. What do you say?**
That it is treating a generation problem as a filtering problem. On distinct input the start index
already guarantees uniqueness, so the `Set` is dead code that costs a serialisation per leaf. On
duplicate input the correct fix is to skip equal siblings in the choice loop, which never generates
the duplicate branch at all — the `Set` version still walks the entire duplicated tree and merely
hides the result, so it is slower by exactly the factor the input's multiplicities imply.

---

← Prev: [06c · The cost of the search tree](06c-the-cost-of-the-search-tree.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [06e · Permutations and the used array](06e-permutations-and-the-used-array.md)
