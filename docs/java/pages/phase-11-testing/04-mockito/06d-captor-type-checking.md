---
title: "Since 5.0.0 a captor type-checks what it captures, and because the captor is the argument matcher for that position, a wrongly typed captor does not capture a wrong value — it makes the verification fail on a call that visibly happened"
sidebar_label: "06d · Captor type checking"
sidebar_position: 26
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the class javadoc of
> [`ArgumentCaptor`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/ArgumentCaptor.java)
> (*"will perform type checking on the generic type (since Mockito 5.0.0)"*), the body of
> [`CapturingMatcher`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/internal/matchers/CapturingMatcher.java)
> (`matches`, `toString`, `type`), and
> [`CaptorAnnotationWithPrimitiveTest`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-extensions/mockito-junit-jupiter/src/test/java/org/mockitousage/annotation/CaptorAnnotationWithPrimitiveTest.java).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**Mockito 4 captors accepted anything and stored it. Mockito 5 captors check the argument's class
before accepting it, and the class javadoc announces it in one sentence most people skim past.
That single change turns a whole family of "captured the wrong thing" bugs into a different
failure — one whose message points at the mock rather than at the captor — and it is the reason
a `verify` you can prove happened sometimes reports "wanted but not invoked".**

## The sentence

> *"This utility class **will** perform type checking on the generic type (since Mockito 5.0.0)."*

And the check itself, which lives in the matcher — because as
[06 · Argument captors](06-argument-captors.md) established, a captor *is* a matcher:

```java
@Override
public boolean matches(Object argument) {
    if (argument == null) {
        return true;
    }
    if (Primitives.isPrimitiveOrWrapper(clazz)) {
        return Primitives.isAssignableFromWrapper(clazz, argument.getClass());
    }
    return clazz.isAssignableFrom(argument.getClass());
}
```

Three branches, three separate behaviours worth knowing.

## 🔴 Consequence 1 — a wrong type fails the verification, not the capture

This is the counter-intuitive one and it is worth being slow about. `capture()` is implemented as
`Mockito.argThat(capturingMatcher)`, so the captor occupies the matcher slot for that argument.
When `matches` returns `false`, Mockito's matching engine concludes that **this invocation is not
the one you asked about**. It does not conclude "the captor is misconfigured", because it has no
concept of that.

```java
// the mock's method takes a CustomerId
@Captor ArgumentCaptor<String> customerId;   // wrong type — CustomerId is a record, not a String

service.suspend(new CustomerId("c-42"));

verify(repository).suspend(customerId.capture());
```

`String.class.isAssignableFrom(CustomerId.class)` is `false`, so the matcher rejects the only
invocation there is, and `verify` fails with **"Wanted but not invoked"** against a call you can
see two lines above. The captor's declaration is nowhere in the message.

The one thing that does point at it: the matcher's `toString`.

```java
@Override
public String toString() {
    return "<Capturing argument: " + clazz.getSimpleName() + ">";
}
```

Mockito prints the wanted invocation using the matchers' `toString()`, so the "wanted" line reads
`suspend(<Capturing argument: String>)` while the "actual" line shows the `CustomerId`. **When a
verification fails on a call you know happened, read the wanted line for
`<Capturing argument: …>` and check that class first.** It is nearly always a captor whose type
argument drifted after a refactor changed a parameter from `String` to a value type.

## Consequence 2 — `null` is always captured

The null check comes first and returns `true` unconditionally. So:

- a captor of any type matches a `null` argument;
- `getValue()` afterwards returns `null`;
- a test that reads a field off `getValue()` gets an `NullPointerException` **from the assertion
  line**, not from the code under test, and the stack trace blames your test.

If a null argument is itself the bug, say so:

```java
verify(repository).suspend(customerId.capture());
assertThat(customerId.getValue()).isNotNull();          // or, better:
assertThat(customerId.getValue()).isEqualTo(EXPECTED_ID);
```

The second form covers the first. A bare `assertThat(captor.getValue().field()).isEqualTo(…)`
does not — it turns "the code passed null" into an NPE in the test.

