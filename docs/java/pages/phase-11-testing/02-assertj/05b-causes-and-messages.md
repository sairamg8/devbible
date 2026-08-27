---
title: "Once you hold the exception, the assertions divide into message checks that are brittle by construction and cause checks that are not, and the distinction worth learning is hasCause versus hasRootCause — one is the layer immediately below you, the other is the bottom of the chain"
sidebar_label: "05b · Messages, causes and root causes"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the AssertJ Core documentation — the `Throwable` message and
> cause assertion sections ([assertj.github.io/doc](https://assertj.github.io/doc/)) — and
> the `assertj-core` 3.27.7 API (`AbstractThrowableAssert.hasMessage`,
> `hasMessageContaining`, `hasMessageMatching`, `hasCauseInstanceOf`,
> `hasCauseExactlyInstanceOf`, `hasRootCause`, `hasRootCauseMessage`,
> `hasRootCauseInstanceOf`, `hasNoCause`, `cause()`, `rootCause()`).
> JDK 25 · Spring Boot 4.1.0 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**[05](05-exceptions.md) got you an exception. This chunk is what to say about it. The
message assertions are the ones everybody uses and the ones that break on a typo fix; the
cause assertions are the ones that matter in any layered application, where the exception
you catch is almost never the exception that went wrong.**

## The message family

> *"There are various ways for checking the exception message content, you can check the
> exact message, what it contains, its start, its end, if it matches a regex."*

```java
Throwable throwable = new IllegalArgumentException("wrong amount 123");

assertThat(throwable).hasMessage("wrong amount 123")
                     .hasMessage("%s amount %d", "wrong", 123)
                     .hasMessageStartingWith("wrong")
                     .hasMessageContaining("wrong amount")
                     .hasMessageEndingWith("123")
                     .hasMessageMatching("wrong amount .*")
                     .hasMessageNotContaining("right");
```

Note the second line: `hasMessage` takes a format string and arguments, which is how you
assert on a message built from values without concatenating in the test.

**All of these are brittle by construction**, and the more exact the assertion the more
brittle it is. `hasMessage` breaks when someone fixes a typo. `hasMessageMatching` breaks
when the format changes. The general argument is in
[01 · What not to assert](../01-junit-5/05b-what-not-to-assert.md); the short version is
that an exception message is prose written for a human reading a log, and pinning prose in a
test converts every improvement to that prose into a build failure.

Where a message assertion is legitimate:

- The message contains **a value that must be there** — the invalid field's name, the id
  that was not found. Assert with `hasMessageContaining("customerId")`, not with the whole
  sentence, so the surrounding wording stays free to change.
- The message is **part of a contract** — an API error body a client parses. Then it is not
  prose, it is an interface, and pinning it exactly is correct.

Where it is not: everywhere else, and particularly as the *only* assertion in the test.

## The cause family

In any layered application the exception you catch is a wrapper. A JDBC constraint violation
arrives as a Spring `DataIntegrityViolationException`; a mapping failure arrives wrapped by
whatever framework was on the stack. Asserting on the wrapper's type tells you which layer
re-threw, not what went wrong.

### `hasCause…` — one level down

```java
NullPointerException cause = new NullPointerException("boom!");
Throwable throwable = new Throwable(cause);

assertThat(throwable)
    .hasCauseInstanceOf(NullPointerException.class)
    .hasCauseInstanceOf(RuntimeException.class)
    .hasCauseExactlyInstanceOf(NullPointerException.class);
```

Two things to read carefully. `hasCauseInstanceOf(RuntimeException.class)` **passes** — it
is an `instanceof` check, so any supertype matches. `hasCauseExactlyInstanceOf` is the one
that requires the exact class. Choosing the loose form by accident is how a test keeps
passing after the cause changes to a different subtype.

### `hasRootCause…` — the bottom of the chain

```java
NullPointerException rootCause = new NullPointerException("null!");
Throwable throwable = new Throwable(new IllegalStateException(rootCause));

assertThat(throwable)
    .hasRootCause(rootCause)
    .hasRootCauseMessage("null!")
    .hasRootCauseMessage("%s!", "null")
    .hasRootCauseInstanceOf(NullPointerException.class)
    .hasRootCauseExactlyInstanceOf(NullPointerException.class);
```

`Throwable → IllegalStateException → NullPointerException`: `hasCauseInstanceOf` sees the
`IllegalStateException`, `hasRootCauseInstanceOf` sees the `NullPointerException`. **Neither
is "the right one" in general.** The question to ask is which one your test is really about:

- **`hasCause…`** when the wrapping is part of the contract — "the service wraps a
  repository failure in a `DomainException` whose cause is the original". You are asserting
  the wrapping.
- **`hasRootCause…`** when the wrapping is incidental — you care that a constraint violation
  reached the caller, and how many frameworks re-threw on the way is not your business.

`hasRootCause…` is the more robust of the two precisely because it does not care about the
intermediate layers, which are the part most likely to change.

### `hasNoCause`

> *"You can verify that a `Throwable` does not have a cause with `hasNoCause()`."*

```java
assertThat(throwable).hasNoCause();
```

Worth more than it looks. It is the assertion that says "this exception originated here" —
useful for a validation failure that should be constructed by your own code, not caught and
re-thrown from somewhere deeper.

## Navigating instead of asserting

> *"navigating to the cause allows taking advantage of all exception assertions:"*

```java
assertThat(throwable).cause()
                     .hasMessage("boom!")
                     .hasMessageStartingWith("bo")
                     .isInstanceOf(NullPointerException.class)
                     .isExactlyInstanceOf(NullPointerException.class);
```

```java
assertThat(throwable).rootCause()
                     .hasMessage("null!")
                     .hasMessageStartingWith("nu")
                     .isInstanceOf(NullPointerException.class)
                     .isExactlyInstanceOf(NullPointerException.class);
```

`cause()` and `rootCause()` move the assert onto that throwable, so the whole `Throwable`
API becomes available rather than the handful of `hasCause…` shortcuts. Use them when you
have more than one thing to say about the cause — three `hasRootCauseX` calls are three
places repeating "root cause"; `rootCause()` says it once.

This is the same navigation idea as
[03f · Navigating to elements](03f-navigating-to-elements.md): the chain moves, and what you
can say afterwards depends on where you landed.

## Gotchas

**★ `hasCauseInstanceOf` matches supertypes.**
`hasCauseInstanceOf(RuntimeException.class)` passes for any unchecked exception — the docs'
own example shows it passing for a `NullPointerException` cause. If the exact type matters,
`hasCauseExactlyInstanceOf`. A test asserting a broad supertype survives the cause changing
entirely.

**★ Confusing cause with root cause in a layered stack.**
Three frameworks deep, `hasCauseInstanceOf` sees the nearest wrapper and `hasRootCauseInstanceOf`
sees the original. Asserting the wrong one produces a test that passes for the wrong reason
and breaks when an intermediate layer is upgraded.

**★ `hasMessage` as the only assertion.**
Brittle on a typo fix, silent on the wrong exception type. Assert the type first; assert a
*value* inside the message with `hasMessageContaining`, not the whole sentence.

**★ `hasMessageMatching` takes a regex that must match the WHOLE message.**
Not a search. `hasMessageMatching("wrong amount")` fails on `"wrong amount 123"`; the docs'
example is `"wrong amount .*"`. This is `String.matches` semantics, and it catches people who
expected `find`.

**★ Asserting a localised message.**
A message built through a `MessageSource` or a `ResourceBundle` changes with the JVM's
default locale, so the test passes on the developer's machine and fails on a CI box with a
different locale. Assert the type, or a code, never the localised text.

**★ `hasNoCause()` forgotten on an exception your code constructs.**
A validation exception that quietly starts wrapping something is a behaviour change, and
without `hasNoCause()` no test notices.

**★ Three `hasRootCauseX` calls where `rootCause()` would do.**
Repetition, and each one re-walks the cause chain. `rootCause()` navigates once and gives you
the full API.

**★ A message assertion that duplicates the production string literal.**
When the test contains the same sentence as the code, the test is a copy of the
implementation and cannot disagree with it. It will fail whenever the sentence changes and
never when the behaviour does.

**★ `cause()` on an exception with no cause.**
The navigation has nothing to navigate to and the assertion fails there rather than at the
check you meant to make. Assert `hasCauseInstanceOf(...)` first if the presence of a cause is
itself in question.

**★ Asserting the message of an exception thrown by a framework you do not control.**
Spring, Hibernate and the JDK all reword messages between versions. Any assertion on their
text is a dependency-upgrade tripwire that tells you nothing about your own code.

## Interview questions

**★ What is the difference between `hasCauseInstanceOf` and `hasRootCauseInstanceOf`?**
`hasCause…` looks at the immediate cause — one level down. `hasRootCause…` walks to the end
of the chain. In a layered application they usually see different exceptions: the nearest
wrapper versus the thing that actually went wrong. Assert the cause when the wrapping is part
of the contract, the root cause when the intermediate layers are incidental.

**★ Why does `hasCauseInstanceOf(RuntimeException.class)` pass for a `NullPointerException`
cause?**
Because it is an `instanceof` check and `NullPointerException` is a `RuntimeException`. The
documentation's example shows both passing on the same throwable. `hasCauseExactlyInstanceOf`
is the assertion that requires the exact class.

**★ When is asserting an exception message legitimate?**
When the message contains a value that must be present — a field name, an id — in which case
assert that substring with `hasMessageContaining` rather than the whole sentence. Or when the
message is genuinely part of a contract, such as an API error body a client parses; then it
is an interface, not prose. As the sole assertion in a test, or on a framework's message, it
is a liability.

**★ `hasMessageMatching("wrong amount")` fails on the message `"wrong amount 123"`. Why?**
Because it is `String.matches` semantics — the regex must match the entire message, not
occur within it. The documentation's working example is `"wrong amount .*"`. If you want a
search, `hasMessageContaining` is the method.

**★ When would you use `cause()` rather than the `hasCause…` shortcuts?**
When you have more than one thing to say about the cause. `cause()` moves the assertion onto
that throwable and gives you the full `Throwable` API — message, type, its own cause —
instead of the few `hasCause…` methods, and it walks the chain once rather than per
assertion.

**★ What does `hasNoCause()` actually assert, and when is it worth writing?**
That the throwable originated where it was constructed rather than wrapping something
deeper. It is worth writing for exceptions your own code creates — a validation failure that
silently starts wrapping a lower-level exception is a real behaviour change that no other
assertion in the test would catch.

**★ A test asserts `hasMessage("Order 42 not found")` and fails after someone rewords the
message to "No order with id 42". Is the test right to fail?**
No — nothing about the behaviour changed. The test pinned prose. What it should assert is
the exception type and, if the id matters, `hasMessageContaining("42")`. The failure is the
test's fault, and it is the reason message assertions should be the narrowest thing that
still checks what you care about.

{/* FOOTER */}
