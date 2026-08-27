---
title: "Jupiter's assertions are static methods that throw AssertionError, the failure message is the LAST parameter and not the first, and the JUnit team's own documentation tells you to use a third-party library instead — which is why this page teaches you to read them rather than to live in them"
sidebar_label: "04 · Assertions"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Assertions"
> ([assertions](https://docs.junit.org/6.0.3/writing-tests/assertions.html)) and "Exception
> Handling"
> ([exception-handling](https://docs.junit.org/6.0.3/writing-tests/exception-handling.html));
> `Assertions` javadoc
> ([Assertions](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/Assertions.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**Every Jupiter assertion is a static method on `org.junit.jupiter.api.Assertions` that
either returns normally or throws. There is no assertion object, no fluent chain and no
matcher. The API is small on purpose, and the guide is candid about its limits — it
recommends AssertJ, Hamcrest or Truth for anything more demanding. You still need to read
Jupiter assertions fluently, because half the Java code on earth uses them.**

## The shape of the API

> *"All JUnit Jupiter assertions are static methods in the `org.junit.jupiter.api.Assertions`
> class."*

```java
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Test
void addsTwoAmounts() {
    assertEquals(Money.of("3.00"), calculator.add(Money.of("1.00"), Money.of("2.00")));
}
```

Static import is the convention, and it is what every example in the user guide does.

The methods you will actually meet:

| Method | Asserts |
|---|---|
| `assertEquals(expected, actual)` | `Objects.equals` — expected first |
| `assertNotEquals(unexpected, actual)` | the negation |
| `assertSame` / `assertNotSame` | reference identity, not `equals` |
| `assertTrue` / `assertFalse` | a `boolean` or a `BooleanSupplier` |
| `assertNull` / `assertNotNull` | nullity |
| `assertArrayEquals` | element-wise, recursive for nested arrays |
| `assertIterableEquals` | element-wise over any two `Iterable` values |
| `assertLinesMatch` | line-by-line, with regex and fast-forward markers |
| `assertInstanceOf(Type.class, value)` | type, returning the narrowed value |
| `assertAll` | grouped — [04b](04b-assertall.md) |
| `assertThrows` / `assertThrowsExactly` / `assertDoesNotThrow` | exceptions — [05](05-assertthrows.md) |
| `assertTimeout` / `assertTimeoutPreemptively` | duration — [13](13-timeouts.md) |
| `fail(…)` | unconditionally |

## 🔴 The message parameter is last, and it is not the first

The guide states the position and the reason:

> *"Assertion methods optionally accept the assertion message as their third parameter,
> which can be either a `String` or a `Supplier<String>`."*

The user guide's own example labels it explicitly:

```java
assertEquals(4, calculator.multiply(2, 2),
        "The optional failure message is now the last parameter");
```

**"Now"** is doing work in that sentence. In JUnit 4 the message came *first*:
`org.junit.Assert.assertEquals(String message, Object expected, Object actual)`. Jupiter
moved it to the end so that the lambda-friendly overloads read naturally.

⚠️ **This is the single most dangerous import collision in Java testing.** Both classes
have a method called `assertEquals`. In a test comparing two strings, both orders
*compile*:

```java
// JUnit 4 muscle memory, Jupiter API — compiles, asserts the wrong thing.
assertEquals("customer name should match", expected, actual);
//            ^ treated as `expected`      ^ actual   ^ message
```

Jupiter reads that as: expected `"customer name should match"`, actual `expected`, failure
message `actual`. The test fails with a nonsense diff, or — worse — an unrelated pair
happens to be equal and it passes. There is no compiler help. The fix is an IDE import
rule that excludes `org.junit.Assert`, plus [02](02-the-architecture.md)'s advice about
`org.junit.Test`.

## The message argument nobody supplies

Most assertions in most codebases have no message, and for `assertEquals` that is usually
fine — the failure carries expected and actual, which is the information you need.

The case where the missing message costs you is `assertTrue` and `assertFalse`:

```java
assertTrue(order.isEligibleForRefund());
```

When that fails, the report says an assertion expected `true` and got `false`. It does not
say which order, which rule, or what the state was. Compare:

```java
assertTrue(order.isEligibleForRefund(),
        () -> "order " + order.id() + " placed at " + order.placedAt() + " should be refundable");
```

**Use the `Supplier<String>` form, not the `String` form**, and the guide explains why:

> *"When using a `Supplier<String>` (e.g., a lambda expression), the message is evaluated
> lazily. This can provide a performance benefit, especially if message construction is
> complex or time-consuming, as it is only evaluated when the assertion fails."*

The eager `String` form builds the message on every passing run. On a suite of 8,000
assertions that is 8,000 string concatenations doing nothing. On a message that calls
`toString()` on a large object graph, or worse touches a lazily-loaded entity, it is a
great deal more than that — see
[Phase 10 · lazy loading](../../phase-10-data-access/10-lazy-loading/README.md).

🔴 **Every predicate assertion is a message you owe the reader.** `assertTrue` throws away
the actual value by construction — the boolean has already collapsed the interesting state
into one bit. Either supply the message, or use an assertion that reports the value.

## `assertInstanceOf` returns the narrowed value

Added in 5.8, and still under-used:

```java
Object result = handler.handle(command);

OrderPlaced event = assertInstanceOf(OrderPlaced.class, result);
assertEquals("A-1", event.orderId());
```

Compare with the alternative — `assertTrue(result instanceof OrderPlaced)` followed by a
cast — which fails with "expected true, was false" and then needs the cast written out
anyway. `assertInstanceOf` fails with the actual type in the message and hands you a typed
reference.

## `assertSame` is not `assertEquals`

`assertSame` compares references. It is right for exactly two situations: a cache or
interning guarantee ("the second lookup returns the same object"), and an enum or
singleton identity. Everywhere else it is a stricter assertion than the requirement, and
it breaks the day someone adds a defensive copy that was always allowed.

Conversely `assertEquals` on a type with no `equals` override is reference comparison
wearing an `equals` costume — it will fail for two objects that are field-for-field
identical. Records and value objects get `equals` for free; entities frequently do not.

## `fail()` and the two legitimate uses

```java
fail("unreachable: the parser must have thrown");
```

1. **Marking a branch that must not be reached**, when the alternative structure is worse.
2. **A deliberately unimplemented test**, though `@Disabled("…")`
   ([07](07-disabling-and-conditions.md)) is honest and `fail()` is a red build.

⚠️ **`fail()` inside a `catch` block is the JUnit 3 idiom for exception testing and it is
obsolete.** It inverts the reading order and discards the stack trace.
[05 · `assertThrows`](05-assertthrows.md) is the replacement.

## What the JUnit team says about their own assertions

Verbatim, from the "Third-party Assertion Libraries" section:

> *"Even though the assertion facilities provided by JUnit Jupiter are sufficient for many
> testing scenarios, there are times when more power and additional functionality are
> desired or required. In such cases, the JUnit team recommends the use of third-party
> assertion libraries such as AssertJ, Hamcrest, Truth, etc. Developers are therefore free
> to use the assertion library of their choice."*

The guide even documents how to *ban* its own class, with a Checkstyle rule matching
`org\.junit\.jupiter\.api\.(Assertions|Assumptions)\.` and a maximum of zero occurrences:

> *"If you would like to enforce that all your tests use a certain third-party assertion
> library instead of Jupiter's, you can set up a rule using Checkstyle or another static
> analysis tool that fails the build if Jupiter's `Assertions` class is used."*

That is the JUnit team publishing the configuration to keep you out of their API. **The
rest of this phase uses AssertJ** — `spring-boot-starter-test` brings 3.27.7 — because
collection, exception and soft assertions are where Jupiter's API runs out and where
failure messages stop doing the debugging for you. That argument belongs to **topic 02 ·
AssertJ** *(not written yet)*, in `02-assertj/`.

## Gotchas

**★ Message first, JUnit 4 style.**
`assertEquals(message, expected, actual)` is JUnit 4. Jupiter is
`assertEquals(expected, actual, message)`. With three `String` arguments it compiles and
asserts something you did not mean. The only defence is an import rule.

**★ Arguments in the wrong order.**
`assertEquals(actual, expected)` compiles and passes and fails identically — until it
fails, and the report says "expected 47, was 42" with the two swapped. Every debugging
minute after that is spent on a lie.

**★ `assertTrue` with no message.**
"Expected: true, actual: false" is the least informative failure in Java. Either add a
`Supplier<String>` message or use an assertion that reports the value.

**★ Building the message eagerly.**
`assertTrue(x, "failed for " + expensive())` evaluates `expensive()` on every pass. The
lambda overload evaluates it only on failure, which the guide names as the reason the
overload exists.

**★ `assertEquals` on floating point without a delta.**
`assertEquals(0.1 + 0.2, 0.3)` is false in binary floating point. Jupiter has
`assertEquals(double expected, double actual, double delta)`; use it, or use `BigDecimal`
in the domain, which for money you should be doing anyway.

**★ `assertEquals` on two arrays.**
Arrays do not override `equals`, so it compares references and fails for two identical
arrays. `assertArrayEquals` is the one that compares elements.

**★ `assertEquals` on a class with no `equals` override.**
Reference comparison with a misleading name. Records, enums and properly-written value
objects are safe; JPA entities with an identity-based `equals` and a null id are a
particular trap — see
[Phase 10 · the JPA model](../../phase-10-data-access/06-jpa-hibernate-model/README.md).

**★ `assertNotNull` before every other assertion.**
`assertEquals("A-1", order.id())` already fails clearly if `order` is null — with a
`NullPointerException` naming the expression. The extra line is noise unless the nullity
is the actual claim.

**★ `assertSame` where `assertEquals` was meant.**
Passes today because of interning or caching, fails when someone adds a copy. Reference
identity is rarely the requirement.

**★ Asserting on a collection with `assertEquals`.**
It works for `List`, since `List.equals` is defined, and the failure message is both
collections printed in full — for a 500-element list, unreadable. This is the canonical
argument for AssertJ's `containsExactly` and friends.

**★ Mixing Hamcrest's `assertThat` with Jupiter and expecting Jupiter to care.**
It does not; Hamcrest throws its own `AssertionError` and Jupiter treats any uncaught
`Throwable` as a failure. Mixing three assertion styles in one file is a readability
problem, not a correctness one — but it is still a problem.

**★ `fail()` in a `catch` block.**
The JUnit 3 exception idiom. It reads backwards and loses the trace. Use `assertThrows`.

## Interview questions

**★ Where does the failure message go in a Jupiter assertion?**
Last. `assertEquals(expected, actual, message)`. JUnit 4 put it first, which is why the
two APIs are so dangerous to mix — with string arguments both orders compile and one of
them silently asserts the wrong pair.

**★ Why does `Assertions` offer a `Supplier<String>` overload for messages?**
So the message is built only when the assertion fails. The guide names the benefit
explicitly for complex or time-consuming message construction. On a passing suite the
eager `String` form does the work every time and throws it away.

**★ When do you supply a message and when is it noise?**
Supply it whenever the assertion collapses information — `assertTrue`, `assertFalse`,
`fail` — because the report otherwise says nothing about the state that mattered. Skip it
for `assertEquals` and friends, where expected and actual are already in the failure.

**★ What does `assertInstanceOf` give you over `assertTrue(x instanceof T)`?**
A failure message naming the actual type instead of "expected true", and a typed reference
returned, so the following assertions do not need a cast.

**★ Does JUnit recommend its own assertion API?**
Only up to a point. The guide says Jupiter's assertions are *"sufficient for many testing
scenarios"* and then recommends AssertJ, Hamcrest or Truth when *"more power and additional
functionality are desired or required"*, and it documents a Checkstyle rule for banning
`Assertions` outright. Preferring AssertJ is following the JUnit team's advice, not
disagreeing with it.

**★ Two objects are field-for-field identical and `assertEquals` fails. What is wrong?**
The type has no `equals` override, so the assertion is comparing references. Make it a
record or a value object with `equals`/`hashCode`, or assert on the fields — and be
careful with entities whose `equals` is identity-based on a possibly-null id.

**★ What is wrong with `assertEquals(0.1 + 0.2, 0.3)`?**
Binary floating point: the left-hand side is not exactly 0.3. The overload with a `delta`
exists for this, and for money the real answer is not to use `double` at all.

**★ Why is "one assertion per test" bad advice stated that way?**
Because the goal is one *reason to fail*, not one method call. Four assertions describing
one claim about one object are fine and are better grouped with `assertAll` so they all
report; four assertions describing four claims are four tests. Counting calls optimises
the wrong thing.

{/* FOOTER */}
