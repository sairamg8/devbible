---
title: "\"Can we do better?\" is answered with a reason, not a shrug — a lower bound: the output is that large, every element must be read, a comparison sort needs n log n decisions, an adversary can hide the answer from anything faster — or with an honest \"not that I know of\" and the best you can see"
sidebar_label: "11 · Proving optimality"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07. Textbook — the decision-tree lower bound for comparison sorting, the
> adversary argument and the reduction technique are CLRS (*lower bounds for sorting*,
> *medians and order statistics*), stated in the simplified forms used in interviews and not
> quoted. No runtime claim is made on this page. **No sandbox run.**

**Every solution ends with the same question, and the answer that gets the mark is a reason in
one of four shapes.** *The output is that large* — nothing can list 2ⁿ subsets faster than 2ⁿ.
*Every element must be read* — a linear scan for a maximum cannot be beaten, because any
element skipped could have been the answer. *A comparison sort needs log₂(n!) ≈ n log n
decisions* — the decision tree has n! leaves and a binary tree with that many leaves has that
depth, so no algorithm that learns the order only by comparing can do better, and counting
sort escapes the bound precisely by not comparing. *An adversary can hide the answer* — for an
unsorted search, whichever element you have not looked at is where the adversary puts it. When
none of the four applies, the honest answer is the fifth: "not that I know of; the best I can
see is this, and here is what I would try" — which is worth more than a confident "no" with no
reason behind it. This page is the four lower-bound arguments with the problems each settles,
the reductions that carry a known bound to a new problem, the bounds that are *not* tight and
what that means, and the sentence for each.

## The four arguments

### 1 · The output is that large

If the answer has k parts, producing it costs Ω(k). All subsets: Ω(2ⁿ). All permutations:
Ω(n!). All pairs: Ω(n²). Every shortest path from one source: Ω(V), because there are V of
them. The bound is on the *problem*, not the algorithm, and it is the easiest "we cannot do
better" to state — the only way past it is to change what is asked: "the count of subsets with
sum S" is not "the subsets with sum S", and the count can be found in Θ(n · S).

### 2 · Every element must be read

Any problem whose answer can change if one unexamined element changes needs Ω(n): maximum,
sum, membership in an unsorted array, "is this array sorted", the median. The argument is an
adversary in its simplest form — if the algorithm skipped element i, set element i to break its
answer. The linear scan is therefore optimal, and the sentence is *"linear, and linear is
optimal here because every element has to be looked at"*. The exception is the reason binary
search exists: a *sorted* array carries information about elements not looked at, so the
argument fails and log n is reachable.

### 3 · The decision tree: comparison sorting is Ω(n log n)

An algorithm that learns the order of n distinct elements only by comparing pairs can be drawn
as a binary tree — each internal node a comparison, each leaf an output permutation. It must
have at least n! leaves, one per possible input order, and a binary tree with n! leaves has
height at least log₂(n!), which is Θ(n log n) by Stirling's approximation (log n! ≈ n log n −
1.44n). Some input follows a root-to-leaf path of that length, so the worst case of *any*
comparison sort is Ω(n log n) — merge sort and heapsort meet it; quicksort meets it in
expectation. The bound applies to the *model*: an algorithm that inspects the values themselves
rather than comparing them — counting sort on a bounded integer range, radix sort on fixed-width
keys, bucket sort on a known distribution — is not in the tree and runs in Θ(n + k) or Θ(n · w).
"Can we sort faster than n log n?" has two correct answers, and the second is "yes, if we may
look at the keys rather than compare them, and the range is bounded".

The same tree gives smaller bounds. Searching a sorted array by comparisons: n + 1 possible
outcomes, so a tree of depth log₂(n + 1) — binary search is optimal. Finding the maximum: n − 1
comparisons are necessary, because every element but the winner must lose at least once.

### 4 · The adversary

The adversary answers the algorithm's queries so as to keep as many answers possible for as long
as possible; the number of queries it can force is the bound. Unsorted search: the adversary
says "not here" to every probe; after n − 1 probes two answers remain, so n probes are needed.
Finding both the maximum and the minimum: an adversary argument gives ⌈3n/2⌉ − 2 comparisons,
and the pairwise algorithm — compare in pairs, then the winners for the max and the losers for
the min — meets it. Element distinctness by comparisons: Ω(n log n), by a decision-tree
argument, which is why "are all elements unique?" is n log n by sorting or Θ(n) expected by
hashing — and the hash escapes the bound by not being a comparison algorithm.

