---
title: "Duplicate input is a generation problem, not a filtering problem — sort the input and skip a candidate equal to its previous sibling, where `i > start` rather than `i > 0` is the entire subtlety and getting it wrong deletes every answer with a repeated value"
sidebar_label: "06f · Duplicates in subsets and combinations"
sidebar_position: 6.5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The sort-and-skip rule and its correctness argument are **common practice
> and mathematics, derived on this page, not cited to a source**. The one primary-sourced claim is
> the default sort order in JavaScript, quoted from MDN's
> [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort).
> Java targets **JDK 25**; TypeScript first, Java second. The permutation form of the same rule is
> [06g](06g-duplicates-in-permutations.md); the skeleton being modified is
> [06d](06d-subsets-and-combinations.md). **No sandbox run.**

**Sort the input, then refuse to make the same choice twice at the same node.** That is the entire
rule for duplicate input, and it is correct because duplicate *answers* come from choosing equal
values in different orders at the same level of the tree — never from anything deeper. Sorting
makes equal values adjacent, so "the same choice twice at this node" reduces to "this candidate
equals the previous candidate", which is a comparison of two array slots. The condition is four
tokens long, one of them is `start` rather than `0`, and swapping those two deletes `[2,2]` from
the output along with every other answer containing a repeated value.

## Why the fix belongs at the sibling level

Take input `[1, 2, 2]` and the subsets skeleton from [06d](06d-subsets-and-combinations.md). At the
root the candidates are `1`, `2`, `2`. Choosing the first `2` and choosing the second `2` produce
**identical subtrees**: after either choice the path is `[2]` and the remaining candidates are the
same. Everything one subtree produces, the other produces again — and that is the only source of
duplicate answers in the whole search.

So the fix is: **at any node, use each distinct value at most once.** Sorting makes equal values
adjacent, which turns "already used this value at this node" into "equal to the previous
candidate".

This is why it is a generation fix and not a filtering fix. Deduplicating the output with a `Set`
still walks every duplicated subtree and then discards the results; skipping the sibling never
builds the subtree at all. On input with multiplicities `m₁, m₂, …` the ratio between the two is
the product of the `mᵢ!` — the same factor that makes the multiset permutation count
`n!/(m₁!·m₂!·…)` instead of `n!`, derived in
[08 · Combinatorics for counting problems](08-combinatorics-for-counting-problems.md).

## The code

```ts
export function subsetsWithDup(nums: number[]): number[][] {
  const a = [...nums].sort((x, y) => x - y);    // 🔴 sort first — the rule needs adjacency
  const out: number[][] = [];
  const path: number[] = [];

  const go = (start: number): void => {
    out.push([...path]);
    for (let i = start; i < a.length; i++) {
      if (i > start && a[i] === a[i - 1]) continue;   // 🔴 skip equal SIBLINGS
      path.push(a[i]);
      go(i + 1);
      path.pop();
    }
  };

  go(0);
  return out;
}
```

```java
public List<List<Integer>> subsetsWithDup(int[] nums) {
    int[] a = nums.clone();                            // do not reorder the caller's array
    Arrays.sort(a);
    List<List<Integer>> out = new ArrayList<>();
    go(a, 0, new ArrayList<>(), out);
    return out;
}

private void go(int[] a, int start, List<Integer> path, List<List<Integer>> out) {
    out.add(new ArrayList<>(path));
    for (int i = start; i < a.length; i++) {
        if (i > start && a[i] == a[i - 1]) continue;   // skip equal siblings
        path.add(a[i]);
        go(a, i + 1, path, out);
        path.remove(path.size() - 1);
    }
}
```

The identical line works for fixed-size combinations with duplicate input, and for combination-sum
with duplicate candidates — the choice loop is the same, only the base case differs. That family is
[Part 6 of the syllabus](../../syllabus/06-backtracking-greedy-and-dp.md); the line is this one.

