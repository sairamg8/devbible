---
title: "verify asserts that a conversation happened, which is a fundamentally different kind of claim from asserting on a returned value — and the whole family of verification modes exists to let you say exactly how much of that conversation you are willing to be coupled to"
sidebar_label: "05 · Verification"
sidebar_position: 18
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> sections 1, 4, 7 and 35 of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> and the method javadocs of `verify`, `times`, `never`, `atLeastOnce`, `atLeast`,
> `atMostOnce`, `atMost`, `only` and `description`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**An assertion says "the result was X". A verification says "the object under test told
somebody to do Y". Those are different claims with different costs, and the cost of the second
is coupling: every verification is a statement about *how* the code achieves its result, and
therefore something that can break when the result does not. This chunk is the whole
verification API's counting modes and what each one actually claims. Ordering is
[05b · InOrder](05b-inorder.md), async verification is
[05c · Async verification](05c-async-verification.md), and the argument about how
much to verify is [05d · Verifying too much](05d-verifying-too-much.md).**

## State versus interaction

```java
// state assertion — about the outcome
PaymentResult result = service.pay(order);
assertThat(result.status()).isEqualTo(APPROVED);

// interaction assertion — about the conversation
verify(gateway).charge(order);
```

The rule from [01b · Mock, stub, spy, fake](01b-mock-stub-spy-fake.md) applies directly: verify
an interaction only when the interaction **is** the observable behaviour. Sending an email,
publishing an event, writing to a repository, calling a payment gateway — those have no return
value the test can look at, so the call is the only evidence.

🔴 **A stubbed call does not also need verifying.** Section 2 makes the argument:

> *"Although it is possible to verify a stubbed invocation, usually **it's just redundant**. If
> your code cares what `get(0)` returns, then something else breaks (often even before
> `verify()` gets executed). If your code doesn't care what `get(0)` returns, then it should not
> be stubbed."*

The stubbing already *is* a kind of verification: if the call had not happened with those
arguments, the stubbed value would not have flowed into the result you are asserting on. Under
`STRICT_STUBS` this becomes explicit — an unused stubbing fails the test.
See [07 · Strictness](07-strictness.md).

## The basic form

```java
//mock creation
List mockedList = mock(List.class);

//using mock object
mockedList.add("one");
mockedList.clear();

//verification
verify(mockedList).add("one");
verify(mockedList).clear();
```

> *"Once created, a mock will remember all interactions. Then you can selectively verify
> whatever interactions you are interested in."*

Note the word **selectively**. Verification is opt-in per interaction, and the default is that
unverified calls are fine. `verifyNoMoreInteractions` is what changes that, and it is exactly
where over-specification comes from — [05d](05d-verifying-too-much.md).

⚠️ And Mockito's own aside on the example is worth repeating: *"In reality, please don't mock the
List class. Use a real instance instead."* The list is a teaching device, not a pattern.

## Counting modes

```java
//using mock
mockedList.add("once");

mockedList.add("twice");
mockedList.add("twice");

mockedList.add("three times");
mockedList.add("three times");
mockedList.add("three times");

//following two verifications work exactly the same - times(1) is used by default
verify(mockedList).add("once");
verify(mockedList, times(1)).add("once");

//exact number of invocations verification
verify(mockedList, times(2)).add("twice");
verify(mockedList, times(3)).add("three times");

//verification using never(). never() is an alias to times(0)
verify(mockedList, never()).add("never happened");

//verification using atLeast()/atMost()
verify(mockedList, atMostOnce()).add("once");
verify(mockedList, atLeastOnce()).add("three times");
verify(mockedList, atLeast(2)).add("three times");
verify(mockedList, atMost(5)).add("three times");
```

> ***"times(1) is the default.** Therefore using times(1) explicitly can be omitted."*

