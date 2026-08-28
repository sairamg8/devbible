---
title: "A captor is a mutable object with a lifetime, and almost every remaining captor bug is a lifetime bug — capturing nothing and throwing from your assertion line, capturing twice because one captor served two verifications, or capturing a reference the code went on to mutate"
sidebar_label: "06f · The captor's lifetime"
sidebar_position: 28
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the class javadoc and `getValue` javadoc of
> [`ArgumentCaptor`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/ArgumentCaptor.java),
> the body of
> [`CapturingMatcher`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/internal/matchers/CapturingMatcher.java)
> (`captureFrom`, `getLastValue`, `getAllValues`), the
> [`Reporter.noArgumentValueWasCaptured`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/internal/exceptions/Reporter.java)
> message text, and
> [`ArgumentCaptorDontCapturePreviouslyVerifiedTest`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/test/java/org/mockitousage/bugs/ArgumentCaptorDontCapturePreviouslyVerifiedTest.java).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**[06e · Captors and multiplicity](06e-captors-and-multiplicity.md) established the one fact this
chunk lives off: `CapturingMatcher.captureFrom` appends to an `ArrayList` and the class has no
`clear()`. That append-only list has a lifetime — it starts empty, it grows, and it never shrinks
— and the three remaining ways a captor lies to you are all consequences of not thinking about
that lifetime. Each one is fixable with a rule you can apply without thinking, which is the point
of writing them down.**

## The empty captor

`getValue()` on a captor that never matched anything does not return `null`. It throws, and the
message is worth reading because it is unusually good at naming the two causes:

```java
public static MockitoException noArgumentValueWasCaptured() {
    return new MockitoException(
            join(
                    "No argument value was captured!",
                    "You might have forgotten to use argument.capture() in verify()...",
                    "...or you used capture() in stubbing but stubbed method was not called.",
                    "Be aware that it is recommended to use capture() only with verify()",
                    "",
                    "Examples of correct argument capturing:",
                    "    ArgumentCaptor<Person> argument = ArgumentCaptor.forClass(Person.class);",
                    "    verify(mock).doSomething(argument.capture());",
                    "    assertEquals(\"John\", argument.getValue().getName());",
                    ""));
}
```

Note what it is *not*: it is not a verification failure. It is a `MockitoException` thrown from
your assertion line, about a captor, with nothing pointing at the call that never happened. That
is exactly the "reduced defect localization" the class javadoc warns about when it tells you not
to capture during a stubbing:

> ***Warning:*** *it is recommended to use ArgumentCaptor with verification **but not** with
> stubbing. … It may also reduce defect localization because if the stubbed method was not called,
> then no argument is captured.*

Compare the two shapes when `save` is never called:

```java
// don't — the failure is "No argument value was captured!" at the assertion
when(repository.save(captor.capture())).thenReturn(saved);
service.confirm(ORDER_ID);
assertThat(captor.getValue().status()).isEqualTo(CONFIRMED);

// do — the failure is "Wanted but not invoked: repository.save(...)" at the verification
when(repository.save(any())).thenReturn(saved);
service.confirm(ORDER_ID);
verify(repository).save(captor.capture());
assertThat(captor.getValue().status()).isEqualTo(CONFIRMED);
```

The second one names the missing call and the line it was expected from. The first names a
captor.

`getAllValues()` on an empty captor is different again — it returns an **empty list**, not an
exception, because the emptiness check lives only in `getLastValue`. So
`assertThat(captor.getAllValues()).hasSize(2)` fails as an ordinary AssertJ size assertion, which
is a friendlier failure than the exception. That is a small extra reason to prefer
`getAllValues()`.

## 🔴 A reused captor accumulates across verifications

Because `captureFrom` only appends, and because a later `verify` re-walks invocations a previous
`verify` already matched. Mockito pins the re-walking in its own regression test:

```java
mock.oneArg("first");
ArgumentCaptor<String> argument = ArgumentCaptor.forClass(String.class);
verify(mock, times(1)).oneArg(argument.capture());
assertThat(argument.getAllValues()).hasSize(1);

// additional interactions
mock.oneArg("second");
argument = ArgumentCaptor.forClass(String.class);          // ← a FRESH captor
verify(mock, times(2)).oneArg(argument.capture());
assertThat(argument.getAllValues()).hasSize(2);
```

