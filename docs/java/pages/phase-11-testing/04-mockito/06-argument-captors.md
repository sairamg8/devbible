---
title: "A captor asserts after the fact with a real failure message and a matcher decides during the call with a boolean, which is why Mockito recommends captors for verification and matchers for stubbing — and why capturing during a stubbing is the one combination its javadoc warns against"
sidebar_label: "06 · Argument captors"
sidebar_position: 23
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> section 15 (*"Capturing arguments for further assertions"*) of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java),
> the class and method javadoc plus the bodies of
> [`ArgumentCaptor`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/ArgumentCaptor.java)
> (`capture`, `getValue`, `getAllValues`, `forClass`).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**When you need to assert something about an argument that `eq(...)` cannot express, you have
two tools and they fail very differently. `argThat` answers "did it match?" with a `boolean`, so
a failure says nothing was found. A captor grabs the object and hands it to your assertion
library, so a failure says which field was wrong and what it was. That difference is the whole
reason to prefer a captor for verification — and Mockito's own javadoc draws the same line, from
the other direction, when it tells you not to capture during a stubbing. Declaring a captor for a
generic type has its own problems and its own two answers —
[06b · Captors and generics](06b-captors-and-generics.md).**

## The mechanism

```java
public T capture() {
    T ignored = Mockito.argThat(capturingMatcher);
    return defaultValue(clazz);
}
```

A captor **is** an argument matcher. `capture()` registers a `CapturingMatcher` on the same
thread-local stack as every other matcher in
[04 · Argument matchers](04-argument-matchers.md), and that matcher accepts everything while
recording what it saw. Everything the matcher rules say applies unchanged:

- `capture()` *"must be used inside of verification"* — outside one it leaves a matcher on the
  stack and poisons the next interaction.
- If any argument in the call is captured, **every** argument must be a matcher.
  `verify(mock).send(captor.capture(), "urgent")` throws; the second argument needs `eq("urgent")`.
- The returned value is `defaultValue(clazz)` — `null` for reference types, the zero value for
  primitives. Nothing reads it.

## The basic use

```java
ArgumentCaptor<Person> argument = ArgumentCaptor.forClass(Person.class);
verify(mock).doSomething(argument.capture());
assertEquals("John", argument.getValue().getName());
```

`getValue()` has a documented subtlety:

> *"Returns the captured value of the argument. When capturing varargs use `getAllValues()`. If
> verified method was called multiple times then this method returns the latest captured value."*

**The latest, silently.** A test that captures across three calls and reads `getValue()` asserts
about the third one and looks like it asserts about "the" one.

## `getAllValues()`

```java
mock.doSomething(new Person("John");
mock.doSomething(new Person("Jane");

ArgumentCaptor<Person> peopleCaptor = ArgumentCaptor.forClass(Person.class);
verify(mock, times(2)).doSomething(peopleCaptor.capture());

List<Person> capturedPeople = peopleCaptor.getAllValues();
assertEquals("John", capturedPeople.get(0).getName());
assertEquals("Jane", capturedPeople.get(1).getName());
```

> *"Returns all captured values. Use it when capturing varargs or when the verified method was
> called multiple times. When varargs method was called multiple times, this method returns
> merged list of all values from all invocations."*

🔴 That last sentence is the trap. For a **varargs** method called twice with two arguments each,
`getAllValues()` returns **four** elements in one flat list, not two lists of two. There is no
API that gives you the per-invocation grouping.

```java
mock.countPeople(new Person("John"), new Person("Jane")); //vararg method

ArgumentCaptor<Person> peopleCaptor = ArgumentCaptor.forClass(Person.class);

verify(mock).countPeople(peopleCaptor.capture());

List expected = asList(new Person("John"), new Person("Jane"));
assertEquals(expected, peopleCaptor.getAllValues());
```

One call, two elements. Two calls, four elements, merged. If the grouping matters, capture the
array type instead — `ArgumentCaptor<Person[]>` — or use a `doAnswer` that records
`invocation.getRawArguments()`.

⚠️ `getAllValues()` is also the honest tool when a `verify(mock, times(3))` passes for the wrong
reason: assert on the list's contents with AssertJ's `containsExactly`, which reports the whole
list on failure. See [../02-assertj/03-collections.md](../02-assertj/03-collections.md).

## 🔴 Captor versus `argThat`

Mockito's own comparison, verbatim:

> *"In a way ArgumentCaptor is related to custom argument matchers … Both techniques can be used
> for making sure certain arguments were passed to mocks. However, ArgumentCaptor may be a better
> fit if:*
> - *custom argument matcher is not likely to be reused*
> - *you just need it to assert on argument values to complete verification*
>
> *Custom argument matchers via `ArgumentMatcher` are usually better for stubbing."*

|  | `argThat(...)` | `ArgumentCaptor` |
|---|---|---|
| When it decides | **during** the call, while Mockito searches for a match | **after** the verification, in your assertion |
| What it produces on failure | "no matching invocation", plus the matcher's `toString()` | your assertion library's message, with actual and expected |
| Works for stubbing | **yes** — the only option | **no** — nothing has been called yet |
| Works for verification | yes | yes, and better |
| Reusable | yes, if named | no, per-test |
| Composable with several assertions | awkward — one boolean | natural — as many `assertThat` calls as you like |

**The rule in one line: stub with a matcher, verify with a captor.**