| Mode | Claim | Strength |
|---|---|---|
| `times(n)` | exactly *n* | strongest count claim |
| *(default)* | exactly 1 — `times(1)` | same |
| `never()` | zero — *"an alias to times(0)"* | strong, and the most useful negative |
| `atLeastOnce()` | ≥ 1 | weak |
| `atLeast(n)` | ≥ *n* | weak |
| `atMostOnce()` | ≤ 1 | weak, and passes when nothing happened |
| `atMost(n)` | ≤ *n* | weak, and passes when nothing happened |
| `only()` | exactly 1, and nothing else on that mock | strongest of all |
| `calls(n)` | exactly *n* *in this position of the order* | in-order only — [05b](05b-inorder.md) |

🔴 **`atMost` and `atMostOnce` pass when the call never happened at all.** `atMost(3)` is
satisfied by 0, 1, 2 or 3 invocations. If the point of the test is that the call happened, an
`atMost` verification does not make it — pair it with an `atLeastOnce`, or use `times`.

### `only()`

```java
verify(mock, only()).someMethod();
//above is a shorthand for following 2 lines of code:
verify(mock).someMethod();
verifyNoMoreInteractions(mock);
```

It is `verifyNoMoreInteractions` with a nicer name, and it inherits every objection to it —
[05d · Verifying too much](05d-verifying-too-much.md).

## `description` — a custom failure message

```java
// will print a custom message on verification failure
verify(mock, description("This will print on failure")).someMethod();

// will work with any verification mode
verify(mock, times(2).description("someMethod should be called twice")).someMethod();
```

Underused. A failed `verify(auditLog, times(2)).record(any())` tells the reader what did not
happen; `.description("every state change must be audited")` tells them why anyone cares. Same
argument AssertJ makes with `describedAs` —
[../02-assertj/09-describedas-and-messages.md](../02-assertj/09-describedas-and-messages.md).

## `assertArg`, the alternative to verifying arguments loosely

Section 55, since 5.3.0:

```java
verify(serviceMock).doStuff(assertArg(param -> {
  assertThat(param.getField1()).isEqualTo("foo");
  assertThat(param.getField2()).isEqualTo("bar");
}));
```

> *"To validate arguments during verification, instead of capturing them with `ArgumentCaptor`,
> you can now use `ArgumentMatchers#assertArg(Consumer)`"*

Its caveats are in [04c · Custom matchers](04c-custom-matchers.md), and the captor comparison is
[06 · Argument captors](06-argument-captors.md).

## Gotchas

**★ Verifying a call you also stubbed.**
The stubbing already proves the call happened with those arguments, because otherwise the stubbed
value could not have reached your assertion. Mockito calls the extra `verify` *"just redundant"*,
and it doubles the maintenance cost of every change to the collaboration.

**★ `atMost(n)` used to assert that something happened.**
It is satisfied by zero invocations. A test whose only verification is `atMost(3)` passes when the
code does nothing at all.

**★ `only()` used casually.**
It is `verify(...)` plus `verifyNoMoreInteractions(...)` in one token, so it carries the full
over-specification cost while looking like a small tightening.

**★ `verify(mock);` with no method call after it.**
The mock is left in verification mode. The next interaction with it — possibly in a later test —
is consumed as the verification target, and Mockito reports `UnfinishedVerificationException`
from a line that has nothing to do with the mistake: *"Missing method call for verify(mock)
here"*. It is the mirror image of a dangling `doReturn(x).when(mock);`.

**★ `verify(mock.someMethod())` instead of `verify(mock).someMethod()`.**
A misplaced parenthesis. Mockito's own error lists it: *"Argument passed to verify() should be a
mock but is null!"* … *"not: verify(mock.someMethod());"*. The method's return value — usually
`null` — is what reached `verify`.

**★ `verify` on a real object rather than a mock.**
`NotAMockException`: *"Argument passed to verify() is of type X and is not a mock! Make sure you
place the parenthesis correctly!"* Usually a `@Mock` field that was never initialised because no
extension was registered, or a real object substituted during a refactor.

