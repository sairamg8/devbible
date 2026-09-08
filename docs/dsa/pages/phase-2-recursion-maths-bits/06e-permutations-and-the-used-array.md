---
title: "Permutations drop the start index and track a used array instead, which is why the count is n! rather than 2^n — and the swap-in-place variant that saves that array costs you the caller's input, the output order, and the standard duplicate rule"
sidebar_label: "06e · Permutations and the used array"
sidebar_position: 6.4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The permutation skeleton, the swap variant and the factorial number system
> are **common practice and mathematics, derived on this page, not cited to a source**. Complexity
> figures come from the tree argument in [06c](06c-the-cost-of-the-search-tree.md), not from
> measurement. Java targets **JDK 25**; TypeScript first, Java second. Duplicate inputs are
> [06g](06g-duplicates-in-permutations.md). **No sandbox run.**

**Order matters, so there is no `start` — every element not yet used is a candidate, and "used" is
per-path state that has to be undone exactly like the path itself.** That single change turns 2^n
into n!, and it introduces the first skeleton in this topic with *two* mutations per choose and
therefore two inverses per un-choose, in reverse order. The variant that replaces the used array
with in-place swapping is a real space saving with three real costs, and knowing all three is what
makes "I'd use the used array" a decision rather than a default.

## The used-array form

```ts
export function permute(nums: number[]): number[][] {
  const out: number[][] = [];
  const path: number[] = [];
  const used = new Array<boolean>(nums.length).fill(false);

  const go = (): void => {
    if (path.length === nums.length) { out.push([...path]); return; }
    for (let i = 0; i < nums.length; i++) {
      if (used[i]) continue;                   // the only difference from `combine`
      used[i] = true;  path.push(nums[i]);     // choose — TWO mutations
      go();                                    // explore
      path.pop();      used[i] = false;        // un-choose — TWO inverses, reverse order
    }
  };

  go();
  return out;                                  // Θ(n · n!)
}
```

```java
public List<List<Integer>> permute(int[] nums) {
    List<List<Integer>> out = new ArrayList<>();
    go(nums, new boolean[nums.length], new ArrayList<>(), out);
    return out;
}

private void go(int[] nums, boolean[] used, List<Integer> path, List<List<Integer>> out) {
    if (path.size() == nums.length) { out.add(new ArrayList<>(path)); return; }
    for (int i = 0; i < nums.length; i++) {
        if (used[i]) continue;
        used[i] = true;  path.add(nums[i]);
        go(nums, used, path, out);
        path.remove(path.size() - 1);  used[i] = false;
    }
}
```

Three details that are all worth saying out loud while writing it.

**`continue`, not `return`.** `continue` skips one candidate; `return` abandons the entire node and
silently truncates the enumeration. It is a one-word slip that halves or worse the output and looks
completely reasonable in a diff.

**The `used` array is not a visited set.** It is per-path state — set on the way in, cleared on the
way out — and its meaning is "this element is already somewhere in the current path", not "this
element has been seen by the search". A `used` array that is never cleared is the same bug as a
global visited set imported from a DFS habit, and produces a single permutation followed by n−1
empty branches.

**Why the count is n! and not n^n.** The loop runs n times at every level, which suggests n^n; the
`used` guard removes exactly one option per level of depth, giving n · (n−1) · (n−2) · … = n!. The
`used` array is precisely the thing that makes it a factorial rather than a power, and that is the
one-sentence answer when someone asks you to justify the bound.

## The swap-in-place variant

```ts
// Swap form — no `used`, no separate path; the prefix of `nums` IS the path.
export function permuteBySwap(nums: number[]): number[][] {
  const out: number[][] = [];
  const go = (i: number): void => {
    if (i === nums.length) { out.push([...nums]); return; }
    for (let j = i; j < nums.length; j++) {
      [nums[i], nums[j]] = [nums[j], nums[i]];   // choose: fix nums[j] at position i
      go(i + 1);                                  // explore
      [nums[i], nums[j]] = [nums[j], nums[i]];   // un-choose: swap back — the exact inverse
    }
  };
  go(0);
  return out;
}
```

```java
public List<List<Integer>> permuteBySwap(int[] nums) {
    List<List<Integer>> out = new ArrayList<>();
    go(nums, 0, out);
    return out;
}

private void go(int[] nums, int i, List<List<Integer>> out) {
    if (i == nums.length) {
        List<Integer> snap = new ArrayList<>(nums.length);
        for (int v : nums) snap.add(v);          // snapshot: `nums` keeps mutating
        out.add(snap);
        return;
    }
    for (int j = i; j < nums.length; j++) {
        swap(nums, i, j);
        go(nums, i + 1, out);
        swap(nums, i, j);                        // swap back
    }
}

private void swap(int[] a, int x, int y) { int t = a[x]; a[x] = a[y]; a[y] = t; }
```

