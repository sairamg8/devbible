---
title: "Divide and conquer is three lines you should be able to write before you know the problem — split into a subproblems of size n/b, recurse, combine in f(n) — and the only interesting question left is which of the three levels does the work, because that is what the recurrence answers and what decides the complexity class"
sidebar_label: "02 · Divide and conquer"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. The template, the recurrences and the induction argument are **textbook
> mathematics** (CLRS, *divide-and-conquer*), derived on the page rather than cited; every bound is
> solved by naming the recurrence and pointing at
> [phase 1 · 08](../phase-1-complexity/08-recurrences-and-the-master-theorem.md), which owns the
> master theorem and is not re-derived here. The Karatsuba and Strassen exponents are the standard
> results from the same chapter. No runtime or timing claim is made on this page. **No sandbox
> run.**

**Divide and conquer is the one algorithmic template that is genuinely a template: you can write
the skeleton before you have read the problem, and then the entire design consists of answering
three questions — how many subproblems, how big is each, and what does it cost to put the answers
back together.** Those three answers *are* the recurrence T(n) = a·T(n/b) + f(n), and the recurrence
is the complexity, so a candidate who states the three numbers has stated the bound whether or not
they remember the master theorem. The reason this matters more than "merge sort is n log n" is that
the interesting problems are the ones where the combine step is where the work went: counting
inversions is merge sort with one extra line in the merge, maximum subarray is a linear combine over
two halves, and a combine that costs more than linear flips the whole thing into a different class.
This page is the template, the recurrence read off it, and the three places the class changes;
[02b](02b-base-cases-induction-and-when-to-reach-for-it.md) is the base case, the strong induction
that proves the whole family correct, and the shapes that should make you reach for it. The
algorithms themselves are the rest of the topic — [02c](02c-merge-sort.md) is merge sort with
[02d](02d-stability-and-the-comparator-contract.md) on stability and the comparator contract,
[02e](02e-counting-inversions.md) is counting inversions, [02f](02f-quickselect.md) is quickselect,
[02g](02g-median-of-medians-and-duplicate-heavy-input.md) is quickselect's worst case,
[02h](02h-solve-halves-combine-when-it-is-not-sorting.md) is the problems that are not sorting at
all, and [02i](02i-binary-search-as-degenerate-divide-and-conquer.md) is binary search read as the
degenerate member of the family.

## The template

```ts
function solve(input: Range): Answer {
  // 1 · BASE: small enough to answer directly
  if (isSmall(input)) return direct(input);

  // 2 · DIVIDE: split into a subproblems of size about n / b
  const parts = split(input);

  // 3 · CONQUER: recurse on each
  const answers = parts.map(solve);

  // 4 · COMBINE: build this answer from the sub-answers, in f(n)
  return combine(answers);
}
```

Four lines, and each one has a name that maps onto a term in the recurrence:

| Step | Contributes | Ask yourself |
|---|---|---|
| base | the recursion's terminal, and its *size* — often not 1 | what is the smallest input I can answer without recursing? |
| divide | the `b` — how much smaller each piece is | halves? thirds? one piece of size n − 1 (which is not really divide and conquer)? |
| conquer | the `a` — how many recursive calls actually happen | 2 for merge sort, 1 for binary search and quickselect, 3 for Karatsuba |
| combine | the `f(n)` | constant? linear? n log n? and does the *divide* also cost something? |

The recurrence is then **T(n) = a·T(n/b) + f(n)**, where f(n) is the cost of the divide *plus* the
cost of the combine — they are on the same side of the equation and it does not matter which of the
two is doing the work. Merge sort puts it all in the combine (splitting an array by index is free,
merging is linear); quicksort puts it all in the divide (partitioning is linear, gluing the sorted
halves is free). Both are T(n) = 2T(n/2) + Θ(n), and that is why they have the same bound despite
looking like mirror images.

## Reading the class off the three numbers

The comparison the master theorem makes is between the work at the leaves, n^(log_b a), and the
work at the root, f(n) — [phase 1 · 08](../phase-1-complexity/08-recurrences-and-the-master-theorem.md)
states it properly and it is not re-derived here. What is worth internalising is the *picture*,
because it tells you which of the three cases you are in without a formula:

- **The leaves dominate.** Each level is more expensive than the one above it, so the bottom level —
  which has a^(log_b n) = n^(log_b a) leaves — is essentially the whole cost. Karatsuba is here.
