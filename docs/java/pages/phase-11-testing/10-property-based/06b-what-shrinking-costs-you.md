---
title: "Every shrink step re-runs your property, which turns three things people treat as style questions into correctness questions: whether the property has side effects, how expensive a single execution is, and whether anything attached to the failure is computed lazily — because the shrinker will do all of it again, dozens of times, at the exact moment you are waiting on CI"
sidebar_label: "06b · What shrinking costs you"
sidebar_position: 31
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **jqwik 1.10.1 user guide**, sections *Result Shrinking*,
> *Failure Reporting* / *Reporting.FALSIFIED*, *Footnotes* and *Optional @Property Attributes*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox and no test run on this machine.** No timing, step count or report block below
> is a measurement taken here; the quoted sentences are the guide's.

**[06](06-shrinking.md) covered what the shrinker does and why integrated shrinking keeps working
through filters and combinators. This page is the bill. The shrinker finds a smaller sample by
running your property on candidate after candidate, and that single implementation detail is
responsible for the two most confusing failures in a real property suite: a report whose
exception has nothing to do with the bug, and a CI job that hangs for ten seconds per property
after every failure.**

## Shrinking re-runs your property, many times

Every shrink step executes the property method again. Three consequences follow, and all three
bite in real suites:

1. **Side effects run again.** A property that writes a row, sends a message or increments a
   counter does all of that once per try *and* once per shrink candidate. A property whose setup
   is not idempotent will produce a second, different failure during shrinking and report that
   one instead.
2. **Expensive properties get more expensive exactly when they fail.** The cost of a failing run
   is tries-to-failure plus shrink steps, and the shrink steps are the ones you wait for while
   staring at CI.
3. **Anything lazily attached to the failure is evaluated repeatedly.** The guide says so about
   footnotes: `Footnotes.addAfterFailure(Supplier<String>)` suppliers *"will only be evaluated if
   the property fails, and then as early as possible"*, and then — *"Mind that this evaluation
   can still happen quite often during shrinking."*

The mechanism for watching this is `@Report(Reporting.FALSIFIED)`, which *"will report each set
of parameters that is falsified during shrinking"* — the shrink path itself, step by step. Note
the caveat that goes with it: *"Unlike sample reporting these reports will show the freshly
generated parameters, i.e. potential changes to mutable objects during property execution cannot
be seen here."* Which is the opposite convention from the final sample block, and the source of
the mutation trap covered in [03b](03b-reading-the-failure-report.md).

## Where this connects

- The mechanism this page is charging you for — integrated shrinking, and which way each
  generator shrinks — is [06 · Shrinking](06-shrinking.md).
- Capping or disabling the search when the bill is too high is
  [06c · Controlling the shrinker](06c-controlling-the-shrinker.md).
- The two-block report, and why the sample is printed after use, is
  [03b · Reading the failure report](03b-reading-the-failure-report.md).
- Per-try lifecycle hooks and where state resets belong are
  [03d · The jqwik lifecycle](03d-the-jqwik-lifecycle.md).

## Gotchas

**★ The shrunk sample is reported after the property ran on it, so a property that mutates its input reports the mutated value — and this is the shrunk value, twice removed from what was generated.**
The sample block shows the parameter's state at the end of the run, not at generation. Combined
with shrinking, that means the string in your report is neither the value jqwik generated nor
necessarily the value your code received: it is the final shrink candidate, after your property
mutated it. `@Report(Reporting.FALSIFIED)` shows the freshly generated ones instead. Full
treatment in [03b](03b-reading-the-failure-report.md); it is repeated here because people meet it
first while staring at a shrunk sample that "cannot possibly have failed".

**★ Shrinking re-runs the property, so a property with a side effect can fail during shrinking for a *different* reason than the one that started it, and the report you read describes the second bug.**
The shrinker only keeps candidates that falsify, and it does not care *why* they falsify. If try
#412 fails on a genuine assertion and then shrink candidate #7 blows up on a unique-constraint
violation from the row try #412 already inserted, the shrinker accepts that candidate as
"smaller and still failing" and continues from there. The reported exception is then the
constraint violation. Properties that touch shared mutable state need per-try cleanup for
correctness of the *report*, not only of the run.