## Consequence 3 — primitives match through their wrappers

`int.class` and `Integer.class` are unrelated under `isAssignableFrom`, and the argument arriving
at the matcher has already been boxed by the JVM. Without the primitive branch, an
`ArgumentCaptor<Integer>` on a method declared `void doSomething(int value)` would never match.
Mockito's own test asserts that it does:

```java
@ExtendWith(MockitoExtension.class)
public class CaptorAnnotationWithPrimitiveTest {
    @Mock private Foo foo;

    static class Foo {
        void doSomething(int value) {}
    }

    @Test
    public void shouldCaptorPrimitive(@Captor ArgumentCaptor<Integer> captor) {
        int value = 1;
        doNothing().when(foo).doSomething(captor.capture());
        foo.doSomething(value);
        assertEquals(1, captor.getValue());
    }
}
```

`Primitives.isAssignableFromWrapper(clazz, argument.getClass())` is the branch that makes it work.
Note also that you cannot write `ArgumentCaptor<int>` — a type argument must be a reference type
— so the wrapper is the only thing you *can* declare, and Mockito has to meet you there.

⚠️ The direction matters: a captor declared `ArgumentCaptor<Long>` on a method taking `int` will
**not** match, because `Long` and `Integer` are unrelated. Widening does not happen at the
matcher. This is the same rule as `eq(1)` failing against a `long` parameter, covered in
[04b · The matcher catalogue](04b-the-matcher-catalogue.md).

## 🔴 What the check cannot do: elements

The `clazz` the captor holds is always an erasure — `List.class` for an
`ArgumentCaptor<List<String>>`, whether you built it with `@Captor`, with `captor()`, or with the
double cast ([06b](06b-captors-and-generics.md), [06c](06c-the-captor-factory.md)). So:

```java
@Captor ArgumentCaptor<List<String>> recipients;
// …
verify(channel).send(recipients.capture());   // captures a List<Integer> just as happily
```

There is nothing in the JVM that knows the element type of the list that arrived. The type check
stops at `List`. Everything below that is the assertion's job:

```java
verify(channel).send(recipients.capture());
assertThat(recipients.getValue())
        .containsExactlyInAnyOrder("a@example.com", "b@example.com");
```

This is one more argument for a captor over `argThat` for verification: the failure message names
both lists. See [06 · Argument captors](06-argument-captors.md) for the full comparison, and
[../02-assertj/03-collections.md](../02-assertj/03-collections.md) for the assertions.

## Subtypes are accepted, and that is on purpose

`clazz.isAssignableFrom(argument.getClass())` — so `ArgumentCaptor<Event>` captures an
`OrderPlaced`, and `ArgumentCaptor<Object>` captures everything. That is the right default: you
frequently want to capture at the interface a collaborator is declared with and then assert on the
concrete type:

```java
@Captor ArgumentCaptor<DomainEvent> published;

verify(publisher).publish(published.capture());

assertThat(published.getValue())
        .isInstanceOf(OrderPlaced.class)
        .extracting("orderId").isEqualTo(ORDER_ID);
```

The corollary is the raw-field gotcha from [06b](06b-captors-and-generics.md): a captor whose
class silently degraded to `Object.class` accepts everything, which means the 5.0.0 check is
present but vacuous.

## Gotchas

**★ A verification fails with "Wanted but not invoked" on a call you can see happening.**
The captor is the argument matcher for that position, and since 5.0.0 it returns `false` for an
argument that is not assignable to its class. Mockito reports no matching invocation, not a
misconfigured captor. Read the "wanted" line for `<Capturing argument: X>` and check whether `X`
is still the parameter's type — this breaks silently when a refactor replaces a `String`
parameter with a value type.

**★ The runtime type check is on the erasure only, so `ArgumentCaptor<List<String>>` captures a
`List<Integer>`.**
`CapturingMatcher` only does `clazz.isAssignableFrom(argument.getClass())`, and `clazz` is
`List.class` for every route that builds it. Assert on the elements after capturing:
`assertThat(captor.getValue()).containsExactly("a", "b")`.