And the reason the failure message differs is structural, not incidental. A matcher can only
return `true` or `false`, so Mockito has nothing to print except "I looked and found nothing".
A captor hands you the real object, so AssertJ can say *which field* differed and what both
values were.

## 🔴 Do not capture during a stubbing

> ***Warning:*** *it is recommended to use ArgumentCaptor with verification **but not** with
> stubbing. Using ArgumentCaptor with stubbing may decrease test readability because captor is
> created outside of assertion (aka verify or 'then') blocks. It may also reduce defect
> localization because if the stubbed method was not called, then no argument is captured.*

The second reason is the sharp one. If you write:

```java
// don't
when(repository.save(captor.capture())).thenReturn(saved);

service.confirm(ORDER_ID);

assertThat(captor.getValue().status()).isEqualTo(CONFIRMED);
```

and `save` is never called, `captor.getValue()` throws — from the assertion line, about an empty
captor, with nothing pointing at the missing call. A `verify(repository).save(captor.capture())`
fails first and says *"Wanted but not invoked"*.

⚠️ Note the `ArgumentCaptor.captor()` javadoc's own example uses `doNothing().when(repository).storeUsers(captor.capture())`
— capturing during a stubbing, in the documentation, immediately after the class javadoc warns
against it. The example is demonstrating the `captor()` factory, not endorsing the placement.

## Gotchas

**★ `getValue()` after a method was called several times.**
It returns the **last** captured value, silently. The test reads like an assertion about "the"
argument and is actually about the final one. Use `getAllValues()` and assert on the list.

**★ `getAllValues()` on a varargs method called more than once.**
The documented behaviour is a *merged* list: *"When varargs method was called multiple times,
this method returns merged list of all values from all invocations."* Two calls of two arguments
give four elements with no grouping. Capture the array type if the grouping matters.

**★ `capture()` mixed with a raw argument.**
A captor is an argument matcher, so the all-or-nothing rule applies:
`verify(mock).send(captor.capture(), "urgent")` throws `InvalidUseOfMatchersException`. The
literal needs `eq("urgent")`.

**★ `capture()` outside a `verify`.**
It registers a matcher on the thread-local stack. Called anywhere else — in a helper, in an
assertion, in a field initialiser — it corrupts the next interaction and the error surfaces
somewhere unrelated.

**★ Capturing during a stubbing.**
The javadoc warns against it for two reasons, and the second is the expensive one: *"if the
stubbed method was not called, then no argument is captured"*, so the failure is an empty captor
at your assertion rather than *"Wanted but not invoked"* at the verification.

**★ `getValue()` on a captor that captured nothing.**
It throws, and the exception is about the captor rather than about the call that never happened.
Always pair a captor with a `verify` so the missing call fails first.

**★ A captor reused across two verifications in one test.**
`getAllValues()` accumulates across every invocation the captor matched, from both verifications.
The list is longer than either verification implies, and indexes shift.

**★ A captor used where `eq(expected)` would do.**
If the argument is a value type with a proper `equals`, `verify(mock).save(expectedOrder)` is
shorter and its failure message already shows both objects. A captor earns its place when you
want to assert on *part* of the argument, or on something derived from it.

**★ Asserting on a captured object that the code mutated afterwards.**
A captor stores the reference, not a snapshot. If the code under test mutates the object after
the call, the assertion sees the mutated state. This is the same hazard `eq` has, and it is why
immutable argument types make interaction tests easier.

## Interview questions

**★ What is an `ArgumentCaptor`, mechanically?**
An argument matcher that accepts everything and records what it saw. `capture()` is implemented
as `Mockito.argThat(capturingMatcher)` and returns the type's default value, so it obeys every
rule matchers obey: it must appear inside a `verify`, and if you use it, every other argument in
that call needs a matcher too.

**★ Captor or `argThat` — how do you choose?**
Stubbing must use a matcher, because there is no invocation to capture yet. Verification should
prefer a captor, because a matcher can only return `true` or `false` and the failure message is
therefore "nothing matched", whereas a captor hands the object to your assertion library and you
get "expected status CONFIRMED but was PENDING". Mockito's own guidance: a captor is better when
the matcher *"is not likely to be reused"* and when *"you just need it to assert on argument
values to complete verification"*; matchers are *"usually better for stubbing"*.

**★ Why does Mockito warn against using a captor with stubbing?**
Two reasons it states outright. Readability — the captor is created outside the assertion block,
so the test reads out of order. And defect localisation — *"if the stubbed method was not called,
then no argument is captured"*, so instead of a clear "wanted but not invoked" you get a
confusing failure inside `getValue()` at the assertion line.

**★ Your method was called three times and `getValue()` returns something unexpected. Why?**
`getValue()` returns the *latest* captured value. With multiple invocations you want
`getAllValues()`, which returns them in order, and then an assertion on the whole list — which
also fails more informatively than an assertion on one element.

**★ What does `getAllValues()` return for a varargs method called twice?**
One flat, merged list of every argument from both invocations — the javadoc says *"merged list of
all values from all invocations"*. It does not group by call. If you need the grouping, capture
the array type or record `getRawArguments()` in a `doAnswer`.

**★ Can a captor make a test pass for the wrong reason?**
Yes, in two ways. It stores a reference rather than a snapshot, so a mutation after the call is
invisible to the test's intent. And if the assertion only reads `getValue()` after a
`times(3)` verification, two of the three calls are never examined — `getAllValues()` plus
`containsExactly` is the honest form.

{/* FOOTER */}