**★ A `@BeforeTry` reset does not run between shrink candidates in the way people assume — the try lifecycle does, but anything outside the JVM does not roll itself back.**
Shrink candidates go through the same per-try lifecycle as generated tries, so an in-memory
fixture rebuilt in `@BeforeTry` is genuinely fresh each time. What is not fresh is everything the
lifecycle cannot reach: rows committed to a database, files written, messages published,
counters in a static field belonging to a class you did not reset. The mental model to hold is
that the shrinker gives you *more* executions, not different ones — so a property whose isolation
was already slightly wrong fails in a new and more confusing way rather than in the same way
twice. Isolation that depends on "it only runs once per try, and tries are independent" is
isolation that has not accounted for shrinking.

**★ The time a failing property takes is not the time a passing one takes, and capacity planning done on green runs is wrong about the run you actually care about.**
A passing property costs `tries` executions. A failing one costs tries-to-failure plus every
shrink candidate, and under the default `BOUNDED` mode that search is allowed to run for ten
seconds — per property. A suite with forty properties where six fail is therefore not "the same
suite, plus six red marks"; it can be a minute of pure shrinking on top. This is worth knowing
before someone concludes the build got slower because of a code change, when what changed is that
something started failing.

**★ Anything you attach to a failure lazily is evaluated during shrinking, so an expensive footnote is charged once per candidate, not once per failure.**
`Footnotes.addAfterFailure(Supplier<String>)` exists precisely so an expensive diagnostic is not
computed on the 999 tries that pass. The guide grants that and then withdraws half of it:
*"Mind that this evaluation can still happen quite often during shrinking."* So the supplier is
the right tool against the cost of *passing* runs and no defence at all against the cost of a
failing one. If the diagnostic is genuinely expensive — a database dump, a rendered diff of two
large structures — the honest options are to make it cheap, or to accept that it is paid for on
the shrink path too.

## Interview questions

**★ A property fails in CI and the shrunk sample is barely smaller than the original. Where do you look?**
Not at the shrinking settings first — at the generator. Three constructions defeat the shrinker
and none of them announce themselves in the report. Nested `flatMap`, where the guide says
shrinking *"cannot be as aggressive"* because of the dependency between arbitraries; the fix is
`combine` wherever the dependency is not real. `Arbitraries.create(Supplier)` and
`Arbitraries.shuffle(...)`, both documented as unshrinkable, which keep any aggregate containing
them large. And `Arbitraries.fromGenerator(...)`, which does not shrink at all unless you supply
your own `RandomGenerator`. Only after ruling those out would I check whether the report says the
shrinking bound was reached, which is a different problem with a different fix — the ten-second
`BOUNDED` default timing out — and is the one case where changing a setting is the right move.

**★ You have a property over an order aggregate that writes to a test database. It fails, and the reported exception is a unique-constraint violation you cannot explain. What is your hypothesis?**
That the constraint violation happened during shrinking, not during generation. The shrinker
re-runs the property on every candidate it tries, so the row inserted by the original failing try
is still there when candidate one arrives — and the shrinker's only criterion is "does this
candidate still falsify", not "does it falsify for the same reason". It accepts the constraint
violation as a smaller failing case and keeps going from there, so the exception surfaced in the
report is from a shrink step, and the original assertion failure has been overwritten. The
diagnosis is confirmed by `@Report(Reporting.FALSIFIED)`, which prints each falsified parameter
set along the shrink path. The fix is per-try isolation — a rolled-back transaction, a truncate
in a lifecycle hook, or generated identifiers that do not collide — and the general lesson is
that shrinking turns "my property has a side effect" from a style objection into a correctness
one.

**★ Your team's property suite is fast when green and unbearable when red. What is going on, and what do you change?**
The asymmetry is the shrinker, and it is working as designed. A green property costs its tries;
a red one costs tries-to-failure plus a search that the default `BOUNDED` mode lets run for ten
seconds before it reports the best candidate so far. Multiply by the number of failing properties
and a red build gains a minute of wall-clock that a green build never shows. What I would change
depends on which half is expensive. If a single property execution is slow — it hits a container,
builds a Spring context, does real I/O — then the fix is the property, because the shrinker is
just multiplying an existing cost, and that property probably wants to be a smaller unit-level
one with the integration concern tested separately. If executions are fast and there are simply
very many candidates, that is a generator shape problem: deeply nested or unshrinkable
constructions make the search wander. Turning shrinking off is the last resort and an explicit
trade, not a tuning knob: it buys back the time by handing you unreadable failures, which is the
cost that made property-based testing worth adopting in the first place.

{/* FOOTER */}
