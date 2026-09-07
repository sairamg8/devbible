---
title: "Re-solve from a blank editor after three, seven and twenty-one days, and log why a problem was missed rather than that it was — the mistake log is the practice system, and the problem count is not"
sidebar_label: "06 · Spaced repetition and the log"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. The schedule and the log format are **method** — a common spaced-
> repetition cadence adapted to coding problems, not a quoted study; no retention figures are
> claimed. Builds on [03 · The method](03-the-method.md) (the match step is what is being
> rehearsed) and [05 · Reading the constraints](05-reading-the-constraints.md). **No sandbox run.**

**Solving three hundred problems once teaches you three hundred problems. Solving sixty
problems four times each, from a blank editor, on a schedule that lengthens as they stick,
teaches you the patterns — and the round tests patterns, not problems.** The system has two
parts. The first is spaced repetition: a problem solved today is re-solved from nothing after
three days, again after seven, again after twenty-one, and a problem that fails a repetition goes
back to the start. The second is the mistake log: a line per miss that records *why* — the
pattern not recognised, the invariant wrong, the off-by-one at a specific boundary, the built-in
whose cost was forgotten — rather than the problem's name. After a month the log shows which
*kind* of mistake repeats, and that is the thing to drill. Neither part is about volume. A
candidate with sixty problems and a read log beats one with three hundred and no log.

## The schedule

| When | What | If it fails |
|---|---|---|
| **Day 0** | solve it, with the full [45-minute shape](02-the-45-minute-shape.md); log any miss | — |
| **Day 3** | re-solve from a blank editor, no notes, timed | back to day 0: it is not learned |
| **Day 7** | again | back to day 3 |
| **Day 21** | again; a clean solve here retires the problem | back to day 7 |
| **Retired** | re-solve only when the pattern's other problems start failing | reopen at day 3 |

Three rules make it work. **A blank editor** — not reading the old solution, not "reviewing";
retrieval from nothing is the whole point. **Timed**, so that the repetition rehearses the clock
as well as the pattern. And **the intervals lengthen only on success**; a failure resets the
problem, because a problem that failed at day 7 was not learned at day 3.

The arithmetic of the load: a new problem costs four sessions over three weeks, so adding one
new problem a day settles at about four solves a day — two new, two repeats, then more repeats
than new. Adding three new a day produces a backlog of repeats within two weeks and the schedule
collapses; when repeats dominate, stop adding until they clear.

## The mistake log

The log is a text file, one line per miss, in a fixed shape. It records the *why*:

```text
2026-09-07 · longest-substring-without-repeats · sliding window
  MISS: moved `left` backwards on a repeat outside the window (`abba`)
  KIND: invariant not stated — "left never decreases" was never written down
  NEXT: state the invariant before coding on every window problem

2026-09-07 · top-k-frequent · heap / bucket
  MISS: reached for a heap in TypeScript, spent 6 min writing one
  KIND: language trap — no built-in heap; bucket sort was the intended TS answer
  NEXT: at the match step, check whether the pattern needs a structure TS lacks

2026-09-08 · course-schedule · topological sort
  MISS: did not recognise "prerequisites" as a dependency graph for 4 minutes
  KIND: pattern not matched — signal "ordering with dependencies" missed
  NEXT: add "prerequisites / must come before" to the signal list

2026-09-08 · merge-intervals · sort + sweep
  MISS: off-by-one on touching intervals — [1,3] and [3,5] should merge
  KIND: boundary — the "≤ vs <" at the join was never traced with a touching case
  NEXT: for every interval problem, trace the touching case explicitly
```

Illustrative entries, not a prescribed format. What matters is the three fields:

- **MISS** — what actually went wrong, specifically enough to be recognisable next time.
- **KIND** — the *category*: pattern not matched, invariant not stated, boundary, language trap,
  built-in cost forgotten, constraint not read, ran out of time. There are about seven kinds and
  that is the point — the kinds repeat even when the problems do not.
- **NEXT** — the one behaviour that prevents the kind, not the problem.

A log that records "got merge-intervals wrong" is a list of problems to redo. A log that records
"boundary — touching case never traced" is a list of *behaviours* to change, and the second list
is short.

## Reading the log

Once a week, count the KIND column. The count is the plan for the next week:

- **Pattern not matched** leading → the signal table in [03](03-the-method.md) is not yet
  reflexive; drill matching alone — read twenty problem statements and name the pattern for each
  in ten seconds, without solving any.
- **Invariant not stated** leading → the plan step is being skipped; for a week, refuse to type
  until the invariant is written in a comment.
- **Boundary** leading → the review step is too short; for a week, trace three cases per
  problem — the empty, the single, and the touching or equal case.
- **Language trap** leading → [04](04-language-choice-and-runtime-traps.md) again, and a
  rehearsed heap.
- **Constraint not read** leading → [05](05-reading-the-constraints.md); say the class aloud
  before matching.
- **Ran out of time** leading → the [45-minute shape](02-the-45-minute-shape.md) with a hard
  clock per box.