## `i > start`, not `i > 0`

```ts
if (i > 0 && a[i] === a[i - 1]) continue;      // 🔴 WRONG: kills [2,2] and every repeated run
if (i > start && a[i] === a[i - 1]) continue;  // ✅ skips only equal siblings at this node
```

`i > start` means **"this is not the first candidate considered at this node."** The first equal
value at a node is used; every later one is skipped. `i > 0` instead means "this is not the first
element of the array", which forbids a value from following an equal value *anywhere in the path* —
so `[2, 2]` never gets built, and neither does any answer containing a repeated value.

The distinction is easy to check without running anything: on `[2, 2]`, the correct condition uses
`a[0]` at the root (`i === start === 0`, so no skip), descends to `start = 1`, and there
`i === start === 1` again, so no skip and `[2,2]` is produced. The `i > 0` version skips at that
second node and the answer is lost. That two-element trace is the fastest way to verify the
condition on a whiteboard, and it is worth doing out loud.

## The sort is load-bearing, and TypeScript's default sort is not a sort

On unsorted input, equal values are not adjacent, so `a[i] === a[i - 1]` tests the wrong pair. It
does not merely fail to skip duplicates — it *does* skip arbitrary candidates that happen to follow
an equal one, so valid answers disappear as well. Both failure directions at once.

In TypeScript the sort itself is a documented trap:

> *"If `compareFn` is not supplied, all non-`undefined` array elements are sorted by converting them
> to strings and comparing strings in UTF-16 code units order."* — MDN, `Array.prototype.sort()`

So `[...nums].sort()` on numbers produces string order, which is not numeric order and which leaves
equal values adjacent only by luck of their decimal representations. Always pass
`(x, y) => x - y` for numbers. The bug hides completely on single-digit test data.

Both languages sort **in place**: `nums.sort(...)` in TypeScript and `Arrays.sort(nums)` in Java
mutate the array the caller passed. Copy first — `[...nums]`, `nums.clone()` — unless the API has
agreed the input may be reordered. A search that quietly reorders its input is the kind of thing
that works in isolation and breaks the caller's next assertion.

## When equal values are not interchangeable

The rule assumes that two elements with the same value are *substitutable* — that swapping them
produces the same answer. That is true for numbers and characters and false surprisingly often in
real code. Two cart lines with the same SKU but different warehouses, two identically-priced
promotions with different expiry dates, two equal weights attached to different jobs: skipping the
"duplicate" sibling then deletes real, distinct answers.

The test to apply before reaching for the rule: **is the element's identity exhausted by the value
you are comparing?** If not, either compare the full identity (sort by a composite key and compare
that) or do not deduplicate at all. This is the one situation where a `Set` on the output is
genuinely no worse — because there are no duplicates to remove, and the search was never redundant
in the first place.

## Gotchas

**★ Symptom: `subsetsWithDup([1,2,2])` is missing `[2,2]`.** Cause: the condition written `i > 0`
instead of `i > start`, which forbids a value from following an equal value anywhere rather than
only at the same node. Fix: `i > start`, meaning "not the first candidate at this node" — and
verify on `[2,2]`, where the correct version must produce a two-element answer.

**★ Symptom: duplicates still appear in the output despite the skip condition.** Cause: the input
was not sorted, so equal values are not adjacent and `a[i] === a[i-1]` compares the wrong pair. Fix:
sort first, with an explicit numeric comparator in TypeScript because the default comparator sorts
the stringified elements.

**★ Symptom: the answers are correct but the search is far slower than the answer count
suggests.** Cause: deduplicating at the end with a `Set` of serialised answers instead of skipping
siblings. The search still explores every duplicated subtree — a factor of `m₁!·m₂!·…` more nodes —
then pays a serialisation and a hash per leaf to discard most of them. Fix: skip at generation.