Note `j` starts at `i`, not `i + 1`: the branch where the element already at position `i` stays
there is a real branch, and starting at `i + 1` drops every permutation that fixes a prefix.

The three costs, all of which are asked about:

1. **It mutates the caller's array.** The array is restored by the time the top-level call returns,
   but not during — so it is unsafe to share, unsafe under concurrency, and a caller holding a
   reference sees a scrambled array mid-search. Copy the input at the entry point if the API is
   public.
2. **The output order is not lexicographic**, even on sorted input, because a swap moves an
   arbitrary element into position `i` and disturbs the rest. The used-array form on sorted input
   enumerates in lexicographic order. Problems that ask for sorted output make this the deciding
   factor.
3. **Duplicate handling is genuinely harder.** The sort-and-skip rule in
   [06g](06g-duplicates-in-permutations.md) relies on equal values being adjacent
   in the candidate list; swapping destroys that adjacency as the search descends, so "the previous
   candidate" is no longer the sorted neighbour. The swap form needs a per-level `Set` of values
   already tried at this node instead, which reintroduces an allocation per node and gives back
   most of the space saving.

What it buys: Θ(n) less auxiliary memory on a search whose auxiliary memory was Θ(n) anyway — a
constant factor, on top of an output that is Θ(n · n!). Default to the used array; reach for the
swap form when the problem asks for in-place permutation, or when the elements are large objects
you would rather not push and pop.

## Related shapes worth recognising

**The k-th permutation without enumerating.** Asked as a follow-up precisely because backtracking
is the wrong tool for it: with `n` elements there are `(n−1)!` permutations beginning with each
choice, so `k / (n−1)!` selects the first element and `k mod (n−1)!` recurses — the factorial number
system. It is O(n²) with a list removal, or O(n log n) with an order-statistic structure, and it
touches no search tree at all.

```ts
// k is 0-based. `fact[i]` must be precomputed; see the note on overflow below.
export function kthPermutation(items: number[], k: number, fact: number[]): number[] {
  const pool = [...items];                       // consumed as elements are placed
  const out: number[] = [];
  for (let i = pool.length - 1; i >= 0; i--) {
    const block = fact[i];                       // permutations per choice of the next element
    const idx = Math.floor(k / block);
    k -= idx * block;
    out.push(pool.splice(idx, 1)[0]);            // O(n) removal — hence O(n²) overall
  }
  return out;
}
```

The factorials overflow fast — see **Integer limits and overflow** *(not written yet)* — so the
practical constraint is that `n` is small whenever this is asked, which is consistent with `n!`
being the index space. The counting side of the same object is
[08 · Combinatorics for counting problems](08-combinatorics-for-counting-problems.md).

**The next permutation in place.** The other non-search alternative: find the rightmost ascent,
swap it with the smallest larger element to its right, reverse the suffix. O(n) per step and Θ(1)
space, and iterating it from the sorted array enumerates all n! in lexicographic order without any
recursion. Worth naming when an interviewer asks whether backtracking is required — it is not, and
the iterative version is the one that streams.

## Gotchas

**★ Symptom: permutations come out with an element repeated inside a single answer.** Cause: the
`used[i] = false` inverse is missing or misplaced outside the loop, so a value stays marked
available — or was never marked at all. Fix: two mutations in, two inverses out, both inside the
loop body and in reverse order. This is the first skeleton where forgetting the *second* inverse is
easy, because the path's inverse is the one you remember.

**★ Symptom: the output has far fewer permutations than n!.** Cause: `if (used[i]) return;`
instead of `continue`. `return` abandons the whole node at the first used candidate rather than
skipping that one candidate. Fix: `continue`. The count is the diagnostic — n! is a number you can
check for small n by hand.

**★ Symptom: the swap-based version returns wrong results after duplicate handling is added.**
Cause: sort-and-skip assumes equal values are adjacent in the candidate list, and swapping reorders
the array as the search descends, so the sorted neighbour is no longer the previous candidate. Fix:
use the used-array form for duplicate inputs, or track a per-level `Set` of values already tried at
this node.

