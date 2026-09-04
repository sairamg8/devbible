---
title: "AssertJ gives you three syntaxes for asserting that code throws and one for asserting that it does not, and the difference between them is not style but which failure they can report — assertThatThrownBy fails immediately when nothing is thrown, catchThrowable hands you a null instead"
sidebar_label: "05 · Exceptions"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the AssertJ Core documentation — the exception-assertion
> sections ([assertj.github.io/doc](https://assertj.github.io/doc/)) — and the
> `assertj-core` 3.27.7 API (`Assertions.assertThatThrownBy`,
> `assertThatExceptionOfType`, `assertThatCode`, `catchThrowable`,
> `catchThrowableOfType`, `ThrowableTypeAssert`, `AbstractThrowableAssert`).
> JDK 25 · Spring Boot 4.1.1 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**JUnit's own `assertThrows` returns the exception and leaves you to assert on it — see
[01 · assertThrows](../01-junit-5/05-assertthrows.md). AssertJ offers three spellings
instead, and the choice between them is usually presented as taste. It is not entirely
taste: they differ in what happens when the code under test throws *nothing*, and one of
them will happily let that pass.**

## `assertThatThrownBy` — the default

> *"`assertThatThrownBy(ThrowingCallable)` is an alternative to `catchThrowable`, use it if
> you find more readable."*

```java
assertThatThrownBy(() -> { throw new Exception("boom!"); })
    .isInstanceOf(Exception.class)
    .hasMessageContaining("boom");
```

The behaviour that matters: **if the callable does not raise an exception, an assertion
error is thrown immediately.** You cannot forget to check that something was thrown, because
the entry point checks it.

This is the one to reach for by default. It reads left to right, the chain that follows is
the full `Throwable` assertion API, and the "nothing was thrown" case is handled for you.

## `assertThatExceptionOfType` — the type first

> *"`assertThatExceptionOfType` is an alternative syntax that some people find more
> natural."*

```java
assertThatExceptionOfType(IOException.class)
    .isThrownBy(() -> { throw new IOException("boom!"); })
    .withMessage("%s!", "boom")
    .withMessageContaining("boom")
    .withNoCause();
```

Note the vocabulary shift: `with…` rather than `has…`, because you are on a
`ThrowableTypeAssert` rather than on a `ThrowableAssert`. The type is stated up front, which
some people find clearer, and the assertion cannot be written without a type — which is
either a feature or a nuisance depending on the test.

There are shortcuts for the common types:

> *"Similarly to `catchThrowableOfType`, the latter syntax has been enriched for commonly
> used exceptions: `assertThatNullPointerException`, `assertThatIllegalArgumentException`,
> `assertThatIllegalStateException`, `assertThatIOException`."*

```java
assertThatIOException()
    .isThrownBy(() -> { throw new IOException("boom!"); })
    .withMessage("%s!", "boom")
    .withMessageContaining("boom")
    .withNoCause();
```

## `catchThrowable` — separating when from then

> *"BDD aficionados can separate WHEN and THEN steps by using
> `catchThrowable(ThrowingCallable)` to capture the `Throwable` and then perform
> assertions."*

```java
String[] names = { "Pier ", "Pol", "Jak" };

Throwable thrown = catchThrowable(() -> System.out.println(names[9]));

then(thrown).isInstanceOf(ArrayIndexOutOfBoundsException.class)
            .hasMessageContaining("9");
```

🔴 **`catchThrowable` returns `null` when nothing is thrown.** It does not fail. It is a
capture, not an assertion, and everything downstream is your responsibility. This is the
real distinction between the three syntaxes and the reason `assertThatThrownBy` is the
default recommendation.

Where it earns its place: when the assertions on the exception are complex enough to want
their own block, or when you need the exception's own typed fields:

> *"`catchThrowableOfType` is a variation of `catchThrowable` where the caught exception
> type is verified and returned."*

```java
TextException textException = catchThrowableOfType(
    TextException.class,
    () -> { throw new TextException("boom!", 1, 5); }
);

assertThat(textException).hasMessageContaining("boom");
assertThat(textException.line).isEqualTo(1);
```

`textException.line` is the point — a custom exception carrying structured data is much
better to assert on than a message string, and this is how you reach it. Compare
[01 · What not to assert](../01-junit-5/05b-what-not-to-assert.md) on why the message is
the wrong thing to pin.

## Asserting that nothing is thrown

> *"You can test that a piece of code does not throw any exception with:
> `assertThatCode(() -> System.out.println("OK")).doesNotThrowAnyException();`"*

```java
// standard style
assertThatCode(() -> System.out.println("OK"))
    .doesNotThrowAnyException();

// BDD style
thenCode(() -> System.out.println("OK"))
    .doesNotThrowAnyException();
```

⚠️ Use this **sparingly**. In a test that calls the code under test and then asserts on the
result, an unexpected exception already fails the test — wrapping it in
`doesNotThrowAnyException()` adds nothing. It earns its keep in exactly one situation: when
"does not throw" *is* the behaviour under test, typically a validator or a parser being
handed input that was previously rejected. Then it is the assertion, and without it the test
body would have no assertion at all.

## Choosing between them

| | Fails when nothing is thrown? | Good for |
|---|---|---|
| `assertThatThrownBy(…)` | **yes, immediately** | the default; everything ordinary |
| `assertThatExceptionOfType(T).isThrownBy(…)` | yes | when leading with the type reads better |
| `assertThatIOException()` etc. | yes | the four common types, tersely |
| `catchThrowable(…)` | 🔴 **no — returns `null`** | separating when/then; a long assertion block |
| `catchThrowableOfType(T, …)` | type is verified | reaching the exception's own fields |
| `assertThatCode(…).doesNotThrowAnyException()` | n/a — the inverse | only when "does not throw" is the behaviour |

**Pick one and use it throughout a codebase.** Three syntaxes for one idea, mixed across a
suite, is a small tax on every reader for no gain — and it makes the `catchThrowable`
occurrences, the ones that genuinely behave differently, harder to spot.

Asserting on the exception once you have it — messages, causes and root causes — is
[05b · Messages, causes and root causes](05b-causes-and-messages.md).

## Gotchas

**★ `catchThrowable` returns `null` when nothing is thrown, and `null` fails no assertion
you were about to write.**
`then(thrown).isInstanceOf(...)` on a `null` does fail, but a test that only checks a field
or forgets the assertion entirely passes with the code under test never having thrown. This
is the one behavioural difference between the syntaxes, and it is worth knowing precisely.

**★ Putting more than one call inside the lambda.**
`assertThatThrownBy(() -> { setUp(); act(); })` passes when `setUp()` throws. The assertion
says the block threw, not that the method under test did. One call per lambda.

**★ `assertThatCode(...).doesNotThrowAnyException()` used as reassurance.**
In an ordinary test an unexpected exception already fails the test. Wrapping a call in this
adds a line and no coverage. It is an assertion only when not throwing is the behaviour
being tested.

**★ Asserting a broad type.**
`isInstanceOf(Exception.class)` passes for anything. If the code throws a
`NullPointerException` where it should throw `InvalidOrderException`, that is a bug and the
assertion will not see it. Assert the type you mean, and use `isExactlyInstanceOf` when the
subtype matters.

**★ `with…` versus `has…` — the two syntaxes use different method names.**
`assertThatExceptionOfType(...)` puts you on a `ThrowableTypeAssert` whose methods are
`withMessage`, `withCause`, `withNoCause`; `assertThatThrownBy(...)` gives a
`ThrowableAssert` with `hasMessage`, `hasCause`, `hasNoCause`. Autocomplete will not offer
the other family, which is confusing exactly once.

**★ Wrapping code that does not compile as a lambda.**
`ThrowingCallable` permits checked exceptions, which is the whole point — but a lambda body
that assigns to a non-effectively-final local will not compile, and the usual reflex is to
restructure the test rather than the local. Extract the setup above the lambda.

**★ Forgetting that the assertion runs the code.**
`assertThatThrownBy` executes the callable at the point of the call. In a test that has
already set up state, that means the state is mutated there — not at the end of the test
where the assertion visually sits.

**★ Mixing AssertJ's exception assertions with JUnit's `assertThrows` in one codebase.**
Both work. Having both means every reader has to hold two mental models, and it obscures
whether a given test checks the exception type at all. Pick one — the phase's argument for
AssertJ generally is in
[01 · Why fluent assertions](01-why-fluent-assertions.md).

**★ Asserting only the message.**
The most common weak exception test. The message is prose, changes on a typo fix, and is
often the only thing asserted — so the test breaks on rewording and passes on the wrong
exception type. Assert the type, and a custom exception's fields where they exist.

## Interview questions

**★ What is the practical difference between `assertThatThrownBy` and `catchThrowable`?**
`assertThatThrownBy` fails immediately if the callable does not throw; `catchThrowable`
returns `null` and fails nothing. `catchThrowable` is a capture for separating when from
then, and it puts the "something must have been thrown" check back on you.

**★ When would you use `catchThrowableOfType`?**
When the exception carries structured data you want to assert on — a validation exception
with a field name, a parse exception with a line and column. It verifies the type and returns
the typed exception, so you can assert on its own accessors instead of picking the values out
of a message string.

**★ Is `assertThatCode(...).doesNotThrowAnyException()` worth writing?**
Only when "does not throw" is the behaviour under test — a validator accepting input that
used to be rejected, a parser handling a newly supported format. In an ordinary test the
exception would already fail the test, so the line adds nothing but length.

**★ `assertThatExceptionOfType(X.class).isThrownBy(...)` uses `withMessage`;
`assertThatThrownBy(...)` uses `hasMessage`. Why?**
They land on different assert types. The first is a `ThrowableTypeAssert`, which describes
the exception you expect and reads with `with…`; the second is a `ThrowableAssert` on the
exception that was actually thrown, and reads with `has…`. Same checks, different entry
point.

**★ What is wrong with putting the whole arrange-act block inside `assertThatThrownBy`?**
The assertion then passes if *any* statement in the block throws, including the setup. A
`NullPointerException` from a badly built fixture satisfies a test that was meant to prove
the domain rejects an invalid order. One call per lambda.

**★ You are reviewing a test that asserts only `hasMessageContaining("invalid")`. What do
you say?**
That it will break on a wording change and pass on the wrong exception type — it asserts the
least stable part of the behaviour and none of the stable part. Add the type, and if the
exception carries structured fields, assert those instead of the message. The message is
documentation for a human, not an API for a test.

{/* FOOTER */}
