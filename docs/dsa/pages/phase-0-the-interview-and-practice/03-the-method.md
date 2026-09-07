---
title: "Understand, match, plan, implement, review, evaluate — and the step that matters is match, because matching the problem to a pattern before designing is the reflex this whole track exists to build"
sidebar_label: "03 · The method"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. The six-step method is a widely used interview framework stated as
> method, not as a quoted standard. The Java `PriorityQueue` cost claim is quoted from the
> [JDK 25 API documentation](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/PriorityQueue.html).
> Code is TypeScript targeting Node 24 (LTS) and Java 25, written to be runnable; **nothing was
> run**.

**Six steps — understand, match, plan, implement, review, evaluate — and five of them are what
any careful engineer does anyway. The sixth-in-importance-but-second-in-order step, *match*, is
the one that decides whether the round goes well, because it is the moment you name the pattern
before you design anything.** A candidate who matches "contiguous subarray with a condition" to
*sliding window* in ten seconds has forty minutes to plan, write and test; one who starts
designing from the problem statement is inventing sliding window from scratch under a clock.
Every later phase of this track is a catalogue of patterns and the signals that point to them;
this page is the method that puts the catalogue to use, and the reason the ladder is organised
by pattern rather than by problem.

## The six steps

| Step | What it is | Output | Minutes |
|---|---|---|---|
| **Understand** | restate the problem, the input and output shapes, the constraints; one normal example and one edge case, worked by hand | a restatement the interviewer has confirmed | 3–5 |
| **Match** | name the pattern the problem's *signals* point to — and the second candidate if there is one | "this is sliding window; if the window condition were non-monotonic it would be prefix sums" | 1–2 |
| **Plan** | the data structure, the pass, the invariant, in one or two sentences; the brute force and its bound as the baseline | a plan said aloud with time and space stated | 3–5 |
| **Implement** | code, narrated, in the shape the plan described | working code | 10–15 |
| **Review** | trace the edge case by hand; look for the off-by-one at every boundary | bugs found and fixed | 5–8 |
| **Evaluate** | state and defend the complexity; name what you would do with more time; take the follow-up | the bound, and the re-derivation under a changed constraint | 2–5 |

The [45-minute shape](02-the-45-minute-shape.md) is these six steps with the clock attached;
this page is about what each step *consists of*, and especially the second.

## Match: the signals and the patterns they point to

Matching works from *signals* in the problem statement to a small set of patterns. The table is
the skeleton of the whole track — each row is a later phase — and the skill is reading the
left column off a problem in seconds:

| Signal in the problem | Pattern to try first | Second candidate |
|---|---|---|
| sorted input, or "find in sorted" | binary search | two pointers |
| "contiguous subarray / substring" with a condition | sliding window | prefix sums when the condition is a sum |
| "pair / triple that sums to" | hash map of complements | sort then two pointers |
| "k-th largest / smallest", "top k" | heap of size k | quickselect |
| "all combinations / permutations / subsets" | backtracking | bitmask enumeration when n ≤ 20 |
| "minimum number of steps" on a grid or graph with unit edges | breadth-first search | 0-1 BFS when edges are 0 or 1 |
| "shortest path" with weights | Dijkstra | Bellman–Ford with negative edges |
| "can it be done / minimum or maximum value" with a monotonic yes/no | binary search on the answer | greedy |
| overlapping subproblems, "number of ways", "minimum cost" with choices | dynamic programming | memoised recursion first |
| matching brackets, nested structure, "most recent" | stack | recursion |
| "next greater / smaller element", "largest rectangle" | monotonic stack | — |
| "cycle", "middle", "k-th from end" in a linked list | fast and slow pointers | — |
| connected components, "are these connected" with union operations | union-find | DFS |
| ordering with dependencies | topological sort | — |
| prefix matching, autocomplete | trie | sorted array plus binary search |
| intervals — merge, overlap, rooms | sort by start, then sweep | heap for the ends |
| "in-place", "O(1) space" on an array of 1..n | cyclic sort, index as hash | — |
| frequency, counting, "most common" | hash map | bucket sort when the range is small |

