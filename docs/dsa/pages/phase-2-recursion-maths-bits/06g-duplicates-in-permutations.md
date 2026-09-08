---
title: "The permutation duplicate rule is `i > 0 && a[i] === a[i-1] && !used[i-1]` and the missing exclamation mark is the single most commonly botched line in backtracking — because both versions read as sensible English and only one of them returns any answers at all"
sidebar_label: "06g · Duplicates in permutations"
sidebar_position: 6.6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The rule, its correctness argument and the multiset permutation count
> `n!/(m₁!·m₂!·…)` are **mathematics and common practice, derived on this page, not cited to a
> source**. The counting side is
> [08 · Combinatorics for counting problems](08-combinatorics-for-counting-problems.md). Java
> targets **JDK 25**; TypeScript first, Java second. The skeleton being modified is
> [06e](06e-permutations-and-the-used-array.md); the start-index form of the same idea is
> [06f](06f-duplicates-in-subsets-and-combinations.md). **No sandbox run.**

**The subsets rule does not carry across, and the reason is structural rather than incidental.** In
the start-index family, the siblings at a node are the candidates from `start` onwards, so "already
tried at this node" is positional and `i > start` says it. In the permutation family, *every* unused
index is a candidate at *every* node, so nothing about `i` alone identifies the node — and the
condition has to reconstruct "already tried here" from the used array. The expression that does it
is `!used[i - 1]`, it reads as the rule **equal values are used left to right**, and the version
with the negation dropped forbids two equal values from ever both appearing, returning an empty
list for any input with a repeat.

## The code

```ts
export function permuteUnique(nums: number[]): number[][] {
  const a = [...nums].sort((x, y) => x - y);     // sort: the rule needs equal values adjacent
  const out: number[][] = [];
  const path: number[] = [];
  const used = new Array<boolean>(a.length).fill(false);

  const go = (): void => {
    if (path.length === a.length) { out.push([...path]); return; }
    for (let i = 0; i < a.length; i++) {
      if (used[i]) continue;
      // 🔴 the line: skip this duplicate unless its equal predecessor is already placed
      if (i > 0 && a[i] === a[i - 1] && !used[i - 1]) continue;
      used[i] = true;  path.push(a[i]);
      go();
      path.pop();      used[i] = false;
    }
  };

  go();
  return out;                                     // n! / (m₁!·m₂!·…) answers
}
```

```java
public List<List<Integer>> permuteUnique(int[] nums) {
    int[] a = nums.clone();
    Arrays.sort(a);
    List<List<Integer>> out = new ArrayList<>();
    go(a, new boolean[a.length], new ArrayList<>(), out);
    return out;
}

private void go(int[] a, boolean[] used, List<Integer> path, List<List<Integer>> out) {
    if (path.size() == a.length) { out.add(new ArrayList<>(path)); return; }
    for (int i = 0; i < a.length; i++) {
        if (used[i]) continue;
        if (i > 0 && a[i] == a[i - 1] && !used[i - 1]) continue;   // the line
        used[i] = true;  path.add(a[i]);
        go(a, used, path, out);
        path.remove(path.size() - 1);  used[i] = false;
    }
}
```

## Reading the condition as a rule

**Equal values must be used left to right.** `!used[i - 1]` means the identical value immediately
to the left has *not* been placed yet — so placing `a[i]` now would consume the duplicates out of
order. That ordering is already covered by the branch that takes `a[i-1]` first, so forbidding it
keeps exactly one representative of each class of equivalent orderings and loses nothing.

Why exactly one survives: among the `mᵢ!` ways to assign the `mᵢ` equal copies of a value to the
positions the answer gives them, precisely one respects left-to-right index order. The rule keeps
that one. That is also the derivation of the answer count, `n!/(m₁!·m₂!·…)` — it is not a
coincidence that the code's output size and the multiset formula agree; the code *is* the formula's
proof.

## The version with the negation flipped

```ts
if (i > 0 && a[i] === a[i - 1] && used[i - 1]) continue;   // 🔴 WRONG — no `!`
```

That says "skip a duplicate whose predecessor **is** already used", which forbids two equal values
from both appearing in a permutation. For any input containing a repeat, no branch ever reaches
length n, so `out` is **empty** — not partially wrong, empty. That total failure is actually the
friendliest possible symptom, and it is why the rule is worth memorising as English rather than as
a boolean expression: *"skip it unless its twin to the left is already down."*