**★ Symptom: the swap form drops every permutation whose first element is the original first
element.** Cause: the inner loop written as `for (j = i + 1; …)`. Fix: `j` starts at `i` — leaving
the element where it is is a legitimate branch, and the self-swap is a no-op that costs nothing.

**Symptom: the swap form corrupts a caller's array under concurrency, or a caller reading it
mid-search sees garbage.** Cause: it permutes the input in place and only restores it when the
top-level call returns. Fix: copy the input at the public entry point, or use the used-array form.

**Symptom: an answer required in lexicographic order comes out shuffled.** Cause: the swap form
does not enumerate in sorted order even on sorted input. Fix: used-array form on a sorted input
enumerates lexicographically; otherwise sort the output afterwards and say which you chose and why.

**Symptom: the `used` array declared outside the top-level call and reused across two searches.**
Cause: state that looks per-search but is per-instance. Fix: allocate it in the public entry point;
the invariant "returns the state it was given" holds within one search and says nothing about the
next one starting clean.

**Symptom: a `boolean[]` swapped for a `Set<Integer>` of used values and duplicate inputs silently
collapse.** Cause: a set is keyed by value, so two equal elements are indistinguishable and the
second can never be used. Fix: mark by *index*, not by value — that distinction is the whole reason
the duplicate rule in [06g](06g-duplicates-in-permutations.md) is about sibling
positions rather than about values already present.

## Interview questions

**★ What is the difference between the subsets and permutations skeletons?**
One line of the candidate rule. Subsets pass a `start` index and consider only elements at or after
it, so an element can only follow the elements before it and each subset has exactly one route
through the tree — the enumeration is order-insensitive and there are 2^n. Permutations have no
`start`; every not-yet-used index is a candidate, tracked by a `used` array set on the way in and
cleared on the way out, so every ordering is a distinct route and there are n!. The
choose/explore/un-choose triple, the snapshot at the leaf and the complexity method are identical.

**★ Why is the bound n! and not n^n, given that the loop runs n times at every level?**
Because the `used` guard removes exactly one candidate per level of depth: n options at the root,
n−1 at depth one, n−2 below that, so the product is n! rather than n^n. The `used` array is
literally the thing that turns a power into a factorial. Total work is Θ(n · n!) once the Θ(n)
snapshot at each of the n! leaves is included, and auxiliary space is Θ(n) — the path, the used
array and n stack frames — excluding the output.

**★ Why prefer the used array over swapping the input array in place?**
The swap form saves the used array and the separate path, which is Θ(n) on a search whose auxiliary
space is already Θ(n) — a constant-factor win under an output of size Θ(n · n!). Against it: it
mutates the caller's array for the duration of the search; it enumerates in an order that is not
lexicographic even on sorted input; and it breaks the standard sort-and-skip rule for duplicate
inputs, because swapping destroys the adjacency of equal values the rule depends on. Unless the
problem wants in-place permutation, the used array is the better default and extends more cleanly.

**★ How would you produce the k-th permutation in lexicographic order without generating the
others?**
By the factorial number system rather than by search. With n elements there are (n−1)! permutations
starting with each possible first element, so `k / (n−1)!` gives the index of the first element in
the remaining sorted pool, `k mod (n−1)!` becomes the new k, and the process repeats on a pool one
smaller. It is O(n²) with list removal and O(n log n) with an order-statistic tree, and it visits
no search tree at all — which is the point of the question: recognising that a problem indexed into
an enumeration is arithmetic, not backtracking.

**Is there a way to enumerate permutations without recursion at all?**
Yes — repeatedly apply "next permutation": find the rightmost index `i` with `a[i] < a[i+1]`, swap
`a[i]` with the smallest element to its right that is larger than it, then reverse the suffix after
`i`. Each step is O(n) and Θ(1) extra space, and starting from the sorted array it visits all n!
permutations in lexicographic order and stops when no ascent exists. It is the right answer when
the permutations must be *streamed* rather than collected, since it holds one at a time, and it
handles duplicate inputs naturally because equal elements never produce an ascent between them.

**What breaks if you track used values in a `Set` instead of used indices in a boolean array?**
Duplicate inputs collapse. A set is keyed by value, so two equal elements are indistinguishable and
the second one can never be selected — the enumeration silently produces the permutations of the
*distinct* values instead of the permutations of the multiset, which is a different and smaller
answer. Marking by index keeps equal elements distinct, and the duplicate-handling rule is then
imposed deliberately, on sibling positions, rather than accidentally, by the data structure.

{/* FOOTER */}
