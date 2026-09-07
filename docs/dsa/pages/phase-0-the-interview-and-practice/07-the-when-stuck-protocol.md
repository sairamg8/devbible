---
title: "When stuck: restate the problem, shrink the example, say the brute force out loud, name the bottleneck, and ask for a hint before the silence grows — five moves, in order, each of which usually unsticks you"
sidebar_label: "07 · The when-stuck protocol"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Method, not a quoted standard; interview-format observations are
> tendencies. Builds on [03 · The method](03-the-method.md) (the match and plan steps are where
> stuck happens) and [01 · What the rounds grade](01-what-the-coding-rounds-grade.md) (the hint is
> a graded line). Code is TypeScript targeting Node 24 (LTS), written to be runnable; **nothing
> was run**.

**Being stuck is not the failure. Being silently stuck is.** From the interviewer's side, thirty
seconds of silence is indistinguishable from a candidate who has nothing, and a minute of it
starts filling the communication line with the wrong evidence. The protocol is five moves that
are each *audible* and each *productive*: restate the problem in your own words (which catches
the misread that is often the whole problem); shrink the example to two or three elements and
solve that by hand (which usually exposes the pattern); say the brute force aloud with its bound
(which turns "I have nothing" into "I have something slow"); name the bottleneck of the brute
force (which is one sentence from the optimisation); and ask for a hint — before the silence
grows, in a form that shows where you are. Most stuck moments end at move two or three. The
ones that reach move five are graded well if move five was reached out loud.

## The five moves

| Move | Say | What it usually reveals |
|---|---|---|
| **1 · Restate** | "Let me make sure I have it: given …, return …, where …" | a misread — the problem asks for a length, not a substring; indices, not values; *any* pair, not *all* pairs |
| **2 · Shrink** | "Let me try it on `[2, 1, 3]` by hand" | the pattern — three elements are enough to see what a solution has to track |
| **3 · Brute force aloud** | "The obvious way is every pair, O(n²), too slow at 10⁵" | that you have a baseline, and the class the answer needs |
| **4 · Name the bottleneck** | "The expensive part is recomputing the maximum on the left for every index" | the optimisation — the bottleneck names the redundant work, and the pattern removes it |
| **5 · Ask for a hint** | "I'm at O(n²) because of the repeated left-max; is there a way to avoid recomputing it, or should I look elsewhere?" | the interviewer's nudge, and evidence that you know exactly where you are |

The order matters because each move is cheaper than the next and each one produces something
to say. Skipping to move five without moves three and four produces a vague "I'm stuck", which
gets a vague hint; arriving at move five with the bottleneck named gets a precise one.

## A worked stuck: trapping rain water

"Given an elevation map as an array of heights, compute how much water it traps." A problem
where the first minute of stuck is normal.

**Restate.** "For each position, water can sit on it up to the height of the lower of the tallest
bar to its left and the tallest to its right, minus its own height — and the total is the sum of
those." *That restatement is most of the solution; a candidate who says it aloud has found the
per-index formula without noticing.*

**Shrink.** `[2, 0, 2]`: the middle cell has a 2 on each side, height 0, so it holds 2. `[3, 0,
1, 0, 3]`: the cells hold 3, 2, 3 → 8. *Two examples confirm the formula and expose the
"lower of the two maxima" rule.*

**Brute force aloud.** "For each index, scan left for the maximum, scan right for the maximum,
take the minimum, subtract the height. O(n²)." *A working solution — correct, slow.*

**Name the bottleneck.** "The scans recompute the same maxima for every index. If I knew the
left maximum for each index and the right maximum for each index in advance, each cell is O(1)."
*The bottleneck named the redundant work, and the fix is two prefix arrays — O(n) time, O(n)
space:*

```ts
export function trap(height: readonly number[]): number {
  const n = height.length;
  if (n < 3) return 0;
  const leftMax = new Array<number>(n);
  const rightMax = new Array<number>(n);
  leftMax[0] = height[0];
  for (let i = 1; i < n; i++) leftMax[i] = Math.max(leftMax[i - 1], height[i]);
  rightMax[n - 1] = height[n - 1];
  for (let i = n - 2; i >= 0; i--) rightMax[i] = Math.max(rightMax[i + 1], height[i]);
  let water = 0;
  for (let i = 0; i < n; i++) water += Math.min(leftMax[i], rightMax[i]) - height[i];
  return water;
}
```

**The hint, if it came.** "Can you do it in O(1) space?" — the follow-up rather than a rescue.
The bottleneck is now the two arrays; the observation that unsticks it is that at any moment the
side with the smaller maximum is the one whose water is determined:

```ts
export function trapTwoPointers(height: readonly number[]): number {
  let left = 0, right = height.length - 1;
  let leftMax = 0, rightMax = 0, water = 0;
  while (left < right) {
    if (height[left] < height[right]) {
      // the left cell's water is bounded by leftMax, because some bar on the right is taller
      leftMax = Math.max(leftMax, height[left]);
      water += leftMax - height[left];
      left++;
    } else {
      rightMax = Math.max(rightMax, height[right]);
      water += rightMax - height[right];
      right--;
    }
  }
  return water;
}
```

Every step from "stuck" to O(n) with O(1) space was a sentence said aloud, and each sentence
was gradable. That is the protocol working.

## Asking for the hint

The ask has a shape, and the shape is what makes it cheap:

- **Say where you are**: the approach, its bound, and the bottleneck. "I have O(n²) from the
  repeated scans."
- **Say what you are considering**: "I think prefix maxima remove that, but I'm not sure it
  handles the boundary."
- **Ask a narrow question**: "Am I on the right track, or is there a different angle?"

