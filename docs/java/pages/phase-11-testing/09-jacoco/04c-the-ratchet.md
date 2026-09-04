---
title: "The ratchet: a floor that only ever moves up sounds like the obvious way to improve coverage over time, and the automated version of it fails in three specific ways that are worth knowing before you build one"
sidebar_label: "04c · The ratchet"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 against **JaCoCo 0.8.15**'s `check-mojo.html` for the rule and limit
> structure and the `value` types, and `doc/counters.html` for what each counter measures.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> JUnit Jupiter 6.0.3.
> ⚠️ **No build and no test runs on this machine** — configuration and documented behaviour
> only. No percentage on this page comes from a run.

**Once a team has a floor ([chunk 04a](04a-floor-or-target.md)), the next idea is always the
same: have the build raise the floor whenever coverage goes up, so the number can never fall
back. It is an appealing idea, several tools implement it, and it has three failure modes that
are structural rather than accidental. This chunk is about deciding whether to build one, and
what to build instead if not.**

## The idea

Store the current coverage as a number in the repository. After each build, if the measured
coverage exceeds the stored number, write the new one back and commit it. The threshold therefore
tracks the high-water mark and coverage becomes monotonic.

```
coverage-floor.txt:  0.7124
```

The rule reads the stored value; a post-build step updates it. There are plugins that do this,
and hand-rolled versions are common — a shell script and a `sed` are enough.

## Failure 1 · The floor ratchets on noise

Coverage is not perfectly deterministic across builds, and several ordinary things move it by
fractions of a point without anyone changing a test:

- **A flaky test that passes today and is skipped tomorrow** takes its covered lines with it.
- **Parallel execution** can change whether a class is loaded at all in a given run, and a class
  that is never loaded reports 0% — see [chunk 01b](01b-how-jacoco-works.md).
- **A timing-dependent branch** — a retry that fired once, a cache that happened to be cold —
  covers a path on some runs and not others.
- **`append=true` and a dirty workspace** can fold in stale execution data
  ([chunk 02d](02d-integration-tests-and-failsafe.md)).

Each of these can push the measured number up by a tenth of a point. The ratchet records it
permanently. Now the floor is above the level the codebase can reliably reproduce, and **the next
honest build fails**. The team's experience is a red build on a pull request that touched nothing
related, which is the single fastest way to teach everyone that the coverage gate is noise to be
worked around.

**The mitigation** is a tolerance band — only ratchet when the increase exceeds, say, a full
point, and never ratchet down. That helps, and it does not eliminate the problem; it converts a
frequent small failure into an occasional larger one.

## Failure 2 · It ratchets on deletions

Deleting untested code raises coverage. So does deleting a whole untested module, removing a
dead feature, or moving code out to another repository. All of these are good changes, and all of
them ratchet the floor upward for reasons that have nothing to do with testing.

The consequence arrives later: the next time somebody adds a genuinely new, partially-tested
feature, the floor is at a level that was reached by subtraction rather than by testing, and it
cannot be met by any reasonable amount of new test writing. The usual resolution is to override
the floor manually, at which point the ratchet has stopped being automatic and has become a
ritual with an override step.

**This is the failure that has no good mitigation**, because from the tool's perspective a
deletion and a test are indistinguishable — both raise the ratio.

## Failure 3 · It measures the wrong thing to begin with

A ratcheting floor on a **repository-wide ratio** encodes the assumption that the number should
go up. But a codebase that is growing healthily adds code faster than it adds tests for the parts
that do not need them — configuration, adapters, generated mappers, DTOs. A flat or slowly
declining ratio can be entirely consistent with a suite that is improving where it matters.

Ratcheting a whole-repository ratio therefore fights the codebase's natural drift, and it does it
with the crudest possible instrument. Every point it wins costs somebody a decision about which
of the five patterns in [chunk 04b](04b-the-eighty-percent-ritual.md) is cheapest today.

## What to do instead

Three things, in order of value.

### 1 · Coverage on the change, not on the repository

The question "did the code in this pull request get tested" is answerable, actionable and
noise-free in a way the repository ratio is not. It does not ratchet, it does not need a stored
number, it does not care about deletions, and it points at specific lines in the diff.
[Chunk 07b](07b-coverage-in-ci.md) is about wiring it.

### 2 · A `MISSEDCOUNT` budget per class, ratcheted by hand

If you want a number that only goes down, use an absolute one:

```xml
<rule>
  <element>CLASS</element>
  <includes><include>com.example.pricing.*</include></includes>
  <limits>
    <limit>
      <counter>BRANCH</counter>
      <value>MISSEDCOUNT</value>
      <maximum>12</maximum>
    </limit>
  </limits>
</rule>
```

"No pricing class may have more than 12 uncovered branches." This is immune to failure 2 —
deleting code cannot make the count worse, and cannot spuriously tighten it either — and largely
immune to failure 1, because a tenth-of-a-point wobble is not a whole branch. Lowering the number
is a deliberate one-line pull request with a human attached, which is a feature: it makes the
tightening a decision rather than an accident.

### 3 · A floor, left alone

The unglamorous option, and often the right one. Set the floor at today's number, do not automate
anything, and revisit it when there is a reason. A floor that never moves still catches the
regression it exists to catch, and it costs nothing to maintain.

## If you build one anyway

Sometimes the ratchet is a requirement rather than a choice. The version that causes the least
harm:

- **Ratchet on a lagging window**, not on the last build — the minimum of the last N builds, so a
  single lucky run cannot set the floor.
- **Require a margin** — only raise when the increase exceeds a full point.
- **Never ratchet on a build that deleted code.** If the diff removes more source lines than it
  adds, skip the update.
