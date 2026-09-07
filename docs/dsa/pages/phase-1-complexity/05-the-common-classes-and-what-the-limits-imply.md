---
title: "Seven classes cover the round — constant, logarithmic, linear, linearithmic, quadratic, exponential, factorial — and the input limit in the statement names the one the setter intended: a million means linear or n log n, five thousand means quadratic is fine, twenty means enumerate every subset"
sidebar_label: "05 · The common classes and the limits"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Method; the growth figures are arithmetic and the class-to-limit table is
> the folklore rule of roughly 10⁸ simple operations a second, **stated as a tendency**, as on
> [phase 0's constraints page](../phase-0-the-interview-and-practice/05-reading-the-constraints.md),
> which carries the full size-to-class table this page assumes. The one runtime fact — Java's
> `Arrays.sort` on primitives is dual-pivot quicksort with *"O(n log(n)) performance on all data
> sets"* — is the JDK 25 javadoc quoted in phase 0. **No sandbox run; no timings.**

**A class is a shape of growth, and the round uses seven of them. Knowing the shapes is not the
skill; the skill is recognising which shape a piece of code has, which shape a limit permits,
and which shape a problem's structure forces — and moving between the three.** Constant work
does not look at n; logarithmic halves it; linear touches everything once; linearithmic sorts or
divides and conquers; quadratic looks at every pair; exponential looks at every subset;
factorial at every ordering. The limit in the statement is the setter telling you which of these
they had in mind: n up to a million and a quadratic will time out; n up to twenty and an
exponential is the intended solution and a clever polynomial one probably does not exist. And
between the seven there are a handful of in-between classes — n√n, n · 2ⁿ, log² n, α(n) — that
show up often enough to name. This page is the classes with a piece of code that has each
shape, how they compare at the sizes limits use, what a limit implies about the intended
class, the in-between classes, and the arithmetic of "will it run in time".

## The seven classes, with code that has each shape

| Class | Written | Looks like | Code |
|---|---|---|---|
| **constant** | Θ(1) | no dependence on n | array index, hash lookup, arithmetic |
| **logarithmic** | Θ(log n) | halve until one | binary search, heap push/pop, balanced-tree op |
| **linear** | Θ(n) | touch each once | a scan, two pointers, a hash pass, BFS on a tree |
| **linearithmic** | Θ(n log n) | sort, or n things each costing log n | any comparison sort, a heap drained n times, divide and conquer with linear merge |
| **quadratic** | Θ(n²) | every pair | nested loops, naive substring search, bubble/insertion sort |
| **exponential** | Θ(2ⁿ) | every subset | subset enumeration, naive recursion on n−1 and n−2, bitmask DP over n items |
| **factorial** | Θ(n!) | every ordering | permutations, brute-force TSP |

```ts
// constant — n is irrelevant
export const first = (a: number[]): number | undefined => a[0];

// logarithmic — the search space halves each step
export function binarySearch(a: number[], target: number): number {
  let lo = 0, hi = a.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid] === target) return mid;
    if (a[mid] < target) lo = mid + 1; else hi = mid - 1;
  }
  return -1;
}

// linear — one pass
export const sum = (a: number[]): number => a.reduce((s, x) => s + x, 0);

// linearithmic — a sort, then a linear pass (the sort dominates)
export function hasDuplicateSorted(a: number[]): boolean {
  const s = a.toSorted((x, y) => x - y);
  for (let i = 1; i < s.length; i++) if (s[i] === s[i - 1]) return true;
  return false;
}

// quadratic — every pair
export function countPairsWithSum(a: number[], t: number): number {
  let c = 0;
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] + a[j] === t) c++;
  return c;
}

// exponential — every subset, as a bitmask; Θ(2ⁿ · n) with the inner loop
export function subsetSums(a: number[]): number[] {
  const out: number[] = [];
  for (let mask = 0; mask < (1 << a.length); mask++) {
    let s = 0;
    for (let i = 0; i < a.length; i++) if (mask & (1 << i)) s += a[i];
    out.push(s);
  }
  return out;
}

// factorial — every ordering, by swapping into position; Θ(n! · n) with the copy
export function permutations(a: number[]): number[][] {
  const out: number[][] = [];
  const go = (k: number): void => {
    if (k === a.length) { out.push([...a]); return; }
    for (let i = k; i < a.length; i++) {
      [a[k], a[i]] = [a[i], a[k]];
      go(k + 1);
      [a[k], a[i]] = [a[i], a[k]];
    }
  };
  go(0);
  return out;
}
```

The last two are output-sensitive: nothing can enumerate 2ⁿ subsets faster than 2ⁿ, so the
class is the problem's, not the algorithm's — and that is the answer to "can we do better?" on
them.

## How the classes compare at the sizes that matter

Growth is the whole point of the notation, and the numbers make it concrete — operations, for
n at the four sizes limits commonly use:

| n | log n | n | n log n | n² | 2ⁿ | n! |
|---|---|---|---|---|---|---|
| 10 | 3 | 10 | 33 | 100 | 1,024 | 3.6 × 10⁶ |
| 20 | 4 | 20 | 86 | 400 | ~10⁶ | 2.4 × 10¹⁸ |
| 10³ | 10 | 10³ | 10⁴ | 10⁶ | 10³⁰¹ | — |
| 10⁵ | 17 | 10⁵ | 1.7 × 10⁶ | 10¹⁰ | — | — |
| 10⁶ | 20 | 10⁶ | 2 × 10⁷ | 10¹² | — | — |

Three things to read off it. **log n is nearly constant** — 17 at a hundred thousand, 20 at a
million — so n log n is "n with a small constant", and a sort is almost never the reason a
solution is too slow. **n² at 10⁵ is 10¹⁰** — a hundred seconds at the folklore rate — which is
why "n ≤ 10⁵" excludes quadratic, and **n² at 5,000 is 2.5 × 10⁷**, which is why "n ≤ 5,000"
permits it. **2ⁿ at 20 is a million** and at 25 is thirty million — feasible; at 40 it is 10¹²
— not; so an exponential intended solution has n around 20, and "n ≤ 20" is the setter saying
so. Factorial is feasible to about n = 10.

## What the limit implies

The full table is on [phase 0's constraints page](../phase-0-the-interview-and-practice/05-reading-the-constraints.md);
the logic behind it is one multiplication: **class(n) against roughly 10⁸ simple operations a
second.** The reverse reading — from the limit to the class the setter intended — is the skill:

| Limit | Intended class | And therefore the shape to look for |
|---|---|---|
| n ≤ 10–12 | n! or worse | permutations, brute force over orderings |
| n ≤ 20–25 | 2ⁿ, n · 2ⁿ | bitmask DP, subset enumeration, meet-in-the-middle at ~40 |
| n ≤ 100 | n³ | Floyd–Warshall, three nested loops, interval DP over (i, j, k) |
| n ≤ 1,000–5,000 | n² | pair loops, quadratic DP over (i, j), insertion into a sorted array |
| n ≤ 10⁵–10⁶ | n log n or n | sort-based, heap-based, binary search on the answer; hash, two pointers, prefix sums |
| n ≤ 10⁷–10⁸ | n, with a tight constant | one pass, arrays not maps, no allocation in the loop |
| n up to 10⁹ or 10¹⁸ | log n, √n, or O(1) | binary search on the answer, arithmetic, closed forms, fast exponentiation |

The last row is the one that catches candidates: a limit of 10⁹ is not "a big linear"; it is
the setter saying *do not iterate*. And a limit around 20 is a gift — the exponential solution is
the right one, and a candidate who spends the round hunting for a polynomial one has misread
the statement.

## The in-between classes

Seven classes are not enough for every answer, and five more come up often enough to say by
name:

- **Θ(n√n)** — a loop to √n inside a loop over n: trial-division factorisation of n numbers,
  sqrt-decomposition queries. At 10⁵ it is 3 × 10⁷; fine.
- **Θ(n · 2ⁿ)** — bitmask DP with a linear inner loop, subset enumeration with a per-subset
  scan. At n = 20 it is 2 × 10⁷; the class the "n ≤ 20" limit usually means.
- **Θ(log² n)** — a binary search whose check is itself logarithmic; or a segment tree with a
  binary search inside a query. Nearly constant in practice.
- **Θ(n log log n)** — the sieve of Eratosthenes; say it as "essentially linear" and know why
  it is not quite.
- **Θ(m · α(n))** — union-find with both heuristics ([03b](03b-union-find-and-the-limits-of-amortised.md));
  "effectively linear in the number of operations".
- **Θ(n · L)** for k strings of length L, Θ(V + E) for graphs, Θ(n · m) for a grid or two
  inputs — the multi-variable forms from [01](01-big-o-theta-and-omega.md), which are their own
  classes and are never collapsed to one letter.

And the ordering that answers "which is faster" between neighbours: log n ≺ √n ≺ n ≺ n log n ≺
n√n ≺ n² ≺ n³ ≺ 2ⁿ ≺ n · 2ⁿ ≺ n!. The one pair that surprises: n log n versus n√n — at 10⁶,
2 × 10⁷ against 10⁹, so "root n" is much worse than "log n" and the two are not neighbours in
cost, only in the list.

## The arithmetic of "will it run"

Said aloud, before writing code, once the class is known:

```ts
// the estimate in code — the only arithmetic the round needs; nothing here is worth running
export function operations(cls: 'log' | 'n' | 'nlogn' | 'n2' | 'n3' | '2n' | 'n2n' | 'fact', n: number): number {
  const lg = Math.log2(n);
  switch (cls) {
    case 'log':   return lg;
    case 'n':     return n;
    case 'nlogn': return n * lg;
    case 'n2':    return n * n;
    case 'n3':    return n * n * n;
    case '2n':    return 2 ** n;
    case 'n2n':   return n * 2 ** n;
    case 'fact':  { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }
  }
}
// operations('n2', 1e5) = 1e10 → ~100 s at 1e8/s → no.   operations('nlogn', 1e5) ≈ 1.7e6 → yes.
// operations('2n', 20) ≈ 1e6 → yes.   operations('2n', 40) ≈ 1e12 → no; meet in the middle → 2 × 2^20.
```

The constant matters at the boundary, and the language matters with it: interpreted or JIT
runtimes with allocation in the loop run a few times slower than the folklore figure assumes,
so an n log n at 10⁶ with a map allocation per element is at risk where the same algorithm on
arrays is not. When the estimate lands within a factor of ten of the limit, say so and name the
constant you would cut — "arrays instead of a map, no object per element".

## Gotchas

**★ Symptom: a quadratic written for n ≤ 10⁵, and the large test times out.** Cause: the limit
not read as a class. Fix: n² at 10⁵ is 10¹⁰; the setter meant n log n or n — sort, hash, two
pointers, prefix sums.

**★ Symptom: twenty minutes hunting for a polynomial solution when n ≤ 20.** Cause: the
exponential read as a failure rather than the intent. Fix: n ≤ 20 licenses 2ⁿ or n · 2ⁿ —
subsets, bitmask DP; write it.

**★ Symptom: "O(n) is fine" for n up to 10⁹.** Cause: a large limit read as "big linear". Fix: a
limit of 10⁹ or 10¹⁸ means do not iterate — binary search on the answer, arithmetic, a closed
form, fast exponentiation.

**Symptom: the sort blamed for slowness.** Cause: n log n imagined as much more than n. Fix: log
n is 17 at 10⁵ and 20 at 10⁶; a sort is n with a small constant, and the bottleneck is elsewhere.

**Symptom: "root n is about log n".** Cause: two slow-growing functions conflated. Fix: at 10⁶,
√n is a thousand and log n is twenty; n√n is 10⁹ against n log n's 2 × 10⁷.

**Symptom: an exponential solution at n = 40.** Cause: 2⁴⁰ ≈ 10¹² not computed. Fix: meet in the
middle — two halves of 2²⁰, combined with a sort or a hash; or the limit was a hint that a
polynomial solution exists.

**Symptom: the estimate is within a factor of ten and the constant ignored.** Cause: the
folklore rate taken as exact in a JIT runtime with allocation. Fix: say the risk and the cut —
arrays over maps, no per-element objects, a typed array for numbers.

**Symptom: n³ dismissed as always too slow.** Cause: the class judged without the size. Fix: n ≤
100 gives 10⁶ — fine; Floyd–Warshall and interval DP live there, and the limit says so.

**Symptom: "2ⁿ" claimed for a subset enumeration with a linear scan per subset.** Cause: the
inner loop dropped. Fix: n · 2ⁿ, and at n = 20 that is 2 × 10⁷ rather than 10⁶ — still fine,
but say the true class.

**Symptom: the multi-variable class collapsed to one letter to fit the table.** Cause: the table
read as the only vocabulary. Fix: Θ(n · m), Θ(V + E), Θ(k · L) are classes; estimate with the
real variables.

## Interview questions

**★ The input is up to 10⁵ elements. What complexity should the solution have, and why?**
Linear or n log n. At 10⁵, a quadratic is 10¹⁰ operations — about a hundred seconds at the
folklore rate of 10⁸ a second — while n log n is under two million. The limit is the setter
naming the intended class: sort-based, heap-based, binary search on the answer, or a hash and
a single pass. Say the multiplication aloud before choosing the approach.

**★ n is at most 20. What does that tell you?**
That an exponential solution is intended: 2²⁰ is about a million and n · 2ⁿ about twenty
million, both comfortable; a polynomial solution probably does not exist or is not expected.
Look for subset enumeration, bitmask DP, or backtracking over the items. The same limit at 40
would mean meet in the middle — two halves of 2²⁰ combined — and at 12 or below, permutations.

**★ Order these from fastest to slowest and name a problem for each: n!, n log n, log n, n², 2ⁿ,
n, √n.**
log n — binary search; √n — trial-division primality; n — a scan or hash pass; n log n — a
comparison sort or a heap drained n times; n² — all pairs, naive substring search; 2ⁿ — all
subsets; n! — all orderings. The pair to be careful with is √n and log n: at a million they are
a thousand and twenty, so they are far apart in cost though adjacent in the list.

**Why is n log n "almost linear" in practice?**
Because log n is tiny at every size a limit uses — 17 at a hundred thousand, 20 at a million,
30 at a billion — so n log n is n times a small constant, and a sort at 10⁶ is twenty million
operations, well inside a second. When a solution with a sort is too slow, the sort is almost
never the reason; look for the quadratic elsewhere.

**What are the in-between classes worth knowing?**
n√n for a root-bounded loop inside a linear one — factorising n numbers, sqrt decomposition; n ·
2ⁿ for bitmask DP with a linear inner loop, which is what "n ≤ 20" usually intends; log² n for a
binary search whose check is logarithmic; n log log n for the sieve; m · α(n) for union-find,
effectively linear; and the multi-variable classes — n · m, V + E, k · L — which are their own
and are never collapsed to one letter.

**The limit is 10¹⁸. What does the solution look like?**
Not a loop over n. Binary search on the answer with a logarithmic number of checks, a closed
form, fast exponentiation, digit DP over the eighteen digits, or arithmetic on the value's
structure. The limit is the setter saying that anything that touches the input's magnitude
even once is too slow — and in JavaScript it is also a reminder that the value exceeds
`Number.MAX_SAFE_INTEGER`, so `BigInt` or modular arithmetic is needed.

---

← Prev: [04b · Tail calls, and the explicit stack](04b-tail-calls-and-the-explicit-stack.md) · Index: [Phase 1 — Complexity analysis](README.md) · Next → **Hidden costs** *(not written yet)*