Two other near-misses that are less friendly:

```ts
if (i > 0 && a[i] === a[i - 1]) continue;                  // 🔴 no used-check: keeps only ONE
                                                           //    ordering per distinct value set
if (i > used.length && a[i] === a[i - 1] && !used[i-1]) …   // 🔴 nonsense: the subsets condition
                                                           //    mangled to fit
```

The first drops the `used` test entirely and reduces the enumeration to the permutations of the
*distinct* values in sorted-adjacent order — far too few answers, and unlike the flipped-negation
version it produces *some* output, so it survives a smoke test.

## Why the subsets condition cannot be reused

| | Subsets / combinations | Permutations |
|---|---|---|
| Candidates at a node | `a[start …]` | every `i` with `!used[i]` |
| "First candidate at this node" | `i === start` | not expressible from `i` alone |
| Duplicate condition | `i > start && a[i] === a[i-1]` | `i > 0 && a[i] === a[i-1] && !used[i-1]` |
| What the extra term does | — | reconstructs "already tried here" from the path |

Attempting to carry `i > start` across is the second-most-common error in this area, and it does not
even typecheck in the permutation skeleton, because there is no `start`. The instinct to *invent*
one — passing a start index into a permutation search — silently converts it into a combination
search that returns one answer.

## The per-level set, and when it is required

Equivalent, sometimes clearer, and **mandatory for the swap-based permutation form** from
[06e](06e-permutations-and-the-used-array.md), because swapping destroys the sortedness the
adjacency test depends on:

```ts
// Per-node set of values already tried at this node. No sort needed; one allocation per node.
const go = (): void => {
  if (path.length === a.length) { out.push([...path]); return; }
  const triedHere = new Set<number>();
  for (let i = 0; i < a.length; i++) {
    if (used[i] || triedHere.has(a[i])) continue;
    triedHere.add(a[i]);                     // 🔴 never cleared and never hoisted out of `go`
    used[i] = true;  path.push(a[i]);
    go();
    path.pop();      used[i] = false;
  }
};
```

```java
private void go(int[] a, boolean[] used, List<Integer> path, List<List<Integer>> out) {
    if (path.size() == a.length) { out.add(new ArrayList<>(path)); return; }
    Set<Integer> triedHere = new HashSet<>();          // per node, by construction
    for (int i = 0; i < a.length; i++) {
        if (used[i] || !triedHere.add(a[i])) continue; // Set.add returns false if present
        used[i] = true;  path.add(a[i]);
        go(a, used, path, out);
        path.remove(path.size() - 1);  used[i] = false;
    }
}
```

Note `triedHere` needs **no un-choose**: it is a local of the frame, so it dies with the node. That
is the same principle as passing a scalar by parameter rather than mutating shared state — the
cheapest correct state is state that cannot escape.

The trade: no sort, no subtle condition, and it works on values that cannot be ordered — against
one set allocation per node and a hash per candidate. Reach for the sorted form on numbers and
strings; reach for the set form when the values are not comparable, when the candidate order is not
yours to control, or when the skeleton reorders as it runs.

## Gotchas

**★ Symptom: `permuteUnique` returns an empty list for any input containing a repeat.** Cause: the
negation flipped — `used[i-1]` instead of `!used[i-1]` — which forbids two equal values from both
appearing, so no branch ever reaches length n. Fix: `!used[i-1]`, read as "equal values are used
left to right". An empty result on `[1,1]` is the two-second check.

**★ Symptom: far too few permutations, but not zero.** Cause: the `!used[i-1]` term dropped
entirely, leaving `i > 0 && a[i] === a[i-1]`, which permutes only the distinct values. Fix: restore
the term. This one survives a smoke test precisely because it produces plausible-looking output —
count against `n!/(m₁!·m₂!·…)` for a small input.

**★ Symptom: the subsets condition `i > start` copied into the permutation skeleton.** Cause:
assuming one duplicate rule serves both families. Fix: they are different because "same node" is
positional in one and reconstructed from `used` in the other; and inventing a `start` for a
permutation search converts it into a combination search that returns a single answer.

