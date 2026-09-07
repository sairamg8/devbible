---
title: "Test your own code before the interviewer does — trace a small case by hand with a variable table, hit the edges you named before coding, and hunt the off-by-one at every boundary, because the bug is at a boundary"
sidebar_label: "08 · Testing your code live"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Method, not a quoted standard. The Java midpoint overflow is the trap
> documented on [04b · Java traps and sorting](04b-java-traps-and-sorting.md). Code is TypeScript
> targeting Node 24 (LTS), written to be runnable; **nothing was run** — the trace tables are
> hand traces, which is the point of the page.

**Correctness is graded on what you tested, and there is no test runner in most rounds. Testing
live means tracing a small case by hand, with the variables written down per iteration, on the
cases you named before coding — the empty input, the single element, duplicates, negatives, the
exact boundary — because that is where the bug is.** Off-by-one errors are not random: they live
at loop bounds, at the midpoint of a binary search, at the width of a window, at the end of a
slice, and at the seam between one-indexed inputs and zero-indexed arrays. A candidate who
traces the prompt's example has tested the case that was never going to fail; one who traces
`[3, 3]`, or the empty array, or the touching intervals, has tested the case the interviewer was
about to ask for. The five to eight minutes of the test box are where "probably right" becomes
"right", and they are the minutes most candidates cut.

## The trace table

A hand trace is a table with a row per iteration and a column per variable. Written on the
board or in a comment, it is both the test and the evidence that a test happened. For a lower-
bound binary search — the first index whose value is at least the target — on `[1, 3, 3, 5, 8]`
with target 3:

```ts
export function lowerBound(a: readonly number[], target: number): number {
  let lo = 0, hi = a.length;             // invariant: answer is in [lo, hi]; a[hi] is "virtual +∞"
  while (lo < hi) {
    const mid = lo + ((hi - lo) >> 1);   // never (lo + hi) >> 1 in Java; fine in JS below 2^31
    if (a[mid] < target) lo = mid + 1;   // mid is too small: answer is strictly right of it
    else hi = mid;                        // a[mid] >= target: mid could be the answer
  }
  return lo;                              // == hi; may equal a.length when nothing qualifies
}
```

| iteration | lo | hi | mid | a[mid] | action |
|---:|---:|---:|---:|---:|---|
| 1 | 0 | 5 | 2 | 3 | `3 < 3` false → `hi = 2` |
| 2 | 0 | 2 | 1 | 3 | false → `hi = 1` |
| 3 | 0 | 1 | 0 | 1 | `1 < 3` true → `lo = 1` |
| exit | 1 | 1 | | | return 1 ✓ (first 3 is at index 1) |

Then the edges, each in one or two rows: target 0 → returns 0; target 9 → `lo` climbs to 5 and
returns `a.length` — the "not found" position, which the caller must handle; empty array → the
loop never runs, returns 0. Three edges in a minute, and the two lines most likely to be wrong
(`mid + 1` versus `mid`, `hi = mid` versus `mid - 1`) have been exercised.

## The edge list, named before coding

The list from [01](01-what-the-coding-rounds-grade.md), with what each one catches:

| Case | Catches |
|---|---|
| **empty** | loops that assume at least one element; `a[0]` on nothing; a return value with no default |
| **one element** | two-pointer code where `left === right` at the start; a window that never grows |
| **two elements** | swaps, comparisons, and the first real iteration of a merge |
| **all equal / duplicates** | a map that overwrote an index; a set that collapsed a count; a binary search that expected distinct values |
| **negatives and zero** | a running maximum initialised to 0; a product that flipped sign; a "sum equals k" that assumed positives |
| **already sorted / reverse sorted** | a quicksort's worst case; a "no change needed" path that is never taken |
| **the exact boundary** | `k` equal to the length; a window equal to the whole array; the target at index 0 or n − 1 |
| **the touching case** | intervals `[1, 3]` and `[3, 5]`; a range ending exactly at the next one's start |
| **overflow** | sums of values near the integer limit; a midpoint on large indices |

Say the list before coding — it costs twenty seconds — and trace two or three of them after.
Which two: the one the subtle line is about (the touching case for intervals, the duplicate for a
map), and the empty or single case, because it is fast and it fails a surprising fraction of
first drafts.

## Where off-by-ones live

Each of these has a question to ask at the boundary, and the question is the test:

- **Loop bounds** — `i < n` or `i <= n`? Ask: what is the last value of `i` the body needs, and
  does the condition reach it exactly once?
- **Binary search** — `hi = a.length` or `a.length - 1`? `lo = mid + 1` or `mid`? Ask: what is the
  invariant — is the answer in `[lo, hi]` or `[lo, hi)` — and does each branch preserve it?
- **Window width** — `right - left + 1` or `right - left`? Ask: for `left === right`, is the
  window one element or zero?
- **Slices** — `slice(i, j)` is end-exclusive; `substring` too. Ask: is `j` the last index or
  one past it?
- **One-indexed input** — the problem says positions 1…n. Ask: where is the subtraction, and is
  it done exactly once?
- **Prefix sums** — `prefix[i]` is the sum of the first `i` elements or of `a[0..i]`? Ask: what
  is `prefix[0]`, and does the range query subtract the right endpoint?
- **Deletion while iterating** — an index that skips the element after a removal. Ask: after
  removing index `i`, is `i` re-examined?
- **Integer division** — rounding toward zero in both languages for positives, but `-7 / 2` is
  `-3` in Java and `-3.5` in JavaScript. Ask: what does the problem want for negatives?

