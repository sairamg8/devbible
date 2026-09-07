---
title: "A divide-and-conquer bound is a recurrence, T(n) = a·T(n/b) + f(n), and the master theorem reads it in one comparison — the work per level against the number of leaves — giving binary search, merge sort, Karatsuba and the balanced-tree recursion without drawing a tree; and the recurrences it does not cover are the ones to solve by hand"
sidebar_label: "08 · Recurrences and the master theorem"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07. Textbook — the master theorem, the recursion-tree and substitution
> methods are CLRS, *divide-and-conquer* / *recurrences*, stated in the simplified form used in
> interviews and not quoted; the Karatsuba and Strassen exponents are the standard results from
> the same chapter. No runtime claim is made on this page. **No sandbox run.**

**When an algorithm splits its input into a pieces of size n/b, recurses on each, and does f(n)
work to split and combine, its running time is the recurrence T(n) = a·T(n/b) + f(n), and the
master theorem solves it by comparing two quantities: the work done at the leaves, n^(log_b a),
against the work done at the top, f(n).** Whichever dominates is the answer; if they tie, a
log factor appears. That single comparison gives binary search (a = 1, b = 2, f = 1 → log n),
merge sort (2, 2, n → n log n), the naive recursive maximum (2, 2, 1 → n), Karatsuba
multiplication (3, 2, n → n^1.585) and Strassen (7, 2, n² → n^2.807) — and it fails to apply to
the recurrences interviews also produce, T(n) = T(n − 1) + n and T(n) = 2T(n − 1) + 1, which are
solved by unrolling instead. This page is the theorem in the form to remember, the table of the
recurrences that come up with their shapes recognised in code, the two other methods for when
the theorem does not fit, and how to say a recurrence on a whiteboard so that the bound is
believed.

## The theorem, in the form to remember

For T(n) = a·T(n/b) + f(n) with a ≥ 1, b > 1, compare f(n) to n^c where **c = log_b a**:

| Case | When | T(n) | Read as |
|---|---|---|---|
| **1 — leaves dominate** | f(n) grows polynomially *slower* than n^c | Θ(n^c) | the bottom level's a^depth leaves do the work |
| **2 — every level equal** | f(n) = Θ(n^c) | Θ(n^c · log n) | log_b n levels of equal work |
| **3 — root dominates** | f(n) grows polynomially *faster* than n^c (and the regularity condition holds) | Θ(f(n)) | the top call's own work is most of it |

"Polynomially" means by a factor of n^ε for some ε > 0 — n versus n² qualifies; n versus n log n
does **not**, which is the gap the theorem does not cover (the extended form with log factors
handles f(n) = n^c · log^k n → n^c · log^(k+1) n, and that is the case for merge sort variants
with a log in the merge). The regularity condition in case 3 — a·f(n/b) ≤ k·f(n) for some
k < 1 — holds for every polynomial f interviews use; mention it, do not derive it.

The reason it works is the recursion tree of [02b](02b-recursion-as-a-tree.md): at depth d
there are a^d calls each on n/b^d elements, doing f(n/b^d) work; the depth is log_b n; the
number of leaves is a^(log_b n) = n^(log_b a). The theorem is the tree summed in advance.

## The recurrences that come up, recognised in code