- **Every level is equal.** The a subproblems are each 1/b as big and the combine is linear, so each
  level costs the same Θ(n) and there are log_b n levels. Merge sort is here, and this is the case
  that produces the n log n that shows up everywhere.
- **The root dominates.** The combine is so expensive that the top call outweighs everything beneath
  it, and the total is Θ(f(n)) — the recursion is a rounding error on its own combine step.

| Algorithm | a | b | f(n) | Recurrence | Result | Which level wins |
|---|---:|---:|---|---|---|---|
| binary search | 1 | 2 | Θ(1) | T(n) = T(n/2) + Θ(1) | Θ(log n) | every level equal (all Θ(1)) |
| merge sort | 2 | 2 | Θ(n) | T(n) = 2T(n/2) + Θ(n) | Θ(n log n) | every level equal |
| counting inversions | 2 | 2 | Θ(n) | T(n) = 2T(n/2) + Θ(n) | Θ(n log n) | every level equal |
| maximum subarray (D&C) | 2 | 2 | Θ(n) | T(n) = 2T(n/2) + Θ(n) | Θ(n log n) | every level equal |
| closest pair of points | 2 | 2 | Θ(n) after presorting | T(n) = 2T(n/2) + Θ(n) | Θ(n log n) | every level equal |
| quickselect, expected | 1 | 2 (expected) | Θ(n) | T(n) = T(n/2) + Θ(n) | Θ(n) expected | the root dominates |
| tree traversal | 2 | 2 | Θ(1) | T(n) = 2T(n/2) + Θ(1) | Θ(n) | the leaves dominate |
| Karatsuba multiplication | 3 | 2 | Θ(n) | T(n) = 3T(n/2) + Θ(n) | Θ(n^1.585) | the leaves dominate |
| Strassen matrix multiply | 7 | 2 | Θ(n²) | T(n) = 7T(n/2) + Θ(n²) | Θ(n^2.807) | the leaves dominate |
| a linear combine on n/2 and n/2… with an n² combine | 2 | 2 | Θ(n²) | T(n) = 2T(n/2) + Θ(n²) | Θ(n²) | the root dominates |

Two rows in that table are the whole lesson. **Quickselect versus merge sort** differ only in `a` —
one recursive call instead of two — and that single change takes n log n down to linear, because
n + n/2 + n/4 + … is a geometric series summing to 2n rather than n repeated log n times. **The last
row** is the flip: keep the same split and make the combine quadratic, and the recursion contributes
nothing at all; the answer is the cost of the top-level combine, and you have written a Θ(n²)
algorithm with a divide-and-conquer shape.

That is the sentence worth carrying: **divide and conquer only pays when the combine is cheaper than
the problem.** If merging two sorted halves cost Θ(n²), merge sort would be Θ(n²) and there would be
no reason to split.

## Gotchas

**★ Symptom: a divide-and-conquer solution presented as an improvement, and it is the same class as
the brute force.** Cause: the combine costs as much as solving the problem outright. Fix: check the
recurrence before writing the code — T(n) = 2T(n/2) + Θ(n²) is Θ(n²), because the root dominates and
the recursion contributes nothing. Divide and conquer pays only when the combine is cheaper than the
problem.

**★ Symptom: the recurrence written as T(n) = 2T(n/2) + Θ(1) for merge sort.** Cause: the merge not
counted as the combine. Fix: f(n) is the divide *plus* the combine; merge sort's split is free and
its merge is linear, so f(n) = Θ(n). Getting this wrong turns n log n into n, and it is the single
most common recurrence error.

**★ Symptom: `mid` computed as `Math.floor((lo + hi) / 2)` in Java and the search misbehaves on huge
arrays.** Cause: `lo + hi` overflows `int` before the division. Fix: `lo + (hi - lo) / 2`. It is an
overflow bug rather than a divide-and-conquer bug and is developed on **05 · Integer limits and
overflow** *(not written yet)*; use the safe form here as a habit.

**★ Symptom: a recursion that splits into n − 1 and 1 and is described as divide and conquer.**
Cause: the split is not proportional. Fix: the recurrence is T(n) = T(n − 1) + f(n), which the
master theorem does not cover; unroll it — with f linear that is Θ(n²). Genuine divide and conquer
divides by a constant factor, not by a constant amount.

**★ Symptom: a divide-and-conquer solution whose two recursive calls are given the same range.**
Cause: an off-by-one in the split — `solve(lo, mid)` and `solve(mid, hi)` rather than `mid + 1`. Fix:
the two ranges must partition the original with no overlap and no gap; overlapping ranges both
double-count the answer and destroy termination, and a gap loses the element at the seam silently.