Two rules about the table. First, **match is a hypothesis, not a commitment** — say the pattern,
say why the signal points to it, and let the plan step confirm or refute it in a minute. Second,
**say the second candidate when there is one**, because it is evidence that the match was reasoned
rather than reflexive, and because the follow-up often switches to it ("what if the array is not
sorted?" turns binary search into a hash map).

## Plan: one sentence, an invariant, a bound

The plan is short because the pattern has done most of the work. What it must contain:

- **the data structure** — "a map from value to last index", "a min-heap of size k";
- **the pass** — "one pass left to right", "sort, then sweep";
- **the invariant** — the sentence that makes the code checkable: "the window contains no
  repeats", "the heap holds the k largest seen so far";
- **the bound** — time and space, against the constraints;
- **the baseline** — the brute force in one clause, as the correctness reference.

Then the pause for objections, and typing.

## A worked match: top-k frequent elements

"Given an array of integers and k, return the k most frequent elements."

**Understand.** "Up to 10⁵ integers; k is at most the number of distinct values; any order in
the output? Ties — does the interviewer care which of two equally frequent values is returned?"
Example: `[1,1,1,2,2,3]`, k=2 → `[1,2]`. Edge: k equals the number of distinct values (return
them all); a single element.

**Match.** Two signals: *frequency* → hash map; *top k* → heap of size k. Second candidate:
bucket sort by frequency, because frequency is bounded by n, which gives O(n) instead of
O(n log k). "I'll do the heap version first — it's the general one — and mention the bucket
version as the follow-up answer if you want O(n)."

**Plan.** "Count with a map, O(n). Then a min-heap of size k over the distinct values, ordered
by count: for each distinct value, push; if the heap exceeds k, pop the smallest. Invariant: the
heap holds the k most frequent values seen so far. O(n log k) time, O(n) space for the map." The
brute force — sort the distinct values by count, O(n log n) — is the baseline.

**Implement.** JavaScript has no built-in heap, which is itself a thing to say aloud
(**04 · Language choice and runtime traps** *(not written yet)*); in an interview the bucket version is often the better TypeScript choice precisely because
it needs no heap:

```ts
export function topKFrequent(nums: readonly number[], k: number): number[] {
  const count = new Map<number, number>();
  for (const n of nums) count.set(n, (count.get(n) ?? 0) + 1);

  // bucket[f] holds every value that occurs exactly f times; f is at most nums.length
  const buckets: number[][] = Array.from({ length: nums.length + 1 }, () => []);
  for (const [value, f] of count) buckets[f].push(value);

  const result: number[] = [];
  for (let f = buckets.length - 1; f >= 1 && result.length < k; f--) {
    for (const value of buckets[f]) {
      if (result.length === k) break;
      result.push(value);
    }
  }
  return result; // O(n) time, O(n) space; tie order is bucket insertion order
}
```

The Java version uses the heap the plan described, because Java has one, and its cost is
documented:

> *"this implementation provides O(log(n)) time for the enqueuing and dequeuing methods (`offer`,
> `poll`, `remove()` and `add`); linear time for the `remove(Object)` and `contains(Object)`
> methods; and constant time for the retrieval methods (`peek`, `element`, and `size`)."*
> — JDK 25, `java.util.PriorityQueue`

```java
import java.util.HashMap;
import java.util.Map;
import java.util.PriorityQueue;

public final class TopKFrequent {
    public static int[] topKFrequent(int[] nums, int k) {
        Map<Integer, Integer> count = new HashMap<>();
        for (int n : nums) count.merge(n, 1, Integer::sum);

        // min-heap on frequency, capped at k: the head is the least frequent of the k kept
        PriorityQueue<Map.Entry<Integer, Integer>> heap =
            new PriorityQueue<>((a, b) -> Integer.compare(a.getValue(), b.getValue()));
        for (Map.Entry<Integer, Integer> e : count.entrySet()) {
            heap.offer(e);                       // O(log k)
            if (heap.size() > k) heap.poll();    // drop the least frequent
        }

        int[] result = new int[heap.size()];
        for (int i = result.length - 1; i >= 0; i--) result[i] = heap.poll().getKey();
        return result;                            // O(n log k) time, O(n) space
    }
}
```

**Review.** Trace `[1,1,1,2,2,3]`, k=2: counts {1:3, 2:2, 3:1}; buckets[3]=[1], [2]=[2],
[1]=[3]; walking from the top: 1, then 2 — result `[1,2]`, stops at k. Edge: k = 3 → `[1,2,3]`.
Single element `[7]`, k=1 → `[7]`.

**Evaluate.** "Bucket version O(n) time and space; heap version O(n log k). Follow-up I'd
expect: 'the stream is infinite and k is small' — then the heap is the only choice, because the
buckets need n." That last sentence is the *evaluate* step doing its job: naming the follow-up
before it is asked.

