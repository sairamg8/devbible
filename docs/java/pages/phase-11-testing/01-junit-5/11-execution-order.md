---
title: "Jupiter orders test methods with an algorithm it describes as deterministic but intentionally nonobvious, and that phrase is a design position rather than an implementation detail — the order is stable so builds repeat, and unguessable so you cannot accidentally depend on it"
sidebar_label: "11 · Execution order"
sidebar_position: 37
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Test Execution Order"
> ([writing-tests/test-execution-order](https://docs.junit.org/6.0.3/writing-tests/test-execution-order.html))
> and the JUnit 6.0.0 release notes
> ([release-notes](https://docs.junit.org/6.0.3/release-notes.html));
> javadoc for `@Order`
> ([Order](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/Order.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**Two properties, deliberately held together: the order is the *same* every run, and it is
*not* one you would guess. The first makes builds repeatable. The second makes an accidental
dependency on order impossible to acquire without noticing. Understanding that the second
one is on purpose is what stops you treating `@TestMethodOrder` as the fix for a failing
test.**

Randomised ordering and its seed are [11b · random order](11b-random-order.md); class
ordering — `ClassOrderer`, `@TestClassOrder` and `@Nested` — is
[11c · class order](11c-class-order.md); the argument about when ordering is legitimate at
all is [11d · when order is a smell](11d-when-order-is-a-smell.md).

## The default, quoted

> *"By default, test classes and methods will be ordered using an algorithm that is
> deterministic but intentionally nonobvious. This ensures that subsequent runs of a test
> suite execute test classes and test methods in the same order, thereby allowing for
> repeatable builds."*

Both halves are load-bearing.

**Deterministic.** A failure you can reproduce is a failure you can fix. If the order changed
between runs, an order-dependent failure would be a flake
([14 · flaky tests](14-flaky-tests.md)) and you would spend the afternoon on it.

**Intentionally nonobvious.** It is not alphabetical, not source order, and not declaration
order in the class file. Every one of those would be *guessable*, and a guessable order is one
that people quietly rely on — writing `testCreate` and `testUpdate` and `testDelete` in the
comfortable belief that the letters do the work. Jupiter refuses to give you the rope.

The same phrase governs extension field registration ([10f](10f-registration-order.md)) and
`@AutoClose` field order ([09d](09d-autoclose.md)). It is a house style: when Jupiter does not
want you to depend on an order, it makes the order stable and strange.

⚠️ There is a lot of folklore in Java teams about test methods running "in alphabetical
order" or "in the order they are declared". Whatever its origin, the Jupiter documentation
says the opposite in the sentence above, and it is the only statement that binds. If a
colleague names a test `test1_setup`, the name is doing nothing.

## `@TestMethodOrder` and the four built-in orderers

> *"To control the order in which test methods are executed, annotate your test class or test
> interface with `@TestMethodOrder` and specify the desired `MethodOrderer` implementation.
> You can implement your own custom `MethodOrderer` or use one of the following built-in
> `MethodOrderer` implementations."*

| Orderer | What it sorts on |
|---|---|
| `MethodOrderer.DisplayName` | *"sorts test methods alphanumerically based on their display names"* |
| `MethodOrderer.MethodName` | *"sorts test methods alphanumerically based on their names and formal parameter lists"* |
| `MethodOrderer.OrderAnnotation` | *"sorts test methods numerically based on values specified via the `@Order` annotation"* |
| `MethodOrderer.Random` | *"orders test methods pseudo-randomly and supports configuration of a custom seed"* |

Note the detail in `MethodName`: **names *and formal parameter lists***. That is what makes
the sort total for a class containing overloads — two methods with the same name are separated
by their parameter lists rather than left tied.

And note what `DisplayName` implies: if you use `@DisplayName` for readable sentences
([06](06-naming-and-display-names.md)), sorting by display name sorts by an English sentence,
and inserting the word "and" into a name reorders your suite. That is a coupling between
documentation and execution that almost nobody wants.

The guide's example of the one that is actually used:

```java
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

@TestMethodOrder(OrderAnnotation.class)
class OrderedTestsDemo {

    @Test
    @Order(1)
    void nullValues() {
        // perform assertions against null values
    }

    @Test
    @Order(2)
    void emptyValues() {
        // perform assertions against empty values
    }

    @Test
    @Order(3)
    void validValues() {
        // perform assertions against valid values
    }

}
```

🔴 **`@Order` alone does nothing.** Without `@TestMethodOrder(OrderAnnotation.class)` on the
class, the annotation is inert — no error, no warning, and a test suite that looks ordered and
is not. This is the single most common mistake on this page, and it is silent.

## `@Order` is one annotation serving three categories

> *"`@Order` is an annotation that is used to configure the order in which the annotated
> element (i.e., field, method, or class) should be evaluated or executed relative to other
> elements of the same category. When used with `@RegisterExtension` or `@ExtendWith`, the
> category applies to extension fields. When used with `MethodOrderer.OrderAnnotation`, the
> category applies to test methods. When used with `ClassOrderer.OrderAnnotation`, the
> category applies to test classes."*

`@Target({ FIELD, METHOD, TYPE })`. The same annotation you met ordering extension fields
([10f](10f-registration-order.md)) orders test methods and test classes, and the value means
something different in each category. And the default is the same number in all three:

> *"`DEFAULT` — Default order value for elements not explicitly annotated with `@Order`, equal
> to the value of `Integer.MAX_VALUE / 2`."*

> *"If `@Order` is not explicitly declared on an element, the `DEFAULT` order value will be
> assigned to the element."*

So under `OrderAnnotation` a class where **half** the methods are annotated is not half
ordered: the unannotated ones all share `Integer.MAX_VALUE / 2` and fall back to the
tie-breaking behaviour among themselves, sitting after any `@Order(1)` and before any
`@Order(Integer.MAX_VALUE)`. Partial annotation is a partial guarantee.

## Inheritance into `@Nested`, and how to stop it

> *"The `MethodOrderer` configured on a test class is inherited by the `@Nested` test classes
> it contains, recursively. If you want to avoid that a `@Nested` test class uses the same
> `MethodOrderer` as its enclosing class, you can specify `MethodOrderer.Default` together
> with `@TestMethodOrder`."*

**Recursively** — every level down. So one `@TestMethodOrder(OrderAnnotation.class)` on an
outer class means every `@Nested` class inside it is now also `@Order`-driven, and every
method in them that lacks an `@Order` shares the default value. If you ordered the outer class
for a genuine reason and the nested classes are ordinary unit tests, they have silently
inherited a policy nobody chose:

```java
@Nested
@TestMethodOrder(MethodOrderer.Default.class)
class TheseAreJustUnitTests {
}
```

`MethodOrderer.Default` is the way back to the deterministic-but-nonobvious algorithm. It is
easy to miss that it exists, and the alternative — leaving the annotation off — does *not*
work, because inheritance is the default.

🔴 **Both halves of that are new in JUnit 6.** The 6.0.0 release notes list them as separate
improvements:

> *"For consistency with `@TestClassOrder`, `@TestMethodOrder` annotations specified on a test
> class are now inherited by its `@Nested` inner classes, recursively."*

> *"New `MethodOrderer.Default` and `ClassOrderer.Default` types for reverting back to default
> ordering on a `@Nested` class and its `@Nested` inner classes when an enclosing class
> specifies a different orderer via `@TestMethodOrder` or `@TestClassOrder`, respectively."*

So on JUnit 5 a `@Nested` class did **not** inherit its enclosing class's `MethodOrderer`, and
`MethodOrderer.Default` did not exist. A codebase upgrading from 5 to 6 can find nested classes
newly subject to an orderer nobody applied to them — and, under `OrderAnnotation`, every
unannotated method in them collapsing to the same `Integer.MAX_VALUE / 2`.

## The global default

> *"You can use the `junit.jupiter.testmethod.order.default` configuration parameter to
> specify the fully qualified class name of the `MethodOrderer` you would like to use by
> default. … The default orderer will be used for all tests unless the `@TestMethodOrder`
> annotation is present on an enclosing test class or test interface."*

In `src/test/resources/junit-platform.properties`:

```properties
junit.jupiter.testmethod.order.default = \
    org.junit.jupiter.api.MethodOrderer$OrderAnnotation
```

Note the `$` — it is a nested class, so the binary name uses a dollar sign, and in a
`.properties` file the line continuation is a trailing backslash. Getting either wrong gives
you a class that cannot be loaded.

Setting this globally to `OrderAnnotation` is almost always wrong: it makes every unannotated
method in the entire suite share `Integer.MAX_VALUE / 2` and buys nothing. Setting it globally
to `Random` is a genuinely useful thing to do, for the reasons in
[11b](11b-random-order.md).

## Gotchas

**★ `@Order` on a method with no `@TestMethodOrder` on the class.**
Completely inert. No error, no warning, and a suite that reads as ordered and is not. If a
test only passes "when the order is right", check for the class-level annotation before
anything else.

**★ Annotating only some methods with `@Order`.**
Everything unannotated gets `Integer.MAX_VALUE / 2`, so you have partitioned the class into
"before", "unspecified" and "after" rather than ordering it. That is fine if it is what you
meant and a trap if you thought you had a total order.

**★ Forgetting that `@TestMethodOrder` is inherited by `@Nested` classes, recursively.**
One annotation on an outer class applies a policy to every nested class beneath it. Opt a
nested class out with `@TestMethodOrder(MethodOrderer.Default.class)` — leaving the annotation
off does not work.

**★ Using `MethodOrderer.DisplayName` with sentence-style `@DisplayName`s.**
Your execution order is now alphabetised English. Rewording a display name for clarity
reorders the suite, and if anything depended on that order it breaks in a commit whose diff is
a string.

**★ Setting `junit.jupiter.testmethod.order.default` to `OrderAnnotation` globally.**
Every method in the suite that lacks `@Order` now shares one value. You have not ordered
anything; you have added a configuration parameter that makes readers think you did.

**★ Getting the nested-class name wrong in the properties file.**
`org.junit.jupiter.api.MethodOrderer$OrderAnnotation` — a `$`, not a `.`, because it is a
nested class and the parameter takes a *fully qualified class name* that has to load. A dot
gives you a class-not-found at startup.

**★ Upgrading 5 → 6 with a `@TestMethodOrder` on an outer class.**
Nested-class inheritance of `@TestMethodOrder` is new in JUnit 6. Classes that were previously
running in the default order are now running under the enclosing class's orderer, and nothing
warns you. Audit outer classes carrying `@TestMethodOrder` and add
`@TestMethodOrder(MethodOrderer.Default.class)` to nested classes that should not inherit.

**★ Assuming `@TestMethodOrder` changes anything about `@BeforeEach`.**
It orders test methods relative to each other. Lifecycle callbacks and extensions still wrap
each test the way [03c](03c-inheritance-and-wrapping.md) describes, and a new test instance is
still constructed per method unless the class is `PER_CLASS`
([03b](03b-per-class-lifecycle.md)).

**★ Ordering methods and then enabling parallel execution.**
`@TestMethodOrder` orders the *submission* of methods; it does not serialise them. Under
`CONCURRENT` mode the ordering guarantee you thought you had is gone
([12 · parallel execution](12-parallel-execution.md)). Ordered methods that must not overlap
need `@Execution(SAME_THREAD)` or `@ResourceLock` as well.

## Interview questions

**★ What order do JUnit 5 tests run in by default, and why that order?**
Deterministic but intentionally nonobvious — the guide's own phrase. Deterministic so that
repeated runs behave identically and an order-dependent failure is reproducible rather than
flaky; nonobvious so that nobody can accidentally come to depend on it. It is specifically not
alphabetical and not source order, and the JUnit 4 folklore about alphabetical ordering does
not apply.

**★ I put `@Order` on my test methods and nothing changed. Why?**
`@Order` is inert unless a `MethodOrderer` that reads it is active — normally
`@TestMethodOrder(MethodOrderer.OrderAnnotation.class)` on the class, or the
`junit.jupiter.testmethod.order.default` configuration parameter set to that orderer's fully
qualified name. There is no diagnostic for the missing annotation.

**★ What happens to methods without `@Order` under `OrderAnnotation`?**
They are assigned `Order.DEFAULT`, which is `Integer.MAX_VALUE / 2`, so they sort after
anything with a lower explicit value and before anything with a higher one, and among
themselves they are not ordered by anything you specified. Partial annotation gives a partial
order, not a total one.

**★ What are the four built-in `MethodOrderer`s and when would each be right?**
`OrderAnnotation` when a genuine sequence has to be expressed explicitly; `Random` as a tool
for *detecting* order dependence; `MethodName` and `DisplayName` essentially never for
behaviour, since they couple execution order to identifiers or to prose. There is also
`MethodOrderer.Default`, which is how a `@Nested` class opts out of an inherited orderer.

**★ Does `@TestMethodOrder` on an outer class affect its `@Nested` classes?**
On JUnit 6, yes — recursively, at every level — and the only way to opt a nested class out is
`@TestMethodOrder(MethodOrderer.Default.class)`, because omitting the annotation inherits
rather than resets. Both the inheritance and the `MethodOrderer.Default` type are new in 6.0;
on JUnit 5 nested classes did not inherit their enclosing class's orderer, which makes this a
behaviour change worth auditing on upgrade.

{/* FOOTER */}
