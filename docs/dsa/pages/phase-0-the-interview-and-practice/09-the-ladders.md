---
title: "The ladders — a 75-problem core, a 150-problem set, and the longer structured sheets — are lists of the same patterns at different depths, and the order you climb them in matters more than how many rungs you touch"
sidebar_label: "09 · The ladders"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07. The ladders are named as the community names them; **their current
> contents and counts were not fetched or verified here**, and no claim is made about which
> problems any particular list contains today. The mapping to this track's phases is by
> pattern, which is stable even as the lists change. Builds on
> [06 · Spaced repetition and the mistake log](06-spaced-repetition-and-the-mistake-log.md).
> **No sandbox run.**

**Every popular problem list is the same twenty patterns sampled at a different depth. The
75-problem core samples each pattern two or three times; the 150-problem set samples it five or
six; the long structured sheets — several hundred problems — sample it a dozen times with the
easy rungs included.** That is why the order matters more than the count: a list climbed in
pattern order, with the repetition schedule, teaches the patterns; the same list climbed in the
order it happens to be published, once through, teaches a set of problems. This track's phases
*are* the pattern order — foundations, arrays and hashing, two pointers and windows, strings,
stacks and queues, linked lists, binary search, trees, heaps, tries, graphs, backtracking, greedy,
dynamic programming — and the ladders are the problem supply for each. Use a list as the supply
for the phase you are in, not as a syllabus of its own.

## The three depths

| Ladder | Depth per pattern | Best for | The cost |
|---|---|---|---|
| **The 75-problem core** (commonly "Blind 75") | two or three canonical problems per pattern | a first pass that establishes every pattern; the spine of the repetition schedule | thin — a pattern seen three times is recognised, not yet reflexive |
| **The 150-problem set** (commonly "NeetCode 150", which extends the core) | five or six per pattern, with the standard follow-ups | the main body of preparation; enough repetition per pattern to make matching reflexive | six to ten weeks at one new problem a day |
| **The long structured sheets** (several hundred problems, ordered by topic) | a dozen or more per pattern, easy rungs included | filling a specific weak pattern the log has named; candidates starting from little | too long to climb whole beside a job; use by topic, never front to back |

The counts are the lists' names, not measurements; the lists change, and the right way to think
about them is by depth per pattern, not by total.

## The map from ladder to phase

Whatever list you use, sort its problems into this track's phases and climb in phase order. The
mapping is by pattern, and the patterns are what the match step in [03](03-the-method.md) names:

| This track's phase | Patterns the ladder's problems fall under |
|---|---|
| **Phase 3** — arrays, hashing, prefix sums | frequency counting, two-sum family, prefix sums, Kadane, intervals, matrix walks |
| **Phase 4** — two pointers, sliding window | opposite and same-direction pointers, fixed and variable windows, the "at most k" trick |
| **Phase 5** — strings | palindromes, anagram grouping, matching, parsing with a stack |
| **Phase 6** — stacks, queues, monotonic | bracket matching, min-stack, next greater, histogram |
| **Phase 7** — linked lists | reversal, fast and slow, merge, reorder, LRU |
| **Phase 8** — binary search | the template, rotated arrays, search on the answer, median of two |
| **Phase 9** — trees and BSTs | traversals, depth and diameter, LCA, serialise, validate |
| **Phase 10** — heaps | top-k, merge-k, two heaps, scheduling |
| **Phase 11** — tries, segment and Fenwick trees | prefix search, word search II, range queries |
| **Phases 12–13** — graphs | BFS and DFS, components, topological sort, union-find, Dijkstra, MST |
| **Phase 14** — backtracking | subsets, permutations, combination sum, N-Queens, word search |
| **Phase 15** — greedy | intervals, jump game, gas station, partition labels |
| **Phase 16** — dynamic programming | 1D, grids, knapsack, strings, intervals, stocks, trees, bitmask |
| **Phase 17** — design-flavoured | LRU, LFU, min-stack, time-based store, iterators |

A problem that fits two phases (an interval problem solved by sorting and a heap) goes in the
earlier one on the first climb and is revisited from the later one — that revisit is a scheduled
repetition, not extra work.

## Climbing: the schedule applied

The ladder supplies; the [repetition schedule](06-spaced-repetition-and-the-mistake-log.md)
paces. Concretely:

1. **Sort the list by phase** once, before starting. Twenty minutes with a spreadsheet.
2. **Climb one phase at a time**, one new problem a day, in the phase's order (the canonical
   problem first, the follow-ups after).
3. **Retire a phase** when its canonical problems pass the day-21 repetition and the log shows
   no "pattern not matched" entries for it in two weeks — not when its problems are all done.
4. **Move to the next phase** while the previous one's repetitions continue in the background.
5. **Return to a phase** when the log names it; the long sheets are for exactly that.