An interviewer answering that ask can nudge precisely ("prefix maxima, yes — and think about
what happens at the ends") and has just heard three sentences of evidence. A bare "I'm stuck,
can you help?" gets a generic hint and records nothing.

When to ask: after moves one to four have been tried aloud and the silence is about to pass
thirty seconds. Not at minute two; not at minute thirty either — by then the ask should have
happened at minute fifteen. Interviewers tend to prefer a hint at fifteen minutes and a solution
at forty to no hint and no solution.

## After the hint

Take it immediately and visibly ([01](01-what-the-coding-rounds-grade.md)): say what it changes
and continue from there. "Prefix maxima — so two passes to build them, then one pass to sum. Let
me write that." If the hint points somewhere you do not understand, say that too, and ask one
clarifying question; pretending to understand a hint and then not using it is the worst
outcome, because it wastes the hint and reveals the pretence.

## The other two kinds of stuck

The protocol above is for *stuck at the approach*. Two other kinds have their own moves:

**Stuck at a bug.** The code is written, the trace fails, and you cannot see why. Moves: shrink
the failing case to the smallest input that still fails; write the invariant above the loop and
check it at each iteration of the trace; check every boundary — first index, last index, empty,
one element — because that is where most bugs live; and say what you are checking, so the
interviewer can point rather than watch.

**Stuck at the optimisation.** The brute force works and you cannot see the improvement. Moves:
name the work the brute force repeats (a scan, a recomputation, a re-sort) — that is the
bottleneck; ask what structure would make the repeated work O(1) or O(log n) (a prefix array, a
map, a heap, a sorted structure); and check the constraints for the class you need, because
"O(n log n) is enough" changes which structure to reach for.

## Gotchas

**★ Symptom: a minute of silence, and the interviewer's "what are you thinking?"** Cause: the
protocol not started; thinking happened silently. Fix: move one — restate — the moment you feel
stuck; it is audible, it costs nothing, and it often is the fix.

**★ Symptom: "I'm stuck, can you help?" and a hint that did not help.** Cause: a vague ask gets
a vague hint. Fix: say the approach, its bound and the bottleneck, then ask a narrow question;
the precise ask gets the precise nudge and records evidence.

**Symptom: the brute force was never said, so there was nothing to optimise.** Cause: skipping
move three to look for the clever solution directly. Fix: say the slow solution and its bound —
it is the baseline, and its bottleneck is the pattern.

**Symptom: the hint was taken and then abandoned.** Cause: pretending to understand a hint.
Fix: if the hint is not clear, ask one clarifying question; using a hint you did not understand
is worse than asking about it.

**Symptom: stuck on a bug for ten minutes, checking the middle of the loop.** Cause: bugs live at
boundaries and the middle was where you looked. Fix: the smallest failing input, the invariant
checked per iteration, and the first, last, empty and single cases before anything else.

**Symptom: a working brute force and no idea how to improve it.** Cause: the redundant work
not named. Fix: say what the brute force repeats; the structure that makes that repetition
cheap is the optimisation, and the constraints say which class it must reach.

**Symptom: a hint asked for at minute three.** Cause: the protocol skipped to move five. Fix:
moves one to four first — each is thirty seconds — and the ask when the silence is about to pass
thirty seconds, not before the thinking has been done aloud.

## Interview questions

**★ What do you do when you are stuck on a problem in an interview?**
Five moves, aloud and in order: restate the problem in my own words, which catches a misread;
shrink the example to two or three elements and solve it by hand, which usually shows the
pattern; say the brute force with its bound, which gives a baseline and the class the answer
needs; name the bottleneck of the brute force, which is one sentence from the optimisation; and
ask for a hint in a form that says where I am — approach, bound, bottleneck, and a narrow
question. Most stuck moments end at move two or three; the ones that reach move five are graded
well if they were reached aloud.

**★ How do you ask for a hint well?**
State the approach and its bound, name the bottleneck, say what you are considering, and ask a
narrow question — "I'm at O(n²) from recomputing the left maximum per index; I think prefix
maxima fix it but I'm unsure about the ends; is that the right direction?" The interviewer can
then nudge precisely, and has heard three sentences of evidence. Ask after the first four moves
have been tried aloud and before the silence passes thirty seconds; a hint at fifteen minutes
with a solution at forty beats no hint and no solution.

**Why say the brute force when you know it is too slow?**
Because it is a correct baseline, its bound against the constraints says what class you need,
and its bottleneck — the work it repeats — is the pattern. "Every pair, O(n²), the inner loop
searches for a complement" is one sentence from a hash map. Candidates who skip it are trying to
find the optimisation from the problem statement, which is much harder than finding it from the
repeated work.

**Walk through getting unstuck on trapping rain water.**
Restate: each cell holds the lower of the tallest bar on its left and its right, minus its
height. Shrink: `[2, 0, 2]` holds 2; `[3, 0, 1, 0, 3]` holds 8. Brute force: scan left and right
per index, O(n²). Bottleneck: the scans recompute the same maxima. Fix: prefix maxima from each
side, O(n) time and space. Follow-up to O(1) space: two pointers, moving the side with the
smaller maximum because that side's water is already determined.

**What changes when you are stuck on a bug rather than on the approach?**
The moves become: shrink to the smallest failing input; write the invariant above the loop and
check it at each step of the trace; check the boundaries first — first and last index, empty,
single element — because that is where most bugs are; and say what you are checking so the
interviewer can point. Staring at the middle of the loop in silence is the failure mode.

---

← Prev: [06 · Spaced repetition and the log](06-spaced-repetition-and-the-mistake-log.md) · Index: [Phase 0 — The DSA interview and the practice system](README.md) · Next → **Testing your own code live** *(not written yet)*