| Recurrence | a, b, f | c = log_b a | Case | Bound | The code that has it |
|---|---|---|---|---|---|
| T(n) = T(n/2) + 1 | 1, 2, 1 | 0 | 2 | Θ(log n) | binary search; finding a peak; exponentiation by squaring |
| T(n) = T(n/2) + n | 1, 2, n | 0 | 3 | Θ(n) | quickselect with a good pivot; "recurse on one half, scan first" |
| T(n) = 2T(n/2) + 1 | 2, 2, 1 | 1 | 1 | Θ(n) | recursive max, sum, tree size — every node once |
| T(n) = 2T(n/2) + n | 2, 2, n | 1 | 2 | Θ(n log n) | merge sort; closest pair; counting inversions |
| T(n) = 2T(n/2) + n log n | 2, 2, n log n | 1 | extended 2 | Θ(n log² n) | merge sort with a sort inside the merge |
| T(n) = 2T(n/2) + n² | 2, 2, n² | 1 | 3 | Θ(n²) | a split with a quadratic combine — the combine is the cost |
| T(n) = 3T(n/2) + n | 3, 2, n | 1.585 | 1 | Θ(n^1.585) | Karatsuba multiplication |
| T(n) = 4T(n/2) + n | 4, 2, n | 2 | 1 | Θ(n²) | naive recursive multiplication; the four-quadrant matrix split |
| T(n) = 7T(n/2) + n² | 7, 2, n² | 2.807 | 1 | Θ(n^2.807) | Strassen's matrix multiplication |
| T(n) = 8T(n/2) + n² | 8, 2, n² | 3 | 1 | Θ(n³) | the naive eight-multiply block matrix product |
| T(n) = T(n/3) + T(2n/3) + n | uneven split | — | tree method | Θ(n log n) | quicksort with a bad-but-constant pivot ratio — still n log n |

The row to be able to explain from scratch is merge sort: two halves, log n levels, n work per
level, n log n; case 2 because f(n) = n equals n^(log₂ 2) = n. The row that surprises is the
uneven split: any *constant* split ratio keeps the depth logarithmic and the bound n log n; it is
the split that shrinks by one — the next section — that breaks it.

```ts
// T(n) = 2T(n/2) + n → Θ(n log n): two halves, linear merge
export function countInversions(a: number[]): number {
  if (a.length < 2) return 0;
  const mid = a.length >> 1;
  const left = a.slice(0, mid), right = a.slice(mid);   // the slices are Θ(n) — same order as the merge
  let inv = countInversions(left) + countInversions(right);
  const merged: number[] = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) merged.push(left[i++]);
    else { merged.push(right[j++]); inv += left.length - i; }  // every remaining left element is > right[j]
  }
  while (i < left.length) merged.push(left[i++]);
  while (j < right.length) merged.push(right[j++]);
  for (let k = 0; k < a.length; k++) a[k] = merged[k];
  return inv;
}

// T(n) = T(n/2) + n → Θ(n): recurse on ONE side after a linear partition — quickselect
export function kthSmallest(a: number[], k: number): number {
  let lo = 0, hi = a.length - 1;
  while (lo < hi) {
    const pivot = a[(lo + hi) >> 1];
    let i = lo, j = hi;
    while (i <= j) {
      while (a[i] < pivot) i++;
      while (a[j] > pivot) j--;
      if (i <= j) { [a[i], a[j]] = [a[j], a[i]]; i++; j--; }
    }
    if (k <= j) hi = j; else if (k >= i) lo = i; else return a[k];
  }
  return a[lo];
}
// expected Θ(n) with a random or median pivot; Θ(n²) with a consistently bad one — see 09
```

## When the theorem does not apply

The theorem needs the subproblems to be a constant *fraction* of n. Three recurrences interviews
produce do not have that shape and are solved by **unrolling** — write out the first few terms
and see the series:

| Recurrence | Unrolled | Bound | The code |
|---|---|---|---|
| T(n) = T(n − 1) + 1 | 1 + 1 + … (n terms) | Θ(n) | a linear recursion; a linked-list walk |
| T(n) = T(n − 1) + n | n + (n − 1) + … + 1 | Θ(n²) | quicksort with the worst pivot; "recurse on the rest after a scan" — the `slice` trap of [02b](02b-recursion-as-a-tree.md) |
| T(n) = 2T(n − 1) + 1 | 1 + 2 + 4 + … (n levels) | Θ(2ⁿ) | naive Fibonacci (strictly T(n−1) + T(n−2), same class); Towers of Hanoi; all subsets by include/exclude |
| T(n) = T(n − 1) + T(n − 2) + 1 | the Fibonacci numbers themselves | Θ(φⁿ) ≈ Θ(1.618ⁿ) | naive Fibonacci, exactly |
| T(n) = T(√n) + 1 | n → √n → n^(1/4) … until 2 | Θ(log log n) | the "halve the exponent" recursions; van Emde Boas-style structures |
| T(n) = T(n/2) + T(n/4) + n | uneven, two-sided | Θ(n) by the tree — the per-level work is a geometric series (3/4 each level) | — |

