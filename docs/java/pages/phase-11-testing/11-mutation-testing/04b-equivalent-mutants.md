---
title: "Some mutants cannot be killed by any test, because the mutated program is the same program — deciding which ones is undecidable in general, so PIT ships five pattern-matching filters for specific shapes it can recognise and leaves the rest in your report forever; that is why the ceiling on a mutation score is not 100 and why pitest's own threshold documentation warns you about it"
sidebar_label: "04b · Equivalent mutants"
sidebar_position: 25
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against pitest's
> [Basic concepts](https://pitest.org/quickstart/basic_concepts/) page — the *Equivalent Mutations*
> section with both of its stated causes and its worked example, quoted verbatim — the
> [Maven quick start](https://pitest.org/quickstart/maven/) `mutationThreshold` entry, and the
> [Mutation operators](https://pitest.org/quickstart/mutators/) page's per-returns-mutator filtering
> sentences. Filter behaviour read from pitest 1.30.0 source at the `1.30.0` tag:
> `build/intercept/equivalent/` — `EquivalentReturnMutationFilter`, `DivisionByMinusOneFilterFactory`,
> `EqualsPerformanceShortcutFilterFactory`, `NullFinalFieldAssignmentFilter(Factory)` and
> `EmptyReturnsFilter` including its source comment — plus
> `org.pitest.mutationtest.DetectionStatus`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7.
> ⚠️ **No sandbox and no build on this machine.** Filter names and behaviour are read from published
> source; no mutant count, score or ceiling figure on this page came from a run.

**Everything else in this topic assumes a surviving mutant is a finding. Some are not. A mutant whose
mutated program behaves identically to the original cannot be killed by any test that could ever be
written, and it will sit in your report, forever, looking exactly like a missing assertion. This is not
a defect in PIT — deciding program equivalence is undecidable in general, so no tool can enumerate
them — and it is the reason a mutation score has a ceiling below 100 that nobody can compute for you.
This chunk is what the problem is, what pitest does about it automatically, and where its automation
provably stops. What it does to your score, the equivalent mutants you will actually meet, and the four
things you can do about each are [04b2](04b2-the-ceiling-on-the-score.md).**

## Pitest's own definition, and its two causes

From *Basic concepts*:

> *"Things are not quite this simple in practice as not all mutations will behave differently than the
> unmutated class. These mutants are referred to as equivalent mutations."*

and then two distinct causes, which are worth keeping separate because only one of them is a genuine
equivalence.

**Cause 1 — the mutant is the same program.**

> *"The resulting mutant behaves in exactly the same way as the original"*

with the worked example:

```java
int i = 2;
if ( i >= 1 ) {
    return "foo";
}
```

```java
//...
int i = 2;
if ( i > 1 ) {
    return "foo";
}
```

Both take the branch, always, for every possible execution. There is no input that distinguishes them
because there is no input at all — `i` is fixed. This is equivalence in the strict sense, and no test
can kill it.

**Cause 2 — the mutant differs, but nobody wants to test the difference.**

> *"The resulting mutant behaves differently but in a way that is outside the scope of testing. A common
> example are mutations to code related to logging or debug. Most teams are not interested in testing
> these. PIT avoids generating this type of equivalent mutation by not generating mutations for lines
> that contain a call to common logging frameworks (this list of frameworks is configurable, to enable
> mutation of logging statements disable the feature FLOGCALL)."*

Note the honesty in pitest's own framing: deleting a `log.debug(...)` genuinely changes behaviour. It is
"equivalent" only in the operational sense that no team will assert on it. That distinction matters,
because cause 2 is a **judgement** you can revisit — an audit log is behaviour you *do* want asserted
([02b2](02b2-logging-and-avoidcallsto.md)) — while cause 1 is a fact about the program.

## Why no tool can solve this

Two programs are equivalent if they produce the same observable behaviour for every input. Deciding that
in general is undecidable: it reduces to the halting problem, since a decision procedure for equivalence
would let you decide whether an arbitrary program is equivalent to one that trivially terminates. This
is not a claim about PIT and not something pitest's documentation asserts — it is the standard reason
the equivalent mutant problem is a permanent feature of the technique rather than a missing feature of
any particular tool.

What is achievable is what pitest does: **recognise specific syntactic shapes that are known to produce
equivalent mutants, and refuse to generate those mutants at all.** Every filter below is a bytecode
pattern match. Each one removes a category; none of them removes the category you are about to meet in
your own code.

## The five equivalence filters, and exactly what each catches

All five are on by default. Read from the `Feature.named(...)` declarations in pitest 1.30.0's
`build/intercept/equivalent` package:

| Feature | Description, verbatim from source | Catches |
|---|---|---|
| `FRETEQUIV` | *"Filters return vals mutants with bytecode equivalent to the unmutated class"* | A returns mutant on a method that already returns that value |
| `FSEQUIVDIV` | *"Filters equivalent mutations of the form x * -1 -> x / -1"* | The one `MATH` substitution that is arithmetically identical |
| `FSEQUIVEQUALS` | *"Filters equivalent mutations that affect only performance in short cutting equals methods"* | The `if (this == other) return true;` fast path |
| `NULLFINALS` | *"Filters equivalent mutations to null final field assignments"* | `null` assigned to a `final` field in a constructor or static initializer |
| *(the returns filter's engine)* | — | `EmptyReturnsFilter`, the bytecode matcher `FRETEQUIV` uses |

Three of them repay a closer look.

**`FSEQUIVDIV` is a single arithmetic identity.** `MATH` replaces `*` with `/`
([03b](03b-arithmetic-mutators.md)). For the specific operand `-1`, `x * -1` and `x / -1` are the same
number, so that one substitution produces an equivalent mutant every time. The filter exists because
negation written as `x * -1` is common enough to matter.

**`FSEQUIVEQUALS` is about a mutation that only costs time.** The idiomatic `equals` begins with

```java
if (this == other) {
    return true;
}
```

which is a performance shortcut, not a semantic one — remove it and `equals` still returns `true` for
identity, via the field comparisons below. A mutant that neutralises the shortcut therefore changes only
how long the method takes, and no assertion can see it.

**`NULLFINALS` is narrow and precise.** `NullFinalFieldAssignmentFilter` computes the set of `final`
field names for the class, then matches, inside `<init>` or `<clinit>` only, the instruction sequence
`ACONST_NULL` followed by a `PUTFIELD`/`PUTSTATIC` targeting one of them — and removes the mutant at
that instruction. Assigning `null` to a field that is already about to be `null`, or to a `final` field
whose assignment is the class's only chance to set it, produces nothing a test can distinguish.

⚠️ **This filter is not listed in [02b3](02b3-the-filter-inventory.md)'s inventory table**, which was
compiled from a different set of packages. `NULLFINALS` is registered, on by default in 1.30.0, and
belongs beside `FRETEQUIV`, `FSEQUIVDIV` and `FSEQUIVEQUALS` in that table.

## The per-operator filtering the returns mutators get

The five returns mutators are the one place pitest built equivalence filtering into the operator design
rather than bolting it on ([03c](03c-the-returns-mutators.md)). Four of the five carry the same sentence
on the mutators page, adjusted per type:

> *"Pitest will filter out equivalent mutations to methods that are already hard coded to return the
> empty value."*

with the corresponding wording for `false`, `true` and `0`. **That per-operator filterability is the
stated reason `RETURN_VALS` was split into five operators**: one operator mutating every return could
not distinguish "return `null` instead of the computed value" from "return `null` where the method
already returns `null`".

## 🔴 Where the automation provably stops

`EmptyReturnsFilter` is a bytecode sequence matcher with two patterns — the direct shape (push the empty
value, return it) and the indirect shape (push it, `ASTORE` to a local, prove nothing overwrites that
local, `ALOAD`, return). Its own source comment names the limit:

```java
// match anything that doesn't overwrite the local var
// possible we will get issues here if there is a jump instruction
// to get to the point that the empty value is returned.
```

So a method that returns `Collections.emptyList()` on a straight-line path is filtered, and one that
reaches the same `return` through a branch may not be. That is the automation's boundary, written down
by its author: **pattern matching on instruction sequences, defeated by control flow.**

This is the general shape of every filter in the table. Each recognises a syntactic form. None of them
reasons about your program's semantics, because nothing can.

What the unfiltered remainder does to your mutation score — the ceiling below 100 that nobody can
compute, the status pitest defines for this and never sets, and the specific equivalent mutants this
topic's own operators produce — is [04b2](04b2-the-ceiling-on-the-score.md).

## Where this connects

- **[04b2 · The ceiling on the score](04b2-the-ceiling-on-the-score.md)** — the catalogue from this topic's own operators, and the four responses to each.
- **[04 · Reading a report](04-reading-a-report.md)** — the statuses, and the never-assigned `EQUIVALENT`.
- **[04c · The score arithmetic](04c-the-score-arithmetic.md)** — why a count gates better than a percentage, and what `maxSurviving` actually counts.
- **[02b3 · The filter inventory](02b3-the-filter-inventory.md)** — every other filter, and the `+`/`-` syntax; note that `NULLFINALS` is missing from its table.
- **[02b2 · Logging and `avoidCallsTo`](02b2-logging-and-avoidcallsto.md)** — the documented example of cause 2, a mutant that differs but is outside the scope of testing.
- **[03c · The returns mutators](03c-the-returns-mutators.md)** — why one operator became five, which is an equivalence-filtering story.
- **[03b · Arithmetic mutators](03b-arithmetic-mutators.md)** — fixture values of 0 and 1, the most common source of equivalent mutants nobody filters.

## Gotchas

**★ An equivalent mutant is indistinguishable from a missing assertion in the report.**
Both appear as `SURVIVED`. Nothing in the HTML, XML or CSV output marks a mutant as unkillable, and the
`EQUIVALENT` status is never assigned by the open-source engine. The only way to tell is to read the
mutant and think, which is why a mutation report is a document for a person rather than a number for a
dashboard.

**★ Deciding equivalence is undecidable, so "why doesn't PIT just detect these" has a permanent answer.**
Program equivalence reduces to the halting problem. Every filter pitest ships is a syntactic pattern
match for a specific known shape — `x * -1` versus `x / -1`, the `equals` identity shortcut, a `null`
assigned to a `final` field. There is no general solution to be added in a later release, and a tool
claiming to eliminate equivalent mutants is claiming something stronger than it can deliver.

**★ `EmptyReturnsFilter`'s own source comment admits it can be defeated by a jump.**
It matches the empty value being pushed and returned directly, or stored to a local and loaded back —
*"possible we will get issues here if there is a jump instruction to get to the point that the empty
value is returned"*. A method that returns `Collections.emptyList()` from one branch and something else
from another may produce an equivalent mutant the filter does not catch. That is the automation's
boundary, documented by its author.

**★ `NULLFINALS` is a real, on-by-default filter and is missing from this topic's filter inventory table.**
`NullFinalFieldAssignmentFilterFactory` registers `Feature.named("NULLFINALS").withOnByDefault(true)`
with the description *"Filters equivalent mutations to null final field assignments"*. It belongs beside
`FRETEQUIV`, `FSEQUIVDIV` and `FSEQUIVEQUALS` in [02b3](02b3-the-filter-inventory.md)'s table, which was
compiled from a different set of packages and does not list it.

**★ Cause 2 is a judgement pitest made for you, and it is reversible.**
Logging mutants are called equivalent because no team wants to assert on debug output — not because the
program behaves the same. If logging *is* your product, that judgement is wrong for you, and the fix is
to stop the auditable calls looking like logging rather than to disable `FLOGCALL`
([02b2](02b2-logging-and-avoidcallsto.md)). Knowing which of pitest's "equivalences" are facts and which
are policies tells you which ones you are allowed to disagree with.

**★ The `x * -1` filter exists because that is the one `MATH` substitution that is always equivalent.**
`MATH` replaces `*` with `/`, and for the operand `-1` the two expressions are the same number for every
input. Negation written as `value * -1` is common enough that pitest ships `FSEQUIVDIV` for it. Nothing
comparable exists for the far more common case where your *fixture* makes an operator equivalent — a
quantity of 1, a rate of 0 — because that is a property of the test, not of the code.

## Interview questions

**★ What is an equivalent mutant, and why can't PIT just detect them all?**
A mutant whose mutated program behaves identically to the original for every possible input, so no test
that could ever be written will fail in its presence. Pitest's own example is a comparison against a
constant — `int i = 2; if (i >= 1)` mutated to `if (i > 1)` — where both branches are taken always. It
cannot detect them in general because deciding whether two programs are equivalent is undecidable; it
reduces to the halting problem. What pitest does instead is recognise specific syntactic shapes known to
produce equivalent mutants and refuse to generate them: `x * -1` versus `x / -1`, the identity shortcut
in `equals`, `null` assigned to a `final` field in a constructor, and returns mutants on methods already
hard-coded to return that value. Each filter removes a category. None of them removes the category in
your own code.

**★ How do you tell an equivalent mutant from a missing assertion when you meet one in the report?**
By reading it, because nothing in the output distinguishes them — both are `SURVIVED`, and the
`EQUIVALENT` status is never assigned by the open-source engine. The question to ask is whether there
exists *any* input for which the mutated program would produce a different observable result. If yes,
the finding is real and the fix is a test with that input or a stronger assertion. If no, it is
equivalent, and the honest responses are to leave it, to change a fixture value that made it equivalent,
or to record a filter or exclusion in the build file so the decision is visible to the next reader.
Editing the production code to make the entry disappear is never one of them.

**★ Why did splitting `RETURN_VALS` into five operators help with equivalent mutants?**
Because equivalence filtering has to be per case, and one operator covering every return type could not
express that. `RETURN_VALS` mutated every object return to `null`, which produced an unkillable mutant
on every method that already returned `null` on some path, with no way to suppress those without
suppressing the useful ones. The five narrower operators each carry their own filter — the mutators page
says for `EMPTY_RETURNS`, `TRUE_RETURNS`, `FALSE_RETURNS` and `PRIMITIVE_RETURNS` that mutations to
methods already hard-coded to return that value are filtered out. That is the whole design rationale for
the split, and it is a good illustration that the equivalent-mutant problem shapes operator design and
not just report reading.

{/* FOOTER */}
