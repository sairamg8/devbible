---
title: "The five returns mutators replaced RETURN_VALS because one operator could not be filtered per case — and which of the five fires on a given method is decided by a fourteen-entry lookup table keyed on the exact declared return type, so returning ArrayList instead of List changes the operator, and a Bean Validation @NotNull on a getter deletes its mutants entirely"
sidebar_label: "03c · The returns mutators"
sidebar_position: 11
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against pitest's
> [Mutation operators](https://pitest.org/quickstart/mutators/) page — the group table and the
> *Empty returns*, *False returns*, *True returns*, *Null returns*, *Primitive returns* and
> *Return Values* sections, quoted verbatim — and pitest 1.30.0 source read at the `1.30.0` tag:
> `mutators/returns/EmptyObjectReturnValsMutator.java` (the `NON_NULL_MUTATIONS` map),
> `NullReturnValsMutator.java`, `BooleanFalseReturnValsMutator.java`,
> `PrimitiveReturnsMutator.java` and
> `build/intercept/equivalent/EmptyReturnsFilter.java`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring Framework
> 7.0.8, JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> ⚠️ **No sandbox and no build on this machine.** Mutator behaviour is quoted from pitest's
> documentation and read from its source; the Java on this page is illustrative source, never a run.

**Five of the eleven default mutators do one thing: throw away whatever the method computed and
return a constant instead. They are the operators that reduce an entire method to a fixed answer, so
a survivor from any of them is the strongest possible statement about a test suite. This chunk is
the machinery — why one older operator became five, and the surprisingly narrow rules that decide
which of the five fires on a given method. Those rules are in the source rather than the docs, and
two of them will change your report in ways nobody predicts: the empty-value table has exactly
fourteen entries and matches on the exact declared class name, and one operator can be switched off
per method by an annotation your validation layer already puts there.
[03c2](03c2-reading-a-returns-survivor.md) is what a survivor of each one tells you.**

## Why one operator became five

`RETURN_VALS` mutated every return by type: booleans flipped, integers swapped with 0 or 1, longs
were incremented, floats and doubles were negated, and object returns became `null`. Pitest's docs
now carry one line about it:

> *"This mutator has been superseded by the new returns mutator set."*

It sits in `OLD_DEFAULTS` and in `ALL`, and in neither `DEFAULTS` nor `STRONGER`. The replacement
splits the same territory into five narrower operators, each of which can be enabled, disabled and
— crucially — *filtered* independently. Four of the five carry the same sentence in the docs:

> *"Pitest will filter out equivalent mutations to methods that are already hard coded to return
> the empty value."*

with the corresponding wording for `false`, `true` and `0`. That per-operator equivalence filtering
is the whole reason for the split. `RETURN_VALS` could not tell "return `null` instead of the
computed value" from "return `null` where the method already returns `null`", and the second is an
[equivalent mutant](04b-equivalent-mutants.md) that can never be killed.

The filter is not a heuristic on the source. `EmptyReturnsFilter` in pitest's source is a bytecode
sequence matcher with two patterns: the **direct** shape — push the empty value, return it — and the
**indirect** shape — push it, `ASTORE` it into a local, prove nothing overwrites that local,
`ALOAD` it, return it. Its own source comment names the limit of that second pattern:

```java
// match anything that doesn't overwrite the local var
// possible we will get issues here if there is a jump instruction
// to get to the point that the empty value is returned.
```

So a method that returns `Collections.emptyList()` from a straight-line path is filtered, and one
that reaches the same `return` through a branch may not be.

## The five, and exactly when each fires

| Mutator | Docs | Fires on |
|---|---|---|
| `EMPTY_RETURNS` | *"Replaces return values with an 'empty' value for that type"* | Reference returns whose declared type is in the table below |
| `FALSE_RETURNS` | *"Replaces primitive and boxed boolean return values with false."* | `boolean` and `java.lang.Boolean` |
| `TRUE_RETURNS` | *"Replaces primitive and boxed boolean return values with true."* | `boolean` and `java.lang.Boolean` |
| `NULL_RETURNS` | *"Replaces return values with null."* | Reference returns that `EMPTY_RETURNS` cannot handle |
| `PRIMITIVE_RETURNS` | *"Replaces int, short, long, char, float and double return values with 0."* | Primitives other than `boolean` |

The operators are mutually exclusive by construction, and the exclusions are in the source, not in
the docs. `PrimitiveReturnsMutator` skips a method when the return sort is `BOOLEAN`, with the
comment *"Does not mutate boolean returns as these are handled by the BooleanFalseReturn mutator"*.
`EmptyObjectReturnValsMutator` skips `java.lang.Boolean` for the same reason. And
`NullReturnValsMutator` carries the rule that matters most:

> *"Does not mutate return types for which a more stable return value mutation exists."*

Its implementation is a two-line predicate: skip if the return type is `java.lang.Boolean`, or if it
is a key in `EMPTY_RETURNS`'s table. `NULL_RETURNS` is therefore the fallback operator — it fires
only where nothing better applies.

## 🔴 The table is keyed on the exact declared class name

`AReturnMethodVisitor.NON_NULL_MUTATIONS` in pitest 1.30.0 has exactly fourteen entries:

| Declared return type | Mutated to |
|---|---|
| `java.lang.Integer`, `java.lang.Short`, `java.lang.Character` | boxed `0` |
| `java.lang.Long`, `java.lang.Float`, `java.lang.Double` | boxed `0` |
| `java.lang.String` | `""` |
| `java.util.Optional` | `Optional.empty()` |
| `java.util.stream.Stream` | an empty `Stream` |
| `java.util.List`, `java.util.Collection`, `java.lang.Iterable` | an empty `List` |
| `java.util.Map` | an empty `Map` |
| `java.util.Set` | an empty `Set` |

The lookup is `NON_NULL_MUTATIONS.containsKey(type.getClassName())` on the type in the **method
descriptor**. There is no subtype logic and no generic-parameter logic. So:

```java
List<Order> ordersFor(CustomerId id) { ... }        // EMPTY_RETURNS -> empty List
ArrayList<Order> ordersFor(CustomerId id) { ... }   // not in the table -> NULL_RETURNS instead
SortedSet<Tag> tags() { ... }                       // not in the table -> NULL_RETURNS instead
Iterator<Row> rows() { ... }                        // not in the table -> NULL_RETURNS instead
BigDecimal total() { ... }                          // not in the table -> NULL_RETURNS instead
Money total() { ... }                               // not in the table -> NULL_RETURNS instead
```

This is not a defect — an "empty" value only exists for types pitest knows about — but it has a
practical consequence worth internalising. Declaring the return as the interface rather than the
implementation, which is better style anyway, gets you a *harder* mutant: an empty list survives an
`isNotNull()` check and a `null` does not. Returning `ArrayList` gives you the mutant a weak test
kills by accident.

Note also what is **not** in the table: `Optional` is there but `OptionalInt`, `OptionalLong` and
`OptionalDouble` are not; `Stream` is there but `IntStream`, `LongStream` and `DoubleStream` are
not. Those fall through to `NULL_RETURNS`, and a `null` where an `OptionalInt` was expected dies at
the next call.

## 🔴 `@NotNull` on a method deletes its `NULL_RETURNS` mutants

The docs say it in passing:

> *"Methods that can be mutated by the EMPTY_RETURNS mutator or that are directly annotated with
> NotNull will not be mutated."*

The implementation is a suffix match on the annotation descriptor:

```java
@Override
public AnnotationVisitor visitAnnotation(String desc, boolean visible) {
  this.hasNotNullAnnotation |= desc.endsWith("NotNull;");
  return super.visitAnnotation(desc, visible);
}
```

Any annotation whose binary name ends in `NotNull` counts, whatever package it is in — JetBrains'
`org.jetbrains.annotations.NotNull`, and also **`jakarta.validation.constraints.NotNull`**, which is
the one a Spring codebase actually has. It has to be *on the method*, and it has to survive into the
class file: `jakarta.validation.constraints.NotNull` is `RUNTIME`-retained, so it does.

The trap is that Bean Validation `@NotNull` and a mutation-testing suppression are unrelated ideas
that happen to share a name. Annotating an accessor for validation removes every `NULL_RETURNS`
mutant from it. Nothing in the report says a mutant was suppressed — it simply is not there, the
class's mutant count is lower, and its score is higher.

```java
public record Customer(String reference, Address address) {

    @NotNull                        // validation intent — also: no NULL_RETURNS mutant here
    public Address address() {
        return address;
    }
}
```

`lombok.@NonNull` and `org.springframework.lang.@NonNull` are **NonNull**, not **NotNull**, so they
do not match the suffix and suppress nothing. Two annotations that differ by one letter behave
oppositely.

## Where this connects

- **[03 · Mutators](03-mutators.md)** — the groups, and the single-swap difference between
  `DEFAULTS` and `OLD_DEFAULTS` that these five operators are.
- **[03c2 · Reading a returns survivor](03c2-reading-a-returns-survivor.md)** — what each of the
  five tells you when it lives, and the assertion that kills it.
- **[03b · Arithmetic mutators](03b-arithmetic-mutators.md)** — the operators that corrupt the
  computation rather than discard its result.
- **[03d · Optional mutators](03d-optional-mutators.md)** — including `RETURN_VALS` itself, if you
  ever need to reproduce an old score.
- **[04b · Equivalent mutants](04b-equivalent-mutants.md)** — what the four "already hard coded to
  return" filters are protecting you from.

## Gotchas

**★ `EMPTY_RETURNS` matches the declared return type by exact class name, with no subtype logic.**
`List` is in the table; `ArrayList`, `LinkedList` and `CopyOnWriteArrayList` are not. A method
declared to return `ArrayList` therefore gets a `NULL_RETURNS` mutant instead of an empty-list one,
which is strictly easier to kill. Returning interfaces improves your mutation report as a side
effect of being better style.

**★ `Optional` is in the table but `OptionalInt`, `OptionalLong` and `OptionalDouble` are not.**
Same for `Stream` versus `IntStream`, `LongStream` and `DoubleStream`. The primitive specialisations
fall through to `NULL_RETURNS`, whose mutant fails on the next method call. So the primitive stream
and optional APIs are measured less strictly than their generic siblings, and swapping `Stream<Integer>`
for `IntStream` as an optimisation quietly weakens the measurement of that method.

**★ A Bean Validation `@NotNull` on a method silently removes its `NULL_RETURNS` mutants.**
The check is `desc.endsWith("NotNull;")`, so `jakarta.validation.constraints.NotNull` matches just as
JetBrains' `@NotNull` does. Nothing in the report marks the suppression. If a class full of
annotated accessors scores unusually well, this is why — and the honest reading is that the score is
not comparable with a class that has no annotations.

**★ `lombok.@NonNull` and Spring's `@NonNull` do not suppress anything, because the name is different.**
`NonNull` does not end in `NotNull`. If you were relying on nullability annotations to suppress
mutants, you get suppression from one family and not from the other, with no diagnostic either way.

**★ A boxed `Boolean` return gets `TRUE_RETURNS`/`FALSE_RETURNS` and nothing else.**
`EmptyObjectReturnValsMutator` and `NullReturnValsMutator` both explicitly skip `java.lang.Boolean`.
So a method returning `Boolean` is never mutated to `null` by the default set, and the
three-state-boolean bug — `null` meaning "unknown" — is invisible to mutation testing here. That is
a real gap on any API that uses a nullable `Boolean` as a tri-state.

**★ `RETURN_VALS` in an inherited configuration means you are running the old default set.**
It is the one entry that distinguishes `OLD_DEFAULTS` from `DEFAULTS`. Worse, listing it *alongside*
`DEFAULTS` gives overlapping mutants on every return in the codebase — a bigger denominator, a
slower run, and a score that cannot be compared with anything. If it appears next to `DEFAULTS` in
your `mutators` list, delete it.

**★ The empty-return equivalence filter is a bytecode pattern match, and its own comment admits a hole.**
`EmptyReturnsFilter` matches the value being pushed and returned directly, or stored to a local and
loaded back. Its source comment warns about jump instructions reaching the return. A method that
computes `Collections.emptyList()` on one branch and something else on another may still produce an
equivalent mutant that the filter does not catch — which is one of the ways your score's ceiling
ends up below 100.

**★ Generic type parameters are invisible to the table, so `Optional<List<Order>>` is just `Optional`.**
The lookup uses the erased class name from the method descriptor. That is right, but it means the
mutant for a method returning `Optional<List<Order>>` is `Optional.empty()`, never
`Optional.of(emptyList())`. The "present but empty" case — a genuinely common bug — has no mutant at
all in the default set.

## Interview questions

**★ Why did PIT replace `RETURN_VALS` with five separate mutators?**
Because one operator could not be filtered per case. The five narrower operators each carry their own
equivalence filter — pitest's docs say for each of `EMPTY_RETURNS`, `TRUE_RETURNS`, `FALSE_RETURNS`
and `PRIMITIVE_RETURNS` that mutations to methods already hard-coded to return that value are
filtered out. `RETURN_VALS` mutating every object return to `null` produced unkillable mutants on
every method that already returned `null` on some path, with no way to suppress those without
suppressing the useful ones. The split is also why an old configuration and a modern one produce
different scores on identical code: `OLD_DEFAULTS` contains `RETURN_VALS`, `DEFAULTS` contains the
five.

**★ Why would returning `ArrayList` rather than `List` change your mutation score?**
Because `EMPTY_RETURNS` looks the declared return type up in a fixed table of fourteen class names,
and `java.util.ArrayList` is not one of them while `java.util.List` is. With `List` you get a mutant
that returns an empty list, which survives any assertion weaker than "these specific elements are in
it". With `ArrayList` the type falls through to `NULL_RETURNS`, whose mutant returns `null` and dies
the moment anything dereferences the result. The stricter measurement comes from the more abstract
declaration — a coincidence, but a useful one to know when a report on two similar classes looks
inconsistent.

**★ A team annotates their accessors with `@NotNull` for Bean Validation and their mutation score rises. Why?**
Pitest's `NULL_RETURNS` mutator checks whether the method carries any annotation whose descriptor
ends in `NotNull;` and skips it if so. It is meant for nullability annotations like JetBrains'
`@NotNull`, but the check is a string suffix, so `jakarta.validation.constraints.NotNull` matches
too. Those methods stop generating mutants at all. The score rises because the denominator fell, not
because anything got tested — a clean illustration of why a mutation score is never comparable
across a change to what gets mutated.

**★ How does PIT decide which of the five returns operators applies to a method?**
By the return type in the method descriptor, in a fixed precedence. `boolean` and `java.lang.Boolean`
go to `TRUE_RETURNS` and `FALSE_RETURNS`, and the other three operators explicitly exclude them.
Other primitives go to `PRIMITIVE_RETURNS`. Reference types are looked up in `EMPTY_RETURNS`'s
fourteen-entry table; if the exact class name is a key, `EMPTY_RETURNS` fires and `NULL_RETURNS`
stands down. Everything else falls to `NULL_RETURNS`, unless the method carries a `NotNull`-suffixed
annotation, in which case nothing fires. Each method therefore gets exactly one returns mutant per
return instruction, not five.

**★ Is it a problem that `NULL_RETURNS` is described as the "fallback" operator?**
It is a limitation worth naming. `NULL_RETURNS` produces the weakest mutant of the five, because
almost anything that touches the result kills it — a `null` propagates loudly. That means the great
majority of a domain codebase, whose methods return domain types rather than JDK collections, is
measured by the least demanding of the return operators. A high mutation score on a package of
value objects is therefore worth less than the same score on a package of methods returning
`List` and `Optional`. It is one of several reasons the number is only meaningful when read
alongside which operators produced it.

{/* FOOTER */}
