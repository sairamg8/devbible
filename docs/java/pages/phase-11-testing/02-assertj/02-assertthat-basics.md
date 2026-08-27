---
title: "assertThat returns a typed assert object chosen from the static type of its argument and every assertion returns itself, and almost every AssertJ surprise is a consequence of those two facts"
sidebar_label: "02 · assertThat and the chain"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the AssertJ Core documentation — "Use Assertions class entry
> point", "A simple example", "Supported type assertions" and "Avoiding incorrect usage"
> ([assertj.github.io/doc](https://assertj.github.io/doc/#assertj-core-quick-start)) —
> and the `assertj-core` 3.27.7 sources (`org.assertj.core.api.AbstractAssert`,
> `org.assertj.core.api.Assertions`, `org.assertj.core.api.InstanceOfAssertFactories`).
> JDK 25 · Spring Boot 4.1.0 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**One static import gives you the whole library, one overload picks the assert type from
the static type of the argument, and every assertion returns `this` so you can keep going.
That design gives you code completion as documentation and chained assertions as a
sentence — and it gives you two traps that cost real time: a chain stops dead at the first
failure, so anything you wrote after it never ran, and configuration calls placed after an
assertion are silently ignored for exactly that reason.**

## One import, or eleven

The reference is blunt about the entry point:

> *"The `Assertions` class is the only class you need to start using AssertJ, it provides
> all the methods you need."*

```java
import static org.assertj.core.api.Assertions.*;
```

The documentation's alternative is a list of the specific imports worth knowing, and the
list is a decent map of the library's shape:

```java
import static org.assertj.core.api.Assertions.assertThat;  // main one
import static org.assertj.core.api.Assertions.atIndex;     // for List assertions
import static org.assertj.core.api.Assertions.entry;       // for Map assertions
import static org.assertj.core.api.Assertions.tuple;       // when extracting several properties at once
import static org.assertj.core.api.Assertions.filter;      // for Iterable/Array assertions
import static org.assertj.core.api.Assertions.offset;      // for floating number assertions
import static org.assertj.core.api.Assertions.anyOf;       // use with Condition
import static org.assertj.core.api.Assertions.contentOf;   // use with File assertions
```

Two alternative entry points exist and both are real choices, not curiosities:

- **`WithAssertions`** — an interface your test class implements; the `assertThat` methods
  arrive as inherited default methods and you need no static import at all. Useful when a
  team's IDE settings fight over import organisation.
- **`BDDAssertions.then`** — the same API with `assertThat` renamed to `then`, so a test
  reads `given / when / then`. Purely a naming choice; the assertions and the failure
  messages are identical.

## The overload is chosen from the *static* type

`assertThat` is a very large set of overloads. The one the compiler picks determines every
assertion you can then call. The documentation's supported-type list is long — `BigDecimal`,
`CharSequence`, `Class`, `Date`, `File`, `Future`, `InputStream`, `Iterable`, `Iterator`,
`List`, `Map`, `Object`, `Optional`, `Path`, `Predicate`, `Stream`, `String`, `Throwable`,
every primitive and its wrapper, every primitive array and 2-D array, the `java.time`
temporals, and the atomics — but the important word is **static**:

```java
Object o = "frodo";
assertThat(o).startsWith("fro");  // does not compile: ObjectAssert has no startsWith
```

The runtime value is a `String`; the compiler saw `Object`, so you got an `ObjectAssert`.
This is the single most common "why can't I call the assertion I can see in the javadoc"
question, and the fix is `asInstanceOf`:

```java
import static org.assertj.core.api.Assertions.as;
import static org.assertj.core.api.InstanceOfAssertFactories.STRING;

assertThat(o).asInstanceOf(STRING).startsWith("fro");
```

`asInstanceOf(InstanceOfAssertFactory)` asserts the runtime type *and* narrows the assert
object in one step, so the failure when `o` is not a `String` is a type assertion failure
rather than a `ClassCastException`. `Assertions.as(...)` is, in the documentation's own
words, *"just synthetic sugar for readability"* — it is the same factory, wrapped so the
call site reads as a cast.

## Chaining: every assertion returns `SELF`

`AbstractAssert<SELF, ACTUAL>` is self-typed — the first type parameter is the concrete
subclass — which is how a chain keeps the narrow type all the way along:

```java
assertThat("The Lord of the Rings").isNotNull()
                                   .startsWith("The")
                                   .contains("Lord")
                                   .endsWith("Rings");
```

The documentation's own annotation on that example is worth keeping in mind: *"Except for
`isNotNull` which is a base assertion, the other assertions are String specific as our
object under test is a String."*

**The chain is strictly sequential and stops at the first failure.** An assertion that
fails throws; nothing after it in the chain executes. That is obvious stated plainly and
is the cause of two separate, non-obvious problems.

### Consequence 1 — you only ever see the first failure

Three chained assertions on the same object report one difference per run, so a change
that breaks all three takes three runs to fully diagnose. That is exactly the case
[06 · Soft assertions](06-soft-assertions.md) exists for.

### Consequence 2 — configuration placed after an assertion never runs

This is the trap. `as()`, `withFailMessage()`, `overridingErrorMessage()` and
`usingComparator()` are ordinary methods on the chain. If the assertion before them fails,
they are never called; if the assertion before them succeeds, they apply only to whatever
comes *after*. The documentation lists all four as misuse, in these words:

> *"Describing an assertion must be done before calling the assertion. Otherwise it is
> ignored as a failing assertion will prevent the call to `as()`."*

```java
// DON'T DO THIS ! as/describedAs have no effect after the assertion
assertThat(actual).isEqualTo(expected).as("description");

// DO THIS: use as/describedAs before the assertion
assertThat(actual).as("description").isEqualTo(expected);
```

Same for the failure message and the comparator:

```java
// DON'T DO THIS ! Comparator is not used
assertThat(actual).isEqualTo(expected).usingComparator(new CustomComparator());

// DO THIS:
assertThat(actual).usingComparator(new CustomComparator()).isEqualTo("a");
```

There is no compile error and no warning. The code reads as if the description or the
comparator applied, and it does not. Rule of thumb: **anything that configures the
assertion goes between `assertThat(...)` and the first assertion, always.**

## Navigation calls reset what you configured

Some methods on the chain do not return `SELF` at all — they return a *different* assert
over a *different* actual. `asInstanceOf`, `extracting`, `first()`, `singleElement()`,
`cause()`, `get()` on an `Optional`: all of them navigate. Everything you set before the
navigation applied to the outer assert; the assert you get back is new. If you want a
description on the inner assertions, set it again after navigating.

That distinction — assertions return `SELF`, navigation returns something else — is worth
holding on to, because it explains the shape of half this topic:
[03c · extracting](03c-extracting.md) and
[03e · Filtering and navigating](03e-filtering-and-navigating.md) are both about what the
navigated assert can and cannot do.

## Gotchas

**★ `as()` after the assertion is silently ignored — and so is `withFailMessage` and
`usingComparator`.**
All three are documented misuses for the same reason: a failing assertion throws before
the configuring call is reached. Put every configuring call immediately after
`assertThat(...)`.

**★ Declaring the variable as `Object` (or letting a wildcard leak through) collapses your
assertion API.**
Overload resolution is on the static type. A method returning `List<?>` or a field typed
`Object` gets you `ObjectAssert` and none of the type-specific assertions. Narrow with
`asInstanceOf(InstanceOfAssertFactories.X)` rather than casting, so a wrong type produces
an assertion failure instead of a `ClassCastException`.

**★ Chaining hides all failures but the first.**
Three assertions in a chain need three runs to fully diagnose a broken object. Chaining is
not a substitute for soft assertions; it is the thing soft assertions exist to fix.

**★ `WithAssertions` and a static import of `Assertions.*` in the same class is legal and
confusing.**
Both provide `assertThat`; the inherited default method and the static import can produce
ambiguity errors on some overloads and quietly resolve to one on others. Choose an
entry-point style once, per source set.

**★ A `BDDAssertions.then` test mixed with `Assertions.assertThat` tests is not wrong, it
is just unreviewable.**
Nothing breaks. But a reader scanning for assertions now has two keywords to look for, and
`then` is also a common variable and method name. Pick one.

**★ `asInstanceOf` is a navigation call, so anything you configured before it does not
follow you in.**
Reapply `as(...)` after narrowing if you want the description on the inner assertions.
The same applies to `extracting`, `first()`, `cause()` and `get()`.

**★ Auto-completion after the dot is the documented discovery mechanism, and it is also
how you end up using an assertion that means something subtly different.**
`contains` on a `String` is a substring check; `contains` on an `Iterable` is an
any-order membership check; `contains` on an `Optional` is a value equality check. Same
name, three different contracts. Read the assertion, not the completion popup.

**★ A `var` declaration is fine; a `var` over a builder or a wildcard-typed method is not
always.**
`var` infers the most specific type available, which usually helps. But `var result =
repo.findAll();` where `findAll` returns `List<? extends Foo>` still lands you on the
wildcard, and the elements' assert type degrades accordingly.

## Interview questions

**★ Why does `assertThat(someObject).startsWith("x")` fail to compile when the object is
really a String?**
Because `assertThat` overload resolution happens at compile time against the *static* type
of the argument. A variable declared `Object` selects `assertThat(Object)`, which yields an
`ObjectAssert`, and `startsWith` exists on `AbstractCharSequenceAssert`, not on
`ObjectAssert`. The runtime type is irrelevant to the compiler. `asInstanceOf(STRING)`
checks the runtime type as an assertion and hands back a `StringAssert`.

**★ Explain why `assertThat(x).isEqualTo(y).as("the total")` produces a failure with no
description.**
`as()` is a method on the assert object, and `isEqualTo` throws when it fails, so `as()` is
never invoked on the failing path. On the passing path `as()` runs but there is no
subsequent assertion for the description to attach to. Either way the description is
useless. The same reasoning applies to `withFailMessage`, `overridingErrorMessage` and
`usingComparator`, and the documentation lists all four together under "Avoiding incorrect
usage".

**★ How does a fluent chain keep the narrow type across ten calls?**
`AbstractAssert<SELF extends AbstractAssert<SELF, ACTUAL>, ACTUAL>` is self-typed: every
assertion is declared to return `SELF` and returns the field `myself`, which the concrete
subclass's constructor set to itself. So `StringAssert.isNotNull()` is typed as returning
`StringAssert`, not `AbstractAssert`, and the String-specific assertions stay reachable.
This is the curiously recurring generic pattern, and it is why writing a custom assertion
means passing `YourAssert.class` to `super` — see
[07 · Custom assertions](07-custom-assertions.md).

**★ What is the difference between a method on the chain that returns `SELF` and one that
does not?**
`SELF`-returning methods are assertions (and configuration); they keep you on the same
actual. Methods that return a different assert type are navigation — `extracting`,
`first`, `singleElement`, `cause`, `rootCause`, `get`, `asInstanceOf` — and they change
what "actual" means for everything downstream. Descriptions, comparators and custom
messages do not cross a navigation boundary, and soft assertions behave differently at one
too.

**★ You want to assert five things about one object and see all five failures. What are
your options and what does each cost?**
Chaining gives you one failure per run and no extra dependencies. `satisfies` groups the
assertions readably but still stops at the first failing one inside the consumer. Soft
assertions collect every failure and report them together, at the cost of a ByteBuddy
proxy per assert object and the discipline of calling `assertAll()` — which is why the
JUnit extension exists. See [06 · Soft assertions](06-soft-assertions.md).

{/* FOOTER */}