Read the line with the comment. Mockito's own test **replaces** the captor before the second
verification. Had it reused the first one, the second `verify(mock, times(2))` would have appended
both invocations again on top of the one already stored — three entries for two calls, and every
index in the assertion shifted by one.

The rules that follow:

- **One captor per verification**, or **one verification per captor** — pick whichever phrasing
  you like, they are the same rule.
- A `@Captor` **field** used by two verifications in one test is the standard way to hit this. A
  `@Captor` **parameter**, or a local `ArgumentCaptor.captor()`, scopes it naturally
  ([06c · The captor() factory](06c-the-captor-factory.md)).
- Across *tests* you are safe: `MockitoExtension` re-initialises annotated fields before each test
  method, so the captor object itself is new every time.

The same arithmetic explains a subtler shape — two verifications of *different methods* that both
take the same type, sharing one captor:

```java
@Captor ArgumentCaptor<Order> order;              // shared — don't

verify(auditLog).record(order.capture());
verify(repository).save(order.capture());

assertThat(order.getAllValues()).hasSize(1);      // fails: two entries, not one
```

Two captors, named for what they capture, and the test reads better as well:

```java
@Captor ArgumentCaptor<Order> audited;
@Captor ArgumentCaptor<Order> saved;

verify(auditLog).record(audited.capture());
verify(repository).save(saved.capture());
```

## A captor stores a reference, not a snapshot

`captureFrom` does `arguments.add(argument)`. Nothing is copied. If the code under test keeps
mutating the object after the call:

```java
public void confirm(OrderId id) {
    Order order = repository.load(id);
    auditLog.record(order);          // captured here
    order.setStatus(SHIPPED);        // mutated after
    repository.save(order);
}
```

then `captor.getValue().getStatus()` sees `SHIPPED`, not the status at the moment of the call. The
test looks like it asserts on what was passed and actually asserts on the object's final state.

This is not a captor bug — `eq(expectedOrder)` has the same hazard, and so does any interaction
test over a mutable argument. It is a design argument for immutable argument types: a record or a
value object cannot drift between the call and the assertion, and interaction tests over them mean
exactly what they appear to mean.

If you are stuck with a mutable type you cannot change, take the snapshot yourself, in an answer,
at the moment of the call — [03c · Answers](03c-answers.md):

```java
List<OrderStatus> statusAtCall = new ArrayList<>();
doAnswer(inv -> {
    statusAtCall.add(inv.<Order>getArgument(0).getStatus());
    return null;
}).when(auditLog).record(any());

service.confirm(ORDER_ID);

assertThat(statusAtCall).containsExactly(PENDING);
```

That is more code than a captor and it is the honest amount of code for the question being asked.

## Gotchas

**★ A captor reused across two verifications in one test accumulates.**
`captureFrom` only appends and a later `verify` re-walks invocations an earlier one already
matched — Mockito's own regression test creates a *fresh* captor before its second verification
for exactly this reason. `getAllValues()` is then longer than either verification implies and
every index shifts. One captor per verification.

**★ `getValue()` on a captor that captured nothing throws a `MockitoException`, not a verification
failure.**
The message is *"No argument value was captured! You might have forgotten to use
argument.capture() in verify()... or you used capture() in stubbing but stubbed method was not
called."* It is raised from your assertion line and names no call site in the code under test.
Always put a `verify` before the assertion so "wanted but not invoked" fires first.

**★ `getAllValues()` on an empty captor returns an empty list instead of throwing.**
The emptiness guard is in `getLastValue` only. This is usually what you want — an AssertJ
`hasSize(2)` failure reads better than a `MockitoException` — but it does mean
`captor.getAllValues().get(0)` gives you an `IndexOutOfBoundsException` with no Mockito context at
all.

**★ Capturing during a stubbing turns a missing call into the wrong exception.**
`when(repository.save(captor.capture())).thenReturn(saved)` followed by
`assertThat(captor.getValue()…)` fails with *"No argument value was captured!"* if `save` was
never called — an exception about a captor, from your assertion line. A
`verify(repository).save(captor.capture())` fails first, with *"Wanted but not invoked"*, at the
verification. The javadoc says exactly this: *"if the stubbed method was not called, then no
argument is captured."*

