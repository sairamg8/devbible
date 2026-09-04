---
title: "Consecutive stubbing gives one call site a different answer each time, and the trap is that writing two when blocks instead of one chained expression looks identical in a diff but silently keeps only the last value"
sidebar_label: "03b · Consecutive stubbing"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the class javadoc of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> section 10, *"Stubbing consecutive calls (iterator-style stubbing)"*, and the javadoc of
> [`OngoingStubbing`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/stubbing/OngoingStubbing.java)
> — `thenReturn(T)`, `thenReturn(T, T...)`, `thenThrow(Throwable...)`,
> `thenThrow(Class, Class...)`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**Sometimes the same call has to answer differently on the second attempt — a retry that
succeeds, a poll that eventually returns data, a token that expires. Mockito supports it, but
grudgingly, and the syntax has a failure mode that is invisible in review: two `when` blocks
for the same arguments do not queue up answers, they overwrite each other. This chunk is the
half of [03 · Stubbing](03-stubbing.md) that deals with a stub that changes.**

## Two forms

Section 10, verbatim on why the feature exists at all:

> *"Sometimes we need to stub with different return value/exception for the same method call.
> Typical use case could be mocking iterators. Original version of Mockito did not have this
> feature to promote simple mocking. For example, instead of iterators one could use
> `Iterable` or simply collections. Those offer natural ways of stubbing (e.g. using real
> collections). In rare scenarios stubbing consecutive calls could be useful, though:"*

Note the framing — *"In rare scenarios"*. If you are stubbing an `Iterator` consecutively, the
documentation's own advice is to hand back a real collection instead.

**Chained form**, and it mixes returns and throws freely:

```java
when(mock.someMethod("some arg"))
  .thenThrow(new RuntimeException())
  .thenReturn("foo");
```

> *"First call: throws runtime exception … Second call: prints "foo" … Any consecutive call:
> prints "foo" as well (last stubbing wins)."*

**Varargs form**, for a run of plain returns:

```java
when(mock.someMethod("some arg")).thenReturn("one", "two", "three");
```

which the `when` javadoc states is exactly equivalent to chaining:

> *"`when(mock.someMethod("some arg")).thenReturn("one", "two");` is the same as:
> `when(mock.someMethod("some arg")).thenReturn("one").thenReturn("two");`"*

`thenThrow` has the same pair — `thenThrow(Throwable...)` for instances and
`thenThrow(Class, Class...)` for types:

```java
when(mock.someMethod("some arg")).thenThrow(new RuntimeException(), new NullPointerException());
```

⚠️ The varargs overloads are annotated `@SuppressWarnings({"unchecked", "varargs"})` in
Mockito's own source, with the comment *"Additional method helps users of JDK7+ to hide heap
pollution / unchecked generics array creation warnings (on call site)"*. For
`thenThrow(Class, Class...)` the javadoc adds that *"invoking this method will raise a
compiler warning "possible heap pollution", this API is safe to use"*, and that chaining
`thenThrow(Class)` avoids the warning. So a `-Werror` build may need the chained form.

## The sequence does not run out

After the last value, every further call returns that last value, forever.

> *"Last return value in the sequence (in example: 3) determines the behavior of further
> consecutive calls."*

There is no "no more answers" exception, and no failure on the fourth call of a three-value
stubbing. **The stubbing will not tell you the code called more times than you expected** —
only a `verify(mock, times(3))` will. If the count is part of what you are asserting, assert
it; do not infer it from the sequence.

## 🔴 The trap: two `when` blocks are not consecutive stubbing

Section 10 flags it explicitly:

> ***Warning*** *: if instead of chaining `.thenReturn()` calls, multiple stubbing with the
> same matchers or arguments is used, then each stubbing will override the previous one:*

```java
// All mock.someMethod("some arg") calls will return "two"
when(mock.someMethod("some arg")).thenReturn("one");
when(mock.someMethod("some arg")).thenReturn("two");
```

This reads exactly like an intent to return `"one"` then `"two"`, and it silently does not.
The two forms are one character apart in a diff — `;` versus `.` — and the failure mode is a
test asserting on the first call's result and getting the second's.

⚠️ The rule is *same matchers or arguments*. Two stubbings with **different** arguments do not
override each other; they are independent stubs and both stand. So this pair is fine:

```java
when(repository.findById(ID_1)).thenReturn(Optional.of(order1));
when(repository.findById(ID_2)).thenReturn(Optional.of(order2));
```

and this pair is not what it looks like, because `any()` covers `ID_1`:

```java
when(repository.findById(ID_1)).thenReturn(Optional.of(order1));
when(repository.findById(any())).thenReturn(Optional.empty());   // ← wins for ID_1 too
```

Both stubbings match a call with `ID_1`, and the javadoc's rule — *"Last stubbing is more
important"* — resolves it in favour of the later, broader one. Write the broad stubbing
**first** and the specific one after it, or do not mix the two on one method.

## Where it is genuinely the right tool

- **A retry.** The first attempt throws, the second succeeds; the assertion is that the caller
  ends up with the result and did not surface the first failure.

