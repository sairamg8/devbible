---
title: "Because PIT inserts mutants by re-writing a class inside a JVM that has already loaded it, anything that runs exactly once per JVM is beyond its reach — static initializers, enum constructors and anything the compiler already folded into a constant are untestable by this technique, and the finally block is mutated once per exit path"
sidebar_label: "02b · What it cannot mutate"
sidebar_position: 4
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against pitest's [FAQ](https://pitest.org/faq/) (sections *"Mutations in
> static initializers and enums"*, *"I have mutations that are not killed but should be"*,
> *"Pitest mutates bytecode, does that mean it works with all JVM languages?"*),
> [Mutation operators](https://pitest.org/quickstart/mutators/), the
> [Maven quick start](https://pitest.org/quickstart/maven/) (`detectInlinedCode`,
> `mutateStaticInitializers`) and the [Basic concepts](https://pitest.org/quickstart/basic_concepts/)
> page.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, JUnit Jupiter
> 6.0.3.
> ⚠️ **No sandbox and no build on this machine.** Java source, configuration and documented or
> source-read behaviour only.

**A tool that mutates bytecode by re-writing a loaded class buys enormous speed and pays for it in
blind spots. Code that runs once per JVM cannot be re-run, so a mutant placed there has no effect
and would be silently reported as surviving — which is why pitest refuses to put one there at all.
Three categories fall into that hole and they are exactly the ones people assume are covered:
static initializers, enum constructors, and compile-time constants that `javac` folded away before
pitest ever saw the class. A fourth, the `finally` block, is the opposite problem — mutated too
many times rather than not at all. The filters that keep compiler-generated noise out of the report
are [chunk 02b3](02b3-the-filter-inventory.md).**

## Static initializers and enum constructors

This is the fundamental limitation and pitest's FAQ explains it in terms of the two optimisations
from [chunk 02](02-how-it-works.md):

> *"Static initializers and other code that is only run once per JVM (such as code in enum
> constructors) cause a bit of a problem with two of the strategies Pitest uses to make mutation
> testing usable fast."*

**Coverage targeting**, first:

> *"Pitest will only run tests that execute the line of code where a mutation is placed.
> Unfortunately, the only test to execute a static initializer will be the first test to run that
> causes that class to load."*

**Mutant insertion**, second:

> *"Pitest inserts mutants into a jvm by re-writing the class after it has loaded. This is orders
> of magnitude faster than starting a new jvm or creating a new classloader, but code in static
> initializer blocks is not re-run so the mutants have no effect."*

A mutant with no effect is a mutant no test can fail on, which would appear in the report as a
survivor and send you off writing a test that cannot possibly kill it. So pitest filters them out
instead. Its stated mitigation:

> *"Pitest tries to avoid mutating static initializer code. It will not create mutants in: static
> initializers; private methods called only from static initializers. You will however encounter
> other scenarios that this simple filtering will miss."*

That last sentence is doing real work: the filter is syntactic, so a static initializer that calls
a *package-private* or *public* helper still gets that helper mutated, and the mutant is
unkillable.

The Maven parameter that used to control this is gone. The quick start:

> *"mutateStaticInitializers — Support for mutating static initializers was removed in pitest
> 1.3.0"*

**In practice, this means constants and eagerly-built singletons are outside the technique.** A
`private static final Map<String, BigDecimal> RATES = Map.of(...)` is initialised once. A
`static final Pattern` is compiled once. Nothing pitest does can tell you whether a test would
notice if those were wrong.

## Constant folding, which happens before pitest ever sees the code

Related but distinct: the compiler can eliminate the code you wanted mutated. The docs for the
inline constant mutator:

> *"Please note that the compiler might optimize the use of final variables (regardless whether
> those are stack variables or member variables)."*

with the example that

```java
public class A {
  private static final int VAR = 13;
  public String foo() {
    final int i = 42;
    return "" + VAR + ":" + i;
  }
}
```

is compiled to the equivalent of `return "13:42";`, and pitest's conclusion:

> *"In such situations the mutation engine can not mutate any variable."*

So a `static final int` used in a comparison has already been folded into the comparison by
`javac`; there is no field read left to mutate. The comparison itself is still mutable, which is
usually the interesting part anyway.

## `finally` blocks and inlined code

The FAQ, under *"I have mutations that are not killed but should be"*:

> *"Are the mutations in finally blocks? Do you seem to have two or more identical mutations, some
> killed and some not? If so this is due to the way in which the Java compiler handles finally
> blocks. Basically, the compiler creates a copy of the contents of the finally block for each
> possible exit point. PIT creates separate mutations for each of the copied blocks. Most test
> suites are only able to kill one of these mutations."*

The mitigation is `detectInlinedCode`, and here the documentation contradicts itself in a way worth
naming. The Maven parameter page says both:

> *"detectInlinedCode — Enabled by default since 0.29."*

