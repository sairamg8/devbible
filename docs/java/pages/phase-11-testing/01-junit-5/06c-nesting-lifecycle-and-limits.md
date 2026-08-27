---
title: "Each level of a nesting hierarchy gets its own full lifecycle, which means its own @BeforeAll, its own @TestInstance mode, and no inheritance of either from the class that encloses it"
sidebar_label: "06c · Nesting: lifecycle and limits"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Nested Tests"
> ([nested-tests](https://docs.junit.org/6.0.3/writing-tests/nested-tests.html)),
> "Annotations"
> ([annotations](https://docs.junit.org/6.0.3/writing-tests/annotations.html)) and
> "Test Instance Lifecycle"
> ([test-instance-lifecycle](https://docs.junit.org/6.0.3/writing-tests/test-instance-lifecycle.html));
> the `@Nested` javadoc
> ([Nested](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/Nested.html));
> and **JLS SE 25 §8.1.3** on `static` members in inner classes
> ([jls-8.html](https://docs.oracle.com/javase/specs/jls/se25/html/jls-8.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**[06b](06b-nested-tests.md) established that nesting is hierarchical `@BeforeEach`. This
chunk is everything each level may declare for itself — and the recurring mistake underneath
all of it, which is reading nesting as inheritance. It is not. An enclosing class is not a
superclass, and almost every surprise in this chunk follows from that one fact.**

## 🔴 `@BeforeAll` in a nested class — the rule that expired at Java 16

Almost every article about `@Nested` says a nested class cannot declare `@BeforeAll`. On
JUnit 6 that is **wrong**, and it is worth knowing why, because the reasoning was correct
for a decade.

The Jupiter rule has not changed. From the annotations table, `@BeforeAll` methods

> *"must be `static` unless the "per-class" test instance lifecycle is used."*

What changed is Java. JLS SE 25 §8.1.3:

> *"an inner class may declare and inherit `static` members … and declare static
> initializers, even though the inner class itself is not `static`."*

with the historical note:

> *"Prior to Java SE 16, an inner class could not declare static initializers, and could
> only declare `static` members that were constant variables."*

JUnit 6 baselines Java 17. So on any codebase that can run JUnit 6 at all, this compiles
and runs:

```java
@Nested
class WhenTheAccountIsFrozen {

    @BeforeAll
    static void loadTheFrozenAccountFixture() { /* ... */ }

    @BeforeEach
    void freezeIt() { /* ... */ }
}
```

`@TestInstance(PER_CLASS)` on the nested class is still available and still removes the
`static` requirement — see [03b · Per-class lifecycle](03b-per-class-lifecycle.md) for what
else that flips, including the parallel-execution block. It is now a **choice between two
working options**, not a workaround for a language restriction.

⚠️ The choice is not free either way. A `static @BeforeAll` in an inner class cannot touch
the enclosing instance's fields — it runs before any instance exists — so the one-time setup
it does must be genuinely independent of the outer circumstance. If it needs the outer
state, you want `PER_CLASS`, or you want that setup in `@BeforeEach`.

## `@Nested` and `@TestInstance`

The `@Nested` javadoc is precise about what a nested class controls:

> a nested class *"can be configured with its own `TestInstance.Lifecycle` mode which may
> differ from that of an enclosing test class"*

and

> it *"cannot change the `TestInstance.Lifecycle` mode of an enclosing test class"*.

Nesting is **not** inheritance. `@TestInstance` is `@Inherited`, which is a
class-*hierarchy* mechanism; an enclosing class is not a superclass. Putting
`@TestInstance(PER_CLASS)` on the outer class does nothing for the inner one.

## Nesting and the other annotations

- **`@DisplayName`** on each level is what makes the report a sentence. Nesting without
  display names produces a tree of Java identifiers, which is better than a flat list but
  well short of the payoff. `@DisplayNameGeneration` on the outermost class applies down the
  tree, and `IndicativeSentences` is designed for exactly this shape — see
  [06 · Naming and display names](06-naming-and-display-names.md).
- **`@Tag`** on an outer class applies to the tests in its nested classes.
- **`@Nested` combines with `@ParameterizedClass`**: *"`@Nested` may be combined with
  `@ParameterizedClass` in which case the nested test class is parameterized."* The guide's
  `FruitTests` example parameterizes the outer class over fruits, the nested class over
  quantities, and the test method over durations — a three-level cross product. See
  [03 · Parameterized tests](../03-parameterized-tests/01-one-test-many-cases.md).

## When nesting is the wrong tool

Nesting is for **circumstances**, not for taxonomy. Two shapes that look like nesting and
are not:

- **One nested class per method under test.** `class Deposit`, `class Withdraw`,
  `class Close`. That is not a tree of preconditions; it is a table of contents, and it adds
  a level of indentation for no shared setup at all. Separate test classes are clearer.
- **Nesting to reach four or five levels because each level adds one field.** The setup is
  now spread across five `@BeforeEach` methods in five classes, and reading a failing test
  means reading all five. Past two or three levels a builder ([08 · Test data
  patterns](../08-test-data-patterns/README.md)) says more in less space.

The test for whether a nested class earns its keep: **can you read its `@DisplayName` as a
clause that narrows the one above it?** "when new" narrows "a stack". "Deposit" narrows
nothing.

## Gotchas

**★ Expecting outer `@TestInstance(PER_CLASS)` to reach the nested class.**
It does not. Nesting is not inheritance; the javadoc states the nested class configures its
own mode and cannot change the enclosing one. Annotate the nested class itself.

**★ Assuming a nested class's `@BeforeAll` cannot exist, and reaching for `PER_CLASS`
reflexively.**
True before Java 16, false on JUnit 6's Java 17 baseline. `PER_CLASS` still costs you the
isolation guarantee and this class's eligibility for parallel execution — paying that to
work around a restriction the language removed is a bad trade.

**★ Nesting order is not execution order you can rely on.**
Nested classes are ordered by the same rules as everything else in Jupiter — deterministic
but intentionally not obvious, and configurable. Writing tests that depend on `WhenNew`
running before `AfterPushing` as *sibling classes* is the mistake; the hierarchy guarantees
setup order, not sibling order. See
[11 · Execution order](11-execution-order.md).

**★ A `@Nested` class inside a `@SpringBootTest` inherits the context, and that surprises
people in both directions.**
The nested class participates in the same context by default, which is usually what you
want and occasionally exactly what you do not — a nested class that needs a different
property set needs its own annotations, and adding them may fork the context cache. Phase
11 topic 05 covers the cache cost.

**★ Very deep nesting plus `@DisplayName` produces reports nobody reads.**
Four levels of clause make a display name that wraps in every tool. The specification
reading works at two or three levels and degrades fast after that.

**★ `@BeforeAll` inside a nested class runs once per nested class, not once per outer
class.**
"Full lifecycle support … on each level" means each level gets its own. Two nested classes
each declaring `@BeforeAll` gives you two executions, plus the outer class's own — which is
correct and is not what "before all" reads like in English.

## Interview questions

**★ Can a `@Nested` class declare `@BeforeAll`?**
On JUnit 6, yes. Jupiter's rule — `@BeforeAll` must be `static` unless the per-class
lifecycle is used — is unchanged, but JLS SE 25 §8.1.3 allows `static` members in inner
classes and JUnit 6 baselines Java 17. Before Java SE 16 it was impossible without
`@TestInstance(PER_CLASS)`, which is why so much published material says it cannot be done.

**★ Does `@TestInstance(PER_CLASS)` on the outer class apply to nested classes?**
No. `@TestInstance` is inherited through class hierarchies, and an enclosing class is not a
superclass. The `@Nested` javadoc says a nested class may be configured with its own
lifecycle mode and cannot change the enclosing class's. Annotate the nested class.

**★ How deep should you nest, and what is the limit?**
The technical limit is none — *"nesting can be arbitrarily deep"*. The practical limit is
how far you can read: past two or three levels, reconstructing the state a failing test ran
against means reading four or five `@BeforeEach` methods, and the display names stop fitting
in any report. Beyond that, a test-data builder expresses the state in one visible place.

**★ Give a case where `@Nested` is the wrong choice.**
One nested class per method under test. There is no shared precondition being narrowed —
`Withdraw` does not narrow the circumstance that `Deposit` established — so nesting buys
indentation and a report tree while providing none of the lifecycle benefit. Separate test
classes, or plain grouping by display name, say the same thing more simply.

{/* FOOTER */}
