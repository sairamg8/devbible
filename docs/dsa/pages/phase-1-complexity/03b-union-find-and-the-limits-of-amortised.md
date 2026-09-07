---
title: "Union-find is the amortised bound candidates misstate most — inverse Ackermann with both heuristics, log n with rank alone, never \"O(1)\" — and amortised is not worst case: a single push can copy the whole array, which is the wrong bound under a per-request deadline and a false one wherever an element can re-enter the structure"
sidebar_label: "03b · Union-find, and the limits of amortised"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. The union-find bound (inverse Ackermann with union by rank and path
> compression) and the potential method are textbook (CLRS, *disjoint sets*, *amortized
> analysis*), stated, not quoted. Second half of topic 03 — [03](03-amortised-analysis.md) is
> the method, the dynamic array and the "each element once" sentence. **No sandbox run.**

**Two things about amortised bounds get a senior candidate marked down: misstating union-find,
and forgetting that an amortised bound says nothing about any single operation.** Union-find
with union by rank and path compression is inverse Ackermann per operation — effectively
constant, and said that way, with the heuristics named; "O(1)" is sloppy and "O(log n)" is the
rank-only bound. And an amortised constant is the average over a sequence: the push that
doubles the buffer copies everything, the `find` that compresses a long chain walks it, and a
handler with a per-request deadline cannot absorb either. Finally the "each element once"
sentence of [03](03-amortised-analysis.md) has a precondition — no element re-enters the
structure — and the three common ways it is violated are where a claimed linear bound is
actually quadratic. This page is union-find with its code, the amortised-versus-worst-case
distinction and when it decides the design, and the check to run before claiming the sentence.

## Union-find

`find` follows parent pointers to a root; `union` links two roots. Without heuristics a chain of
n nodes makes `find` Θ(n). Two heuristics — union by rank (or size), which links the shorter
tree under the taller, and path compression, which points every node on a `find` path directly
at the root — give an amortised bound per operation of α(n), the inverse Ackermann function,
which is at most 4 for any input that fits in a computer. The proof is the potential method and
is not for a whiteboard; the sentence is: *"union by rank keeps trees logarithmic, path
compression flattens them as they're touched, and the amortised cost per operation is
effectively constant — inverse Ackermann, under five for any practical n."* Say "effectively
constant" and name α(n); saying "O(1)" is graded as sloppy, saying "O(log n)" is correct but
loose (it is the bound with rank alone).

```ts
export class DSU {
  private parent: number[];
  private rank: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array<number>(n).fill(0);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]]; // path halving — every touched node moves closer to the root
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number): boolean {
    let ra = this.find(a), rb = this.find(b);
    if (ra === rb) return false;
    if (this.rank[ra] < this.rank[rb]) [ra, rb] = [rb, ra];
    this.parent[rb] = ra;
    if (this.rank[ra] === this.rank[rb]) this.rank[ra]++;
    return true;
  }
}
// m operations on n elements: Θ(m · α(n)) — "effectively linear in m"
```

## Amortised is not worst case — and when that matters

An amortised bound says nothing about any *single* operation. The push that triggers a doubling
copies the whole array; the `find` that compresses a long chain walks it; the two-stack queue's
dequeue that empties the in-stack moves everything. In an algorithm question this is fine — the
total is what the bound is about. In two situations it is not, and the interviewer who asks
"what's the worst single push?" is checking that you know the difference:

- **A latency requirement.** A request handler that must answer in under a millisecond cannot
  absorb the one push in a million that copies a gigabyte. The fix is a structure with a
  worst-case bound — a linked structure, or an array that grows incrementally by copying a few
  elements per push (deamortisation).
- **A hostile sequence.** Amortised bounds hold for *any* sequence, but some structures'
  amortised claims assume the operations are not adversarially interleaved — the
  grow-at-full, shrink-at-half array is the standard example, oscillating at the boundary.

The sentence: *"constant amortised, not constant worst case — a single push can be linear when
the buffer doubles; over n pushes the doublings sum to under 2n."*

## When the claim is wrong

The "each element once" sentence fails whenever an element can re-enter the structure. Three
common ways:

1. **BFS marking on dequeue** — a vertex with k incoming edges is enqueued k times; the queue
   work is Θ(E), still fine for the total, but the "once" is false and the visited-set check
   moved.
2. **A while that resets a pointer** — a sliding window where `left` is set back to some
   earlier position on a condition; the pointer's total travel is no longer bounded by n.
3. **A stack where popped elements are pushed back** — some "next greater" variants re-push;
   then the bound needs a different argument or is genuinely quadratic.

The check, before saying the sentence: *can any element be added to the structure twice?* If
yes, the sentence is not available and the bound is the number of additions.

## Gotchas

**★ Symptom: union-find called O(1) or O(log n) without qualification.** Cause: the heuristics
unnamed. Fix: "with union by rank and path compression, amortised inverse Ackermann per
operation — effectively constant; rank alone gives log n."

**Symptom: "amortised constant" for a sliding window whose `left` jumps backwards.** Cause: a
pointer that retreats; total travel unbounded by n. Fix: check that every pointer only advances;
if one can retreat, count its total travel — the bound is that, not n.

**Symptom: a latency-bound handler stalls on the millionth push.** Cause: an amortised structure
where a worst-case one was needed. Fix: a linked structure, or a deamortised array that copies
a few elements per push; say "amortised is the wrong bound for a per-request deadline".

## Interview questions

**★ What is the complexity of union-find, and what do the two heuristics do?**
With union by rank and path compression, m operations on n elements cost Θ(m · α(n)), inverse
Ackermann — at most four or five for any input that fits in memory, so "effectively constant
amortised per operation". Union by rank links the shorter tree under the taller, keeping depth
logarithmic on its own; path compression makes every node on a `find` path point at the root, so
later finds are shorter. The rigorous bound is the potential method; on a whiteboard, name the
heuristics and α(n) and say "effectively constant", not O(1).

**★ When is an amortised bound the wrong answer?**
When a single operation's latency matters or the sequence is adversarial. A handler with a
per-request deadline cannot absorb the one push that copies the whole array; it needs a
worst-case structure — a linked list, or an array deamortised by copying a few elements on
every push. And a structure whose grow and shrink thresholds coincide can be made to copy on
every operation by oscillating at the boundary; the fix is separated thresholds — double at
full, halve at a quarter.

---

← Prev: [03 · Amortised analysis](03-amortised-analysis.md) · Index: [Phase 1 — Complexity analysis](README.md) · Next → **Space and the recursion stack** *(not written yet)*