- **Ratchet branch coverage, not line or instruction**, because it is the least sensitive to the
  branchless code that comes and goes.
- **Make the override loud and cheap.** There will be legitimate reasons to lower it, and if
  lowering requires an argument with a bot, people will exclude a package instead.
- **Commit the number in a file with a changelog**, so the history of the gate is readable. A
  threshold whose history is a hundred automated commits is a threshold nobody can reason about.

## Where this connects

- **[04 · Thresholds](04-thresholds.md)** — the rule syntax, and `MISSEDCOUNT` in particular.
- **[04a · Floor or target](04a-floor-or-target.md)** — the distinction this chunk builds on.
- **[04b · The eighty percent ritual](04b-the-eighty-percent-ritual.md)** — what pressure from a
  ratchet buys you.
- **[07b · Coverage in CI](07b-coverage-in-ci.md)** — per-change coverage, the better instrument.
- **[01b · How JaCoCo works](01b-how-jacoco-works.md)** — why a class can report 0% on one run and
  not another, which is the mechanism behind failure 1.

## Gotchas

**★ A ratchet records a lucky build permanently.**
Coverage varies slightly between runs — a skipped flaky test, a class not loaded under a
particular parallel schedule, a retry that happened to fire. The ratchet cannot tell a real
improvement from a favourable run, so it locks in the maximum of the noise, and the next honest
build fails on a pull request that changed nothing relevant.

**★ Deleting dead code ratchets the floor, and the bill arrives months later.**
Removing an untested module raises the ratio without a test being written. The floor rises. The
next feature that legitimately lands at lower coverage cannot meet it, and the ratchet has to be
overridden — which means it was never automatic. There is no mitigation for this, because a
deletion and a test look identical to the metric.

**★ A ratcheted repository-wide ratio fights healthy growth.**
Codebases accumulate configuration, adapters and generated code faster than they accumulate
behaviour worth testing. A flat ratio can be consistent with an improving suite. Forcing the ratio
upward pressures people toward whichever gaming pattern is cheapest that week.

**★ A tolerance band converts frequent small failures into occasional larger ones.**
It is the right mitigation for noise and it is not a fix. Requiring a full point of improvement
before ratcheting means the floor moves less often, so when it does move on noise it is further
above what the codebase can reproduce.

**★ Ratcheting line or instruction coverage is more fragile than ratcheting branches.**
Line and instruction counts move when branchless code is added or removed, and when the code is
reformatted ([chunk 03c](03c-line-coverage-needs-debug-info.md)). Branch counts are less sensitive
to all three, so if you must ratchet, ratchet the counter that reflects decisions.

**★ A gate whose history is a hundred bot commits cannot be reasoned about.**
When someone asks "why is our threshold 78.4%", the answer should be a decision, not an accident
of build 4,412. Storing the number in a file with a human-readable rationale per change is what
makes the gate auditable.

**★ If overriding the ratchet is hard, people will exclude a package instead.**
Every gate creates a pressure valve, and the valve people choose is whichever is cheapest. Making
the override a difficult conversation does not remove the need to lower the bar; it redirects it
to the exclusion list, where it is far less visible. [Chunk 05](05-exclusions.md).

**★ Per-class `MISSEDCOUNT` is the ratchet that actually works, and it is not automated.**
An absolute budget cannot be spuriously tightened by deletion, is not moved by fractional noise,
and translates into a concrete list of uncovered branches. Lowering it is a deliberate one-line
change by a person — which is the property that makes it hold.

## Interview questions

**★ Your team wants the build to automatically raise the coverage threshold whenever coverage improves. What do you tell them?**
That it will lock in noise and it will ratchet on deletions. Coverage varies slightly between runs
— a skipped flaky test, a class not loaded under a given parallel schedule — so the ratchet records
the best run rather than the reproducible level, and the next honest build fails on an unrelated
change. And deleting untested code raises the ratio without a test being written, so the floor
rises for a reason that cannot be met later by testing. I would offer per-change coverage on pull
requests instead, or an absolute `MISSEDCOUNT` budget per class, which cannot be spuriously
tightened.

**★ Why is a `MISSEDCOUNT` budget more robust than a ratcheted ratio?**
Because it is an absolute count of uncovered branches rather than a proportion, so it does not move
when the codebase grows or shrinks. Deleting code cannot tighten it; adding well-covered code
cannot loosen it; and a fractional wobble between runs is not a whole branch, so it is not sensitive
to the noise that defeats a ratchet. It also translates directly into work — "these twelve
decisions are untested" — rather than into a percentage nobody can act on.

**★ What kinds of change move coverage without anyone writing or deleting a test?**
Deleting untested code raises it. Adding configuration, DTOs or generated code lowers it. A code
formatter can move line coverage by changing how many lines a compound condition occupies. A JaCoCo
upgrade can move it by adding a filter — several were added across 0.8.x. A flaky test being
skipped removes its covered lines. And a class that fails to load in a particular run reports 0%.
Any automated gate that assumes movement implies intent will misfire on all of these.

**★ If you had to build a ratchet, what would you do to make it least harmful?**
Ratchet on the minimum of a window of recent builds rather than the last one, so a single lucky run
cannot set the floor; require a margin of a full point before raising; skip the update entirely on
any build whose diff removes more source than it adds; ratchet branch coverage rather than line or
instruction; store the number in a committed file with a rationale per change so the history is
readable; and make lowering it easy and loud, because otherwise the pressure goes to the exclusion
list where nobody sees it.

{/* FOOTER */}