and, at the end of the same entry:

> *"Defaults to false."*

The FAQ says *"As of 0.28 PIT contains experimental support for detecting inlined code that is now
active by default."* ⚠️ **Two of the three statements say it is on by default and one says
otherwise; I could not settle this from the documentation.** If it matters to you — that is, if you
see duplicate mutants in `finally` blocks — set it explicitly rather than trusting either
statement:

```xml
<configuration>
    <detectInlinedCode>true</detectInlinedCode>
</configuration>
```

The algorithm's own limitation is documented plainly. This is detected as two inlined instructions:

```java
finally {
    int++;
    int++;
}
```

but this is not, because pitest cannot distinguish inlined copies from genuine duplicates on one
line:

```java
finally {
    int++; int++;
}
```

> *"In the case of any doubt PIT will act cautiously and assume that the code is not inlined."*

## Where this connects

- **[02 · How it works](02-how-it-works.md)** — the four decisions these limitations come from.
- **[02c · Timeouts and determinism](02c-timeouts-and-determinism.md)** — the other place the
  once-per-JVM problem shows up, this time as run-to-run variation.
- **[02b2 · Logging and `avoidCallsTo`](02b2-logging-and-avoidcallsto.md)** — the one exclusion
  pitest lets you configure, whose default package list misses Log4j 2.
- **[02b3 · The filter inventory](02b3-the-filter-inventory.md)** — the other half of this
  mechanism: what pitest declines to mutate on purpose, and the feature flags that reverse each
  decision.
- **[04b · Equivalent mutants](04b-equivalent-mutants.md)** — an unkillable mutant in a static
  initializer and an unkillable mutant that is logically equivalent to the original are different
  problems with the same symptom.

## Gotchas

**★ Constants and static configuration are invisible to mutation testing, so a high score says nothing about them.**
Rate tables, thresholds, regex patterns and feature flags held in `static final` fields are either
in a static initializer (not mutated by policy) or folded by the compiler (not present to mutate).
If your class's real risk is a wrong constant, mutation testing will report it as thoroughly tested
while never having tested it. That risk belongs to a review or a parameterised test, not to PIT.

**★ The static-initializer filter is syntactic and its own docs say it misses cases.**
Pitest skips static initializers and *private* methods called only from them. A non-private helper
invoked from a static block is still mutated, and the mutant cannot be killed because the block
does not re-run. Pitest's FAQ warns of this directly: *"You will however encounter other scenarios
that this simple filtering will miss."* If you have an unkillable survivor in an obviously-tested
class, check whether a static block calls it.

**★ Duplicate identical mutants on one line usually means a `finally` block, not a bug in the report.**
The compiler copies a `finally` body to every exit point and pitest mutates each copy. You get two
or three visually identical entries and typically kill only one. That is the documented behaviour;
`detectInlinedCode` is the mitigation, and it cannot help when two identical statements share a
source line.

**★ `detectInlinedCode`'s default is documented inconsistently — set it explicitly.**
The same Maven parameter page says "Enabled by default since 0.29" and "Defaults to false" about
the same option, and the FAQ says active by default. Rather than guess, put the value in your POM.
This is a case where the documentation cannot settle the question and I am not going to invent an
answer.

## Interview questions

**★ Why can't PIT mutate static initializers?**
Two reasons, both structural. Its coverage targeting says "run the tests that execute this line",
but the only test that executes a static initializer is whichever one happened to load the class
first — an arbitrary choice that changes with run order. And its mutant insertion works by
re-writing an already-loaded class, so a mutation in `<clinit>` has no effect at all: the block has
already run and will not run again. A mutant with no effect would be reported as surviving, sending
you to write a test that cannot kill it, so pitest filters them out instead — along with private
methods called only from static blocks. The Maven parameter that once controlled this was removed
in 1.3.0.

**★ You see two identical surviving mutants on the same line and cannot kill the second. What is going on?**
Almost certainly a `finally` block. The compiler duplicates the contents of a `finally` for each
exit path from the guarded region, and pitest mutates each copy separately, so one source line
produces several mutants that look the same. Most suites take only one exit path and therefore
kill only one. `detectInlinedCode` exists to collapse these into a single mutation, and its own
documentation admits it cannot distinguish an inlined copy from two genuine identical statements
written on one line, in which case it conservatively assumes no inlining.

**★ Can PIT tell you whether a hard-coded threshold constant is tested?**
No, and this is one of its sharper limitations. A `private static final BigDecimal THRESHOLD` is
initialised in the static initializer, which pitest will not mutate, and if it is a primitive
compile-time constant `javac` may have folded it into the call sites so there is nothing to mutate
anyway. What pitest *can* mutate is the comparison that uses it — `>=` becomes `>`, and that
mutant will find a test suite that never probes the boundary. So the value is untested by this
technique and the boundary logic around it is well covered by it.

{/* FOOTER */}