At one new problem a day, the 75-core is a first pass in about eleven weeks *including* its
repetitions, which is why it is the spine and not the whole plan; the 150-set is the body; the
long sheets are the supply for the phases that need more.

## What the ladders do not give you

Three things no list contains, and the round grades all three:

- **The follow-ups.** A list has the problem; the senior test is the changed constraint after
  the problem is solved ([01](01-what-the-coding-rounds-grade.md)). For each canonical problem,
  write the three follow-ups yourself before retiring it.
- **The method.** A list does not tell you to state the brute force, name the invariant, or
  trace the edge case. The [45-minute shape](02-the-45-minute-shape.md) and
  [the method](03-the-method.md) do; the list is what you apply them to.
- **The stopping rule.** A list invites completion; the round rewards patterns. When every
  pattern's canonical problems are retired and the log's kind counts are flat, the list is
  finished whether or not every rung was touched.

## Company-tagged lists

Lists filtered by company are widely shared, and the honest statement about them is a tendency:
companies tend to draw from the same pattern pool, so a company-tagged list is the general list
with a different sample. They are useful in the last two weeks before a specific loop as a
supply of timed drills, and not useful as a syllabus — a pattern learned from a tagged list is
the same pattern. Treat the tag as a hint about *which* patterns the company favours, verify it
against recent accounts if you can, and climb in phase order regardless.

## Gotchas

**★ Symptom: the 150-set finished front to back, and an unfamiliar problem in the round matched
nothing.** Cause: the list climbed in publication order, once, so patterns were met scattered
and never retrieved cold. Fix: sort by phase, climb one phase at a time with the repetition
schedule, retire a phase on the log's evidence rather than on completion.

**Symptom: a three-hundred-problem sheet started front to back beside a full-time job.** Cause:
the depth mistaken for a plan. Fix: the long sheets are a supply for phases the log names weak;
the 75-core is the spine and the 150-set the body.

**Symptom: every problem on the list solved once, kind counts in the log unchanged.** Cause: no
repetition; the list treated as a checklist. Fix: one canonical problem per pattern on the full
schedule; a list is finished when the patterns are retired, not when the boxes are ticked.

**Symptom: the follow-ups in the round were new, though every problem was familiar.** Cause:
lists contain problems, not constraint changes. Fix: three follow-ups written per canonical
problem before it is retired — sorted input, stream, no extra memory, deep recursion.

**Symptom: two weeks on a company-tagged list, and the loop asked general patterns.** Cause: the
tag treated as a syllabus. Fix: tagged lists are a drill supply for the last fortnight; the
pattern order is the syllabus.

**Symptom: a problem that belongs to two phases done twice, counted as two.** Cause: the
mapping applied once. Fix: the second visit is a scheduled repetition from the later phase's
angle — a heap solution to an interval problem first solved by sorting — and is logged as such.

## Interview questions

**★ How do you use a problem list, and why does the order matter more than the count?**
Sort it by pattern into this track's phase order, climb one phase at a time with one new problem
a day, and pace it with the repetition schedule — re-solving from a blank editor at three, seven
and twenty-one days. A phase is retired when its canonical problems pass the long repetition and
the log shows no pattern-not-matched entries for it, not when its problems are all done. Order
matters because the round grades patterns and a list climbed in publication order meets each
pattern scattered and once; count matters little because twenty patterns sampled three times
each, retrieved cold, beats three hundred problems seen once.

**What is the difference between the 75-problem core, the 150-set and the long sheets?**
Depth per pattern: two or three problems each in the core, five or six in the 150-set, a dozen
or more with easy rungs in the long sheets. The core is the spine of the repetition schedule,
the 150-set is the main body of preparation, and the long sheets are a supply for the specific
phases the mistake log names weak — used by topic, never front to back. The counts are the lists'
names rather than verified facts, and the lists change; the depth-per-pattern view is what
stays true.

**What does a list not give you?**
The follow-ups — the changed constraints after a solution, which are the senior test; the
method — brute force stated, invariant named, edge case traced; and the stopping rule — a list
invites completion while the round rewards retired patterns. Each is supplied elsewhere: three
follow-ups written per canonical problem, the 45-minute shape and the method applied to every
problem, and the log's kind counts as the signal to stop.

**How should you treat company-tagged problem lists?**
As a tendency and a drill supply: companies tend to draw from the same pattern pool, so a tagged
list is the general list resampled, and it is useful in the last two weeks before a specific
loop as timed practice. It is not a syllabus; a pattern learned from a tagged list is the same
pattern, and the phase order is what to climb regardless of the tag.

---

← Prev: [08 · Testing your code live](08-testing-your-own-code-live.md) · Index: [Phase 0 — The DSA interview and the practice system](README.md) · Next → **Mock interviews** *(not written yet)*