The log's KIND counts falling over a month is the only progress measure that matters. Problem
count rising is not one.

## Choosing what to repeat

Not every problem deserves four repetitions. The ones that do:

- **One canonical problem per pattern** — the cleanest instance of sliding window, of
  binary-search-on-the-answer, of topological sort. These are the spine of the schedule; retiring
  them means the pattern is yours.
- **Every problem that produced a log entry** — a miss is the signal that the problem has
  something to teach; a clean first solve of an easy problem often does not.
- **Problems whose follow-ups you could not answer** — repeat them with the follow-up as the
  target, per [01](01-what-the-coding-rounds-grade.md).

Problems solved cleanly on day 0 with no log entry and a known pattern can skip straight to a
single day-21 check. The schedule is for what is not yet learned.

## The practice session, assembled

A session that uses both parts, in about an hour:

1. **Repeats first** (20–30 minutes) — the problems due today, from a blank editor, timed.
   Log every miss; reset every failure.
2. **One new problem** (30–45 minutes) — the full shape, the pattern named, the follow-ups
   attempted. Log; schedule its day-3 repeat.
3. **Two minutes on the log** — read today's entries, write the NEXT for each.

Weekly: the KIND count, and the next week's focus. The [ladders](09-the-ladders.md) supply the problems in pattern order; this page supplies the cadence.

## Gotchas

**★ Symptom: three hundred problems solved, and an unfamiliar medium problem in the round
produced nothing.** Cause: each problem solved once; the patterns were recognised in hindsight,
never retrieved cold. Fix: repetitions from a blank editor on a lengthening schedule — sixty
problems four times beats three hundred once.

**★ Symptom: the log is a list of problem names.** Cause: recording *that* a problem was
missed rather than *why*. Fix: MISS, KIND, NEXT — the KIND column is what makes the log
actionable, because seven kinds repeat where three hundred problems do not.

**Symptom: "reviewing" a problem by reading the old solution.** Cause: recognition mistaken for
retrieval. Fix: a blank editor, every repetition; if you cannot start, that is a failed
repetition and the problem resets — which is the information you needed.

**Symptom: forty repeats due today.** Cause: too many new problems added per day; the schedule
compounds. Fix: one new problem a day settles at about four solves a day; when repeats dominate,
stop adding until they clear.

**Symptom: the day-7 repeat failed and was marked as a day-21 anyway.** Cause: the interval
advanced on a failure. Fix: a failure resets the problem to the previous interval; the schedule
only lengthens on success.

**Symptom: the log is written and never read.** Cause: no weekly step. Fix: count the KIND
column every week and set the next week's single focus from it; a log that is not read is a
diary.

**Symptom: easy problems repeated four times, hard ones once.** Cause: repeating by schedule
alone rather than by what is unlearned. Fix: clean, known-pattern solves skip to a single day-21
check; every problem with a log entry gets the full schedule.

## Interview questions

**★ How do you practise, and why that way rather than solving as many problems as possible?**
One new problem a day with the full method, re-solved from a blank editor after three, seven
and twenty-one days, a failure resetting the interval; and a mistake log that records why each
miss happened — pattern not matched, invariant not stated, boundary, language trap, constraint
not read, out of time — read weekly to set the next week's focus. Volume teaches problems; the
round tests patterns, and patterns are learned by retrieving them cold on a schedule and by
fixing the kind of mistake that repeats.

**★ What goes in a mistake log entry?**
The problem and pattern; what specifically went wrong, phrased so it is recognisable next time;
the kind of mistake it was, from a short fixed list; and the one behaviour that prevents that
kind. "Moved left backwards on a repeat outside the window; kind: invariant not stated; next:
write the invariant before coding on every window problem." The kind column is the useful one,
because kinds repeat and problems do not.

**Why a blank editor, and what counts as a failed repetition?**
Because recognition is not retrieval: reading an old solution and nodding proves nothing about
what you can produce under a clock. A repetition fails if you cannot produce a working solution
from nothing within the time box, including if you needed to look at notes to start; a failure
sends the problem back one interval, because a problem that fails at day 7 was not actually
learned at day 3.

**Which problems deserve the full repetition schedule?**
One canonical problem per pattern — the spine — plus every problem that produced a log entry,
plus any whose follow-ups you could not answer. A clean first solve of an easy, known-pattern
problem skips to a single check at three weeks. The schedule exists for what is not yet learned,
and the log says what that is.

**How do you know the practice is working?**
The kind counts in the log fall over a month — fewer "pattern not matched", fewer "boundary" —
and repetitions start passing at day 3 that used to fail. Problem count rising says nothing;
a candidate can raise it indefinitely without changing the kinds of mistakes they make.

---

← Prev: [05 · Reading the constraints](05-reading-the-constraints.md) · Index: [Phase 0 — The DSA interview and the practice system](README.md) · Next → [07 · The when-stuck protocol](07-the-when-stuck-protocol.md)