**★ Verifying `equals`, `hashCode`, a `final` method or a `private` method.**
Mockito reports that those *"cannot be stubbed/verified"*. The call was never intercepted, so
there is nothing recorded to verify — and any matcher you used is left on the thread-local stack
to break the next interaction.

**★ `times(n)` on a call made inside a loop.**
The count is now a statement about the loop bound. A refactor that batches two calls into one
breaks the test without changing behaviour. Verify the effect, or capture and assert on the
collection of arguments.

**★ Verification after `reset(mock)`.**
`reset` clears interactions as well as stubbings — *"at this point the mock forgot any
interactions and stubbing"*. Anything before the reset is unverifiable afterwards, and the
javadoc calls `reset()` in the middle of a test *"a code smell (you're probably testing too
much)"*.

**★ A verification that could never fail.**
`verify(mock, atLeast(0)).anything()` and `verify(mock, atMost(99))` are always satisfied. So is
a `never()` on a method the code has no way of calling. A verification that cannot go red is the
interaction-testing equivalent of an assertion that asserts nothing.

**★ A verification with no `description` on a mock with several similar methods.**
The default message names the method and the invocations Mockito saw, which is a lot of text and no
intent. `description("…")` costs one call and turns the failure into a sentence.

## Interview questions

**★ What is the difference between an assertion and a verification?**
An assertion is about state — the value the code produced. A verification is about interaction —
the call the code made. Use a verification only when the call *is* the observable effect (an email
sent, an event published, a row written), because otherwise you are asserting on how the code
reaches a result rather than on the result.

**★ Why is verifying a stubbed call redundant?**
Because the stubbing already constrains it. If the code did not make that call with those
arguments, the stubbed value would not have flowed into the outcome you assert on, and the test
would fail anyway — usually earlier and with a better message. Mockito's own wording: *"If your
code cares what `get(0)` returns, then something else breaks … If your code doesn't care what
`get(0)` returns, then it should not be stubbed."*

**★ Does `atMost(3)` prove the call happened?**
No. It passes for zero invocations too. `atMost` and `atMostOnce` are upper bounds only; if the
test needs the call to have happened, use `times(n)` or combine with `atLeastOnce()`.

**★ What does `only()` do?**
It is shorthand for `verify(mock).someMethod()` followed by `verifyNoMoreInteractions(mock)` — the
call happened exactly once and nothing else happened on that mock. Its brevity hides how strong a
claim it is, and it inherits every over-specification problem `verifyNoMoreInteractions` has.

**★ How does Mockito decide whether a recorded invocation matches a `verify`?**
Same method, then the arguments compared with `equals()` — *"Mockito verifies argument values in
natural java style: by using an `equals()` method"* — unless argument matchers were used, in
which case the matchers on the thread-local stack decide. That is why an argument type without a
sensible `equals` makes verification awkward, and why Mockito's guidance is to give it one.

**★ Someone writes `verify(mock);` on its own line. What happens?**
The mock stays in verification mode and the next interaction with it is swallowed as the target,
so the error — `UnfinishedVerificationException`, *"Missing method call for verify(mock) here"* —
surfaces somewhere unrelated, possibly in a different test method. It is the same class of bug as
a `do…` stubbing with no trailing call.

**★ Is `verify(mock, atLeast(0)).foo()` a useful test?**
No — it is satisfied by every possible execution, including one where `foo` is never called. It
is a verification that cannot fail, which is the interaction-testing version of an assertion that
asserts nothing. The same applies to a bare `atMost(n)` used as though it proved the call
happened.

**★ How do you improve a verification's failure message?**
`description("…")`, which works on a bare `verify` and on any mode: `verify(mock, times(2).description("…"))`.
The default message lists invocations; the description explains what the reader should have expected
and why.

{/* FOOTER */}