## When the match is wrong

It happens, and it is graded on how it is handled. The tell is in the plan step: the invariant
will not write, or the bound does not meet the constraints. The response is to say it — "sliding
window doesn't hold here because the condition isn't monotonic; that points to prefix sums" —
and re-match from the second candidate. Thirty seconds, and the interviewer has seen the
reasoning. Ploughing on with a pattern that does not fit costs ten minutes and a rewrite.

## Gotchas

**★ Symptom: ten minutes of staring, then a brute force.** Cause: designing from the statement
instead of matching from its signals. Fix: read the signals aloud — "contiguous, with a sum
condition" — and name the pattern they point to; the table above is what to internalise, one
phase at a time.

**★ Symptom: the pattern was named instantly and was wrong, and you noticed at minute twenty.**
Cause: match treated as a commitment. Fix: the plan step is the check — if the invariant will
not write in one sentence or the bound misses the constraints, re-match from the second
candidate before typing.

**Symptom: "I'll use a heap" in TypeScript, and five minutes writing one.** Cause: the language's
missing built-in forgotten at the match step. Fix: know which patterns need a structure the
language lacks, and prefer the alternative (bucket sort here) or have a twenty-line heap
rehearsed.

**Symptom: the follow-up switched the pattern and you had no second candidate.** Cause: the
match was a single word. Fix: always say the second candidate and the signal that would select
it; the follow-up usually is that signal.

**Symptom: the plan had no invariant, and the review step had nothing to check against.**
Cause: the plan was a data structure and a verb. Fix: one sentence that makes the code
checkable — "the heap holds the k most frequent seen so far" — and trace the edge case against
it.

**Symptom: evaluate was "O(n)" and nothing else.** Cause: the step treated as a formality.
Fix: the bound, its defence, what you would do with more time, and the follow-up you expect —
naming it first is the senior signal.

## Interview questions

**★ What is your method for an unfamiliar problem?**
Understand — restate, fix the shapes and constraints, work one example and one edge case; match —
read the signals and name the pattern they point to, plus the second candidate; plan — the data
structure, the pass, the invariant, the bound and the brute-force baseline, said aloud; implement
— narrated code in the planned shape; review — trace the edge case by hand and hunt the
off-by-one; evaluate — state and defend the complexity and name the follow-up. The step that
decides the round is match, because it turns forty minutes of design into forty minutes of
execution.

**★ How do you recognise which pattern a problem needs?**
From signals in the statement, not from the problem's name: sorted input points to binary
search or two pointers; a contiguous subarray with a condition to sliding window or prefix
sums; "top k" to a heap or quickselect; "all combinations" to backtracking; minimum steps on
unit edges to BFS; weighted shortest path to Dijkstra; a monotonic yes/no over a value to
binary search on the answer; overlapping subproblems to dynamic programming; brackets to a
stack; next-greater to a monotonic stack; cycles in a list to fast and slow pointers;
connectivity with unions to union-find; dependencies to topological sort; prefixes to a trie.
The match is a hypothesis the plan step confirms in a minute.

**What goes in the plan, and why is the invariant the important part?**
The data structure, the pass, the invariant, the time and space bound, and the brute force as a
baseline — two sentences. The invariant is what makes the code checkable: "the window has no
repeats" or "the heap holds the k most frequent seen so far" is the statement each line of code
either preserves or breaks, and the statement the review step traces the edge case against. A plan
without an invariant leaves the review with nothing to check.

**Top-k frequent: which approach, and what changes your choice?**
Count with a map, then either a min-heap of size k over the distinct values — O(n log k), the
general answer, natural in Java where `PriorityQueue` documents O(log n) offer and poll — or
bucket sort by frequency, O(n), natural in TypeScript where there is no built-in heap. The
follow-up that switches between them is the stream: an unbounded input with small k forces the
heap, because the buckets need n.

**What do you do when the pattern you matched turns out not to fit?**
Say it as soon as the plan step shows it — the invariant will not write, or the bound misses the
constraints — and re-match from the second candidate: "the window condition isn't monotonic, so
sliding window fails; prefix sums instead." Thirty seconds and visible reasoning; the alternative,
forcing a pattern that does not fit, costs a rewrite at minute twenty and reads as not having
checked.

---

← Prev: [02 · The 45-minute shape](02-the-45-minute-shape.md) · Index: [Phase 0 — The DSA interview and the practice system](README.md) · Next → [04 · Language choice and traps](04-language-choice-and-runtime-traps.md)