```java
when(gateway.charge(order))
    .thenThrow(new GatewayTimeoutException("t/o"))
    .thenReturn(APPROVED);

PaymentResult result = service.pay(order);

assertThat(result).isEqualTo(APPROVED);
verify(gateway, times(2)).charge(order);
```

  The `verify(times(2))` is doing real work here — without it, a code path that never retried
  and simply swallowed the exception could still leave `APPROVED` on the table if some other
  stubbing supplied it.

- **A poll.** `thenReturn(empty(), empty(), of(job))` describes a queue that fills on the third
  look.
- **A token that expires.** First call valid, subsequent calls rejected.
- **A clock that advances**, when injecting a controllable `Clock` is not available — though
  a `Clock` you control is better, and AssertJ's temporal chunk in
  [../02-assertj/08b-dates-and-times.md](../02-assertj/08b-dates-and-times.md) argues the same
  point from the assertion side.

## Where it is a smell

If a stubbing needs five consecutive values, the test is scripting a conversation rather than
describing behaviour. Two questions to ask:

1. **Is the sequence the thing under test, or just the shape of the implementation?** A retry
   count is behaviour. "It calls `next()` four times" is implementation.
2. **Would a fake say it better?** An in-memory queue or iterator hands back real values in
   real order, with no script to keep in step with the loop. See
   [12 · Mocks vs fakes](12-mocks-vs-fakes.md).

## Gotchas

**★ Two `when` blocks for the same call, expecting a sequence.**
`when(m.f()).thenReturn("one"); when(m.f()).thenReturn("two");` returns `"two"` every time —
the second stubbing overrides the first. Consecutive stubbing is
`.thenReturn("one").thenReturn("two")`, one statement. The javadoc warns about this
specifically, and it is a one-character diff.

**★ Assuming the consecutive sequence runs out.**
After the final value, every subsequent call keeps returning it. There is no failure on the
fourth call of a three-value stubbing, so a test that silently makes extra calls stays green.
If the number of calls matters, `verify(mock, times(n))` it.

**★ A specific stubbing written before a broad one on the same method.**
`when(f(ID_1))…` followed by `when(f(any()))…` means the `any()` stubbing wins for `ID_1` as
well, because last stubbing wins among matching ones. Order broad-to-specific, or keep them
apart.

**★ A `-Werror` build failing on the varargs form.**
`thenThrow(Class, Class...)` raises *"possible heap pollution"* at the call site. The javadoc
says the API is safe and points at chaining single-argument `thenThrow(Class)` calls instead.

**★ Consecutive stubbing on a mock whose calls are not in the order you think.**
The sequence is per *stubbing*, consumed in invocation order. If the code under test calls the
same method from two places, the second call site consumes the second value, which is almost
never what the test author meant.

**★ Scripting an iterator consecutively.**
Mockito's own documentation says to use a real `Iterable` or collection instead — *"Those
offer natural ways of stubbing"*. A scripted `hasNext()`/`next()` pair breaks the moment the
loop changes shape, and it cannot represent "one more element" without another edit.

**★ Mixing consecutive stubbing with `STRICT_STUBS` and an early return.**
Only the values actually consumed count as used, but the *stubbing* as a whole is one
stubbing — Mockito does not report leftover consecutive values as unnecessary. So a test that
supplies three values and consumes one passes strictness while proving less than it looks.

## Interview questions

**★ What does `when(m.f()).thenReturn("a"); when(m.f()).thenReturn("b");` do?**
Returns `"b"` on every call. Two separate stubbings with the same arguments override each
other; only the last stands. Returning `"a"` then `"b"` requires one statement:
`when(m.f()).thenReturn("a").thenReturn("b")`, or the shorthand `thenReturn("a", "b")`.

**★ What happens on the fourth call to a mock stubbed with `thenReturn(1, 2, 3)`?**
It returns `3`, and so does every call after it. The javadoc: *"Last return value in the
sequence (in example: 3) determines the behavior of further consecutive calls."* The sequence
never runs out and never fails, so it cannot be used as an implicit call-count assertion.

**★ How do you test that a call is retried once after a timeout?**
Stub consecutively — `thenThrow(timeout).thenReturn(result)` — assert on the returned result,
and add `verify(gateway, times(2)).charge(order)`. The verification is what distinguishes "it
retried" from "it never called the gateway a second time and got the value elsewhere".

**★ You have `when(repo.findById(ID)).thenReturn(x)` and, below it, `when(repo.findById(any())).thenReturn(empty())`. What does `findById(ID)` return?**
`Optional.empty()`. Both stubbings match, and the later one wins — *"Last stubbing is more
important."* Reordering them so the broad stubbing comes first fixes it, which is why broad
stubbings belong in the fixture and specific ones in the test, not the other way round.

**★ Can you mix returns and throws in one consecutive chain?**
Yes — `thenThrow(...).thenReturn(...)` is the documentation's own first example, and the two
kinds of answer share the same queue. The last one in the chain governs every call beyond the
end of the sequence.

**★ Mockito's documentation calls consecutive stubbing "rare". Why?**
Because the usual motivation is mocking an iterator, and a real `Iterable` or collection does
that better with no script to maintain. A sequence of canned answers encodes the order the
implementation happens to call things in, so it breaks on refactors that do not change
behaviour. The legitimate uses are the ones where the sequence *is* the behaviour — retry,
poll, expiry.

{/* FOOTER */}