## Reductions: carrying a bound to a new problem

If problem A could be solved faster than a known bound for B, and B reduces to A cheaply, the
bound transfers. The interview form:

- **Element distinctness reduces to sorting** — sort, scan for equal neighbours. So a
  comparison-based distinctness in o(n log n) would give a faster sort. Distinctness is
  Ω(n log n) by comparisons.
- **Convex hull reduces to sorting** — the points (x, x²) on a parabola have a hull that lists
  them in sorted x order. So the comparison-based hull is Ω(n log n), and Graham scan meets it.
- **3SUM-hardness** — many geometry and array problems are conjectured to need ~n² because a
  faster solution would give a faster 3SUM; this is a conditional bound, said as "believed",
  and it is the honest answer to "can 3SUM be done in linear time?" — "not known; it is a
  standing open problem, and the best known is a little under n²".

The reduction sentence: *"if we could do this in linear time we could sort in linear time by
comparisons, which the decision tree rules out."*

## Bounds that are not tight — and what to say

A lower bound and the best known algorithm do not always meet, and the gap is a legitimate
thing to name:

| Problem | Lower bound | Best known | The sentence |
|---|---|---|---|
| comparison sort | Ω(n log n) | Θ(n log n) | tight — optimal |
| finding the max | n − 1 comparisons | n − 1 | tight |
| matrix multiplication | Ω(n²) (the output) | roughly n^2.37, in theory; Strassen's n^2.81 in practice | "not known to be tight; the practical algorithm is far from the bound" |
| 3SUM | Ω(n) trivially | slightly under n² | "believed quadratic; open" |
| integer multiplication | Ω(n) | Θ(n log n), a 2019 result | "the bound was reached only recently" |
| all-pairs shortest paths | Ω(V²) (the output) | V³ dense, VE log V sparse | "a gap; no one knows a V² algorithm" |
| any NP-hard problem — TSP, subset sum in general | no polynomial bound proven either way | exponential | "no polynomial algorithm is known, and one would settle P versus NP" |

The last row is the disciplined way to say "this is NP-hard": not "it's impossible", but "no
polynomial-time algorithm is known, and the problem is NP-hard, so finding one would be a
major result; with n ≤ 20 the exponential is intended, and for larger n we'd approximate or use
the structure of the instance."

## The fifth answer

When no bound applies and no better algorithm comes to mind: *"I don't see a way to beat this.
The bottleneck is the sort; if the values were bounded integers a counting sort would make it
linear, and if the input were sorted already the whole thing is one pass. Otherwise n log n is
the best I have."* That sentence names the bottleneck, names the assumption that would remove
it, and admits the limit — which is the senior answer to "can we do better?" whenever the
honest one is "not that I know of". A confident "no, this is optimal" with no argument is
worse than it, because the interviewer knows whether a better one exists.

## Saying it

The answer to "can we do better?" is one of five sentences, said in this order of preference:

1. **"No — the output is Θ(k), and we produce it in Θ(k)."**
2. **"No — every element must be examined, and we examine each once."**
3. **"No, not by comparisons — the decision tree gives n log n. If we may look at the keys
   and they're bounded, counting sort makes it linear."**
4. **"No — an adversary can force n probes: whichever we skip is where the answer is."**
5. **"Not that I know of — the bottleneck is X; it goes away if Y; otherwise this is the best
   I have."**

## Gotchas

**★ Symptom: "can we do better?" answered with "no".** Cause: no argument. Fix: one of the four
lower bounds, or the honest fifth sentence with the bottleneck and the assumption that would
remove it.

**★ Symptom: "sorting is Ω(n log n)" said of counting sort or radix sort.** Cause: the model of
the bound forgotten. Fix: the decision tree bounds *comparison* sorts; algorithms that inspect
keys on a bounded range run in Θ(n + k), and "can we sort faster?" has that second answer.

