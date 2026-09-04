---
title: "Every optional operator is off for one of exactly two documented reasons, and REMOVE_CONDITIONALS is the exception on both counts: it is the one pitest tells you to enable, its bare behaviour mutates only equality checks, and two of its four specialisations are already running if your POM says DEFAULTS — a fact neither the documentation table nor the group name will tell you"
sidebar_label: "03d2 · Optional operators"
sidebar_position: 14
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against pitest's
> [Mutation operators](https://pitest.org/quickstart/mutators/) page — the *Overview* design-criterion
> sentence, the *Remove Conditionals Mutator* section and the group table, quoted verbatim — and
> pitest 1.30.0 source read at the `1.30.0` tag: `engine/gregor/config/StandardMutatorGroups.java`,
> `engine/gregor/config/Mutator.java` and `mutators/RemoveConditionalMutatorGroup.java`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring Framework
> 7.0.8, JUnit Jupiter 6.0.3.
> ⚠️ **No sandbox and no build on this machine.** Operator behaviour is quoted from pitest's
> documentation and read from its published source; the Java on this page is illustrative source,
> never a run.

**[03d](03d-optional-mutators.md) established the machinery — which group resolves to what, and the
minus syntax that makes changing an operator set a one-line edit. This chunk opens the inventory of the
operators themselves. It gives you the rule for reading any optional operator's documentation, and
then the mechanism of the one operator that breaks that rule: `REMOVE_CONDITIONALS`, which pitest
recommends, which is a group rather than a single operator, whose bare behaviour is narrower than its
name, and two of whose four specialisations are silently already active in most builds. What its
results *mean*, and whether to switch it on, are
[03d2b](03d2b-reading-a-remove-conditionals-pair.md).**

## How to read an optional operator's warning

Every optional operator is optional for a reason, and pitest states the reason on the mutators page in
one sentence per operator. There are only two failure modes, from the design criterion in the page's
overview:

> *"The operators are largely designed to be stable (i.e not be too easy to detect) and minimise the
> number of equivalent mutations that they generate. Those operators that do not meet these
> requirements are not enabled by default."*

**Fails "stable"** means its mutants get killed by tests that check nothing — a
`NullPointerException` from the JVM is a test failure, and pitest cannot tell it from an assertion.
Enabling such an operator raises the score without measuring anything. `CONSTRUCTOR_CALLS` is the
textbook case ([03d2e](03d2e-the-call-neutralising-operators.md)).

**Fails "few equivalents"** means it produces mutants that cannot be killed at all, which sit in the
report forever and are also the expensive case, because a survivor runs every covering test to
completion ([02](02-how-it-works.md)). `INLINE_CONSTS` is the noisiest example
([03d2c](03d2c-inline-constants.md)).

Read each operator's warning and put it in one of those two buckets. That is the whole decision for
four of the five optional operators. `REMOVE_CONDITIONALS` is the exception, and pitest gives it a
third reason of its own, which [03d2b](03d2b-reading-a-remove-conditionals-pair.md) takes apart.

## What `REMOVE_CONDITIONALS` does

> *"The remove conditionals mutator will remove all conditionals statements such that the guarded
> statements always execute"*

```java
if (a == b) {
    // do something
}
```

becomes

```java
if (true) {
    // do something
}
```

And then, unusually for an optional operator, an actual recommendation:

> *"Although not currently enabled by default it is highly recommended that you enable it if you wish
> to ensure your test suite has full coverage of conditional statements."*

⚠️ Read *"not currently enabled by default"* against [03d](03d-optional-mutators.md)'s finding: it is
true of the **implicit** default set you get by configuring nothing, and false of the group literally
named `DEFAULTS`, which in 1.30.0's `StandardMutatorGroups` contains `REMOVE_CONDITIONALS_ORDER_ELSE`
and `REMOVE_CONDITIONALS_EQUAL_ELSE`:

```java
mutators.put("DEFAULTS", gather(mutators,"INVERT_NEGS",
        "MATH",
        "VOID_METHOD_CALLS",
        "REMOVE_CONDITIONALS_ORDER_ELSE",
        "REMOVE_CONDITIONALS_EQUAL_ELSE",
        "CONDITIONALS_BOUNDARY",
        "INCREMENTS", "RETURNS"));
```

Two of the four specialisations are already running if you wrote `DEFAULTS` in your POM, and neither
the recommendation above nor the group table says so — the table marks *Remove Conditionals* as blank
under `DEFAULTS` and as *"EQUAL_ELSE case"* under `STRONGER`, and the source has all four in
`STRONGER`. Neither reading of the table is correct for 1.30.0.

## The four specialisations, and what their names mean

The base behaviour is narrower than the operator's name suggests:

> *"As shown above the basic remove conditionals mutator ensures that the statements following the
> conditional always execute. It will also only mutate only equality checks (e.g. ==, !=)."*

The specialisations widen it in two independent dimensions — which branch is forced, and which kind of
comparison is mutated:

| Name | Forces | Mutates |
|---|---|---|
| `REMOVE_CONDITIONALS_EQUAL_IF` | the `if` branch | `==`, `!=` |
| `REMOVE_CONDITIONALS_EQUAL_ELSE` | the `else` branch | `==`, `!=` |
| `REMOVE_CONDITIONALS_ORDER_IF` | the `if` branch | `<`, `<=`, `>`, `>=` |
| `REMOVE_CONDITIONALS_ORDER_ELSE` | the `else` branch | `<`, `<=`, `>`, `>=` |

> *"The names reflect which branch will be forced to execute (the "if" or the "else") and the type of
> checks that will be mutated."*

The docs show the `else`-side form explicitly — the guard becomes `if (false)`, so an `else` block, if
present, always runs:

```java
if (a == b) {
    // do something
} else {
    // do something else
}
```

becomes

```java
if (false) {
    // do something
} else {
    // do something else
}
```

Note what the `_ELSE` variants do when there is **no** `else` block: the guarded statements never
execute, which is the "delete this branch entirely" mutant. That is the shape that makes them useful
on guard clauses and early returns, where there is no `else` to speak of.

## `REMOVE_CONDITIONALS` is a group, not an operator

The bare name is registered by `RemoveConditionalMutatorGroup`, one of the four `MutatorGroup`
services listed in pitest's `META-INF/services` ([03d](03d-optional-mutators.md)), and it expands to
all four specialisations. Two consequences:

**Writing it next to `DEFAULTS` adds two operators, not four.** The two `_ELSE` variants are already
in that group; the two `_IF` variants are what you gain. From the *implicit* default set — configure
nothing at all — you gain all four, and the denominator moves further.

**The duplication costs nothing.** `Mutator.fromStrings` collects into a `TreeSet` keyed on each
factory's globally unique id, so naming a specialisation that a group already pulled in deduplicates
silently. Pitest's own group listing contains `REMOVE_CONDITIONALS_EQUAL_IF` twice for exactly this
reason.

The practical form, therefore, is the additive one — never a re-listing of the defaults minus
something, which freezes your operator set at the moment you wrote it:

```xml
<configuration>
  <mutators>
    <mutator>DEFAULTS</mutator>
    <mutator>REMOVE_CONDITIONALS</mutator>
  </mutators>
</configuration>
```

## Where this connects

- **[03d · Optional mutators](03d-optional-mutators.md)** — the groups, the `DEFAULTS`/implicit-default
  divergence, and the minus-prefix syntax.
- **[03d2b · Reading a remove-conditionals pair](03d2b-reading-a-remove-conditionals-pair.md)** — what a
  survivor of each specialisation means, why the operator is off, and how to scope it.
- **[03d2c · Inline constants](03d2c-inline-constants.md)** and
  **[03d2d · `REMOVE_INCREMENTS`](03d2d-remove-increments.md)** — the two optional operators that corrupt
  a value rather than a decision.
- **[03d2e · The call-neutralising operators](03d2e-the-call-neutralising-operators.md)** —
  `CONSTRUCTOR_CALLS` and `NON_VOID_METHOD_CALLS`, the two that delete an action.
- **[03d2f · Adopting an optional operator](03d2f-adopting-an-optional-operator.md)** — the scope, the
  paired filter, the second execution, and the honest ranking across all five.
- **[03d3 · The research operators](03d3-the-research-operators.md)** — ABS, AOR, AOD, CRCR, OBBN, ROR
  and UOI, which are most of what remains in `ALL`.
- **[03 · Mutators](03-mutators.md)** — `CONDITIONALS_BOUNDARY` and `NEGATE_CONDITIONALS`, the two
  default conditional operators this one overlaps with.

## Gotchas

**★ The bare `REMOVE_CONDITIONALS` behaviour mutates only `==` and `!=`.**
*"It will also only mutate only equality checks (e.g. ==, !=)."* Order comparisons need the `ORDER_IF`
and `ORDER_ELSE` specialisations, which the group name pulls in. A build that hand-lists a single
specialisation expecting every `if` in the codebase to be forced both ways gets that for equality
checks and nothing for `<`, `<=`, `>` and `>=` — which on business-rule code is most of the
conditionals.

**★ Two of the four remove-conditionals variants are already active if your POM says `DEFAULTS`.**
`StandardMutatorGroups` registers `DEFAULTS` with `REMOVE_CONDITIONALS_ORDER_ELSE` and
`REMOVE_CONDITIONALS_EQUAL_ELSE` in it. So "enabling remove conditionals" from a `DEFAULTS`
configuration adds two operators, not four, and any before/after comparison is measuring the two
*if*-side variants only. From the implicit default set it adds all four, and the score moves further.

**★ The documentation table and the registered group disagree about this operator, in both directions.**
The mutators page marks *Remove Conditionals* blank under `DEFAULTS` and *"EQUAL_ELSE case"* under
`STRONGER`; the 1.30.0 source has two variants in `DEFAULTS` and all four in `STRONGER`. Neither reading
of the table gets you the right answer. The authoritative list is the *Active mutators* block at the
bottom of every HTML source page, or the console output with `verbose` on
([04a](04a-the-html-report.md)).

**★ `REMOVE_CONDITIONALS` is a group name, so `-REMOVE_CONDITIONALS` removes four operators at once.**
The minus-prefix exclusion resolves group names exactly as it resolves individual ones
([03d](03d-optional-mutators.md)). Someone excluding "the remove conditionals mutator" because one
class produced noise takes out the two `_ELSE` variants that `DEFAULTS` supplied as well, changing the
default set without appearing to.

**★ An `_ELSE` variant on a guard clause deletes the branch rather than swapping it.**
With no `else` block present, forcing the condition false means the guarded statements never run. That
is the useful shape on early returns and validation guards, and it is also why the `_ELSE` variants
behave so differently from `NEGATE_CONDITIONALS` on code written with guard clauses rather than
if/else pairs.

**★ Every optional operator changes the denominator, so the score moves before any test does.**
Turning on `REMOVE_CONDITIONALS` over a conditional-heavy package will usually *lower* the reported
percentage on the first run, and that is the measurement improving, not the tests regressing. Record
the operator set alongside any score you intend to compare — a mutation score quoted without its
operator set is not a number anyone can reproduce.

## Interview questions

**★ How do you decide whether to enable one of PIT's optional operators?**
By reading the one-sentence warning pitest attaches to it and placing it in one of two buckets. If the
warning says the mutation is *unstable* — the constructor-call operator is *"fairly unstable and likely
to cause NullPointerExceptions even with weak test suites"* — its mutants get killed by the JVM rather
than by assertions, so it inflates the score while measuring less. If the warning says it produces
*equivalent* mutations, those mutants can never be killed, so they live in the report permanently and
cost the most runtime, since a survivor runs every covering test to completion. Those two are the whole
of pitest's stated design criterion. The one operator this does not settle is `REMOVE_CONDITIONALS`,
which is off for a third reason — redundancy with the default conditional operators — and which pitest
recommends enabling anyway.

**★ A build has `<mutator>REMOVE_CONDITIONALS_EQUAL_ELSE</mutator>` alongside `DEFAULTS`. What is it doing?**
Nothing, and that is worth knowing rather than guessing at. `DEFAULTS` as registered in
`StandardMutatorGroups` already contains `REMOVE_CONDITIONALS_EQUAL_ELSE`, and `Mutator.fromStrings`
collects everything into a `TreeSet` keyed on each factory's globally unique id, so naming it a second
time deduplicates silently. The line is harmless and misleading: it looks like the build has enabled
remove-conditionals, when what it has actually enabled is one variant that was already on, and the two
*if*-side variants — the half that carries the diagnostic — are still absent.

**★ What is the difference between `REMOVE_CONDITIONALS` and its four specialisations?**
`REMOVE_CONDITIONALS` is a group, registered by `RemoveConditionalMutatorGroup` as a `MutatorGroup`
service, that expands to all four. The specialisations vary along two axes: `_IF` versus `_ELSE` decides
which branch is forced to execute, and `_EQUAL` versus `_ORDER` decides whether the mutator touches
equality checks (`==`, `!=`) or order checks (`<`, `<=`, `>`, `>=`). The bare behaviour described in the
prose — force the guarded statements to always execute — is the equality half only, which is why naming
one specialisation is not the same as naming the group. And because it is a group, the minus-prefix
exclusion `-REMOVE_CONDITIONALS` removes all four in one line, including the two that `DEFAULTS`
supplied.

**★ Why can't you tell from a pitest build file which operators actually ran?**
Because at least four things intervene between the configuration and the mutants. The string `DEFAULTS`
and the implicit default set are different sets in 1.30.0 — the group has the two `_ELSE`
remove-conditionals variants and no `NEGATE_CONDITIONALS`, the implicit set is the reverse. The
documentation's group table disagrees with the registered groups in both directions for this operator.
Filters remove whole categories of mutant before any of them run, and a filtered mutant appears under no
status at all. And any pitest plugin on the classpath can register additional operators, which also
changes what `ALL` resolves to. The two authoritative places are the console output with `verbose`
enabled and the *Active mutators* list at the bottom of every HTML source page.

{/* FOOTER */}