**★ Symptom: a `[1,2,2]`-style input works and a `[10, 9, 9]`-style input does not.** Cause:
`sort()` with no comparator, which orders `["10","9","9"]` as strings. Fix: `sort((x, y) => x - y)`.
Single-digit test data hides this completely, which is why it survives to production.

**Symptom: the caller's array comes back reordered.** Cause: both `Array.prototype.sort` and
`Arrays.sort` sort in place. Fix: `[...nums].sort(...)` or `nums.clone()` before sorting, unless
reordering the input is part of the contract.

**Symptom: real, distinct answers go missing after adding duplicate handling.** Cause: the elements
compare equal on the sorted key but are not interchangeable — same SKU, different warehouse. Fix:
sort and compare on the full identity, or drop the deduplication; if the elements are genuinely
distinct, no duplicate answers were being generated and the rule had nothing to do.

**Symptom: the skip condition placed after the choose rather than at the top of the loop body.**
Cause: treating it as a check on the path instead of on the candidate. Fix: it is a candidate
filter — it belongs before the push, alongside any other feasibility test, so the subtree is never
entered rather than entered and abandoned.

## Interview questions

**★ How do you generate subsets of an array that contains duplicates, without producing duplicate
subsets?**
Sort the input so equal values are adjacent, then in the choice loop skip any candidate equal to the
previous one *unless it is the first candidate at this node*:
`if (i > start && a[i] === a[i-1]) continue;`. It works because duplicate answers arise only from
choosing equal values in different orders at the same level — the subtrees below the first `2` and
the second `2` are identical — so using each distinct value at most once per node removes exactly
the redundant branches and nothing else. `i > start` rather than `i > 0` is the crux: the test must
mean "not the first candidate at this node", or `[2,2]` is forbidden along with every other answer
containing a repeat.

**★ Why not just deduplicate the results at the end?**
Because it hides the work rather than saving it. The search still explores every duplicated subtree
— on a multiset with multiplicities `m₁, m₂, …` that is a factor of `m₁!·m₂!·…` more nodes — and
then pays a serialisation and a hash per leaf to discard most of them. Skipping equal siblings never
builds the duplicate branch, so the node count drops by that factor. It is also the difference
between an algorithm whose cost matches its output size and one whose cost does not, which is the
property that makes an enumeration optimal in the first place
([06c](06c-the-cost-of-the-search-tree.md)).

**★ What goes wrong if you forget to sort?**
The adjacency test compares the wrong pair. `a[i] === a[i-1]` only means "the same choice as the
previous sibling" when equal values are adjacent; on unsorted input it is true for coincidental
neighbours and false for the duplicates you meant to skip. The result is wrong in both directions:
some duplicate answers survive, and some valid answers vanish because they happened to follow an
equal element. In TypeScript there is a second layer — `sort()` without a comparator compares
stringified elements, so "I sorted it" can still leave the array unsorted for this purpose, and MDN
documents that default explicitly.

**When is the sort-and-skip rule the wrong thing to do?**
When equal values are not interchangeable. The rule's premise is that swapping two equal elements
produces the same answer; if the elements carry identity beyond the compared value — two cart lines
with the same SKU and different warehouses, two equal weights on different jobs — then the "duplicate"
sibling leads to a genuinely different answer and skipping it deletes real output. The check is
whether the element's identity is exhausted by the key you compare. If it is not, either sort and
compare on the full identity, or do not deduplicate: with truly distinct elements the search was
never generating duplicates and the rule has nothing to remove.

**Does the same line work for combinations and for combination sum?**
Yes — the choice loop is identical across the whole start-index family, so `i > start && a[i] ===
a[i-1]` is the duplicate rule for fixed-size combinations and for combination-sum with duplicate
candidates too; only the base case changes. What does *not* carry across is the permutation
skeleton, where every unused index is a candidate at every node and "same node" cannot be read off
the index — that needs the different condition in [06g](06g-duplicates-in-permutations.md).

{/* FOOTER */}