The fourth row is worth one sentence when Fibonacci comes up: the exact base is the golden
ratio, "about 1.6 to the n", and "2ⁿ" is the safe upper bound that everyone accepts.

**Substitution** is the third method — guess the bound, prove it by induction — and it is what a
rigorous answer uses when the tree is irregular; on a whiteboard it is "I'd guess n log n and
check that a·(n/b) log(n/b) + n ≤ c·n log n holds", and the interviewer will accept the guess
if the tree argument supports it.

## Reading the recurrence off the code

The recurrence is written from three things in the function: how many recursive calls it makes
(a), on what fraction of the input (1/b, or n − 1), and what it does besides recursing (f(n)).
The traps are all in f(n):

- a `slice` or spread on the input before recursing adds Θ(n) to f(n) — merge sort survives it
  (case 2 either way), a would-be Θ(n) recursion does not;
- a linear scan to *find* the split point — the peak, the pivot, the median — is part of f(n);
- work done *after* the calls return — the merge, the combine — is f(n) too;
- a memo turns a recurrence into a count of distinct states: naive Fibonacci's 2ⁿ becomes n
  states × Θ(1) each, and the recurrence no longer describes the cost.

```java
// Java: exponentiation by squaring — T(n) = T(n/2) + 1 → Θ(log n) in the exponent
static long power(long base, long exp, long mod) {
    if (exp == 0) return 1 % mod;
    long half = power(base, exp / 2, mod);
    long sq = half * half % mod;
    return (exp % 2 == 0) ? sq : sq * base % mod;
}
```

## Saying it on the board

Name the three numbers, then the case, then the bound: *"Two calls on halves, linear merge —
T(n) = 2T(n/2) + n; the leaves are n^(log₂ 2) = n, equal to the merge, so case two: n log n."*
Or for the non-fitting ones: *"One call on n − 1 after a linear scan — T(n) = T(n − 1) + n, which
unrolls to n + (n − 1) + … — quadratic."* Ten seconds, and the interviewer hears the tree
without your drawing it. If pressed for the tree, draw three levels and the leaves.

## Gotchas

**★ Symptom: the master theorem applied to T(n) = T(n − 1) + n.** Cause: the theorem needs
subproblems that are a constant fraction of n. Fix: unroll — n + (n − 1) + … = Θ(n²); the
theorem's shape is a·T(n/b).

**★ Symptom: merge sort's case misidentified because the `slice` was counted.** Cause: f(n)
doubled from n to 2n. Fix: the constant does not change the case — f(n) = Θ(n) still equals
n^(log₂ 2), case 2, n log n.

**Symptom: T(n) = 2T(n/2) + n log n called n log n.** Cause: the plain theorem's gap — n log n
is not polynomially larger than n. Fix: the extended case 2 — n log² n.

**Symptom: quicksort with a 1:9 split called quadratic.** Cause: uneven confused with
shrinking-by-one. Fix: any constant ratio gives logarithmic depth — n log n with a larger
constant; only a split that removes a constant *number* of elements is quadratic.

**Symptom: naive Fibonacci called Θ(2ⁿ) and the interviewer asks "exactly?"** Cause: the
upper bound given as tight. Fix: Θ(φⁿ), the golden ratio, about 1.618ⁿ; 2ⁿ is a valid O.

**Symptom: quickselect called n log n.** Cause: pattern-matched to quicksort. Fix: one call on
one side — T(n) = T(n/2) + n, case 3, Θ(n) expected; the recursion does not branch.

