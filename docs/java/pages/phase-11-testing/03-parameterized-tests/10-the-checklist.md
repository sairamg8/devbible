---
title: "Reviewing a parameterized test is a different job from reviewing a test, because the two questions that matter — can a red row name itself, and can a green row be green for the wrong reason — are both invisible in the diff"
sidebar_label: "10 · The review checklist"
sidebar_position: 36
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide, "Parameterized Classes and Tests"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)).
> Every item below links to the chunk in this topic that argues it and names its source; this page
> adds no new claims about JUnit's behaviour.
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.

**A pull request containing a `@ParameterizedTest` gets reviewed the same way as any other test —
someone reads the assertion, decides it looks reasonable, and approves. That misses both of the
failure modes unique to tables. This chunk is the pass you make instead: three groups of checks
here, four more in [10b](10b-checklist-data-and-shape.md), each one a question you can answer
from the diff.**

## How to use this

Work in this order, because the checks get progressively more expensive:

1. **Read the display name pattern first.** Ten seconds, and it tells you whether a failure will
   be diagnosable at all.
2. **Read the table.** Look for what varies between rows that is not data.
3. **Read the method body last.** By then you already know what to expect from it, and anything
   surprising there is a finding.

The order matters because the method body is the most reassuring part of the file and the least
informative. A table's defects are almost all visible before you get to the assertion.

## 1 · Will a red row name itself?

> ☐ **Does the display name identify the failing case without opening the file?**

The default is *"the invocation index and a comma-separated list of the `String` representations
of all arguments"* ([07](07-display-names.md)). That is often enough — and often not, in three
specific situations you can spot from the diff.

☐ **Are any arguments objects whose `toString` is a class name and a hash?** A row rendering as
`[4] com.acme.Order@6d06d69c` is an unnamed case. Either the type needs a `toString`, or the
source should use `argumentSet(…)` labels ([07c](07c-naming-arguments.md)), or the name pattern
should pick out fields.

☐ **Does the pattern use `{0}`, `{1}` positionally in a table that is about to gain a column?**
Positional placeholders break silently when a column is inserted — the name still renders, just
about the wrong argument. `{argumentsWithNames}` survives it.

☐ **Are the arguments long?** A 400-character JSON payload in a display name makes every row's
name useless and the CI output unreadable. Name the case instead of showing it.

☐ **Is `@CsvSource` quoting doing something to the rendered value?** Leading and trailing
whitespace, embedded quotes and empty-versus-blank cells all render differently from how they
read in the source ([07b](07b-quoted-arguments.md), [03](03-csvsource.md)).

☐ **Is there a project-wide default name pattern in `junit-platform.properties`?** If
`junit.jupiter.params.displayname.default` is set ([07d](07d-project-wide-display-names.md)), the
test you are reading may render quite differently from what the annotation suggests. Check the
properties file once per project, not once per review.

🔴 **The test for this whole group:** if a row fails in CI at 2am, does the failure line alone say
which case broke? If the answer is "you would have to open the file and count rows", the report is
not doing its job yet.

## 2 · Can any row pass for the wrong reason?

This is the check nobody performs, because a green test invites no scrutiny. It is also where the
expensive bugs are.

☐ **Is any expected value computed from the input?** Either in the test body or in the factory —
`assertThat(f(x)).isEqualTo(g(x))` where `g` restates the rule. The test then asserts that the
code agrees with itself ([09d](09d-setup-drift-and-computed-expectations.md),
[09c](09c-the-source-that-grew-logic.md)).

☐ **Is any column unread on some rows?** A parameter that a branch skips is dead data. Change it
to a wrong value and nothing fails, so eventually it will be wrong
([09](09-when-not-to-parameterize.md)).

☐ **Does the assertion actually distinguish the rows?** `assertThat(result).isNotNull()` passes
for every row in a fifty-row table, and so does `assertDoesNotThrow` around a method that never
throws. Ask what a *wrong* implementation would have to do to make a row fail.

☐ **Could the table be empty?** A filter in a `@MethodSource` factory that matches nothing
produces a parameterized test with no invocations — and that reports green
([09c](09c-the-source-that-grew-logic.md)). Any `.filter(…)` or `continue` in a source deserves a
question.

☐ **Is an aggregated row using `ArgumentsAccessor` without checking its width?** An aggregator
reading `accessor.getString(3)` keeps working after a column is deleted if the indices still
resolve — silently testing something else. `size()` or `toList()` is the guard
([08b](08b-aggregation.md), [08j](08j-argument-count-validation.md)).

☐ **Does a converter swallow failures?** A `catch (Exception e) { return DEFAULT; }` inside an
`ArgumentConverter` turns a malformed cell into a valid value, and the row then asserts against
something the table never described ([08n](08n-null-and-conversion-failure.md)).

☐ **For a `@ParameterizedClass`, is state carried between invocations?** A field mutated by one
invocation and read by the next makes rows pass or fail depending on order
([08f](08f-parameterized-class-lifecycle.md), [08h](08h-argument-lifetime.md)).

## 3 · Is the source deterministic and ordered?

