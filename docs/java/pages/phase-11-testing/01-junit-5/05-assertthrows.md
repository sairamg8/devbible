---
title: "assertThrows accepts subclasses of the type you name and returns the exception it caught, assertThrowsExactly does neither of those things, and the choice between them is a decision about how much of your exception hierarchy is public contract"
sidebar_label: "05 · assertThrows"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Exception Handling"
> ([exception-handling](https://docs.junit.org/6.0.3/writing-tests/exception-handling.html))
> and "Assertions"
> ([assertions](https://docs.junit.org/6.0.3/writing-tests/assertions.html)); `Assertions`
> javadoc
> ([Assertions](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/Assertions.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**An exception is a behaviour like any other and deserves a test that names it. Jupiter
gives you three assertions for the job, and the difference between the first two is not
cosmetic: one is polymorphic and one is not, and picking the wrong one either
over-constrains your implementation or fails to test what you meant.**

## `assertThrows` — the type or any subtype

> *"The `assertThrows()` method is used to verify that a particular type of exception is
> thrown during the execution of a provided executable block. It not only checks for the
> type of the thrown exception but also its subclasses, making it suitable for more
> generalized exception handling tests. The `assertThrows()` assertion method returns the
> thrown exception object to allow performing additional assertions on it."*

```java
@Test
void rejectsAWithdrawalLargerThanTheBalance() {
    Account account = Account.with(Money.of("10.00"));

    InsufficientFunds thrown = assertThrows(InsufficientFunds.class,
            () -> account.withdraw(Money.of("25.00")));

    assertEquals(Money.of("15.00"), thrown.shortfall());
}
```

Two things this shape gets right:

- **The lambda contains only the call that is supposed to throw.** Arrangement stays
  outside it.
- **The returned exception is then asserted on.** The shortfall is the interesting part —
  it is data the caller will use to build an error response. Asserting the *type* alone
  says only that something went wrong.

The guide's second example makes the polymorphism explicit:

```java
// Succeeds: IllegalArgumentException is a subclass of RuntimeException.
assertThrows(RuntimeException.class, () -> {
    throw new IllegalArgumentException("expected message");
});
```

## `assertThrowsExactly` — this type and no other

> *"The `assertThrowsExactly()` method is used when you need to assert that the exception
> thrown is exactly of a specific type, not allowing for subclasses of the expected
> exception type."*

```java
// Fails: the thrown IllegalArgumentException is not exactly RuntimeException.
assertThrowsExactly(RuntimeException.class, () -> {
    throw new IllegalArgumentException("expected message");
});
```

**When to reach for it.** When the exact type is part of the contract — a client
`catch` block, a `@ExceptionHandler` mapping, an error-code translation table — and a
subclass appearing instead would silently change behaviour downstream. In an exception
hierarchy where `PaymentDeclined` extends `PaymentFailed`, a controller advice that maps
`PaymentFailed` to HTTP 402 and `PaymentDeclined` to HTTP 409 has made the exact type
load-bearing, and `assertThrows(PaymentFailed.class, …)` would pass for both.

**When not to.** Everywhere else. `assertThrowsExactly` pins the implementation to one
class, so introducing a more specific subclass — a strictly better error — breaks a test
that was not asserting anything about it.

## `assertDoesNotThrow` — and when it earns its place

> *"Although any exception thrown from a test method will cause the test to fail, there
> are certain use cases where it can be beneficial to explicitly assert that an exception
> is not thrown for a given code block within a test method."*

That sentence contains the caveat. A test method that simply calls the code already fails
if it throws. `assertDoesNotThrow` adds value in exactly two situations:

1. **Intent.** The test is *about* the absence of an exception — a boundary value that
   used to blow up, a regression test for a fixed `NumberFormatException`. The name of the
   assertion is the documentation.
2. **Scoping.** Only one statement in a longer test must not throw, and you want the
   failure attributed to that statement rather than to the method.

It also returns the value, so it composes:

```java
Config config = assertDoesNotThrow(() -> ConfigParser.parse(text));
assertEquals(8080, config.port());
```

## Asserting on the cause

Wrapped exceptions are the normal case at a boundary — a repository wrapping
`SQLException`, a client wrapping `IOException`. The returned exception gives you the
chain:

```java
@Test
void wrapsTheDriverFailure() {
    DataAccessFailure thrown = assertThrows(DataAccessFailure.class,
            () -> repository.findById("A-1"));

    assertInstanceOf(SQLTimeoutException.class, thrown.getCause());
}
```

⚠️ **Asserting on a cause is asserting on an implementation detail unless the cause is
documented.** If callers are expected to inspect `getCause()`, it is contract; if the
wrapper exists precisely so nobody has to, the assertion is coupling the test to the
driver.

## The three shapes that are wrong

**The `try`/`fail`/`catch` idiom:**

```java
// Obsolete. Reads backwards, and the assertion is buried.
try {
    account.withdraw(Money.of("25.00"));
    fail("should have thrown");
} catch (InsufficientFunds expected) {
    assertEquals(Money.of("15.00"), expected.shortfall());
}
```

**A lambda containing the arrangement as well as the act:**

```java
// If Account.with(...) throws InsufficientFunds for an unrelated reason, this passes.
assertThrows(InsufficientFunds.class, () -> {
    Account account = Account.with(Money.of("10.00"));
    account.withdraw(Money.of("25.00"));
});
```

**Asserting only the type when the exception carries data:**

```java
assertThrows(ValidationFailed.class, () -> validator.validate(request));
// Which field? What rule? The test does not say, so neither will the failure.
```

## `Executable` and `ThrowingSupplier`

Jupiter has two functional interfaces here, both allowed to throw `Throwable`:
`Executable` (no result) and `ThrowingSupplier` (a result). That is why
`() -> repository.findById("A-1")` compiles inside `assertThrows` even though
`findById` declares a checked exception — you do not need a `try` inside the lambda, and
if you have written one, the test is catching the thing it was supposed to be asserting.

## Gotchas

**★ Using `assertThrows` where the exact type is the contract.**
`assertThrows(PaymentFailed.class, …)` passes when a subclass is thrown. If a controller
advice or a caller's `catch` distinguishes the subclass, the test is not protecting the
behaviour anyone depends on. That is `assertThrowsExactly`.

**★ Using `assertThrowsExactly` by default.**
It forbids every subclass, including ones that do not exist yet. Introducing a more
specific exception type — usually an improvement — breaks tests that never cared.

**★ Putting the arrangement inside the lambda.**
Any statement in the lambda can be the one that throws. The assertion passes for the wrong
reason and keeps passing after the code under test stops throwing at all.

**★ Asserting only the type of an exception that carries data.**
`ValidationFailed` with a field name and a rule id is a contract with the caller. A test
that asserts only the class name protects none of it.

**★ Asserting on `getMessage()` as the primary assertion.**
The message is prose, and prose gets rewritten. [05b](05b-what-not-to-assert.md) is the
whole argument; the short version is that a typo fix should not turn a build red.

**★ Ignoring the return value.**
`assertThrows` hands you the exception. Discarding it and then reaching for the object
another way — or not asserting at all — throws away the API's best feature.

**★ Wrapping the call in `try`/`catch` *inside* the lambda.**
`Executable` and `ThrowingSupplier` may throw `Throwable`, so no `try` is needed. A `try`
inside the lambda swallows the exception and the assertion fails with "expected X to be
thrown, but nothing was thrown".

**★ `assertDoesNotThrow` around the whole test body.**
It adds a stack frame and no information — the test already fails if anything throws. Use
it when the absence of an exception is the claim, or to scope the failure to one
statement.

**★ Expecting `assertThrows` to catch an `Error`.**
It will — the signature is over `Throwable` — but a test asserting `StackOverflowError` or
`OutOfMemoryError` is asserting a property of the JVM's configuration, not of your code.

**★ A test that names an exception type that cannot be thrown.**
`assertThrows(IOException.class, …)` where nothing in the lambda declares it: this compiles
only because the lambda's throws-clause is inferred, and it fails at runtime with "nothing
was thrown". The compile-time signal you might have expected is not there.

## Interview questions

**★ What is the difference between `assertThrows` and `assertThrowsExactly`?**
`assertThrows` succeeds if the thrown exception is the named type *or any subclass*;
`assertThrowsExactly` requires the exact class. Both return the caught exception. The
choice is about whether the precise type is part of the contract callers depend on.

**★ What does `assertThrows` return and why does it matter?**
The exception it caught. That lets the test assert on the exception's own state — a
shortfall amount, a field name, an error code — which is usually the part of the behaviour
that matters. Asserting only the type says a failure occurred, not what the failure told
the caller.

**★ Why is the `try`/`fail`/`catch` idiom worse?**
It reads in the wrong order, the assertion that the exception occurred is the `fail` call
in the middle, forgetting that `fail` makes the test pass silently when nothing throws, and
the caught exception's own assertions end up nested one level deeper. `assertThrows` states
the expectation first and hands you the exception.

**★ Why should the lambda contain only the call under test?**
Because `assertThrows` does not care *which* statement threw. Setup code that throws the
same type makes the assertion pass for a reason unrelated to the behaviour being tested,
and the test then keeps passing after the real behaviour regresses.

**★ When would you use `assertDoesNotThrow`?**
When the absence of an exception is the point — a regression test for a crash that has been
fixed, or a boundary input that used to be rejected — or when you need to attribute the
failure to one specific statement in a longer test. Wrapping an entire test body in it adds
nothing, since an uncaught exception already fails the test.

**★ How do you test that an exception wraps a specific cause?**
Capture the exception from `assertThrows`, then assert on `getCause()` — `assertInstanceOf`
is the clean way, since it also gives you the narrowed reference. Do it only when callers
are actually expected to inspect the cause; otherwise the test is coupled to the layer the
wrapper exists to hide.

**★ Do you need a `try` inside the lambda for a method that throws a checked exception?**
No. `Executable` and `ThrowingSupplier` are both declared to throw `Throwable`, so checked
exceptions propagate out of the lambda into the assertion. A `try` in there would catch the
very exception you are asserting on.

{/* FOOTER */}