**Symptom: "linear is optimal" for a search in a sorted array.** Cause: the must-read argument
applied where the input carries information about unread elements. Fix: sorted input breaks the
adversary — log n is reachable, and the decision tree says log n is also the bound.

**Symptom: "it's NP-hard, so impossible."** Cause: hardness confused with impossibility. Fix:
"no polynomial algorithm is known; at n ≤ 20 the exponential is intended; otherwise approximate
or exploit structure."

**Symptom: an optimality claim for a hash-based Θ(n) — "and Θ(n) is optimal because every
element must be read".** Cause: the right argument, but the bound was expected, not worst
case. Fix: "optimal in expectation; the worst case is quadratic, and the comparison bound for
the worst case is n log n."

**Symptom: "matrix multiplication is Θ(n³)".** Cause: the naive algorithm's bound stated as
the problem's. Fix: Ω(n²) from the output; n^2.81 by Strassen; the true exponent unknown.

**Symptom: a lower bound argued for the algorithm rather than the problem.** Cause: "my loop
must run n times" mistaken for "any solution must". Fix: the bound is on every possible
algorithm — the output size, the adversary, the decision tree — not on the one written.

## Interview questions

**★ Why can't a comparison sort beat n log n?**
Because any algorithm that learns the order only by comparing pairs is a binary decision tree
whose leaves are the n! possible orderings, and a binary tree with n! leaves has height at
least log₂(n!) ≈ n log n; some input follows a path of that length. Merge sort and heapsort
meet the bound. It applies to the comparison model only — counting sort and radix sort inspect
keys on a bounded range and run in Θ(n + k), which is the second answer to "can we sort faster".

**★ "Can we do better?" — how do you answer it?**
With a reason in one of four shapes, or an honest fifth. The output is that large — all
subsets are 2ⁿ. Every element must be read — the maximum, the sum, unsorted membership. The
decision tree — n log n for comparison sorting, log n for searching a sorted array. An
adversary — n probes for unsorted search, 3n/2 comparisons for max-and-min. Or: "not that I
know of — the bottleneck is the sort; if the keys were bounded integers it would be linear;
otherwise this is the best I have." A bare "no" with no argument is the answer that loses the
mark.

**Why is finding the maximum Θ(n) and optimal, but searching a sorted array Θ(log n)?**
The maximum needs every element examined — any element skipped could be the largest — so n − 1
comparisons are necessary and the scan is optimal. A sorted array carries information about
elements not examined: one comparison rules out half of them, so the must-read argument does
not apply, and the decision tree with n + 1 outcomes gives a depth of log₂(n + 1), which
binary search meets. The difference is what the input's structure tells you about what you
have not looked at.

**How does a reduction transfer a lower bound?**
If problem B is known to need Ω(f), and B can be turned into an instance of A with cheap
overhead, then A needs Ω(f) too — otherwise solving A fast would solve B fast. Element
distinctness reduces to sorting, so comparison-based distinctness is Ω(n log n); the convex hull
of points on a parabola lists them in sorted order, so a comparison-based hull is Ω(n log n).
The sentence: "if we could do this in linear time we could sort in linear time by comparisons,
which the decision tree rules out."

**What does "NP-hard" let you say, and what does it not?**
That no polynomial-time algorithm is known and that finding one would settle P versus NP — so
an exponential or a heuristic is the expected answer, and a limit like n ≤ 20 in the statement
is the setter saying so. It does not let you say "impossible": the exponential is a real
algorithm, and for larger instances approximation, pruning and the structure of the specific
instance are the tools. Subset sum with a small target is the reminder — NP-hard in general and
pseudo-polynomial Θ(n · S) when the target is bounded.

**Is a lower bound on your algorithm the same as a lower bound on the problem?**
No, and confusing them is the common error. "My loop runs n times" bounds the algorithm
written; a lower bound on the problem must hold for every possible algorithm, which is what the
output-size, must-read, decision-tree and adversary arguments provide. The claim "this is
optimal" needs the second kind; without it, the honest form is "this is the best I know."

---

← Prev: [10 · Benchmarking vs analysis](10-benchmarking-vs-analysis.md) · Index: [Phase 1 — Complexity analysis](README.md) · Next phase → [Part 1 of the syllabus — recursion, maths and bits](../../syllabus/01-foundations.md)
