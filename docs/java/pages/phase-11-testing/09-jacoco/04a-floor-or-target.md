---
title: "Floor or target: the same threshold syntax encodes two opposite policies, one of which costs nothing and catches real regressions while the other reliably buys you assertion-free tests and a growing exclusion list — and most teams never notice they picked the second"
sidebar_label: "04a · Floor or target"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 against **JaCoCo 0.8.15**'s `check-mojo.html` for `haltOnFailure` and the
> rule structure. Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> JUnit Jupiter 6.0.3.
> ⚠️ **No build and no test runs on this machine** — configuration and documented behaviour only.
> No percentage on this page comes from a run.

**[Chunk 04](04-thresholds.md) was the syntax. This is the decision the syntax encodes, and it is
the one that determines whether a coverage gate helps or quietly makes your suite worse. The XML
for "do not go below where we are" and the XML for "get to 80%" are nearly identical. What they
do to a team is not.**

## Floor or target — decide, and say which

This is the part that is not about syntax.

**A floor** says: do not go below where we are. It is set at or just under the current number,
its purpose is to catch the pull request that deletes a test class or adds an untested module,
and it creates no pressure to write anything. It is cheap, it is safe, and it is almost always
worth having.

**A target** says: get to 80%. It creates pressure, and the pressure is real, and people respond
to it — which is the problem, because [chunk 01](01-what-coverage-measures.md) established that
the cheapest way to move coverage is to write tests with no assertions. A target does not ask for
tests; it asks for executed lines, and it will get exactly what it asked for.
[Chunk 04b](04b-the-eighty-percent-ritual.md) is what that looks like in a diff.

The practical position:

| | Floor | Target |
|---|---|---|
| Set at | current level, or just below | some aspirational number |
| Catches | regression | nothing, reliably |
| Produces | no new tests | assertion-free tests, exclusions, and resentment |
| Right granularity | `CLASS` on `MISSEDCOUNT`, or `BUNDLE` | — |
| Verdict | worth having | ask what problem you are solving first |

If somebody wants coverage to go up, the honest instruments are a **per-change** coverage report
on the pull request ([chunk 07b](07b-coverage-in-ci.md)) and a conversation about which classes
matter — not a global number with a build failure attached.

## Introducing a gate to a codebase that would fail it

Three steps, in order, and none of them is "lower the number until it passes":

1. **Run `check` with `haltOnFailure=false`** for a sprint. You get the rule evaluated and
   reported without breaking anyone's build, and you find out how many classes are affected.
2. **Set the floor at the current value**, exactly. Not a round number — the actual one. A gate
   set to today's number cannot fail today and will fail the moment someone regresses.
3. **Ratchet it, deliberately and rarely.** [Chunk 04c](04c-the-ratchet.md) covers whether to
   automate that and why automating it usually goes wrong.

Setting a round aspirational number and then spending three sprints reaching it is the failure
mode this sequence exists to avoid.


## Where this connects

- **[04 · Thresholds](04-thresholds.md)** — the rule and limit syntax this page is choosing
  between, including why every limit must name its counter.
- **[04b · The eighty percent ritual](04b-the-eighty-percent-ritual.md)** — what a target
  produces, shown in code.
- **[04c · The ratchet](04c-the-ratchet.md)** — moving a floor over time, and why automating it
  usually goes wrong.
- **[05 · Exclusions](05-exclusions.md)** — the pressure valve a gate creates, and how to use it
  honestly.
- **[01 · What coverage measures](01-what-coverage-measures.md)** — the reason a target cannot
  work: the instrument does not measure what the target is asking for.

## Gotchas

**★ `haltOnFailure=false` left in place indefinitely is a gate that does not exist.**
It is the right way to introduce a rule and the wrong way to keep one. Nobody reads a warning in
a green build. Put a date on it.

**★ Setting the gate to a round number rather than to the current number guarantees a period of theatre.**
80% is not a fact about your codebase; today's number is. A gate set to today's number starts
protecting you immediately. A gate set to 80% starts a project.