**Symptom: the recurrence written without the split-finding scan.** Cause: f(n) taken as the
combine only. Fix: everything the call does besides recursing — finding the pivot, copying,
merging — is f(n).

**Symptom: a memoised recursion analysed by its recurrence.** Cause: the recurrence describes
the unmemoised tree. Fix: count distinct states × work per state; Fibonacci with a memo is n
states × Θ(1).

**Symptom: Karatsuba's exponent guessed as 1.5.** Cause: log₂ 3 not computed. Fix: n^(log₂ 3) ≈
n^1.585; three multiplications of half-size numbers, case 1.

## Interview questions

**★ State the master theorem and use it on merge sort and binary search.**
For T(n) = a·T(n/b) + f(n), compare f(n) with n^c where c = log_b a: if f is polynomially
smaller, T is Θ(n^c); if equal, Θ(n^c log n); if polynomially larger (with the regularity
condition), Θ(f(n)). Merge sort: a = 2, b = 2, f = n; c = 1; f equals n^c; case 2, n log n.
Binary search: a = 1, b = 2, f = 1; c = 0; f equals n⁰; case 2, log n. Both are the recursion
tree summed in advance — a^d calls at depth d, each on n/b^d elements.

**★ Which recurrences can the master theorem not solve, and how do you solve them?**
Those whose subproblems are not a constant fraction of n: T(n) = T(n − 1) + n, which unrolls to
the sum 1 to n, Θ(n²); T(n) = 2T(n − 1) + 1, which unrolls to a geometric series, Θ(2ⁿ);
Fibonacci's T(n − 1) + T(n − 2), Θ(φⁿ); T(n) = T(√n) + 1, Θ(log log n). Also the gap case where
f(n) is larger than n^c but not polynomially — n log n against n — which the extended theorem
handles as n log² n. The methods are unrolling for the first group and the recursion tree or
substitution for irregular ones.

**Why is quickselect linear when quicksort is n log n?**
Because quickselect recurses on one side of the partition and quicksort on both. Quicksort is
T(n) = 2T(n/2) + n — case 2, n log n. Quickselect is T(n) = T(n/2) + n — case 3, the partition
at the top dominates, and the series n + n/2 + n/4 + … sums to 2n, Θ(n). Both are expected
bounds with a good pivot; both degrade to n² with a pivot that removes one element per level.

**Why does an uneven split not break n log n?**
Because the depth of the recursion is logarithmic for any constant ratio: a 1:9 split has depth
log_(10/9) n, still Θ(log n), with linear work per level, so n log n with a larger constant. The
bound breaks only when the split removes a constant number of elements rather than a constant
fraction — the T(n − 1) shape — which is what a sorted input does to a first-element pivot.

**What is Karatsuba's recurrence and why is it faster than the naive one?**
Naive recursive multiplication of two n-digit numbers splits each into halves and does four
half-size multiplications with linear additions: T(n) = 4T(n/2) + n, c = 2, case 1, Θ(n²).
Karatsuba computes the same result with three half-size multiplications and a few more
additions: T(n) = 3T(n/2) + n, c = log₂ 3 ≈ 1.585, case 1, Θ(n^1.585). Fewer subproblems, not
less combine work, is what changed the exponent — the same idea as Strassen's seven products
instead of eight.

**How do you read a recurrence off a recursive function?**
Three numbers: how many recursive calls it makes, on what size — a fraction n/b, or n − 1 —
and everything it does besides recursing, which is f(n): the scan to find the split, any
`slice` or copy of the input, and the combine after the calls return. Then either the master
theorem, if the size is a constant fraction, or unrolling if it is not. If the function is
memoised, the recurrence no longer describes the cost; count distinct states times work per
state instead.

---

← Prev: [07 · Complexity of the built-ins](07-complexity-of-the-built-ins.md) · Index: [Phase 1 — Complexity analysis](README.md) · Next → [09 · Best, average and worst](09-best-average-and-worst.md)
