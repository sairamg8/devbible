---
title: "Mock interviews only work when a peer grades you against the five lines, changes a constraint mid-round, and writes evidence — and when you record yourself, because thinking aloud is a trained habit, not a hope"
sidebar_label: "10 · Mock interviews"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07. Method, not a quoted standard; interview-format observations are
> tendencies. The lines graded are those in [01 · What the rounds grade](01-what-the-coding-rounds-grade.md);
> the log the feedback feeds is [06](06-spaced-repetition-and-the-mistake-log.md). The System
> Design track's [practice page](../../../system-design/pages/phase-0-the-interview/10-how-to-practise.md)
> is the same method for design rounds. **No sandbox run.**

**Solo practice builds the patterns; only a mock builds the behaviours the round grades under
another person's eyes — narrating while typing, taking a hint, re-deriving when the constraint
changes, and testing without being told to.** A mock that is a friendly conversation builds
none of them. The one that works has three properties: the peer holds the five-line rubric and
writes one line of evidence per line; the peer drops a hint and changes a constraint on purpose,
so the two graded behaviours most candidates never practise are exercised every session; and the
session is recorded, because the silences, the untested code and the ignored hint are invisible
from the inside and obvious from the outside. One mock a week, alternating roles, each one
post-mortemed into the log, is enough. Ten of them change how a candidate sounds.

## The interviewer's brief

Whoever plays the interviewer follows this, every time:

1. **Give a medium problem cold**, from the phase the candidate is currently climbing, with the
   constraints stated once and not repeated.
2. **Note the minute typing starts**, and whether the plan and the bound were said before it.
3. **Watch for the edge list** — was it named before coding? Count the cases.
4. **Drop one hint** if the candidate is stuck past thirty seconds, or at minute fifteen
   regardless: a nudge, not the answer ("what if it were sorted?"). Note whether it was taken
   immediately, deferred, or ignored.
5. **After a working solution, change a constraint**: sorted input, a stream, no extra memory,
   a million-deep tree, a hundred queries instead of one. Note how long the re-derivation took
   and whether the cost of the new approach was stated.
6. **Ask "what is the complexity?" only if it was not volunteered**, and note that it was not.
7. **Write one line of evidence per rubric line** — correctness (which cases were tested),
   complexity (stated when?), code quality (one specific observation), communication (longest
   silence, number of summaries), the hint (taken?) — and the level the answer landed at.

The brief is short because the graded behaviours are few. What makes it work is that every
line has to be *written*, which forces the interviewer to notice rather than to feel.

## The grading sheet

Illustrative, not any company's form; the value is that it is filled in during the round, not
reconstructed after:

```text
Problem · Phase · Date · Candidate · Interviewer

Typing started at minute ___   Plan said before typing?  yes / no   Bound stated?  yes / no
Edge cases named before coding: ___________________________   (count: __)
Hint given at minute ___ : "___________"   Taken: immediately / deferred / ignored
Constraint change: "___________"   Re-derived in ___ s   Cost of new approach stated?  yes / no
Complexity volunteered?  yes / asked
Tests: cases traced by hand: ___________________________   Bug found by own trace?  yes / no

Evidence, one line each:
  Correctness    ______________________________________________
  Complexity     ______________________________________________
  Code quality   ______________________________________________
  Communication  longest silence ___ s · summaries __ · ______
  Hint           ______________________________________________
Level this landed at:  SDE-2 / senior / staff      One thing to change: ____________________
```

The last field is the one that goes into the candidate's log as a NEXT.

## The candidate's side

Nothing new: the [45-minute shape](02-the-45-minute-shape.md) and the method, under
observation. Three things to do deliberately in a mock that solo practice does not exercise:

- **Narrate on purpose**, even when it feels stilted. The recording will show whether it
  became natural; it does after a few sessions.
- **Ask for the hint** using the [when-stuck form](07-the-when-stuck-protocol.md) — approach,
  bound, bottleneck, narrow question — so the peer can grade the ask, not just the stuck.
- **Test without being prompted.** The peer is instructed not to say "are you going to test
  it?"; the candidate has to reach the test box on their own, which is the habit.

## Recording, and what to watch for

Record every mock; watch one a week, with a pen, for timestamps rather than impressions:

- **minute typing started** — before the plan was said? (the impulsive-start failure)
- **every silence over twenty seconds** — was it announced arithmetic, or a stall?
- **the edge list** — said before coding, or discovered by the interviewer?
- **the hint** — how long between the hint and the code changing?
- **the constraint change** — how long between the change and the first sentence of the
  re-derivation? Was the cost of the new approach said?
- **the test box** — did it happen? Which case was traced?
- **the complexity** — volunteered, or asked?