**★ `null` arguments are captured by every captor.**
`matches(null)` returns `true` before any type check runs. So a captor never reports "that
argument was the wrong type" when the argument was absent, and `getValue()` returns `null`. A
test that dereferences `getValue()` then fails with an NPE inside its own assertion, blaming the
test rather than the code. Assert the whole value, not a field of it.

**★ An `ArgumentCaptor<Object>` — or a raw one, or one whose type argument is a type variable —
turns the check off entirely.**
All three end at `Object.class`, and `Object.class.isAssignableFrom(anything)` is `true`. The
captor still compiles, still captures, and no longer protects you from capturing on the wrong
overload. See [06b · Captors and generics](06b-captors-and-generics.md) for how a field
degrades to `Object.class` without a word of warning.

**★ A captor declared with the wrong numeric wrapper does not widen.**
`ArgumentCaptor<Long>` against a method taking `int` fails to match: the argument boxes to
`Integer`, and `Primitives.isAssignableFromWrapper(Long.class, Integer.class)` is `false`. Match
the declared parameter type exactly.

**★ Upgrading from Mockito 4 to 5 can turn a passing test red at the verification.**
Before 5.0.0 the captor accepted every argument, so a captor with a stale type argument captured
happily and any assertion that did not touch the object's type still passed. After 5.0.0 the same
captor rejects the invocation and the verification fails. The test was always wrong; 5.0.0 is the
first version that says so.

**★ Capturing on a supertype is fine and often correct, but then assert the concrete type.**
`ArgumentCaptor<DomainEvent>` accepts every subclass, so a `verify` will pass even if the code
published the wrong event. Follow it with `isInstanceOf(OrderPlaced.class)` — the capture proved
*something* was published, not *what*.

## Interview questions

**★ Mockito 5 made captors type-check. What actually changed, and where does the failure surface?**
`CapturingMatcher.matches` now returns `false` for an argument that is not assignable to the
captor's class instead of accepting everything. Because the captor occupies the argument-matcher
slot, a rejection means Mockito finds no matching invocation — so the failure surfaces as
"Wanted but not invoked" on the `verify`, not as a wrong captured value. The only hint pointing
back at the captor is the matcher's `toString()`, `"<Capturing argument: " +
clazz.getSimpleName() + ">"`, which Mockito prints in the "wanted" line.

**★ Does a captor for `List<String>` reject a `List<Integer>`?**
No. The class the captor holds is the erasure — `List.class` — regardless of whether it came from
`@Captor`, from `captor()`, or from a cast, because that is all the JVM retains. The check stops
at `List`. If the element type matters it has to be asserted after the capture, which is exactly
the kind of thing a captor is better at than `argThat`.

**★ Why does an `ArgumentCaptor<Integer>` work on a method that declares an `int` parameter?**
The argument has already been boxed by the time it reaches the matcher, and `int.class` is not
assignable from `Integer.class` under plain reflection, so `CapturingMatcher` has a dedicated
branch: if the captor's class is a primitive or a wrapper it uses
`Primitives.isAssignableFromWrapper`. You could not declare `ArgumentCaptor<int>` anyway — a type
argument must be a reference type — so Mockito has to accept the wrapper. It does not widen,
though: `ArgumentCaptor<Long>` against an `int` parameter still fails to match.

**★ Why does a captor always match `null`?**
Because `matches` returns `true` for a `null` argument before it looks at the class — there is no
class to look at. The practical consequence is that a captor tells you nothing about a null
argument, and a test that reads a field off `getValue()` will NPE inside its own assertion rather
than reporting that the code passed null. Assert the whole captured value against an expected
value; that covers both cases in one line.

**★ You upgraded Mockito 4 to 5 and a verification started failing. What would you check first?**
The captors. Before 5.0.0 captors accepted everything, so a captor whose type argument had gone
stale — a parameter refactored from `String` to a value type, say — kept working. From 5.0.0 the
same captor rejects the invocation and the verification reports "wanted but not invoked". The
"wanted" line will contain `<Capturing argument: OldType>`, which names the offender.

{/* FOOTER */}