**★ Excluding a class to get past a gate is the cheapest move available and nobody reviews it.**
The moment a threshold exists, adding a line to an `<excludes>` block becomes the fastest way to a
green build, and it is a one-line diff in a config file that reviewers skim. If you introduce a
gate, review its exclusion list on the same cadence you review the threshold.

**★ A gate changes what people optimise, and coverage is trivially optimisable.**
This is the whole argument in one line. The moment a number gates a merge, the cheapest legal way
to move it becomes a rational choice for someone under deadline — and for coverage the cheapest
legal move is a test with no assertions. You have not asked for tests; you have asked for executed
instructions, and you will be given exactly that.

**★ A floor set at a round number is a target wearing a floor's clothes.**
"We're at 71%, let's floor it at 75%" is not a floor — it is a four-point target with a build
failure attached, and it will be met the cheap way. A floor is set at or just below the number
you actually have. If you want the number to go up, say so and argue for it separately; do not
smuggle it in as a safety measure.

**★ Nobody notices a floor, which is exactly what makes it good.**
A well-set floor never fires until something genuinely regresses, so it generates no discussion,
no ceremony and no gaming. Teams sometimes read that silence as the gate being useless and raise
it to "make it do something" — which converts a working instrument into a broken one.

**★ The number a target reaches tells you nothing about whether it worked.**
A team that goes from 60% to 80% has definitely written code. Whether it wrote tests is a
separate question that the metric cannot answer, and the metric is the only thing being reported
upward. This is why "we hit our coverage goal" is compatible with the suite having got worse.

## Interview questions

**★ What's the difference between a coverage floor and a coverage target?**
A floor is set at the current level and exists to stop regression; it creates no pressure to write
tests and is nearly free. A target is set above the current level and exists to push the number
up — and since the cheapest way to raise coverage is to execute code without asserting on it, a
target reliably produces assertion-free tests and aggressive exclusions rather than better tests.
Floors are worth having by default; targets need a specific argument for why the number itself is
the problem.

**★ You want to introduce a coverage gate to a legacy codebase that would fail it badly. How?**
Run `check` with `haltOnFailure=false` first to see the scope without breaking builds. Then set the
floor at the codebase's *actual* current number rather than a round aspirational one, so the gate
cannot fail on day one but fails immediately on regression. Prefer per-class `MISSEDCOUNT` limits
with rule-level excludes for the genuinely untestable, so the rule points at specific gaps.
Ratchet later, deliberately, and treat the exclusion list as something to be reviewed rather than
grown.

**★ A manager wants coverage raised from 62% to 80% by the end of the quarter. What do you say?**
That the target will be met and it will not produce what they want, because the cheapest way to
move the number is to execute code without asserting on it — and under a deadline, cheapest wins.
I would offer the two things that answer the real concern: per-change coverage on pull requests,
so new code arrives tested and the trend improves without a global quota; and a specific list of
the classes where being untested actually carries risk, tested deliberately. If a number is
required, a floor at today's value plus a per-change rule is defensible; a global target is not.

**★ How do you tell whether an existing coverage gate is doing anything?**
Check three things. Has it ever failed a build — if not in six months it is either set below the
codebase's floor or it is not running at all, and in Gradle the latter is common because the
verification task is not a `check` dependency. Second, has `haltOnFailure` been left false, which
makes it a log line. Third, look at the exclusion list's git history: a gate that fires and is
answered by exclusions rather than tests is doing harm, and the exclusions file is where that
shows up.

**★ Is there ever a good reason to set a coverage target rather than a floor?**
Narrowly, yes — on a specific component where you have already decided every path matters, such as
a pure pricing, tax or permissions calculator with no I/O. There the denominator is small, the code
is worth exhaustive testing on its own merits, and "everything here should be exercised" is a real
engineering position rather than a quota. What does not work is a target applied across a whole
codebase, where most of the denominator is code nobody has argued should be tested at all.

{/* FOOTER */}
