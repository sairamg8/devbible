---
title: "The five experimental operators are the only part of ALL that is not a redundant re-encoding of something already in the defaults: EXPERIMENTAL_MEMBER_VARIABLE is the one instrument in PIT that can ask whether anybody would notice a field never being assigned, EXPERIMENTAL_SWITCH is silently included in STRONGER, and EXPERIMENTAL_BIG_INTEGER is the reason pitest's release notes mention Java 25 at all"
sidebar_label: "03d3b · Experimental operators"
sidebar_position: 21
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against pitest's
> [Mutation operators](https://pitest.org/quickstart/mutators/) page — the *Experimental Mutators*
> block (*Argument Propagation*, *Big Integer*, *Naked Receiver*, *Member Variable*, *Switch*), the
> member-variable warning and its equivalent-mutant example, and the group table — all quoted verbatim
> — the [Advanced usage](https://pitest.org/quickstart/advanced/) page's `RemoveSwitchMutator` example,
> and the [pitest GitHub releases](https://github.com/hcoles/pitest/releases) note for 1.25.8. Group
> registration read from pitest 1.30.0 source at the `1.30.0` tag:
> `engine/gregor/config/StandardMutatorGroups.java` and
> `mutators/experimental/RemoveSwitchMutatorGroup.java`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.
> ⚠️ **No sandbox and no build on this machine.** Operator behaviour is quoted from pitest's
> documentation and read from its published source; no mutant count on this page came from a run.

**[03d3](03d3-the-research-operators.md) covered the seven literature operators, whose problem is that
they re-encode default operators with more substitutions and less diagnostic value. The five
*experimental* operators are a different proposition. Four of them do things nothing else in PIT does —
neutralise a field assignment, replace a call with its own argument, replace a call with its receiver —
and the fifth is already in `STRONGER`, which means a build that steps up one group has enabled an
operator pitest labels experimental without anyone deciding to. This chunk is what each does, the one
that is genuinely worth a single-class experiment, and the release note that makes one of them
load-bearing on JDK 25.**

## The five

The mutators page keeps them in a separate *Experimental Mutators* block. All five are in `ALL`; one,
`EXPERIMENTAL_SWITCH`, is also in `STRONGER`.

| Operator | Docs, verbatim |
|---|---|
| `EXPERIMENTAL_ARGUMENT_PROPAGATION` | *"Experimental mutator that replaces method call with one of its parameters of matching type."* |
| `EXPERIMENTAL_BIG_INTEGER` | *"Experimental mutator that swaps big integer methods."* |
| `EXPERIMENTAL_NAKED_RECEIVER` | *"Experimental mutator that replaces method call with a naked receiver."* |
| `EXPERIMENTAL_MEMBER_VARIABLE` | *"The experimental member variable mutator mutates classes by removing assignments to member variables. The mutator can even remove assignments to final members."* |
| `EXPERIMENTAL_SWITCH` | *"The switch mutator finds the first label within a switch statement that differs from the default label. It mutates the switch statement by replacing the default label (wherever it is used) with this label. All the other labels are replaced by the default one."* |

## `EXPERIMENTAL_MEMBER_VARIABLE` — the only operator that can see a field assignment

This is the one with a genuine capability behind it. Nothing in the default set, and nothing in the
optional set, touches field initialisation. `VOID_METHOD_CALLS` deletes calls;
`NON_VOID_METHOD_CALLS` blanks their results; `MATH` mutates the arithmetic in `this.i++`. None of them
can ask *"would anything notice if this field were simply never set?"*

The mutator removes the assignment and leaves the member at its Java default value, and it *"can even
remove assignments to final members"*:

```java
public class MutateMe {
  private final int x = 5;
  //...
}
```

becomes

```java
public class MutateMe {
  private final int x = 0;
  ...
}
```

with the same Java-default-value table `NON_VOID_METHOD_CALLS` uses — `false` for `boolean`, `0` for the
integral types, `0.0` for `float` and `double`, the null character for `char`, `null` for reference
types.

Its documented warning is the reason it is off:

> *"This mutator is likely to create equivalent mutations if a member variable is explicitly initialized
> with the Java default value for the specific type of the member variable"*

with the example

```java
public class EquivalentMutant {
  private int x = 0;
}
```

Removing an assignment of `0` and leaving the field at `0` is no mutation at all. That is the
"equivalent" bucket ([03d2](03d2-the-optional-operator-inventory.md)) in its purest form: the mutant is
unkillable by construction, and it will be generated for every field a codebase initialises explicitly
to its default — which is a style some teams use everywhere.

**When it is worth a run.** On one class, once, when the question is specifically about state that is
set in a constructor or a builder and read much later. A configuration object, an entity with a
lifecycle flag, a value object assembled by a mapper. The report tells you whether any test would notice
the field going unset, which is a question a mapper's tests in particular are often silent about —
[08 · Test data patterns](../08-test-data-patterns/README.md) is full of builders whose defaults hide
exactly this.

⚠️ Note the interaction with [02b](02b-what-it-cannot-mutate.md): a `static final` field is initialised
in `<clinit>`, which pitest declines to mutate at all, so this operator reaches **instance** fields.
"Would anyone notice if this constant were wrong" remains outside the technique.

## `EXPERIMENTAL_ARGUMENT_PROPAGATION` and `EXPERIMENTAL_NAKED_RECEIVER`

Two one-line operators that attack the same thing from opposite ends: they replace a method call with
something already in hand rather than with a constant.

**Argument propagation** *"replaces method call with one of its parameters of matching type"*:

```java
// mutated to: return order;
return discountPolicy.apply(order);
```

**Naked receiver** *"replaces method call with a naked receiver"*:

```java
// mutated to: return builder;
return builder.withCurrency(GBP);
```

Both are strictly better-targeted than `NON_VOID_METHOD_CALLS`, which substitutes `null` and therefore
kills its own mutant at the next dereference ([03d2e](03d2e-the-call-neutralising-operators.md)). A
mutant that returns a *valid* object of the right type does not NPE; it propagates quietly and is caught
only by an assertion on the value. That makes them, in principle, exactly the kind of stable operator
pitest's criterion asks for.

The naked-receiver mutant is the one to think about on fluent APIs, because a builder method that
returns `this` makes the mutant genuinely equivalent — `builder.withCurrency(GBP)` and `builder` are the
same object, and only an assertion on the built result can tell them apart. On a codebase full of
fluent builders and `with`-style copy methods, that is a large supply of survivors whose status is
ambiguous between "unasserted" and "unkillable", which is the worst kind ([04b](04b-equivalent-mutants.md)).

I could not find any pitest documentation explaining why these two remain experimental rather than being
promoted to the optional set, and I am not going to guess at it. What is documented is the label.

## `EXPERIMENTAL_BIG_INTEGER`, and the Java 25 note

> *"Experimental mutator that swaps big integer methods."*

That is the whole description, and the operator matters here for a reason unconnected to whether you
enable it. Pitest 1.25.8's release note reads:

> *"#1485 Fix BigDecimal and BigInteger mutators for java 25"*

This is the **only** mention of Java 25 anywhere in pitest's release history. Pitest publishes no
maximum supported JDK, so it is not a support statement — but it is the strongest available evidence
that the maintainer is running against that JDK, and it is the fact to reach for when someone asks
whether pitest works on this phase's toolchain ([01b](01b-the-tool-and-its-versions.md)).

Two practical consequences. If you are on a pitest older than 1.25.8 on JDK 25 and see anything strange
from this operator, upgrade before investigating. And note that `gradle-pitest-plugin` 1.19.0 defaults
to PIT **1.22.1**, which predates the fix — a Gradle build that does not pin `pitestVersion` is on the
wrong side of it ([05b · Gradle](05b-gradle.md)).

## `EXPERIMENTAL_SWITCH`, and the group nobody notices

> *"The switch mutator finds the first label within a switch statement that differs from the default
> label. It mutates the switch statement by replacing the default label (wherever it is used) with this
> label. All the other labels are replaced by the default one."*

Read that carefully: it is not "take one branch"; it is a wholesale relabelling that sends every case to
the default and the default to one case. On a `switch` over an enum — a state machine, a discount type,
a payment method — the mutant routes every input to the fallback and the fallback's input to one real
case. A test suite that exercises two of six enum constants and asserts on both will kill it; one that
exercises all six and asserts only that nothing threw will not.

Two things make this operator worth knowing about even though you will probably never name it.

**It is in `STRONGER`.** From `StandardMutatorGroups`:

```java
mutators.put("STRONGER", gather(mutators,"DEFAULTS",
        "EXPERIMENTAL_SWITCH",
        "REMOVE_CONDITIONALS_ORDER_IF",
        "REMOVE_CONDITIONALS_EQUAL_IF"));
```

So a team that moves from `DEFAULTS` to `STRONGER` because it sounds like a modest increment has also
opted into an experimental operator. That is a defensible choice — it is the least alarming of the five
— but it should be a choice.

**It is pitest's own example of a mutator with many instances.** From the *Advanced usage* page:

> *"For example, 100 instances are created of the
> `org.pitest.mutationtest.engine.gregor.mutators.experimental.RemoveSwitchMutator`. Each one has a
> different unique id, and affects only a certain branch within a switch statement."*

That is where the separately-registered `REMOVE_SWITCH` group comes from
([03d](03d-optional-mutators.md)) — a hundred numbered instances, one per switch branch, grouped under
one name. It is also a reminder that "one operator" and "one mutant per instruction" are not the same
thing anywhere in this tool.

## Where this connects

- **[03d3 · The research operators](03d3-the-research-operators.md)** — the other seven members of `ALL`, and why the group is discouraged.
- **[03d · Optional mutators](03d-optional-mutators.md)** — `STRONGER`'s registration, the `REMOVE_SWITCH` group, and what `ALL` resolves to.
- **[03d2e · The call-neutralising operators](03d2e-the-call-neutralising-operators.md)** — `NON_VOID_METHOD_CALLS`, which argument propagation and naked receiver improve on in principle.
- **[02b · What it cannot mutate](02b-what-it-cannot-mutate.md)** — static initializers, which put `static final` fields out of `EXPERIMENTAL_MEMBER_VARIABLE`'s reach.
- **[01b · The tool and its versions](01b-the-tool-and-its-versions.md)** — the 1.25.8 release note and what it does and does not say about JDK 25.
- **[04b · Equivalent mutants](04b-equivalent-mutants.md)** — the fluent-builder case, where a naked receiver mutant is genuinely unkillable.
- **[08 · Test data patterns](../08-test-data-patterns/README.md)** — builders whose defaults hide the unset field this chunk's best operator is for.

## Gotchas

**★ `EXPERIMENTAL_MEMBER_VARIABLE` is the only operator that can neutralise a field assignment, including a `final` one.**
Nothing in the default or optional sets touches field initialisation. If what you want to know is
"would anyone notice if this field were never set", this is the only instrument in the tool — and its
own documentation warns that a member explicitly initialised to its type's default value produces an
equivalent mutant. Use it on one class, read the survivors, and turn it off.

**★ It reaches instance fields only, because `static final` initialisation lives in `<clinit>`.**
Pitest declines to mutate static initializers at all, since the block does not re-run when a mutant is
inserted into a loaded class ([02b](02b-what-it-cannot-mutate.md)). So this operator does not close the
constant-testing gap either; it closes a different one, about state set per instance.

**★ A codebase that initialises fields explicitly to their defaults gets an unkillable mutant per field.**
`private int count = 0;`, `private boolean active = false;`, `private String name = null;` — pitest's
own example is exactly this. Removing an assignment of the default value changes nothing. That style is
common in generated code and in teams that value explicitness, and it turns this operator into a
survivor factory.

**★ `EXPERIMENTAL_NAKED_RECEIVER` is equivalent by construction on any method that returns `this`.**
Fluent builders, `with`-style copy methods on mutable objects, and any API whose methods return the
receiver produce a mutant identical to the original. On a codebase built around fluent APIs this
operator's survivors are ambiguous between "nobody asserted" and "cannot be killed", which is the state
that makes a report unreadable.

**★ `STRONGER` quietly includes an experimental operator.**
`EXPERIMENTAL_SWITCH` is in `STRONGER` per both the documentation table and `StandardMutatorGroups`. A
team stepping up from `DEFAULTS` to `STRONGER` because it sounds like a modest increment is also opting
into an operator pitest labels experimental, alongside the two `_IF`-side remove-conditionals variants.

**★ `EXPERIMENTAL_SWITCH` relabels the whole `switch`, it does not disable one branch.**
Its documentation says the default label is replaced by the first differing label *"wherever it is
used"* and *"All the other labels are replaced by the default one."* So the mutant is a wholesale
rerouting, not a single-branch removal, and killing it needs an assertion on the outcome for at least
two different inputs — not merely coverage of both.

**★ Pitest's `BigInteger` mutators were broken on Java 25 until 1.25.8.**
The release note is *"Fix BigDecimal and BigInteger mutators for java 25"*. If you are running an older
pitest on JDK 25 and see anything strange from `EXPERIMENTAL_BIG_INTEGER`, upgrade before investigating.
It is also the single strongest signal available that the maintainer tests against Java 25 — pitest
publishes no maximum supported JDK, and this is the only mention of 25 in its release history.

**★ The Gradle plugin's default PIT version predates that fix.**
`gradle-pitest-plugin` 1.19.0 defaults to PIT 1.22.1. A Gradle build that omits `pitestVersion` is
running an engine from before 1.25.8's Java 25 mutator fix, before 1.25.7's JaCoCo interaction fix and
before 1.25.5's timeout-detection change. Pin the version.

**★ "One operator" does not mean "one mutant generator".**
Pitest's own docs say a hundred instances of `RemoveSwitchMutator` exist, each with its own globally
unique id, each affecting one branch of a `switch`. That is why the deduplicating `TreeSet` in
`Mutator.fromStrings` is keyed on ids rather than names, and why a single operator name in your build
file can correspond to a great many entries in the *Active mutators* list
([04a](04a-the-html-report.md)).

## Interview questions

**★ Is there any way to find out whether your tests would notice a field never being assigned?**
One, and it is an experimental operator: `EXPERIMENTAL_MEMBER_VARIABLE`, which removes assignments to
member variables — including `final` ones — and leaves the field at its Java default value. Nothing in
the default or optional sets does this; they mutate calls, comparisons, arithmetic and return values,
but not field initialisation. The catch is in its own documentation: a field explicitly initialised to
its type's default value produces an equivalent mutant, so a codebase written with
`private int count = 0;` everywhere generates a survivor per field that nobody can ever kill. The way to
use it is on one class, once, reading the survivors, rather than as a build setting. And it reaches
instance fields only — a `static final` is initialised in the static initializer, which pitest does not
mutate at all.

**★ A team moves from `DEFAULTS` to `STRONGER` and their score drops. What did they actually enable?**
Three operators, one of which is experimental. `StandardMutatorGroups` registers `STRONGER` as
`DEFAULTS` plus `EXPERIMENTAL_SWITCH`, `REMOVE_CONDITIONALS_ORDER_IF` and
`REMOVE_CONDITIONALS_EQUAL_IF` — so they picked up the two *if*-side remove-conditionals variants and the
switch mutator. The score drop is the denominator growing with mutants that nothing kills, which is the
measurement getting stricter rather than the tests getting worse. Worth flagging that `STRONGER` is
still the only group upgrade worth making and that `ALL` is documented as strongly discouraged — but
also that "stronger" quietly includes something labelled experimental, which is the kind of thing a team
should decide rather than inherit.

**★ Why would replacing a method call with one of its arguments be a *better* mutation than replacing it with `null`?**
Because the mutant survives long enough to be judged by an assertion. `NON_VOID_METHOD_CALLS` substitutes
the type's default, which for a reference type is `null`, and that propagates to a
`NullPointerException` at the next dereference — the mutant dies to the JVM rather than to a test, which
is precisely the "unstable" failure the tool's design criterion warns about. Argument propagation and
naked receiver substitute a *valid* object of the right type, so the program keeps running and only an
assertion on the resulting value can distinguish it. In principle that is a much better probe. In
practice both are still experimental, and naked receiver is equivalent by construction on any method
that returns `this`, which on a fluent-builder codebase is most of them.

**★ How can one mutation operator produce a hundred entries in the active-mutator list?**
Because pitest distinguishes a mutator's *name* from its globally unique *id*, and one name can have many
instances. Its own advanced-usage documentation uses the switch mutator as the example: a hundred
instances of `RemoveSwitchMutator` exist, each with a distinct id, each affecting one branch of a
`switch` statement. The name is what you write in the build file to enable or disable the family; the id
is what deduplicates when two groups both pull the same instance in, which is why `Mutator.fromStrings`
collects into a `TreeSet` keyed on ids. It also means the number of names in your configuration tells
you nothing about how many mutants to expect.

{/* FOOTER */}