**Symptom: a recurrence written with the wrong `b` because the split is uneven.** Cause: a split into
one third and two thirds described as "halves". Fix: an uneven but constant-proportion split still
gives a logarithmic depth and, with a linear combine, still Θ(n log n) — the base of the logarithm
changes and the class does not. What breaks the class is a split into a constant *amount*, not a
constant *fraction*.

## Interview questions

**★ Write down the divide-and-conquer template without knowing the problem.**
Base case for an input small enough to answer directly; divide the input into a pieces of size about
n/b; recurse on each; combine the answers in f(n) time. Then the recurrence falls out immediately:
T(n) = a·T(n/b) + f(n), where f(n) covers both the divide and the combine because they are the work
done outside the recursive calls. Everything else is answering three questions for the specific
problem — how many recursive calls, how much smaller is each input, what does the boundary cost —
and those three numbers are the complexity.

**★ Merge sort and quicksort are both T(n) = 2T(n/2) + Θ(n). Why do they feel so different?**
Because they put the linear work on opposite sides of the recursion. Merge sort divides for free —
split by index — and does all its work in the combine, merging two sorted halves. Quicksort does all
its work in the divide — partitioning around a pivot — and its combine is nothing at all, because
after the recursive calls the array is already sorted in place. The recurrence is identical, so the
average bound is identical. The differences that actually matter are elsewhere: merge sort's bound is
worst-case and quicksort's is only average (a bad pivot gives T(n) = T(n − 1) + Θ(n) = Θ(n²)); merge
sort needs Θ(n) auxiliary memory and quicksort sorts in place; and merge sort can be made stable
while quicksort's swaps across the partition are not.

**★ When does divide and conquer fail to help?**
When the combine is not cheaper than the problem. If f(n) grows faster than the leaf work, the root
dominates and the total is Θ(f(n)) — a T(n) = 2T(n/2) + Θ(n²) algorithm is Θ(n²), which is what you
would have paid without recursing. It also fails when the split is by a constant amount rather than
a constant factor: T(n) = T(n − 1) + Θ(n) is Θ(n²), and that recurrence is what quicksort degrades
to on a sorted input with a first-element pivot. And it fails when the subproblems overlap — if the
same subproblem is solved many times, the shape you want is dynamic programming with a memo, not
divide and conquer; naive Fibonacci is a divide-and-conquer skeleton over overlapping subproblems
and is exponential for exactly that reason.

**★ What does changing `a` do, and can you give an example?**
`a` is the number of leaves per level, so it is the exponent: the leaf work is n^(log_b a). Dropping
`a` from 2 to 1 while keeping b = 2 and a linear combine takes T(n) = 2T(n/2) + Θ(n) = Θ(n log n)
down to T(n) = T(n/2) + Θ(n) = Θ(n), because the level costs form a geometric series n + n/2 + n/4
+ … ≤ 2n instead of log n levels of n. That is exactly the difference between merge sort and
quickselect: quickselect knows which half the answer is in, so it recurses once. Going the other way,
Karatsuba raises `a`… no, it *lowers* it — the schoolbook recursive multiplication is
T(n) = 4T(n/2) + Θ(n) = Θ(n²), and Karatsuba's algebraic trick computes the four products with three
multiplications, giving T(n) = 3T(n/2) + Θ(n) = Θ(n^1.585). Same split, same combine, one fewer
recursive call, and a different complexity class.

**★ How do you turn a divide-and-conquer sketch into a stated complexity in one sentence?**
Name a, b and f and read the answer off. "It makes two recursive calls on halves and does linear work
merging, so T(n) = 2T(n/2) + Θ(n), every level costs Θ(n) and there are log n levels — Θ(n log n),
worst case, with Θ(n) auxiliary space for the buffer and Θ(log n) for the stack." The value of saying
it in that order is that the interviewer can check each number independently, and if one of them is
wrong they can correct that number instead of concluding you guessed the bound.

**What is the space complexity of a divide-and-conquer algorithm?**
Two contributions, and both should be named. The recursion stack is Θ(depth), which for a
constant-factor split is Θ(log n) — small, and never the overflow risk that a linear-depth recursion
is. Then whatever the algorithm allocates: merge sort's Θ(n) buffer, which dominates the stack and
is the real answer; quicksort's nothing, which is why its space is just the stack; the closest-pair
algorithm's presorted arrays. Answering "Θ(log n)" for merge sort is the standard mistake, and it
comes from counting only the recursion.

{/* FOOTER */}
