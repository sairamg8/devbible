---
title: "jqwik's test tree has three levels rather than two — container, property, try — so it needs six lifecycle annotations where Jupiter needs four, none of Jupiter's work here, and the level almost everyone gets wrong is that one instance of the test class serves every try of a single property"
sidebar_label: "03d · The jqwik lifecycle"
sidebar_position: 13
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against the **jqwik 1.10.1 user guide**, sections *Lifecycle*, *Simple
> Property Lifecycle*, *Annotated Lifecycle Methods*, *Annotated Lifecycle Variables*,
> *Single Property Lifecycle*, *Grouping Tests* and *Naming and Labeling Tests*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)); and the **JUnit Jupiter
> 6.0.3** user guide ([docs.junit.org](https://docs.junit.org/6.0.3/user-guide/)) for the
> Jupiter lifecycle it is contrasted with.
> Version spine: JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, JUnit Jupiter 6.0.3.
> ⚠️ **No sandbox and no test run on this machine** — documented lifecycle semantics only.

**Jupiter's test tree is two levels: a class contains test methods, and each method gets a
fresh instance. jqwik's is three, because a property is itself a container of *tries*. That
one extra level is the source of every lifecycle surprise here — where state lives, what gets
reset, which annotation runs a thousand times and which runs once. And because jqwik is a
separate engine ([02](02-the-stack-problem.md)), none of `@BeforeEach`, `@AfterEach`,
`@BeforeAll` or `@AfterAll` has any effect at all: they are Jupiter concepts, invisible to
this engine, and a `@BeforeEach` in a jqwik class is dead code that nothing warns you about.**

## The tree

The guide describes two kinds of element — containers and properties — and a typical tree:

```
Jqwik Engine
    class MyFooTests
        @Property fooProperty1()
        @Property fooProperty2()
        @Example  fooExample()
    class MyBarTests
        @Property barProperty()
        @Group class Group1
            @Property group1Property()
        @Group class Group2
            @Example  group2Example()
```

Two documented facts about this tree do most of the work:

> *"Mind that packages do not show up as in-between containers!"*

> *"For each property or example a new instance of the containing class will be created. Each
> property will have 1 to n tries. Usually each try gets its own set of generated arguments
> which are bound to parameters annotated with `@ForAll`."*

Read the second one twice. **A new instance per *property*, not per try.** All 1000 tries of
one property method share one instance of the test class. That is the single most important
sentence on this page, and it is the opposite of Jupiter's `PER_METHOD` default, where a fresh
instance means a fresh set of fields for every execution of the test body.

The guide's simple-lifecycle example makes the consequence explicit: a class with a
no-argument constructor and an `AutoCloseable.close()` gets the constructor and `close()`
called *"once for `anExample()` and once for `aProperty(...)`"* — and *"all five calls to
`aProperty(..)` will share the same instance"*.

## The six annotations, and the two levels they attach to

| Annotation | Runs | Static? |
|---|---|---|
| `@BeforeContainer` | Once, before any property of the class — *"even before the first instance of this class will be created"* | **Yes, must be static** |
| `@AfterContainer` | Once, after all properties of the class have run | **Yes, must be static** |
| `@BeforeProperty` | Once before each property or example (`@BeforeExample` is an alias) | Instance method |
| `@AfterProperty` | Once after each property or example (`@AfterExample` is an alias) | Instance method |
| `@BeforeTry` | Once before **each try** | Instance method |
| `@AfterTry` | Once after **each try** | Instance method |

The nesting is strict: container → property → try → property → container. On a property with
`tries = 1000`, `@BeforeProperty` runs once and `@BeforeTry` runs a thousand times. Getting
those two the wrong way round is how a property suite becomes slow: expensive setup in
`@BeforeTry` multiplies by `tries`, which is the difference between one second and sixteen
minutes.

```java
import net.jqwik.api.*;
import net.jqwik.api.lifecycle.*;

class LedgerPropertyTests {

    private static ExchangeRateTable rates;      // expensive, immutable, shared
    private Ledger ledger;                        // mutable, must be fresh per try

    @BeforeContainer
    static void loadRates() {                     // once for the whole class
        rates = ExchangeRateTable.loadFrom("rates-2024.csv");
    }

    @BeforeTry
    void freshLedger() {                          // once per generated input
        ledger = new Ledger(rates);
    }

    @Property
    void postingThenReversingLeavesTheBalanceUnchanged(@ForAll @Positive long amount) {
        Money before = ledger.balance();
        ledger.post(amount);
        ledger.reverseLast();
        assertThat(ledger.balance()).isEqualTo(before);
    }
}
```

Without `@BeforeTry`, `ledger` is created once and carries the state of 999 previous tries
into the thousandth — a property that passes or fails depending on generation order, which is
the property-based version of the shared-fixture problem in
[08 · Test data patterns](../08-test-data-patterns/README.md).

## `@BeforeTry` on a field, which is the feature nobody knows about

The guide gives `@BeforeTry` a second meaning that saves the boilerplate above for simple
cases:

> *"It can also be used on a test container class' member variable to make sure that it will
> be reset to its initial value - the one it had before the first try - for each try"*

```java
class BeforeTryMemberExample {

    @BeforeTry
    int theAnswer = 42;                 // reset to 42 before every try

    @Property
    void theAnswerIsAlways42(@ForAll int addend) {
        assertThat(theAnswer).isEqualTo(42);
        theAnswer += addend;            // mutation is discarded before the next try
    }
}
```

Note precisely what is restored: *"its initial value - the one it had before the first try"*.
For an `int` that is 42 every time. For an object field it is **the same reference**, restored
— not a fresh object. `@BeforeTry List<String> items = new ArrayList<>();` gives every try the
identical list instance, mutations and all, because the field is reassigned to the value it
held originally and that value is one mutable list. For anything mutable, use a `@BeforeTry`
*method* that constructs a new one.

## `@Group` and `@PerProperty`

Groups are jqwik's `@Nested`: *"you can group other containers by embedding another
non-static and non-private inner class and annotating it with `@Group`"*, and *"the lifecycle
of a test class is also applied to inner groups of that container"*. So an outer
`@BeforeProperty` runs before every property in every nested group.

`@PerProperty` is the escape hatch for one property that needs different lifecycle rules —
the guide's own example is a property that is *expected* to fail:

```java
@Property
@PerProperty(SucceedIfThrowsAssertionError.class)
void expectToFail(@ForAll int aNumber) {
    assertThat(aNumber).isNotEqualTo(1);
}

private class SucceedIfThrowsAssertionError implements PerProperty.Lifecycle {
    @Override
    public PropertyExecutionResult onFailure(PropertyExecutionResult result) {
        if (result.throwable().isPresent() && result.throwable().get() instanceof AssertionError) {
            return result.mapToSuccessful();
        }
        return result;
    }
}
```

This is a niche tool and worth knowing exactly one use for: testing your own generators and
arbitraries, where "this property must be falsifiable" is the thing you are asserting.

## Where this connects

- Why none of Jupiter's lifecycle annotations apply is
  [02 · An engine, not an extension](02-the-stack-problem.md).
- `tries`, which decides how many times `@BeforeTry` runs, is
  [03c · Attributes and defaults](03c-attributes-and-defaults.md); the runtime consequences
  are [12 · The cost](12-the-cost.md).
- Jupiter's own lifecycle — `@BeforeEach`, `PER_METHOD` versus `PER_CLASS`, execution order —
  belongs to [01 · JUnit 5](../01-junit-5/README.md).
- The shared-mutable-fixture failure this page's `@BeforeTry` prevents is the subject of
  [08 · Test data patterns](../08-test-data-patterns/README.md).

## Gotchas

**★ `@BeforeEach` in a jqwik test class is dead code and nothing tells you.**
It is a Jupiter annotation and jqwik's engine does not read it. The method compiles, is never
invoked, and the fields it was supposed to initialise stay null — so the symptom is a
`NullPointerException` in a property, which reads like a bug in the code under test. This is
the most common single mistake made by people moving a test class from Jupiter to jqwik, and
the fix is `@BeforeTry` or `@BeforeProperty` depending on which level the state belongs to.

**★ One instance of the test class serves all 1000 tries of one property, so instance fields bleed between tries.**
Jupiter developers carry the `PER_METHOD` habit across and assume a fresh instance per
execution. It is per *property*, not per try. A field mutated in try 1 is still mutated in try
2, so a property can pass when its inputs arrive in one order and fail in another — and
because the order changes with the seed, the failure looks like flakiness rather than like
shared state. `@BeforeTry` is the fix, on a method for anything mutable.

**★ Expensive setup in `@BeforeTry` is multiplied by `tries`, and the multiplier is 1000 by default.**
A `@BeforeTry` that builds a Spring-less object graph, parses a file or opens a connection
turns a one-second property into something you kill. The rule is level-matching: immutable and
expensive goes in `@BeforeContainer` (static, once per class); cheap and mutable goes in
`@BeforeTry`. If something is both expensive *and* must be fresh per try, that is a design
problem in the code under test, not a lifecycle question.

**★ `@BeforeContainer` and `@AfterContainer` must be static, and a non-static one is not a compile error.**
The guide specifies *"Static methods with this annotation will run exactly once before any
property of a container class will be executed"*. The reason is in the same sentence — it runs
before the first instance exists, so it cannot be an instance method. Writing it non-static
produces a lifecycle error at run time rather than a red squiggle in the IDE.

**★ `@BeforeTry` on a mutable field restores the reference, not the object, so a `@BeforeTry List` is shared across every try.**
The documented behaviour is that the variable is reset to *the value it had before the first
try*. For `int theAnswer = 42` that is exactly what you want. For
`List<String> log = new ArrayList<>()` the "initial value" is one particular list instance,
and resetting the field to it every try hands every try the same, progressively fuller list.
This is a silent correctness bug in the test, and it looks like the code under test
accumulating state. Use a method for anything with identity.

**★ `@BeforeProperty` runs once per property, which means it also runs before an `@Example` — including examples that need none of it.**
The guide lists `@BeforeExample` as an alias of `@BeforeProperty` precisely because they are
the same hook. A class mixing properties and examples pays the property setup for every
example too. That is usually harmless and occasionally not, and it is a reason to keep
regression examples in a Jupiter table rather than in the jqwik class, as
[03](03-a-property.md) argues.

**★ Group lifecycles nest downward but not upward, and packages are not containers at all.**
An outer class's `@BeforeProperty` runs for properties inside its `@Group`s; a group's own
lifecycle methods do not run for the outer class's properties. And the guide's warning that
*"packages do not show up as in-between containers"* means there is no package-level
`@BeforeContainer` — the largest scope jqwik offers you is one top-level class. Anything wider
needs a static holder or a `@BeforeContainer` repeated per class.

**★ A `@Group` class must be non-static and non-private, and making it `static` out of habit silently removes the group.**
Java developers write `static class` on nested classes by reflex, because Jupiter's `@Nested`
requires non-static and IDEs suggest `static` for everything else. The guide requires
*"another non-static and non-private inner class"*. A `static @Group` class is not discovered,
so its properties vanish from the run — another silent-green outcome.

## Interview questions

**★ How many times does each of `@BeforeContainer`, `@BeforeProperty` and `@BeforeTry` run for a class with two properties at the default `tries`?**
`@BeforeContainer` once, `@BeforeProperty` twice, `@BeforeTry` two thousand times.
`@BeforeContainer` is static and runs before any instance of the class exists; `@BeforeProperty`
runs once per property or example, and a new instance of the class is created for each of those;
`@BeforeTry` runs before every single generated parameter set, which is `tries` per property
and defaults to 1000. The practical consequence is the whole reason to know the numbers:
anything expensive must be at the container level, and anything mutable must be at the try
level, and if something is both then the design needs looking at rather than the annotations.

**★ Why does jqwik need six lifecycle annotations where Jupiter needs four?**
Because its test tree has an extra level. In Jupiter the leaves are test methods, so you need
"around the class" and "around the method" — `@BeforeAll`/`@AfterAll` and
`@BeforeEach`/`@AfterEach`. In jqwik a property method is itself a container of tries, so
"around the method" splits into two genuinely different things: around the whole property, and
around each generated execution of it. That gives container / property / try, six annotations,
and the design decision that follows from it — one instance of the test class per property
rather than per try, which is where state bleeds if you do not use `@BeforeTry`.

**★ A property passes on your machine and fails in CI, and the class has an instance field mutated inside the property. Explain the mechanism.**
The single instance of the test class is shared by all tries of that property, so the field
accumulates across the thousand executions. Whether the accumulated state breaks the assertion
depends on which values arrive in which order — and the order is determined by the random
seed, which differs between your run and CI's, because CI has no `.jqwik-database` to replay
from and starts fresh. So this is not "flaky CI"; it is a test with hidden state whose failure
is a function of the seed, and it will eventually fail on your machine too. The fix is a
`@BeforeTry` method that reassigns the field to a new object — not a `@BeforeTry` on the field
itself, because that restores the original reference rather than constructing a fresh one.

**★ When would you use `@PerProperty`?**
Rarely, and the one case I would defend is testing generators and arbitraries themselves,
where the assertion is "this property must be *falsifiable*". Ordinary lifecycle hooks cannot
express that, because a falsified property is a failed test; `PerProperty.Lifecycle.onFailure`
lets you inspect the `PropertyExecutionResult` and call `mapToSuccessful()` when the failure is
the one you expected — which is exactly the guide's own example. Outside of testing your own
test infrastructure, a property that is expected to fail is a smell, and I would want to
understand why it exists before reaching for the mechanism.

{/* FOOTER */}