Each timestamp maps to a rubric line and therefore to a KIND in the log. A recording watched
this way produces two or three log entries; watched for overall impression it produces a
feeling.

## Alternating roles

Playing the interviewer is half the value of the hour. After grading three or four peers
against the sheet, the blank lines become visible in your own rounds *while they are
happening* — you notice the silence, the unstated bound, the deferred hint — because you have
written them down about someone else. Alternate strictly; a pair in which one person always
interviews has one person learning half as fast.

## The solo mock

When no peer is available, a solo mock still exercises most of the behaviours, if it is run
honestly: a timer, a problem chosen at random from the current phase, speaking aloud to an empty
room, a recording, and the constraint change written on a card *before* starting and turned
over after the solution works. It cannot grade the hint, and it grades the narration less
honestly. It is a substitute for a mock, not for solo drills — the drills are for patterns, the
mock is for behaviour, and the solo mock is a weaker version of the second.

## Cadence

One mock a week, alternating roles, each post-mortemed within the hour into the
[log](06-spaced-repetition-and-the-mistake-log.md) as one or two KIND entries and a NEXT. In the
last two weeks before a loop, two a week, on the phases the log names weak and on the patterns
the target company tends to favour. Ten graded, recorded, post-mortemed mocks is the point at
which most candidates' recordings stop showing the silences; that is the signal, not a count.

## Gotchas

**★ Symptom: a dozen mocks with a friend that all "went well."** Cause: no rubric, no written
evidence, no hint, no constraint change — a conversation about a problem. Fix: the interviewer's
brief and the sheet, every time; the hint and the constraint change are non-negotiable because
they are the two graded behaviours solo practice never exercises.

**★ Symptom: solid patterns in drills, and silence for a minute in the mock.** Cause: thinking
aloud never practised under observation. Fix: narrate on purpose in every mock and watch the
recording for silences over twenty seconds; it becomes natural after a handful of sessions.

**Symptom: the peer asked "are you going to test it?"** Cause: the interviewer prompting the
test box. Fix: the brief forbids it; the candidate has to reach the test box alone, and a mock in
which they did not is a log entry, not a rescue.

**Symptom: the feedback was "good job, maybe faster."** Cause: impressions instead of evidence.
Fix: one line per rubric line, written during the round; the "one thing to change" field is the
only feedback the candidate needs.

**Symptom: the recording never watched.** Cause: discomfort. Fix: watch with the timestamp
checklist and a pen, skipping everything that is not on it; ten minutes, two log entries, done.

**Symptom: one person always interviews.** Cause: convenience. Fix: alternate strictly; the
interviewer's chair is where the blank lines become visible in your own rounds.

**Symptom: mocks every day in the last week, and a tired, flat real round.** Cause: cadence
mistaken for intensity. Fix: two a week in the last fortnight, none the day before; the last
day is for the log, not for new problems.

## Interview questions

**★ What makes a mock interview useful rather than a conversation?**
A peer holding the five-line rubric who writes one line of evidence per line during the round;
a deliberate hint if the candidate is stuck past thirty seconds or at minute fifteen; a
deliberate constraint change after a working solution, with the re-derivation timed and the cost
of the new approach noted; no prompting to test; and a recording watched afterwards for
timestamps — typing start, silences, the hint's uptake, the test box. Alternating roles doubles
the value, because grading someone else makes the blank lines visible in your own rounds.

**How do you get value out of a recording of yourself?**
Watch it with a checklist and a pen, for timestamps rather than impressions: when typing started
and whether the plan preceded it; every silence over twenty seconds and whether it was announced
arithmetic; whether the edge list was named before coding; how long between the hint and the
code changing; how long between the constraint change and the first sentence of the
re-derivation; whether the test box happened and which case was traced; whether complexity was
volunteered. Each timestamp is a rubric line and therefore a log entry with a NEXT.

**Why should the interviewer never ask "are you going to test it?"**
Because reaching the test box unprompted is the habit being trained, and the prompt trains the
opposite — waiting to be told. A mock in which the candidate did not test is more useful than
one in which they were reminded: it produces a log entry with a specific NEXT, and the next mock
shows whether the habit formed.

**What can a solo mock do, and what can it not?**
With a timer, a random problem, speaking aloud, a recording and a constraint change written on a
card in advance, it exercises the shape, the narration and the re-derivation. It cannot grade the
hint — there is no one to give it — and it grades narration less honestly, because an empty room
does not notice silence. It is a weaker substitute for a peer mock, not for solo drills, which
train patterns rather than behaviour.

---

← Prev: [09 · The ladders](09-the-ladders.md) · Index: [Phase 0 — The DSA interview and the practice system](README.md) · Next → [11 · Communication mechanics](11-communication-mechanics.md)