☐ **Does the source contain a loop, a filter, a conditional or an accumulation?** All four move
the test's coverage out of the file ([09c](09c-the-source-that-grew-logic.md)).

☐ **Is the order stable across runs?** `Collections.shuffle`, `Random`, `HashSet`/`HashMap`
iteration, `.parallel()`, `.collect(toSet())` — any of these makes `{index}` refer to a different
case each run, so a CI failure cannot be reproduced by index and two reports cannot be diffed.
JUnit does not require determinism; every tool that consumes its output assumes it.

☐ **Does the source read the clock, the filesystem, the network or a live registry?**
`LocalDate.now()` in a factory is the canonical "passes until the first of the month" defect.
Checked-in data ([03c](03c-csvfilesource.md)) is the reviewable version.

☐ **Is a `@MethodSource` factory `static`, or is the class `PER_CLASS`?** The requirement and its
one escape are in [04](04-methodsource.md); a non-`static` factory on a default-lifecycle class
fails at resolution, not compilation.

☐ **Is the factory named by a string that no longer matches?** `@MethodSource("cases")` is an
unchecked string ([04](04-methodsource.md)). A rename refactor that misses it does not fail to
compile.

☐ **Does a `@MethodSource` return a `Stream` that something else already consumed?** Streams are
single-use; the return-type contract and JUnit's closing behaviour are
[04b](04b-methodsource-return-types.md).

☐ **Is `@EnumSource` using `names` with a `mode` that silently matches nothing?** A typo in a
constant name or a `MATCH_ALL` regex that matches no constant is a table with zero rows
([05](05-enumsource.md)).

☐ **Is a custom `ArgumentsProvider` doing the same things a factory should not?** Relocating a
loop into a provider class does not change what it computes ([06](06-argumentssource.md)).

## Where this continues

Four more groups — null and empty handling, conversion, the shape of the table, and the
two-minute pass you actually run in a review — are
[10b](10b-checklist-data-and-shape.md).

## Gotchas

**★ Reviewing the assertion first.** It is the most reassuring line in the file and tells you the
least. By the time you have decided the assertion looks right, you have stopped looking for the
things that make it meaningless.

**★ Treating a green parameterized test as reviewed.** The characteristic failure of a table is a
row that passes for the wrong reason, and nothing about a passing build surfaces it. Green is when
you have to read most carefully.

**★ Assuming a large row count implies coverage.** Rows are not paths. Fifty rows through an
`isNotNull()` assertion cover nothing; four rows chosen at boundaries can cover a great deal.

**★ Approving a display name you have not seen rendered.** Reading the pattern is not the same as
reading the output. Placeholders, `toString` implementations and CSV quoting all intervene between
the two ([07](07-display-names.md), [07b](07b-quoted-arguments.md)).

**★ Ignoring the project-wide default pattern.** `junit.jupiter.params.displayname.default` changes
every parameterized test in the project ([07d](07d-project-wide-display-names.md)), so a review of
one file cannot tell you how it will render.

**★ Missing that a test has zero invocations.** A parameterized test whose source produced nothing
reports as passing in most tooling. If a review adds a filter to a source, that is the question to
ask.

**★ Letting an unchecked factory name through.** `@MethodSource("cases")` is a string. Renaming
the method breaks it at run time, so a diff that renames a factory needs its annotation checked by
eye.

**★ Accepting "it is just test code" for a source with logic.** A factory that computes
expectations is production logic with no tests of its own, in the one place where being wrong is
invisible.

## Interview questions

**★ How do you review a parameterized test differently from an ordinary one?**
By reading it in the opposite order: the display-name pattern first, then the table, then the body.
The two failure modes unique to tables — a red row that cannot name itself, and a green row that is
green for the wrong reason — are both settled before you reach the assertion, and the assertion is
the part that looks most convincing regardless.

**★ What single question would you ask about a table you have thirty seconds to review?**
"What varies between these rows, and is all of it data?" If the only variation is values, the table
is right at any length. If a branch, a setup step, an applicability or a justification also varies,
that thing wants a method name instead of a column.

**★ How can a parameterized test pass while testing nothing?**
Several ways, and all of them are quiet: a filter in the source that matches nothing gives zero
invocations, which reports green; an `@EnumSource` `names` regex that matches no constant does the
same; an assertion like `isNotNull()` passes for every row; and an expected value computed from the
input asserts only that the code agrees with itself. None of these produce a warning.

**★ Why does the ordering of an argument source matter to a reviewer?**
Because the report's `{index}` is the handle everything else uses — rerunning a single failing
case, comparing two CI runs, isolating a flaky row. An unordered or shuffled source makes `[7]`
mean something different every run, so a failure that appears once can never be pinned down. It is
worth flagging even though JUnit itself imposes no ordering requirement.

**★ A diff adds `.filter(c -> c.isSupported())` to a `@MethodSource` factory. What do you ask?**
How many rows the test runs before and after, and what happens if the predicate ever matches
nothing. A filter is the only change in this topic that can reduce a test to zero invocations while
turning the build a slightly brighter shade of green.

{/* FOOTER */}
