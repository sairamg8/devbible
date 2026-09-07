---
title: "The third move — a recursive function's cost is the call tree summed: calls per level times work per call, over the depth — and the same tree read for space is the recursion stack; a traversal is linear whatever the shape, and a slice passed down a recursion can turn linear into quadratic"
sidebar_label: "02b · Recursion as a tree"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Method, with textbook backing (CLRS, *recurrences* — the recursion-tree
> method); the `ArrayDeque` amortised-constant sentence cited in one answer is the JDK 25 javadoc
> quoted in phase 0. Second half of topic 02 — [02](02-reading-complexity-off-code.md) is the two
> loop moves. Solutions are TypeScript first, Java second. **No sandbox run; no timings.**

**A recursive function's cost is not read off a loop; it is read off the tree of calls it makes,
and the tree is summed the same way every time: the number of calls at each level, times the
non-recursive work each call does, added over the depth.** Three shapes cover nearly every
interview recursion — one call that shrinks by one, one call that halves, two calls that halve
with linear work between them — and the fourth, two calls that shrink by one, is the exponential
that memoisation collapses. The same tree read vertically is the space: the depth is the stack.
Two things trip candidates here. A traversal of a tree or graph is not a recursion over n in the
table's sense — it visits each node once and is linear whatever the shape, and log n is its
depth, not its time. And a `slice` passed to a recursive call is a copy that the one-word syntax
hides; in merge sort it costs the same order as the merge and the bound survives, in a
"pass the rest" recursion it turns Θ(n) into Θ(n²). This page is the table of shapes, the tree
read aloud, and the traps.

## Move 3 — recursion as a tree

A recursive function's cost is the sum over the call tree: **(number of calls at each level) ×
(work per call at that level), summed over the depth.** Three shapes cover the round:

| Shape | Calls per level | Work per call | Depth | Total |
|---|---|---|---|---|
| **one call, n − 1** (`f(n) → f(n−1)`) | 1 | Θ(1) | n | Θ(n) — and Θ(n) stack |
| **one call, n/2** (binary search) | 1 | Θ(1) | log n | Θ(log n) |
| **two calls, n/2 each, linear merge** (merge sort) | 2^k at level k | Θ(n / 2^k) each → Θ(n) per level | log n | Θ(n log n) |
| **two calls, n − 1 each** (naive Fibonacci) | 2^k | Θ(1) | n | Θ(2ⁿ) |
| **b calls, n/b each, constant work** (tree traversal, balanced) | b^k | Θ(1) | log_b n | Θ(n) — every node once |
| **one call per element, work per subtree** (subsets) | doubles per level | Θ(1) | n | Θ(2ⁿ) — output-sensitive |

```ts
// Θ(n log n): two halves (log n levels), Θ(n) merge work per level
export function mergeSort(a: number[]): number[] {
  if (a.length <= 1) return a;
  const mid = a.length >> 1;
  const left = mergeSort(a.slice(0, mid));    // slice is Θ(n) too — same order as the merge
  const right = mergeSort(a.slice(mid));
  const out: number[] = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) out.push(left[i] <= right[j] ? left[i++] : right[j++]);
  while (i < left.length) out.push(left[i++]);
  while (j < right.length) out.push(right[j++]);
  return out;
}

// Θ(2ⁿ): each call makes two calls on n − 1 and n − 2 — the tree has ~2ⁿ leaves
export function fibSlow(n: number): number {
  return n < 2 ? n : fibSlow(n - 1) + fibSlow(n - 2);
}

// Θ(n): the same recursion with a memo — each n computed once, Θ(1) after
export function fib(n: number, memo = new Map<number, number>()): number {
  if (n < 2) return n;
  const hit = memo.get(n);
  if (hit !== undefined) return hit;
  const v = fib(n - 1, memo) + fib(n - 2, memo);
  memo.set(n, v);
  return v;
}
```

Read the tree aloud: "two calls per level on half the input, log n levels, linear work per
level — n log n." When the shape is not one of the table's rows, write the recurrence and use
**08 · Recurrences and the master theorem** *(not written yet)*. For a tree or graph traversal
the tree *is* the input: the cost is the number of nodes plus edges visited, each once — Θ(n) for
a tree, Θ(V + E) for a graph — and the recursion's depth is the space.

## Gotchas

**★ Symptom: the recursion's bound guessed from its name.** Cause: no tree drawn. Fix: calls per
level × work per call × depth, summed; merge sort is 2^k calls of n/2^k work over log n levels.

**Symptom: `slice` in the recursion counted as free.** Cause: the copy hidden in a one-word
call. Fix: count it — in merge sort it is the same order as the merge, so the bound holds; in a
"pass the rest of the array" recursion it turns Θ(n) into Θ(n²). Pass indices instead.

**★ Symptom: the tree traversal's bound given as O(n log n).** Cause: the recursion-tree table
applied blindly to a balanced tree. Fix: a traversal visits each node once — Θ(n) — regardless
of shape; log n is the *depth* (the space), not the time.

## Interview questions

**★ How do you get the complexity of a recursive function?**
Draw the call tree and sum it: how many calls at each level, how much non-recursive work each
does, how deep it goes. Merge sort: two calls on halves, so 2^k calls at level k each doing n/2^k
work — linear per level — over log n levels, n log n. Naive Fibonacci: two calls that shrink by
one, so the tree doubles per level to depth n, 2ⁿ. A tree traversal visits every node once,
Θ(n), whatever the shape; the depth is the space. When the shape is not one of these, write the
recurrence and apply the master theorem.

**What does `slice` cost in a recursive solution, and when does it change the bound?**
A copy of the slice, Θ(k) for k elements. In merge sort it is the same order as the merge at
each level, so the bound stays Θ(n log n) with a bigger constant. In a recursion that passes
"the rest of the array" to a single recursive call, the copies sum to n + (n − 1) + … — Θ(n²)
for what was a Θ(n) algorithm. Pass indices — `lo`, `hi` — into the same array instead.

---

← Prev: [02 · Reading complexity off code](02-reading-complexity-off-code.md) · Index: [Phase 1 — Complexity analysis](README.md) · Next → **Amortised analysis** *(not written yet)*