**★ Symptom: `triedHere` hoisted out of the recursive function to avoid the per-node allocation,
and most of the output disappears.** Cause: the set's meaning is "tried at *this* node"; hoisting it
turns that into "tried anywhere in the search". Fix: it must be a local of the frame — which is also
why it needs no un-choose.

**Symptom: the swap-based permutation form gives wrong results after the sorted rule is added.**
Cause: sort-and-skip needs equal values adjacent in the candidate list, and swapping reorders the
array as the search descends, so the sorted neighbour is no longer the previous sibling. Fix: use
the used-array form, or the per-level set with the swap form.

**Symptom: `used` replaced by a `Set` of used *values* and duplicate inputs collapse.** Cause: a
value-keyed set cannot distinguish two equal elements, so the second is permanently unavailable and
the search enumerates permutations of the distinct values. Fix: mark by index. The whole duplicate
rule is about sibling positions precisely because indices, not values, are what distinguishes equal
elements.

**Symptom: sorting applied to an array of objects with a comparator on one field, and the rule
skips distinct elements.** Cause: the same interchangeability assumption as in
[06f](06f-duplicates-in-subsets-and-combinations.md) — equal *keys* are not equal *elements*. Fix:
compare the identity that actually determines the answer, or drop the deduplication.

## Interview questions

**★ Write the duplicate condition for permutations, and explain why it is not the same as the one
for subsets.**
`if (i > 0 && a[i] === a[i-1] && !used[i-1]) continue;` on sorted input. It encodes "equal values
must be used left to right": if the identical value immediately to the left has not been placed yet,
placing this one now would consume the duplicates out of order, and that ordering is already covered
by the branch that takes the left one first. It differs from the subsets condition because "same
node" is expressed differently — in subsets the siblings are the candidates from `start` onwards, so
the test is positional; in permutations every unused index is a candidate at every node, so
`!used[i-1]` is what reconstructs "already tried here". Flipping that negation forbids two equal
values from ever both appearing and returns an empty list.

**★ How many distinct permutations does a multiset have, and how does that relate to the code?**
`n! / (m₁! · m₂! · …)`, where the `mᵢ` are the multiplicities: the n! orderings over-count each
distinct arrangement once per way of permuting the equal elements among themselves, and there are
`mᵢ!` such ways per value. That quotient is exactly the number of leaves the skip-equal-siblings
version reaches, because among the `mᵢ!` assignments of equal copies to positions, precisely one
respects left-to-right index order and the rule keeps that one. The code is the formula's proof, and
the factor removed is exactly the redundant work the naive version does and discards.

**★ When would you use a per-level set instead of the sorted condition?**
When the candidates cannot be sorted meaningfully, when the candidate order is not under your
control, or when the skeleton destroys the sortedness as it runs — which is exactly the case for the
swap-based permutation form, since swapping moves elements out of sorted order as the search
descends. The set form allocates one `Set` per node and hashes each candidate, against one sort plus
an integer comparison per candidate, so it is the more expensive of the two. It is also markedly
harder to get wrong, which is a legitimate consideration under time pressure — and it needs no
un-choose, because a local of the frame cannot leak into a sibling.

**Your `permuteUnique` returns an empty list. What is the one-line diagnosis?**
The negation on `used[i-1]`. It is the only bug in this skeleton that produces *nothing* rather than
something wrong: forbidding a duplicate whose twin is already placed means no branch can ever place
two equal values, so no path reaches length n and no leaf ever fires. Every other error here —
missing sort, missing `used` term, wrong sibling test — produces some output. Test on `[1,1]`: the
correct answer is exactly one permutation, and the flipped version gives zero.

**Does this rule interact with pruning?**
Yes, and the order matters for cost rather than correctness. The duplicate skip is a candidate
filter and belongs with the other feasibility tests at the top of the loop body, before the choose —
so the subtree is never entered. Putting it after the choose, or checking it inside the child, means
the branch is entered and abandoned, which costs a push, a frame and a pop per skipped duplicate.
On a multiset with high multiplicities that is a large constant factor on top of an already
exponential search. Pruning order in general is [06h](06h-feasibility-pruning.md).

---

← Prev: [06f · Duplicates in subsets and combinations](06f-duplicates-in-subsets-and-combinations.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [06h · Feasibility pruning](06h-feasibility-pruning.md)