**★ Asserting on a captured object the code mutated afterwards.**
A captor stores the reference, not a copy. If the code under test mutates the argument after the
call, the assertion sees the mutated state — the test appears to assert on what was passed and
actually asserts on the final state. Immutable argument types remove the hazard entirely; if you
cannot change the type, snapshot the field you care about inside a `doAnswer` at the moment of the
call.

**★ One captor shared by verifications of two different mocks or two different methods.**
Same append-only list, same accumulation. `getAllValues()` will hold both methods' arguments, and
the test's `hasSize(1)` fails for a reason that looks nothing like the actual mistake. Declare one
captor per thing you are capturing and name it after that thing.

**★ Captors are thread-safe, and this is load-bearing for `timeout` verifications.**
`CapturingMatcher` guards its list with a `ReentrantReadWriteLock`, so a mock exercised from a
worker thread can be captured from the test thread. That is a deliberate design decision, not an
accident — but it does not make the *test* correct; see
[05c · Async verification](05c-async-verification.md).

**★ A `@Captor` field survives the test method but not the test class.**
`MockitoExtension` re-initialises annotated fields before each test, so leakage between test
methods is not a thing. Leakage *within* one test method is entirely a thing, and it is the only
scope you have to police yourself.

## Interview questions

**★ You reused one `@Captor` field across two verifications in the same test and the list is
longer than you expected. Explain.**
`CapturingMatcher.captureFrom` only ever appends and the class has no `clear()`. A later `verify`
also re-walks invocations that an earlier `verify` already matched — Mockito's own
`ArgumentCaptorDontCapturePreviouslyVerifiedTest` pins that behaviour and deliberately allocates a
fresh captor before its second verification. So the second verification appends its matches on top
of the first's, and every index in the assertion shifts. One captor per verification; a `@Captor`
parameter or a local `captor()` makes the mistake unavailable.

**★ What happens if you call `getValue()` and nothing was captured?**
A `MockitoException` — *"No argument value was captured!"* — thrown from your assertion line, not a
verification failure. The message itself lists the two causes: you forgot `capture()` inside a
`verify`, or you captured during a stubbing whose method was never invoked. `getAllValues()`
behaves differently: it returns an empty list, because the emptiness guard is only in
`getLastValue`.

**★ Why does Mockito recommend a captor with verification but not with stubbing?**
Two reasons it states outright. Readability — the captor is created outside the assertion block,
so the test reads out of order. And defect localisation — *"if the stubbed method was not called,
then no argument is captured"*, so a missing call surfaces as a `MockitoException` about an empty
captor at your assertion rather than a clear "wanted but not invoked" at the verification. The
first message names your test; the second names the code under test.

**★ Can a captor make a test pass for the wrong reason?**
Several ways, and all of them are lifetime problems. It stores a reference rather than a snapshot,
so a mutation after the call is invisible to the test's intent. A captor shared across two
verifications produces a list whose indexes do not mean what the reader assumes. And an assertion
that reads only `getValue()` after a `times(3)` never inspects two of the three calls
([06e](06e-captors-and-multiplicity.md)). `getAllValues()` with a whole-list assertion, one captor
per verification, and immutable argument types close all three.

**★ Why is `CapturingMatcher` synchronised?**
Because a mock can legitimately be exercised on a different thread from the one running the
assertions — a `verify(mock, timeout(500))` against work handed to an executor is the standard
case. `captureFrom` takes a write lock, `getLastValue` and `getAllValues` take a read lock, and
`getAllValues` returns a copy so the caller cannot iterate a list that is still being appended to.
It makes the captor safe; it does not make an async test deterministic, which is a separate problem
covered in [05c · Async verification](05c-async-verification.md).

**★ How would you assert on an argument whose object the code mutates immediately after the call?**
Not with a captor, because a captor holds the reference and sees the mutation. Record the value
you care about at the moment of the call, inside a `doAnswer` on the mock, into a local list, then
assert on the list. The better answer in a code review is to make the argument type immutable —
once it is a record, the captor and the assertion agree by construction, and the whole class of
bug disappears.

{/* FOOTER */}