The pattern across all eight: **the bug is at the seam between two conventions**, and the test
is to state the convention aloud and check the code against it at the boundary.

## The test box, run

Five to eight minutes, in this order:

1. **Re-read the code once, top to bottom**, looking only for the boundary questions above.
   Thirty seconds; catches half of the off-by-ones before any trace.
2. **Trace the subtle case** with a variable table — the case the invariant is about.
3. **Trace the empty or single case** — usually two rows.
4. **If something fails**, say what and where — "the window width is off at `left === right`" —
   fix it, and re-trace only the case that failed.
5. **Say what was tested** — "traced the duplicate case and the empty case; the boundary at
   `k === n` I checked by reading" — so the interviewer records the evidence.

If time is short, step 1 and one trace are the minimum. A trace of the prompt's example is
never the right use of the box; it was the case least likely to fail.

## When the trace finds a bug

It usually does, and how the bug is handled is graded. Say it, name the line, fix it, re-trace
the same case. Do not patch by adding a special case (`if (n === 0) return 0` in front of a
loop that should have handled it) unless the loop genuinely cannot; a special case is a signal
that the invariant is wrong, and interviewers see it as such. Do not apologise; a bug found by
your own trace is the process working, and a candidate who finds and fixes their own bug is
graded above one whose code happened to be right and was never checked.

## Gotchas

**★ Symptom: "you didn't test it" — after tracing the prompt's example.** Cause: the example was
the case that was never going to fail; testing it produced no evidence. Fix: trace the case the
subtle line is about and the empty or single case; say which cases were traced.

**★ Symptom: a binary search that loops forever or returns one off.** Cause: the invariant was
never stated, so `hi = mid` versus `mid - 1` was a guess. Fix: write the invariant — the answer is
in `[lo, hi)` — and check each branch preserves it; trace the two-element case, where the
midpoint question is decisive.

**Symptom: the empty input crashed, fixed with a guard in front of the loop.** Cause: patching
the symptom. Fix: ask whether the loop should have handled it — a `while (lo < hi)` on an empty
range does — and fix the loop's conventions rather than adding a case.

**Symptom: intervals `[1, 3]` and `[3, 5]` were not merged.** Cause: the touching case never
traced; `<` where `<=` was needed. Fix: for every interval problem, the touching case is the
trace; state whether touching counts as overlapping before coding.

**Symptom: a window solution off by one for every answer.** Cause: `right - left` where the
width is `right - left + 1`. Fix: the single-element window question — "for `left === right`, is
the width one?" — asked at the review step.

**Symptom: a one-indexed problem and an answer that is one too high.** Cause: the subtraction
done zero times or twice. Fix: convert at the edge — once, on input, or once, on output — and say
which.

**Symptom: the trace took ten minutes and there was no time for a second case.** Cause:
tracing a large example. Fix: three to five elements is enough for any trace; the edges are
two rows each.

**Symptom: Java midpoint negative on a large array.** Cause: `(lo + hi) / 2` overflowed `int`.
Fix: `lo + (hi - lo) / 2`, and say why — the interviewer knows the trap.

## Interview questions

**★ How do you test your code in an interview with no test runner?**
By hand: re-read once for the boundary questions — loop bounds, midpoint, window width, slice
ends, one-indexing, prefix conventions — then trace the subtle case with a variable table, one
row per iteration, and trace the empty or single-element case. Say which cases were traced. The
cases come from the edge list named before coding: empty, one element, duplicates, negatives,
the exact boundary, the touching case, overflow. The prompt's example is not one of them; it was
never going to fail.

**★ Where do off-by-one errors come from, and how do you find them?**
From the seams between conventions: `<` versus `<=` at a loop bound, `[lo, hi]` versus `[lo,
hi)` in a binary search, `right - left` versus `+ 1` for a window, end-exclusive slices,
one-indexed inputs, what `prefix[0]` means, re-examining an index after a deletion, and integer
division on negatives. You find them by stating the convention aloud and checking the code
against it at the boundary — the two-element case for a binary search, the single-element case
for a window, the touching case for intervals.

**Which test cases do you trace, and why those?**
The case the invariant is about — the duplicate for a map-based solution, the touching case for
intervals, the two-element array for a binary search — because that is where the subtle line
either holds or does not; and the empty or single-element case, because it is two rows and fails
a surprising share of first drafts. Two traces in the time box; the prompt's example is the one
case not worth the minutes.

**Your trace finds a bug. What do you do?**
Say what and where — "the window width is off when `left === right`" — fix the convention, not
the symptom, and re-trace the same case. A special-case guard in front of a loop that should
have handled the case is a signal the invariant is wrong, and interviewers read it that way. A
bug found by your own trace is graded well; it is the process working, and it is better evidence
than code that happened to be right and was never checked.

**Trace a lower-bound binary search on `[1, 3, 3, 5, 8]` for target 3.**
Invariant: the answer is in `[lo, hi)` with `hi` starting at the length. Iteration one: `lo` 0,
`hi` 5, `mid` 2, value 3 is not less than 3, so `hi` becomes 2. Iteration two: `mid` 1, value 3,
`hi` becomes 1. Iteration three: `mid` 0, value 1 is less than 3, `lo` becomes 1. Loop ends with
`lo` equal to `hi` equal to 1 — the first 3. Edges: target 0 returns 0; target 9 returns 5, the
length, which the caller must treat as not found; the empty array returns 0 without entering the
loop.

---

← Prev: [07 · The when-stuck protocol](07-the-when-stuck-protocol.md) · Index: [Phase 0 — The DSA interview and the practice system](README.md) · Next → **The ladders** *(not written yet)*
