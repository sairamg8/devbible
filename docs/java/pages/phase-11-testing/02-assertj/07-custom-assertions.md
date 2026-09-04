---
title: "A custom assertion class is a domain vocabulary for your tests, bought with a self-typed generic signature that looks alarming and is mechanical — and before you write one, a Condition gives you most of the readability for none of the class"
sidebar_label: "07 · Custom assertions"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the `assertj-core` **3.27.7** sources on GitHub
> (tag `assertj-build-3.27.7`) — the class javadoc, generic signature, `protected final
> ACTUAL actual`, `getWritableAssertionInfo()`, `failWithMessage` and
> `failWithActualExpectedAndMessage` on
> [`AbstractAssert`](https://github.com/assertj/assertj/blob/assertj-build-3.27.7/assertj-core/src/main/java/org/assertj/core/api/AbstractAssert.java),
> and
> [`Condition`](https://github.com/assertj/assertj/blob/assertj-build-3.27.7/assertj-core/src/main/java/org/assertj/core/api/Condition.java);
> plus the AssertJ Core documentation
> ([assertj.github.io/doc](https://assertj.github.io/doc/)).
> JDK 25 · Spring Boot 4.1.1 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**Twelve tests that each write `assertThat(order.status()).isEqualTo(CONFIRMED)` are twelve
places that know how "confirmed" is represented. A custom assertion —
`assertThat(order).isConfirmed()` — puts that knowledge in one place and makes the test read
as domain language. It is a real technique with a real cost: a class, a factory method, a
static import your team has to know about, and a generic signature that scares people the
first time. This page is when it pays and how to write it; it opens with the cheaper option,
because most of the time the cheaper option is the answer.**

## Start with `Condition` — usually enough

`Condition` is a named predicate. From the source:

```java
// build condition with Predicate<String> and set description using String#format pattern.
Condition<String> fairyTale = new Condition<String>(s -> s.startsWith("Once upon a time"), "a %s tale", "fairy");
```

> *"You must give a description, it will be used to build a nice error message when the
> condition fails, you can pass args to build the description as in
> `String#format(String, Object...)`."*

It plugs into the assertions you already have:

```java
Condition<Order> confirmed = new Condition<>(o -> o.status() == CONFIRMED, "confirmed");

assertThat(order).is(confirmed);
assertThat(order).isNot(confirmed);
assertThat(orders).are(confirmed);
assertThat(orders).haveAtLeastOne(confirmed);
assertThat(orders).filteredOn(confirmed).hasSize(3);   // see 03e
```

Five call sites, one definition, one description in every failure message, and **no class to
write**. `is`/`are` and `has`/`have` are the same check with different grammar, exactly as
`being`/`having` are on `filteredOn`.

⚠️ The no-argument `Condition()` constructor defaults the description to the class's simple
name — fine for a named subclass, useless for an anonymous one. Give a description.

**Reach for a custom assertion class instead when** you want more than one named check on
the same type, when you want them chainable, or when the failure message needs to say
something a description cannot.

## The custom assertion class

```java
public class OrderAssert extends AbstractAssert<OrderAssert, Order> {

    public OrderAssert(Order actual) {
        super(actual, OrderAssert.class);
    }

    public static OrderAssert assertThat(Order actual) {
        return new OrderAssert(actual);
    }

    public OrderAssert isConfirmed() {
        isNotNull();
        if (actual.status() != Status.CONFIRMED) {
            failWithMessage("Expected order <%s> to be CONFIRMED but was <%s>",
                            actual.reference(), actual.status());
        }
        return this;
    }

    public OrderAssert hasTotal(BigDecimal expected) {
        isNotNull();
        if (actual.total().compareTo(expected) != 0) {
            failWithActualExpectedAndMessage(actual.total(), expected,
                "Expected order <%s> to total <%s> but was <%s>",
                actual.reference(), expected, actual.total());
        }
        return this;
    }
}
```

Then:

```java
assertThat(order).isConfirmed()
                 .hasTotal(new BigDecimal("42.00"));
```

Five things in that class are load-bearing.

### `AbstractAssert<SELF, ACTUAL>` and the self type

The signature is:

```java
public abstract class AbstractAssert<SELF extends AbstractAssert<SELF, ACTUAL>, ACTUAL> implements Assert<SELF, ACTUAL>
```

and the javadoc points at *"Emulating 'self types' using Java Generics to simplify fluent API
implementation"* for why. The practical effect is the whole point of AssertJ: `isNotNull()`
inherited from the base class returns `OrderAssert`, not `AbstractAssert`, so it chains with
your own methods. Write `extends AbstractAssert<OrderAssert, Order>` and stop thinking about
it — it is mechanical, not deep.

### `super(actual, OrderAssert.class)`

The second argument is the self type, and the constructor uses it to cast:
`myself = (SELF) selfType.cast(this)`. Pass the wrong class and you get a
`ClassCastException` at construction, not at the call site — which is worth knowing because
it is exactly the mistake copy-pasting an existing assertion class produces.

### `actual` is `protected` on purpose

From the source, with the comment kept:

```java
// visibility is protected to allow us write custom assertions that need access to actual
protected final ACTUAL actual;
```

That is the extension point. It is `final`, so you read it; you do not reassign it.

### `isNotNull()` first, every time

Every custom assertion method should call `isNotNull()` before touching `actual`. Skip it
and a `null` under test gives a `NullPointerException` from inside your assertion class —
an error about AssertJ rather than about the test. One line, and it makes the failure say
"expecting actual not to be null".

### `failWithMessage` versus `failure`

The javadoc has a preference, and it is not the method most examples use:

> *"Note that generally speaking, using `failure()` directly is preferable to using this
> wrapper method, as the compiler and other code analysis tools will be able to tell that
> the statement will never return normally and respond appropriately."*

`failWithMessage(...)` is a `void` call that throws — the compiler cannot see that, so it
will not warn about unreachable code and will complain about definitely-assigned variables.
`throw failure(...)` is explicit. In 3.27.7 `failWithMessage` carries `@Contract("_, _ ->
fail")`, which tells IntelliJ what the compiler cannot infer, so the practical gap is
narrower than it was — but `throw failure(...)` is the form the library recommends.

**Prefer `failWithActualExpectedAndMessage(actual, expected, ...)` when there is an actual
and an expected value.** It populates them on the thrown error, which is what makes an IDE
offer a side-by-side diff. `failWithMessage` produces a message and no diff.

Getting a custom assertion into the hands of a team — the static-import collision, the
project entry-point class, and the ways an assertion class rots — is
[07b · Adopting custom assertions](07b-adopting-custom-assertions.md).

## Gotchas

**★ Forgetting `isNotNull()` at the top of each method.**
`actual.status()` on a `null` throws `NullPointerException` from inside your assertion class.
The report then blames AssertJ rather than telling the reader that the thing under test was
null. One line per method, no exceptions.

**★ Passing the wrong class to `super(actual, X.class)`.**
The constructor does `selfType.cast(this)`, so a copy-pasted `super(actual,
CustomerAssert.class)` inside `OrderAssert` fails with a `ClassCastException` at construction
— far from the line that looks wrong.

**★ Returning `this` typed as the base class.**
Declare the return type as your own assert type, not `AbstractAssert`. Getting this wrong
kills chaining, which was most of the reason to write the class.

**★ Using `failWithMessage` where `failWithActualExpectedAndMessage` belongs.**
The second populates actual and expected on the error, which is what an IDE needs to offer a
diff. With a plain message you get prose and no comparison view.

**★ `failWithMessage(...)` reads as a `void` call, and the compiler agrees.**
The javadoc prefers `throw failure(...)` precisely so that the compiler and analysis tools
know the statement never returns. `@Contract("_, _ -> fail")` covers IntelliJ; it does not
cover javac.

**★ An anonymous `Condition` with the default description.**
The no-argument constructor sets the description to the class's simple name, which for an
anonymous subclass is empty. Always pass a description.

## Interview questions

**★ What is the difference between a `Condition` and a custom assertion class?**
A `Condition` is a named predicate with a description, usable through `is`/`are`/`has`/`have`
and `filteredOn`, and it needs no new class. A custom assertion class gives you several named
checks on one type, chainable, with control over the failure message. Start with the
`Condition`; graduate when you want chaining or a better message.

**★ Explain the `AbstractAssert<SELF, ACTUAL>` signature.**
`SELF` is the self type — a recursive generic bound so that inherited methods like
`isNotNull()` return your assertion type rather than the base class, which is what keeps the
chain fluent. `ACTUAL` is the type under test. In practice you write
`extends AbstractAssert<OrderAssert, Order>` and pass `OrderAssert.class` to `super`.

**★ Why does every custom assertion method start with `isNotNull()`?**
Because `actual` may be `null`, and dereferencing it inside your method throws a
`NullPointerException` from AssertJ's own code. `isNotNull()` converts that into a proper
assertion failure that says the thing under test was null.

**★ `failWithMessage` or `throw failure(...)`?**
The javadoc prefers `failure()`, because it is a `throw` the compiler and static analysis can
see never returns; `failWithMessage` is a `void` call that throws, which they cannot infer.
`@Contract("_, _ -> fail")` on `failWithMessage` closes the gap for IntelliJ but not for
javac. And where there is an actual and an expected value, prefer
`failWithActualExpectedAndMessage` so the IDE can show a diff.

**★ Why is `actual` `protected` rather than `private` in `AbstractAssert`?**
Deliberately, so that subclasses can read it — the source carries the comment *"visibility is
protected to allow us write custom assertions that need access to actual"*. It is `final`:
custom assertions read the value under test, they do not replace it.

{/* FOOTER */}
